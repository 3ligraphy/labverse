/** GET /api/project/files[?module=] — a module's published items (the course's by default), for /project, the banner and the NEW badge (public). */
import type { APIRoute } from 'astro';
import { getFilesStore } from '@/lib/project-files/server';
import { COURSE_MODULE } from '@/lib/project-files/core';

export const prerender = false;

// Every page asks for this (banner + badge), so let the CDN absorb it; a new item shows up within ~30 s.
const headers = { 'content-type': 'application/json', 'cache-control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=60' };

export const GET: APIRoute = async ({ url }) => {
  const store = getFilesStore();
  if (!store) return new Response(JSON.stringify({ files: [] }), { headers });
  try {
    const files = (await store.list(url.searchParams.get('module') || COURSE_MODULE)).map(({ pathname, published_by, ...file }) => file);
    return new Response(JSON.stringify({ files }), { headers });
  } catch (error) {
    console.error('[project-files] could not list files', error);
    return new Response(JSON.stringify({ error: 'Could not load files.' }), { status: 500, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  }
};
