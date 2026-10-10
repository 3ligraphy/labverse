// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assignRandom, buildGroups, cleanPlan, cleanRoster, conflicts, emptyPlan, extractIdeas, findStudents, groupKey, groupsCsv,
  parseRoster, randomIdea, unassigned, type Plan,
} from '../src/lib/project-files/groups.ts';

/** A seeded generator, so random picks are repeatable in tests. */
const seeded = (seed = 1) => (n: number) => { seed = (seed * 16807) % 2147483647; return seed % n; };

const roster = parseRoster([
  'Name\tStudent ID',
  'Sara Ali\t23CS0001',
  '23CS0002, Omar Hassan',
  'Mona Adel;23cs0003',
  'Youssef Nabil 23CS0004',
  '23CS0005 Laila Samir',
  'Karim Fathy,23CS0006',
  'not a student line',
].join('\n'));

const entry = (id: string, student_id: string, name: string, group_name: string, note = '') => ({ id, student_id, name, group_name, note });

test('parseRoster reads names and IDs in either order and any separator', () => {
  assert.deepEqual(roster.students.map((s) => s.id), ['23CS0001', '23CS0002', '23CS0003', '23CS0004', '23CS0005', '23CS0006']);
  assert.equal(roster.students[1].name, 'Omar Hassan');
  assert.equal(roster.students[4].name, 'Laila Samir');
  assert.deepEqual(roster.skipped, ['Line 8: not a student line']);
});

test('cleanRoster rejects a student without a valid ID', () => {
  assert.equal(cleanRoster([{ id: '23CS0001', name: 'Sara' }]).ok, true);
  assert.equal(cleanRoster([{ id: 'x', name: 'Sara' }]).ok, false);
  assert.equal(cleanRoster('nope').ok, false);
});

test('groupKey treats different spellings of a numbered group as one group', () => {
  for (const g of ['G1', 'g 1', 'Group 01', 'team1', 'Team #1', '1']) assert.equal(groupKey(g), 'G1');
  assert.equal(groupKey('Falcons'), 'FALCONS');
});

test('findStudents finds roster students by ID or full name in a contribution table', () => {
  const text = 'Contribution table\nName | ID | Part\nSara Ali | 23CS0001 | UI\nOMAR  HASSAN | — | API\nMona | x | tests';
  assert.deepEqual(findStudents(text, roster.students), ['23CS0001', '23CS0002']);
});

test('extractIdeas reads "Idea n:" lines and lists under an ideas heading', () => {
  assert.deepEqual(extractIdeas(['Idea 1: Campus Companion – events', 'Idea 2 - Gym tracker', 'Something else']), ['Campus Companion – events', 'Gym tracker']);
  assert.deepEqual(extractIdeas(['Proposed ideas', '1. Recipe planner', '• Bus tracker', 'Long description of the bus tracker that wraps.', 'Contribution table', '1. Sara Ali']), ['Recipe planner', 'Bus tracker']);
  assert.deepEqual(extractIdeas(['Introduction', '1. Not an idea']), []);
});

const entries = [
  entry('e1', '23CS0001', 'Sara Ali', 'G1'),
  entry('e2', '23CS0004', 'Youssef Nabil', 'group 2', 'Idea 1: Parking finder'),
];
const plan: Plan = { ...emptyPlan(), scans: {
  e1: { updatedAt: 'x', ids: ['23CS0002'], ideas: ['Campus Companion', 'Gym tracker'] },
  e2: { updatedAt: 'x', ids: [], ideas: [], error: 'Download failed' },
} };

test('buildGroups merges submitters, students named in files and added students', () => {
  const groups = buildGroups(entries, roster.students, { ...plan, added: { G2: ['23CS0005'] } });
  assert.deepEqual(groups.map((g) => g.key), ['G1', 'G2']);
  assert.deepEqual(groups[0].members.map((m) => [m.id, m.source]), [['23CS0001', 'submitted'], ['23CS0002', 'document']]);
  assert.deepEqual(groups[1].members.map((m) => [m.id, m.source]), [['23CS0004', 'submitted'], ['23CS0005', 'added']]);
  assert.deepEqual(groups[0].ideas, ['Campus Companion', 'Gym tracker']);
  assert.deepEqual(groups[1].ideas, ['Parking finder']);
  assert.equal(groups[1].unread, 1);
  assert.deepEqual(unassigned(groups, roster.students).map((s) => s.id), ['23CS0003', '23CS0006']);
});

test('a student taken out of a group is no longer listed there', () => {
  const groups = buildGroups(entries, roster.students, { ...plan, removed: { G1: ['23CS0002'] } });
  assert.deepEqual(groups[0].members.map((m) => m.id), ['23CS0001']);
  assert.deepEqual(cleanPlan({ removed: { G1: ['23cs0002'] } }).removed, { G1: ['23CS0002'] });
});

test('conflicts lists a student who appears in two groups', () => {
  const groups = buildGroups([...entries, entry('e3', '23CS0002', 'Omar Hassan', 'G2')], roster.students, plan);
  assert.deepEqual(conflicts(groups), [{ id: '23CS0002', name: 'Omar Hassan', groups: ['G1', 'G2'] }]);
});

test('assignRandom fills only open seats and never reuses a student', () => {
  const groups = buildGroups(entries, roster.students, plan);
  const r = assignRandom(groups, roster.students, plan, { G1: 5, G2: 2 }, seeded(7));
  assert.equal(r.added.G1.length, 1); // G1 already has 2 of 3
  assert.equal(r.added.G2.length, 2);
  const all = [...r.added.G1, ...r.added.G2];
  assert.equal(new Set(all).size, 3);
  for (const id of all) assert.ok(['23CS0003', '23CS0005', '23CS0006'].includes(id));
  assert.equal(r.short, 0);
});

test('assignRandom reports how many seats it could not fill', () => {
  const groups = buildGroups(entries, roster.students, plan);
  const r = assignRandom(groups, roster.students.slice(0, 4), plan, { G1: 1, G2: 2 }, seeded(3));
  assert.equal(Object.values(r.added).flat().length, 1);
  assert.equal(r.short, 2);
});

test('randomIdea picks from the list, or null for none', () => {
  assert.equal(randomIdea([], seeded()), null);
  assert.ok(['a', 'b'].includes(randomIdea(['a', 'b'], seeded())!));
});

test('cleanPlan keeps valid fields and drops malformed ones', () => {
  const p = cleanPlan({ added: { G1: ['23cs0003', 'bad id!'], '': ['23CS0001'] }, choices: { G1: { mode: 'auto', idea: 'X' }, G2: { mode: 'nope' } }, autoAll: 'yes', scans: { e1: { updatedAt: 't', ids: ['a1b'], ideas: ['I'] }, e2: 4 } });
  assert.deepEqual(p.added, { G1: ['23CS0003'] });
  assert.deepEqual(p.choices, { G1: { mode: 'auto', idea: 'X' } });
  assert.equal(p.autoAll, false);
  assert.deepEqual(Object.keys(p.scans), ['e1']);
});

test('groupsCsv lists members, new members and the chosen idea', () => {
  const p: Plan = { ...plan, added: { G2: ['23CS0005'] }, choices: { G1: { mode: 'manual', idea: 'Gym tracker' } } };
  const csv = groupsCsv(buildGroups(entries, roster.students, p), p);
  const lines = csv.trim().split('\r\n');
  assert.equal(lines[0], 'Group number,Group name(s) submitted,All members,Newly added members,Members added,Total members,Idea selected,How the idea was chosen');
  assert.equal(lines[1], 'G1,G1,Sara Ali (23CS0001); Omar Hassan (23CS0002),,0,2,Gym tracker,Manual');
  assert.equal(lines[2], 'G2,group 2,Youssef Nabil (23CS0004); Laila Samir (23CS0005),Laila Samir (23CS0005),1,2,,');
});
