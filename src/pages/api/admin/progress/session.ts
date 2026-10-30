/**
 * POST /api/admin/progress/session — { lab, action: 'open', minutes: 15 | 30 | 60 | null } or { lab, action: 'close' },
 * or { lab, action: 'practice', on: boolean } to let students solve the lab without a session.
 */
import type { APIRoute } from 'astro';
import { isAdmin } from '@/lib/attendance/server';
import { access } from '@/lib/accounts/access';
import { canOnLab, canSeeLab } from '@/lib/accounts/labscope';
import { ALL_SESSIONS, ALWAYS_OPEN, sessionState, validateStudentIdentity } from '@/lib/progress/core';
import { sessionDetails } from '@/lib/progress/session-input';
import { markPresent } from '@/lib/progress/manual-attendance';
import { getProgressStore, getStructures, json, permanentSession } from '@/lib/progress/server';

export const prerender = false;

const LENGTHS = [15, 30, 60, 90, 120, 180];
export const POST: APIRoute = async ({ cookies, request }) => {
  if (!isAdmin(cookies)) return json({ error: 'unauthorised' }, 401);
  const store = getProgressStore();
  if (!store) return json({ error: 'no-database' }, 503);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const lab = String(body?.lab ?? '');
  if (!(await getStructures()).some((l) => l.lab === lab)) return json({ error: 'bad-request' }, 400);
  if (!canOnLab(await access(cookies), 'module.sessions', lab)) return json({ error: 'forbidden', message: 'You do not run sessions for this module.' }, 403);
  try {
    const action = String(body?.action ?? '');
    // sessions are off: every lab is always open in its permanent session, so there is nothing to make, start or end
    if (ALWAYS_OPEN && ['create', 'open', 'update', 'start', 'close', 'delete'].includes(action)) {
      return json({ error: 'always-open', message: 'Sessions are off: every lab is open to all students at any time, so there is nothing to start or end.' }, 409);
    }
    const asked = typeof body?.sessionId === 'string' ? body.sessionId : '';
    // "All students" (sessions off) records attendance in the lab's permanent session
    const sessionId = ALWAYS_OPEN && action === 'add-attendance' && (!asked || asked === ALL_SESSIONS) ? (await permanentSession(store, lab)).id : asked;
    if (action === 'add-attendance') {
      const identity = validateStudentIdentity(body);
      if (!identity.ok) return json({ error: 'invalid', message: Object.values(identity.errors).join(' '), errors: identity.errors }, 400);
      const session = sessionId ? await store.getSessionById(sessionId) : null;
      if (!session || session.lab !== lab) return json({ error: 'not-found', message: 'Select a valid session first.' }, 404);
      const at = await store.addManualAttendance(lab, sessionId, identity.value);
      if (!at) return json({ error: 'not-found', message: 'Select a valid session first.' }, 404);
      const recorded = (await store.studentData(lab, identity.value.studentKey, sessionId)).student?.name ?? identity.value.name;
      return json({ ok: true, at, name: recorded });
    }
    if (action === 'attendance') {
      const studentKey = typeof body?.studentKey === 'string' ? body.studentKey : '';
      let target = sessionId;
      if (ALWAYS_OPEN && studentKey && (!sessionId || sessionId === ALL_SESSIONS)) {
        // "All students": the permanent session when they are in it, otherwise a session they joined
        target = '';
        for (const id of [(await permanentSession(store, lab)).id, ...(await store.listSessions(lab)).map((s) => s.id)]) {
          if (await store.isSessionStudent(id, studentKey)) { target = id; break; }
        }
      }
      if (!target || !studentKey) return json({ error: 'bad-request', message: 'Select a session and student.' }, 400);
      const at = await markPresent(store, lab, target, studentKey);
      return at
        ? json({ ok: true, at })
        : json({ error: 'not-found', message: 'Student not found in this session.' }, 404);
    }
    const readDetails = () => sessionDetails(body?.taName, body?.timeSlot);
    const minutes = body?.minutes === undefined ? 90 : body.minutes == null || body.minutes === '' ? null : Number(body.minutes);
    if (['create', 'update', 'open', 'start'].includes(action) && minutes !== null && !LENGTHS.includes(minutes)) return json({ error: 'bad-request', message: 'Choose a valid session duration.' }, 400);

    if (action === 'practice') {
      if (typeof body?.on !== 'boolean') return json({ error: 'bad-request' }, 400);
      await store.setPractice(lab, body.on);
      return json({ ok: true, practice: body.on });
    }

    let changed = null;
    if (action === 'create' || action === 'open') {
      const { taName, timeSlot, valid } = readDetails();
      if (!valid) return json({ error: 'invalid', message: 'Enter the TA name and a valid time slot.' }, 400);
      changed = action === 'open'
        ? await store.openSession(lab, minutes, taName, timeSlot)
        : await store.createSession(lab, taName, timeSlot, minutes);
    } else if (action === 'update') {
      const { taName, timeSlot, valid } = readDetails();
      if (!sessionId || !valid) return json({ error: 'invalid', message: 'Enter the TA name and a valid time slot.' }, 400);
      changed = await store.updateSession(lab, sessionId, taName, timeSlot, minutes);
    } else if (action === 'start') {
      if (!sessionId) return json({ error: 'bad-request' }, 400);
      changed = await store.startSession(lab, sessionId, minutes);
    } else if (action === 'close') {
      if (!sessionId) return json({ error: 'bad-request' }, 400);
      await store.closeSession(lab, sessionId);
      changed = await store.getSessionById(sessionId);
    } else if (action === 'delete') {
      if (!sessionId) return json({ error: 'bad-request' }, 400);
      const deleted = await store.deleteSession(lab, sessionId);
      return deleted ? json({ ok: true, deleted: sessionId }) : json({ error: 'not-found' }, 404);
    } else return json({ error: 'bad-request' }, 400);

    if (!changed) return json({ error: 'not-found' }, 404);
    return json({ ok: true, session: { ...changed, ...sessionState(changed, Date.now()) } });
  } catch (err) {
    console.error('[progress] session change failed', err);
    return json({ error: 'server' }, 500);
  }
};
