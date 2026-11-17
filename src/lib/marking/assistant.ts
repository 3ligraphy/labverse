/**
 * The grading assistant beside the marking form. Each criterion has the brief's rule and a few questions:
 * counts (requirements, screens…), yes / no findings, or a level. The answers give a suggested mark (suggest)
 * and ready sentences for the comment (explain), so every TA turns the same findings into the same marks.
 * The TA can still change both. Generic wording only: nothing about a particular group.
 * Pure functions, unit-tested (tests/marking*.test.ts).
 */
import { CRITERIA, type CriterionId } from './rubric.ts';

export const RULES: Record<CriterionId, string> = {
  uc_actors: 'At least two actors, each drawn once.',
  uc_logic: 'One diagram, correct notation, include and extend used the right way. Wrong notation = 0.',
  uc_mapping: 'Every functional requirement (at least 5, login and sign-up not counted) has its use case.',
  ad_reqs: 'The flow covers every functional requirement.',
  ad_flow: 'Start node, end node, activities, decisions and a logical flow. −0.5 for each missing or wrong part.',
  ui_screens: '1 mark per screen: 9 screens, 3 per member (sign-in and registration not counted). Missing −1, incorrect −0.5.',
  ar_pattern: 'An architecture or design pattern is chosen and named (MVC, MVVM, Provider / Context…).',
  ar_impl: 'The pattern is applied in the project’s folder structure and code.',
  ar_reason: 'The choice is explained: why this pattern fits the app.',
};

export type Level = 'clear' | 'partly' | 'none';
export const LEVELS: readonly Level[] = ['clear', 'partly', 'none'];
export type Question =
  | { key: string; kind: 'count'; label: string; max: number }
  | { key: string; kind: 'yes'; label: string; deduction: number; sentence: string }
  | { key: string; kind: 'level'; label: string; options: Record<Level, string>; sentences: Partial<Record<Level, string>> };
export type Answers = Record<string, number | boolean | string | null | undefined>;

const REQS_MIN = 'List at least 5 functional requirements (login and sign-up do not count).';

export const HELPERS: Record<CriterionId, Question[]> = {
  uc_actors: [
    { key: 'actors', kind: 'count', label: 'Different actors in the diagram', max: 20 },
    { key: 'twice', kind: 'yes', label: 'An actor is drawn more than once', deduction: 0.3, sentence: 'Draw each actor only once in the use case diagram.' },
  ],
  uc_logic: [
    { key: 'wrongNotation', kind: 'yes', label: 'Not use case notation (this mark is 0)', deduction: 1.5, sentence: 'The use case diagram does not use use case notation: actors, use cases (ovals) and the system boundary.' },
    { key: 'split', kind: 'yes', label: 'Split into several diagrams', deduction: 0.5, sentence: 'The use case diagram should be one diagram with all actors and use cases.' },
    { key: 'includeExtend', kind: 'yes', label: 'Include / extend wrong or reversed', deduction: 0.5, sentence: 'Check the include and extend arrows: extend points from the optional use case to the base use case.' },
    { key: 'problems', kind: 'count', label: 'Other logic mistakes (−0.5 each)', max: 10 },
  ],
  uc_mapping: [
    { key: 'reqs', kind: 'count', label: 'Functional requirements in the report (not login / sign-up)', max: 40 },
    { key: 'mapped', kind: 'count', label: 'Of these, with a use case in the diagram', max: 40 },
    { key: 'crud', kind: 'yes', label: 'Add, edit and delete are separate requirements', deduction: 0.5, sentence: 'Combine add, edit and delete into one requirement, for example “Manage tasks”, in the requirements and the diagram.' },
  ],
  ad_reqs: [
    { key: 'reqs', kind: 'count', label: 'Functional requirements in the report (not login / sign-up)', max: 40 },
    { key: 'covered', kind: 'count', label: 'Of these, in the activity diagram', max: 40 },
  ],
  ad_flow: [
    { key: 'noStart', kind: 'yes', label: 'No start node', deduction: 0.5, sentence: 'The activity diagram needs a start node.' },
    { key: 'noEnd', kind: 'yes', label: 'No end node', deduction: 0.5, sentence: 'The activity diagram needs an end node.' },
    { key: 'noDecisions', kind: 'yes', label: 'No decisions where the flow branches', deduction: 0.5, sentence: 'Add decision nodes where the flow branches (for example, a wrong password).' },
    { key: 'split', kind: 'yes', label: 'Split into several diagrams', deduction: 0.5, sentence: 'The activity diagram should be one diagram with every flow of the app.' },
    { key: 'messy', kind: 'yes', label: 'Messy or hard to read', deduction: 0.3, sentence: 'Make the activity diagram clearer and easier to read.' },
    { key: 'problems', kind: 'count', label: 'Other missing or wrong parts (−0.5 each)', max: 10 },
  ],
  ui_screens: [
    { key: 'screens', kind: 'count', label: 'Screens implemented (not sign-in / registration)', max: 40 },
    { key: 'incorrect', kind: 'count', label: 'Of these, incorrect (−0.5 each)', max: 40 },
    { key: 'generated', kind: 'yes', label: 'UI looks generated, no own design', deduction: 1, sentence: 'The UI looks generated with no design of your own: AI may help with code, but design the screens yourselves.' },
    { key: 'mainEmpty', kind: 'yes', label: 'Main branch empty (note only, no deduction)', deduction: 0, sentence: 'The main branch of the repository is empty: merge your work into main before the next phase.' },
  ],
  ar_pattern: [
    {
      key: 'level', kind: 'level', label: 'The pattern',
      options: { clear: 'Named and a real pattern', partly: 'Vague or mixed', none: 'No pattern' },
      sentences: { partly: 'Name one architecture or design pattern clearly (for example MVVM) and use only that one.', none: 'Choose an architecture or design pattern and name it in the report.' },
    },
  ],
  ar_impl: [
    {
      key: 'level', kind: 'level', label: 'In the folders and code',
      options: { clear: 'Follows the pattern', partly: 'Partly', none: 'Not in the code' },
      sentences: { partly: 'Parts of the code do not follow the pattern you chose: move them into the right folders.', none: 'The report names a pattern, but the code is organised differently: the folders must follow the pattern you chose.' },
    },
  ],
  ar_reason: [
    {
      key: 'level', kind: 'level', label: 'The reasoning',
      options: { clear: 'Explains why it fits this app', partly: 'Short or generic', none: 'Missing' },
      sentences: { partly: 'Explain in more detail why you chose this architecture.', none: 'Explain why you chose this architecture for your app.' },
    },
  ],
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const maxOf = (id: CriterionId) => CRITERIA.find((c) => c.id === id)!.max;
const ask = (id: CriterionId, key: string) => HELPERS[id].find((q) => q.key === key);

/** A count answer: a whole number from 0 to the question's maximum, or undefined when not answered. */
function count(id: CriterionId, a: Answers, key: string): number | undefined {
  const v = a[key];
  if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || typeof v === 'boolean') return undefined;
  const n = Math.floor(Number(v));
  const q = ask(id, key);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, q && q.kind === 'count' ? q.max : n) : undefined;
}
const yes = (a: Answers, key: string) => a[key] === true || a[key] === 'true';
const levelOf = (a: Answers): Level | undefined => (LEVELS.includes(a.level as Level) ? (a.level as Level) : undefined);
const answered = (id: CriterionId, a: Answers) => HELPERS[id].some((q) => (q.kind === 'count' ? count(id, a, q.key) !== undefined : q.kind === 'yes' ? a[q.key] === true || a[q.key] === false : levelOf(a) !== undefined));
/** The yes / no findings' deductions. */
const deductions = (id: CriterionId, a: Answers) => HELPERS[id].reduce((s, q) => s + (q.kind === 'yes' && yes(a, q.key) ? q.deduction : 0), 0);
const LEVEL_MARK: Record<Level, number> = { clear: 2, partly: 1, none: 0 };

/** The mark the answers give, before clamping; null while the answers that decide it are missing. */
function raw(id: CriterionId, a: Answers): number | null {
  const n = (key: string) => count(id, a, key);
  switch (id) {
    case 'uc_actors': {
      const actors = n('actors');
      if (actors === undefined) return null;
      return (actors >= 2 ? 1 : actors === 1 ? 0.5 : 0) - deductions(id, a);
    }
    case 'uc_logic':
      if (!answered(id, a)) return null;
      return yes(a, 'wrongNotation') ? 0 : 1.5 - deductions(id, a) - 0.5 * (n('problems') ?? 0);
    case 'uc_mapping': {
      const reqs = n('reqs');
      const mapped = n('mapped');
      if (reqs === undefined || mapped === undefined) return null;
      return (5 * Math.min(mapped, reqs)) / Math.max(reqs, 5) - deductions(id, a);
    }
    case 'ad_reqs': {
      const reqs = n('reqs');
      const covered = n('covered');
      if (reqs === undefined || covered === undefined) return null;
      return (5 * Math.min(covered, reqs)) / Math.max(reqs, 5);
    }
    case 'ad_flow':
      if (!answered(id, a)) return null;
      return 2.5 - deductions(id, a) - 0.5 * (n('problems') ?? 0);
    case 'ui_screens': {
      const screens = n('screens');
      if (screens === undefined) return null;
      return Math.min(9, screens) - 0.5 * Math.min(n('incorrect') ?? 0, screens) - deductions(id, a);
    }
    case 'ar_pattern':
    case 'ar_impl':
    case 'ar_reason': {
      const l = levelOf(a);
      return l ? LEVEL_MARK[l] : null;
    }
  }
}

/** The suggested mark (0…max, 2 decimals), or null when the answers do not decide it yet. */
export function suggest(id: CriterionId, a: Answers): number | null {
  const v = raw(id, a);
  return v === null ? null : round2(Math.min(maxOf(id), Math.max(0, v)));
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Ready sentences for the comment: one for each finding that costs marks (and the notes). */
export function explain(id: CriterionId, a: Answers): string[] {
  const out: string[] = [];
  const n = (key: string) => count(id, a, key);
  const yesSentences = () => {
    for (const q of HELPERS[id]) if (q.kind === 'yes' && yes(a, q.key)) out.push(q.sentence);
  };
  if (id === 'uc_actors') {
    const actors = n('actors');
    if (actors !== undefined && actors < 2) out.push('The use case diagram needs at least two actors.');
    yesSentences();
  } else if (id === 'uc_logic') {
    if (yes(a, 'wrongNotation')) out.push((ask(id, 'wrongNotation') as { sentence: string }).sentence);
    else {
      yesSentences();
      const p = n('problems') ?? 0;
      if (p) out.push(`The use case diagram has ${plural(p, 'more logic mistake', 'more logic mistakes')}: check which actor uses which use case.`);
    }
  } else if (id === 'uc_mapping' || id === 'ad_reqs') {
    const reqs = n('reqs');
    const done = n(id === 'uc_mapping' ? 'mapped' : 'covered');
    if (reqs !== undefined && reqs < 5) out.push(REQS_MIN);
    if (reqs !== undefined && done !== undefined && done < reqs) {
      const missing = reqs - done;
      out.push(id === 'uc_mapping' ? `${missing} of the ${reqs} functional requirements ${missing === 1 ? 'has' : 'have'} no use case in the diagram.` : `${missing} of the ${reqs} functional requirements ${missing === 1 ? 'is' : 'are'} missing from the activity diagram.`);
    }
    yesSentences();
  } else if (id === 'ad_flow') {
    yesSentences();
    const p = n('problems') ?? 0;
    if (p) out.push(`The activity diagram has ${plural(p, 'more missing or wrong part', 'more missing or wrong parts')} in its flow.`);
  } else if (id === 'ui_screens') {
    const screens = n('screens');
    if (screens !== undefined && screens < 9) out.push(`${9 - screens} of the 9 screens ${9 - screens === 1 ? 'is' : 'are'} missing: each member implements 3 screens.`);
    const bad = Math.min(n('incorrect') ?? 0, screens ?? 0);
    if (bad) out.push(`${plural(bad, 'screen does', 'screens do')} not match the requirements.`);
    yesSentences();
  } else {
    const l = levelOf(a);
    const q = HELPERS[id][0];
    if (l && q.kind === 'level' && q.sentences[l]) out.push(q.sentences[l]!);
  }
  return out;
}

/** Stored answers: known questions only, counts as whole numbers, yes / no as booleans, levels from the list. */
export function cleanAnswers(input: unknown): Partial<Record<CriterionId, Answers>> {
  const out: Partial<Record<CriterionId, Answers>> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  for (const c of CRITERIA) {
    const a = (input as Record<string, unknown>)[c.id];
    if (!a || typeof a !== 'object' || Array.isArray(a)) continue;
    const clean: Answers = {};
    for (const q of HELPERS[c.id]) {
      const v = (a as Answers)[q.key];
      if (q.kind === 'count') {
        const n = count(c.id, a as Answers, q.key);
        if (n !== undefined) clean[q.key] = n;
      } else if (q.kind === 'yes') {
        if (v === true || v === false) clean[q.key] = v;
      } else if (LEVELS.includes(v as Level)) clean[q.key] = v as Level;
    }
    if (Object.keys(clean).length) out[c.id] = clean;
  }
  return out;
}
