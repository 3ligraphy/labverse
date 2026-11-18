import test from 'node:test';
import assert from 'node:assert/strict';
import { compileLab, compileModule, nodesOfKits } from '../src/lib/platform/core.ts';
import { BONUS, psychologyTechnologyModule } from '../src/lib/platform/seeds/psychology-technology-lab-01.ts';
import { psychologyTechnologyLab04 } from '../src/lib/platform/seeds/psychology-technology-lab-04.ts';
import { shippedSeeds } from '../src/lib/platform/seeds/index.ts';
import { shippedState } from '../src/lib/platform/shipped.ts';

test('Lab 04 is one ~2-hour session with a check-in, built from core + web kit components', () => {
  const flow = psychologyTechnologyLab04();
  const lab = compileLab(flow, 'technology-for-psychology--lab-04');
  assert.deepEqual(lab.warnings, []);
  assert.equal(lab.hasCheckin, true);
  assert.match(lab.meta.title, /^Lab 04 —/);
  assert.equal(lab.blocks.filter((b) => b.kind === 'part').length, 1, 'one session');
  const tasks = lab.blocks.filter((b) => b.kind === 'task');
  const core = tasks.filter((t) => !t.title.startsWith(BONUS)).reduce((sum, t) => sum + Number(t.time.match(/(\d+)/)?.[1] ?? NaN), 0);
  assert.ok(core >= 105 && core <= 130, `core total ${core} min ≈ 2 hours`);
  const allowed = new Set<string>(['start', ...nodesOfKits(['web'])]);
  for (const node of flow.nodes) assert.ok(allowed.has(node.type), `${node.id} (${node.type}) is in the core/web kits`);
});

test('Lab 04 is on the module canvas after Week 4, and ships to the live module as an extend seed', () => {
  const items = compileModule(psychologyTechnologyModule()).items;
  assert.deepEqual(items.slice(-2), [{ kind: 'week', title: 'Week 4' }, { kind: 'lab', slug: 'lab-04' }]);
  const seed = shippedSeeds().find((s) => s.id === 'technology-for-psychology@1');
  assert.ok(seed, 'the seed ships');
  assert.equal(seed.extend, true);
  assert.equal(seed.module.slug, 'technology-for-psychology');
  assert.deepEqual(seed.labs.map((l) => l.slug), ['lab-04']);
  // a minimal canvas: only the root and the new nodes, so nothing staff deleted is brought back
  assert.deepEqual(seed.module.flow.nodes.map((n) => n.id), ['module', 'week-04', 'lab-04']);
  // the module was created by the seed script, not by a shipped seed: the replay leaves it alone
  assert.equal(shippedState().has('technology-for-psychology'), false);
});
