/**
 * Can the course database be reached right now? One small read with a time limit, remembered for a few seconds on
 * each server. Used by GET /api/status (the "Saving is off" strip) and by the APIs that fail, so their error says
 * that the database is down instead of a vague "try again".
 */
import { ATTENDANCE_LAB } from '@/lib/attendance/api';
import { getProgressStore } from '@/lib/progress/server';

const PROBE_MS = 3500;
const REMEMBER_MS = 10_000;
let last: { at: number; down: boolean } | null = null;

/** true: the database does not answer; false: it does; null: this site has no database at all. */
export async function databaseDown(): Promise<boolean | null> {
  const store = getProgressStore();
  if (!store) return null;
  if (last && Date.now() - last.at < REMEMBER_MS) return last.down;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let down = false;
  try {
    await Promise.race([
      store.getSession(ATTENDANCE_LAB),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('the database did not answer in time')), PROBE_MS); }),
    ]);
  } catch (error) {
    console.error('[status] the course database cannot be reached', error);
    down = true;
  } finally {
    clearTimeout(timer);
  }
  last = { at: Date.now(), down };
  return down;
}
