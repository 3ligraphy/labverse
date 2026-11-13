/**
 * GET /api/status — { database: 'ok' | 'down' | 'none' }: can the course database be reached right now?
 * Every page asks now and then (the "Saving is off" strip, see Base.astro). The CDN keeps the answer for 15 seconds,
 * so a full lab room costs about one database read. Read-only: no names, no cookies.
 */
import type { APIRoute } from 'astro';
import { databaseDown } from '@/lib/outage-server';

export const prerender = false;

export const GET: APIRoute = async () => {
  const down = await databaseDown();
  return new Response(JSON.stringify({ database: down === null ? 'none' : down ? 'down' : 'ok' }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=0, s-maxage=15, stale-while-revalidate=30' },
  });
};
