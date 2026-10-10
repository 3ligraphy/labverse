/**
 * Reads the text of a student's hand-in in the admin's browser, line by line, so the groups page can find the
 * contribution table and the proposed ideas. Files come straight from Vercel Blob (public, CORS-enabled), like
 * the ZIP download. PDF goes through pdf.js (loaded only when needed); Word and PowerPoint files are ZIPs of XML,
 * read with the browser's own DecompressionStream. Table rows become one line with cells joined by " | ", and
 * Word list paragraphs start with "• " so numbered ideas are still recognisable.
 */

const MAX_PDF_PAGES = 15;

export type DocText = { lines: string[] } | { error: string };

const extOf = (url: string) => (/\.([a-z0-9]+)(?:$|[?#])/i.exec(new URL(url, location.href).pathname)?.[1] ?? '').toLowerCase();

export async function readDocText(url: string): Promise<DocText> {
  const ext = extOf(url);
  if (!['pdf', 'docx', 'pptx'].includes(ext)) return { error: `${ext.toUpperCase() || 'This'} files can't be read; add the members and ideas by hand.` };
  let bytes: Uint8Array;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { error: `Download failed (${res.status}).` };
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch {
    return { error: 'Download failed.' };
  }
  try {
    const lines = ext === 'pdf' ? await pdfLines(bytes) : ext === 'docx' ? await docxLines(bytes) : await pptxLines(bytes);
    return { lines: lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean) };
  } catch (error) {
    console.warn('[doc-text] could not read', url, error);
    return { error: `The ${ext.toUpperCase()} file could not be read.` };
  }
}

/* --------------------------------------------------------------------- PDF */

async function pdfLines(bytes: Uint8Array): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist');
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  }
  const task = pdfjs.getDocument({ data: bytes });
  const doc = await task.promise;
  const lines: string[] = [];
  try {
    for (let p = 1; p <= Math.min(doc.numPages, MAX_PDF_PAGES); p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      // Items on one visual row share a y position; a big gap between them is a table cell boundary.
      let line = '';
      let lastY: number | null = null;
      let lastEnd = 0;
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const [, , , , x, y] = item.transform as number[];
        if (lastY !== null && Math.abs(y - lastY) > 2) { lines.push(line); line = ''; }
        else if (line && x - lastEnd > 12) line += ' | ';
        else if (line && x - lastEnd > 1 && !line.endsWith(' ') && !item.str.startsWith(' ')) line += ' ';
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

/** Reads one file out of a ZIP (stored or deflated). */
async function unzip(bytes: Uint8Array, name: (n: string) => boolean): Promise<Map<string, string>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not a zip');
  const count = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);
  const out = new Map<string, string>();
  const dec = new TextDecoder();
  for (let n = 0; n < count && view.getUint32(at, true) === 0x02014b50; n++) {
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const nameLen = view.getUint16(at + 28, true);
    const skip = nameLen + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const file = dec.decode(bytes.subarray(at + 46, at + 46 + nameLen));
    at += 46 + skip;
    if (!name(file)) continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.slice(start, start + size);
    if (method === 0) out.set(file, dec.decode(data));
    else if (method === 8) out.set(file, await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text());
  }
  return out;
}

const xml = (text: string) => new DOMParser().parseFromString(text, 'application/xml');
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

async function pptxLines(bytes: Uint8Array): Promise<string[]> {
  const files = await unzip(bytes, (n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  const slides = [...files].sort(([a], [b]) => Number(/\d+/.exec(a)![0]) - Number(/\d+/.exec(b)![0]));
  const lines: string[] = [];
  for (const [, text] of slides) {
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
