/**
 * GET /preview/<key>/… — a student's app build (scripts/previews/build.mjs), served in a sandbox: its page gets
 * `Content-Security-Policy: sandbox` (an origin of its own, so it never sees the site's cookies or storage) and may
 * only be framed by the site (Admin → Marking shows it in a phone frame). Paths with no file are the app's routes.
 */
import type { APIRoute } from 'astro';
import { getFilesStore } from '@/lib/project-files/server';
import { KEY_RE, buildFile, previewHeaders, withShim } from '@/lib/previews/core';
import { buildFiles } from '@/lib/previews/server';

export const prerender = false;

const gone = (text: string, status: number) => new Response(text, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex', 'cache-control': 'no-store' } });

export const GET: APIRoute = async ({ params }) => {
  const key = params.key ?? '';
  if (!KEY_RE.test(key)) return gone('Not found.', 404);
  const store = getFilesStore();
  if (!store) return gone('No database is connected.', 503);
  try {
    const files = await buildFiles(store, key);
    if (!files) return gone('This app build was removed or replaced. Reopen the group on the marking page.', 404);
    const file = buildFile(params.path ?? '', (p) => files.has(p));
    if (!file) return gone('Not found.', 404);
    const bytes = files.get(file)!;
    const body = /\.html$/i.test(file) ? withShim(new TextDecoder().decode(bytes)) : bytes;
    return new Response(body as BodyInit, { headers: previewHeaders(file) });
  } catch (error) {
    console.error('[preview] could not serve', key, error);
    return gone('Could not load this app build. Try again.', 500);
  }
};
