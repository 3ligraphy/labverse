// AI FOR CODING — the module, its Neon design and Lab 01 (prompt engineering & coding agents), and the AI-for-coding
// kit's rules: prompt rubrics, agent scripts and diff reviews.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AI_VISUALS, compileLab, compileModule, kitOf, MODULE_SKINS, nodesOfKits, sanitizeFlow, type Block } from '../src/lib/platform/core.ts';
import { gradeReview, parseAgentScript, parseDiff, parseRubric, scorePrompt, tokenEstimate } from '../src/lab/ai/core.ts';
import {
  aiForCodingLab01, aiForCodingModule, BUGFIX_RUBRIC, BUGFIX_STRONG, FEATURE_RUBRIC, FEATURE_STRONG, INSTRUCTIONS_RUBRIC, INSTRUCTIONS_STRONG, PRD_RUBRIC, PRD_STRONG,
} from '../src/lib/platform/seeds/ai-for-coding.ts';
import { labStructure } from '../src/lib/progress/core.ts';
import { shippedSeeds } from '../src/lib/platform/seeds/index.ts';

const KEY = 'ai-for-coding--lab-01';
const lab = compileLab(aiForCodingLab01(), KEY);
const all = (blocks: Block[]): Block[] => blocks.flatMap((b) => (b.kind === 'task' ? [b, ...all(b.children)] : [b]));
const blocks = all(lab.blocks);
const of = <K extends Block['kind']>(kind: K) => blocks.filter((b): b is Extract<Block, { kind: K }> => b.kind === kind);

test('the lab compiles cleanly, uses only the AI kit and fits its estimated time', () => {
  assert.deepEqual(lab.warnings, []);
  assert.ok(sanitizeFlow(aiForCodingLab01(), 'lab').ok);
  assert.equal(lab.meta.title, 'Prompt Engineering & Coding Agents');
  assert.ok(lab.meta.open, 'open any time');
  assert.ok(lab.hasCheckin);
  const parts = lab.blocks.filter((b) => b.kind === 'part') as Extract<Block, { kind: 'part' }>[];
  assert.equal(parts.length, 6);
  assert.equal(parts[3].title, 'Plan before code: a PRD for the agent');
  const minutes = parts.reduce((a, p) => a + parseInt(p.time), 0);
  assert.equal(lab.meta.estimatedTime, `${Math.floor(minutes / 60)} h ${minutes % 60} min`);
  const kit = new Set(nodesOfKits(['ai']));
  for (const n of aiForCodingLab01().nodes) if (n.type !== 'start') assert.ok(kit.has(n.type as never), `${n.type} is in the AI palette`);
  for (const t of ['aiprompt', 'agentsim', 'aidiff', 'aivisual']) assert.equal(kitOf(t), 'ai');
  // every visual the lab uses exists, and every visual is used
  assert.deepEqual(new Set(of('aivisual').map((v) => v.visual)), new Set(Object.values(AI_VISUALS)));
});

test('the module is public, in the Neon design and links its lab', () => {
  const mod = compileModule(aiForCodingModule());
  assert.equal(mod.meta.title, 'AI FOR CODING');
  assert.equal(MODULE_SKINS[mod.meta.skin], 'neon');
  assert.equal(mod.meta.public, 'Yes');
  assert.deepEqual(mod.items, [{ kind: 'week', title: 'Stage 1 · Working with coding agents' }, { kind: 'lab', slug: 'lab-01' }]);
  const seed = shippedSeeds().find((s) => s.id === 'ai-for-coding@1');
  assert.ok(seed && !seed.update && !seed.extend && !seed.patch, 'a create seed');
  assert.equal(seed.module.slug, 'ai-for-coding');
  assert.deepEqual(seed.labs.map((l) => l.slug), ['lab-01']);
  // @2 rewrites Lab 01 once (it gained the PRD part) wherever @1 already created it
  const update = shippedSeeds().find((s) => s.id === 'ai-for-coding@2');
  assert.ok(update?.update);
  assert.ok(update.labs[0].flow.nodes.some((n) => n.id === 'w-prd'));
  // other modules keep the standard design (a missing or unknown value is Standard)
  const plain = sanitizeFlow({ nodes: [{ id: 'root', type: 'module', data: {} }], edges: [] }, 'module');
  assert.ok(plain.ok);
  assert.equal(plain.value.nodes[0].data.skin, 'Standard');
  assert.equal(MODULE_SKINS[plain.value.nodes[0].data.skin], '');
  assert.equal(MODULE_SKINS['made-up'] || '', '');
});

test('every graded activity is tracked: prompts, agent decisions and reviews', () => {
  const structure = labStructure(KEY, 'Lab 01', lab.outline, (id) => {
    const ex = lab.exercises[id];
    return ex ? { title: ex.title, checks: ex.checks.length } : null;
  });
  assert.equal(of('aiprompt').length, 4);
  assert.equal(of('agentsim').length, 3);
  assert.equal(of('aidiff').length, 2);
  assert.equal(structure.exercises.length, 9);
  assert.equal(structure.tasks.length, 14);
  for (const e of structure.exercises) assert.ok(lab.exercises[e.id].checks.length >= 1 && lab.exercises[e.id].checks.length <= 50);
});

test('the PRD rubric needs every section: a PRD without non-goals does not pass', () => {
  const r = parseRubric(PRD_RUBRIC.join('\n'));
  assert.ok(r.ok);
  const noScope = PRD_STRONG.replace(/Non-goals: payments, chat, calendar sync\./, '').replace('Goals / Non-goals', 'Goals');
  const s = scorePrompt(noScope, r.value, 80);
  assert.ok(!s.solved);
  assert.deepEqual(r.value.filter((_, i) => !s.found[i]).map((x) => x.name), ['Goals & non-goals']);
  // “cannot” in the problem statement is not an acceptance criterion
  const draft = scorePrompt('# PRD\n\n## Problem\nStudents cannot find free rooms.\n\n## Users\nStudents and staff.', r.value, 0);
  assert.equal(draft.found[r.value.findIndex((x) => x.name === 'Acceptance criteria')], false);
  assert.ok(scorePrompt('Given a booked room, when another student books it, then they see “Room already booked”.', r.value, 0).found[4]);
});

test('prompt rubrics: each strong example passes, each weak starter fails', () => {
  const cases: [string[], string, number][] = [[BUGFIX_RUBRIC, BUGFIX_STRONG, 30], [FEATURE_RUBRIC, FEATURE_STRONG, 35], [INSTRUCTIONS_RUBRIC, INSTRUCTIONS_STRONG, 40], [PRD_RUBRIC, PRD_STRONG, 80]];
  for (const [lines, strong, min] of cases) {
    const r = parseRubric(lines.join('\n'));
    assert.ok(r.ok, r.ok ? '' : r.error);
    const good = scorePrompt(strong, r.value, min);
    assert.ok(good.solved, `strong example misses: ${r.value.filter((_, i) => !good.found[i]).map((x) => x.name).join(', ')}`);
  }
  for (const w of of('aiprompt')) {
    const s = scorePrompt(w.starter, w.rubric, w.minWords);
    assert.ok(!s.solved && s.passed <= 1, `${w.title}: the starter is already good (${s.passed}/${s.total})`);
    assert.ok(w.example, `${w.title} has an example`);
  }
});

test('parseRubric and scorePrompt', () => {
  assert.deepEqual(parseRubric(''), { ok: true, value: [] });
  const r = parseRubric('# comment\nFile :: /src\\//i :: Name the file\nTest :: /\\btest\\b/');
  assert.ok(r.ok);
  assert.deepEqual(r.value.map((x) => [x.name, x.flags, x.tip]), [['File', 'i', 'Name the file'], ['Test', '', 'Add: Test']]);
  assert.ok(!parseRubric('No pattern here').ok);
  assert.ok(!parseRubric('Bad :: /(/ :: tip').ok);
  const s = scorePrompt('Fix SRC/a.ts and add a test', r.value, 3);
  assert.deepEqual(s.found, [true, true]);
  assert.ok(s.solved);
  assert.ok(!scorePrompt('Fix SRC/a.ts and add a test', r.value, 50).solved, 'too short');
  assert.equal(tokenEstimate('abcdefgh'), 2);
});

test('agent scripts: the lab sessions parse, every decision has a right answer, edits keep their diff', () => {
  for (const a of of('agentsim')) {
    const asks = a.steps.filter((s) => s.kind === 'ask');
    assert.ok(asks.length >= 2, `${a.title} has decisions`);
    for (const q of asks) if (q.kind === 'ask') {
      assert.ok(q.options.filter((o) => o.correct).length === 1, `“${q.text}” has exactly one right option`);
      assert.ok(q.options.every((o) => o.why), 'every option explains itself');
    }
    for (const e of a.steps) if (e.kind === 'edit') assert.ok(e.diff.length, `edit ${e.text} has lines`);
    assert.equal(a.steps[0].kind, 'user');
    assert.equal(a.steps.at(-1)!.kind, 'say');
  }
  const r = parseAgentScript('user: hi\nrun: npm test\nout: ok\nedit: a.ts\n+x\n-y\nask: go?\nok: yes :: because\nno: no\nsay: done');
  assert.ok(r.ok);
  assert.deepEqual(r.value.map((s) => s.kind), ['user', 'run', 'edit', 'ask', 'say']);
  assert.ok(!parseAgentScript('out: nothing before').ok);
  assert.ok(!parseAgentScript('ask: q\nno: a\nno: b').ok, 'needs a right option');
  assert.ok(!parseAgentScript('hello').ok);
});

test('diff reviews: the marked lines are the answer, false alarms cost the last check', () => {
  for (const d of of('aidiff')) {
    const bugs = d.lines.flatMap((l, i) => (l.bug ? [i] : []));
    assert.ok(bugs.length >= 2, `${d.title} hides problems`);
    assert.ok(d.lines.filter((l) => l.bug).every((l) => l.why && !l.code.includes('##')), 'every problem explains itself and the why is not shown in the code');
    assert.ok(gradeReview(d.lines, bugs).solved);
    const clean = d.lines.findIndex((l) => !l.bug);
    const r = gradeReview(d.lines, [...bugs, clean]);
    assert.equal(r.falseAlarms, 1);
    assert.ok(!r.solved);
    assert.equal(gradeReview(d.lines, []).passed, 1, 'no flags = only “no false alarms”');
  }
  const lines = parseDiff(' a\n-b\n!+c ## why\n+d');
  assert.deepEqual(lines.map((l) => [l.sign, l.code, l.bug, l.why]), [[' ', 'a', false, ''], ['-', 'b', false, ''], ['+', 'c', true, 'why'], ['+', 'd', false, '']]);
});
