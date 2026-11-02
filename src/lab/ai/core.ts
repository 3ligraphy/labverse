/**
 * AI FOR CODING kit — pure rules shared by the server (compileLab) and the widgets (src/lab/ai/ui).
 *   rubric  — "name :: /regex/flags :: tip" lines: the ingredients a prompt workbench looks for
 *   script  — the agent-run mini-language (user: think: read: run: out: edit: say: ask: ok: no:)
 *   diff    — a unified-style diff where "!" marks the lines a reviewer should flag ("## why" explains it)
 * No DOM here, so it is unit-tested (tests/ai-for-coding.test.ts).
 */

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/* ------------------------------------------------------------------ rubric */

export type RubricItem = { name: string; pattern: string; flags: string; tip: string };

/** "Context :: /\bsrc\//i :: Name the file" → a rubric item. Blank lines and # comments are skipped. */
export function parseRubric(text: string): Result<RubricItem[]> {
  const items: RubricItem[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  for (const [i, line] of lines.entries()) {
    const parts = line.split('::').map((p) => p.trim());
    const name = parts[0];
    const m = (parts[1] ?? '').match(/^\/(.+)\/([gimsuy]*)$/);
    if (!name || !m) return { ok: false, error: `Ingredient line ${i + 1} needs “name :: /regex/ :: tip”.` };
    const flags = m[2].replace(/g/g, '');
    try { new RegExp(m[1], flags); } catch { return { ok: false, error: `Ingredient “${name}”: the pattern /${m[1]}/ is not a valid regular expression.` }; }
    items.push({ name: name.slice(0, 60), pattern: m[1], flags, tip: (parts.slice(2).join('::') || `Add: ${name}`).slice(0, 300) });
  }
  if (items.length > 20) return { ok: false, error: 'Use at most 20 ingredients.' };
  return { ok: true, value: items };
}

export const wordCount = (s: string) => (s.match(/[\p{L}\p{N}_'’./-]+/gu) ?? []).length;
/** a rough token estimate (about 4 characters per token in English and code) */
export const tokenEstimate = (s: string) => Math.ceil(s.trim().length / 4);

export type PromptScore = { found: boolean[]; passed: number; total: number; words: number; tokens: number; longEnough: boolean; solved: boolean };

/** Which ingredients a prompt has. It is solved when every ingredient is there and it is long enough. */
export function scorePrompt(prompt: string, rubric: RubricItem[], minWords = 0): PromptScore {
  const found = rubric.map((r) => {
    try { return new RegExp(r.pattern, r.flags).test(prompt); } catch { return false; }
  });
  const passed = found.filter(Boolean).length;
  const words = wordCount(prompt);
  const longEnough = words >= minWords;
  return { found, passed, total: rubric.length, words, tokens: tokenEstimate(prompt), longEnough, solved: passed === rubric.length && longEnough };
}

/* ------------------------------------------------------------ agent script */

export type AgentOption = { text: string; correct: boolean; why: string };
export type AgentStep =
  | { kind: 'user' | 'think' | 'say'; text: string }
  | { kind: 'read' | 'run'; text: string; out: string[] }
  | { kind: 'edit'; text: string; diff: string[] }
  | { kind: 'ask'; text: string; options: AgentOption[] };

const STEP_RE = /^(user|think|read|run|out|edit|say|ask|ok|no):\s?(.*)$/;

/**
 * One step per line. out: lines attach to the read/run before them; + / - lines attach to the edit before them;
 * ok: / no: options attach to the ask before them (ok = a right choice). An ask needs 2+ options and one ok.
 */
export function parseAgentScript(text: string): Result<AgentStep[]> {
  const steps: AgentStep[] = [];
  const lines = text.split(/\r?\n/);
  for (const [i, raw] of lines.entries()) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const last = steps[steps.length - 1];
    if (/^[+-]/.test(raw) && last?.kind === 'edit') { last.diff.push(raw); continue; }
    const m = raw.trim().match(STEP_RE);
    if (!m) return { ok: false, error: `Script line ${i + 1}: start it with user:, think:, read:, run:, out:, edit:, say:, ask:, ok: or no:.` };
    const [, kind, body] = m;
    if (kind === 'out') {
      if (last?.kind !== 'read' && last?.kind !== 'run') return { ok: false, error: `Script line ${i + 1}: out: must follow a read: or run: step.` };
      last.out.push(body);
    } else if (kind === 'ok' || kind === 'no') {
      if (last?.kind !== 'ask') return { ok: false, error: `Script line ${i + 1}: ${kind}: must follow an ask: step.` };
      const [opt, ...why] = body.split('::');
      last.options.push({ text: opt.trim(), correct: kind === 'ok', why: why.join('::').trim() });
    } else if (kind === 'read' || kind === 'run') steps.push({ kind, text: body, out: [] });
    else if (kind === 'edit') steps.push({ kind, text: body, diff: [] });
    else if (kind === 'ask') steps.push({ kind, text: body, options: [] });
    else steps.push({ kind: kind as 'user' | 'think' | 'say', text: body });
  }
  for (const s of steps) {
    if (s.kind === 'ask' && (s.options.length < 2 || !s.options.some((o) => o.correct))) {
      return { ok: false, error: `The question “${s.text.slice(0, 40)}” needs 2+ options and at least one ok:.` };
    }
    if (s.kind === 'ask' && s.options.length > 6) return { ok: false, error: `The question “${s.text.slice(0, 40)}” has more than 6 options.` };
  }
  if (!steps.length) return { ok: false, error: 'The script is empty.' };
  if (steps.length > 120) return { ok: false, error: 'Keep the script under 120 steps.' };
  return { ok: true, value: steps };
}

/* -------------------------------------------------------------------- diff */

export type DiffLine = { sign: '+' | '-' | ' '; code: string; bug: boolean; why: string };

/** "!+ code ## why" → a flagged added line. Lines without + / - are context lines. */
export function parseDiff(text: string): DiffLine[] {
  return text.replace(/\s+$/, '').split(/\r?\n/).slice(0, 400).map((raw) => {
    let line = raw;
    const bug = line.startsWith('!');
    if (bug) line = line.slice(1);
    const sign = line[0] === '+' || line[0] === '-' ? (line[0] as '+' | '-') : ' ';
    const rest = sign === ' ' && line.startsWith(' ') ? line.slice(1) : sign === ' ' ? line : line.slice(1);
    const at = rest.lastIndexOf(' ## ');
    const code = at >= 0 ? rest.slice(0, at).replace(/\s+$/, '') : rest;
    const why = at >= 0 ? rest.slice(at + 4).trim() : '';
    return { sign, code, bug, why };
  });
}

export type ReviewResult = { hits: number; misses: number; falseAlarms: number; passed: number; total: number; solved: boolean };

/** Grade a review: each flagged problem is one check, and "no false alarms" is the last one. */
export function gradeReview(lines: DiffLine[], flagged: number[]): ReviewResult {
  const set = new Set(flagged);
  const bugIdx = lines.flatMap((l, i) => (l.bug ? [i] : []));
  const hits = bugIdx.filter((i) => set.has(i)).length;
  const falseAlarms = [...set].filter((i) => lines[i] && !lines[i].bug).length;
  const passed = hits + (falseAlarms === 0 ? 1 : 0);
  const total = bugIdx.length + 1;
  return { hits, misses: bugIdx.length - hits, falseAlarms, passed, total, solved: passed === total };
}
