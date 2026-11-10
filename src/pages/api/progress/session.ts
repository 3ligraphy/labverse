/** GET /api/progress/session?lab=lab-02 — is the lab open? { open, closesAt, sessions, practice, selfPaced } (public). */
import type { APIRoute } from 'astro';
import { ALWAYS_OPEN, sessionState } from '@/lib/progress/core';
import { getProgressStore, getStructures, isPermanent, json, permanentSession } from '@/lib/progress/server';
import { isOpenLab } from '@/lib/platform/server';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const store = getProgressStore();
  const lab = url.searchParams.get('lab') ?? '';
  if (!store || !lab) return json({ open: false, closesAt: null, practice: false });
  try {
    if (ALWAYS_OPEN) {
      // sessions are off: every lab is open, day and night, in its permanent session (made here on first use)
      if (!(await getStructures()).some((l) => l.lab === lab)) return json({ open: false, closesAt: null, sessions: [], practice: false });
      const session = { ...(await permanentSession(store, lab)), open: true, closesAt: null };
      return json({ ...session, sessions: [session], practice: false, selfPaced: true });
    }
    // a lab that is open any time has a permanent session (no TA needed, still tracked)
    const selfPaced = await isOpenLab(lab).catch(() => false);
    if (selfPaced) await permanentSession(store, lab);
    const sessions = (await store.listSessions(lab))
      .map((session) => ({ ...session, ...(selfPaced && isPermanent(session) ? { open: true, closesAt: null } : sessionState(session, Date.now())) }))
      .filter((session) => session.open);
    const practice = await store.getPractice(lab);
    // Retain the top-level session fields for older clients while exposing every live session.
    return json(sessions[0] ? { ...sessions[0], sessions, practice, selfPaced } : { open: false, closesAt: null, sessions: [], practice, selfPaced });
  } catch (err) {
    console.error('[progress] session failed', err);
    return json({ open: false, closesAt: null, sessions: [], practice: false, error: 'server' }, 500);
  }
};
