/** GET /api/admin/attendance/export?module=<slug> — the weekly attendance register as an Excel workbook. */
import type { APIRoute } from 'astro';
import { isAdmin, noStore } from '@/lib/attendance/server';
import { access } from '@/lib/accounts/access';
import { canOnLab } from '@/lib/accounts/labscope';
import { buildRegisterFor } from '@/lib/progress/server';
import { registerWorkbook } from '@/lib/attendance/workbook';
import { cairoDate } from '@/lib/attendance/weekly';

export const prerender = false;

export const GET: APIRoute = async ({ cookies, url }) => {
  if (!isAdmin(cookies)) return new Response('Unauthorised', { status: 401 });
  const module = url.searchParams.get('module') ?? 'mobile-development';
  const a = await access(cookies);
  if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(module) || !(a.can('module.sessions', module) || a.can('module.progress', module))) return new Response('Forbidden', { status: 403 });
  try {
    const data = await buildRegisterFor(module, (lab) => canOnLab(a, 'module.sessions', lab) || canOnLab(a, 'module.progress', lab));
    if (!data) return new Response('No database', { status: 503 });
    const file = await registerWorkbook(data.register, { module: data.moduleTitle });
    return new Response(new Blob([file as Uint8Array<ArrayBuffer>]), {
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="${module}-attendance-${cairoDate(Date.now())}.xlsx"`,
        ...noStore,
      },
    });
  } catch (err) {
    console.error('[attendance] export failed', err);
    return new Response('Could not build the workbook', { status: 500 });
  }
};
