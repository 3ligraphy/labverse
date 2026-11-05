/**
 * Every module is open to everyone, with no sign-in or invitation: students type their name and ID in each lab, or
 * sign in. Staff can lock a module's labs (the Lock button on the module page): students then still see the module
 * and its list of labs, but cannot open a lab. Staff (doctors, TAs, super admins, the admin password) open
 * everything, locked or not.
 */
import type { AstroCookies } from 'astro';
import { isAdmin } from '@/lib/attendance/server';
import { viewer } from './server';
import { hubData } from './hub';

/** Are this module's labs locked by staff? */
export async function isLocked(module: string): Promise<boolean> {
  const { settings } = await hubData();
  return settings.locked.includes(module);
}

/** May this visitor open the module's labs? (`locked`: staff locked them; staff may still open them) */
export async function moduleAccess(cookies: AstroCookies, module: string): Promise<{ ok: boolean; signedIn: boolean; locked: boolean; staff: boolean }> {
  const staff = isAdmin(cookies);
  const locked = await isLocked(module).catch(() => false);
  return { ok: staff || !locked, signedIn: staff || Boolean(viewer(cookies)), locked, staff };
}
