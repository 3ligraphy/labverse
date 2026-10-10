/**
 * Admin: project groups (/admin/project/[id]/groups).
 *   GET ?file=…          { file, entries, roster, plan } for one item
 *   PUT ?file=…          { plan }    saves the item's group plan (added members, ideas, choices, file scans)
 *   PUT                  { roster }  saves the class list (shared by every item)
 * The rules (who is in which group, random picks) run in the browser and live in src/lib/project-files/groups.ts;
 * this endpoint only checks and stores what it is given.
 */
import type { APIRoute } from 'astro';
import { canManageSubmissions } from '@/lib/accounts/labscope';
import { json } from '@/lib/progress/server';
import { cleanPlan, cleanRoster, emptyPlan, type Student } from '@/lib/project-files/groups';
import { getFilesStore } from '@/lib/project-files/server';

export const prerender = false;

const MAX_BODY = 1024 * 1024;

export const GET: APIRoute = async ({ url, cookies }) => {
  if (!(await canManageSubmissions(cookies))) return json({ error: 'Unauthorized' }, 401);
  const store = getFilesStore();
  if (!store) return json({ error: 'No database is connected.' }, 503);
  try {
    const file = await store.get(url.searchParams.get('file') ?? '');
    if (!file) return json({ error: 'Not found.' }, 404);
    const [entries, roster, plan] = await Promise.all([
      store.listEntries(file.id),
      store.getGroupData<Student[]>('roster'),
      store.getGroupData<unknown>(`plan:${file.id}`),
    ]);
    return json({ file, entries, roster: roster ?? [], plan: plan ? cleanPlan(plan) : emptyPlan() });
  } catch (error) {
    console.error('[project-groups] could not load', error);
    return json({ error: 'Could not load the groups.' }, 500);
  }
};

export const PUT: APIRoute = async ({ url, request, cookies }) => {
  if (!(await canManageSubmissions(cookies))) return json({ error: 'Unauthorized' }, 401);
  const store = getFilesStore();
  if (!store) return json({ error: 'No database is connected.' }, 503);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: 'That is too much data to save at once.' }, 413);
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return json({ error: 'Invalid request.' }, 400); }
  try {
    if ('roster' in body) {
      const roster = cleanRoster(body.roster);
      if (!roster.ok) return json({ error: roster.error }, 400);
      await store.setGroupData('roster', roster.value);
      return json({ ok: true, roster: roster.value });
    }
    const file = await store.get(url.searchParams.get('file') ?? '');
    if (!file) return json({ error: 'Not found.' }, 404);
    const plan = cleanPlan(body.plan);
    await store.setGroupData(`plan:${file.id}`, plan);
    return json({ ok: true });
  } catch (error) {
    console.error('[project-groups] could not save', error);
    return json({ error: 'Could not save.' }, 500);
  }
};
