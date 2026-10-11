/**
 * Account tokens are verified without a database call (isAdmin() is synchronous). On staff routes this
 * middleware also re-checks the account against the database, so a deactivated account, a changed
 * password or a changed role is signed out on its very next request. Static pages never run it.
 *
 * Every on-demand response also gets basic security headers; staff pages and APIs may never be framed
 * by another site (clickjacking).
 */
import { defineMiddleware } from 'astro:middleware';
import { masterAdmin } from '@/lib/attendance/server';
import { USER_COOKIE, getAccountStore, viewer } from '@/lib/accounts/server';

const STAFF = /^\/(admin|api\/admin)(\/|$)/;

const HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};
const STAFF_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'",
};

function secured(res: Response, staff: boolean): Response {
  try {
    for (const [k, v] of Object.entries(HEADERS)) if (!res.headers.has(k)) res.headers.set(k, v);
    if (staff) for (const [k, v] of Object.entries(STAFF_HEADERS)) res.headers.set(k, v);
  } catch {
    // a few responses (e.g. Response.redirect) have read-only headers: send them as they are
  }
  return res;
}

export const onRequest = defineMiddleware(async (ctx, next) => {
  if (ctx.isPrerendered) return next();
  const staff = STAFF.test(ctx.url.pathname);
  if (!staff || !ctx.cookies.get(USER_COOKIE)) return secured(await next(), staff);
  const claims = viewer(ctx.cookies);
  const store = getAccountStore();
  let current = Boolean(claims);
  try {
    if (claims && store) current = await store.isCurrent(claims);
  } catch (error) {
    console.error('[accounts] could not re-check the account', error); // keep the signed token on a database hiccup
  }
  if (current || masterAdmin(ctx.cookies)) return secured(await next(), staff);
  // revoked: clear the cookie and stop this request (the cookie was already read for it)
  const clear = `${USER_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
  if (ctx.url.pathname.startsWith('/api/')) {
    return secured(new Response(JSON.stringify({ error: 'Your session has ended. Sign in again.' }), { status: 401, headers: { 'content-type': 'application/json', 'set-cookie': clear } }), staff);
  }
  return secured(new Response(null, { status: 303, headers: { location: `/login?next=${encodeURIComponent(ctx.url.pathname)}&ended=1`, 'set-cookie': clear } }), staff);
});
