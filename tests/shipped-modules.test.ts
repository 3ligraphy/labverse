// The modules that ship with the code must open even when the database is down: shippedState() replays the seeds
// (create, update, extend, patch, publish) exactly as PlatformStore.applySeeds writes them into the database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shippedState } from '../src/lib/platform/shipped.ts';
import { compileModule, orderFlow, type Flow } from '../src/lib/platform/core.ts';
import type { Seed } from '../src/lib/platform/seeds/index.ts';

test('Intro to Computing: all three labs are published (seed @12 showed week 6 again), the settings are applied', () => {
  const s = shippedState().get('intro-to-computing');
  assert.ok(s, 'the module ships');
  assert.equal(s.module.published, true);
  const lab = (slug: string) => s.labs.find((l) => l.slug === slug);
  assert.equal(lab('revision-practice')?.published, true);
  assert.equal(lab('revision-week-6')?.published, true, 'seed @8 hid it, seed @12 shows it again');
  assert.equal(lab('type-and-draw')?.published, true, 'seed @11 added Lab 3');
  const meta = compileModule(s.module.flow).meta;
  assert.equal(meta.public, 'Yes', 'seed @6');
  assert.equal(meta.leaderName, 'Prof. Gerard McKee', 'seed @10');
});

test('AI for Coding ships with Lab 01', () => {
  const s = shippedState().get('ai-for-coding');
  assert.deepEqual(s?.labs.map((l) => [l.slug, l.published]), [['lab-01', true]]);
});

const node = (id: string, type: string, data: Record<string, string> = {}) => ({ id, type, x: 0, y: 0, data });
const mod = (ids: string[]): Flow => ({ nodes: [node('root', 'module', { title: 'M' }), ...ids.map((id) => node(id, 'lab', { slug: id }))], edges: [{ from: 'root', to: ids[0] ?? 'root' }].filter((e) => e.to !== 'root') });
const lab = (title: string): Flow => ({ nodes: [node('root', 'start', { title })], edges: [] });
const seed = (id: string, extra: Partial<Seed>, labs: Seed['labs'], moduleIds: string[]): Seed =>
  ({ id, module: { slug: 'm', title: 'M', flow: mod(moduleIds), labNodes: [] }, labs, ...extra });

test('replay: update rewrites a lab, extend adds labs and appends module nodes, a later create never overwrites', () => {
  const state = shippedState([
    seed('m@1', {}, [{ slug: 'a', title: 'A', flow: lab('A') }], ['a']),
    seed('m@2', { update: true }, [{ slug: 'a', title: 'A2', flow: lab('A2') }], ['a']),
    seed('m@3', { extend: true }, [{ slug: 'b', title: 'B', flow: lab('B') }], ['a', 'b']),
    seed('m@4', {}, [{ slug: 'c', title: 'C', flow: lab('C') }], ['c']),
  ]).get('m')!;
  // like the database: the later create inserts lab c (on conflict do nothing) but never touches the module itself
  assert.deepEqual(state.labs.map((l) => [l.slug, l.title, l.published]), [['a', 'A2', true], ['b', 'B', true], ['c', 'C', true]]);
  const order = orderFlow(state.module.flow, 'module').map((n) => n.id);
  assert.deepEqual(order, ['root', 'a', 'b'], 'the extend seed appended its lab node after the last one; m@4 left the module as it was');
});

test('replay: an update or extend for a module that was never created does nothing', () => {
  const state = shippedState([seed('x@1', { update: true }, [{ slug: 'a', title: 'A', flow: lab('A') }], ['a'])]);
  assert.equal(state.size, 0);
});
