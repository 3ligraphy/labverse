/** GET /api/progress/overview — staff only: each module's students and their average score, for the staff home page. */
import type { APIRoute } from 'astro';
import { isAdmin } from '@/lib/attendance/server';
import { classOverview, json } from '@/lib/progress/server';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdmin(cookies)) return json({ error: 'unauthorised' }, 401);
  try {
    return json({ modules: await classOverview() });
  } catch (error) {
    console.error('[progress] class overview failed', error);
    return json({ modules: {}, error: 'server' }, 500);
  }
};
