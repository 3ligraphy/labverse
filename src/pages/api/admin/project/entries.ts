/**
 * Admin: student hand-ins.
 *   GET    ?q=…                  search every item's hand-ins by name, ID, group or note (max 50)
 *   GET    ?file=…               { file, entries } for one item
 *   GET    ?file=…&format=csv    spreadsheet export
 * On the course's items every hand-in carries `group`: its course group ("G12", the proposal's number; '' when it
 * is in none), which the lists, the CSV and the ZIP use instead of the number the student typed.
 *   DELETE ?id=…                 removes one hand-in and its PDF (the student can then hand in again)
 */
import type { APIRoute } from 'astro';
import { canManageSubmissions } from '@/lib/accounts/labscope';
import { isAdmin, noStore } from '@/lib/attendance/server';
import { json } from '@/lib/progress/server';
import { entriesCsv, isLate } from '@/lib/project-files/core';
import { deleteStored, getFilesStore } from '@/lib/project-files/server';
import { loadCanon, withGroups } from '@/lib/project-files/course-groups';
import { COURSE_MODULE } from '@/lib/project-files/core';

export const prerender = false;

export const GET: APIRoute = async ({ url, cookies }) => {
  if (!isAdmin(cookies)) return json({ error: 'Unauthorized' }, 401);
  const store = getFilesStore();
  if (!store) return json({ error: 'No database is connected.' }, 503);
  try {
    const q = (url.searchParams.get('q') ?? '').trim();
    if (q) {
      if (q.length < 2 || q.length > 60) return json({ results: [] });
      const [results, files, canon] = await Promise.all([store.searchEntries(q), store.list(), loadCanon(store)]);
      const course = new Set(files.filter((f) => f.module === COURSE_MODULE).map((f) => f.id));
      return json({
        results: results.map((e) => ({ ...e, late: isLate(e, e.updated_at), ...(course.has(e.file_id) ? { group: canon?.members[e.student_id.trim().toUpperCase()] ?? '' } : {}) })),
      });
    }
    const file = await store.get(url.searchParams.get('file') ?? '');
    if (!file) return json({ error: 'Not found.' }, 404);
    if (!(await canManageSubmissions(cookies, file.module))) return json({ error: 'Unauthorized' }, 401);
    const entries = await withGroups(store, file, await store.listEntries(file.id));
    if (url.searchParams.get('format') === 'csv') {
      const name = file.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'submissions';
      return new Response('﻿' + entriesCsv(file, entries), {
        headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}.csv"`, ...noStore },
      });
    }
    return json({ file, entries: entries.map((e) => ({ ...e, late: isLate(file, e.updated_at) })) });
  } catch (error) {
    console.error('[project-files] could not list entries', error);
    return json({ error: 'Could not load submissions.' }, 500);
  }
};

export const DELETE: APIRoute = async ({ url, cookies }) => {
  if (!(await canManageSubmissions(cookies))) return json({ error: 'Unauthorized' }, 401);
  const store = getFilesStore();
  if (!store) return json({ error: 'No database is connected.' }, 503);
  try {
    const removed = await store.removeEntry(url.searchParams.get('id') ?? '');
    if (!removed) return json({ error: 'Not found.' }, 404);
    await deleteStored(removed);
    return json({ ok: true });
  } catch (error) {
    console.error('[project-files] could not delete entry', error);
    return json({ error: 'Could not delete.' }, 500);
  }
};
