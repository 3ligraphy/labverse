// Sessions off (ALWAYS_OPEN): every lab has one permanent session that never closes, and the TA pages add up every
// session of a lab, so each student's solved questions are counted once, wherever they were saved.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALWAYS_OPEN, OPEN_LAB, moduleStats, scoreStudent, sessionState, type LabStructure } from '../src/lib/progress/core.ts';
import { MemoryStore } from '../src/lib/progress/store.ts';

const lab: LabStructure = {
  lab: 'lab-03', title: 'Lab 03', hasSubmission: false,
  tasks: [{ n: '1', title: 'One' }, { n: '2', title: 'Two' }],
  exercises: [{ id: 'e1', task: '1', title: 'First', checks: 1 }, { id: 'e2', task: '2', title: 'Second', checks: 1 }],
} as LabStructure;
const NOW = Date.parse('2026-10-30T20:00:00Z');

test('sessions are off for the whole site', () => {
  assert.equal(ALWAYS_OPEN, true);
});

test('the permanent session: made once per lab, open whatever the clock says, never two of them', async () => {
  const store = new MemoryStore(() => NOW);
  const a = await store.permanentSession('lab-03');
  const b = await store.permanentSession('lab-03');
  assert.equal(a.id, b.id);
  assert.equal(a.ta_name, OPEN_LAB.ta);
  assert.equal(a.closes_at, null);
  // it opened an hour ago: a database clock a little ahead never makes it look closed
  assert.ok(sessionState(a, NOW - 30 * 60_000).open);
  assert.notEqual((await store.permanentSession('lab-04')).id, a.id);
  assert.equal((await store.listSessions('lab-03')).length, 1);
});

test('the permanent session: an older open one is kept (its students stay in it); an ended one is replaced', async () => {
  let t = NOW;
  const store = new MemoryStore(() => t);
  const old = await store.openSession('lab-03', null, OPEN_LAB.ta, OPEN_LAB.slot);
  t += 60_000;
  await store.openSession('lab-03', null, OPEN_LAB.ta, OPEN_LAB.slot); // a duplicate made by a race
  await store.openSession('lab-03', 90, 'Nour', 'Sun 10:00'); // a TA session is never the permanent one
  assert.equal((await store.permanentSession('lab-03')).id, old.id);
  await store.closeSession('lab-03', old.id);
  const next = await store.permanentSession('lab-03');
  assert.notEqual(next.id, old.id);
  assert.equal(next.closes_at, null);
});

test('adding up sessions: each student once, every question solved anywhere counts, a task counts once', async () => {
  let t = NOW;
  const store = new MemoryStore(() => t);
  const ta = await store.openSession('lab-03', 90, 'Nour', 'Sun 10:00');
  const open = await store.permanentSession('lab-03');
  await store.touchStudent({ studentKey: '240001', studentId: '240001', name: 'Mona', deviceKey: 'd' });
  await store.joinSession(ta.id, '240001', '—');
  t += 60_000;
  await store.joinSession(open.id, '240001', 'G2');
  const check = (sessionId: string, exercise: string, passed: number) => store.addAttempt({ studentKey: '240001', lab: 'lab-03', exercise, passed, total: 1, code: '', sessionId });
  await check(ta.id, 'e1', 1); // solved in the TA's session
  await check(open.id, 'e2', 0);
  await check(open.id, 'e2', 1); // solved later in the open session
  await check(open.id, 'e1', 0); // a wrong try after solving does not undo the solve
  await store.setTask({ studentKey: '240001', lab: 'lab-03', task: '1', done: true, sessionId: ta.id });
  await store.setTask({ studentKey: '240001', lab: 'lab-03', task: '1', done: true, sessionId: open.id });
  await store.addViews('240001', 'lab-03', ['1'], 120, ta.id);
  await store.addViews('240001', 'lab-03', ['1', '2'], 180, open.id);

  const ids = (await store.listSessions('lab-03')).map((s) => s.id);
  const data = await store.labData('lab-03', ids);
  assert.equal(data.students.length, 1);
  assert.equal(data.students[0].group_name, 'G2');
  assert.equal(data.tasks[0].done, 1);
  assert.deepEqual(data.views[0].seen.sort(), ['1', '2']);
  assert.equal(data.views[0].active_sec, 300);
  const score = scoreStudent(lab, data.best.filter((b) => b.student_key === '240001'), data.tasks[0].done, false);
  assert.equal(score.solved, 2);
  // one session alone sees only its part
  const part = await store.labData('lab-03', open.id);
  assert.equal(scoreStudent(lab, part.best, 1, false).solved, 1);

  const one = await store.studentData('lab-03', '240001', ids);
  assert.equal(one.attempts.length, 4);
  assert.deepEqual(one.tasks, [{ task: '1', done: true }]);
  assert.equal(one.views?.active_sec, 300);

  const live = await store.activity(ids);
  assert.equal(live.active.length, 1);
  assert.equal(live.events.length, 6);
});

test('statistics count only the questions the lab has now', async () => {
  const store = new MemoryStore(() => NOW);
  const s = await store.permanentSession('lab-03');
  await store.touchStudent({ studentKey: 'a', studentId: '240001', name: 'Mona', deviceKey: 'd' });
  await store.joinSession(s.id, 'a', 'G1');
  for (const exercise of ['e1', 'removed-question']) await store.addAttempt({ studentKey: 'a', lab: 'lab-03', exercise, passed: 1, total: 1, code: '', sessionId: s.id });
  const st = moduleStats([lab], await store.statsRaw(['lab-03']));
  assert.deepEqual(st.labs[0].people.map((p) => [p.name, p.solved, p.tries]), [['Mona', 1, 1]]);
});
