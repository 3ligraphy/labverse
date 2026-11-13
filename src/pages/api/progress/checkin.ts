/** POST /api/progress/checkin — end-of-lab check-in: { name, studentId, deviceKey, lab }. Only while the admin has it open. */
import type { APIRoute } from 'astro';
import { ALWAYS_OPEN, ATTENDANCE_MIN_ACTIVE_SEC, ATTENDANCE_MIN_SEEN, attendanceEligibility, sessionState, validateCheckin } from '@/lib/progress/core';
import { getProgressStore, getStructures, isPermanent, json, liveSession, sessionScope } from '@/lib/progress/server';
import { OUTAGE } from '@/lib/outage';
import { databaseDown } from '@/lib/outage-server';

export const prerender = false;

const WINDOW_SEC = 10 * 60;
export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const valid = validateCheckin(body, await getStructures());
  if (!valid.ok) return json({ error: 'invalid', errors: valid.errors }, 400);

  const store = getProgressStore();
  if (!store) return json({ error: 'closed', message: 'Attendance storage is not set up.' }, 503);
  const c = valid.value;
  const sessionId = String((body as Record<string, unknown>)?.sessionId ?? '');

  try {
    const session = await liveSession(store, c.lab, sessionId);
    if (!session) return json({ error: 'closed', message: 'This lab session is not active.' }, 403);
    // with sessions off, minutes and sections read in any session of the lab count
    const existing = await store.studentData(c.lab, c.studentKey, ALWAYS_OPEN ? await sessionScope(store, c.lab, null) : session.id);
    // An accepted check-in is immutable and idempotent, from whichever device asks.
    if (existing.checkin) return json({ ok: true, at: existing.checkin });
    const activeSec = existing.views?.active_sec ?? 0;
    const seen = existing.views?.seen.length ?? 0;
    const eligible = attendanceEligibility({ student: existing.student, name: c.name, activeSec, seen });
    if (!eligible.ok && eligible.reason === 'identity') {
      return json(
        { error: 'identity', message: 'Start the lab with your name and student ID first (top of the page), then check in.' },
        409,
      );
    }
    // a flood guard per student only: shared lab PCs and campus Wi-Fi never block anyone
    if ((await store.hit(`checkin:${session.id}:student:${c.studentKey}`, WINDOW_SEC)) > 30) {
      return json({ error: 'slow-down', message: 'Too many check-in attempts. Wait a few minutes.' }, 429);
    }

    if (!sessionState(session, Date.now()).open && !(ALWAYS_OPEN && isPermanent(session))) {
      return json({ error: 'closed', message: 'Check-in for this lab is closed. Ask your TA.' }, 403);
    }

    if (!eligible.ok) {
      return json(
        {
          error: 'participation',
          message: `Attendance needs at least 5 active minutes and 3 viewed lab sections. Recorded: ${Math.floor(activeSec / 60)} min and ${seen} sections.`,
          requirements: { activeSec: ATTENDANCE_MIN_ACTIVE_SEC, seen: ATTENDANCE_MIN_SEEN },
        },
        403,
      );
    }

    return json({ ok: true, at: await store.checkIn(c.studentKey, c.lab, session.id) });
  } catch (error) {
    console.error('[progress] secure check-in failed', error);
    const down = await databaseDown();
    return down
      ? json({ error: 'offline', offline: true, message: OUTAGE.checkin }, 503)
      : json({ error: 'server', message: 'Could not verify attendance. Try again in a moment.' }, 500);
  }
};
