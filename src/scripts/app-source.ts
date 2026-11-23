/**
 * Admin → Marking: a group's app code in the browser, from its hand-in ZIP (the app files in it, or a ZIP inside it)
 * or else from its GitHub repo (through /api/admin/previews/source). Used by "Open in BUENOVA Code" and by the
 * auto-marker (which reads the folders and screens). Fetched once per hand-in version, then kept in memory.
 */
import { unzip as unzipAsync, type Unzipped } from 'fflate';
import { appFiles, appRoot } from '@/lib/previews/source';

export type AppSource = { files: Map<string, Uint8Array>; from: 'zip' | 'repo'; repo: string | null };

const dec = new TextDecoder();
const unzip = (bytes: Uint8Array, keep: (name: string, size: number) => boolean) =>
  new Promise<Unzipped>((done, fail) => unzipAsync(bytes, { filter: (f) => keep(f.name, f.originalSize) }, (e, out) => (e ? fail(e) : done(out))));
const isZip = (b: Uint8Array) => b[0] === 0x50 && b[1] === 0x4b;

/** The Expo app inside a ZIP (or inside a ZIP inside it): its files relative to the app folder, or null. */
async function appInZip(bytes: Uint8Array, depth = 0): Promise<Map<string, Uint8Array> | null> {
  const sizes: { name: string; size: number }[] = [];
  const pkgs = await unzip(bytes, (n, size) => { sizes.push({ name: n, size }); return /(^|\/)package\.json$/.test(n) && size < 200_000; });
  const root = appRoot(Object.entries(pkgs).map(([path, b]) => ({ path, text: dec.decode(b) })));
  if (root !== null) {
    const want = new Set(appFiles(sizes, root));
    const files = await unzip(bytes, (n) => want.has(n));
    return new Map(Object.entries(files).map(([n, b]) => [n.slice(root.length), b] as const).filter(([n]) => n && !n.endsWith('/')));
  }
  // some groups zip their repo and hand in that ZIP inside another one
  if (depth > 0) return null;
  const inner = sizes.filter((s) => /\.zip$/i.test(s.name) && !/(^|\/)(node_modules|__MACOSX)\//.test(s.name) && s.size < 80 * 1024 * 1024).sort((a, b) => b.size - a.size);
  for (const z of inner.slice(0, 3)) {
    const got = await unzip(bytes, (n) => n === z.name);
    const found = got[z.name] && (await appInZip(got[z.name], depth + 1));
    if (found) return found;
  }
  return null;
}

const cache = new Map<string, Promise<AppSource>>();

/**
 * The app of a hand-in: from its ZIP when the app files are in it, else from its GitHub repo. `bytes` gives the
 * hand-in's bytes (the project panel's cached download). Throws a message for staff when there is no app.
 */
export function appSource(h: { entry: string; updatedAt: string; url: string }, repo: string | null, bytes: () => Promise<Uint8Array>): Promise<AppSource> {
  const key = `${h.entry}:${h.updatedAt}:${repo ?? ''}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = (async (): Promise<AppSource> => {
      const b = await bytes().catch(() => null);
      const fromZip = b && isZip(b) ? await appInZip(b).catch(() => null) : null;
      if (fromZip && fromZip.size) return { files: fromZip, from: 'zip', repo };
      if (!repo) throw new Error('No app code: the hand-in has no app files and no GitHub link was found. Add the link on the App tab.');
      const r = await fetch(`/api/admin/previews/source?repo=${encodeURIComponent(repo)}`);
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? `Could not get github.com/${repo} (${r.status}).`);
      const zip = new Uint8Array(await r.arrayBuffer());
      const files = await unzip(zip, () => true);
      return { files: new Map(Object.entries(files).filter(([n]) => n && !n.endsWith('/'))), from: 'repo', repo };
    })();
    cache.set(key, hit);
    hit.catch(() => cache.delete(key));
  }
  return hit;
}
