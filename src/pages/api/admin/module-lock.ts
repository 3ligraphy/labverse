/**
 * POST /api/admin/module-lock { module, locked } — staff lock or unlock a module's labs (the Lock button on the
 * module page). Locked: students still see the module and its labs listed, but cannot open a lab or save work.
 */
import type { APIRoute } from 'astro';
import { access } from '@/lib/accounts/access';
import { getAccountStore } from '@/lib/accounts/server';
import { forgetHubData, hubData } from '@/lib/accounts/hub';
import { json } from '@/lib/progress/server';

export const prerender = false;

export const POST: APIRoute = async ({ cookies, request }) => {
  const body = (await request.json().catch(() => null)) as { module?: unknown; locked?: unknown } | null;
  const module = String(body?.module ?? '');
  if (typeof body?.locked !== 'boolean') return json({ error: 'bad-request' }, 400);
  const a = await access(cookies);
  if (!a.can('module.sessions', module) && !a.can('module.build', module)) return json({ error: 'forbidden', message: 'Only staff can lock a module.' }, 403);
  const store = getAccountStore();
  if (!store) return json({ error: 'no-database' }, 503);
  try {
    const { settings, cards } = await hubData();
    if (!cards.some((c) => c.slug === module)) return json({ error: 'not-found', message: 'Unknown module.' }, 404);
    const locked = new Set(settings.locked);
    if (body.locked) locked.add(module);
    else locked.delete(module);
    await store.setSetting('locked', [...locked]);
    forgetHubData();
    return json({ ok: true, locked: body.locked });
  } catch (error) {
    console.error('[platform] module lock failed', error);
    return json({ error: 'server' }, 500);
  }
};
