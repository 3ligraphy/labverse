/** GET /api/admin/marking/export — the merged Phase 1 marking workbook (final sheet, one sheet per TA, summary). */
import type { APIRoute } from 'astro';
import { canManageSubmissions } from '@/lib/accounts/labscope';
import { getFilesStore } from '@/lib/project-files/server';
import { buildXlsx } from '@/lib/xlsx';
import { markingSheets } from '@/lib/marking/export';
import { defaultSource, loadMarking, markGroups } from '@/lib/marking/server';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  if (!(await canManageSubmissions(cookies))) return new Response('Unauthorised', { status: 401 });
  const store = getFilesStore();
  if (!store) return new Response('No database', { status: 503 });
  try {
    const doc = await loadMarking(store);
    const source = doc.source ?? (await defaultSource(store));
    const groups = source ? await markGroups(store, source) : [];
    const file = await buildXlsx(markingSheets(doc, groups.map((g) => g.number)));
    const day = new Date().toISOString().slice(0, 10);
    return new Response(new Blob([file as Uint8Array<ArrayBuffer>]), {
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="phase1-marks-${day}.xlsx"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[marking] export failed', error);
    return new Response('Could not build the workbook', { status: 500 });
  }
};
