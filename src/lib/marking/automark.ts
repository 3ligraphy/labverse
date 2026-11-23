/**
 * AUTO-MARK — a first draft of a group's marks, the way a chosen TA marks. Two sources, per criterion:
 *   1. Evidence from the hand-in (readEvidence): the screens in the app's code, the architecture pattern named in the
 *      report and whether its folders exist in the code, the reasoning around it, the functional requirements
 *      listed. They become grading-assistant answers, so the brief's rule (suggest) turns them into a mark, and the
 *      comment gets the assistant's sentences.
 *   2. The TA's pattern (taPattern): from the groups that TA already marked, how far their marks usually sit from the
 *      assistant's suggestion (their leniency, added to an evidence mark), and their usual mark for a criterion the
 *      evidence cannot decide (diagrams are pictures: their marks come from the pattern).
 * Nothing is saved: the TA checks every mark, and typed marks are never replaced. Pure functions
 * (tests/automark.test.ts).
 */
import { CRITERIA, type CriterionId } from './rubric.ts';
import { suggest, type Answers, type Level } from './assistant.ts';
import type { MarkingDoc, TA } from './doc.ts';

const round2 = (n: number) => Math.round(n * 100) / 100;
const maxOf = (id: CriterionId) => CRITERIA.find((c) => c.id === id)!.max;
const clamp = (id: CriterionId, v: number) => round2(Math.min(maxOf(id), Math.max(0, v)));
/** Pattern marks are snapped to quarter marks, the steps TAs actually use. */
const snap = (id: CriterionId, v: number) => clamp(id, Math.round(v * 4) / 4);
const median = (xs: readonly number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null;
};

/* ------------------------------------------------------------------ evidence */

export type Evidence = { answers: Partial<Record<CriterionId, Answers>>; found: Partial<Record<CriterionId, string>> };

const CODE = /\.(tsx|jsx|ts|js)$/i;
/** Sign-in and registration are not counted as screens (the brief). */
const AUTH = /(^|[/_-])(log-?in|sign-?in|sign-?up|register|registration|auth|forgot[-_]?password|reset[-_]?password|otp|verify)([/._-]|screen|$)/i;

/**
 * The app's screens from its file paths (relative to the app folder): Expo Router routes (app/ or src/app/, not
 * layouts or +special files) and files in screens/ or named …Screen. Sign-in and registration screens are left out.
 */
export function screensIn(files: readonly string[]): string[] {
  const names = new Set<string>();
  for (const f of files) {
    if (!CODE.test(f) || /\.d\.ts$/i.test(f) || /(^|\/)(node_modules|__tests__|components?|hooks|utils?|lib|constants|services|context|store|assets)\//i.test(f)) continue;
    const route = /^(?:src\/)?app\/(.+)\.(tsx|jsx|ts|js)$/i.exec(f);
    const inFolder = /(^|\/)(screens|pages|views)\/(.+)\.(tsx|jsx|ts|js)$/i.exec(f)?.[3];
    const named = /(^|\/)([A-Za-z0-9]+Screen)\.(tsx|jsx|ts|js)$/.exec(f)?.[2];
    let path = route?.[1] ?? inFolder ?? named ?? null;
    if (!path) continue;
    const base = path.split('/').pop()!;
    if (/^[_+]/.test(base) || /^(styles?|types?)$/i.test(base)) continue;
    if (AUTH.test(`/${path}`)) continue;
    // app/(tabs)/index → "(tabs)"; app/profile/index → "profile"; HomeScreen → "home"
    if (/^index$/i.test(base)) path = path.split('/').slice(0, -1).join('/') || 'home';
    names.add(path.replace(/\([^)]*\)\/?/g, '').replace(/screen$/i, '').replace(/[/_\s-]+/g, '').toLowerCase() || 'home');
  }
  return [...names].sort();
}

type PatternDef = { name: string; re: RegExp; folders: RegExp[] };
/** Architecture / design patterns students name, and the folders that show each one in the code. */
const PATTERNS: PatternDef[] = [
  { name: 'MVVM', re: /\bMVVM\b|model[\s-]*view[\s-]*view[\s-]*model/gi, folders: [/(^|\/)(view-?models?|hooks)\//i, /(^|\/)models?\//i] },
  { name: 'MVC', re: /\bMVC\b|model[\s-]*view[\s-]*controller/gi, folders: [/(^|\/)controllers?\//i, /(^|\/)models?\//i] },
  { name: 'MVP', re: /model[\s-]*view[\s-]*presenter/gi, folders: [/(^|\/)presenters?\//i, /(^|\/)models?\//i] },
  { name: 'Clean Architecture', re: /clean\s+architecture/gi, folders: [/(^|\/)domain\//i, /(^|\/)(data|infrastructure)\//i, /(^|\/)(presentation|ui)\//i] },
  { name: 'Redux', re: /\bredux\b/gi, folders: [/(^|\/)(store|redux|slices|reducers)\//i] },
  { name: 'Provider / Context', re: /context\s*api|provider\s+pattern|react\s+context|usecontext/gi, folders: [/(^|\/)(contexts?|providers?)\//i] },
  { name: 'Repository', re: /repository\s+pattern/gi, folders: [/(^|\/)(repositor(y|ies)|services?)\//i] },
];
const REASONS = /\b(because|since|so that|allows?|helps?|separat\w*|maintainab\w*|testab\w*|scalab\w*|reusab\w*|reason\w*|chose|choose|chosen|why|suitable|fits?|benefits?|advantages?|decoupl\w*|organi[sz]\w*|responsibilit\w*)\b/gi;

/** The pattern the report names most (null: none), and whether the naming is clear (one pattern clearly first). */
export function namedPattern(report: string): { def: PatternDef; level: Level; count: number } | null {
  const counts = PATTERNS.map((def) => ({ def, count: report.match(def.re)?.length ?? 0 })).filter((x) => x.count).sort((a, b) => b.count - a.count);
  if (!counts.length) return null;
  const [top, second] = counts;
  return { ...top, level: !second || top.count >= 2 * second.count ? 'clear' : 'partly' };
}

/** The functional requirements the report lists (FR1, FR-2… or a numbered list in that section), sign-in / sign-up left out. */
export function requirementsIn(report: string): number | null {
  const start = report.search(/(?<!non[-\s]?)functional\s+requirements?/i);
  if (start < 0) return null;
  const rest = report.slice(start + 20);
  const end = rest.search(/non[-\s]?functional|use[-\s]?case\s+diagram|activity\s+diagram/i);
  const section = rest.slice(0, end > 0 ? end : 5000);
  const items = (re: RegExp) => {
    const out = new Map<string, string>();
    const hits = [...section.matchAll(re)];
    hits.forEach((m, i) => out.set(m[1], section.slice(m.index! + m[0].length, hits[i + 1]?.index ?? m.index! + 200)));
    return out;
  };
  let found = items(/\bFR\s*[-_.]?\s*(\d{1,2})\b/gi);
  if (found.size < 2) found = items(/(?:^|\s)(\d{1,2})[.)]\s+(?=[A-Za-z])/g);
  if (found.size < 2) return null;
  return [...found.values()].filter((t) => !/\b(log\s*-?\s*in|sign\s*-?\s*(in|up)|register|registration)\b/i.test(t.slice(0, 120))).length;
}

/**
 * Assistant answers from a hand-in: the report's text and the app's file paths. Only what the files show is
 * answered; `found` says, per criterion, what was seen (shown to the TA).
 */
export function readEvidence(report: string, files: readonly string[]): Evidence {
  const answers: Evidence['answers'] = {};
  const found: Evidence['found'] = {};
  const hasCode = files.some((f) => CODE.test(f));
  if (hasCode) {
    const screens = screensIn(files);
    answers.ui_screens = { screens: screens.length };
    found.ui_screens = `${screens.length} screen${screens.length === 1 ? '' : 's'} in the code (sign-in / registration not counted)`;
  }
  const text = report.replace(/\s+/g, ' ');
  if (text.length >= 300) {
    const reqs = requirementsIn(text);
    if (reqs !== null) {
      answers.uc_mapping = { reqs };
      answers.ad_reqs = { reqs };
      found.uc_mapping = found.ad_reqs = `${reqs} functional requirement${reqs === 1 ? '' : 's'} listed in the report (not sign-in / sign-up)`;
    }
    const p = namedPattern(text);
    answers.ar_pattern = { level: p ? p.level : 'none' };
    found.ar_pattern = p ? `the report names ${p.def.name}${p.level === 'partly' ? ' among other patterns' : ''}` : 'the report names no architecture or design pattern';
    if (!p) answers.ar_reason = { level: 'none' };
    else {
      // the reasoning: words that explain a choice, near where the report names the pattern
      const words = new Set<string>();
      for (const m of text.matchAll(p.def.re)) for (const w of text.slice(Math.max(0, m.index! - 400), m.index! + 600).matchAll(REASONS)) words.add(w[0].toLowerCase().slice(0, 6));
      answers.ar_reason = { level: words.size >= 3 ? 'clear' : words.size ? 'partly' : 'none' };
      found.ar_reason = words.size ? `${words.size} reasoning word${words.size === 1 ? '' : 's'} near ${p.def.name} (because, separates, maintainable…)` : `no reasoning near ${p.def.name}`;
      if (hasCode) {
        const seen = p.def.folders.filter((re) => files.some((f) => re.test(f))).length;
        answers.ar_impl = { level: seen === p.def.folders.length ? 'clear' : seen ? 'partly' : 'none' };
        found.ar_impl = `${seen} of ${p.def.folders.length} ${p.def.name} folders in the code`;
      }
    }
  }
  return { answers, found };
}

/* ------------------------------------------------------------------ the TA's pattern */

export type CriterionPattern = { values: number[]; median: number | null; bias: number; biasN: number };
export type Pattern = { groups: number[]; by: Record<CriterionId, CriterionPattern> };

const first = (s: string) => s.trim().replace(/^(?:dr|eng|prof|mr|mrs|ms)\.?\s+/i, '').split(/\s+/)[0]?.toLowerCase() ?? '';

/** The groups a TA marked: their load row's groups that have marks, and every group they saved marks for. */
export function groupsMarkedBy(doc: MarkingDoc, ta: Pick<TA, 'name' | 'groups'>): number[] {
  const me = first(ta.name);
  return Object.keys(doc.marks)
    .map(Number)
    .filter((n) => {
      const m = doc.marks[String(n)];
      if (!m || !Object.keys(m.scores).length) return false;
      return ta.groups.includes(n) || [m.by, ...(m.editors ?? [])].some((x) => x && first(x) === me);
    })
    .sort((a, b) => a - b);
}

/**
 * How a TA marks, per criterion, from their marked groups (not `except`): their marks, the median, and their bias
 * from the assistant's suggestion where they used it (shrunk toward 0 while there are few: two groups' worth of 0).
 */
export function taPattern(doc: MarkingDoc, ta: Pick<TA, 'name' | 'groups'> | null, except?: number): Pattern {
  const groups = ta ? groupsMarkedBy(doc, ta).filter((n) => n !== except) : Object.keys(doc.marks).map(Number).filter((n) => n !== except);
  const by = {} as Record<CriterionId, CriterionPattern>;
  for (const c of CRITERIA) {
    const values: number[] = [];
    const diffs: number[] = [];
    for (const n of groups) {
      const m = doc.marks[String(n)];
      const v = m?.scores[c.id];
      if (typeof v !== 'number') continue;
      values.push(v);
      const s = m.help?.[c.id] ? suggest(c.id, m.help[c.id]!) : null;
      if (s !== null) diffs.push(v - s);
    }
    by[c.id] = { values, median: median(values), bias: diffs.length ? round2(diffs.reduce((a, b) => a + b, 0) / (diffs.length + 2)) : 0, biasN: diffs.length };
  }
  return { groups, by };
}

/* ------------------------------------------------------------------ the draft */

export type AutoMark = { value: number; source: 'answers' | 'evidence' | 'pattern' | 'class'; note: string };
/** Fewer marks than this and the TA's own usual mark is not trusted over the class's. */
export const MIN_PATTERN = 3;

/**
 * The draft mark of every criterion the sources can decide. `answers`: the TA's own assistant answers for this group
 * (they win over the evidence). `ta` / `cls`: taPattern of the chosen TA and of the whole class.
 */
export function autoMark(evidence: Evidence, answers: Partial<Record<CriterionId, Answers>>, ta: Pattern, cls: Pattern, taName: string): { marks: Partial<Record<CriterionId, AutoMark>>; help: Partial<Record<CriterionId, Answers>> } {
  const marks: Partial<Record<CriterionId, AutoMark>> = {};
  const help: Partial<Record<CriterionId, Answers>> = {};
  for (const c of CRITERIA) {
    const own = answers[c.id];
    const merged = { ...(evidence.answers[c.id] ?? {}), ...(own ?? {}) };
    if (Object.keys(merged).length) help[c.id] = merged;
    const s = suggest(c.id, merged);
    const p = ta.by[c.id];
    if (s !== null) {
      const bias = Math.abs(p.bias) >= 0.05 ? p.bias : 0;
      const why = own ? 'your answers in the assistant' : evidence.found[c.id] ?? 'the hand-in';
      marks[c.id] = {
        value: clamp(c.id, s + bias),
        source: own ? 'answers' : 'evidence',
        note: `${why}${bias ? `; ${bias > 0 ? '+' : ''}${bias} as ${taName} usually marks ${bias > 0 ? 'above' : 'below'} the rule (${p.biasN} group${p.biasN === 1 ? '' : 's'})` : ''}`,
      };
      continue;
    }
    const k = cls.by[c.id];
    if (p.values.length >= MIN_PATTERN || (p.values.length && k.values.length < MIN_PATTERN)) {
      marks[c.id] = { value: snap(c.id, p.median!), source: 'pattern', note: `${taName}’s usual mark (median of ${p.values.length} group${p.values.length === 1 ? '' : 's'})` };
    } else if (k.values.length >= MIN_PATTERN) {
      marks[c.id] = { value: snap(c.id, k.median!), source: 'class', note: `the class’s usual mark (median of ${k.values.length} groups; ${taName} has marked ${p.values.length} so far)` };
    }
  }
  return { marks, help };
}
