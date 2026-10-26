// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pdfTextRows } from '../src/lib/project-files/pdf-text.ts';
import {
  assignRandom, autoNumber, buildGroups, lastHandIn, sortGroups, cleanTeam, entryKeys, numberGroup, cleanPlan, cleanRoster, conflicts, emptyPlan, extractIdeas, findStudents, groupKey, groupsCsv,
  parseRoster, randomIdea, unassigned, documentStudents, type Plan,
} from '../src/lib/project-files/groups.ts';

/** A seeded generator, so random picks are repeatable in tests. */
const seeded = (seed = 1) => (n: number) => { seed = (seed * 16807) % 2147483647; return seed % n; };

test('document members absent from the roster survive saving and appear in the group', () => {
  const members = documentStudents(['Name | ID | Contribution', 'Farida Ehab | 241831 | UI', 'Jana Ahmed | 241533 | API']);
  assert.deepEqual(members.map((m) => m.id), ['241831', '241533']);
  const plan = cleanPlan({ scans: { a: { updatedAt: 'today', ids: members.map((m) => m.id), members, ideas: [] } } });
  const groups = buildGroups([{ id: 'a', student_id: '248986', name: 'George Hani', group_name: '1', note: '' }], [], plan);
  assert.deepEqual(groups[0].members.map((m) => m.name), ['George Hani', 'Farida Ehab', 'Jana Ahmed']);
  assert.deepEqual(documentStudents(['Name: Sara Ali | Student ID: 240001 | Group: A1']), [{ id: '240001', name: 'Sara Ali' }]);
  assert.deepEqual(documentStudents(['Sara Ali | 240001 | Sara240001@bue.edu.eg']), [{ id: '240001', name: 'Sara Ali' }]);
  assert.deepEqual(documentStudents(['Names: Hassan236184, Mazen235577']).map((m) => m.id), ['236184', '235577']);
  assert.deepEqual(documentStudents(['Name\u0001 | ID\u0001', 'Mohamed\u0001Amr\u0001 | 242231\u0001']), [{ id: '242231', name: 'Mohamed Amr' }]);
  assert.deepEqual(documentStudents(['ID | Student Name | BUE Email', 'Mohamed Rizk | Mohamed249214@bue.edu.eg', '249214']), [{ id: '249214', name: 'Mohamed Rizk' }]);
});

test('live proposal heading variants retain second ideas without feature headings or duplicate labels', () => {
  assert.deepEqual(extractIdeas(['Idea (1): Help Nearby', 'Overview', 'Description.', 'Idea (2): Wear Again', 'Overview']), ['Help Nearby', 'Wear Again']);
  assert.deepEqual(extractIdeas(['st', '1 | idea:', 'Help Nearby', 'nd', '2 | idea:', 'Wear Again']), ['Help Nearby', 'Wear Again']);
  assert.deepEqual(extractIdeas(['Project Ideas:', '1- Mobile Transaction App :', 'A mobile application for securely sending money with a QR code.', '2- Installment Tracker App', 'Mobile application that helps users manage purchases.']), ['Mobile Transaction App', 'Installment Tracker App']);
  assert.deepEqual(extractIdeas(['Idea 1: Gym Connect', '3. Admin Panel Features (Web Dashboard)', 'A dashboard for managing users and workout activities.']), ['Gym Connect']);
  assert.deepEqual(extractIdeas(['Proposed Ideas:', '1. | Property Finder', 'Brief Description: an application for locating homes.', '2. | Clinic Finder', 'Brief Description: an application for finding doctors.']), ['Property Finder', 'Clinic Finder']);
});

test('contribution tables match unique shortened names, spaced IDs and Arabic digits', () => {
  const students = [
    { id: '240001', name: 'Sara Ahmed Ali' },
    { id: '240002', name: 'Omar Mohamed Hassan' },
    { id: '23CS0003', name: 'Mona Adel' },
  ];
  assert.deepEqual(findStudents('Name | ID | Contribution\nSara Ali | — | UI\nOmar | ٢٤٠٠٠٢ | API\nMona | 23 CS 0003 | Tests', students), students.map((s) => s.id));
  assert.deepEqual(findStudents('Sara Ali | UI', [...students, { id: '240004', name: 'Sara Mahmoud Ali' }]), []);
  assert.deepEqual(findStudents('Sara | UI\nOmar | API', students), []);
});

test('PDF table rows use visual positions even when the stream stores columns separately', () => {
  const item = (str: string, x: number, y: number, width = 60) => ({ str, transform: [10, 0, 0, 10, x, y], width, hasEOL: true });
  const lines = pdfTextRows([item('Sara Ali', 10, 100), item('Omar Hassan', 10, 80), item('240001', 160, 100), item('240002', 160, 80)]);
  assert.deepEqual(lines, ['Sara Ali | 240001', 'Omar Hassan | 240002']);
  assert.deepEqual(findStudents(lines.join('\n'), [{ id: '240001', name: 'Sara Ahmed Ali' }, { id: '240002', name: 'Omar Hassan' }]), ['240001', '240002']);
});

test('all idea heading styles are collected when mixed within one proposal', () => {
  assert.deepEqual(extractIdeas([
    'Idea 1: Campus Companion',
    '2. TripWise App', 'TripWise is a travel planner for students and their friends.',
    'SkillSwap', 'Overview', 'Swap skills with classmates.',
    'Features', '1. Login screen', '2. Profile screen',
  ]), ['Campus Companion', 'TripWise App', 'SkillSwap']);
});

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
  assert.deepEqual(extractIdeas(['Proposed ideas', '1. Recipe planner', 'Long description of the recipe planner that wraps onto a second line.', '2. Bus tracker', 'Contribution table', '1. Sara Ali']), ['Recipe planner', 'Bus tracker']);
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
  const r = assignRandom(groups, roster.students, plan, { G1: 5, G2: 1 }, seeded(7));
  assert.equal(r.added.G1.length, 1); // G1 already has 2; stop at the minimum of 3
  assert.equal(r.added.G2.length, 1);
  const all = [...r.added.G1, ...r.added.G2];
  assert.equal(new Set(all).size, 2);
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

test('extractIdeas understands the usual proposal layouts', () => {
  // labelled lines
  assert.deepEqual(extractIdeas(['Project Title: Campus Companion', 'App name - StudyBuddy', 'Our idea is to build a parking finder for the campus']),
    ['Campus Companion', 'StudyBuddy', 'a parking finder for the campus']);
  assert.deepEqual(extractIdeas(['First idea: Gym tracker', 'Second Idea – Clinic booking', 'Option B) Book swap']), ['Gym tracker', 'Clinic booking', 'Book swap']);
  // "Idea 1" heading, title on the next line, then its description and feature bullets
  assert.deepEqual(extractIdeas([
    'Mobile Development – Project Proposal', 'Idea 1', 'Smart Parking', 'An app that shows free parking spots near the university gates in real time.',
    '• Live map', '• Notifications', 'Idea 2', 'Lost & Found', 'Students post lost items with photos.',
  ]), ['Smart Parking', 'Lost & Found']);
  // a plain "Project idea" heading with a paragraph under it
  assert.deepEqual(extractIdeas(['Project idea:', 'A food ordering app for the campus cafeteria', 'Features', '• Menu']), ['A food ordering app for the campus cafeteria']);
  // an ideas table
  assert.deepEqual(extractIdeas(['No. | Idea | Description', '1 | Campus parking finder | shows free spots', '2 | Clinic booking | appointments', 'Contribution table']),
    ['Campus parking finder', 'Clinic booking']);
  // bulleted ideas with bulleted sub-points at the same level are still read; the document title is not an idea
  assert.deepEqual(extractIdeas(['Project Proposal', 'Proposed ideas:', '• Bus tracker', '• Recipe planner', 'Team members']), ['Bus tracker', 'Recipe planner']);
  // a contribution table is not an ideas table
  assert.deepEqual(extractIdeas(['Name | Student ID | Contribution', 'Sara Ali | 245793 | UI']), []);
});

test('a student ID or lab group code is not used as a group number', () => {
  assert.equal(cleanTeam('7'), '7');
  assert.equal(cleanTeam('Group 269411'), null);
  assert.equal(cleanTeam('<b>'), null);
  // Mourad typed his lab group; his contribution table names Sara, who handed in for G1 → he joins G1.
  const es = [
    entry('a', '23CS0001', 'Sara Ali', 'G1'),
    entry('b', '23CS0003', 'Mona Adel', 'Group 269411'),
    entry('c', '23CS0004', 'Youssef Nabil', '269496'),
    entry('d', '23CS0006', 'Karim Fathy', 'Group 269496'),
    entry('e', '23CS0005', 'Laila Samir', '293938'),
  ];
  const p: Plan = { ...emptyPlan(), scans: {
    b: { updatedAt: 'x', ids: ['23CS0001'], ideas: [] },
    c: { updatedAt: 'x', ids: ['23CS0006'], ideas: [] },
  } };
  const keys = entryKeys(es, p);
  assert.equal(keys.get('b'), 'G1');
  // Youssef's file names Karim, so their two unnumbered hand-ins are one group; Laila is on her own.
  assert.equal(keys.get('c'), '?23CS0004');
  assert.equal(keys.get('d'), '?23CS0004');
  assert.equal(keys.get('e'), '?23CS0005');
  const groups = buildGroups(es, roster.students, p);
  assert.deepEqual(groups.map((g) => g.title), ['G1', 'No number · Youssef Nabil', 'No number · Laila Samir']);
  assert.equal(groupsCsv(groups, p).split('\r\n')[2].split(',')[0], 'No team number yet');
});

test('numberGroup gives every hand-in the number and moves what was saved for the group', () => {
  const es = [entry('c', '23CS0004', 'Youssef Nabil', '269496'), entry('d', '23CS0006', 'Karim Fathy', '269496')];
  const p: Plan = { ...emptyPlan(), scans: { c: { updatedAt: 'x', ids: ['23CS0006'], ideas: [] } },
    added: { '?23CS0004': ['23CS0005'] }, choices: { '?23CS0004': { mode: 'manual', idea: 'Gym' } }, later: ['?23CS0004'] };
  const [g] = buildGroups(es, roster.students, p);
  assert.equal(numberGroup(p, g, 'Team 7'), 'G7');
  assert.deepEqual(p.teams, { c: 'Team 7', d: 'Team 7' });
  assert.deepEqual(p.added, { G7: ['23CS0005'] });
  assert.deepEqual(p.choices, { G7: { mode: 'manual', idea: 'Gym' } });
  assert.deepEqual(p.later, ['G7']);
  const [after] = buildGroups(es, roster.students, p);
  assert.equal(after.key, 'G7');
  assert.deepEqual(after.members.map((m) => m.id), ['23CS0004', '23CS0006', '23CS0005']);
  assert.deepEqual(cleanPlan(p).teams, { c: 'Team 7', d: 'Team 7' });
});

test('autoNumber gives groups without a number the lowest free numbers, at random', () => {
  const es = [
    entry('a', '23CS0001', 'Sara Ali', '2'),
    entry('b', '23CS0003', 'Mona Adel', 'Group 269411'),
    entry('c', '23CS0004', 'Youssef Nabil', '269496'),
    entry('d', '23CS0005', 'Laila Samir', '293938'),
  ];
  const p: Plan = { ...emptyPlan(), added: { '?23CS0003': ['23CS0006'] } };
  const moves = autoNumber(buildGroups(es, roster.students, p), p, seeded(5));
  // G2 is taken by the group that typed 2, so the three others get 1, 3 and 4 in some order
  assert.deepEqual(Object.values(moves).sort(), ['G1', 'G3', 'G4']);
  const after = buildGroups(es, roster.students, p);
  assert.deepEqual(after.map((g) => g.key), ['G1', 'G2', 'G3', 'G4']);
  assert.ok(after.every((g) => g.numbered));
  // what was saved for a group moves with it
  assert.deepEqual(p.added[moves['?23CS0003']], ['23CS0006']);
  assert.deepEqual(autoNumber(after, p, seeded(5)), {}); // nothing left to number
});

test('autoNumber with all renumbers every group without two groups sharing a number', () => {
  const es = [entry('a', '23CS0001', 'Sara Ali', '1'), entry('b', '23CS0003', 'Mona Adel', '2'), entry('c', '23CS0004', 'Youssef Nabil', '3')];
  const p: Plan = { ...emptyPlan(), choices: { G1: { mode: 'manual', idea: 'Gym' } } };
  const moves = autoNumber(buildGroups(es, roster.students, p), p, seeded(9), true);
  assert.deepEqual(Object.values(moves).sort(), ['G1', 'G2', 'G3']);
  const after = buildGroups(es, roster.students, p);
  assert.equal(after.length, 3);
  const sara = after.find((g) => g.members.some((m) => m.id === '23CS0001'))!;
  assert.deepEqual(p.choices, { [sara.key]: { mode: 'manual', idea: 'Gym' } });
});

test('extractIdeas reads real proposals from the course', () => {
  const cookbook = [
    'Mobile Application Development', 'Project Proposal', 'CookBook Project Proposal', 'Recipe and Meal Organizer', 'Course code: 26CSCI38H',
    'Module Leader: Dr. Amira Sayed Abdelaziz', 'Team Members and Proposed Roles', 'Member | Student name and ID | Proposed contribution',
    'A | Mohamed Haitham | 235994 | Recipe browsing and the summary', 'B | Omar Waleed | 239688 | Recipe forms, camera and shopping',
    'C | Meal scheduling and YouTube', 'Title of the Application', 'CookBook — Recipe and Meal',
  ];
  assert.deepEqual(extractIdeas(cookbook), ['CookBook — Recipe and Meal']);
  // without the "Title of the Application" section, the app's name in the document title is used
  assert.deepEqual(extractIdeas(cookbook.slice(0, -2)), ['CookBook']);
  assert.deepEqual(extractIdeas(['Mobile Application Development', 'Project Proposal']), []);
  assert.deepEqual(extractIdeas([
    'Number | Name | ID | Group', '1 | Rawan Ahmed', 'Osman', '246108 | A3', '2 | Fatma Ahmed | 246613 | A3', '3 | Merna Attwa | 247689 | A3',
    'The ideas : restaurant app ,Fitness Challenge App',
  ]), ['restaurant app', 'Fitness Challenge App']);
});

test('sortGroups orders by newest hand-in by default, and by number, size or missing idea on request', () => {
  const es = [
    { ...entry('a', '23CS0001', 'Sara Ali', 'G2'), updated_at: '2026-10-10T09:00:00Z' },
    { ...entry('b', '23CS0003', 'Mona Adel', 'G1'), updated_at: '2026-10-11T08:00:00Z' },
    { ...entry('c', '23CS0004', 'Youssef Nabil', 'G3'), updated_at: '2026-10-09T12:00:00Z' },
    { ...entry('d', '23CS0005', 'Laila Samir', 'G3'), updated_at: '2026-10-10T12:00:00Z' },
  ];
  const p: Plan = { ...emptyPlan(), choices: { G1: { mode: 'manual', idea: 'Gym' } } };
  const groups = buildGroups(es, roster.students, p);
  const keys = (sort: Parameters<typeof sortGroups>[1]) => sortGroups(groups, sort, es, p).map((g) => g.key);
  assert.equal(lastHandIn(groups.find((g) => g.key === 'G3')!, es), '2026-10-10T12:00:00Z');
  assert.deepEqual(keys('newest'), ['G1', 'G3', 'G2']);
  assert.deepEqual(keys('oldest'), ['G2', 'G3', 'G1']);
  assert.deepEqual(keys('number'), ['G1', 'G2', 'G3']);
  assert.deepEqual(keys('members'), ['G1', 'G2', 'G3']);
  assert.deepEqual(keys('unchosen'), ['G3', 'G2', 'G1']);
});

test('extractIdeas reads numbered app headings that have no "Idea" label', () => {
  const kino = [
    'Faculty of Informatics and Computer Science', 'Mobile Application Development Proposal', '26CSSE24H', 'Group Participants',
    'Name | ID | Group', 'Khaled Waleed | 248902 | A-3', 'Aya Hassan | 242329 | A-2', 'Lamees Yasser | 246629 | A-3', 'Mohammed Essam | 209762 | A-1',
    '1. KinoLog App (Movie Tracking and Social Networking Application)',
    'KinoLog is a social application for film enthusiasts that allows users to track watched',
    'movies, rate and review films, maintain watchlists, create custom movie lists, and follow',
    'The proposed app would use The Movie Database (TMDB) API to retrieve movie',
    '2. TripWise App (Travel Planning Application)',
    'TripWise is a travel planning application that allows users to organize trips, create day-by-',
    'For the proposed app, Google Maps Platform can provide interactive maps, destination',
  ];
  assert.deepEqual(extractIdeas(kino), ['KinoLog App (Movie Tracking and Social Networking Application)', 'TripWise App (Travel Planning Application)']);
  // a numbered name without "App", described on the next line
  assert.deepEqual(extractIdeas(['1. StudyBuddy', 'StudyBuddy is a planner that matches classmates for group study sessions.']), ['StudyBuddy']);
  // ordinary numbered lists are not ideas
  assert.deepEqual(extractIdeas(['1. Introduction', '2. The app will let users log in.', '3. Login screen', '4. Profile screen']), []);
});

test('extractIdeas reads "Idea 1 Description: X" and "Project Proposal: X" titles', () => {
  // ideas labelled "Idea n Description:", with " | " feature bullets under them
  assert.deepEqual(extractIdeas([
    'Mobile Application Development', 'Contribution Table:', 'Name | ID', 'Student One | 240001', 'Ideas Proposed',
    'Idea 1 Description: Campus Lost and Found',
    'Campus Lost and Found is a phone app for students. It is useful for locating items that were',
    'Features:', ' | Account: Set up your account. Log on using your school/uni email.',
    'Idea 2 Description: Fitness and Path Tracker',
    'Take advantage of this app when away from home.', 'Features:', ' | Goals: Decide on a number of steps to do each day.',
  ]), ['Campus Lost and Found', 'Fitness and Path Tracker']);
  // one "Project Proposal: X" section per idea, bulleted with "• | "
  assert.deepEqual(extractIdeas([
    'Page | 1', 'Mobile Application Development', 'Name | ID | Group', 'Student One | 240001 | SE A3', 'Page | 2',
    'Project Proposal: Gym Connect', '1. Project Overview & Problem Statement', '• | Equipment Bottlenecks: Crowded gym floors lead to long wait times',
    'Page | 5', 'Project Proposal: Recycling Marketplace Platform', '2. User Features (Households and Businesses)', '• | Registration and Login: Create an account.',
  ]), ['Gym Connect', 'Recycling Marketplace Platform']);
  assert.deepEqual(extractIdeas(['App Proposal - StudyBuddy']), ['StudyBuddy']);
  // a description sentence after "Idea description:" is not taken as the idea's name
  assert.deepEqual(extractIdeas(['Idea description: This app helps students find study partners in their classes.']), []);
});

test('random assignment ignores teams of three or four and caps a smaller team at three', () => {
  const es = [entry('a', '23CS0001', 'Sara Ali', '1'), entry('b', '23CS0002', 'Omar Hassan', '2'), entry('c', '23CS0003', 'Mona Adel', '3')];
  const p = emptyPlan();
  p.scans.a = { updatedAt: 'x', ids: ['31', '32'], ideas: [] };
  p.scans.b = { updatedAt: 'x', ids: ['41', '42', '43'], ideas: [] };
  const students = [...roster.students, ...['31', '32', '41', '42', '43'].map((id) => ({ id, name: `Member ${id}` }))];
  const groups = buildGroups(es, students, p);
  const result = assignRandom(groups, students, p, { G1: 3, G2: 3, G3: 3 }, seeded(5));
  assert.equal(result.placed.G1, undefined);
  assert.equal(result.placed.G2, undefined);
  assert.equal(result.placed.G3.length, 2);
  assert.deepEqual(buildGroups(es, students, { ...p, added: result.added }).map((g) => g.members.length), [3, 4, 3]);
  assert.deepEqual(p.added, {}, 'the original plan remains available for undo');
});

test('extractIdeas reads a title above "Overview" / "Brief description:" and numbered titles with a paragraph', () => {
  assert.deepEqual(extractIdeas(['Proposal', 'Members:', 'Entertainment Review App', 'Overview', 'Our app aims to be a review platform.', 'SkillSwap', 'Overview', 'Swap skills.']), ['Entertainment Review App', 'SkillSwap']);
  assert.deepEqual(extractIdeas(['Hear Me', 'Brief description:', 'An app for deaf users.', 'Rootine', 'Brief description:', 'Plant care.']), ['Hear Me', 'Rootine']);
  assert.deepEqual(extractIdeas(['Name | ID', '1. Smart Expense Tracker', 'Many individuals conduct daily financial transactions that go untracked.', '2. Nabd', 'A blood donation app for people who need blood quickly nearby.']), ['Smart Expense Tracker', 'Nabd']);
  assert.deepEqual(extractIdeas(['Ober (Open Uber)', 'Mobile Application Development | | | 26CSCI38H', 'Name: Ali | Student ID: 239719', 'Idea and purpose', 'A ride booking app.']), ['Ober (Open Uber)']);
  // a feature list is not read as ideas
  assert.deepEqual(extractIdeas(['Core functionality', '1. Select pickup and drop-off locations on a map.', '2. View an estimated fare.']), []);
});

test('extractIdeas cleans contents-page dots, page numbers, control characters and table bars', () => {
  assert.deepEqual(extractIdeas(['Idea 1: RoadSense ........ 4', 'Idea 1: RoadSense']), ['RoadSense']);
  assert.deepEqual(extractIdeas(['Idea 1: StrategyPulse:\u0001A\u0001Mobile\u0001App', 'Idea 2: | Smart Property Finder']), ['StrategyPulse: A Mobile App', 'Smart Property Finder']);
});

test('findStudents finds an ID typed against the name', () => {
  assert.deepEqual(findStudents('Names: Hassan236184, mazeen235577', [{ id: '236184', name: 'Hassan Saif' }]), ['236184']);
});
