import assert from 'node:assert/strict';
import test from 'node:test';
import { compileLab, compileModule, nodesOfKits, sanitizeFlow, type Block } from '../src/lib/platform/core.ts';
import { BONUS, psychologyTechnologyLab01, psychologyTechnologyLab02, psychologyTechnologyModule } from '../src/lib/platform/seeds/psychology-technology-lab-01.ts';

const minutes = (time: string) => Number(time.match(/(\d+)\s*min/)?.[1] ?? NaN);
const children = (blocks: Block[]) => blocks.flatMap((b) => (b.kind === 'task' ? [b, ...b.children] : [b]));
const LABS = [
  ['lab-01', psychologyTechnologyLab01()],
  ['lab-02', psychologyTechnologyLab02()],
] as const;
const compiledOf = (slug: string, flow: (typeof LABS)[number][1]) => compileLab(flow, `technology-for-psychology--${slug}`);

test('the WordPress bootcamp is two labs, one ~2-hour session each, each with its own check-in', () => {
  for (const [slug, flow] of LABS) {
    const compiled = compiledOf(slug, flow);
    assert.deepEqual(compiled.warnings, [], slug);
    assert.equal(compiled.hasCheckin, true, `${slug} has a check-in`);
    assert.equal(compiled.blocks.at(-1)?.kind, 'checkin', `${slug} ends with the check-in`);
    assert.ok(compiled.meta.objectives.length >= 5, `${slug} objectives`);
    assert.equal(compiled.meta.estimatedTime, '2 hours');
    assert.match(compiled.meta.title, slug === 'lab-01' ? /Session 1/ : /Session 2/);
    assert.equal(compiled.blocks.filter((b) => b.kind === 'part').length, 1, `${slug} is one session`);

    // core (non-bonus) task minutes ≈ 2 hours
    let total = 0;
    for (const b of compiled.blocks) {
      if (b.kind !== 'task') continue;
      const m = minutes(b.time);
      assert.ok(Number.isFinite(m), `task “${b.title}” has a time in minutes`);
      if (!b.title.startsWith(BONUS)) total += m;
    }
    assert.ok(total >= 105 && total <= 130, `${slug} core total ${total} min ≈ 2 hours`);

    // every core task explains why it matters
    for (const b of compiled.blocks) if (b.kind === 'task' && !b.title.startsWith(BONUS) && !/Final checklist/.test(b.title)) assert.match(b.body, /Why this matters/, `${b.title} explains why`);
  }
  // no task appears in both sessions
  const ids = LABS.map(([, flow]) => new Set(flow.nodes.filter((n) => n.type === 'task').map((n) => n.id)));
  assert.deepEqual([...ids[0]].filter((id) => ids[1].has(id)), []);
});

test('beginner support: Lab 01 has the orientation; both labs have troubleshooting', () => {
  const s1 = children(compiledOf(...LABS[0]).blocks);
  const s2 = children(compiledOf(...LABS[1]).blocks);
  assert.ok(s1.some((b) => b.kind === 'text' && /Glossary/.test(b.body) && /\*\*Dashboard\*\*/.test(b.body) && /\*\*CSS\*\*/.test(b.body)), 'Lab 01 has a glossary');
  assert.ok(s1.some((b) => b.kind === 'callout' && /Ctrl\/Cmd \+ C/.test(b.body)), 'Lab 01 has keyboard basics');
  assert.ok(s2.some((b) => b.kind === 'callout' && /Lab 01/.test(b.body)), 'Lab 02 points back to the Lab 01 orientation');
  assert.ok(s2[0]?.kind === 'callout' || s2.some((b) => b.kind === 'task' && /Restore/.test(b.title)), 'Lab 02 starts by restoring the site');
  const stuck = [...s1, ...s2].filter((b) => b.kind === 'callout' && /Stuck\?/.test(b.body)).length;
  assert.ok(stuck >= 6, `${stuck} Stuck? callouts`);
});

test('both labs only use core + web kit components, with complete prompts and previews', () => {
  const allowed = new Set<string>(['start', ...nodesOfKits(['web'])]);
  const blocks: Block[] = [];
  for (const [slug, flow] of LABS) {
    for (const node of flow.nodes) {
      assert.ok(allowed.has(node.type), `${slug}: ${node.id} (${node.type}) is in the core/web kits`);
      assert.ok(!['exercise', 'terminal', 'repo'].includes(node.type));
    }
    blocks.push(...children(compiledOf(slug, flow).blocks));
  }
  const prompts = blocks.filter((b) => b.kind === 'prompt');
  const previews = blocks.filter((b) => b.kind === 'browser');
  assert.ok(prompts.length >= 8);
  assert.ok(previews.length >= 2);
  for (const p of prompts) if (p.kind === 'prompt') assert.ok(p.prompt.trim().length > 50, `${p.title} has a prompt`);
  for (const b of previews) {
    if (b.kind !== 'browser') continue;
    assert.ok(Buffer.byteLength(b.html, 'utf8') < 20_000, `${b.title} is under 20 KB`);
    assert.match(b.html, /prefers-reduced-motion/);
    assert.match(b.html, /@keyframes/);
  }
  const quizzes = blocks.filter((b) => b.kind === 'quiz');
  assert.ok(quizzes.length >= 12, `${quizzes.length} quick checks`);
  for (const q of quizzes) if (q.kind === 'quiz') assert.ok(q.explain.trim().length > 30, `“${q.question}” explains the answer`);
  assert.ok(blocks.filter((b) => b.kind === 'websandbox').length >= 2);
  for (const kind of ['websandbox', 'clickpath', 'link', 'quiz', 'checkpoint', 'callout'] as const)
    assert.ok(blocks.some((b) => b.kind === kind), `uses ${kind}`);
});

test('Technology for Psychology module: Week 1 → Lab 01, Week 2 → Lab 02, for Arts & Humanities', () => {
  const module = psychologyTechnologyModule();
  const clean = sanitizeFlow(module, 'module');
  assert.equal(clean.ok, true);
  const compiled = compileModule(module);
  assert.equal(compiled.meta.faculty, 'arts-humanities');
  assert.equal(compiled.meta.specializations, 'Psychology');
  assert.deepEqual(compiled.items, [
    { kind: 'week', title: 'Week 1' }, { kind: 'lab', slug: 'lab-01' },
    { kind: 'week', title: 'Week 2' }, { kind: 'lab', slug: 'lab-02' },
    { kind: 'week', title: 'Week 3' }, { kind: 'lab', slug: 'lab-03' },
  ]);
});
