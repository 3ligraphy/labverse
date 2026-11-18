/**
 * The GitHub repo named in a hand-in, for the app builder: the text and link targets of its PDF report, of a Word
 * file, or of the reports, READMEs, package.json, app.json and .git/config inside its ZIP. Same rules as the marking
 * page's own search (src/scripts/project-panel.ts → repoInHandIn); the repo is picked by findRepo (src/lib/previews/core.ts).
 * Run with the TypeScript loader: node --import ./tests/support/register-tsx.mjs …
 */
import { unzipSync } from 'fflate';
import { findRepo } from '../../src/lib/previews/core.ts';

const isPdf = (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;
const isZip = (b) => b[0] === 0x50 && b[1] === 0x4b;
const skipped = (n) => /(^|\/)(node_modules|__MACOSX|\.expo|\.git\/objects)\//.test(n) || /(^|\/)\._/.test(n);
const dec = new TextDecoder();

let pdfjs = null;
async function loadPdfjs() {
  if (!pdfjs) {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = import.meta.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
  }
  return pdfjs;
}

/** A PDF's text and its link targets (a repo link is often only a hyperlink). */
export async function pdfText(bytes) {
  const lib = await loadPdfjs();
  const task = lib.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true, verbosity: 0 });
  const doc = await task.promise;
  let out = '';
  try {
    for (let p = 1; p <= Math.min(doc.numPages, 60); p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      out += content.items.map((i) => ('str' in i ? i.str : '')).join(' ') + '\n';
      const links = await page.getAnnotations();
      out += links.map((a) => a.url ?? a.unsafeUrl ?? '').join(' ') + '\n';
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return out;
}

/** A Word file's text and hyperlink targets. */
export function docxText(bytes) {
  const parts = unzipSync(bytes, { filter: (f) => f.name === 'word/document.xml' || f.name === 'word/_rels/document.xml.rels' });
  return Object.values(parts).map((b) => dec.decode(b).replace(/<w:p[ >]/g, '\n$&').replace(/Target="([^"]+)"/g, ' $1 ').replace(/<[^>]+>/g, '')).join('\n');
}

/** The repo a hand-in names ("owner/name"), or null. Unreadable parts are skipped. */
export async function repoInHandIn(bytes) {
  const texts = [];
  if (isPdf(bytes)) texts.push(await pdfText(bytes).catch(() => ''));
  else if (isZip(bytes)) {
    let files = {};
    try {
      files = unzipSync(bytes, { filter: (f) => !skipped(f.name) && f.originalSize < 60 * 1024 * 1024 && (/\.(pdf|docx|md|txt)$/i.test(f.name) || /(^|\/)(package\.json|app\.json|\.git\/config|config)$/i.test(f.name) || f.name === 'word/document.xml' || f.name === 'word/_rels/document.xml.rels') });
    } catch {
      return null;
    }
    if (files['word/document.xml']) texts.push(docxText(bytes));
    for (const [name, b] of Object.entries(files)) {
      if (name.startsWith('word/')) continue;
      try {
        if (/\.pdf$/i.test(name)) texts.push(await pdfText(b));
        else if (/\.docx$/i.test(name)) texts.push(docxText(b));
        else texts.push(dec.decode(b));
      } catch {
        /* an unreadable file in the hand-in: the others still count */
      }
    }
  }
  return findRepo(texts.join('\n'));
}
