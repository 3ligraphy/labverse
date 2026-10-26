/**
 * Admin: students' "forgot password" requests (/admin/password-resets).
 *   GET                              { requests: [...], pending: n }
 *   GET ?count                       { pending: n }   (the badge in the admin menu)
 *   POST { id, action: 'approve' }   → { link }  a one-time link the TA can also send the student (24 hours)
 *   POST { id, action: 'reject' }
 * Any teaching-staff member (TA, doctor, module staff, super admin) may decide.
 */
import type { APIRoute } from 'astro';
import { access } from '@/lib/accounts/access';
import { getAccountStore, hashSecret, newSecret } from '@/lib/accounts/server';
import { json } from '@/lib/progress/server';

export const prerender = false;

const staff = async (cookies: Parameters<typeof access>[0]) => {
  const a = await access(cookies);
  const ok = a.master || (a.user && a.user.role !== 'student') || Object.keys(a.who.modules).length > 0;
  return ok ? a : null;
};

export const GET: APIRoute = async ({ cookies, url }) => {
  if (!(await staff(cookies))) return json({ error: 'Unauthorized' }, 401);
  const store = getAccountStore();
  if (!store) return json({ requests: [], pending: 0 });
  try {
    if (url.searchParams.has('count')) return json({ pending: await store.pendingResets() });
    const rows = await store.listResets();
    const requests = rows.map(({ secret_hash, link_hash, ...r }) => r);
    return json({ requests, pending: rows.filter((r) => r.status === 'pending').length });
  } catch (error) {
    console.error('[accounts] could not list reset requests', error);
    return json({ error: 'Could not load the requests.' }, 500);
  }
};

export const POST: APIRoute = async ({ cookies, request, url }) => {
  const a = await staff(cookies);
  if (!a) return json({ error: 'Unauthorized' }, 401);
  const store = getAccountStore();
  if (!store) return json({ error: 'Accounts are not set up.' }, 503);
  const body = (await request.json().catch(() => ({}))) as { id?: unknown; action?: unknown };
  const id = String(body.id ?? '');
  const approve = body.action === 'approve';
  if (!approve && body.action !== 'reject') return json({ error: 'Choose approve or reject.' }, 400);
  try {
    const token = approve ? newSecret() : null;
    const decided = await store.decideReset(id, approve, a.by || 'Staff', token ? hashSecret(token) : null);
    if (!decided) return json({ error: 'This request was already decided or replaced. Refresh the list.' }, 409);
    return json({ ok: true, status: decided.status, link: token ? `${url.origin}/login?reset=${token}` : null });
  } catch (error) {
    console.error('[accounts] could not decide a reset request', error);
    return json({ error: 'Could not save. Try again.' }, 500);
  }
};
