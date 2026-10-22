/**
 * POST /api/auth/reset — sets a new password once a TA approved the request:
 *   { id, secret, password }  from the browser that asked (see /api/auth/forgot), or
 *   { token, password }       from the one-time link the TA was given when approving.
 * Signs the student in afterwards (and out of every other device).
 */
import type { APIRoute } from 'astro';
import { checkPasswordRules } from '@/lib/accounts/core';
import { getAccountStore, hashSecret, publicUser, startUserSession } from '@/lib/accounts/server';
import { json } from '@/lib/progress/server';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, url }) => {
  const store = getAccountStore();
  if (!store) return json({ error: 'Accounts are not set up on this site yet.' }, 503);
  const body = (await request.json().catch(() => ({}))) as { id?: unknown; secret?: unknown; token?: unknown; password?: unknown };
  const pwError = checkPasswordRules(body.password);
  if (pwError) return json({ error: pwError }, 400);
  try {
    const token = typeof body.token === 'string' ? body.token : '';
    const reset = token
      ? await store.resetByLink(hashSecret(token))
      : await store.getReset(String(body.id ?? '')).then((r) => (r && r.secret_hash === hashSecret(String(body.secret ?? '')) ? r : null));
    if (!reset) return json({ error: 'This reset request was not found. Ask again from the sign-in page.' }, 404);
    if (reset.status === 'pending') return json({ error: 'Your TA has not approved this request yet.' }, 403);
    if (reset.status !== 'approved') return json({ error: 'This request is closed. Ask again from the sign-in page.' }, 410);
    if (!reset.expires_at || Date.parse(reset.expires_at) < Date.now()) return json({ error: 'This approval has expired (after 24 hours). Ask again from the sign-in page.' }, 410);
    const user = await store.completeReset(reset, String(body.password));
    if (!user) return json({ error: 'This request was already used. Sign in with your new password.' }, 409);
    startUserSession(cookies, user, url.protocol === 'https:');
    return json({ ok: true, user: publicUser(user) });
  } catch (error) {
    console.error('[accounts] password reset failed', error);
    return json({ error: 'Could not set the new password. Try again.' }, 500);
  }
};
