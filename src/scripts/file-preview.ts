/**
 * Preview hand-ins and briefs in the browser instead of downloading them: PDF, PNG/JPG, Word, PowerPoint and
 * ZIP, the file types students may hand in (lib/project-files/core.ts). Everything happens in this browser:
 * files come from Vercel Blob (public, CORS-enabled, as for the ZIP download) or, before an upload, straight
 * from the student's own disk, and are never sent anywhere else.
 *
 *   PDF          pages drawn with pdf.js (lazy-loaded, the same build the groups page uses)
 *   PNG / JPG    the image
 *   DOCX / PPTX  their text, tables and lists (doc-text.ts); "Download" gives the original layout
 *   ZIP          the files inside; any PDF, image, Word or PowerPoint file in it opens in the same viewer
 *
 * openPreview(items, index) shows one overlay with previous/next through `items` (← → keys), Esc to close.
 */
import { loadPdfjs, officeLines, unzip } from './doc-text.ts';

export type PreviewItem = {
  /** what the file is, e.g. the student's name or the brief's title */
  title: string;
  /** a public URL … */
  url?: string;
  /** … or a local file (a student checking their file before handing it in) */
  file?: Blob;
  /** the file's own name, when the URL doesn't show it */
  fileName?: string;
  /** a short line under the title, e.g. "236541 · Team 4 · on time" */
  meta?: string;
};

type Kind = 'pdf' | 'image' | 'docx' | 'pptx' | 'zip' | 'other';
const KINDS: Record<string, Kind> = { pdf: 'pdf', png: 'image', jpg: 'image', jpeg: 'image', docx: 'docx', pptx: 'pptx', zip: 'zip' };
const KIND_LABEL: Record<Kind, string> = { pdf: 'PDF', image: 'Image', docx: 'Word', pptx: 'PowerPoint', zip: 'ZIP', other: 'File' };
const SKIP_IN_ZIP = /(^|\/)(__MACOSX\/|\._|\.DS_Store$)/;
const MAX_ZIP_ENTRIES = 200;

export const extOf = (name: string) => (/\.([a-z0-9]+)(?:$|[?#])/i.exec(name)?.[1] ?? '').toLowerCase();
export const kindOf = (name: string): Kind => KINDS[extOf(name)] ?? 'other';

/** The name to show for an item: its own file name, else the last part of its URL. */
export function fileNameOf(item: Pick<PreviewItem, 'fileName' | 'url' | 'file'>): string {
  if (item.fileName) return item.fileName;
  if (item.file && 'name' in item.file && typeof item.file.name === 'string') return item.file.name;
  try { return decodeURIComponent(new URL(item.url ?? '', location.href).pathname.split('/').pop() || 'file'); } catch { return 'file'; }
}

/** Vercel Blob serves a file as an attachment when asked with ?download=1; other URLs are linked as they are. */
export function downloadUrl(url: string): string {
  try {
    const u = new URL(url, location.href);
    if (u.hostname.endsWith('.blob.vercel-storage.com')) u.searchParams.set('download', '1');
    return u.toString();
  } catch {
    return url;
  }
}

const size = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/* ------------------------------------------------------------------ overlay */

let dialog: HTMLDialogElement | null = null;
let items: PreviewItem[] = [];
let index = 0;
let returnFocus: HTMLElement | null = null;
/** undone when the shown file changes or the preview closes */
let cleanups: (() => void)[] = [];
let run = 0;

const cleanUp = () => { for (const fn of cleanups.splice(0)) { try { fn(); } catch { /* already gone */ } } };

function ensureDialog(): HTMLDialogElement {
  if (dialog?.isConnected) return dialog;
  injectStyle();
  const d = el('dialog', 'fp');
  d.setAttribute('aria-labelledby', 'fp-title');
  d.innerHTML = `
    <header class="fp-bar">
      <div class="fp-id"><b id="fp-title" data-fp-title></b><small class="mono" data-fp-meta></small></div>
      <div class="fp-act">
        <span class="fp-count mono" data-fp-count></span>
        <button type="button" class="fp-btn" data-fp-prev aria-label="Previous file" title="Previous (←)">←</button>
        <button type="button" class="fp-btn" data-fp-next aria-label="Next file" title="Next (→)">→</button>
        <a class="fp-btn fp-txt" data-fp-open target="_blank" rel="noopener">Open in new tab ↗</a>
        <a class="fp-btn fp-txt" data-fp-download rel="noopener">Download ↓</a>
        <button type="button" class="fp-btn fp-close" data-fp-close aria-label="Close preview" title="Close (Esc)">✕</button>
      </div>
    </header>
    <div class="fp-body" data-fp-body tabindex="0"></div>`;
  d.querySelector('[data-fp-close]')!.addEventListener('click', () => d.close());
  d.querySelector('[data-fp-prev]')!.addEventListener('click', () => go(-1));
  d.querySelector('[data-fp-next]')!.addEventListener('click', () => go(1));
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); }); // the backdrop
  // on the document, so ← → keep working even when the focused button was just replaced
  document.addEventListener('keydown', (e) => {
    if (!d.open || (e.target as HTMLElement | null)?.closest?.('input, textarea, select')) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
  });
  d.addEventListener('close', () => {
    run++;
    cleanUp();
    d.querySelector('[data-fp-body]')!.replaceChildren();
    document.documentElement.classList.remove('fp-open');
    returnFocus?.focus?.();
  });
  document.body.append(d);
  dialog = d;
  return d;
}

function go(step: number) {
  const next = index + step;
  if (next < 0 || next >= items.length) return;
  index = next;
  void show();
}

/** Opens the preview on items[start]; previous/next move through the list. */
export function openPreview(list: PreviewItem[], start = 0): void {
  if (!list.length) return;
  const d = ensureDialog();
  items = list;
  index = Math.min(Math.max(0, start), list.length - 1);
  if (!d.open) {
    returnFocus = document.activeElement as HTMLElement | null;
    d.showModal();
    document.documentElement.classList.add('fp-open');
  }
  void show();
}

async function show() {
  const d = ensureDialog();
  const mine = ++run;
  cleanUp();
  const item = items[index];
  const name = fileNameOf(item);
  d.querySelector('[data-fp-title]')!.textContent = item.title;
  d.querySelector('[data-fp-meta]')!.textContent = [item.meta, `${KIND_LABEL[kindOf(name)]} · ${name}`].filter(Boolean).join(' · ');
  d.querySelector('[data-fp-count]')!.textContent = items.length > 1 ? `${index + 1} / ${items.length}` : '';
  d.querySelector<HTMLButtonElement>('[data-fp-prev]')!.hidden = items.length < 2;
  d.querySelector<HTMLButtonElement>('[data-fp-next]')!.hidden = items.length < 2;
  d.querySelector<HTMLButtonElement>('[data-fp-prev]')!.disabled = index === 0;
  d.querySelector<HTMLButtonElement>('[data-fp-next]')!.disabled = index === items.length - 1;
  const open = d.querySelector<HTMLAnchorElement>('[data-fp-open]')!;
  const download = d.querySelector<HTMLAnchorElement>('[data-fp-download]')!;
  open.hidden = download.hidden = !item.url;
  if (item.url) { open.href = item.url; download.href = downloadUrl(item.url); }
  const body = d.querySelector<HTMLElement>('[data-fp-body]')!;
  body.scrollTop = 0;
  // a button that just became disabled (first/last file) drops focus to the page: keep it in the preview,
  // where ← → change file and ↑ ↓ scroll
  const focused = document.activeElement as HTMLButtonElement | null;
  if (!focused || !d.contains(focused) || focused.disabled) body.focus({ preventScroll: true });
  const stillHere = () => mine === run && d.open;
  await renderFile(body, name, item.url, () => bytesOf(item), stillHere);
}

async function bytesOf(item: PreviewItem): Promise<Uint8Array> {
  if (item.file) return new Uint8Array(await item.file.arrayBuffer());
  const res = await fetch(item.url!, { cache: 'no-store' });
  if (!res.ok) throw new Error(`The file could not be downloaded (${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}

function status(target: HTMLElement, text: string, tone: 'wait' | 'err' = 'wait') {
  const p = el('p', `fp-status ${tone}`, text);
  p.setAttribute('role', tone === 'err' ? 'alert' : 'status');
  target.replaceChildren(p);
}

/* ------------------------------------------------------------------ renderers */

async function renderFile(target: HTMLElement, name: string, url: string | undefined, load: () => Promise<Uint8Array>, alive: () => boolean, back?: () => void) {
  cleanUp(); // the file shown before (PDF document, image URLs) is replaced
  const kind = kindOf(name);
  status(target, `Opening ${name}…`);
  const frame = el('div', 'fp-frame');
  if (back) {
    const b = el('button', 'fp-back', '← Back to the ZIP contents');
    b.type = 'button';
    b.addEventListener('click', back);
    frame.append(b);
  }
  try {
    if (kind === 'other') {
      frame.append(el('p', 'fp-status', `There is no preview for .${extOf(name) || '?'} files. Use Download to open it on your computer.`));
      target.replaceChildren(frame);
      return;
    }
    if (kind === 'image' && url) {
      frame.append(image(url, name));
      target.replaceChildren(frame);
      return;
    }
    const bytes = await load();
    if (!alive()) return;
    if (kind === 'image') {
      const src = URL.createObjectURL(new Blob([bytes as BlobPart]));
      cleanups.push(() => URL.revokeObjectURL(src));
      frame.append(image(src, name));
      target.replaceChildren(frame);
    } else if (kind === 'pdf') {
      target.replaceChildren(frame);
      await renderPdf(frame, bytes, alive);
    } else if (kind === 'docx' || kind === 'pptx') {
      frame.append(documentView(await officeLines(kind, bytes), kind));
      if (alive()) target.replaceChildren(frame);
    } else {
      frame.append(await zipView(bytes, (entry, data) => {
        void renderFile(target, entry, undefined, async () => data, alive, () => void renderFile(target, name, url, async () => bytes, alive, back));
      }));
      if (alive()) target.replaceChildren(frame);
    }
  } catch (error) {
    if (!alive()) return;
    const why = error instanceof Error && error.message ? error.message : 'Unknown error.';
    status(target, `This ${KIND_LABEL[kind]} file could not be shown. ${why} Use Download to open it on your computer.`, 'err');
    if (back) target.prepend(frame);
  }
}

function image(src: string, name: string) {
  const img = el('img', 'fp-img');
  img.src = src;
  img.alt = name;
  img.decoding = 'async';
  img.addEventListener('click', () => img.classList.toggle('full'));
  return img;
}

async function renderPdf(frame: HTMLElement, bytes: Uint8Array, alive: () => boolean) {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data: bytes });
  cleanups.push(() => void task.destroy());
  const doc = await task.promise;
  if (!alive()) return;
  const tools = el('div', 'fp-tools');
  const info = el('span', 'mono', `${doc.numPages} page${doc.numPages === 1 ? '' : 's'}`);
  const zoomOut = el('button', 'fp-btn', '−');
  const zoomFit = el('button', 'fp-btn fp-txt', 'Fit width');
  const zoomIn = el('button', 'fp-btn', '+');
  zoomOut.type = zoomFit.type = zoomIn.type = 'button';
  zoomOut.setAttribute('aria-label', 'Zoom out');
  zoomIn.setAttribute('aria-label', 'Zoom in');
  tools.append(info, zoomOut, zoomFit, zoomIn);
  const pages = el('div', 'fp-pages');
  frame.append(tools, pages);

  const first = (await doc.getPage(1)).getViewport({ scale: 1 });
  const holders = Array.from({ length: doc.numPages }, (_, i) => {
    const h = el('div', 'fp-page');
    h.dataset.page = String(i + 1);
    h.style.aspectRatio = `${first.width} / ${first.height}`;
    h.setAttribute('aria-label', `Page ${i + 1}`);
    pages.append(h);
    return h;
  });

  const draw = async (h: HTMLElement) => {
    const page = await doc.getPage(Number(h.dataset.page));
    if (!alive()) return;
    const base = page.getViewport({ scale: 1 });
    h.style.aspectRatio = `${base.width} / ${base.height}`;
    const scale = (h.clientWidth / base.width) * Math.min(window.devicePixelRatio || 1, 2);
    const viewport = page.getViewport({ scale });
    const canvas = el('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvas, viewport }).promise;
    if (alive()) h.replaceChildren(canvas);
    page.cleanup();
  };
  const seen = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const h = e.target as HTMLElement;
      if (!e.isIntersecting || h.dataset.drawn) continue;
      h.dataset.drawn = '1';
      void draw(h).catch(() => { h.textContent = `Page ${h.dataset.page} could not be drawn.`; });
    }
  }, { root: frame.closest('.fp-body'), rootMargin: '800px 0px' });
  holders.forEach((h) => seen.observe(h));
  cleanups.push(() => seen.disconnect());

  let zoom = 1;
  const setZoom = (z: number) => {
    zoom = Math.min(3, Math.max(0.5, z));
    pages.style.setProperty('--fp-zoom', String(zoom));
    zoomFit.setAttribute('aria-pressed', String(zoom === 1));
    for (const h of holders) { delete h.dataset.drawn; seen.unobserve(h); seen.observe(h); }
  };
  zoomOut.addEventListener('click', () => setZoom(zoom - 0.25));
  zoomIn.addEventListener('click', () => setZoom(zoom + 0.25));
  zoomFit.addEventListener('click', () => setZoom(1));
}

/** Word/PowerPoint text as a readable page: "§ Slide N" → heading, "a | b" rows → a table, "• x" → a list. */
export function documentView(lines: string[], kind: 'docx' | 'pptx'): HTMLElement {
  const doc = el('article', 'fp-doc');
  doc.append(el('p', 'fp-note', `Text preview of this ${KIND_LABEL[kind]} file: its words, tables and lists. Download it to see the original layout${kind === 'pptx' ? ' and images' : ''}.`));
  let table: HTMLTableElement | null = null;
  let list: HTMLUListElement | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (!line.includes(' | ')) table = null;
    if (!line.startsWith('• ')) list = null;
    if (line.startsWith('§ ')) doc.append(el('h3', '', line.slice(2)));
    else if (line.includes(' | ')) {
      if (!table) { table = el('table'); const wrap = el('div', 'fp-table'); wrap.append(table); doc.append(wrap); }
      const tr = el('tr');
      for (const cell of line.split(' | ')) tr.append(el('td', '', cell));
      table.append(tr);
    } else if (line.startsWith('• ')) {
      if (!list) { list = el('ul'); doc.append(list); }
      list.append(el('li', '', line.slice(2)));
    } else doc.append(el('p', '', line));
  }
  if (doc.children.length === 1) doc.append(el('p', 'fp-status', 'This file has no readable text (it may contain only images).'));
  return doc;
}

async function zipView(bytes: Uint8Array, open: (name: string, data: Uint8Array) => void): Promise<HTMLElement> {
  const files = await unzip(bytes, (n) => !n.endsWith('/') && !SKIP_IN_ZIP.test(n));
  const box = el('div', 'fp-zip');
  const names = [...files.keys()].sort((a, b) => a.localeCompare(b));
  box.append(el('p', 'fp-note', `${names.length} file${names.length === 1 ? '' : 's'} in this ZIP. Open any PDF, image, Word or PowerPoint file.`));
  const ul = el('ul');
  for (const name of names.slice(0, MAX_ZIP_ENTRIES)) {
    const data = files.get(name)!;
    const kind = kindOf(name);
    const li = el('li');
    const b = el('button', 'fp-entry');
    b.type = 'button';
    b.append(el('span', 'fp-entry-k mono', KIND_LABEL[kind]), el('span', 'fp-entry-n', name), el('span', 'fp-entry-s mono', size(data.byteLength)));
    if (kind === 'other' || kind === 'zip') b.disabled = true;
    else b.addEventListener('click', () => open(name, data));
    li.append(b);
    ul.append(li);
  }
  box.append(ul);
  if (names.length > MAX_ZIP_ENTRIES) box.append(el('p', 'fp-note', `Showing the first ${MAX_ZIP_ENTRIES} files.`));
  if (!names.length) box.append(el('p', 'fp-status', 'This ZIP is empty.'));
  return box;
}

/* ------------------------------------------------------------------ styles */

function injectStyle() {
  if (document.getElementById('fp-style')) return;
  const style = el('style');
  style.id = 'fp-style';
  style.textContent = `
  html.fp-open { overflow: hidden; }
  .fp { width: min(1100px, calc(100vw - 32px)); height: calc(100dvh - 48px); max-width: none; max-height: none; padding: 0; border: 1px solid var(--line-2); border-radius: 18px;
    background: var(--bg); color: var(--text); box-shadow: 0 30px 80px -30px rgb(0 0 0 / .6); overflow: hidden; }
  .fp[open] { display: grid; grid-template-rows: auto minmax(0, 1fr); }
  .fp::backdrop { background: rgb(5 8 12 / .62); backdrop-filter: blur(3px); }
  .fp-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 16px; padding: 12px 14px 12px 18px; border-bottom: 1px solid var(--line); background: var(--surface); }
  .fp-id { display: grid; gap: 2px; min-width: 0; }
  .fp-id b { font-size: 15px; overflow-wrap: anywhere; }
  .fp-id small { font-size: 11.5px; color: var(--text-3); overflow-wrap: anywhere; }
  .fp-act { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .fp-count { font-size: 12px; color: var(--text-3); margin-right: 4px; }
  .fp-btn { display: inline-grid; place-items: center; min-width: 36px; height: 36px; padding: 0 10px; border-radius: 10px; border: 1px solid var(--line-2); background: var(--bg);
    color: var(--text); font: 600 13px var(--font-body, inherit); text-decoration: none; cursor: pointer; }
  .fp-btn:hover:not(:disabled) { border-color: var(--accent-text); }
  .fp-btn:disabled { opacity: .4; cursor: default; }
  .fp-btn[hidden] { display: none; }
  .fp-btn[aria-pressed='true'] { background: var(--accent-soft); border-color: var(--accent-text); }
  .fp-close { font-size: 15px; }
  .fp-body { overflow: auto; overscroll-behavior: contain; padding: 18px; background: var(--surface-2); }
  .fp-body:focus-visible { outline: 2px solid color-mix(in oklab, var(--accent-text) 45%, transparent); outline-offset: -2px; }
  .fp-frame { display: grid; gap: 14px; justify-items: center; }
  .fp-status { max-width: 60ch; margin: 40px auto; text-align: center; color: var(--text-2); }
  .fp-status.err { color: var(--danger, #d0303f); }
  .fp-back { justify-self: start; border: 0; background: none; color: var(--accent-text); font-weight: 600; cursor: pointer; padding: 4px 0; }
  .fp-tools { position: sticky; top: -18px; z-index: 1; display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-radius: 12px; background: color-mix(in oklab, var(--surface) 92%, transparent);
    border: 1px solid var(--line); backdrop-filter: blur(8px); font-size: 12.5px; color: var(--text-2); }
  .fp-tools .mono { margin-right: 6px; }
  .fp-pages { --fp-zoom: 1; display: grid; gap: 14px; width: calc(min(900px, 100%) * var(--fp-zoom)); }
  .fp-page { width: 100%; background: #fff; border-radius: 4px; box-shadow: 0 6px 24px -10px rgb(0 0 0 / .45); display: grid; place-items: center; color: #667; font-size: 13px; }
  .fp-page canvas { display: block; width: 100%; height: auto; border-radius: 4px; }
  .fp-img { max-width: 100%; max-height: calc(100dvh - 180px); object-fit: contain; border-radius: 8px; background: #fff; cursor: zoom-in; }
  .fp-img.full { max-height: none; cursor: zoom-out; }
  .fp-doc { width: min(780px, 100%); padding: clamp(18px, 4vw, 44px); border-radius: 10px; background: var(--bg); border: 1px solid var(--line); line-height: 1.6; display: grid; gap: 10px; }
  .fp-doc p, .fp-doc ul, .fp-doc h3 { margin: 0; }
  .fp-doc h3 { margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--line-2); font-size: 13px; letter-spacing: .08em; text-transform: uppercase; color: var(--text-3); }
  .fp-doc ul { padding-left: 22px; display: grid; gap: 4px; }
  .fp-table { overflow-x: auto; }
  .fp-doc table { border-collapse: collapse; width: 100%; font-size: 14px; }
  .fp-doc td { border: 1px solid var(--line-2); padding: 6px 8px; vertical-align: top; }
  .fp-note { font-size: 12.5px; color: var(--text-3); padding: 8px 10px; border-radius: 8px; background: var(--surface); border: 1px solid var(--line); }
  .fp-zip { width: min(780px, 100%); display: grid; gap: 10px; }
  .fp-zip ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .fp-entry { width: 100%; display: grid; grid-template-columns: 92px minmax(0, 1fr) auto; gap: 10px; align-items: center; min-height: 44px; padding: 8px 12px; border-radius: 10px;
    border: 1px solid var(--line-2); background: var(--bg); color: var(--text); text-align: left; cursor: pointer; font: inherit; }
  .fp-entry:hover:not(:disabled) { border-color: var(--accent-text); }
  .fp-entry:disabled { opacity: .55; cursor: default; }
  .fp-entry-k { font-size: 11px; color: var(--accent-text); }
  .fp-entry-n { overflow-wrap: anywhere; font-size: 14px; }
  .fp-entry-s { font-size: 11.5px; color: var(--text-3); }
  @media (max-width: 720px) {
    .fp { width: 100vw; height: 100dvh; border-radius: 0; border: 0; }
    .fp-bar { padding: calc(env(safe-area-inset-top, 0px) + 10px) 12px 10px; }
    .fp-body { padding: 12px 12px calc(env(safe-area-inset-bottom, 0px) + 12px); }
    .fp-txt { font-size: 12px; padding: 0 8px; }
    .fp [data-fp-open] { display: none; } /* Download stays; one row of actions fits a phone */
  }
  @media (prefers-reduced-motion: no-preference) { .fp[open] { animation: fp-in .18s ease-out; } @keyframes fp-in { from { opacity: 0; transform: translateY(8px) scale(.99); } } }
  `;
  document.head.append(style);
}

/* ------------------------------------------------------------------ buttons */

let wired = false;
/**
 * Any element with data-preview-url opens the preview when clicked (also inside lists drawn later with
 * innerHTML). data-preview-title / -meta / -name describe it; elements sharing a data-preview-group are
 * stepped through with previous/next, in page order.
 */
export function enablePreviewButtons(): void {
  if (wired) return;
  wired = true;
  document.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-preview-url]');
    if (!btn) return;
    e.preventDefault();
    const group = btn.dataset.previewGroup;
    const all = group ? [...document.querySelectorAll<HTMLElement>(`[data-preview-group="${CSS.escape(group)}"]`)] : [btn];
    openPreview(all.map((b) => ({ url: b.dataset.previewUrl, title: b.dataset.previewTitle || 'File', meta: b.dataset.previewMeta || undefined, fileName: b.dataset.previewName || undefined })), Math.max(0, all.indexOf(btn)));
  });
}

if (typeof document !== 'undefined') document.addEventListener('astro:before-swap', () => dialog?.open && dialog.close());
