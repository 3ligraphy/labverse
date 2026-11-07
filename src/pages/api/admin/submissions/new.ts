/**
 * GET /api/admin/submissions/new — hand-ins no staff member has opened yet: { pending, items: [{ fileId, title,
 * module, moduleTitle, count, href }] }. The red badge on Submissions in the admin menu and the admin home use it.
 */
import type { APIRoute } from 'astro';
import { isAdmin } from '@/lib/attendance/server';
import { json } from '@/lib/progress/server';
import { getFilesStore } from '@/lib/project-files/server';
import { hubData } from '@/lib/accounts/hub';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdmin(cookies)) return json({ error: 'Unauthorized' }, 401);
  const store = getFilesStore();
  if (!store) return json({ pending: 0, items: [] });
  try {
    const [rows, { cards }] = await Promise.all([store.unseen(), hubData()]);
    const items = rows.map((r) => ({
      fileId: r.file_id, title: r.title, module: r.module, count: r.count, href: `/admin/project/${encodeURIComponent(r.file_id)}`,
      moduleTitle: cards.find((c) => c.slug === r.module)?.title ?? r.module,
    }));
    return json({ pending: items.reduce((n, i) => n + i.count, 0), items });
  } catch (error) {
    console.error('[submissions] could not count new hand-ins', error);
    return json({ pending: 0, items: [], error: 'server' }, 500);
  }
};
