// Admin → Marking, round 2: the default TA load (from the course team's list) with accounts linked by first name,
// CSV uploads (Excel's "Save as CSV", a simple one-row header, semicolons and decimal commas), each TA's own
// download, and the assistant's calculators. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { emptyDoc, applyMarks } = await import('../src/lib/marking/doc.ts');
const { DEFAULT_TAS, withDefaultLoad, autoLink } = await import('../src/lib/marking/defaults.ts');
const { parseMarkingFile, readCsv } = await import('../src/lib/marking/xlsx-read.ts');
const { markingSheets, sheetToCsv } = await import('../src/lib/marking/export.ts');
const { HELPERS, suggest } = await import('../src/lib/marking/assistant.ts');
const { CRITERIA } = await import('../src/lib/marking/rubric.ts');

const full = { uc_actors: 1, uc_logic: 1.5, uc_mapping: 5, ad_reqs: 5, ad_flow: 2.5, ui_screens: 9, ar_pattern: 2, ar_impl: 2, ar_reason: 2 };
const enc = (s: string) => new TextEncoder().encode(s);

test('the default load is the team list: 4 TAs, 11 + 11 + 12 + 13 groups, every group 1–47 exactly once', () => {
  assert.deepEqual(DEFAULT_TAS.map((t) => [t.name, t.groups.length]), [['Amr', 11], ['Ramy', 11], ['Ali', 12], ['Youssef', 13]]);
  const all = DEFAULT_TAS.flatMap((t) => t.groups).sort((a, b) => a - b);
  assert.deepEqual(all, Array.from({ length: 47 }, (_, i) => i + 1));
  assert.ok(DEFAULT_TAS.find((t) => t.name === 'Youssef')!.groups.includes(47), 'group 47 (a later hand-in) is Youssef’s');
  assert.deepEqual(DEFAULT_TAS.find((t) => t.name === 'Amr')!.groups, [3, 5, 9, 12, 18, 20, 21, 30, 33, 39, 41]);
  const d = withDefaultLoad(emptyDoc());
  assert.equal(d.tas.length, 4);
  const saved = emptyDoc();
  saved.tas = [{ name: 'Someone', email: null, groups: [1] }];
  assert.equal(withDefaultLoad(saved).tas[0].name, 'Someone', 'a saved load is never replaced');
});

test('accounts are linked by first name only when exactly one staff account matches', () => {
  const tas = [
    { name: 'Amr', email: null, groups: [1] },
    { name: 'Ali', email: null, groups: [2] },
    { name: 'Ramy', email: null, groups: [3] },
    { name: 'Youssef', email: 'kept@uni.test', groups: [4] },
  ];
  const staff = [
    { name: 'Amr Hassan', email: 'amr@uni.test' },
    { name: 'Ali Kamal', email: 'ali1@uni.test' },
    { name: 'ali Samir', email: 'ali2@uni.test' },
    { name: 'Youssef E', email: 'youssef@uni.test' },
    { name: 'Eng. Ramy A', email: 'ramy@uni.test' },
  ];
  const out = autoLink(tas, staff);
  assert.equal(out[0].email, 'amr@uni.test');
  assert.equal(out[1].email, null, 'two staff called Ali: not guessed');
  assert.equal(out[2].email, 'ramy@uni.test', 'a title such as Eng. is skipped');
  assert.equal(out[3].email, 'kept@uni.test', 'a chosen account is kept');
  assert.equal(tas[0].email, null, 'the input is not changed');
});

test('CSV from Excel’s “Save as CSV”: three header rows, quoted comments with commas and line breaks, BOM', () => {
  const csv = '﻿Group,Assigned TA,Use Case Diagram,,,,Activity Diagram,,,UI Design & Implementation,Architecture / Design Pattern,,,,Total (/30),Total (/100),Grade,Comments\r\n'
    + ',,Actors,Correct logic,Mapping to functional reqs,Subtotal,Functional reqs included,Correct & logical flow,Subtotal,"Screens (1 each, 9 screens)",Pattern selected,Correct implementation in structure,Reasoning,Subtotal,,,,\r\n'
    + ',,1,1.5,5,7.5,5,2.5,7.5,9,2,2,2,6,,,,\r\n'
    + '3,TA One,1,0.7,5,6.7,5,2.4,7.4,8.5,1.5,1,1.5,4,26.6,88.67,A,"• Use case: one diagram, please.\r\n• Activity: fine ""as is""."\r\n'
    + '5,TA One,,,,0,,,0,,,,,0,0,0,,\r\n';
  const out = parseMarkingFile(enc(csv), 'phase1.csv');
  assert.deepEqual(out.rows.map((r) => r.group), [3, 5]);
  assert.deepEqual(out.rows[0].scores, { uc_actors: 1, uc_logic: 0.7, uc_mapping: 5, ad_reqs: 5, ad_flow: 2.4, ui_screens: 8.5, ar_pattern: 1.5, ar_impl: 1, ar_reason: 1.5 });
  assert.equal(out.rows[0].comment, '• Use case: one diagram, please.\n• Activity: fine "as is".');
  assert.deepEqual(out.rows[1].scores, {});
});

test('a simple CSV: one header row with the criteria names or ids; semicolons and decimal commas work', () => {
  const simple = 'group;actors;correct logic;mapping to functional reqs;ad_reqs;ad_flow;screens;pattern selected;correct implementation in structure;reasoning;comments\n12;1;1,5;4,5;5;2;9;2;2;1;Short reasoning\n';
  const out = parseMarkingFile(enc(simple), 'my-groups.csv');
  assert.equal(out.rows.length, 1);
  assert.deepEqual(out.rows[0].scores, { uc_actors: 1, uc_logic: 1.5, uc_mapping: 4.5, ad_reqs: 5, ad_flow: 2, ui_screens: 9, ar_pattern: 2, ar_impl: 2, ar_reason: 1 });
  assert.equal(out.rows[0].comment, 'Short reasoning');
  assert.equal(readCsv('a,b\n"x, y",2\n').cells.get('A2'), 'x, y');
});

test('each TA downloads their own groups (Excel or CSV) and the file reads back', async () => {
  const d = emptyDoc();
  d.tas = [{ name: 'TA One', email: 'one@uni.test', groups: [1, 3] }, { name: 'TA Two', email: null, groups: [2] }];
  applyMarks(d, { role: 'admin', email: 'a@uni.test', name: 'Admin' }, 1, { scores: full, comment: 'Done, well.\nNext time: tests.' }, []);
  const mine = markingSheets(d, [1, 2, 3], { ta: 'TA One' });
  assert.deepEqual(mine.map((s) => s.name), ['TA One']);
  assert.deepEqual(mine[0].rows.slice(3).map((r) => r[0]), [1, 3]);
  const back = parseMarkingFile(enc(sheetToCsv(mine[0])), 'TA One.csv');
  assert.deepEqual(back.rows.map((r) => r.group), [1, 3]);
  assert.deepEqual(back.rows[0].scores, full);
  assert.equal(back.rows[0].comment, 'Done, well.\nNext time: tests.');
});

test('the assistant’s calculators turn counts and choices into the rubric’s marks', () => {
  for (const c of CRITERIA) assert.ok(HELPERS[c.id] && HELPERS[c.id].length, `${c.id} has a calculator`);
  assert.equal(suggest('uc_actors', { missingRoles: 0 }), 1, 'one primary actor is enough (the brief)');
  assert.equal(suggest('uc_actors', { missingRoles: 1 }), 0.5, 'a role of the requirements with no actor');
  assert.equal(suggest('uc_actors', { noPrimary: true, missingRoles: 0 }), 0);
  assert.equal(suggest('uc_logic', { wrongNotation: true, problems: 0 }), 0, 'wrong notation = 0');
  assert.equal(suggest('uc_logic', { wrongNotation: false, problems: 1 }), 1);
  assert.equal(suggest('uc_mapping', { reqs: 6, mapped: 5 }), 4.17);
  assert.equal(suggest('uc_mapping', { reqs: 3, mapped: 3 }), 3, 'fewer than 5 requirements: counted out of 5');
  assert.equal(suggest('ad_reqs', { reqs: 5, covered: 4 }), 4);
  assert.equal(suggest('ad_flow', { problems: 2 }), 1.5);
  assert.equal(suggest('ad_flow', { problems: 9 }), 0, 'never below 0');
  assert.equal(suggest('ui_screens', { screens: 8, incorrect: 1 }), 7.5);
  assert.equal(suggest('ui_screens', { screens: 12, incorrect: 0 }), 9, 'never above the maximum');
  assert.equal(suggest('ar_pattern', { level: 'clear' }), 2);
  assert.equal(suggest('ar_impl', { level: 'partly' }), 1);
  assert.equal(suggest('ar_reason', { level: 'none' }), 0);
  assert.equal(suggest('ui_screens', {}), null, 'no answers: no suggestion');
});

const { explain, cleanAnswers } = await import('../src/lib/marking/assistant.ts');
const { cleanDoc, applyImport, groupNumber } = await import('../src/lib/marking/doc.ts');

test('the assistant writes one ready sentence per finding that costs marks', () => {
  assert.deepEqual(explain('ui_screens', { screens: 7, incorrect: 1 }), ['2 of the 9 screens are missing: each member implements 3 screens.', '1 screen does not match the requirements.']);
  assert.deepEqual(explain('uc_mapping', { reqs: 6, mapped: 5 }), ['1 of the 6 functional requirements has no use case in the diagram.']);
  assert.match(explain('uc_mapping', { reqs: 4, mapped: 4 })[0], /at least 5 functional requirements/);
  assert.deepEqual(explain('uc_logic', { wrongNotation: true, split: true }).length, 1, 'wrong notation: only that sentence');
  assert.deepEqual(explain('ar_pattern', { level: 'clear' }), [], 'full marks: nothing to say');
  assert.deepEqual(explain('ui_screens', { screens: 9, incorrect: 0, mainEmpty: true }).length, 1, 'a note with no deduction still has its sentence');
  assert.equal(suggest('ui_screens', { screens: 9, mainEmpty: true }), 9);
  assert.equal(suggest('ad_flow', { noStart: true, messy: true }), 1.7);
});

test('the assistant’s answers are saved with the marks, cleaned, and only for criteria that have a mark', () => {
  const d = emptyDoc();
  d.tas = [{ name: 'TA One', email: 'one@uni.test', groups: [1] }];
  const ta = { role: 'ta' as const, email: 'one@uni.test', name: 'TA One' };
  applyMarks(d, ta, 1, { scores: { ui_screens: 7.5 }, comment: '', help: { ui_screens: { screens: '8', incorrect: 1, evil: 'x' }, ad_flow: { problems: 2 }, nope: {} } }, []);
  assert.deepEqual(d.marks['1'].help, { ui_screens: { screens: 8, incorrect: 1 } });
  assert.deepEqual(cleanAnswers({ ar_impl: { level: 'maybe' }, uc_actors: { actors: -2, twice: 'yes' } }), {});
  assert.deepEqual(cleanDoc(JSON.parse(JSON.stringify(d))).marks['1'].help, { ui_screens: { screens: 8, incorrect: 1 } });
});

test('a file fills marks but never clears them: empty cells keep the saved marks and comment', () => {
  const d = emptyDoc();
  d.tas = [{ name: 'TA One', email: 'one@uni.test', groups: [1, 2] }];
  const ta = { role: 'ta' as const, email: 'one@uni.test', name: 'TA One' };
  applyMarks(d, ta, 1, { scores: full, comment: 'Saved comment.', help: { ui_screens: { screens: 9 }, uc_actors: { missingRoles: 0 } } }, []);
  const out = applyImport(d, ta, [{ group: 1, scores: { ui_screens: 8 }, comment: '' }, { group: 2, scores: { uc_actors: 1 } }], () => []);
  assert.deepEqual(out.imported, [1, 2]);
  assert.deepEqual(d.marks['1'].scores, { ...full, ui_screens: 8 });
  assert.equal(d.marks['1'].comment, 'Saved comment.');
  assert.deepEqual(d.marks['1'].help, { uc_actors: { missingRoles: 0 } }, 'answers for a mark the file changed are dropped');
  assert.deepEqual(d.marks['2'].scores, { uc_actors: 1 });
});

test('group numbers can be written 12, "12", "G12" or "Group 12"', () => {
  assert.deepEqual([12, '12', 'G12', 'g 7', 'Group 3', 'group #4', 'Gx', '', 0, 1.5].map(groupNumber), [12, 12, 12, 7, 3, 4, null, null, null, null]);
});

test('the upload warns about values it changed or could not read, and about a group written twice', () => {
  const csv = 'Group,Actors,Screens,Reasoning,Comments\n1,2,10,abc,ok\n1,1,9,2,again\nG2,1,-1,2,\n';
  const out = parseMarkingFile(enc(csv), 'mine.csv');
  assert.deepEqual(out.rows.map((r) => r.group), [1, 2]);
  assert.deepEqual(out.rows[0].scores, { uc_actors: 1, ui_screens: 9 });
  assert.equal(out.rows[0].comment, 'ok');
  assert.ok(out.warnings.some((w) => /group 1 has two rows/.test(w)), 'duplicate');
  assert.ok(out.warnings.some((w) => /Actors: 2 is more than 1, read as 1/.test(w)), 'clamped');
  assert.ok(out.warnings.some((w) => /Reasoning: “abc” is not a number/.test(w)), 'text');
  assert.ok(out.warnings.some((w) => /Screens \(1 each, 9 screens\): -1 is below 0, read as 0/.test(w)), 'negative');
});

test('CSV keeps comments that start like a formula, and old .xls files get a clear message', () => {
  const d = emptyDoc();
  d.tas = [{ name: 'TA One', email: null, groups: [1] }];
  applyMarks(d, { role: 'admin', email: 'a@uni.test', name: 'Admin' }, 1, { scores: full, comment: '- Missing screens\n=check' }, []);
  const csv = sheetToCsv(markingSheets(d, [1], { ta: 'TA One' })[0]);
  assert.ok(csv.includes(`"'- Missing screens`), 'escaped for Excel');
  assert.equal(parseMarkingFile(enc(csv), 'x.csv').rows[0].comment, '- Missing screens\n=check');
  assert.throws(() => parseMarkingFile(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0]), 'old.xls'), /old Excel file \(\.xls\)/);
  assert.deepEqual(markingSheets(d, [1], { ta: 'Nobody' }), [], 'unknown TA: no sheet');
});
