import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../src/lib/progress/store.ts';
import { buildRegister, levelFor, weekEnd, weekKey, weekStart } from '../src/lib/attendance/weekly.ts';
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

/**
 * A store with one TA session a week for `weeks` weeks; `present[w]` lists who joined and checked in that week.
 * Everyone joins the permanent "Open lab" session first: that puts them on the roster but is not attendance.
 */
async function setup(weeks: number, present: string[][]) {
  let t = Date.parse('2026-10-11T08:00:00Z'); // Sunday
  const store = new MemoryStore(() => t);
  const people = ['231001', '231002', '231003'];
  for (const id of people) await store.touchStudent({ studentKey: id, studentId: id, name: `Student ${id}`, deviceKey: null } as never);
  const open = await store.permanentSession('lab-02');
  for (const id of people) await store.joinSession(open.id, id, 'G1');
  for (let w = 0; w < weeks; w++) {
    t = Date.parse('2026-10-11T08:00:00Z') + w * 7 * 86_400_000;
    const s = await store.openSession('lab-02', 90, 'TA Mona', 'Sun 10:00');
    for (const id of present[w] ?? []) { await store.joinSession(s.id, id, 'G1'); await store.checkIn(id, 'lab-02', s.id); }
  }
  return store;
}

test('joining a TA session counts as present even without a check-in (weeks before check-in was used)', async () => {
  let t = Date.parse('2026-10-06T07:00:00Z'); // Tue 6 Oct, week of Sat 3 Oct
  const store = new MemoryStore(() => t);
  for (const id of ['231001', '231002']) await store.touchStudent({ studentKey: id, studentId: id, name: `Student ${id}`, deviceKey: null } as never);
  const s = await store.openSession('lab-02', 120, 'Ramy', 'Tue 09:00');
  await store.joinSession(s.id, '231001', 'G1'); // joined, never checked in
  const open = await store.permanentSession('lab-02');
  t += 3_600_000;
  await store.joinSession(open.id, '231002', 'G1'); // opened the lab on their own: not attendance
  const reg = buildRegister(await store.attendanceRaw(['lab-02']), [], new Map(), Date.parse('2026-11-14T12:00:00Z'));
  assert.equal(reg.weeks.length, 1);
  const by = new Map(reg.students.map((x) => [x.id, x.cells[reg.weeks[0].key].status]));
  assert.equal(by.get('231001'), 'present');
  assert.equal(by.get('231002'), 'absent');
  assert.equal(reg.weeks[0].sessions.find((x) => x.id === s.id)?.checkedIn, 1);
});

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
  // both permanent sessions are offered in week 2 (staff can mark someone present in either); only lab-03 was attended
  assert.deepEqual(reg.weeks[1].sessions.map((s) => [s.lab, s.checkedIn]), [['lab-02', 0], ['lab-03', 1]]);
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

test('xlsx zip uses the layout Excel accepts: deflate, sizes in headers, no data descriptors', async () => {
  const { zip } = await import('../src/lib/xlsx.ts');
  const { inflateRawSync } = await import('node:zlib');
  const text = 'hello <x/> ' + 'é'.repeat(50);
  const out = zip([{ name: 'a/b.xml', data: new TextEncoder().encode(text) }]);
  const v = new DataView(out.buffer);
  assert.equal(v.getUint32(0, true), 0x04034b50);
  assert.equal(v.getUint16(6, true), 0x0800); // UTF-8 names, no data-descriptor bit (0x0008)
  assert.equal(v.getUint16(8, true), 8); // deflate
  const size = v.getUint32(18, true), nameLen = v.getUint16(26, true);
  assert.equal(new TextDecoder().decode(inflateRawSync(out.subarray(30 + nameLen, 30 + nameLen + size))), text);
  assert.equal(Buffer.from(out).indexOf(Buffer.from([0x50, 0x4b, 0x07, 0x08])), -1);
  assert.equal(v.getUint32(out.length - 22, true), 0x06054b50); // end of central directory
});

test('a lab that runs over two weeks in one permanent session counts each week it was attended', async () => {
  let t = Date.parse('2026-11-10T08:00:00Z'); // Tue 10 Nov, week of Sat 7 Nov
  const store = new MemoryStore(() => t);
  for (const id of ['231001', '231002']) await store.touchStudent({ studentKey: id, studentId: id, name: `Student ${id}`, deviceKey: null } as never);
  const open = await store.permanentSession('lab-05');
  for (const id of ['231001', '231002']) { await store.joinSession(open.id, id, 'G1'); await store.checkIn(id, 'lab-05', open.id); }
  t = Date.parse('2026-11-17T08:00:00Z'); // Tue 17 Nov, the next week: same lab, same session
  assert.equal(await store.checkinSince(open.id, '231001', new Date(weekStart('2026-11-14')).toISOString()), null); // not yet this week
  const again = await store.checkIn('231001', 'lab-05', open.id);
  assert.equal(again, new Date(t).toISOString()); // a new check-in, not last week's
  assert.equal(await store.checkinSince(open.id, '231001', new Date(weekStart('2026-11-14')).toISOString()), again);
  const reg = buildRegister(await store.attendanceRaw(['lab-05']), [], new Map(), Date.parse('2026-11-25T12:00:00Z'));
  assert.deepEqual(reg.weeks.map((w) => w.key), ['2026-11-07', '2026-11-14']);
  const by = new Map(reg.students.map((s) => [s.id, s]));
  assert.equal(by.get('231001')!.attended, 2);
  assert.equal(by.get('231002')!.cells['2026-11-14'].status, 'absent');
  assert.equal(by.get('231002')!.absences, 1);
});

test('staff can mark a student present in a past week of a permanent session', async () => {
  let t = Date.parse('2026-11-10T08:00:00Z');
  const store = new MemoryStore(() => t);
  await store.touchStudent({ studentKey: '231003', studentId: '231003', name: 'Student 231003', deviceKey: null } as never);
  const open = await store.permanentSession('lab-05');
  await store.joinSession(open.id, '231003', 'G1');
  await store.checkIn('231003', 'lab-05', open.id); // week of 7 Nov
  t = Date.parse('2026-11-25T08:00:00Z'); // two weeks later, staff fix the week of 14 Nov
  const at = await store.addManualAttendance('lab-05', open.id, { studentKey: '231003', studentId: '231003', name: 'Student 231003' }, new Date(weekStart('2026-11-14') + 36 * 3_600_000).toISOString());
  assert.equal(weekKey(at!), '2026-11-14');
  const reg = buildRegister(await store.attendanceRaw(['lab-05']), [], new Map(), t);
  assert.equal(reg.students[0].cells['2026-11-14'].status, 'present');
  assert.equal(reg.students[0].attended, 2);
});
