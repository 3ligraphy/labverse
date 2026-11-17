// The course's groups: the proposal's groups (numbers, members, approved ideas) are the groups of every other
// item (Phase 1, Phase 2, …), whatever number a student typed. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGroups, canonKey, cleanPlan, conflicts, emptyPlan, ideasAsChoices, makeCanon, masterItem } from '../src/lib/project-files/groups.ts';
import { resultFor } from '../src/lib/project-files/results.ts';
import { entriesCsv, zipPath } from '../src/lib/project-files/core.ts';

const roster = [
  { id: '240001', name: 'Ann One' }, { id: '240002', name: 'Ann Two' }, { id: '240003', name: 'Ben One' },
  { id: '240004', name: 'Cat One' }, { id: '240006', name: 'Cat Two' }, { id: '240099', name: 'New Comer' }, { id: '240098', name: 'Lone Student' },
];
const e = (id: string, student: string, group: string) => ({ id, student_id: student, name: roster.find((s) => s.id === student)?.name ?? 'X Y', group_name: group, note: '' });

// The proposal: G1 = 240001 (handed in) + 240002 (named in the file), G2 = 240003, G3 = 240004 + 240006 (added on the page)
const proposalPlan = cleanPlan({
  scans: { p1: { updatedAt: 't', ids: ['240002'], ideas: ['Idea One'] } },
  added: { G3: ['240006'] },
  choices: { G1: { mode: 'manual', idea: 'Idea One' }, G2: { mode: 'auto', idea: 'Idea Two' } },
});
const proposal = buildGroups([e('p1', '240001', '1'), e('p2', '240003', '2'), e('p3', '240004', '3')], roster, proposalPlan);
const canon = makeCanon({ id: 'prop', title: 'Project proposal submission' }, proposal, proposalPlan);

test('the proposal’s groups become the course’s groups: every member’s group and every approved idea', () => {
  assert.deepEqual(canon.members, { '240001': 'G1', '240002': 'G1', '240003': 'G2', '240004': 'G3', '240006': 'G3' });
  assert.deepEqual(canon.ideas, { G1: 'Idea One', G2: 'Idea Two' });
  assert.equal(canon.source, 'prop');
  assert.equal(canonKey(canon, ['240099', '240004']), 'G3');
  assert.equal(canonKey(canon, ['240099']), null);
  assert.deepEqual(ideasAsChoices(canon).G2, { mode: 'manual', idea: 'Idea Two' });
});

test('another item uses the proposal’s numbers: typed and admin-typed numbers are ignored, members come with their group', () => {
  const plan = cleanPlan({ teams: { q2: '9' }, scans: { q3: { updatedAt: 't', ids: ['240004'], ideas: [] } } });
  const entries = [e('q1', '240002', '7'), e('q2', '240003', '2'), e('q3', '240099', '3'), e('q4', '240098', '5')];
  const groups = buildGroups(entries, roster, plan, canon);
  const keyOf = (entry: string) => groups.find((g) => g.entries.includes(entry))?.key;
  assert.equal(keyOf('q1'), 'G1', 'typed 7, but the proposal says group 1');
  assert.equal(keyOf('q2'), 'G2', 'the admin typed 9 on this item, the proposal still wins');
  assert.equal(keyOf('q3'), 'G3', 'a newcomer joins the group of the classmates named in the file');
  assert.equal(groups.find((g) => g.entries.includes('q4'))?.numbered, false, 'in no proposal group: no number (typed 5 is not trusted)');
  const g1 = groups.find((g) => g.key === 'G1')!;
  assert.deepEqual(g1.members.map((m) => [m.id, m.source]), [['240002', 'submitted'], ['240001', 'group']], 'the teammate who did not hand in is still in the group');
  const g3 = groups.find((g) => g.key === 'G3')!;
  assert.deepEqual(g3.members.map((m) => [m.id, m.source]), [['240099', 'submitted'], ['240004', 'document'], ['240006', 'group']]);
  assert.deepEqual(conflicts(groups), []);
  // each member finds their group and the proposal's idea
  const r = resultFor(groups, { choices: ideasAsChoices(canon) }, new Map(), '240001');
  assert.equal(r?.group, 'Group 1');
  assert.equal(r?.idea, 'Idea One');
});

test('a student in no proposal group keeps the group staff put them in on that item, if the proposal has that number', () => {
  const plan = cleanPlan({ teams: { q5: '3', q6: '48', q2: '1' } });
  const entries = [e('q5', '240098', '99'), e('q6', '240099', '2'), e('q2', '240003', '2')];
  const groups = buildGroups(entries, roster, plan, canon);
  const keyOf = (entry: string) => groups.find((g) => g.entries.includes(entry))?.key;
  assert.equal(keyOf('q5'), 'G3', 'staff put them in group 3, which the proposal has');
  assert.equal(groups.find((g) => g.entries.includes('q6'))?.numbered, false, 'group 48 is not on the proposal: no number');
  assert.equal(keyOf('q2'), 'G2', 'a student who is in a proposal group stays there, whatever staff typed here');
});

test('the proposal itself keeps its own numbering (no course groups applied to it)', () => {
  const plan = emptyPlan();
  const groups = buildGroups([e('p1', '240001', '4')], roster, plan);
  assert.equal(groups[0].key, 'G4');
});

test('the course’s item is the proposal: the one marked as proposal, else one called proposal', () => {
  const files = [
    { id: 'a', title: 'Project Phase 1', kind: 'other', module: 'mobile-development', created_at: '2026-10-23' },
    { id: 'b', title: 'Project proposal submission', kind: 'proposal', module: 'mobile-development', created_at: '2026-10-07' },
    { id: 'c', title: 'Flowchart', kind: 'proposal', module: 'intro-to-computing', created_at: '2026-10-01' },
  ];
  assert.equal(masterItem(files)?.id, 'b');
  assert.equal(masterItem([{ ...files[0] }, { ...files[1], kind: 'other' }])?.id, 'b', 'by its title');
  assert.equal(masterItem([files[0]]), null);
});

test('the hand-ins list, its CSV and the ZIP folders use the course group, with what the student typed kept', () => {
  const entry = { id: 'q1', file_id: 'f', student_id: '240002', name: 'Ann Two', group_name: '7', note: '', url: 'u', pathname: 'x.pdf', size: 1024, created_at: '2026-11-01', updated_at: '2026-11-01', group: 'G1' };
  const csv = entriesCsv({ due_at: null }, [entry]);
  assert.match(csv.split('\r\n')[0], /^Name,Student ID,Group,Group typed,/);
  assert.match(csv.split('\r\n')[1], /^Ann Two,240002,Group 1,7,/);
  assert.equal(zipPath(entry, new Set()), 'Group 1/240002 - Ann Two.pdf');
  assert.equal(zipPath({ ...entry, group: '' }, new Set()), 'No group number/240002 - Ann Two.pdf');
});
