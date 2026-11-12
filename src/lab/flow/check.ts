/**
 * Checks for flowchart exercises — the same lines as the C++ checks, one per line:
 *   Freezing     :: in 0; expect 32
 *   Not unknown  :: in 8 2; not unknown
 *   Has a loop   :: uses loop; uses decision
 * Steps: in <input> (several are read in order), expect <text>, exact <whole output>, not <text>,
 *        uses decision | loop | input | output.
 * A check passes when the flowchart runs to an End shape and every step holds.
 */
import type { Chart } from './chart.ts';
import { hasLoop, runChart } from './run.ts';

export type FlowStep = { in: string } | { expect: string } | { exact: string } | { not: string } | { uses: 'decision' | 'loop' | 'input' | 'output' };
export type FlowCheck = { name: string; steps: FlowStep[] };
export type FlowResult = { name: string; pass: boolean; message?: string };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const unescape = (s: string) => s.replace(/\\n/g, '\n').replace(/\\t/g, '\t');

export function parseFlowChecks(text: string): Result<FlowCheck[]> {
  const out: FlowCheck[] = [];
  for (const [i, line] of text.split(/\r?\n/).map((l) => l.trim()).entries()) {
    if (!line || line.startsWith('#')) continue;
    const at = line.indexOf('::');
    if (at < 1) return { ok: false, error: `Check line ${i + 1} needs “name :: steps”.` };
    const name = line.slice(0, at).trim();
    const steps: FlowStep[] = [];
    for (const raw of line.slice(at + 2).split(';').map((p) => p.trim()).filter(Boolean)) {
      let m: RegExpMatchArray | null;
      if ((m = raw.match(/^in\s+(.*)$/i))) steps.push({ in: unescape(m[1]) });
      else if ((m = raw.match(/^exact\s+(.+)$/i))) steps.push({ exact: unescape(m[1]) });
      else if ((m = raw.match(/^expect\s+(.+)$/i))) steps.push({ expect: unescape(m[1]) });
      else if ((m = raw.match(/^not\s+(.+)$/i))) steps.push({ not: unescape(m[1]) });
      else if ((m = raw.match(/^uses\s+(decision|loop|input|output)$/i))) steps.push({ uses: m[1].toLowerCase() as 'decision' });
      else return { ok: false, error: `Check “${name}”: don't understand “${raw}”.` };
    }
    if (!steps.length) return { ok: false, error: `Check “${name}” has no steps.` };
    out.push({ name, steps });
  }
  return { ok: true, value: out };
}

const squash = (s: string) => s.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
const quote = (s: string) => `“${s.length > 140 ? `${s.slice(0, 140)}…` : s}”`;

export function checkChart(chart: Chart, checks: string | FlowCheck[]): FlowResult[] {
  let list: FlowCheck[];
  if (typeof checks === 'string') {
    const parsed = parseFlowChecks(checks);
    if (!parsed.ok) return [{ name: 'Checks', pass: false, message: parsed.error }];
    list = parsed.value;
  } else list = checks;
  const has = (shape: 'decision' | 'io', input?: boolean) => chart.nodes.some((n) => n.shape === shape && (input === undefined || /^\s*(input|read|get|enter)\b/i.test(n.text) === input));
  return list.map((c): FlowResult => {
    const input = c.steps.filter((s): s is { in: string } => 'in' in s).map((s) => s.in).join('\n');
    const needsRun = c.steps.some((s) => 'expect' in s || 'exact' in s || 'not' in s);
    const run = needsRun ? runChart(chart, input) : null;
    if (run && !run.ok) return { name: c.name, pass: false, message: run.error!.message };
    const out = squash(run?.output ?? '');
    const given = input.trim() ? `With the input ${quote(input.replace(/\n/g, ' '))}` : 'It';
    for (const s of c.steps) {
      if ('expect' in s && !out.includes(squash(s.expect))) return { name: c.name, pass: false, message: `${given} should print ${quote(s.expect)}, but it printed ${quote(out || '(nothing)')}.` };
      if ('exact' in s && out !== squash(s.exact)) return { name: c.name, pass: false, message: `${given} should print exactly ${quote(s.exact)}, but it printed ${quote(out || '(nothing)')}.` };
      if ('not' in s && out.includes(squash(s.not))) return { name: c.name, pass: false, message: `${given} should not print ${quote(s.not)}.` };
      if ('uses' in s) {
        const ok = s.uses === 'loop' ? hasLoop(chart) : s.uses === 'decision' ? has('decision') : has('io', s.uses === 'input');
        const why = { loop: 'This problem needs a loop: an arrow that goes back up, so shapes repeat.', decision: 'This problem needs a decision (a diamond) with a Yes and a No arrow.', input: 'Read the values with an Input shape (a parallelogram).', output: 'Show the result with an Output shape (a parallelogram).' }[s.uses];
        if (!ok) return { name: c.name, pass: false, message: why };
      }
    }
    return { name: c.name, pass: true };
  });
}
