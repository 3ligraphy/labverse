// Run with: node --test tests/
// Intro to Computing · Lab 4 "The ultimate coding revision": 15 topics (every program of Labs 1–3 word for word, the
// lab-sheet programs, then new questions), mixed concepts and 10 challenges — every program checked by running it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileLab, sanitizeFlow, type Block } from '../src/lib/platform/core.ts';
import { introComputingUltimateLab, ULTIMATE_SLUG, TOPICS } from '../src/lib/platform/seeds/intro-computing-ultimate.ts';
import { introComputingModule, introComputingRevisionLab } from '../src/lib/platform/seeds/intro-computing-revision.ts';
import { introComputingPracticeLab } from '../src/lib/platform/seeds/intro-computing-practice.ts';
import { introComputingTypeDrawLab } from '../src/lib/platform/seeds/intro-computing-type-draw.ts';
import { shippedSeeds } from '../src/lib/platform/seeds/index.ts';
import { NEW_QUESTIONS, SHEET_QUESTIONS, MIXED, CHALLENGES } from '../src/lib/platform/seeds/intro-computing-ultimate-questions.ts';
import { gradeCpp } from '../src/lab/cpp/grade.ts';
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

test('every program of Labs 1–3 is in Lab 4 once, word for word (same text, same checks)', () => {
  const sources = [[1, introComputingRevisionLab()], [2, introComputingPracticeLab()], [3, introComputingTypeDrawLab()]] as const;
  let n = 0;
  for (const [lab, src] of sources) {
    for (const node of src.nodes.filter((x) => x.type === 'cpp')) {
      const copies = flow.nodes.filter((x) => x.id === `l${lab}-${node.id}`);
      assert.equal(copies.length, 1, `l${lab}-${node.id} is in Lab 4 once`);
      assert.deepEqual(copies[0].data, node.data, `l${lab}-${node.id} is word for word`);
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

test('topics 1 to 10: five or more new questions each, ids n<topic>-<k>', () => {
  for (let t = 1; t <= 10; t += 1) {
    const fresh = NEW_QUESTIONS[`t${t}` as keyof typeof NEW_QUESTIONS] ?? [];
    assert.ok(fresh.length >= 5, `topic ${t}: ${fresh.length} new questions`);
    for (const n of fresh) assert.match(n.id, new RegExp(`^n${t}-\\d+$`));
  }
  assert.ok((SHEET_QUESTIONS.t4 ?? []).some((n) => n.id === 's-p10'), 'sheet Program 10 is in topic 4');
});

export { MIXED, CHALLENGES };
