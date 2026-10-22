// The TA's live class view: status rules (core) and the session activity feed (memory store).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveClass, type Activity, type LabStructure } from '../src/lib/progress/core.ts';
import { MemoryStore } from '../src/lib/progress/store.ts';

const lab: LabStructure = {
  lab: 'lab-03', title: 'Lab 03', hasSubmission: false,
  tasks: [{ n: '1', title: 'One' }, { n: '2', title: 'Two' }],
  exercises: [{ id: 'e1', task: '1', title: 'First', checks: 3 }, { id: 'e2', task: '2', title: 'Second', checks: 3 }],
} as LabStructure;
const NOW = Date.parse('2026-10-22T10:00:00Z');
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();
const student = (key: string, percent: number, cells: Record<string, { passed: number; total: number }> = {}) => ({ key, percent, cells, startedAt: ago(30) });
const act = (a: Partial<Activity>): Activity => ({ last: [], active: [], events: [], ...a });

test('live class: working, quiet, away and done follow the last activity', () => {
  const { rows, counts } = liveClass(lab, [student('a', 20), student('b', 20), student('c', 20), student('d', 100)], act({
    active: [{ student_key: 'a', at: ago(1) }, { student_key: 'b', at: ago(6) }, { student_key: 'c', at: ago(25) }, { student_key: 'd', at: ago(40) }],
  }), NOW);
  assert.deepEqual(rows.map((r) => r.status), ['active', 'idle', 'away', 'done']);
  assert.deepEqual(counts, { help: 0, active: 1, idle: 1, away: 1, done: 1 });
  assert.match(rows[1].why, /Quiet for 6 min/);
});

test('live class: three failed Checks in a row on an unsolved exercise asks for help', () => {
  const { rows } = liveClass(lab, [student('a', 30, { e1: { passed: 3, total: 3 }, e2: { passed: 1, total: 3 } })], act({
    last: [{ student_key: 'a', exercise: 'e2', passed: 1, total: 3, at: ago(2), fails: 3 }],
    active: [{ student_key: 'a', at: ago(2) }],
  }), NOW);
  assert.equal(rows[0].status, 'help');
  assert.equal(rows[0].working, 'e2');
  assert.equal(rows[0].fails, 3);
});

test('live class: old failures or a solved exercise do not raise help, and "working on" moves to the next exercise', () => {
  const solved = liveClass(lab, [student('a', 40, { e1: { passed: 3, total: 3 } })], act({
    last: [{ student_key: 'a', exercise: 'e1', passed: 3, total: 3, at: ago(1), fails: 0 }],
    active: [{ student_key: 'a', at: ago(1) }],
  }), NOW);
  assert.equal(solved.rows[0].status, 'active');
  assert.equal(solved.rows[0].working, 'e2');
  const stale = liveClass(lab, [student('a', 10)], act({
    last: [{ student_key: 'a', exercise: 'e1', passed: 0, total: 3, at: ago(30), fails: 5 }],
    active: [{ student_key: 'a', at: ago(2) }],
  }), NOW);
  assert.equal(stale.rows[0].status, 'active');
});

test('live class: a student who just joined counts from the join time', () => {
  const { rows } = liveClass(lab, [{ key: 'a', percent: 0, cells: {}, startedAt: ago(1) }], act({}), NOW);
  assert.equal(rows[0].status, 'active');
  assert.equal(rows[0].working, 'e1');
});

test('memory store activity: latest Check, fails since the last pass, and a newest-first feed', async () => {
  const store = new MemoryStore(() => NOW);
  const s = await store.createSession('lab-03', 'TA', 'Sun 10:00', 90);
  await store.touchStudent({ studentKey: '240001', studentId: '240001', name: 'Mona', deviceKey: 'd' });
  await store.joinSession(s.id, '240001', 'G1');
  const check = (exercise: string, passed: number) => store.addAttempt({ studentKey: '240001', lab: 'lab-03', exercise, passed, total: 3, code: '', sessionId: s.id });
  await check('e1', 1);
  await check('e1', 3);
  await check('e2', 0);
  await check('e2', 1);
  await store.setTask({ studentKey: '240001', lab: 'lab-03', task: '1', done: true, sessionId: s.id });
  const a = await store.activity(s.id);
  assert.deepEqual(a.last.map((l) => [l.exercise, l.fails]), [['e2', 2]]);
  assert.equal(a.active.length, 1);
  assert.equal(a.events.length, 5);
  assert.equal(a.events[0].kind, 'task');
  assert.equal(a.events[1].ref, 'e2');
});
