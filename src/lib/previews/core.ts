/**
 * APP PREVIEWS — rules. A hand-in that contains (or links) a student's Expo app gets a real web build of it, made
 * by scripts/previews/build.mjs in a Docker box and uploaded as one ZIP. The site serves that build at
 * /preview/<key>/ in a sandbox, and Admin → Marking shows it in a phone frame beside the marking form.
 * Pure functions only (tests/previews.test.ts).
 */

/** A build's address: 20 random lowercase letters and digits (also its path, baked into the build). */
export const KEY_RE = /^[a-z0-9]{20}$/;
/** "owner/name" of a GitHub repo. */
export const REPO_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;
export const MAX_BUILD_BYTES = 40 * 1024 * 1024;

/** GitHub accounts that host libraries, funding pages or docs, never a student's app. */
const NOT_STUDENTS = new Set(['sponsors', 'expo', 'facebook', 'react-native-community', 'software-mansion', 'callstack', 'microsoft', 'google', 'vercel', 'apps', 'orgs', 'features', 'topics', 'settings', 'login', 'marketplace', 'collections', 'about', 'pricing', 'github', 'nodejs', 'npm', 'reactjs', 'react-navigation', 'oblador', 'necolas', 'supabase', 'firebase', 'tailwindlabs', 'nativewind', 'jsx-eslint', 'eslint', 'babel', 'typescript-eslint', 'isaacs', 'sindresorhus', 'ljharb', 'feross', 'ai', 'jonschlinkert']);

/**
 * The student repo a text names (a report, a README, a .git/config): the most mentioned github.com/owner/name that
 * is not a library or a funding page; null when there is none.
 */
export function findRepo(text: string): string | null {
  const count = new Map<string, number>();
  const first = new Map<string, number>();
  const re = /github\.com[/:]([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})/gi;
  for (const m of text.matchAll(re)) {
    const owner = m[1];
    const name = m[2].replace(/\.git$/i, '').replace(/[._-]+$/, '');
    if (!name || NOT_STUDENTS.has(owner.toLowerCase())) continue;
    const repo = `${owner}/${name}`;
    count.set(repo, (count.get(repo) ?? 0) + 1);
    if (!first.has(repo)) first.set(repo, m.index ?? 0);
  }
  // a link cut at a line end ("Smart-Food-Expiry-") counts toward the full name it starts
  const names = [...count.keys()];
  for (const r of names) {
    const longer = names.find((l) => l !== r && count.has(l) && l.toLowerCase().startsWith(r.toLowerCase()));
    if (longer && count.has(r)) { count.set(longer, count.get(longer)! + count.get(r)!); first.set(longer, Math.min(first.get(longer)!, first.get(r)!)); count.delete(r); }
  }
  // the most mentioned; on a tie the one named first (the report's own link comes before others)
  return [...count].sort((a, b) => b[1] - a[1] || first.get(a[0])! - first.get(b[0])!)[0]?.[0] ?? null;
}

/** "owner/name" from what staff typed: a repo URL, a clone URL or owner/name. Null when it is none of these. */
export function cleanRepo(input: unknown): string | null {
  const s = String(input ?? '').trim().replace(/^git\+/, '');
  const m = /^(?:https?:\/\/)?(?:www\.)?github\.com[/:]([^/\s]+)\/([^/\s#?]+)/i.exec(s) ?? /^([^/\s]+)\/([^/\s#?]+)$/.exec(s);
  if (!m) return null;
  const repo = `${m[1]}/${m[2].replace(/\.git$/i, '')}`;
  return REPO_RE.test(repo) ? repo : null;
}

/* ------------------------------------------------------------------ saved */

export type Build = {
  key: string;
  /** the build ZIP in storage */
  url: string;
  pathname: string;
  source: 'repo' | 'zip';
  repo: string | null;
  sha: string | null;
  /** the hand-in's time when it was built from the ZIP */
  handIn: string | null;
  sdk: string | null;
  builtAt: string;
  by: string;
  size: number;
};
/** The last automatic build that failed: for which hand-in version, when, and why (shown to staff, retried a day later). */
export type Failure = { handIn: string; at: string; note: string };
export type Preview = {
  /** the student's GitHub repo, found in the hand-in or typed by staff */
  repo: string | null;
  repoBy: 'found' | 'staff' | null;
  /** the hand-in version that was searched for a repo (updated_at), so a new hand-in is searched again */
  checked: string;
  build: Build | null;
  fail?: Failure | null;
};
/** Hand-in id → its app preview. */
export type Previews = Record<string, Preview>;

const text = (v: unknown, max: number) => String(v ?? '').slice(0, max);

function cleanBuild(b: unknown): Build | null {
  if (!b || typeof b !== 'object') return null;
  const x = b as Record<string, unknown>;
  const key = text(x.key, 20);
  if (!KEY_RE.test(key) || typeof x.url !== 'string') return null;
  return {
    key, url: text(x.url, 600), pathname: text(x.pathname, 300),
    source: x.source === 'zip' ? 'zip' : 'repo',
    repo: cleanRepo(x.repo), sha: /^[0-9a-f]{40}$/.test(String(x.sha ?? '')) ? String(x.sha) : null,
    handIn: x.handIn ? text(x.handIn, 40) : null, sdk: x.sdk ? text(x.sdk, 20) : null,
    builtAt: text(x.builtAt, 40), by: text(x.by, 120), size: Math.max(0, Number(x.size) || 0),
  };
}

export function cleanPreviews(input: unknown): Previews {
  const out: Previews = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  for (const [id, v] of Object.entries(input as Record<string, unknown>).slice(0, 5000)) {
    if (!/^[A-Za-z0-9-]{1,64}$/.test(id) || !v || typeof v !== 'object') continue;
    const p = v as Record<string, unknown>;
    out[id] = { repo: cleanRepo(p.repo), repoBy: p.repoBy === 'staff' ? 'staff' : p.repoBy === 'found' ? 'found' : null, checked: text(p.checked, 40), build: cleanBuild(p.build) };
    const f = p.fail as Record<string, unknown> | null | undefined;
    if (f && typeof f === 'object' && f.handIn) out[id].fail = { handIn: text(f.handIn, 40), at: text(f.at, 40), note: text(f.note, 300) };
  }
  return out;
}

/** How long a hand-in whose automatic build failed waits before the builder tries it again. */
export const RETRY_MS = 24 * 60 * 60 * 1000;

/**
 * A failure of the build computer, not of the student's app (files it could not write or delete, a full disk…):
 * such a hand-in is built again at the next run instead of a day later, and staff are told it is not the app.
 */
export const builderFault = (note: string | null | undefined) => /(EACCES|EPERM|ENOSPC|EBUSY|EMFILE)|permission denied|no space left/i.test(String(note ?? ''));

/**
 * Whether the builder builds this hand-in now: 'current' when its build is still right, 'wait' when it failed for
 * this same hand-in less than a day ago, else 'build'. `pin` (the automatic builder): a build stays until the
 * hand-in itself changes, so staff see the app as it was handed in, not later pushes to the repo. Without `pin` a
 * repo build is current while the repo's commit (`head`) is the one it was built from.
 */
export function needsBuild(
  e: { updatedAt: string; repo?: string | null; built: { sha?: string | null; source?: string; handIn?: string | null } | null; failed?: { handIn: string; at: string; note?: string } | null },
  opts: { now: number; pin: boolean; force?: boolean; head?: string | null },
): 'current' | 'wait' | 'build' {
  if (opts.force) return 'build';
  const b = e.built;
  if (b) {
    if (opts.pin ? b.handIn === e.updatedAt : e.repo ? !!b.sha && b.sha === opts.head : b.source === 'zip' && b.handIn === e.updatedAt) return 'current';
  }
  const f = e.failed;
  if (f && f.handIn === e.updatedAt && !builderFault(f.note) && opts.now - Date.parse(f.at) < RETRY_MS) return 'wait';
  return 'build';
}

/** The hand-in a build belongs to: by its id, else by the student ID among the item's hand-ins. */
export function entryFor(manifest: { entry?: unknown; studentId?: unknown }, entries: readonly { id: string; student_id: string }[]): string | null {
  const id = typeof manifest.entry === 'string' ? manifest.entry : '';
  if (id && entries.some((e) => e.id === id)) return id;
  const sid = String(manifest.studentId ?? '').trim().toUpperCase();
  return (sid && entries.find((e) => e.student_id.trim().toUpperCase() === sid)?.id) || null;
}

/** The build list the builder takes: each hand-in with its repo and what is already built. */
export function buildList(item: string, entries: readonly { id: string; student_id: string; url: string; updated_at: string; group?: string }[], previews: Previews) {
  return {
    item,
    generatedAt: new Date().toISOString(),
    entries: entries.map((e) => {
      const p = previews[e.id];
      return {
        entry: e.id, group: e.group ? Number(e.group.replace(/^G/, '')) || null : null, studentId: e.student_id, url: e.url, updatedAt: e.updated_at,
        repo: p?.repo ?? null,
        /** the hand-in version already searched for a repo */
        checked: p?.checked ?? '',
        built: p?.build ? { key: p.build.key, sha: p.build.sha, source: p.build.source, handIn: p.build.handIn } : null,
        failed: p?.fail ? { handIn: p.fail.handIn, at: p.fail.at, note: p.fail.note } : null,
      };
    }),
  };
}

/* ------------------------------------------------------------------ serving */

const TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8',
  json: 'application/json', map: 'application/json', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  svg: 'image/svg+xml', ico: 'image/x-icon', ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2', mp3: 'audio/mpeg', wav: 'audio/wav',
  mp4: 'video/mp4', txt: 'text/plain; charset=utf-8', wasm: 'application/wasm',
};
export const typeOf = (path: string) => TYPES[(/\.([a-z0-9]+)$/i.exec(path)?.[1] ?? '').toLowerCase()] ?? 'application/octet-stream';

/**
 * Which file of a build a request asks for: '' or a folder → index.html; a path with no file extension is a route
 * of the app → index.html (a single-page build). Null for anything that tries to leave the build.
 */
export function buildFile(path: string, has: (p: string) => boolean): string | null {
  const p = decodeURIComponent(path || '').replace(/^\/+/, '');
  if (p.split('/').some((s) => s === '..' || s === '.')) return null;
  if (!p || p.endsWith('/')) return has(`${p}index.html`) ? `${p}index.html` : has('index.html') ? 'index.html' : null;
  if (has(p)) return p;
  return /\.[a-z0-9]+$/i.test(p) ? null : has('index.html') ? 'index.html' : null;
}

/**
 * A build runs in a sandbox (its own origin: no cookies or storage of the site). This goes first in its page so the
 * app still starts there:
 * - an in-memory localStorage / sessionStorage when the real ones are not allowed (AsyncStorage keeps working)
 * - history.pushState / replaceState that keep working when the browser refuses to change the address of a
 *   sandboxed page (Expo Router and React Navigation call them on start): the state is kept, the address is not
 * - document.cookie reads as empty instead of throwing
 */
export const STORAGE_SHIM = `<script>(function(){var errs=window.__previewErrors=[];addEventListener('error',function(e){errs.push(String(e.message||e.error))});addEventListener('unhandledrejection',function(e){errs.push(String(e.reason&&e.reason.message||e.reason))});function m(){var d={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[k]=String(v)},removeItem:function(k){delete d[k]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}}['localStorage','sessionStorage'].forEach(function(n){try{window[n].getItem('x')}catch(e){try{Object.defineProperty(window,n,{value:m(),configurable:true})}catch(_){}}});['pushState','replaceState'].forEach(function(f){var o=history[f];history[f]=function(s,t,u){try{return o.call(history,s,t,u)}catch(e){try{return o.call(history,s,t)}catch(_){}}}});try{document.cookie}catch(e){try{Object.defineProperty(document,'cookie',{get:function(){return''},set:function(){},configurable:true})}catch(_){}}})();</script>`;

export function withShim(html: string): string {
  const at = html.search(/<head[^>]*>/i);
  if (at < 0) return STORAGE_SHIM + html;
  const end = html.indexOf('>', at) + 1;
  return html.slice(0, end) + STORAGE_SHIM + html.slice(end);
}

/** Headers for a file of a build: its type, a sandbox for its page (no site cookies or storage), long caching for hashed files. */
export function previewHeaders(file: string): Record<string, string> {
  const page = /\.html$/i.test(file);
  return {
    'content-type': typeOf(file),
    'access-control-allow-origin': '*',
    'cross-origin-resource-policy': 'cross-origin',
    'x-robots-tag': 'noindex, nofollow',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    ...(page
      ? { 'content-security-policy': "sandbox allow-scripts allow-forms allow-modals; frame-ancestors 'self'", 'x-frame-options': 'SAMEORIGIN', 'cache-control': 'public, max-age=60, s-maxage=60' }
      // a build never changes under its key: hashed files are cached by the browser and Vercel's CDN for good
      : { 'cache-control': /(^|\/)(_expo|assets)\//.test(file) ? 'public, max-age=31536000, s-maxage=31536000, immutable' : 'public, max-age=3600, s-maxage=86400' }),
  };
}
