/**
 * Server side of the app previews: the saved previews (project-files group data `previews:v1`: hand-in id → repo and
 * build), registering an uploaded build ZIP, and reading a build's files for /preview/<key>/ (kept in memory for a
 * few builds, so a page's many files are read from one download).
 */
import { head } from '@vercel/blob';
import { unzipSync } from 'fflate';
import { blobFolder, blobToken, deleteStored, readLocal, type getFilesStore } from '@/lib/project-files/server';
import { KEY_RE, MAX_BUILD_BYTES, cleanPreviews, cleanRepo, entryFor, type Build, type Previews } from './core';

type Store = NonNullable<ReturnType<typeof getFilesStore>>;

export const PREVIEWS_KEY = 'previews:v1';
/** Where build ZIPs are stored: <blob folder>/previews/<key>.zip */
export const previewPath = (key: string) => `${blobFolder()}/previews/${key}.zip`;

export const loadPreviews = async (store: Store): Promise<Previews> => cleanPreviews(await store.getGroupData<unknown>(PREVIEWS_KEY));

/** Read-change-write of the saved previews (two TAs saving at once never lose a change). */
export const updatePreviews = (store: Store, change: (p: Previews) => void) =>
  store.updateGroupData<Previews>(PREVIEWS_KEY, (current) => {
    const p = cleanPreviews(current);
    change(p);
    return p;
  });

async function zipBytes(build: Pick<Build, 'url' | 'pathname'>): Promise<Uint8Array | null> {
  if (build.pathname.startsWith('local/')) return (await readLocal(build.pathname.slice('local/'.length)))?.bytes ?? null;
  const res = await fetch(build.url);
  return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
}

/**
 * Registers an uploaded build ZIP (already in storage at `stored`): checks it is a build (preview.json with this key,
 * an index.html), finds its hand-in among the item's hand-ins, and saves it there (the hand-in's old build is removed).
 */
export async function registerBuild(store: Store, stored: { url: string; pathname: string; size: number }, entries: readonly { id: string; student_id: string }[], by: string): Promise<{ ok: true; entry: string; build: Build } | { ok: false; error: string }> {
  const key = /([a-z0-9]{20})\.zip$/.exec(stored.pathname)?.[1] ?? '';
  const drop = async (error: string) => { await deleteStored(stored); return { ok: false as const, error }; };
  if (!stored.pathname.startsWith('local/')) {
    const blob = await head(stored.url, { token: blobToken() }).catch(() => null);
    if (!blob || blob.pathname !== previewPath(key)) return { ok: false, error: 'The uploaded build was not found.' };
    stored = { url: blob.url, pathname: blob.pathname, size: blob.size };
  }
  if (!KEY_RE.test(key) && !stored.pathname.startsWith('local/')) return drop('That is not a build ZIP from the builder.');
  if (stored.size > MAX_BUILD_BYTES) return drop('The build is too big (over 40 MB).');
  const bytes = await zipBytes(stored);
  if (!bytes) return drop('The uploaded build could not be read.');
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (f) => f.name === 'preview.json' || f.name === 'index.html' });
  } catch {
    return drop('That file is not a ZIP.');
  }
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(new TextDecoder().decode(files['preview.json']));
  } catch {
    return drop('That ZIP has no preview.json: upload the ZIPs the builder made.');
  }
  const mkey = String(manifest.key ?? '');
  if (!files['index.html']) return drop('That build has no index.html.');
  if (!KEY_RE.test(mkey) || (!stored.pathname.startsWith('local/') && mkey !== key)) return drop('The build and its file name do not match: upload the ZIPs as the builder made them.');
  const entry = entryFor(manifest as { entry?: unknown; studentId?: unknown }, entries);
  if (!entry) return drop(`No hand-in of this item is from student ${String(manifest.studentId ?? '?')}.`);
  const build: Build = {
    key: mkey, url: stored.url, pathname: stored.pathname,
    source: manifest.source === 'zip' ? 'zip' : 'repo', repo: cleanRepo(manifest.repo),
    sha: /^[0-9a-f]{40}$/.test(String(manifest.sha ?? '')) ? String(manifest.sha) : null,
    handIn: manifest.handIn ? String(manifest.handIn).slice(0, 40) : null, sdk: manifest.sdk ? String(manifest.sdk).slice(0, 20) : null,
    builtAt: String(manifest.builtAt ?? new Date().toISOString()).slice(0, 40), by, size: stored.size,
  };
  let old: Build | null = null;
  await updatePreviews(store, (p) => {
    const cur = p[entry] ?? { repo: build.repo, repoBy: build.repo ? 'found' : null, checked: '', build: null };
    old = cur.build && cur.build.key !== build.key ? cur.build : null;
    p[entry] = { ...cur, repo: cur.repo ?? build.repo, repoBy: cur.repoBy ?? (build.repo ? 'found' : null), build };
  });
  if (old) await deleteStored(old);
  return { ok: true, entry, build };
}

/* ------------------------------------------------------------------ serving */

const cache = new Map<string, Map<string, Uint8Array>>();
const KEEP = 6;

/** A build's files by key (from storage once, then from memory), or null when no hand-in has that build. */
export async function buildFiles(store: Store, key: string): Promise<Map<string, Uint8Array> | null> {
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const build = Object.values(await loadPreviews(store)).find((p) => p.build?.key === key)?.build;
  if (!build) return null;
  const bytes = await zipBytes(build);
  if (!bytes) return null;
  const files = new Map(Object.entries(unzipSync(bytes)).filter(([name]) => !name.endsWith('/') && name !== 'preview.json'));
  cache.set(key, files);
  while (cache.size > KEEP) cache.delete(cache.keys().next().value!);
  return files;
}

/** Forgets a removed build. */
export const forgetBuild = (key: string) => cache.delete(key);
