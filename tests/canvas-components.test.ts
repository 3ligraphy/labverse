// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAB_NODE_TYPES, NODE_PRESETS, addedDisallowed, allowedLabNodes, kitOf, nodesOfKits, parseNodeList, type Flow } from '../src/lib/platform/core.ts';

test('every lab node type has a kit; mobile and web nodes are in their kits', () => {
  assert.ok(!LAB_NODE_TYPES.includes('start' as never), 'the Lab root is never in the palette');
  for (const t of ['exercise', 'terminal', 'repo']) assert.equal(kitOf(t), 'mobile');
  for (const t of ['prompt', 'browser', 'websandbox', 'clickpath']) assert.equal(kitOf(t), 'web');
  for (const t of ['cpp', 'cpppredict', 'parsons', 'cppvisual']) assert.equal(kitOf(t), 'cpp');
  for (const t of ['part', 'task', 'text', 'image', 'video', 'link', 'quiz', 'checkin']) assert.equal(kitOf(t), 'core');
  assert.equal(kitOf('nonsense'), 'core');
});

test('nodesOfKits always includes the core kit', () => {
  const core = nodesOfKits([]);
  assert.ok(core.includes('part') && core.includes('task') && core.includes('quiz'));
  assert.ok(!core.includes('exercise') && !core.includes('prompt'));
  const web = nodesOfKits(['web']);
  assert.ok(web.includes('prompt') && web.includes('websandbox') && !web.includes('terminal'));
  const cpp = nodesOfKits(['cpp']);
  assert.ok(cpp.includes('cpp') && cpp.includes('parsons') && cpp.includes('quiz') && !cpp.includes('exercise') && !cpp.includes('prompt'));
  assert.deepEqual(nodesOfKits(['mobile', 'web', 'cpp']), LAB_NODE_TYPES);
});

test('presets: everything, mobile, web', () => {
  assert.deepEqual(NODE_PRESETS.all.nodes, LAB_NODE_TYPES);
  assert.ok(NODE_PRESETS.mobile.nodes.includes('exercise') && !NODE_PRESETS.mobile.nodes.includes('browser'));
  assert.ok(NODE_PRESETS.web.nodes.includes('clickpath') && !NODE_PRESETS.web.nodes.includes('repo'));
  for (const p of Object.values(NODE_PRESETS)) assert.ok(p.nodes.includes('part') && p.nodes.includes('task'));
});

test('parseNodeList keeps known types in palette order, always keeps Part and Task, null = everything', () => {
  assert.equal(parseNodeList(null), null);
  assert.equal(parseNodeList(undefined), null);
  assert.equal(parseNodeList('prompt'), null);
  assert.deepEqual(parseNodeList([]), ['part', 'task']);
  const r = parseNodeList(['prompt', 'start', 'bogus', 'text', 'part'])!;
  assert.deepEqual(r, LAB_NODE_TYPES.filter((t) => ['part', 'task', 'text', 'prompt'].includes(t)));
  assert.deepEqual(allowedLabNodes(null), LAB_NODE_TYPES);
  assert.deepEqual(allowedLabNodes(r), r);
});

test('addedDisallowed: new nodes of switched-off types are rejected, existing ones are kept', () => {
  const before: Flow = {
    nodes: [
      { id: 'root', type: 'start', x: 0, y: 0, data: {} },
      { id: 'p1', type: 'part', x: 0, y: 0, data: {} },
      { id: 'e1', type: 'exercise', x: 0, y: 0, data: {} },
    ],
    edges: [],
  };
  const allowed = nodesOfKits(['web']);
  // unchanged lab with an exercise that is no longer allowed: fine
  assert.deepEqual(addedDisallowed(before, before, allowed), []);
  // editing the existing exercise and adding allowed nodes: fine
  const ok: Flow = { ...before, nodes: [...before.nodes.map((n) => (n.id === 'e1' ? { ...n, data: { title: 'x' } } : n)), { id: 'q1', type: 'prompt', x: 0, y: 0, data: {} }] };
  assert.deepEqual(addedDisallowed(before, ok, allowed), []);
  // a new exercise (e.g. duplicated) and a new terminal: rejected
  const bad: Flow = { ...before, nodes: [...before.nodes, { id: 'e2', type: 'exercise', x: 0, y: 0, data: {} }, { id: 't9', type: 'terminal', x: 0, y: 0, data: {} }, { id: 't8', type: 'terminal', x: 0, y: 0, data: {} }] };
  assert.deepEqual(addedDisallowed(before, bad, allowed), ['terminal', 'exercise']);
  // reusing an existing id with a different, disallowed type counts as adding it
  const swapped: Flow = { ...before, nodes: before.nodes.map((n) => (n.id === 'p1' ? { ...n, type: 'repo' } : n)) };
  assert.deepEqual(addedDisallowed(before, swapped, allowed), ['repo']);
  // no restriction stored: anything goes
  assert.deepEqual(addedDisallowed(before, bad, null), []);
  // a brand-new lab (no stored flow)
  assert.deepEqual(addedDisallowed(null, bad, allowed), ['exercise', 'terminal'].sort((a, b) => LAB_NODE_TYPES.indexOf(a as never) - LAB_NODE_TYPES.indexOf(b as never)));
});
