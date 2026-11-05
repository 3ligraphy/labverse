/** GET /api/modules/state?module=slug — { locked, staff }: for the lock overlay on course pages and the staff bar. */
import type { APIRoute } from 'astro';
import { moduleAccess } from '@/lib/accounts/enrolment';
import { json } from '@/lib/progress/server';

export const prerender = false;

export const GET: APIRoute = async ({ cookies, url }) => {
  const module = url.searchParams.get('module') ?? '';
  const a = await moduleAccess(cookies, module);
  return json({ locked: a.locked, staff: a.staff });
};
