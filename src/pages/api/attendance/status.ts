/**
 * GET /api/attendance/status — can students check in through POST /api/attendance right now?
 * Read-only; never writes and never reveals names. { open, database: 'connected' | 'missing' | 'error', password }
 * Open to any page (CORS), see src/lib/attendance/api.ts.
 */
import type { APIRoute } from 'astro';
import { getStore, setupStatus } from '@/lib/attendance/server';
import { ATTENDANCE_LAB, apiJson as json, preflight } from '@/lib/attendance/api';
import { getProgressStore } from '@/lib/progress/server';

export const prerender = false;

export const OPTIONS: APIRoute = () => preflight();

export const GET: APIRoute = async () => {
  const { password } = setupStatus();
  // check-ins are saved in the course database; the old standalone store is only used without it
  const progress = getProgressStore();
  if (progress) {
    try {
      await progress.getSession(ATTENDANCE_LAB);
      return json({ open: true, database: 'connected', password });
    } catch (err) {
      console.error('[attendance] status check failed', err);
      return json({ open: false, database: 'error', password });
    }
  }
  const store = getStore();
  let database: 'connected' | 'missing' | 'error' = store ? 'connected' : 'missing';
  if (store) {
    try {
      await store.count();
    } catch (err) {
      console.error('[attendance] status check failed', err);
      database = 'error';
    }
  }
  return json({ open: database === 'connected' && password, database, password });
};
