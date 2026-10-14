/**
 * A student's proposal result (public, for /project). Only items whose results staff have published are shown.
 *   GET                      { items: [{ id, title }] }  the published items (so the page knows to show the box)
 *   GET ?studentId=…         { results: [{ item, group, members, idea, feedback }] }  the student's own group only
 * Lookups are limited per network address, so nobody can try every ID; members are names only, never IDs.
 */
import type { APIRoute } from 'astro';
import { clientIp } from '@/lib/attendance/server';
import { getProgressStore, json } from '@/lib/progress/server';
import { ID_RE } from '@/lib/project-files/core';
import { cleanFeedback, placeNotes } from '@/lib/project-files/feedback';
import { buildGroups, cleanPlan, emptyPlan, type Student } from '@/lib/project-files/groups';
import { cleanRelease, resultFor } from '@/lib/project-files/results';
import { getFilesStore } from '@/lib/project-files/server';

export const prerender = false;

// a whole lab room can share one campus address, so this allows a class at once but not guessing thousands of IDs
const LOOKUPS_PER_WINDOW = 200;
const WINDOW_SEC = 10 * 60;

export const GET: APIRoute = async ({ url, request, clientAddress }) => {
  const store = getFilesStore();
  if (!store) return json({ items: [], results: [] });
  try {
    const files = await store.list();
    const releases = await Promise.all(files.map((f) => store.getGroupData<unknown>(`release:${f.id}`)));
    const published = files.filter((_, i) => cleanRelease(releases[i]).published);
    const studentId = (url.searchParams.get('studentId') ?? '').trim().toUpperCase();
    if (!studentId) {
      return new Response(JSON.stringify({ items: published.map((f) => ({ id: f.id, title: f.title })) }), {
        headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=60' },
      });
    }
    if (!ID_RE.test(studentId)) return json({ error: 'Type your student ID (letters and numbers only).' }, 400);
    const tries = (await getProgressStore()?.hit(`result:${clientIp(request, clientAddress)}`, WINDOW_SEC).catch(() => 0)) ?? 0;
    if (tries > LOOKUPS_PER_WINDOW) return json({ error: 'Too many lookups from this device. Wait a few minutes and try again.' }, 429);
    const roster = (await store.getGroupData<Student[]>('roster')) ?? [];
    const results = [];
    for (const file of published) {
      const [entries, plan, feedback] = await Promise.all([
        store.listEntries(file.id), store.getGroupData<unknown>(`plan:${file.id}`), store.getGroupData<unknown>(`feedback:${file.id}`),
      ]);
      const p = plan ? cleanPlan(plan) : emptyPlan();
      const groups = buildGroups(entries, roster, p);
      const { notes } = placeNotes(groups, cleanFeedback(feedback));
      const r = resultFor(groups, p, notes, studentId);
      if (r) results.push({ item: file.title, ...r });
    }
    return new Response(JSON.stringify({ results }), { headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' } });
  } catch (error) {
    console.error('[project-result] could not load', error);
    return json({ error: 'Could not load the results. Try again in a moment.' }, 500);
  }
};
