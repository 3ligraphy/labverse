/**
 * A student's proposal result (public, for /project). Only items whose results staff have published are shown.
 *   GET                      { items: [{ id, title }] }  the published items (so the page knows to show the box)
 *   GET ?studentId=…         { results: [{ item, group, members, idea, feedback, phase1 }] }  the student's own group only
 *                            (phase1: the marks, or { call: true } when the group is called in to discuss its project)
 * Lookups are limited per network address, so nobody can try every ID; members come with their IDs so teammates can find each other.
 * Each lookup that finds a group is recorded, so staff can see who has checked (admin feedback page).
 */
import type { APIRoute } from 'astro';
import { clientIp } from '@/lib/attendance/server';
import { getProgressStore, json } from '@/lib/progress/server';
import { ID_RE } from '@/lib/project-files/core';
import { cleanFeedback, placeNotes } from '@/lib/project-files/feedback';
import { buildGroups, cleanPlan, emptyPlan, ideasAsChoices, type Student } from '@/lib/project-files/groups';
import { canonFor, loadCanon } from '@/lib/project-files/course-groups';
import { cleanRelease, resultFor } from '@/lib/project-files/results';
import { getFilesStore } from '@/lib/project-files/server';
import { normId } from '@/lib/project-files/groups';
import { loadMarking } from '@/lib/marking/server';
import { studentPhase1 } from '@/lib/marking/doc';

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
    // Phase 1 marks (Admin → Marking) are shown with the item whose group numbers they use, once staff publish them
    const marking = await loadMarking(store).catch(() => null);
    const marksOn = marking?.published ? marking.source : null;
    const published = files.filter((f, i) => cleanRelease(releases[i]).published || f.id === marksOn);
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
    // the course groups: every item shows the proposal's group number, members and approved idea
    const course = await loadCanon(store, files);
    const results = [];
    for (const file of published) {
      const [entries, plan, feedback] = await Promise.all([
        store.listEntries(file.id), store.getGroupData<unknown>(`plan:${file.id}`), store.getGroupData<unknown>(`feedback:${file.id}`),
      ]);
      const p = plan ? cleanPlan(plan) : emptyPlan();
      const canon = canonFor(file, course);
      const groups = buildGroups(entries, roster, p, canon);
      const { notes } = placeNotes(groups, cleanFeedback(feedback));
      const r = resultFor(groups, canon ? { choices: ideasAsChoices(canon) } : p, notes, studentId);
      if (!r) continue;
      // the marking's item: a group called in to discuss its project (the AI button) sees only the call, no marks and
      // no feedback; any other group sees its marks once they are published
      let phase1 = null;
      let shownFeedback = r.feedback;
      if (marking && file.id === marking.source) {
        const g = groups.find((x) => x.numbered && x.members.some((m) => m.id === normId(studentId)));
        const n = g ? Number(/^G(\d+)$/.exec(g.key)?.[1] ?? NaN) : NaN;
        phase1 = studentPhase1(marking, Number.isInteger(n) ? n : null, file.id === marksOn);
        if (phase1?.call) shownFeedback = null;
      }
      results.push({ item: file.title, ...r, feedback: shownFeedback, phase1 });
      // never fail the student's lookup over the record
      await store.recordView(file.id, studentId).catch((error) => console.error('[project-result] could not record the view', error));
    }
    return new Response(JSON.stringify({ results }), { headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' } });
  } catch (error) {
    console.error('[project-result] could not load', error);
    return json({ error: 'Could not load the results. Try again in a moment.' }, 500);
  }
};
