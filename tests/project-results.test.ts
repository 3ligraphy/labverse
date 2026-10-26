// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGroups, emptyPlan, parseRoster } from '../src/lib/project-files/groups.ts';
import { placeNotes, setNote } from '../src/lib/project-files/feedback.ts';
import { cleanRelease, groupLabel, resultFor, whoChecked } from '../src/lib/project-files/results.ts';

const roster = parseRoster('Sara Ali, 23CS0001\nOmar Hassan, 23CS0002\nMona Adel, 23CS0003').students;
const entry = (id: string, student_id: string, name: string, group_name: string, note = '') => ({ id, student_id, name, group_name, note });
const entries = [entry('a', '23CS0001', 'Sara Ali', 'G1'), entry('b', '23CS0002', 'Omar Hassan', 'G1'), entry('c', '23CS0003', 'Mona Adel', 'G2')];

test('a student sees only their own group: number, member names, approved idea and feedback', () => {
  const plan = emptyPlan();
  plan.choices.G1 = { mode: 'manual', idea: 'Campus Companion' };
  const groups = buildGroups(entries, roster, plan);
  const { notes } = placeNotes(groups, setNote({}, 'G1', '  Strong idea, narrow the scope.  ', ['a', 'b'], 'Dr. A'));
  assert.deepEqual(resultFor(groups, plan, notes, '23cs0002'), { group: 'Group 1', members: [{ name: 'Sara Ali', id: '23CS0001' }, { name: 'Omar Hassan', id: '23CS0002' }], idea: 'Campus Companion', feedback: 'Strong idea, narrow the scope.' });
});

test('no approved idea and no feedback come back empty, and an unknown ID finds nothing', () => {
  const plan = emptyPlan();
  const groups = buildGroups(entries, roster, plan);
  const { notes } = placeNotes(groups, {});
  assert.deepEqual(resultFor(groups, plan, notes, '23CS0003'), { group: 'Group 2', members: [{ name: 'Mona Adel', id: '23CS0003' }], idea: '', feedback: null });
  assert.equal(resultFor(groups, plan, notes, '23CS9999'), null);
});

test('results stay hidden unless published', () => {
  assert.equal(cleanRelease(null).published, false);
  assert.equal(cleanRelease({ published: 'yes' }).published, false);
  assert.equal(cleanRelease({ published: true, at: '2026-10-14', by: 'A' }).published, true);
  assert.equal(groupLabel({ key: '?23CS0001', numbered: false }), 'Your group (number still to come)');
});

test('who checked: every group member, with their lookups or none', () => {
  const groups = buildGroups(entries, roster, emptyPlan());
  const view = { studentId: '23cs0002', firstAt: '2026-10-14T10:00:00Z', lastAt: '2026-10-14T11:00:00Z', count: 2 };
  const { rows, checked, total } = whoChecked(groups, [view]);
  assert.equal(total, 3);
  assert.equal(checked, 1);
  assert.deepEqual(rows.find((r) => r.id === '23CS0002'), { name: 'Omar Hassan', id: '23CS0002', group: 'Group 1', view });
  assert.equal(rows.find((r) => r.id === '23CS0003')?.view, null);
});
