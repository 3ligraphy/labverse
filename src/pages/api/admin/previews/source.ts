/**
 * Admin: a group's app code from its GitHub repo, for "Open in BUENOVA Code" and the auto-marker (Admin → Marking).
 *   GET ?repo=owner/name   a ZIP of the repo's Expo app folder (default branch), without node_modules, native
 *                          folders, build output or very large files (src/lib/previews/source.ts)
 * GitHub does not let a browser download a repo ZIP from another site, so staff get it through here. Staff only;
 * the code is only read and repacked here, never run.
 */
import type { APIRoute } from 'astro';
import { unzipSync, zipSync } from 'fflate';
import { canManageSubmissions } from '@/lib/accounts/labscope';
import { json } from '@/lib/progress/server';
import { cleanRepo } from '@/lib/previews/core';
import { MAX_FILE_BYTES, appFiles, appRoot } from '@/lib/previews/source';

export const prerender = false;

const MAX_REPO_BYTES = 120 * 1024 * 1024;
const dec = new TextDecoder();

export const GET: APIRoute = async ({ url, cookies }) => {
  if (!(await canManageSubmissions(cookies))) return json({ error: 'Unauthorized' }, 401);
  const repo = cleanRepo(url.searchParams.get('repo'));
  if (!repo) return json({ error: 'That is not a GitHub repo.' }, 400);
  try {
    const res = await fetch(`https://codeload.github.com/${repo}/zip/HEAD`, { headers: { 'user-agent': 'buenova-marking' }, redirect: 'follow' });
    if (res.status === 404) return json({ error: `github.com/${repo} is private, renamed or deleted.` }, 404);
    if (!res.ok) return json({ error: `GitHub answered ${res.status}.` }, 502);
    if (Number(res.headers.get('content-length') ?? 0) > MAX_REPO_BYTES) return json({ error: 'The repo is too big to open here.' }, 413);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > MAX_REPO_BYTES) return json({ error: 'The repo is too big to open here.' }, 413);

    // first only the package.json files, to find the app folder; then only that folder's files
    const sizes: { name: string; size: number }[] = [];
    const pkgs = unzipSync(bytes, { filter: (f) => { sizes.push({ name: f.name, size: f.originalSize }); return /(^|\/)package\.json$/.test(f.name) && f.originalSize < 200_000; } });
    const root = appRoot(Object.entries(pkgs).map(([path, b]) => ({ path, text: dec.decode(b) })));
    if (root === null) return json({ error: `No Expo or React Native app (package.json) in github.com/${repo}.` }, 422);
    const want = new Set(appFiles(sizes, root));
    const files = unzipSync(bytes, { filter: (f) => want.has(f.name) && f.originalSize <= MAX_FILE_BYTES });
    const out: Record<string, Uint8Array> = {};
    for (const [name, b] of Object.entries(files)) out[name.slice(root.length)] = b;
    const zip = zipSync(out, { level: 1 });
    // streamed, so a bigger app is not cut by the platform's response size limit
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < zip.length; i += 256 * 1024) c.enqueue(zip.subarray(i, i + 256 * 1024));
        c.close();
      },
    });
    return new Response(body, { headers: { 'content-type': 'application/zip', 'cache-control': 'private, max-age=600', 'x-app-root': encodeURIComponent(root), 'x-app-files': String(want.size) } });
  } catch (error) {
    console.error('[previews] could not get the repo', error);
    return json({ error: 'Could not get the code from GitHub. Try again.' }, 502);
  }
};
