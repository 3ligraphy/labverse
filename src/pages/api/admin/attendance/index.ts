/**
 * GET  /api/admin/attendance?module=<slug> — the module's weekly attendance register with warnings.
 * POST /api/admin/attendance — { module, action: 'excuse', week, studentKey, note } or { module, action: 'unexcuse', week, studentKey }.
 * Reading needs module.sessions or module.progress on the module; excusing needs module.sessions.
 * Marking someone present goes through POST /api/admin/progress/session (action 'add-attendance').
 */
import type { APIRoute } from 'astro';
import { isAdmin } from '@/lib/attendance/server';
import { access } from '@/lib/accounts/access';
import { canOnLab } from '@/lib/accounts/labscope';
import { buildRegisterFor, getProgressStore, json } from '@/lib/progress/server';

export const prerender = false;

const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;
const MODULE_RE = /^[a-z0-9][a-z0-9-]{0,80}$/;

export const GET: APIRoute = async ({ cookies, url }) => {
  if (!isAdmin(cookies)) return json({ error: 'unauthorised' }, 401);
  const module = url.searchParams.get('module') ?? 'mobile-development';
  const a = await access(cookies);
  if (!MODULE_RE.test(module) || !(a.can('module.sessions', module) || a.can('module.progress', module))) return json({ error: 'forbidden' }, 403);
  try {
    const data = await buildRegisterFor(module, (lab) => canOnLab(a, 'module.sessions', lab) || canOnLab(a, 'module.progress', lab));
    return data ? json(data) : json({ error: 'no-database' }, 503);
  } catch (err) {
    console.error('[attendance] register failed', err);
    return json({ error: 'server' }, 500);
  }
};

export const POST: APIRoute = async ({ cookies, request }) => {
  if (!isAdmin(cookies)) return json({ error: 'unauthorised' }, 401);
  const store = getProgressStore();
  if (!store) return json({ error: 'no-database' }, 503);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const module = String(body?.module ?? '');
  const week = String(body?.week ?? '');
  const studentKey = String(body?.studentKey ?? '').trim().toLowerCase();
  const action = String(body?.action ?? '');
  if (!MODULE_RE.test(module) || !WEEK_RE.test(week) || !studentKey || studentKey.length > 64) return json({ error: 'bad-request' }, 400);
  const a = await access(cookies);
  if (!a.can('module.sessions', module)) return json({ error: 'forbidden', message: 'You do not run attendance for this module.' }, 403);
  try {
    if (action === 'excuse') {
      const note = String(body?.note ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, 200);
      const by = a.user?.name ?? (a.master ? 'Admin' : 'Staff');
      await store.setExcuse({ module, week, studentKey, note, by });
      return json({ ok: true });
    }
    if (action === 'unexcuse') {
      await store.clearExcuse(module, week, studentKey);
      return json({ ok: true });
    }
    return json({ error: 'bad-request' }, 400);
  } catch (err) {
    console.error('[attendance] excuse failed', err);
    return json({ error: 'server' }, 500);
  }
};
