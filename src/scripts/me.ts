/**
 * Who is signed in, for the page on screen: one GET /api/auth/me per page, shared by the nav, the module hub, the
 * module directory and the lab start screen. Nothing is kept between pages, so signing in, signing out, an
 * invitation or a revoked session shows up on the very next page.
 */
let pending: Promise<unknown> | null = null;

export function getMe<T>(): Promise<T | null> {
  pending ??= fetch('/api/auth/me', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  return pending as Promise<T | null>;
}

/** Call after something on this page changed the account (sign-in, profile save). */
export function forgetMe(): void {
  pending = null;
}

if (typeof document !== 'undefined') document.addEventListener('astro:after-swap', forgetMe);
