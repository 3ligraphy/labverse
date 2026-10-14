/**
 * Admin: written feedback for each project group (/admin/project/[id]/feedback).
 *   GET ?file=…   { file, entries, roster, plan, feedback } — everything the cards and the PDF report need
 *   PUT ?file=…   { key, text, entries }  saves (or, with empty text, clears) one group's feedback
 *   PUT ?file=…   { action: 'choice', key, idea, mode }  approves one group's idea (empty idea clears it); the rest
 *                 of the group plan is left as it is
 *   PUT ?file=…   { action: 'release', published }  shows (or hides) each group's approved idea and feedback to its
 *                 students on /project, where a student looks up their own group by ID
 * Groups are built in the browser from the group plan (src/lib/project-files/groups.ts); feedback is stored
 * separately from the plan, one group at a time, so the Groups page and this page never overwrite each other.
 */
import type { APIRoute } from 'astro';
import { access } from '@/lib/accounts/access';
import { json } from '@/lib/progress/server';
import { cleanFeedback, parseNote, setNote } from '@/lib/project-files/feedback';
import { cleanPlan, emptyPlan, setChoice, type Student } from '@/lib/project-files/groups';
import { getFilesStore } from '@/lib/project-files/server';
import { cleanRelease } from '@/lib/project-files/results';

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
    const [entries, roster, plan, feedback, release] = await Promise.all([
      store.listEntries(file.id),
      store.getGroupData<Student[]>('roster'),
      store.getGroupData<unknown>(`plan:${file.id}`),
      store.getGroupData<unknown>(`feedback:${file.id}`),
      store.getGroupData<unknown>(`release:${file.id}`),
    ]);
    return json({ file, entries, roster: roster ?? [], plan: plan ? cleanPlan(plan) : emptyPlan(), feedback: cleanFeedback(feedback), release: cleanRelease(release) });
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
  if (body.action === 'release') {
    try {
      const file = await store.get(url.searchParams.get('file') ?? '');
      if (!file) return json({ error: 'Not found.' }, 404);
      const release = { published: body.published === true, at: new Date().toISOString(), by: a.by };
      await store.setGroupData(`release:${file.id}`, release);
      return json({ ok: true, release });
    } catch (error) {
      console.error('[project-feedback] could not publish', error);
      return json({ error: 'Could not save.' }, 500);
    }
  }
  if (body.action === 'choice') {
    try {
      const file = await store.get(url.searchParams.get('file') ?? '');
      if (!file) return json({ error: 'Not found.' }, 404);
      const key = `plan:${file.id}`;
      let changed = { ok: false, error: 'Unknown group.' } as ReturnType<typeof setChoice>;
      // atomic: an approval and a save from the Groups page at the same moment don't overwrite each other
      const plan = await store.updateGroupData(key, (current) => {
        const p = cleanPlan(current);
        changed = setChoice(p, body);
        return p;
      });
      if (!changed.ok) return json({ error: changed.error }, 400);
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
    // atomic: two cards saving at the same moment keep both notes
    const next = await store.updateGroupData(key, (current) => setNote(cleanFeedback(current), note.value.key, note.value.text, note.value.entries, a.by));
    return json({ ok: true, note: next[note.value.key] ?? null });
  } catch (error) {
    console.error('[project-feedback] could not save', error);
    return json({ error: 'Could not save.' }, 500);
  }
};
