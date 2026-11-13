/**
 * POST /api/attendance — a student checks in with { name, studentId, deviceId, lab? } (Lab 5 teaches calling it).
 * The check-in is saved as the lab's attendance (default: Lab 5) in the course database, the same list TAs see.
 *   201 { ok: true, entry }                first check-in
 *   200 { ok: true, already: true, entry } this student ID was already checked in (that is what they wanted)
 *   400 { error: 'invalid', errors }       bad name or student ID
 *   403 { error: 'locked' }                staff locked this module's labs
 *   429 { error: 'slow-down' }             too many tries in a few minutes
 *   503 { error: 'closed' }                no database connected
 * Open to any page (CORS), see src/lib/attendance/api.ts.
 */
import type { APIRoute } from 'astro';
import { validateCheckIn } from '@/lib/attendance/core';
import { getStore } from '@/lib/attendance/server';
import { ATTENDANCE_LAB, apiJson as json, preflight } from '@/lib/attendance/api';
import { LOCKED_MESSAGE, getProgressStore, getStructures, labLocked, liveSession, sessionScope } from '@/lib/progress/server';
import { OUTAGE } from '@/lib/outage';
import { databaseDown } from '@/lib/outage-server';

export const prerender = false;

const WINDOW_SEC = 10 * 60;

export const OPTIONS: APIRoute = () => preflight();

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
    if (!body || typeof body !== 'object') throw new Error('not an object');
  } catch {
    return json({ error: 'bad-request', message: 'The body must be JSON: { "name": "…", "studentId": "…", "deviceId": "…" }' }, 400);
  }

  const v = validateCheckIn(body);
  if (!v.ok) return json({ error: 'invalid', errors: v.errors }, 400);

  const progress = getProgressStore();
  if (progress) {
    try {
      const labs = await getStructures();
      const asked = typeof body.lab === 'string' ? body.lab : '';
      const lab = labs.some((l) => l.lab === asked) ? asked : ATTENDANCE_LAB;
      if (await labLocked(lab)) return json({ error: 'locked', message: LOCKED_MESSAGE }, 403);
      const studentKey = v.studentId.toLowerCase();
      if ((await progress.hit(`attendance:${studentKey}`, WINDOW_SEC)) > 30) {
        return json({ error: 'slow-down', message: 'Too many check-in attempts. Wait a few minutes.' }, 429);
      }
      // sessions are off: the lab's permanent session (the same one the lab page puts the student in)
      const session = await liveSession(progress, lab, '');
      if (!session) return json({ error: 'closed', message: 'Attendance is not open for this lab.' }, 503);
      await progress.touchStudent({ name: v.name, studentId: v.studentId, deviceKey: v.deviceId, studentKey });
      if (!(await progress.isSessionStudent(session.id, studentKey))) await progress.joinSession(session.id, studentKey, '—');
      const before = await progress.studentData(lab, studentKey, await sessionScope(progress, lab, null));
      const at = await progress.checkIn(studentKey, lab, session.id);
      const entry = { name: v.name, studentId: v.studentId, lab, at };
      return before.checkin ? json({ ok: true, already: true, entry: { ...entry, at: before.checkin } }) : json({ ok: true, entry }, 201);
    } catch (err) {
      console.error('[attendance] check-in failed', err);
      // same status and error code as before (Lab 5 apps handle 500), with a message that says what is wrong
      const down = await databaseDown();
      return json({ error: 'server', message: down ? OUTAGE.attendance : 'Something went wrong on our side. Please try again.' }, 500);
    }
  }

  // no course database: the old standalone attendance store, if one is set up
  const store = getStore();
  if (!store) return json({ error: 'closed', message: 'Attendance is not open yet. Please tell your TA.' }, 503);
  try {
    // Students may share a lab PC: the device is paired with the student ID, so "once per device" never blocks a
    // classmate. "Once per student ID" still applies.
    const deviceId = `${v.deviceId.slice(0, 40)}.${v.studentId.toLowerCase()}`;
    const r = await store.checkIn({ name: v.name, studentId: v.studentId, deviceId, at: new Date().toISOString() });
    switch (r.status) {
      case 'ok':
        return json({ ok: true, entry: r.entry }, 201);
      case 'device':
      case 'id':
        return json({ ok: true, already: true, entry: 'entry' in r ? r.entry ?? null : null });
      case 'full':
        return json({ error: 'full', message: 'The attendance list is full. Please tell your TA.' }, 503);
    }
  } catch (err) {
    console.error('[attendance] check-in failed', err);
    return json({ error: 'server', message: 'Something went wrong on our side. Please try again.' }, 500);
  }
  return json({ error: 'server', message: 'Something went wrong on our side. Please try again.' }, 500);
};
