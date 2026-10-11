/**
 * Admin: written feedback for each project group (/admin/project/[id]/feedback).
 *   GET ?file=…   { file, entries, roster, plan, feedback } — everything the cards and the PDF report need
 *   PUT ?file=…   { key, text, entries }  saves (or, with empty text, clears) one group's feedback
 *   PUT ?file=…   { action: 'choice', key, idea, mode }  approves one group's idea (empty idea clears it); the rest
 *                 of the group plan is left as it is
 * Groups are built in the browser from the group plan (src/lib/project-files/groups.ts); feedback is stored
 * separately from the plan, one group at a time, so the Groups page and this page never overwrite each other.
 */
import type { APIRoute } from 'astro';
import { access } from '@/lib/accounts/access';
import { json } from '@/lib/progress/server';
import { cleanFeedback, parseNote, setNote } from '@/lib/project-files/feedback';
import { cleanPlan, emptyPlan, setChoice, type Student } from '@/lib/project-files/groups';
import { getFilesStore } from '@/lib/project-files/server';

export const prerender = false;

const allowed = async (cookies: Parameters<typeof access>[0]) => {
  const a = await access(cookies);
  return a.can('module.submissions', 'mobile-development') ? a : null;
};

export const GET: APIRoute = async ({ url, cookies }) => {
  if (!(await allowed(cookies))) return json({ error: 'Unauthorized' }, 401);
  const store = getFilesStore();
  if (!store) return json({ error: 'No database is connected.' }, 503);
  try {
    const file = await store.get(url.searchParams.get('file') ?? '');
    if (!file) return json({ error: 'Not found.' }, 404);
    const [entries, roster, plan, feedback] = await Promise.all([
      store.listEntries(file.id),
      store.getGroupData<Student[]>('roster'),
      store.getGroupData<unknown>(`plan:${file.id}`),
      store.getGroupData<unknown>(`feedback:${file.id}`),
    ]);
    return json({ file, entries, roster: roster ?? [], plan: plan ? cleanPlan(plan) : emptyPlan(), feedback: cleanFeedback(feedback) });
  } catch (error) {
    console.error('[project-feedback] could not load', error);
    return json({ error: 'Could not load the feedback.' }, 500);
  }
};

export const PUT: APIRoute = async ({ url, request, cookies }) => {
  const a = await allowed(cookies);
  if (!a) return json({ error: 'Unauthorized' }, 401);
  const store = getFilesStore();
  if (!store) return json({ error: 'No database is connected.' }, 503);
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  if (body.action === 'choice') {
    try {
      const file = await store.get(url.searchParams.get('file') ?? '');
      if (!file) return json({ error: 'Not found.' }, 404);
      const key = `plan:${file.id}`;
      const plan = cleanPlan(await store.getGroupData<unknown>(key));
      const changed = setChoice(plan, body);
      if (!changed.ok) return json({ error: changed.error }, 400);
      await store.setGroupData(key, plan);
      return json({ ok: true, choice: plan.choices[changed.key] ?? null });
    } catch (error) {
      console.error('[project-feedback] could not save the idea', error);
      return json({ error: 'Could not save.' }, 500);
    }
  }
  const note = parseNote(body);
  if (!note.ok) return json({ error: note.error }, 400);
  try {
    const file = await store.get(url.searchParams.get('file') ?? '');
    if (!file) return json({ error: 'Not found.' }, 404);
    const key = `feedback:${file.id}`;
    const next = setNote(cleanFeedback(await store.getGroupData<unknown>(key)), note.value.key, note.value.text, note.value.entries, a.by);
    await store.setGroupData(key, next);
    return json({ ok: true, note: next[note.value.key] ?? null });
  } catch (error) {
    console.error('[project-feedback] could not save', error);
    return json({ error: 'Could not save.' }, 500);
  }
};
