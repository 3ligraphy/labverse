// Run with: node --test tests/
// Intro to Computing · Lab 4 "The ultimate coding revision": 15 topics (every program of Labs 1–3 word for word, the
// lab-sheet programs, then new questions), mixed concepts and 10 challenges — every program checked by running it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileLab, sanitizeFlow, MAX_NODES, type Block } from '../src/lib/platform/core.ts';
import { introComputingUltimateLab, ULTIMATE_SLUG, TOPICS } from '../src/lib/platform/seeds/intro-computing-ultimate.ts';
import { introComputingModule, introComputingRevisionLab } from '../src/lib/platform/seeds/intro-computing-revision.ts';
import { introComputingPracticeLab } from '../src/lib/platform/seeds/intro-computing-practice.ts';
import { introComputingTypeDrawLab } from '../src/lib/platform/seeds/intro-computing-type-draw.ts';
import { shippedSeeds } from '../src/lib/platform/seeds/index.ts';
import { NEW_QUESTIONS, SHEET_QUESTIONS, MIXED, CHALLENGES } from '../src/lib/platform/seeds/intro-computing-ultimate-questions.ts';
import { gradeCpp } from '../src/lab/cpp/grade.ts';
import { minutes, formatMinutes } from '../src/lib/lab.ts';
import { SOLUTIONS } from './support/ultimate-solutions.ts';

const flow = introComputingUltimateLab();
const KEY = `intro-to-computing--${ULTIMATE_SLUG}`;

test('Lab 4 compiles: the 15 topics in lecture order, then Mixed, then the 10 challenges', () => {
  const s = sanitizeFlow(flow, 'lab');
  assert.ok(s.ok, s.ok ? '' : s.error);
  const lab = compileLab(s.value, KEY);
  assert.match(lab.meta.title, /ultimate/i);
  const parts = flow.nodes.filter((n) => n.type === 'part').map((n) => n.data.title);
  assert.equal(TOPICS.length, 15);
  assert.deepEqual(parts, [...TOPICS.map((t) => t.title), 'Mixed concepts', 'The 10 challenges']);
});

test('the start of Lab 4 is kept as written (no field silently replaced by a default)', () => {
  const s = sanitizeFlow(flow, 'lab');
  assert.ok(s.ok);
  const raw = flow.nodes[0].data;
  const kept = s.value.nodes[0].data;
  for (const k of Object.keys(raw)) assert.equal(kept[k], raw[k], `start field ${k}`);
});

test('the time on the module card is the sum of the part times (the lab page adds them up)', () => {
  const parts = flow.nodes.filter((n) => n.type === 'part');
  const total = parts.reduce((a, p) => a + minutes(p.data.time), 0);
  assert.equal(flow.nodes[0].data.estimatedTime, formatMinutes(total));
  assert.ok(total >= 20 * 60, `${formatMinutes(total)}: about 4 to 5 minutes for each of the ~280 questions`);
});

test('Lab 4 fits in one flow, with room to spare (the builder still opens it)', () => {
  assert.ok(flow.nodes.length <= MAX_NODES - 20, `${flow.nodes.length} nodes of ${MAX_NODES}`);
});

test('every program of Labs 1–3 is in Lab 4 once, word for word (same text, same checks)', () => {
  const sources = [[1, introComputingRevisionLab()], [2, introComputingPracticeLab()], [3, introComputingTypeDrawLab()]] as const;
  let n = 0;
  for (const [lab, src] of sources) {
    for (const node of src.nodes.filter((x) => x.type === 'cpp')) {
      const copies = flow.nodes.filter((x) => x.id === `l${lab}-${node.id}`);
      assert.equal(copies.length, 1, `l${lab}-${node.id} is in Lab 4 once`);
      const { tag, ...same } = copies[0].data;
      assert.deepEqual(same, node.data, `l${lab}-${node.id} is word for word`);
      assert.equal(tag, `Lab ${lab}`, `l${lab}-${node.id} is tagged Lab ${lab}`);
      n += 1;
    }
  }
  assert.equal(n, 96, '6 + 51 + 39 programs');
});

test('a Lab 3 code question keeps its flowchart above it (the perfect one, to watch)', () => {
  const ids = flow.nodes.map((x) => x.id);
  for (const node of introComputingTypeDrawLab().nodes.filter((x) => x.type === 'flowchart')) {
    const code = `l3-${node.id.replace(/-flow$/, '')}`;
    if (!ids.includes(code)) continue;
    const chart = flow.nodes[ids.indexOf(code) - 1];
    assert.equal(chart.type, 'flowchart', `${code}: a flowchart above it`);
    assert.equal(chart.data.mode, 'Show it running', `${code}: the flowchart is to watch, not to draw`);
    assert.equal(chart.data.chart, node.data.solution || node.data.chart, `${code}: the perfect flowchart`);
  }
});

test('the module shows Lab 4 after Week 10, and seed @14 adds it to the live module', () => {
  const mod = introComputingModule();
  const ids = mod.nodes.map((n) => n.id);
  assert.ok(ids.indexOf('week-10') > ids.indexOf('lab-type-draw'), 'Week 10 after Lab 3');
  assert.equal(mod.nodes[ids.indexOf('week-10') + 1].data.slug, ULTIMATE_SLUG);
  const s = shippedSeeds().find((x) => x.id === 'intro-to-computing@14');
  assert.ok(s?.extend, 'seed @14 is an extend seed');
  assert.deepEqual(s.labs.map((l) => l.slug), [ULTIMATE_SLUG]);
});

/* ------------------------------------------------ Lab 4's own questions: every one is right, and marks right */
const compiled = (() => { const s = sanitizeFlow(flow, 'lab'); if (!s.ok) throw new Error(s.error); return compileLab(s.value, KEY); })();
const blocks = compiled.blocks.flatMap((b) => (b.kind === 'task' ? [b, ...b.children] : [b]));
const idOf = (b: { id: string }) => b.id.slice(`${KEY}--`.length);
/** Lab 4's own programs (lab sheets, lectures, new): not the copies of Labs 1–3 */
const progs = blocks.filter((b): b is Extract<Block, { kind: 'cpp' }> => b.kind === 'cpp' && !/^l[123]-/.test(idOf(b)));
const grade = (code: string, checks: Extract<Block, { kind: 'cpp' }>['checks']) => {
  const r = gradeCpp(code, checks);
  return { ok: !r.compileError && r.results.every((x) => x.pass), why: r.compileError?.message ?? r.results.filter((x) => !x.pass).map((x) => `${x.name}: ${x.message ?? ''}`).join(' | ') };
};

test('every check of Lab 4 is read as written: no warnings, a regex never swallows its message', () => {
  assert.deepEqual(compiled.warnings, []);
  for (const b of progs) {
    assert.ok(b.checks.length > 0, `${idOf(b)}: has checks`);
    for (const c of b.checks) for (const st of c.steps) {
      // a slash in the message makes the parser take it into the regex: the regex then holds an unescaped /
      if ('code' in st) assert.doesNotMatch(st.code, /(^|[^\\])\//,`${idOf(b)} “${c.name}”: no / in the message of a code check`);
    }
  }
});

test('every question of Lab 4 shows where it comes from: Lab 1, 2 or 3, a lab sheet, a lecture, or New', () => {
  const asked = blocks.filter((b) => b.kind === 'cpp' || b.kind === 'cppanswer') as Extract<Block, { kind: 'cpp' | 'cppanswer' }>[];
  assert.ok(asked.length > 150);
  for (const b of asked) {
    const id = idOf(b);
    const want = /^l([123])-/.exec(id)?.[1];
    if (want) assert.equal(b.tag, `Lab ${want}`, id);
    else if (/^s-/.test(id)) assert.match(b.tag, /^(Wk(3|6|9|10) sheet|Lecture [3-9])$/, id);
    else assert.equal(b.tag, 'New', id);
  }
});

test('every program of Lab 4 has a reference solution that passes all its checks', () => {
  assert.ok(progs.length > 0);
  for (const b of progs) {
    const code = SOLUTIONS[idOf(b)];
    assert.ok(code, `${idOf(b)}: a reference solution`);
    const r = grade(code, b.checks);
    assert.ok(r.ok, `${idOf(b)} (${b.title}): ${r.why}`);
  }
});

test('an extra space in the printed text still passes (with the spacing warning), like the engine promises', () => {
  let tried = 0;
  for (const b of progs) {
    const code = SOLUTIONS[idOf(b)];
    const variant = code?.replace(/(cout\s*<<\s*"[^"\n]*?): /, '$1:  ');
    if (!code || variant === code) continue;
    tried += 1;
    const r = grade(variant, b.checks);
    assert.ok(r.ok, `${idOf(b)} with one extra space: ${r.why}`);
  }
  assert.ok(tried >= 20, `tried ${tried} programs`);
});

test('the starter of every program fails (nothing passes without typing it)', () => {
  for (const b of progs) assert.equal(grade(b.starter, b.checks).ok, false, `${idOf(b)}: the starter must fail`);
});

test('reference solutions use only lecture content: no arrays, no functions of your own', () => {
  for (const [id, code] of Object.entries(SOLUTIONS)) {
    assert.doesNotMatch(code, /\b(int|float|double|char|string|bool)\s+\w+\s*\[/, `${id}: no arrays`);
    assert.doesNotMatch(code.replace(/int\s+main\s*\(\s*\)/, ''), /^\s*(int|void|float|double|char|string|bool)\s+\w+\s*\([^)]*\)\s*\{/m, `${id}: no functions of your own`);
    assert.doesNotMatch(code, /vector\s*</, `${id}: no std::vector`);
  }
});

test('every topic: five or more new questions, ids n<topic>-<k> (a flowchart to watch: n<topic>-<k>-flow)', () => {
  for (let t = 1; t <= 15; t += 1) {
    const fresh = NEW_QUESTIONS[`t${t}` as keyof typeof NEW_QUESTIONS] ?? [];
    const asked = fresh.filter((n) => n.type === 'cpp' || n.type === 'cppanswer');
    assert.ok(asked.length >= 5, `topic ${t}: ${asked.length} new questions`);
    for (const n of fresh) assert.match(n.id, new RegExp(`^n${t}-\\d+${n.type === 'flowchart' ? '-flow' : ''}$`));
  }
  assert.ok((SHEET_QUESTIONS.t4 ?? []).some((n) => n.id === 's-p10'), 'sheet Program 10 is in topic 4');
});

test('the lab-sheet and lecture questions of the loop topics are all there, in their topic', () => {
  const inTopic = (t: string) => (SHEET_QUESTIONS[t as keyof typeof SHEET_QUESTIONS] ?? []).map((n) => n.id);
  const want: Record<string, string[]> = {
    t5: ['s-w9-q3a', 's-w9-q3b', 's-w9-q3c1', 's-w9-q3c2', 's-w9-q3c3'],
    t11: Array.from({ length: 10 }, (_, i) => `s-l6-e${i + 1}`),
    t12: [9, 10, 11, 12, 13, 14, 15].map((p) => `s-w9-p${p}`).concat('s-w9-q2'),
    t13: ['s-w10-p16', 's-w10-p17', ...[9, 10, 11, 12, 13, 14, 15].map((p) => `s-w10-r${p}`), 's-w10-a1', 's-w10-a2', 's-w10-a3', 's-w10-a4', 's-w10-b1', 's-w10-b2', 's-w10-b3', 's-w10-b4', 's-w10-c', 's-l8-e2', 's-l8-vary', 's-l8-e3', 's-l8-e4', 's-l8-stars', 's-l8-null', 's-l8-trace', 's-l8-e5'],
    t14: ['s-l8-e1', 's-l6-try', 's-l8-break', 's-l8-continue'],
    t15: ['s-l9-e1', 's-l9-t1', 's-l9-t2', 's-l9-t3', 's-l9-e2', 's-l9-e3'],
  };
  for (const [t, ids] of Object.entries(want)) for (const id of ids) assert.ok(inTopic(t).includes(id), `${id} is in ${t}`);
});

test('a flowchart question keeps its flowchart just above it, to watch (Lecture 6 examples, new flowchart questions)', () => {
  const ids = flow.nodes.map((x) => x.id);
  const charts = flow.nodes.filter((x) => x.type === 'flowchart' && !x.id.startsWith('l3-'));
  assert.ok(charts.length >= 13);
  for (const c of charts) {
    const code = c.id.replace(/-flow$/, '');
    assert.equal(ids[ids.indexOf(c.id) + 1], code, `${code} comes right after its flowchart`);
    assert.equal(c.data.mode, 'Show it running');
  }
  for (let e = 1; e <= 10; e += 1) assert.ok(ids.includes(`s-l6-e${e}-flow`), `Lecture 6 Example ${e} has its flowchart`);
});

test('find the errors (Wk10 2 b): the starter is the sheet’s broken code, and it does not pass', () => {
  const sheet: Record<string, RegExp> = { b1: /for i = 0; i < 5; i\+\+\n/, b2: /for \( i = 0; i < 5; i\+\+ \) ;\n\s+cout << "hello"\n/, b3: /for \( i = 0, i > 5; i\+\+ \)/, b4: /for \( i = 0; i <= 5; i\+\+ \)/ };
  for (const [b, re] of Object.entries(sheet)) {
    const block = progs.find((x) => idOf(x) === `s-w10-${b}`);
    assert.ok(block, `s-w10-${b}`);
    assert.match(block.starter, re, `s-w10-${b} starts with the sheet's code`);
  }
});

test('an endless loop does not freeze the page: the check stops it and says so', () => {
  const block = progs.find((x) => idOf(x) === 's-w9-p9');
  assert.ok(block);
  const r = gradeCpp('#include <iostream>\nusing namespace std;\n\nint main() {\n    int n = 1;\n    while (n <= 99) {\n        cout << n;\n    }\n    return 0;\n}\n', block.checks);
  assert.ok(r.results.some((x) => /never stop/.test(x.message ?? '')), JSON.stringify(r.results[0]));
});

test('Mixed concepts: 15 programs m-1 … m-15; the 10 challenges ch-1 … ch-10, each one a loop, a selection and text', () => {
  assert.deepEqual(MIXED.filter((n) => n.type === 'cpp').map((n) => n.id), Array.from({ length: 15 }, (_, i) => `m-${i + 1}`));
  assert.deepEqual(CHALLENGES.filter((n) => n.type === 'cpp').map((n) => n.id), Array.from({ length: 10 }, (_, i) => `ch-${i + 1}`));
  for (let i = 1; i <= 10; i += 1) {
    const code = SOLUTIONS[`ch-${i}`] ?? '';
    assert.match(code, /\b(while|for)\s*\(|\bdo\s*\{/, `ch-${i}: a loop`);
    assert.match(code, /\bif\s*\(/, `ch-${i}: a selection`);
    assert.match(code, /\b(string|char)\b/, `ch-${i}: a string or a char`);
  }
  for (const n of [...MIXED, ...CHALLENGES].filter((x) => x.type === 'cpp')) {
    assert.ok(n.data.checks.split('\n').filter((l) => / in |expect|exact/.test(l)).length >= 3, `${n.id}: checked on 3 or more runs`);
  }
});

