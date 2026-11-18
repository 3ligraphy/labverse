// Admin → Marking (Phase 1): the rubric's totals and grades, who may edit which group, importing a workbook
// (only the uploader's groups), members that changed after marking, and the group-number lock.
// Synthetic data only: no real marks, names or student IDs in this public repo.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { CRITERIA, SECTIONS, cleanScore, totals, gradeOf } = await import('../src/lib/marking/rubric.ts');
const { emptyDoc, cleanDoc, canEdit, myRow, applyMarks, applyImport, memberChanges, renumbered, loadFromRows } = await import('../src/lib/marking/doc.ts');

const full = { uc_actors: 1, uc_logic: 1.5, uc_mapping: 5, ad_reqs: 5, ad_flow: 2.5, ui_screens: 9, ar_pattern: 2, ar_impl: 2, ar_reason: 2 };

test('the rubric is the sheet: 9 criteria, 4 sections, 30 marks', () => {
  assert.equal(CRITERIA.length, 9);
  assert.deepEqual(SECTIONS.map((s) => [s.id, s.max]), [['uc', 7.5], ['ad', 7.5], ['ui', 9], ['ar', 6]]);
  assert.equal(CRITERIA.reduce((a, c) => a + c.max, 0), 30);
  for (const s of SECTIONS) assert.equal(CRITERIA.filter((c) => c.section === s.id).reduce((a, c) => a + c.max, 0), s.max);
});

test('totals: subtotals, /30, /100 and the grade bands', () => {
  const t = totals(full);
  assert.deepEqual(t.sections, { uc: 7.5, ad: 7.5, ui: 9, ar: 6 });
  assert.equal(t.total, 30);
  assert.equal(t.percent, 100);
  assert.equal(t.grade, 'A');
  assert.equal(t.missing.length, 0);
  const some = totals({ uc_actors: 0.5, uc_logic: 1, uc_mapping: 4, ad_reqs: 3, ad_flow: 1.5, ui_screens: 6, ar_pattern: 1, ar_impl: 1, ar_reason: 0.5 });
  assert.equal(some.total, 18.5);
  assert.equal(some.percent, 61.67);
  assert.equal(some.grade, 'B');
  assert.deepEqual([70, 69.99, 60, 50, 40, 39.99].map(gradeOf), ['A', 'B', 'B', 'C', 'D', 'F']);
  const none = totals({});
  assert.equal(none.grade, '', 'no grade before any mark');
  assert.equal(none.missing.length, 9);
});

test('a mark is clamped to 0…max with 2 decimals; text and blanks are no mark', () => {
  assert.equal(cleanScore(7, 5), 5);
  assert.equal(cleanScore(-1, 5), 0);
  assert.equal(cleanScore(4.555, 5), 4.56);
  assert.equal(cleanScore('2,5', 5), 2.5);
  assert.equal(cleanScore('', 5), null);
  assert.equal(cleanScore('abc', 5), null);
  assert.equal(cleanScore(null, 5), null);
});

const doc = () => {
  const d = emptyDoc();
  d.source = 'file-1';
  d.tas = [
    { name: 'TA One', email: 'one@uni.test', groups: [1, 3] },
    { name: 'TA Two', email: 'two@uni.test', groups: [2] },
    { name: 'TA Three', email: null, groups: [4] },
  ];
  return d;
};

test('who may edit: every TA and admin, every group (the load only decides “My groups”)', () => {
  const d = doc();
  assert.equal(canEdit({ role: 'admin', email: 'x@uni.test' }, d, 2), true);
  assert.equal(canEdit({ role: 'ta', email: 'one@uni.test' }, d, 3), true);
  assert.equal(canEdit({ role: 'ta', email: 'one@uni.test' }, d, 2), true, 'another TA’s group');
  assert.equal(canEdit({ role: 'ta', email: 'nobody@uni.test' }, d, 1), true, 'a TA not linked to a row too');
  assert.equal(canEdit({ role: 'none', email: 'one@uni.test' }, d, 1), false);
  assert.equal(myRow(d, 'ONE@uni.test')?.name, 'TA One', 'emails are compared without case');
});

test('saving marks keeps the members, cleans the values, records everyone who saved, and refuses non-staff', () => {
  const d = doc();
  const one = { role: 'ta' as const, email: 'one@uni.test', name: 'TA One' };
  const two = { role: 'ta' as const, email: 'two@uni.test', name: 'TA Two' };
  const r = applyMarks(d, one, 1, { scores: { ...full, uc_mapping: 9 }, comment: '  Good work.  ' }, ['S1', 'S2']);
  assert.equal(r.ok, true);
  const m = d.marks['1'];
  assert.equal(m.scores.uc_mapping, 5, 'clamped to the maximum');
  assert.equal(m.comment, 'Good work.');
  assert.deepEqual(m.members, ['S1', 'S2']);
  assert.equal(m.by, 'TA One');
  assert.deepEqual(m.editors, ['TA One']);
  // another TA updates the same group: both are part of its marking, the last one is `by`
  assert.equal(applyMarks(d, two, 1, { scores: full, comment: 'Updated.' }, ['S1', 'S2']).ok, true);
  assert.equal(d.marks['1'].by, 'TA Two');
  assert.deepEqual(d.marks['1'].editors, ['TA One', 'TA Two']);
  applyMarks(d, one, 1, { scores: full, comment: 'Again.' }, ['S1', 'S2']);
  assert.deepEqual(d.marks['1'].editors, ['TA One', 'TA Two'], 'a name is listed once');
  // marks saved before editors were kept start from the one who saved them
  d.marks['3'] = { scores: full, comment: '', by: 'Old TA', at: '', members: [] };
  applyMarks(d, two, 3, { scores: full }, []);
  assert.deepEqual(d.marks['3'].editors, ['Old TA', 'TA Two']);
  const refused = applyMarks(d, { role: 'none', email: 'one@uni.test', name: 'Student' }, 2, { scores: full, comment: '' }, []);
  assert.equal(refused.ok, false);
  assert.equal(d.marks['2'], undefined);
});

test('importing a workbook: any TA imports every group; rows with no marks are skipped', () => {
  const rows = [
    { group: 1, ta: 'TA One', scores: full, comment: 'One' },
    { group: 2, ta: 'TA Two', scores: full, comment: 'Two' },
    { group: 3, ta: 'TA One', scores: {}, comment: '' },
  ];
  const d = doc();
  const asTa = applyImport(d, { role: 'ta', email: 'one@uni.test', name: 'TA One' }, rows, () => ['S1']);
  assert.deepEqual(asTa.imported, [1, 2]);
  assert.deepEqual(asTa.skipped.map((s) => s.group), [3]);
  assert.match(asTa.skipped[0].reason, /no marks/);
  assert.equal(d.marks['2'].by, 'TA One', 'the import records who made it');
  const d2 = doc();
  const none = applyImport(d2, { role: 'none', email: 'x@uni.test', name: 'X' }, rows, () => []);
  assert.deepEqual(none.imported, []);
  assert.match(none.skipped[0].reason, /Only TAs and admins/);
});

test('the load comes from the workbook’s Assigned TA column', () => {
  const d = emptyDoc();
  loadFromRows(d, [{ group: 3, ta: 'Amr' }, { group: 1, ta: 'Ali' }, { group: 5, ta: 'Amr' }, { group: 2, ta: '' }]);
  assert.deepEqual(d.tas.map((t) => [t.name, t.groups]), [['Ali', [1]], ['Amr', [3, 5]]]);
  // linked accounts are kept when the load is loaded again
  d.tas[1].email = 'amr@uni.test';
  loadFromRows(d, [{ group: 3, ta: 'Amr' }, { group: 9, ta: 'Amr' }]);
  assert.equal(d.tas.find((t) => t.name === 'Amr')!.email, 'amr@uni.test');
  assert.deepEqual(d.tas.find((t) => t.name === 'Amr')!.groups, [3, 9]);
});

test('a group whose members changed after it was marked is flagged', () => {
  const d = doc();
  applyMarks(d, { role: 'admin', email: 'a@uni.test', name: 'Admin' }, 1, { scores: full, comment: '' }, ['S1', 'S2']);
  const same = memberChanges(d, [{ number: 1, members: ['S2', 'S1'] }]);
  assert.deepEqual(same, []);
  const moved = memberChanges(d, [{ number: 1, members: ['S1', 'S3'] }]);
  assert.deepEqual(moved, [{ group: 1, added: ['S3'], removed: ['S2'] }]);
});

test('renumbering is spotted: any hand-in that would move to another group number', () => {
  const before = new Map([['e1', 'G1'], ['e2', 'G2']]);
  assert.equal(renumbered(before, new Map([['e1', 'G1'], ['e2', 'G2'], ['e3', 'G3']])), false, 'a new hand-in is not a renumber');
  assert.equal(renumbered(before, new Map([['e1', 'G2'], ['e2', 'G1']])), true);
});

test('a stored document is cleaned: unknown criteria dropped, values clamped, broken input gives an empty document', () => {
  const d = cleanDoc({ v: 1, source: 'f', tas: [{ name: 'A', email: 'A@X.TEST', groups: [3, '4', 'x'] }], marks: { '3': { scores: { uc_actors: 5, hack: 1 }, comment: 'c', by: 'b', at: 't', members: ['S1'] } }, published: 'yes' });
  assert.deepEqual(d.tas[0], { name: 'A', email: 'a@x.test', groups: [3, 4] });
  assert.deepEqual(d.marks['3'].scores, { uc_actors: 1 });
  assert.equal(d.published, false);
  assert.deepEqual(cleanDoc('nonsense'), emptyDoc());
});

/* ------------------------------------------------------------------ reading the marking workbook */

const { buildXlsx, zip } = await import('../src/lib/xlsx.ts');
const { readWorkbook, parseMarkingWorkbook } = await import('../src/lib/marking/xlsx-read.ts');

const HEAD = [
  ['Group', 'Assigned TA', 'Use Case Diagram', null, null, null, 'Activity Diagram', null, null, 'UI Design & Implementation', 'Architecture / Design Pattern', null, null, null, 'Total (/30)', 'Total (/100)', 'Grade', 'Comments'],
  [null, null, 'Actors', 'Correct logic', 'Mapping to functional reqs', 'Subtotal', 'Functional reqs included', 'Correct & logical flow', 'Subtotal', 'Screens (1 each, 9 screens)', 'Pattern selected', 'Correct implementation in structure', 'Reasoning', 'Subtotal', null, null, null, null],
  [null, null, 1, 1.5, 5, 7.5, 5, 2.5, 7.5, 9, 2, 2, 2, 6, null, null, null, null],
];
const row = (g: number, ta: string, m: (number | null)[], comment = '') => [g, ta, m[0], m[1], m[2], null, m[3], m[4], null, m[5], m[6], m[7], m[8], null, null, null, null, comment];

test('the workbook: TA sheets first, the final sheet only for groups no TA sheet has, notes rows ignored', async () => {
  const bytes = await buildXlsx([
    { name: 'Phase 1 Marks', rows: [...HEAD, row(1, 'TA One', [null, null, null, null, null, null, null, null, null]), row(2, 'TA Two', [1, 1, 4, 5, 2, 8, 2, 1, 1], 'From the final sheet'), row(3, 'TA One', [null, null, null, null, null, null, null, null, null]), [], ['FINAL SHEET. Notes, not a group.']] },
    { name: 'TA One', rows: [...HEAD, row(1, 'TA One', [0.5, 1.2, 5, 5, 2.4, 8.5, 1.5, 1, 1.5], 'Good diagram.\nFix the arrows.'), row(3, 'TA One', [null, null, null, null, null, null, null, null, null])] },
    { name: 'TA Summary', rows: [['TA', 'Groups'], ['TA One', 2]] },
  ]);
  const out = parseMarkingWorkbook(bytes);
  assert.deepEqual(out.rows.map((r) => [r.group, r.ta, r.sheet]), [[1, 'TA One', 'TA One'], [2, 'TA Two', 'Phase 1 Marks'], [3, 'TA One', 'TA One']]);
  assert.deepEqual(out.rows[0].scores, { uc_actors: 0.5, uc_logic: 1.2, uc_mapping: 5, ad_reqs: 5, ad_flow: 2.4, ui_screens: 8.5, ar_pattern: 1.5, ar_impl: 1, ar_reason: 1.5 });
  assert.equal(out.rows[0].comment, 'Good diagram.\nFix the arrows.');
  assert.deepEqual(out.rows[2].scores, {}, 'an empty row has no marks');
});

test('Excel’s own format: shared strings (with rich text), formulas with cached values, entities and line breaks', () => {
  const enc = (s: string) => new TextEncoder().encode(s);
  const strings = ['Group', 'Assigned TA', 'Actors', 'Correct logic', 'Mapping to functional reqs', 'Comments', 'TA One'];
  const sst = `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${strings.map((s) => `<si><t>${s}</t></si>`).join('')}<si><r><t>• First &amp; best</t></r><r><t xml:space="preserve">&#10;• Second</t></r></si></sst>`;
  const sheet = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="R1" t="s"><v>5</v></c></row>
    <row r="2"><c r="C2" t="s"><v>2</v></c><c r="D2" t="s"><v>3</v></c><c r="E2" t="s"><v>4</v></c></row>
    <row r="4"><c r="A4"><v>7</v></c><c r="B4" t="s"><v>6</v></c><c r="C4"><v>1</v></c><c r="D4"><v>0.7</v></c><c r="E4"><v>4.55</v></c><c r="F4"><f>SUM(C4:E4)</f><v>6.25</v></c><c r="Q4" t="str"><f>IF(P4&gt;=70,"A","B")</f><v>A</v></c><c r="R4" t="s"><v>7</v></c></row>
  </sheetData></worksheet>`;
  const wb = `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="TA One" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const rels = `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
  const bytes = zip([
    { name: 'xl/workbook.xml', data: enc(wb) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc(rels) },
    { name: 'xl/sharedStrings.xml', data: enc(sst) },
    { name: 'xl/worksheets/sheet1.xml', data: enc(sheet) },
  ]);
  const sheets = readWorkbook(bytes);
  assert.equal(sheets[0].name, 'TA One');
  assert.equal(sheets[0].cells.get('F4'), 6.25, 'a formula gives its cached value');
  const out = parseMarkingWorkbook(bytes);
  assert.equal(out.rows.length, 1);
  assert.equal(out.rows[0].group, 7);
  assert.equal(out.rows[0].ta, 'TA One');
  assert.deepEqual(out.rows[0].scores, { uc_actors: 1, uc_logic: 0.7, uc_mapping: 4.55 });
  assert.equal(out.rows[0].comment, '• First & best\n• Second');
});

test('a file that is not a marking workbook says so', async () => {
  assert.throws(() => parseMarkingWorkbook(new TextEncoder().encode('not a zip')), /Excel/);
  const other = await buildXlsx([{ name: 'Sheet1', rows: [['Name', 'Score'], ['x', 1]] }]);
  const out = parseMarkingWorkbook(other);
  assert.equal(out.rows.length, 0);
  assert.match(out.warnings.join(' '), /No sheet/);
});

/* ------------------------------------------------------------------ the merged download, and the assistant */

const { markingSheets } = await import('../src/lib/marking/export.ts');
const { RULES, HELPERS } = await import('../src/lib/marking/assistant.ts');

test('the download: final sheet + one sheet per TA + summary, and it reads back to the same marks', async () => {
  const d = doc();
  applyMarks(d, { role: 'admin', email: 'a@uni.test', name: 'Admin' }, 1, { scores: full, comment: 'All good.\nKeep going.' }, []);
  applyMarks(d, { role: 'admin', email: 'a@uni.test', name: 'Admin' }, 2, { scores: { ...full, ui_screens: 6 }, comment: '' }, []);
  const sheets = markingSheets(d, [1, 2, 3, 4]);
  assert.deepEqual(sheets.map((s) => s.name), ['Phase 1 Marks', 'TA One', 'TA Two', 'TA Three', 'TA Summary']);
  const final = sheets[0].rows;
  const g1 = final.find((r) => r[0] === 1)!;
  assert.deepEqual(g1.slice(14, 17), [30, 100, 'A'], 'total /30, /100 and grade');
  const bytes = await buildXlsx(sheets);
  const back = parseMarkingWorkbook(bytes);
  assert.deepEqual(back.rows.find((r) => r.group === 1)!.scores, full);
  assert.equal(back.rows.find((r) => r.group === 1)!.comment, 'All good.\nKeep going.');
  assert.equal(back.rows.find((r) => r.group === 2)!.scores.ui_screens, 6);
  assert.deepEqual(back.rows.find((r) => r.group === 3)!.scores, {}, 'a group with no marks stays empty');
  const summary = sheets[4].rows;
  assert.deepEqual(summary[1], ['TA One', 2, 100, 1], 'TA, groups, average % of marked groups, marked');
});

test('the assistant: a rule and questions for every criterion; every yes / no finding has a fair deduction and a sentence', () => {
  for (const c of CRITERIA) {
    assert.ok(RULES[c.id] && RULES[c.id].length > 10, `${c.id} has its rule`);
    assert.ok(HELPERS[c.id].length >= 1, `${c.id} has questions`);
    for (const q of HELPERS[c.id]) {
      if (q.kind === 'yes') {
        assert.ok(q.deduction >= 0 && q.deduction <= c.max, `${c.id}.${q.key} deduction within the criterion`);
        assert.ok(q.sentence.length > 15, `${c.id}.${q.key} has a ready sentence`);
      }
    }
  }
});
