/**
 * Admin → Marking (Phase 1).
 *   GET   { doc, me, files, groups, staff, changes, loadSaved }   everyone with submissions access (TAs see every group)
 *   PUT   { action: 'marks', group, scores, comment, help }   a TA for the groups of their load row; admins any group
 *         { action: 'import', rows: [{ group, ta, scores, comment }] }   rows read from a marking workbook
 *         { action: 'source', fileId }                  admin: the item whose group numbers are used
 *         { action: 'load', tas } | { action: 'load-rows', rows }   admin: the marking load
 *         { action: 'publish', published } | { action: 'unlock', unlocked }   admin
 * Until an admin saves a marking load, the team's default load is used (src/lib/marking/defaults.ts); rows are
 * linked to staff accounts by first name. Every save stores the load as it was shown.
 * Rules: src/lib/marking/doc.ts. Saves are read-change-write, so two TAs saving at once never lose a mark.
 */
import type { APIRoute } from 'astro';
import { access } from '@/lib/accounts/access';
import { canManageSubmissions } from '@/lib/accounts/labscope';
import { json } from '@/lib/progress/server';
import { getFilesStore } from '@/lib/project-files/server';
import { MARKING_KEY, applyImport, applyMarks, cleanDoc, groupNumber, loadFromRows, memberChanges, myRow, type ImportRow } from '@/lib/marking/doc';
import { defaultSource, loadMarking, markGroups, markerOf, prepared, staffList } from '@/lib/marking/server';

export const prerender = false;

const MAX_BODY = 1024 * 1024;
const ADMIN_ONLY = new Set(['source', 'load', 'load-rows', 'publish', 'unlock']);

async function context(cookies: Parameters<typeof canManageSubmissions>[0]) {
  if (!(await canManageSubmissions(cookies))) return json({ error: 'Unauthorized' }, 401);
  const store = getFilesStore();
  if (!store) return json({ error: 'No database is connected.' }, 503);
  const a = await access(cookies);
  return { store, me: markerOf(a) };
}

export const GET: APIRoute = async ({ cookies }) => {
  const c = await context(cookies);
  if (c instanceof Response) return c;
  const { store, me } = c;
  try {
    const staff = await staffList();
    const saved = await loadMarking(store);
    const doc = prepared(saved, staff);
    const files = (await store.list()).map((f) => ({ id: f.id, title: f.title }));
    const source = doc.source && files.some((f) => f.id === doc.source) ? doc.source : await defaultSource(store);
    const groups = source ? await markGroups(store, source) : [];
    const changes = memberChanges(doc, groups.map((g) => ({ number: g.number, members: g.members.map((m) => m.id) })));
    return json({ doc: { ...doc, source }, me: { ...me, row: myRow(doc, me.email)?.name ?? null }, files, groups, staff, changes, loadSaved: saved.tas.length > 0 });
  } catch (error) {
    console.error('[marking] could not load', error);
    return json({ error: 'Could not load the marking.' }, 500);
  }
};

export const PUT: APIRoute = async ({ cookies, request }) => {
  const c = await context(cookies);
  if (c instanceof Response) return c;
  const { store, me } = c;
  if (me.role === 'none') return json({ error: 'Only TAs and admins can mark.' }, 403);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: 'That is too much data to save at once.' }, 413);
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }
  const action = String(body.action ?? '');
  if (ADMIN_ONLY.has(action) && me.role !== 'admin') return json({ error: 'Only an admin can change this.' }, 403);
  try {
    const [files, staff] = await Promise.all([store.list(), staffList()]);
    const before = await loadMarking(store);
    const source = before.source && files.some((f) => f.id === before.source) ? before.source : await defaultSource(store);
    const groups = source ? await markGroups(store, source) : [];
    const known = new Set(groups.map((g) => g.number));
    const membersOf = (n: number) => groups.find((g) => g.number === n)?.members.map((m) => m.id) ?? [];
    let extra: Record<string, unknown> = {};
    const doc = await store.updateGroupData(MARKING_KEY, (current) => {
      const d = prepared(cleanDoc(current), staff);
      d.source = d.source ?? source;
      extra = {};
      if (action === 'marks') {
        const n = groupNumber(body.group);
        if (n === null || !known.has(n)) extra.error = 'There is no such group.';
        else {
          const r = applyMarks(d, me, n, { scores: body.scores, comment: body.comment, help: body.help }, membersOf(n));
          if (!r.ok) extra.error = r.error;
        }
      } else if (action === 'import') {
        const rows = (Array.isArray(body.rows) ? body.rows.slice(0, 300) : []) as ImportRow[];
        const unknown = rows.filter((r) => !known.has(groupNumber(r.group) ?? -1)).map((r) => ({ group: groupNumber(r.group) ?? 0, reason: 'This group number is not in the groups of the item.' }));
        const out = applyImport(d, me, rows.filter((r) => known.has(groupNumber(r.group) ?? -1)), membersOf);
        extra = { imported: out.imported, skipped: [...out.skipped, ...unknown] };
      } else if (action === 'source') {
        const id = String(body.fileId ?? '');
        if (!files.some((f) => f.id === id)) extra.error = 'Unknown item.';
        else d.source = id;
      } else if (action === 'load') {
        d.tas = cleanDoc({ tas: body.tas }).tas;
      } else if (action === 'load-rows') {
        loadFromRows(d, (Array.isArray(body.rows) ? body.rows.slice(0, 300) : []) as ImportRow[]);
      } else if (action === 'publish') {
        d.published = body.published === true;
        d.publishedAt = new Date().toISOString();
        d.publishedBy = me.name ?? '';
      } else if (action === 'unlock') {
        d.unlocked = body.unlocked === true;
      } else extra.error = 'Unknown action.';
      return prepared(d, staff);
    });
    if (extra.error) return json({ error: extra.error }, 400);
    return json({ ok: true, doc, ...extra });
  } catch (error) {
    console.error('[marking] could not save', error);
    return json({ error: 'Could not save. Try again.' }, 500);
  }
};
