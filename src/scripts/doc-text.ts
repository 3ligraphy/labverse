/**
 * Reads the text of a student's hand-in in the admin's browser, line by line, so the groups page can find the
 * contribution table and the proposed ideas. Files come straight from Vercel Blob (public, CORS-enabled), like
 * the ZIP download. PDF goes through pdf.js (loaded only when needed); Word and PowerPoint files are ZIPs of XML,
 * read with the browser's own DecompressionStream. A ZIP hand-in is opened and the PDF/Word/PowerPoint files
 * inside it are read. Table rows become one line with cells joined by " | ", and
 * Word list paragraphs start with "• " so numbered ideas are still recognisable.
 */

const MAX_PDF_PAGES = 15;
const MAX_FILES_IN_ZIP = 6;
const READABLE = ['pdf', 'docx', 'pptx'];

export type DocText = { lines: string[] } | { error: string };

const extOf = (url: string) => (/\.([a-z0-9]+)(?:$|[?#])/i.exec(new URL(url, location.href).pathname)?.[1] ?? '').toLowerCase();

export async function readDocText(url: string): Promise<DocText> {
  const ext = extOf(url);
  if (![...READABLE, 'zip'].includes(ext)) return { error: `${ext.toUpperCase() || 'This'} files can't be read; add the members and ideas by hand.` };
  if (ext === 'zip') {
    // extract first: read only the documents inside, not the whole (often large) project ZIP
    let inside: Map<string, Uint8Array> | null = null;
    try {
      let n = 0;
      inside = await unzipRemote(url, (f) => readableInZip(f) && n++ < MAX_FILES_IN_ZIP);
    } catch (error) {
      console.warn('[doc-text] ranged ZIP read failed, downloading it whole', url, error);
    }
    if (inside) {
      try {
        return clean(await zipDocLines(inside));
      } catch (error) {
        return failed('ZIP', error);
      }
    }
  }
  let bytes: Uint8Array;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { error: `Download failed (${res.status}).` };
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch {
    return { error: 'Download failed.' };
  }
  try {
    return clean(await linesOf(ext, bytes));
  } catch (error) {
    console.warn('[doc-text] could not read', url, error);
    return failed(ext.toUpperCase(), error);
  }
}

const clean = (lines: string[]): DocText => ({ lines: lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean) });
const failed = (kind: string, error: unknown): DocText => {
  const why = error instanceof Error && error.message ? ` (${error.message.slice(0, 120)})` : '';
  return { error: `The ${kind} file could not be read${why}.` };
};

async function linesOf(ext: string, bytes: Uint8Array): Promise<string[]> {
  if (ext === 'pdf') return pdfLines(bytes);
  if (ext === 'docx') return docxLines(bytes);
  if (ext === 'pptx') return pptxLines(bytes);
  return zipLines(bytes);
}

/** A ZIP hand-in: reads the PDF, Word and PowerPoint files inside it (macOS "._" leftovers skipped). */
const readableInZip = (n: string) => READABLE.includes(n.split('.').pop()!.toLowerCase()) && !/(^|\/)(__MACOSX\/|\._)/.test(n);

async function zipLines(bytes: Uint8Array): Promise<string[]> {
  return zipDocLines(await unzip(bytes, readableInZip));
}

async function zipDocLines(inside: Map<string, Uint8Array>): Promise<string[]> {
  if (!inside.size) throw new Error('no PDF, Word or PowerPoint file inside');
  const lines: string[] = [];
  for (const [name, data] of [...inside].slice(0, MAX_FILES_IN_ZIP)) {
    lines.push(...await linesOf(name.split('.').pop()!.toLowerCase(), data).catch(() => []));
  }
  return lines;
}

/* --------------------------------------------------------------------- PDF */

/**
 * Makes a ReadableStream usable with `for await` where the browser can't yet (Safari): pdf.js reads text and
 * unpacks compressed data that way. Self-contained, because it is also copied into the PDF worker as text.
 */
function installStreamIterator() {
  const proto = globalThis.ReadableStream?.prototype as (ReadableStream & { values?: unknown; [Symbol.asyncIterator]?: unknown }) | undefined;
  if (!proto || proto[Symbol.asyncIterator]) return;
  const values = function (this: ReadableStream, { preventCancel = false } = {}) {
    const reader = this.getReader();
    return {
      next: () => reader.read(),
      async return(value?: unknown) {
        try { if (!preventCancel) await reader.cancel(value); } finally { reader.releaseLock(); }
        return { done: true, value };
      },
      [Symbol.asyncIterator]() { return this; },
    };
  };
  Object.defineProperty(proto, 'values', { value: values, configurable: true, writable: true });
  Object.defineProperty(proto, Symbol.asyncIterator, { value: values, configurable: true, writable: true });
}

/**
 * The PDF worker, started from a copy that installs the stream fix first (a worker has its own globals).
 * Not on the dev server: there Vite serves the worker with imports that only resolve from its own URL.
 */
let workerSrc: Promise<string> | null = null;
const pdfWorker = (url: string) => (import.meta.env.DEV ? Promise.resolve(url) : workerSrc ??= fetch(url)
  .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
  .then((code) => URL.createObjectURL(new Blob([`(${installStreamIterator.toString()})();\n`, code], { type: 'text/javascript' })))
  .catch(() => url));

/**
 * pdf.js, set up once (also used by the file preview, src/scripts/file-preview.ts). The legacy build: the standard one calls brand-new JavaScript (Promise.try,
 * Math.sumPrecise, Map.getOrInsertComputed…) directly, which Safari on iPhone doesn't have yet. Safari also
 * can't `for await` over a stream, which pdf.js does on the page and in its worker.
 */
export async function loadPdfjs() {
  installStreamIterator();
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = await pdfWorker((await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default);
  }
  return pdfjs;
}

/**
 * Draws a PDF's pages into `box` as images (works where the browser can't show PDFs inline, like iPhone).
 * Returns how many pages the file has; at most `maxPages` are drawn.
 */
export async function renderPdf(url: string, box: HTMLElement, maxPages = 20): Promise<number> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Download failed (${res.status}).`);
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data: new Uint8Array(await res.arrayBuffer()) });
  const doc = await task.promise;
  // the box may not be laid out yet: measure it, else its parent
  const width = Math.max(280, box.clientWidth || box.parentElement?.clientWidth || 600);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  try {
    for (let p = 1; p <= Math.min(doc.numPages, maxPages); p++) {
      if (!box.isConnected) break; // the viewer moved on to another file
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: (width / page.getViewport({ scale: 1 }).width) * dpr });
      const canvas = Object.assign(document.createElement('canvas'), { width: Math.floor(viewport.width), height: Math.floor(viewport.height) });
      canvas.className = 'gp-v-page';
      canvas.setAttribute('aria-label', `Page ${p}`);
      box.append(canvas);
      await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
      page.cleanup();
    }
    return doc.numPages;
  } finally {
    await task.destroy();
  }
}

async function pdfLines(bytes: Uint8Array): Promise<string[]> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data: bytes });
  const doc = await task.promise;
  const lines: string[] = [];
  try {
    for (let p = 1; p <= Math.min(doc.numPages, MAX_PDF_PAGES); p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      // Items on one visual row share a y position; a gap wider than about half a letter is a table cell
      // boundary (a space between words is about a quarter). Space-only items are skipped when measuring:
      // Word and browsers put one wide "space" between cells that would hide the gap.
      let line = '';
      let lastY: number | null = null;
      let lastEnd = 0;
      for (const item of content.items) {
        if (!('str' in item)) continue;
        if (!item.str.trim()) { if (item.hasEOL) { if (line) lines.push(line); line = ''; lastY = null; } continue; }
        const [size, , , , x, y] = item.transform as number[];
        const gap = x - lastEnd;
        if (lastY !== null && Math.abs(y - lastY) > 2) { lines.push(line); line = ''; }
        else if (line && gap > Math.max(5, Math.abs(size) * 0.6)) line += ' | ';
        else if (line && gap > 0.5 && !line.endsWith(' ') && !item.str.startsWith(' ')) line += ' ';
        line += item.str;
        lastY = y;
        lastEnd = x + (item.width ?? 0);
        if (item.hasEOL) { lines.push(line); line = ''; lastY = null; }
      }
      if (line) lines.push(line);
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return lines;
}

/* -------------------------------------------------------------- Word, PPTX */

/** Reads bytes [start, end) of a ZIP, from memory or over the network. */
type ZipReader = (start: number, end: number) => Promise<Uint8Array>;

/** Reads the files whose names pass `name` out of a ZIP (stored or deflated). Also used by the file preview. */
export async function unzip(bytes: Uint8Array, name: (n: string) => boolean): Promise<Map<string, Uint8Array>> {
  return unzipWith(async (start, end) => bytes.subarray(start, end), bytes.length, name);
}

async function unzipWith(read: ZipReader, total: number, name: (n: string) => boolean): Promise<Map<string, Uint8Array>> {
  const tailStart = Math.max(0, total - 65_557);
  const tail = await read(tailStart, total);
  const tv = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) if (tv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not a zip');
  const count = tv.getUint16(eocd + 10, true);
  const cdSize = tv.getUint32(eocd + 12, true);
  const cdStart = tv.getUint32(eocd + 16, true);
  const cd = cdStart >= tailStart ? tail.subarray(cdStart - tailStart, cdStart - tailStart + cdSize) : await read(cdStart, cdStart + cdSize);
  const view = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
  const out = new Map<string, Uint8Array>();
  const dec = new TextDecoder();
  let at = 0;
  for (let n = 0; n < count && at + 46 <= cd.length && view.getUint32(at, true) === 0x02014b50; n++) {
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const nameLen = view.getUint16(at + 28, true);
    const skip = nameLen + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const file = dec.decode(cd.subarray(at + 46, at + 46 + nameLen));
    at += 46 + skip;
    if (!name(file)) continue;
    const head = await read(local, local + 30);
    const hv = new DataView(head.buffer, head.byteOffset, head.byteLength);
    const start = local + 30 + hv.getUint16(26, true) + hv.getUint16(28, true);
    const data = (await read(start, start + size)).slice();
    if (method === 0) out.set(file, data);
    else if (method === 8) out.set(file, new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()));
  }
  return out;
}

/**
 * Opens a ZIP on the server without downloading all of it: the index at its end, then only the files that pass
 * `name` (HTTP range requests). Project ZIPs can be far too big to download whole in the browser.
 * Returns null when the server ignores ranges, so the caller can fall back to a full download.
 */
async function unzipRemote(url: string, name: (n: string) => boolean): Promise<Map<string, Uint8Array> | null> {
  const get = async (range: string) => {
    const res = await fetch(url, { headers: { Range: range }, cache: 'no-store' });
    if (res.status !== 206) { void res.body?.cancel(); return null; }
    return { res, bytes: new Uint8Array(await res.arrayBuffer()) };
  };
  const first = await get('bytes=-65557');
  const total = Number(/\/(\d+)\s*$/.exec(first?.res.headers.get('content-range') ?? '')?.[1]);
  if (!first || !Number.isFinite(total)) return null;
  const tailStart = total - first.bytes.length;
  return unzipWith(async (start, end) => {
    if (start >= tailStart) return first.bytes.subarray(start - tailStart, end - tailStart);
    if (end <= start) return new Uint8Array();
    const part = await get(`bytes=${start}-${end - 1}`);
    if (!part) throw new Error('range request refused');
    return part.bytes;
  }, total, name);
}

const xml = (data: Uint8Array) => new DOMParser().parseFromString(new TextDecoder().decode(data), 'application/xml');
const kids = (el: Element) => [...el.children];
const named = (el: Element, local: string) => el.localName === local;

/** Text of a Word paragraph: runs, tabs and line breaks. */
function wordPara(p: Element): string {
  let s = '';
  const walk = (el: Element) => {
    for (const c of kids(el)) {
      if (named(c, 't')) s += c.textContent ?? '';
      else if (named(c, 'tab')) s += ' ';
      else if (named(c, 'br') || named(c, 'cr')) s += '\n';
      else if (!named(c, 'pPr') && !named(c, 'rPr')) walk(c);
    }
  };
  walk(p);
  const list = [...p.getElementsByTagName('*')].some((e) => named(e, 'numPr'));
  return list && s.trim() ? `• ${s}` : s;
}

function wordBlocks(parent: Element, lines: string[]) {
  for (const el of kids(parent)) {
    if (named(el, 'p')) lines.push(...wordPara(el).split('\n'));
    else if (named(el, 'tbl')) {
      for (const tr of kids(el).filter((e) => named(e, 'tr'))) {
        const cells = kids(tr).filter((e) => named(e, 'tc')).map((tc) => {
          const inner: string[] = [];
          wordBlocks(tc, inner);
          return inner.map((l) => l.trim()).filter(Boolean).join(' ');
        });
        lines.push(cells.join(' | '));
      }
    } else if (named(el, 'sdt') || named(el, 'sdtContent') || named(el, 'customXml')) wordBlocks(el, lines);
  }
}

async function docxLines(bytes: Uint8Array): Promise<string[]> {
  const files = await unzip(bytes, (n) => n === 'word/document.xml');
  const doc = files.get('word/document.xml');
  if (!doc) throw new Error('no document.xml');
  const body = [...xml(doc).getElementsByTagName('*')].find((e) => named(e, 'body'));
  const lines: string[] = [];
  if (body) wordBlocks(body, lines);
  return lines;
}

/** Word or PowerPoint text for the file preview; each PowerPoint slide starts with a "§ Slide N" line. */
export async function officeLines(ext: 'docx' | 'pptx', bytes: Uint8Array): Promise<string[]> {
  return ext === 'docx' ? docxLines(bytes) : pptxLines(bytes, true);
}

async function pptxLines(bytes: Uint8Array, slideHeadings = false): Promise<string[]> {
  const files = await unzip(bytes, (n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  const slides = [...files].sort(([a], [b]) => Number(/\d+/.exec(a)![0]) - Number(/\d+/.exec(b)![0]));
  const lines: string[] = [];
  for (const [i, [, text]] of slides.entries()) {
    if (slideHeadings) lines.push(`§ Slide ${i + 1}`);
    const doc = xml(text);
    for (const el of doc.getElementsByTagName('*')) {
      if (named(el, 'tr')) lines.push(kids(el).filter((c) => named(c, 'tc')).map((tc) => [...tc.getElementsByTagName('*')].filter((t) => named(t, 't')).map((t) => t.textContent).join('')).join(' | '));
      else if (named(el, 'p')) {
        let inTable = false; // table text is already on its row's line
        for (let up = el.parentElement; up; up = up.parentElement) if (named(up, 'tbl')) { inTable = true; break; }
        if (inTable) continue;
        const bullet = [...el.getElementsByTagName('*')].some((a) => named(a, 'buAutoNum') || named(a, 'buChar'));
        const t = [...el.getElementsByTagName('*')].filter((a) => named(a, 't')).map((a) => a.textContent).join('');
        if (t.trim()) lines.push(bullet ? `• ${t}` : t);
      }
    }
  }
  return lines;
}
