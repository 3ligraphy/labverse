/**
 * Introduction to Computing (26CSCI01P) · Lab 4 — "The ultimate coding revision". Everything is typed code:
 * 15 topics in lecture order (every program of Labs 1–3 word for word, the lab-sheet programs that were not in a lab
 * yet, then new questions), mixed concepts, then 10 challenges that combine everything. Only lecture content: no
 * arrays, no functions of your own. Node ids are stable once shipped: progress is stored by them.
 *   l1-… / l2-… / l3-…   a program of Lab 1 / 2 / 3 (the same node data, word for word)
 *   s-…                  a lab-sheet or lecture question (its own words)
 *   n<topic>-<k>         a new question · m-<k> mixed · ch-<k> challenge
 */
import type { Flow } from '../core.ts';
import { introComputingRevisionLab } from './intro-computing-revision.ts';
import { introComputingPracticeLab } from './intro-computing-practice.ts';
import { introComputingTypeDrawLab } from './intro-computing-type-draw.ts';
import { NEW_QUESTIONS, SHEET_QUESTIONS, MIXED, CHALLENGES } from './intro-computing-ultimate-questions.ts';

export type N = { id: string; type: string; data: Record<string, string> };

export const ULTIMATE_SLUG = 'ultimate-revision';

/** the topics, in the order of the lectures (Lectures 3–9 and the lab sheets) */
export const TOPICS = [
  { id: 't1', title: 'Output: cout, \\n and \\t', time: '25 min' },
  { id: 't2', title: 'Values: variables, types, const and assignment', time: '35 min' },
  { id: 't3', title: 'Input: cin and getline', time: '25 min' },
  { id: 't4', title: 'Calculating: operators, cmath and algorithm', time: '60 min' },
  { id: 't5', title: 'Choosing: if, else if, else, and, or, not', time: '55 min' },
  { id: 't6', title: 'Characters and ASCII', time: '30 min' },
  { id: 't7', title: 'Strings: length, [ ], at, find, substr, stoi, to_string', time: '35 min' },
  { id: 't8', title: 'Programs with strings', time: '70 min' },
  { id: 't9', title: 'Vectors and complex numbers (Programs 21 to 30)', time: '55 min' },
  { id: 't10', title: 'Sets of numbers and statistics (Programs 3 to 8)', time: '40 min' },
  { id: 't11', title: 'From flowchart and pseudocode to code (Lecture 6)', time: '45 min' },
  { id: 't12', title: 'while loops', time: '55 min' },
  { id: 't13', title: 'for loops', time: '70 min' },
  { id: 't14', title: 'do..while, break and continue', time: '35 min' },
  { id: 't15', title: 'Nested loops', time: '40 min' },
] as const;
export type TopicId = (typeof TOPICS)[number]['id'];

/** the programs of Labs 1–3, by topic (each Lab 3 one comes with its flowchart) */
const FROM_LABS: Record<TopicId, [1 | 2 | 3, string][]> = {
  t1: [[2, 'w-hello'], [2, 'w-tab'], [2, 'w-banner'], [3, 'z-hello'], [3, 'z-card'], [3, 'z-box']],
  t2: [[2, 'w-fix-char'], [2, 'w-fix-const'], [3, 'ct-q2a'], [3, 'ct-q2b'], [3, 'ct-q2c'], [3, 'ct-q2d'], [3, 'v-types'], [3, 'v-steps'], [3, 'v-circle']],
  t3: [[1, 'make-average'], [3, 'i-three'], [3, 'i-greet'], [3, 'i-letter']],
  t4: [[1, 'modify-sum'], [1, 'make-circle'], [2, 'w-product'], [2, 'w-sum5'], [2, 'w-rect'], [2, 'w-circle'], [2, 'w-hexagon'], [2, 'w-avg2'], [2, 'w-minmax'], [3, 'c-time'], [3, 'c-temp'], [3, 'c-avg'], [3, 'c-hexagon'], [3, 'c-maxmin'], [3, 'ct-q7']],
  t5: [[1, 'make-even'], [2, 'w-median'], [2, 'w-even'], [2, 'w-grade'], [3, 'e-divide'], [3, 'e-z'], [3, 'e-greatest'], [3, 'e-case'], [3, 'e-score'], [3, 'e-sentence'], [3, 'ct-q5-code']],
  t6: [[1, 'modify-lower'], [2, 'w-upper'], [2, 'w-lower'], [2, 'w-isdigit'], [2, 'w-case']],
  t7: [[2, 'w-length'], [2, 'w-fourth'], [2, 'w-firstlast'], [2, 'w-rest'], [2, 'w-getline'], [2, 'w-stoi'], [2, 'w-tostring']],
  t8: [[1, 'modify-pele'], [2, 'w-hasdigit'], [2, 'w-dash'], [2, 'w-question'], [2, 'w-words'], [2, 'w-three'], [2, 'w-decimal'], [2, 'w-football'], [2, 'w-names'], [2, 'w-initials'], [2, 'w-swapname'], [2, 'w-email'], [2, 'w-tld'], [2, 'w-edu'], [3, 's-dash'], [3, 's-decimal'], [3, 's-words'], [3, 's-name'], [3, 's-email'], [3, 's-tld'], [3, 'ct-q6-code']],
  t9: [[2, 'w-vector'], [2, 'w-modulus'], [2, 'w-norm3'], [2, 'w-scale'], [2, 'w-vecsum'], [2, 'w-dot'], [2, 'w-orth'], [3, 'c-modulus'], [3, 'h-vector'], [3, 'h-vsum'], [3, 'h-dot']],
  t10: [[2, 'w-setsum'], [2, 'w-setavg'], [2, 'w-setmax'], [2, 'w-sd'], [2, 'w-stats3'], [3, 'h-median'], [3, 'h-stats']],
  t11: [],
  t12: [],
  t13: [],
  t14: [],
  t15: [],
};

const SOURCES = { 1: introComputingRevisionLab(), 2: introComputingPracticeLab(), 3: introComputingTypeDrawLab() } as const;

/** a node of Lab 1, 2 or 3, word for word (its id becomes l<lab>-<id>, and it is tagged with its lab) */
export function reuse(lab: 1 | 2 | 3, id: string): N {
  const node = SOURCES[lab].nodes.find((n) => n.id === id);
  if (!node) throw new Error(`Lab ${lab} has no node ${id}`);
  return { id: `l${lab}-${id}`, type: node.type, data: { ...(node.data as Record<string, string>), tag: `Lab ${lab}` } };
}

/** the flowchart a Lab 3 code question was written from — the perfect one, to watch */
function chartFor(id: string): N | null {
  const node = SOURCES[3].nodes.find((n) => n.id === `${id}-flow`);
  if (!node) return null;
  const d = node.data as Record<string, string>;
  return {
    id: `l3-${id}-flow`,
    type: 'flowchart',
    data: { ...d, mode: 'Show it running', chart: d.solution || d.chart, goal: 'The flowchart of the next question. Press ▶ to watch it run, then type its code: one line of code for each shape.', bank: '', checks: '', solution: '' },
  };
}

const chain = (nodes: N[]): Flow => ({
  nodes: nodes.map((n, i) => ({ id: n.id, type: n.type, x: 80 + (i % 2) * 40, y: 80 + i * 150, data: n.data })),
  edges: nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id })),
});
const part = (id: string, title: string, time: string): N => ({ id, type: 'part', data: { title, time } });
const task = (id: string, title: string, time: string, body: string): N => ({ id, type: 'task', data: { title, time, body } });

function topic(t: (typeof TOPICS)[number]): N[] {
  const labs = FROM_LABS[t.id].flatMap(([lab, id]) => {
    const chart = lab === 3 ? chartFor(id) : null;
    return chart ? [chart, reuse(lab, id)] : [reuse(lab, id)];
  });
  const sheet = SHEET_QUESTIONS[t.id] ?? [];
  const fresh = NEW_QUESTIONS[t.id] ?? [];
  return [
    part(t.id, t.title, t.time),
    ...(labs.length || sheet.length
      ? [task(`${t.id}-labs`, 'From the labs and lectures, as they are', '', 'These questions come from Labs 1 to 3, the lab sheets and the lectures, word for word: the tag on each one says where. Type every program yourself: paste is blocked.'), ...labs, ...sheet]
      : []),
    ...(fresh.length ? [task(`${t.id}-new`, 'New questions', '', 'New questions on the same topic, from easy to hard (tagged New).'), ...fresh] : []),
  ];
}

export function introComputingUltimateLab(): Flow {
  return chain([
    { id: 'root', type: 'start', data: {
      title: 'The ultimate coding revision',
      description: 'Every topic of the lectures, practised by typing code: the programs of Labs 1 to 3 and of the lab sheets, new questions on every topic, mixed questions, and 10 challenges that combine everything. Each program is checked by running it on several inputs.',
      difficulty: 'Beginner to advanced',
      estimatedTime: '12 h',
      objectives: [
        'Write every kind of program from the lectures, without help: output, input, calculations, selection, characters and strings',
        'Write while, for and do..while loops, with break and continue, and nested loops',
        'Turn a flowchart or pseudocode into C++',
        'Combine all the concepts in long programs',
      ].join('\n'),
      access: 'Open any time (no session, still tracked)',
    } },
    ...TOPICS.flatMap(topic),
    part('mixed', 'Mixed concepts', '90 min'),
    task('mixed-all', 'Mixed concepts', '', 'Each question mixes several topics. Read it all first, plan the steps, then type the code.'),
    ...MIXED,
    part('challenges', 'The 10 challenges', '3 h'),
    task('challenges-all', 'The 10 challenges', '', 'Long programs that use everything: input, calculations, selection, characters, strings and loops. Plan on paper first.'),
    ...CHALLENGES,
  ]);
}
