/**
 * Admin: app previews (Admin → Marking → a group → App, and the App builds box).
 *   GET  ?item=…                                   { list, info } the item's hand-ins with their course group, repo
 *                                                  and build; `list` is also the builder's build list
 *   GET  ?all=1                                    { lists } the build list of every item with hand-ins (not the proposal)
 *   PUT  { action: 'repo', item, entry, repo, found }   the GitHub repo found in a hand-in (found) or typed by staff
 *   PUT  { action: 'build', item, url, pathname, size } registers a build ZIP uploaded to Blob
 *   PUT  { action: 'failed', item, entry, note }   the automatic build of this hand-in failed (retried a day later)
 *   PUT  { action: 'remove', item, entry }         removes a hand-in's build
 *   POST multipart { item, file }                  (a laptop without Blob) uploads and registers a build ZIP
 * Builds are made by scripts/previews/build.mjs, every hour by the App builds workflow (.github/workflows/app-builds.yml,
 * which signs in with GitHub's OIDC token: src/lib/previews/builder-auth.ts) or by staff on a computer with Docker.
 * The builder may only list, report repos and failures, and register builds. Served at /preview/<key>/.
 */
import type { APIRoute, AstroCookies } from 'astro';
import { access } from '@/lib/accounts/access';
import { canManageSubmissions } from '@/lib/accounts/labscope';
import { json } from '@/lib/progress/server';
import { safeFileName } from '@/lib/project-files/core';
import { withGroups } from '@/lib/project-files/course-groups';
import { blobFolder, deleteStored, getFilesStore, saveLocal, storageMode } from '@/lib/project-files/server';
import { MAX_BUILD_BYTES, buildList, cleanRepo } from '@/lib/previews/core';
import { BUILDER_NAME, isBuilder } from '@/lib/previews/builder-auth';
import { forgetBuild, loadPreviews, recordFailure, registerBuild, updatePreviews } from '@/lib/previews/server';

export const prerender = false;

type Store = NonNullable<ReturnType<typeof getFilesStore>>;

async function itemOf(store: Store, id: unknown) {
  const file = await store.get(String(id ?? ''));
  return file ? { file, entries: await store.listEntries(file.id) } : null;
}

/** 'staff' (a signed-in TA / admin), 'builder' (the App builds workflow), or null. */
async function who(cookies: AstroCookies, request: Request): Promise<'staff' | 'builder' | null> {
  if (await canManageSubmissions(cookies)) return 'staff';
  return (await isBuilder(request)) ? 'builder' : null;
}

export const GET: APIRoute = async ({ url, cookies, request }) => {
  const role = await who(cookies, request);
  if (!role) return json({ error: 'Unauthorized' }, 401);
  const store = getFilesStore();
  if (!store) return json({ error: 'No database is connected.' }, 503);
  try {
    if (url.searchParams.get('all') === '1') {
      // every item students hand an app in for: the proposal has no app
      const previews = await loadPreviews(store);
      const lists = [];
      for (const file of await store.list()) {
        if (file.kind === 'proposal') continue;
        const entries = await store.listEntries(file.id);
        if (entries.length) lists.push(buildList(file.id, await withGroups(store, file, entries), previews));
      }
      return json({ lists, folder: blobFolder() });
    }
    const item = await itemOf(store, url.searchParams.get('item'));
    if (!item) return json({ error: 'Unknown item.' }, 404);
    const [entries, previews] = await Promise.all([withGroups(store, item.file, item.entries), loadPreviews(store)]);
    const info = Object.fromEntries(entries.filter((e) => previews[e.id]).map((e) => {
      const p = previews[e.id];
      return [e.id, { repo: p.repo, repoBy: p.repoBy, checked: p.checked, fail: p.fail ?? null, build: p.build ? { key: p.build.key, source: p.build.source, repo: p.build.repo, sha: p.build.sha, sdk: p.build.sdk, builtAt: p.build.builtAt, by: p.build.by, size: p.build.size } : null }];
    }));
    return json({ list: buildList(item.file.id, entries, previews), info, upload: storageMode(), folder: blobFolder() });
  } catch (error) {
    console.error('[previews] could not load', error);
    return json({ error: 'Could not load the app builds.' }, 500);
  }
};

export const PUT: APIRoute = async ({ request, cookies }) => {
  const role = await who(cookies, request);
  if (!role) return json({ error: 'Unauthorized' }, 401);
  const store = getFilesStore();
  if (!store) return json({ error: 'No database is connected.' }, 503);
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  // the builder reports what it found and built; it never removes builds or types repos
  if (role === 'builder' && !(body.action === 'build' || body.action === 'failed' || (body.action === 'repo' && body.found === true))) return json({ error: 'Not allowed.' }, 403);
  try {
    const item = await itemOf(store, body.item);
    if (!item) return json({ error: 'Unknown item.' }, 404);
    if (body.action === 'failed') {
      const entry = item.entries.find((e) => e.id === body.entry);
      if (!entry) return json({ error: 'Unknown hand-in.' }, 404);
      await recordFailure(store, entry, String(body.note ?? ''));
      return json({ ok: true });
    }
    if (body.action === 'repo') {
      const entry = item.entries.find((e) => e.id === body.entry);
      if (!entry) return json({ error: 'Unknown hand-in.' }, 404);
      const typed = String(body.repo ?? '').trim();
      const repo = typed ? cleanRepo(typed) : null;
      if (typed && !repo) return json({ error: 'Paste the GitHub link of the app, like https://github.com/owner/repo.' }, 400);
      await updatePreviews(store, (p) => {
        const cur = p[entry.id] ?? { repo: null, repoBy: null, checked: '', build: null };
        // a repo staff typed is kept over one found later
        if (body.found === true && cur.repoBy === 'staff') { p[entry.id] = { ...cur, checked: entry.updated_at }; return; }
        p[entry.id] = { ...cur, repo, repoBy: repo ? (body.found === true ? 'found' : 'staff') : null, checked: entry.updated_at };
      });
      return json({ ok: true, repo });
    }
    if (body.action === 'build') {
      const by = role === 'builder' ? BUILDER_NAME : (await access(cookies)).by;
      const r = await registerBuild(store, { url: String(body.url ?? ''), pathname: String(body.pathname ?? ''), size: Number(body.size) || 0 }, item.entries, by);
      return r.ok ? json({ ok: true, entry: r.entry, key: r.build.key }) : json({ error: r.error }, 400);
    }
    if (body.action === 'remove') {
      const entry = String(body.entry ?? '');
      let old: { key: string; url: string; pathname: string } | null = null;
      await updatePreviews(store, (p) => {
        if (p[entry]?.build) { old = p[entry].build; p[entry] = { ...p[entry], build: null }; }
      });
      if (old) { forgetBuild((old as { key: string }).key); await deleteStored(old); }
      return json({ ok: true });
    }
    return json({ error: 'Unknown action.' }, 400);
  } catch (error) {
    console.error('[previews] could not save', error);
    return json({ error: 'Could not save.' }, 500);
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!(await canManageSubmissions(cookies))) return json({ error: 'Unauthorized' }, 401);
  const store = getFilesStore();
  if (!store) return json({ error: 'No database is connected.' }, 503);
  if (storageMode() !== 'local') return json({ error: 'Upload through Vercel Blob on this deployment.' }, 400);
  try {
    const form = await request.formData();
    const item = await itemOf(store, form.get('item'));
    const file = form.get('file');
    if (!item) return json({ error: 'Unknown item.' }, 404);
    if (!(file instanceof File) || !file.size) return json({ error: 'Choose a build ZIP.' }, 400);
    if (file.size > MAX_BUILD_BYTES) return json({ error: 'The build is too big (over 40 MB).' }, 400);
    const saved = await saveLocal(safeFileName(file.name, 'zip'), new Uint8Array(await file.arrayBuffer()));
    const r = await registerBuild(store, { ...saved, size: file.size }, item.entries, (await access(cookies)).by);
    return r.ok ? json({ ok: true, entry: r.entry, key: r.build.key }) : json({ error: r.error }, 400);
  } catch (error) {
    console.error('[previews] could not upload', error);
    return json({ error: 'Could not upload the build.' }, 500);
  }
};
