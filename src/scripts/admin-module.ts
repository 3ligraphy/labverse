/**
 * The module the admin is managing (the sidebar's Faculty → Module switcher). Kept in a cookie so server-rendered
 * admin pages open on it; a page that switches module itself (e.g. the lab picker on Sessions) announces it with
 * ADMIN_MODULE_EVENT so the sidebar links follow without a reload. Safe to import on the server (constants only
 * run there; the functions touch `document` only when called).
 */
export const ADMIN_MODULE_COOKIE = 'adm_module';
export const ADMIN_MODULE_EVENT = 'adm:module';

/** Remember this module for the admin pages (one year) and tell the sidebar. */
export function rememberAdminModule(slug: string) {
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return;
  document.cookie = `${ADMIN_MODULE_COOKIE}=${slug}; path=/; max-age=31536000; samesite=lax`;
  document.dispatchEvent(new CustomEvent(ADMIN_MODULE_EVENT, { detail: slug }));
}

/** The remembered module, or ''. */
export function savedAdminModule(): string {
  return document.cookie.split('; ').find((c) => c.startsWith(`${ADMIN_MODULE_COOKIE}=`))?.slice(ADMIN_MODULE_COOKIE.length + 1) ?? '';
}
