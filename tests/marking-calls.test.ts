// The AI button in Admin → Marking: a group called in to discuss its project sees only the call on the
// Project page (no marks, no feedback) until the call is lifted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanDoc, emptyDoc, setCall, studentPhase1, applyMarks, type MarkingDoc } from '../src/lib/marking/doc.ts';

const FULL = { uc_actors: 1, uc_logic: 1.5, uc_mapping: 5, ad_reqs: 5, ad_flow: 2.5, ui_screens: 9, ar_pattern: 2, ar_impl: 2, ar_reason: 2 };
const admin = { role: 'admin' as const, email: 'lead@uni.test', name: 'Lead' };
const ta = { role: 'ta' as const, email: 'one@uni.test', name: 'One' };

function doc(): MarkingDoc {
  const d = emptyDoc();
  d.tas = [{ name: 'One', email: 'one@uni.test', groups: [3, 4] }];
  return d;
}

test('a TA calls only their own groups; an admin calls any; off lifts the call', () => {
  const d = doc();
  assert.deepEqual(setCall(d, ta, 3, true, new Date('2026-11-18T10:00:00Z')), { ok: true });
  assert.deepEqual(d.calls['3'], { by: 'One', at: '2026-11-18T10:00:00.000Z' });
  assert.equal(setCall(d, ta, 7, true).ok, false, 'not in the TA’s load');
  assert.equal(d.calls['7'], undefined);
  assert.equal(setCall(d, { role: 'none', email: 'one@uni.test' }, 3, false).ok, false, 'no role, no change');
  assert.ok(d.calls['3'], 'the refused change left the call');
  assert.equal(setCall(d, admin, 7, true).ok, true);
  assert.equal(setCall(d, ta, 3, false).ok, true);
  assert.equal(d.calls['3'], undefined);
  assert.deepEqual(Object.keys(d.calls), ['7']);
});

test('saving marks keeps the call: they are stored apart', () => {
  const d = doc();
  setCall(d, ta, 4, true);
  applyMarks(d, ta, 4, { scores: FULL, comment: 'x' }, ['A1']);
  assert.ok(d.calls['4']);
});

test('a stored document keeps its calls and drops broken ones', () => {
  const d = cleanDoc({ calls: { 5: { by: 'One', at: '2026-11-18T10:00:00.000Z' }, G6: { by: '  Two  ' }, x: { by: 'Bad' }, 8: 'yes', 9: null } });
  assert.deepEqual(d.calls, { 5: { by: 'One', at: '2026-11-18T10:00:00.000Z' }, 6: { by: 'Two', at: '' } });
  assert.deepEqual(cleanDoc({ calls: ['3'] }).calls, {});
  assert.deepEqual(cleanDoc(null).calls, {});
});

test('what a student sees: the call alone while called, else marks only when complete and published', () => {
  const d = doc();
  applyMarks(d, ta, 3, { scores: FULL, comment: 'Fix the activity diagram.' }, ['A1']);
  applyMarks(d, ta, 4, { scores: { uc_actors: 1 } }, ['B1']);

  assert.equal(studentPhase1(d, 3, false), null, 'not published: nothing');
  const shown = studentPhase1(d, 3, true);
  assert.ok(shown && shown.call === false);
  assert.equal(shown.total, 30);
  assert.equal(shown.comment, 'Fix the activity diagram.');
  assert.equal(studentPhase1(d, 4, true), null, 'half-marked: nothing');
  assert.equal(studentPhase1(d, null, true), null, 'no group: nothing');

  setCall(d, ta, 3, true);
  assert.deepEqual(studentPhase1(d, 3, true), { call: true }, 'called: no marks, no comment');
  assert.deepEqual(studentPhase1(d, 3, false), { call: true }, 'the call shows even before marks are published');
  setCall(d, ta, 4, true);
  assert.deepEqual(studentPhase1(d, 4, true), { call: true }, 'a group with no full marks can be called too');

  setCall(d, ta, 3, false);
  assert.equal(studentPhase1(d, 3, true)?.call, false, 'lifted: the marks are back');
});
