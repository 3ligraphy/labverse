/**
 * GET /api/admin/marking/export — the Phase 1 marks as a file.
 *   (no query)            the merged workbook: final sheet, one sheet per TA, summary (.xlsx)
 *   ?mine=1 | ?ta=<name>  one TA's sheet with their groups and saved marks, to fill offline and upload again
 *   &format=csv           the same sheet as CSV (with no TA: the final sheet with every group)
 */
import type { APIRoute } from 'astro';
import { access } from '@/lib/accounts/access';
import { canManageSubmissions } from '@/lib/accounts/labscope';
import { getFilesStore } from '@/lib/project-files/server';
import { buildXlsx } from '@/lib/xlsx';
import { myRow } from '@/lib/marking/doc';
import { markingSheets, sheetToCsv } from '@/lib/marking/export';
import { defaultSource, loadMarking, markGroups, markerOf, prepared, staffList } from '@/lib/marking/server';

export const prerender = false;

const safe = (s: string) => s.normalize('NFKD').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'ta';

export const GET: APIRoute = async ({ cookies, url }) => {
  if (!(await canManageSubmissions(cookies))) return new Response('Unauthorised', { status: 401 });
  const store = getFilesStore();
  if (!store) return new Response('No database', { status: 503 });
  try {
    const doc = prepared(await loadMarking(store), await staffList());
    const files = await store.list();
    const source = doc.source && files.some((f) => f.id === doc.source) ? doc.source : await defaultSource(store);
    const groups = (source ? await markGroups(store, source) : []).map((g) => g.number);
    const csv = url.searchParams.get('format') === 'csv';
    let ta = url.searchParams.get('ta');
    if (url.searchParams.get('mine') === '1') {
      ta = myRow(doc, markerOf(await access(cookies)).email)?.name ?? null;
      if (!ta) return new Response('Your account is not linked to a row of the marking load yet.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
    const sheets = markingSheets(doc, groups, ta === null ? {} : { ta });
    if (!sheets.length) return new Response('There is no such TA in the marking load.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    const day = new Date().toISOString().slice(0, 10);
    const base = ta === null ? `phase1-marks-${day}` : `phase1-${safe(ta)}-${day}`;
    const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
    if (csv) {
      return new Response(sheetToCsv(sheets[0]), { headers: { ...headers, 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${base}.csv"` } });
    }
    const file = await buildXlsx(sheets);
    return new Response(new Blob([file as Uint8Array<ArrayBuffer>]), {
      headers: { ...headers, 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': `attachment; filename="${base}.xlsx"` },
    });
  } catch (error) {
    console.error('[marking] export failed', error);
    return new Response('Could not build the file', { status: 500 });
  }
};
