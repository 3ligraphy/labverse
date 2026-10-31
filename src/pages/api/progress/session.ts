/** GET /api/progress/session?lab=lab-02 — is check-in open for this lab? { open, closesAt, practice, selfPaced } (public). */
import type { APIRoute } from 'astro';
import { sessionState } from '@/lib/progress/core';
import { getProgressStore, json } from '@/lib/progress/server';
import { isOpenLab } from '@/lib/platform/server';
import type { ProgressStore } from '@/lib/progress/store';

export const prerender = false;

/** the permanent session of a lab that is open any time (no TA session needed, still tracked) */
const OPEN_LAB_TA = 'Open lab';
const opening = new Map<string, Promise<void>>();
function ensureOpenSession(store: ProgressStore, lab: string) {
  let p = opening.get(lab);
  if (!p) {
    p = (async () => {
      const live = (await store.listSessions(lab)).filter((s) => sessionState(s, Date.now()).open);
      if (!live.length) await store.openSession(lab, null, OPEN_LAB_TA, 'Any time');
    })().finally(() => opening.delete(lab));
    opening.set(lab, p);
  }
  return p;
}

export const GET: APIRoute = async ({ url }) => {
  const store = getProgressStore();
  const lab = url.searchParams.get('lab') ?? '';
  if (!store || !lab) return json({ open: false, closesAt: null, practice: false });
  try {
    const selfPaced = await isOpenLab(lab).catch(() => false);
    if (selfPaced) await ensureOpenSession(store, lab);
    // the database clock can run a little ahead: a just-opened permanent session still counts as open
    const now = Date.now() + (selfPaced ? 5_000 : 0);
    const sessions = (await store.listSessions(lab))
      .map((session) => ({ ...session, ...sessionState(session, now) }))
      .filter((session) => session.open);
    const practice = await store.getPractice(lab);
    // Retain the top-level session fields for older clients while exposing every live session.
    return json(sessions[0] ? { ...sessions[0], sessions, practice, selfPaced } : { open: false, closesAt: null, sessions: [], practice, selfPaced });
  } catch (err) {
    console.error('[progress] session failed', err);
    return json({ open: false, closesAt: null, sessions: [], practice: false, error: 'server' }, 500);
  }
};
