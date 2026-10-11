// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_FEEDBACK, cleanFeedback, parseNote, placeNotes, reportFileName, reportRows, setNote } from '../src/lib/project-files/feedback.ts';
import { buildGroups, emptyPlan, numberGroup } from '../src/lib/project-files/groups.ts';

const entry = (id: string, student_id: string, name: string, group_name: string) => ({ id, student_id, name, group_name, note: '' });
const entries = [
  entry('e1', '23CS0001', 'Sara Ali', 'G1'),
  entry('e2', '23CS0002', 'Omar Hassan', 'g1'),
  entry('e3', '23CS0003', 'Mona Adel', 'Group 2'),
  entry('e4', '2310004', 'Youssef Nabil', '2310004'), // typed their ID: no team number yet
];

test('parseNote checks the group key and the length, and tidies whitespace', () => {
  assert.deepEqual(parseNote({ key: 'G1', text: '  Good work.  \r\nNext steps:   \n', entries: ['e1', 'e1', 'e2'] }), { ok: true, value: { key: 'G1', text: 'Good work.\nNext steps:', entries: ['e1', 'e2'] } });
  assert.equal(parseNote({ key: '', text: 'x' }).ok, false);
  assert.equal(parseNote({ key: 'G1', text: 'x'.repeat(MAX_FEEDBACK + 1) }).ok, false);
  assert.deepEqual(parseNote({ key: 'G1', text: '' }), { ok: true, value: { key: 'G1', text: '', entries: [] } });
});

test('setNote saves, replaces and clears one group without touching the others', () => {
  const now = new Date('2026-10-11T10:00:00Z');
  let fb = setNote({}, 'G1', 'Nice', ['e1', 'e2'], 'Dr Ali', now);
  fb = setNote(fb, 'G2', 'Scope it down', ['e3'], 'TA', now);
  assert.deepEqual(fb.G1, { text: 'Nice', entries: ['e1', 'e2'], updatedAt: now.toISOString(), by: 'Dr Ali' });
  fb = setNote(fb, 'G1', '', ['e1', 'e2'], 'Dr Ali', now);
  assert.deepEqual(Object.keys(fb), ['G2']);
});

test('setNote moves a note when its group was renumbered', () => {
  const fb = setNote(setNote({}, 'G1', 'Old', ['e1', 'e2'], 'A'), 'G7', 'New', ['e1', 'e2'], 'A');
  assert.deepEqual(Object.keys(fb), ['G7']);
});

test('cleanFeedback drops malformed and empty notes', () => {
  const fb = cleanFeedback({ G1: { text: ' Hi ', entries: ['e1'], updatedAt: 'x', by: 'A' }, G2: { text: '' }, '': { text: 'no key' }, G3: null, G4: 'text' });
  assert.deepEqual(fb, { G1: { text: 'Hi', entries: ['e1'], updatedAt: 'x', by: 'A' } });
  assert.deepEqual(cleanFeedback(null), {});
  assert.deepEqual(cleanFeedback([1, 2]), {});
});

test('placeNotes follows the hand-ins when the Groups page renumbers a group', () => {
  const plan = emptyPlan();
  let groups = buildGroups(entries, [], plan);
  const fb = setNote({}, 'G1', 'For the Sara/Omar team', groups.find((g) => g.key === 'G1')!.entries, 'A');
  numberGroup(plan, groups.find((g) => g.key === 'G1')!, '5');
  groups = buildGroups(entries, [], plan);
  const { notes, orphans } = placeNotes(groups, fb);
  assert.equal(notes.get('G5')?.text, 'For the Sara/Omar team');
  assert.equal(notes.has('G1'), false);
  assert.deepEqual(orphans, []);
});

test('placeNotes reports notes whose hand-ins are all gone', () => {
  const groups = buildGroups(entries, [], emptyPlan());
  const { orphans } = placeNotes(groups, { G9: { text: 'Lost', entries: ['gone'], updatedAt: '', by: '' } });
  assert.equal(orphans.length, 1);
  assert.equal(orphans[0][0], 'G9');
});

test('reportRows lists numbered groups with members, the approved idea and the feedback', () => {
  const plan = emptyPlan();
  plan.choices.G1 = { mode: 'auto', idea: 'Campus Companion' };
  const groups = buildGroups(entries, [], plan);
  const { notes } = placeNotes(groups, setNote({}, 'G2', 'Pick one idea', ['e3'], 'A'));
  const rows = reportRows(groups, plan, notes);
  assert.deepEqual(rows.map((r) => r.group), ['Group 1', 'Group 2']);
  assert.deepEqual(rows[0].members.map((m) => m.id), ['23CS0001', '23CS0002']);
  assert.equal(rows[0].idea, 'Campus Companion');
  assert.equal(rows[0].ideaMode, 'auto');
  assert.equal(rows[0].feedback, '');
  assert.equal(rows[1].idea, '');
  assert.equal(rows[1].ideaMode, null);
  assert.equal(rows[1].feedback, 'Pick one idea');
  assert.equal(reportRows(groups, plan, notes, true).length, 3);
});

test('reportFileName makes a safe file name', () => {
  assert.equal(reportFileName('Project proposal submission'), 'project-proposal-submission-feedback.pdf');
  assert.equal(reportFileName('  ??? '), 'project-feedback.pdf');
});
