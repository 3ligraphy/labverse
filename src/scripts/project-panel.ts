/**
 * Admin → Marking: the project of the group being marked, beside the form. Three tabs:
 *   App      the app running in a phone frame: a real web build (scripts/previews/build.mjs, made in a Docker box from
 *            the GitHub repo found in the hand-in, or from the app files in its ZIP), served sandboxed at /preview/<key>/
 *   Report   the report's pages (a PDF hand-in, or the PDF / Word file inside the ZIP)
 *   Hand-in  the files in the hand-in
 * Plus the App builds box: the build list for the builder and the upload of the build ZIPs it makes.
 * The repo is looked for in the hand-in here, once per hand-in version, and saved for every TA.
 */
import { upload } from '@vercel/blob/client';
import { findRepo } from '@/lib/previews/core';
import { loadPdfjs, renderPdf, unzip } from '@/scripts/doc-text';

type BuildInfo = { key: string; source: 'repo' | 'zip'; repo: string | null; sha: string | null; sdk: string | null; builtAt: string; by: string; size: number };
type Info = { repo: string | null; repoBy: 'found' | 'staff' | null; checked: string; build: BuildInfo | null };
type HandIn = { entry: string; group: number | null; studentId: string; url: string; updatedAt: string; repo: string | null; built: { key: string } | null };
type Data = { list: { item: string; generatedAt: string; entries: HandIn[] }; info: Record<string, Info>; upload: 'blob' | 'local' | null; folder: string };
type Tab = 'app' | 'report' | 'files';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const when = (iso: string) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '');
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

/* ------------------------------------------------------------- reading files */

const bytesCache = new Map<string, Promise<Uint8Array>>();
function bytesOf(url: string): Promise<Uint8Array> {
  if (!bytesCache.has(url)) {
    bytesCache.set(url, fetch(url).then(async (r) => {
      if (!r.ok) throw new Error(`Download failed (${r.status})`);
      return new Uint8Array(await r.arrayBuffer());
    }));
    bytesCache.get(url)!.catch(() => bytesCache.delete(url));
  }
  return bytesCache.get(url)!;
}
const isPdf = (b: Uint8Array) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;
const isZip = (b: Uint8Array) => b[0] === 0x50 && b[1] === 0x4b;
const skipped = (n: string) => /(^|\/)(node_modules|__MACOSX|\.expo|\.git\/objects)\//.test(n) || /(^|\/)\._/.test(n);

/** A PDF's text and its link targets (a repo link is often only a hyperlink). */
async function pdfText(bytes: Uint8Array): Promise<string> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data: bytes.slice() });
  const doc = await task.promise;
  let out = '';
  try {
    for (let p = 1; p <= Math.min(doc.numPages, 60); p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      out += content.items.map((i) => ('str' in i ? i.str : '')).join(' ') + '\n';
      const links = (await page.getAnnotations()) as { url?: string; unsafeUrl?: string }[];
      out += links.map((a) => a.url ?? a.unsafeUrl ?? '').join(' ') + '\n';
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return out;
}

/** A Word file's text and hyperlink targets. */
async function docxText(bytes: Uint8Array): Promise<string> {
  const parts = await unzip(bytes, (n) => n === 'word/document.xml' || n === 'word/_rels/document.xml.rels');
  const dec = new TextDecoder();
  return [...parts.values()].map((b) => dec.decode(b).replace(/<w:p[ >]/g, '\n$&').replace(/Target="([^"]+)"/g, ' $1 ').replace(/<[^>]+>/g, '')).join('\n');
}

/** The GitHub repo named in a hand-in (its report, README, package.json, .git/config), or null. */
export async function repoInHandIn(url: string): Promise<string | null> {
  const bytes = await bytesOf(url);
  const texts: string[] = [];
  if (isPdf(bytes)) texts.push(await pdfText(bytes));
  else if (isZip(bytes)) {
    const files = await unzip(bytes, (n) => !skipped(n) && (/\.(pdf|docx|md|txt)$/i.test(n) || /(^|\/)(package\.json|app\.json|\.git\/config|config)$/i.test(n)));
    if (files.has('word/document.xml')) texts.push(await docxText(bytes));
    const dec = new TextDecoder();
    for (const [name, b] of files) {
      try {
        if (/\.pdf$/i.test(name)) texts.push(await pdfText(b));
        else if (/\.docx$/i.test(name)) texts.push(await docxText(b));
        else texts.push(dec.decode(b));
      } catch (error) {
        console.warn('[project] could not read', name, error);
      }
    }
  }
  return findRepo(texts.join('\n'));
}

/** The report of a hand-in: the PDF itself, or the main PDF / Word file inside its ZIP (AI logs left out). */
async function reportOf(url: string): Promise<{ kind: 'pdf' | 'docx'; name: string; bytes: Uint8Array } | null> {
  const bytes = await bytesOf(url);
  if (isPdf(bytes)) return { kind: 'pdf', name: 'Report', bytes };
  if (!isZip(bytes)) return null;
  const files = await unzip(bytes, (n) => !skipped(n) && /\.(pdf|docx)$/i.test(n));
  const docs = [...files].filter(([n]) => !/ai[_ -]?log|prompt/i.test(n)).sort((a, b) => (/report|phase/i.test(b[0]) ? 1 : 0) - (/report|phase/i.test(a[0]) ? 1 : 0) || b[1].length - a[1].length);
  const [name, b] = docs[0] ?? [];
  return name ? { kind: /\.pdf$/i.test(name) ? 'pdf' : 'docx', name: name.split('/').pop()!, bytes: b } : null;
}

/* ------------------------------------------------------------------- panel */

export function createProjectPanel(host: HTMLElement, opts: { item: () => string | null; onData?: (d: Data) => void }) {
  let data: Data | null = null;
  let loading: Promise<Data | null> | null = null;
  let group = 0;
  /** the hand-in staff chose when a group has several, and the one on screen */
  let picked = '';
  let shown = '';
  let tab: Tab = (store.get('mk-proj-tab') as Tab) || 'app';
  const finding = new Set<string>();

  async function load(force = false): Promise<Data | null> {
    const item = opts.item();
    if (!item) return null;
    if (data && data.list.item === item && !force) return data;
    if (!loading || force) {
      loading = fetch(`/api/admin/previews?item=${encodeURIComponent(item)}`, { cache: 'no-store' })
        .then(async (r) => (r.ok ? ((await r.json()) as Data) : null))
        .then((d) => { data = d; loading = null; if (d) opts.onData?.(d); return d; })
        .catch(() => { loading = null; return null; });
    }
    return loading;
  }

  const handIns = (n: number) => (data?.list.entries ?? []).filter((e) => e.group === n).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  async function show(n: number) {
    if (n !== group) picked = '';
    group = n;
    host.innerHTML = `<div class="mk-proj-head">
        <div class="mk-proj-tabs" role="tablist" aria-label="Project of group ${n}">
          ${(['app', 'report', 'files'] as Tab[]).map((t) => `<button type="button" role="tab" data-proj-tab="${t}" aria-selected="${t === tab}">${t === 'app' ? 'App' : t === 'report' ? 'Report' : 'Hand-in'}</button>`).join('')}
        </div>
      </div>
      <div class="mk-proj-body" data-proj-body><p class="mk-proj-note">Loading the project…</p></div>`;
    await load();
    if (group === n) render();
  }

  function render() {
    const body = host.querySelector<HTMLElement>('[data-proj-body]');
    if (!body) return;
    host.querySelectorAll<HTMLElement>('[data-proj-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.projTab === tab)));
    if (!data) { body.innerHTML = '<p class="mk-proj-note">The hand-ins could not be loaded.</p>'; return; }
    const list = handIns(group);
    if (!list.length) { body.innerHTML = `<p class="mk-proj-note">No hand-in from group ${group} for this item.</p>`; return; }
    // the hand-in chosen here, else the newest one whose app is built, else the newest with a repo, else the newest
    const info = data.info;
    const h = list.find((x) => x.entry === picked) ?? list.find((x) => info[x.entry]?.build) ?? list.find((x) => info[x.entry]?.repo) ?? list[0];
    shown = h.entry;
    const more = list.length > 1
      ? `<label class="mk-proj-pick small">${list.length} hand-ins from this group <select class="input" data-proj-pick>${list.map((x) => `<option value="${esc(x.entry)}" ${x.entry === h.entry ? 'selected' : ''}>${esc(x.studentId)} · ${esc(when(x.updatedAt))}${info[x.entry]?.build ? ' · app built' : ''}</option>`).join('')}</select></label>`
      : '';
    if (tab === 'app') return renderApp(body, h, more);
    if (tab === 'report') return void renderReport(body, h, more);
    return void renderFiles(body, h, more);
  }

  function renderApp(body: HTMLElement, h: HandIn, more: string) {
    const info = data!.info[h.entry];
    const repo = info?.repo ?? null;
    const b = info?.build ?? null;
    const lookedAt = info?.checked === h.updatedAt;
    const repoLine = repo
      ? `<a class="mk-proj-repo" href="https://github.com/${esc(repo)}" target="_blank" rel="noopener">github.com/${esc(repo)} ↗</a>${info?.repoBy === 'staff' ? ' <span class="faint small">(typed by staff)</span>' : ''}`
      : lookedAt ? '<span class="faint">No GitHub link found in the hand-in.</span>' : '<span class="faint">Looking for the GitHub link in the hand-in…</span>';
    body.innerHTML = `${more}
      <div class="mk-proj-row">${repoLine} <button type="button" class="mk-link" data-proj-repo-edit>${repo ? 'Change' : 'Add the link'}</button></div>
      <form class="mk-proj-repo-form" data-proj-repo-form hidden><input class="input" name="repo" placeholder="https://github.com/owner/repo" value="${esc(repo ?? '')}" aria-label="GitHub link of the app" /><button class="btn btn-ghost btn-sm">Save</button></form>
      ${b ? `<div class="mk-phone-wrap"><div class="mk-phone"><iframe src="/preview/${esc(b.key)}/" title="App of group ${group}" sandbox="allow-scripts allow-forms allow-modals" loading="lazy" referrerpolicy="no-referrer" data-proj-frame></iframe></div></div>
        <p class="mk-proj-cap small">A real web build of the app (${b.source === 'repo' ? `GitHub${b.sha ? `, commit ${esc(b.sha.slice(0, 7))}` : ''}` : 'the files in the hand-in ZIP'}${b.sdk ? ` · Expo ${esc(b.sdk)}` : ''}) · built ${esc(when(b.builtAt))}. Native-only parts (camera, notifications…) can differ from a phone.</p>
        <div class="mk-proj-row"><button type="button" class="btn btn-ghost btn-sm" data-proj-reload>Restart the app</button><a class="btn btn-ghost btn-sm" href="/preview/${esc(b.key)}/" target="_blank" rel="noopener">Open full screen ↗</a></div>`
        : `<div class="mk-proj-empty"><b>Not built yet.</b><p class="small">Open <b>App builds</b> on the Marks tab: download the build list, run the builder on a computer with Docker, and upload the ZIPs it makes. The app then runs here for every TA.</p></div>`}`;
    if (!lookedAt && !repo && !finding.has(h.entry)) void find(h);
  }

  async function find(h: HandIn) {
    finding.add(h.entry);
    let repo: string | null = null;
    try {
      repo = await repoInHandIn(h.url);
    } catch (error) {
      console.warn('[project] could not look for the repo', error);
    }
    try {
      await fetch('/api/admin/previews', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'repo', item: data!.list.item, entry: h.entry, repo: repo ?? '', found: true }) });
      const cur = data!.info[h.entry] ?? { repo: null, repoBy: null, checked: '', build: null };
      data!.info[h.entry] = { ...cur, repo: cur.repoBy === 'staff' ? cur.repo : repo, repoBy: cur.repoBy === 'staff' ? 'staff' : repo ? 'found' : null, checked: h.updatedAt };
      const e = data!.list.entries.find((x) => x.entry === h.entry);
      if (e && !e.repo) e.repo = data!.info[h.entry].repo;
    } finally {
      finding.delete(h.entry);
      if (tab === 'app' && shown === h.entry) render();
    }
  }

  async function renderReport(body: HTMLElement, h: HandIn, more: string) {
    body.innerHTML = `${more}<p class="mk-proj-note">Opening the report…</p>`;
    try {
      const doc = await reportOf(h.url);
      if (!body.isConnected || tab !== 'report') return;
      if (!doc) { body.innerHTML = `${more}<p class="mk-proj-note">No PDF or Word report in this hand-in.</p>`; return; }
      body.innerHTML = `${more}<p class="mk-proj-note small">${esc(doc.name)}</p><div class="mk-proj-pages" data-proj-pages></div>`;
      const box = body.querySelector<HTMLElement>('[data-proj-pages]')!;
      if (doc.kind === 'pdf') {
        const url = URL.createObjectURL(new Blob([doc.bytes.slice()], { type: 'application/pdf' }));
        try { await renderPdf(url, box, 40); } finally { URL.revokeObjectURL(url); }
      } else {
        // Word: its text in order, with its pictures (the diagrams) where they are
        const parts = await unzip(doc.bytes, (n) => n === 'word/document.xml' || n === 'word/_rels/document.xml.rels' || n.startsWith('word/media/'));
        const dec = new TextDecoder();
        const rels = new Map([...dec.decode(parts.get('word/_rels/document.xml.rels') ?? new Uint8Array()).matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map((m) => [m[1], m[2]]));
        const xml = dec.decode(parts.get('word/document.xml') ?? new Uint8Array());
        const html = xml.split(/<\/w:p>/).map((p) => {
          const img = [...p.matchAll(/r:embed="([^"]+)"/g)].map((m) => {
            const file = parts.get(`word/${rels.get(m[1]) ?? ''}`);
            const type = /\.png$/i.test(rels.get(m[1]) ?? '') ? 'image/png' : 'image/jpeg';
            return file ? `<img src="${URL.createObjectURL(new Blob([file.slice()], { type }))}" alt="Figure from the report" loading="lazy" />` : '';
          }).join('');
          const text = p.replace(/<[^>]+>/g, '').trim();
          return `${text ? `<p>${esc(text)}</p>` : ''}${img}`;
        }).join('');
        box.innerHTML = `<div class="mk-proj-docx">${html || '<p class="faint">This Word file has no text.</p>'}</div>`;
      }
    } catch (error) {
      body.innerHTML = `${more}<p class="mk-proj-note">The report could not be opened (${esc(error instanceof Error ? error.message : 'error')}). <a href="${esc(h.url)}" target="_blank" rel="noopener">Download the hand-in</a></p>`;
    }
  }

  async function renderFiles(body: HTMLElement, h: HandIn, more: string) {
    body.innerHTML = `${more}<p class="mk-proj-note">Reading the hand-in…</p>`;
    try {
      const bytes = await bytesOf(h.url);
      if (!body.isConnected || tab !== 'files') return;
      const head = `<div class="mk-proj-row"><a class="btn btn-ghost btn-sm" href="${esc(h.url)}" target="_blank" rel="noopener">Download the hand-in (${mb(bytes.length)}) ↓</a><span class="small faint">${esc(h.studentId)} · ${esc(when(h.updatedAt))}</span></div>`;
      if (!isZip(bytes)) { body.innerHTML = `${more}${head}<p class="mk-proj-note">A single ${isPdf(bytes) ? 'PDF' : ''} file: see Report.</p>`; return; }
      const names: string[] = [];
      await unzip(bytes, (n) => { if (!skipped(n) && !n.endsWith('/')) names.push(n); return false; });
      names.sort();
      body.innerHTML = `${more}${head}<p class="small faint">${names.length} files (node_modules left out)</p><ul class="mk-proj-files">${names.slice(0, 400).map((n) => `<li class="mono">${esc(n)}</li>`).join('')}</ul>`;
    } catch (error) {
      body.innerHTML = `${more}<p class="mk-proj-note">The hand-in could not be read (${esc(error instanceof Error ? error.message : 'error')}).</p>`;
    }
  }

  host.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const tb = t.closest<HTMLElement>('[data-proj-tab]');
    if (tb) { tab = tb.dataset.projTab as Tab; store.set('mk-proj-tab', tab); return render(); }
    if (t.closest('[data-proj-reload]')) { const f = host.querySelector<HTMLIFrameElement>('[data-proj-frame]'); if (f) f.src = f.src; return; }
    if (t.closest('[data-proj-repo-edit]')) { const f = host.querySelector<HTMLFormElement>('[data-proj-repo-form]'); if (f) { f.hidden = !f.hidden; f.querySelector('input')?.focus(); } }
  });
  host.addEventListener('change', (e) => {
    const s = (e.target as HTMLElement).closest<HTMLSelectElement>('[data-proj-pick]');
    if (s) { picked = s.value; render(); }
  });
  host.addEventListener('submit', async (e) => {
    const f = (e.target as HTMLElement).closest<HTMLFormElement>('[data-proj-repo-form]');
    if (!f || !data) return;
    e.preventDefault();
    const h = handIns(group).find((x) => x.entry === shown) ?? handIns(group)[0];
    const r = await fetch('/api/admin/previews', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'repo', item: data.list.item, entry: h.entry, repo: (f.elements.namedItem('repo') as HTMLInputElement).value }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { f.insertAdjacentHTML('beforeend', `<p class="small mk-proj-err">${esc(j.error ?? 'Could not save.')}</p>`); return; }
    data.info[h.entry] = { ...(data.info[h.entry] ?? { build: null, checked: h.updatedAt }), repo: j.repo, repoBy: j.repo ? 'staff' : null, checked: h.updatedAt } as Info;
    const entry = data.list.entries.find((x) => x.entry === h.entry);
    if (entry) entry.repo = j.repo;
    render();
  });

  return { show, load, data: () => data };
}

/* --------------------------------------------------------------- app builds */

/** The App builds box: how many hand-ins run, the build list for the builder, and the upload of its ZIPs. */
export function wireAppBuilds(box: HTMLElement, panel: ReturnType<typeof createProjectPanel>) {
  const msg = box.querySelector<HTMLElement>('[data-builds-msg]')!;
  const sum = box.querySelector<HTMLElement>('[data-builds-sum]')!;
  const say = (t: string, tone = '') => { msg.textContent = t; msg.dataset.tone = tone; };
  const summary = (d: Data | null) => {
    if (!d) { sum.textContent = 'App builds'; return; }
    const n = d.list.entries.length;
    const built = d.list.entries.filter((e) => d.info[e.entry]?.build).length;
    const repos = d.list.entries.filter((e) => d.info[e.entry]?.repo).length;
    sum.textContent = `App builds · ${built} of ${n} hand-ins run here · ${repos} with a GitHub link found`;
  };
  void panel.load().then(summary);
  box.addEventListener('click', async (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-builds-list]')) {
      const d = await panel.load(true);
      if (!d) return say('Could not load the hand-ins.', 'err');
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([JSON.stringify(d.list, null, 1)], { type: 'application/json' })), download: 'build-list.json' });
      document.body.append(a); a.click(); a.remove();
      say(`build-list.json saved (${d.list.entries.length} hand-ins). Hand-ins whose GitHub link was never looked for get it when their group is opened here; the builder also builds apps from the files in a ZIP.`, 'ok');
    }
  });
  box.addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    if (!input.matches('[data-builds-file]') || !input.files?.length) return;
    const d = await panel.load();
    if (!d) return say('Could not load the hand-ins.', 'err');
    const files = [...input.files];
    let ok = 0;
    const bad: string[] = [];
    for (const [i, file] of files.entries()) {
      say(`Uploading ${i + 1} of ${files.length}: ${file.name}…`);
      try {
        const inside = await unzip(new Uint8Array(await file.arrayBuffer()), (n) => n === 'preview.json');
        const man = JSON.parse(new TextDecoder().decode(inside.get('preview.json') ?? new Uint8Array()));
        if (!/^[a-z0-9]{20}$/.test(String(man.key ?? ''))) throw new Error('not a build ZIP from the builder');
        let res: Response;
        if (d.upload === 'blob') {
          const blob = await upload(`${d.folder}/previews/${man.key}.zip`, file, { access: 'public', handleUploadUrl: '/api/admin/previews/upload', contentType: 'application/zip' });
          res = await fetch('/api/admin/previews', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'build', item: d.list.item, url: blob.url, pathname: blob.pathname, size: file.size }) });
        } else {
          const form = new FormData();
          form.set('item', d.list.item);
          form.set('file', file);
          res = await fetch('/api/admin/previews', { method: 'POST', body: form });
        }
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error ?? 'could not save');
        ok++;
      } catch (error) {
        bad.push(`${file.name}: ${error instanceof Error ? error.message : 'failed'}`);
      }
    }
    input.value = '';
    summary(await panel.load(true));
    say(`${ok} build${ok === 1 ? '' : 's'} uploaded.${bad.length ? ` Not uploaded: ${bad.join(' · ')}` : ''}`, bad.length ? 'err' : 'ok');
  });
}
