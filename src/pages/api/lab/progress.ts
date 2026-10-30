/**
 * POST /api/lab/progress — a student's browser reports lab progress (start / check / hint).
 * Body: { lab, name, studentId, deviceId, event, exercise?, result?, score? }  (see src/lab/ui/tracker.ts)
 */
import type { APIRoute } from 'astro';
import { validateLabEvent } from '@/lib/lab/core';
import { getLabBackend } from '@/lib/lab/server';
import { ALWAYS_OPEN } from '@/lib/progress/core';
import { getProgressStore, getStructures, liveSession } from '@/lib/progress/server';
import { noStore } from '@/lib/attendance/server';

export const prerender = false;

const MAX_EVENTS = 600; // per student: a flood guard only (shared lab PCs and campus Wi-Fi are fine)
const WINDOW_SEC = 10 * 60; // per 10 minutes

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...noStore } });

export const POST: APIRoute = async ({ request }) => {
  const backend = getLabBackend();
  if (!backend) return json({ ok: false, error: 'Progress tracking is not set up yet.' }, 503);

  const body = await request.json().catch(() => null);
  const labs = await getStructures().catch(() => []);
  const v = validateLabEvent(body, (lab) => labs.some((l) => l.lab === lab));
  if (!v.ok) return json({ ok: false, error: v.error }, 400);

  const progress = getProgressStore();
  let session;
  try {
    // with sessions off: the lab's permanent session when the student's own has ended (their work is never refused)
    session = progress ? await liveSession(progress, v.event.lab, v.event.sessionId) : null;
  } catch (error) {
    console.error('[lab] could not read the session', error);
    return json({ ok: false, error: 'Could not save progress.' }, 503); // the browser keeps the event and sends it again
  }
  if (!session) {
    return json({ ok: false, error: 'session-closed', message: 'Your TA has not started this lab session yet. You can read the content, but you cannot start or record attendance.' }, 403);
  }
  if (!ALWAYS_OPEN && v.event.event !== 'start' && !(await progress!.isSessionStudent(session.id, v.event.studentKey))) {
    return json({ ok: false, error: 'not-started', message: 'Enter your name, ID and group at the top of the lab first.' }, 403);
  }
  // record() joins the student to this session (with sessions off, a student who was not in it yet)
  v.event.sessionId = session.id;

  const tries = await backend.hit(`student:${v.event.studentKey}`, WINDOW_SEC).catch(() => 0);
  if (tries > MAX_EVENTS) return json({ ok: false, error: 'Too many events — slow down a little.' }, 429);

  try {
    await backend.record(v.event);
  } catch (error) {
    console.error('[lab] could not record progress', error);
    return json({ ok: false, error: 'Could not save progress.' }, 500);
  }
  return json({ ok: true, sessionId: session.id });
};
