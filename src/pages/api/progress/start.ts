/** POST /api/progress/start — join the currently active lab session with name, ID and group. */
import type { APIRoute } from 'astro';
import { sessionState, validateIdentity } from '@/lib/progress/core';
import { cleanGroup, groupError } from '@/lib/identity';
import { getProgressStore, getStructures, json } from '@/lib/progress/server';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const identity = validateIdentity(body);
  if (!identity.ok) return json({ error: 'invalid', errors: identity.errors }, 400);
  const lab = String(body?.lab ?? '');
  const sessionId = String(body?.sessionId ?? '');
  const group = cleanGroup(body?.group);
  if (!(await getStructures()).some((item) => item.lab === lab) || groupError(group) !== null) {
    return json({ error: 'invalid', message: groupError(group) ?? 'Unknown lab.' }, 400);
  }
  const store = getProgressStore();
  if (!store) return json({ error: 'closed', message: 'Progress tracking is not set up.' }, 503);
  try {
    const session = await store.getSessionById(sessionId);
    if (!session || session.lab !== lab || !sessionState(session, Date.now()).open) {
      return json({ error: 'session-closed', message: 'Your TA has not started this lab session yet. You can still read the content.' }, 403);
    }
    if ((await store.touchStudent(identity.value)) === 'conflict') {
      return json({ error: 'device', message: 'This student ID was already used with a different name. Type your name exactly as you did before, or ask your TA to fix it.' }, 409);
    }
    await store.joinSession(sessionId, identity.value.studentKey, group);
    return json({ ok: true, session });
  } catch (error) {
    console.error('[progress] session start failed', error);
    return json({ error: 'server', message: 'Could not start the lab. Try again in a moment.' }, 500);
  }
};
