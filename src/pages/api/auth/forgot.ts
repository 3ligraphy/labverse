/**
 * "Forgot password" without email: the student asks, a TA approves in Admin → Password requests, then the
 * student's own browser sets the new password (see the "Forgot your password?" panel on /login and /api/auth/reset).
 *   POST { email, studentId }   → { id, secret }  the browser keeps the secret; only its hash is stored
 *   GET  ?id=…&secret=…          → { status: 'pending' | 'approved' | 'rejected' | 'expired' | 'done' | 'replaced', … }
 * Both the email and the student ID must match a student account. Rate-limited per network and per email.
 */
import type { APIRoute } from 'astro';
import { getSecret } from 'astro:env/server';
import { clientIp } from '@/lib/attendance/server';
import { normalEmail } from '@/lib/accounts/core';
import { getAccountStore, hashSecret, newSecret } from '@/lib/accounts/server';
import { cleanStudentId, studentIdError } from '@/lib/identity';
import { getProgressStore, json } from '@/lib/progress/server';

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const store = getAccountStore();
  if (!store) return json({ error: 'Accounts are not set up on this site yet.' }, 503);
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; studentId?: unknown };
  const raw = normalEmail(body.email);
  const email = raw.includes('@') ? raw : `${raw}@${getSecret('LOGIN_DOMAIN') || 'bue.edu.eg'}`;
  const studentId = cleanStudentId(body.studentId);
  const badId = studentIdError(studentId);
  if (!raw) return json({ error: 'Type the email you signed up with.' }, 400);
  if (badId) return json({ error: badId }, 400);

  const limits = getProgressStore();
  const [network, perEmail] = await Promise.all([
    limits?.hit(`forgot:net:${clientIp(request, clientAddress)}`, 600).catch(() => 0) ?? 0,
    limits?.hit(`forgot:email:${email}`, 3600).catch(() => 0) ?? 0,
  ]);
  if (network > 30 || perEmail > 5) return json({ error: 'Too many requests. Wait a while, or ask your TA in the lab.' }, 429);

  try {
    const user = await store.byEmail(email);
    if (user && user.role !== 'student') return json({ error: 'Staff passwords are reset by a super admin in Admin → Accounts.' }, 400);
    if (!user || cleanStudentId(user.studentId) !== studentId) {
      return json({ error: 'No student account has this email and student ID together. Check both, or ask your TA.' }, 404);
    }
    if (!user.active) return json({ error: 'This account is disabled. Ask your TA.' }, 403);
    const secret = newSecret();
    const reset = await store.createReset(user, hashSecret(secret));
    return json({ id: reset.id, secret, name: user.name });
  } catch (error) {
    console.error('[accounts] forgot-password request failed', error);
    return json({ error: 'Could not send the request. Try again.' }, 500);
  }
};

export const GET: APIRoute = async ({ url }) => {
  const store = getAccountStore();
  if (!store) return json({ error: 'Accounts are not set up on this site yet.' }, 503);
  const id = url.searchParams.get('id') ?? '';
  const secret = url.searchParams.get('secret') ?? '';
  if (!id || !secret) return json({ error: 'Missing request.' }, 400);
  try {
    const reset = await store.getReset(id);
    if (!reset || reset.secret_hash !== hashSecret(secret)) return json({ error: 'This request was not found.' }, 404);
    const expired = reset.status === 'approved' && reset.expires_at !== null && Date.parse(reset.expires_at) < Date.now();
    return json({ status: expired ? 'expired' : reset.status, decidedBy: reset.decided_by, expiresAt: reset.expires_at, createdAt: reset.created_at });
  } catch (error) {
    console.error('[accounts] forgot-password status failed', error);
    return json({ error: 'Could not check the request. Try again.' }, 500);
  }
};
