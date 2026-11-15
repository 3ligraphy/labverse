import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../src/lib/progress/store.ts';
import { buildRegister, levelFor, weekEnd, weekKey } from '../src/lib/attendance/weekly.ts';
import { registerSheets, registerWorkbook } from '../src/lib/attendance/workbook.ts';
import { colName, sheetNames } from '../src/lib/xlsx.ts';

test('warning levels: 2 absences = Warning 1, 3 = Warning 2, 4+ = Barred', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 7].map(levelFor), [0, 0, 1, 2, 3, 3]);
});

test('weeks run Saturday to Friday in Cairo time', () => {
  // Fri 2026-10-16 23:30 Cairo (UTC+3 → 20:30Z) is still the week of Sat 10 Oct
  assert.equal(weekKey('2026-10-16T20:30:00Z'), '2026-10-10');
  // Sat 2026-10-17 00:30 Cairo (21:30Z on the 16th) starts the next week
  assert.equal(weekKey('2026-10-16T21:30:00Z'), '2026-10-17');
  assert.equal(weekKey('2026-10-13T09:00:00Z'), '2026-10-10');
  // the week of 10 Oct ends at Sat 17 Oct 00:00 Cairo
  assert.equal(new Date(weekEnd('2026-10-10')).toISOString(), '2026-10-16T21:00:00.000Z');
});

/** A store with one session a week for `weeks` weeks; `present[w]` lists who checked in that week. */
async function setup(weeks: number, present: string[][]) {
  let t = Date.parse('2026-10-11T08:00:00Z'); // Sunday
  const store = new MemoryStore(() => t);
  const people = ['231001', '231002', '231003'];
  for (const id of people) await store.touchStudent({ studentKey: id, studentId: id, name: `Student ${id}`, deviceKey: null } as never);
  for (let w = 0; w < weeks; w++) {
    t = Date.parse('2026-10-11T08:00:00Z') + w * 7 * 86_400_000;
    const s = await store.openSession('lab-02', 90, 'TA Mona', 'Sun 10:00');
    for (const id of people) await store.joinSession(s.id, id, 'G1');
    for (const id of present[w] ?? []) await store.checkIn(id, 'lab-02', s.id);
  }
  return store;
}

test('register counts weekly absences once the week is over and assigns warnings', async () => {
  const store = await setup(5, [['231001', '231002'], ['231001'], ['231001'], ['231001'], []]);
  const raw = await store.attendanceRaw(['lab-02']);
  const now = Date.parse('2026-11-14T12:00:00Z'); // week 5 (Sat 7 Nov) is over
  const reg = buildRegister(raw, [], new Map([['lab-02', 'Lab 02']]), now);
  assert.equal(reg.weeks.length, 5);
  assert.ok(reg.weeks.every((w) => w.over));
  const by = new Map(reg.students.map((s) => [s.id, s]));
  assert.equal(by.get('231001')!.absences, 1);
  assert.equal(by.get('231001')!.status, 'Good standing');
  assert.equal(by.get('231002')!.absences, 4);
  assert.equal(by.get('231002')!.status, 'Barred');
  assert.equal(by.get('231003')!.absences, 5);
  assert.equal(reg.totals.barred, 2);
  assert.equal(reg.students[0].level, 3); // most serious first
});

test('the current week is pending, and excused absences do not count', async () => {
  const store = await setup(3, [['231001'], [], []]);
  const raw = await store.attendanceRaw(['lab-02']);
  const now = Date.parse('2026-10-27T12:00:00Z'); // inside week 3
  await store.setExcuse({ module: 'mobile-development', week: '2026-10-17', studentKey: '231002', note: 'Medical', by: 'Dr X' });
  const reg = buildRegister(raw, await store.listExcuses('mobile-development'), new Map(), now);
  const s2 = reg.students.find((s) => s.id === '231002')!;
  assert.equal(s2.cells['2026-10-24'].status, 'pending');
  assert.equal(s2.cells['2026-10-17'].status, 'excused');
  assert.equal(s2.absences, 1);
  assert.equal(s2.level, 0);
  const s3 = reg.students.find((s) => s.id === '231003')!;
  assert.equal(s3.absences, 2);
  assert.equal(s3.status, 'Warning 1');
  await store.clearExcuse('mobile-development', '2026-10-17', '231002');
  assert.equal((await store.listExcuses('mobile-development')).length, 0);
});

test('sessions off: permanent lab sessions count by check-in time, not by when they were opened', async () => {
  let t = Date.parse('2026-10-11T08:00:00Z'); // week of Sat 10 Oct
  const store = new MemoryStore(() => t);
  for (const id of ['231001', '231002']) await store.touchStudent({ studentKey: id, studentId: id, name: `Student ${id}`, deviceKey: null } as never);
  const lab2 = await store.permanentSession('lab-02');
  const lab3 = await store.permanentSession('lab-03'); // made in week 1, used in week 2
  for (const s of [lab2, lab3]) for (const id of ['231001', '231002']) await store.joinSession(s.id, id, 'G1');
  await store.checkIn('231001', 'lab-02', lab2.id);
  await store.checkIn('231002', 'lab-02', lab2.id);
  t = Date.parse('2026-10-19T08:00:00Z'); // week of Sat 17 Oct
  await store.checkIn('231001', 'lab-03', lab3.id);
  const reg = buildRegister(await store.attendanceRaw(['lab-02', 'lab-03']), [], new Map(), Date.parse('2026-11-14T12:00:00Z'));
  assert.deepEqual(reg.weeks.map((w) => w.key), ['2026-10-10', '2026-10-17']);
  assert.deepEqual(reg.weeks[1].sessions.map((s) => [s.lab, s.checkedIn]), [['lab-03', 1]]);
  const s2 = reg.students.find((s) => s.id === '231002')!;
  assert.equal(s2.cells['2026-10-10'].status, 'present');
  assert.equal(s2.cells['2026-10-17'].status, 'absent');
  assert.equal(reg.students.find((s) => s.id === '231001')!.attended, 2);
});

test('sessions created but never opened are not teaching weeks', async () => {
  const store = new MemoryStore(() => Date.parse('2026-10-11T08:00:00Z'));
  await store.createSession('lab-02', 'TA', 'Sun');
  const reg = buildRegister(await store.attendanceRaw(['lab-02']), [], new Map());
  assert.equal(reg.weeks.length, 0);
});

test('workbook: summary, warnings, a sheet per week and sessions; valid zip', async () => {
  const store = await setup(2, [['231001'], []]);
  const reg = buildRegister(await store.attendanceRaw(['lab-02']), [], new Map(), Date.parse('2026-11-14T12:00:00Z'));
  const sheets = registerSheets(reg, { module: 'Mobile Development' });
  assert.deepEqual(sheets.map((s) => s.name), ['Summary', 'Warnings', 'Week 1 10 Oct', 'Week 2 17 Oct', 'Sessions']);
  assert.equal(sheets[1].rows.length, 1 + 2); // header + two students on Warning 1
  const file = await registerWorkbook(reg, { module: 'Mobile Development' });
  assert.deepEqual([...file.slice(0, 2)], [0x50, 0x4b]); // "PK"
  assert.ok(file.length > 1000);
});

test('xlsx helpers', () => {
  assert.deepEqual([0, 25, 26, 701].map(colName), ['A', 'Z', 'AA', 'ZZ']);
  assert.deepEqual(sheetNames(['A/B', 'a/b', 'x'.repeat(40)]), ['A B', 'a b 2', 'x'.repeat(31)]);
});
