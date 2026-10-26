/**
 * The group feedback report as a PDF, built in the browser (pdf-lib): BUE identity (navy, union red, the BUE
 * logo), a summary, then one card per group with its members, approved idea and written feedback. A card that
 * doesn't fit on a page continues on the next one. Fonts: Inter (SIL Open Font License), embedded.
 */
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import interRegular from '@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf?url';
import interSemi from '@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf?url';
import interBold from '@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf?url';
import bueLogo from '@/assets/branding/bue-logo.png';
import type { ReportRow } from '@/lib/project-files/feedback';

const hex = (h: string): RGB => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const C = {
  navy: hex('#12284C'), navyDeep: hex('#0B1B36'), red: hex('#C8102E'), ink: hex('#1B2232'), muted: hex('#5E6879'),
  faint: hex('#8A93A3'), line: hex('#D9DEE7'), soft: hex('#F3F5F9'), navySoft: hex('#EAF0F8'), white: rgb(1, 1, 1),
  warnSoft: hex('#FDF1E3'), warn: hex('#A55A00'),
};

const W = 595.28, H = 841.89, M = 42;
const CW = W - 2 * M;
const FOOT = 46; // reserved at the bottom of every page
const PAD = 16;

type Fonts = { regular: PDFFont; semi: PDFFont; bold: PDFFont };

/** Characters the font can't draw become "?" (pdf-lib would otherwise draw empty boxes). */
function sanitizer(font: PDFFont) {
  const have = new Set(font.getCharacterSet());
  return (s: string) => [...s.replace(/\t/g, '    ').replace(/[​-‏﻿]/g, '')].map((ch) => (ch === '\n' || have.has(ch.codePointAt(0)!) ? ch : '?')).join('');
}

/** Word-wraps text (keeping its line breaks) to `width`; words longer than a line are broken. */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  const fits = (s: string) => font.widthOfTextAtSize(s, size) <= width;
  for (const para of text.split('\n')) {
    let line = '';
    for (let word of para.split(/ +/)) {
      while (!fits(word)) { // break a very long word
        let n = word.length - 1;
        while (n > 1 && !fits(word.slice(0, n))) n--;
        if (line) { out.push(line); line = ''; }
        out.push(word.slice(0, n));
        word = word.slice(n);
      }
      const next = line ? `${line} ${word}` : word;
      if (fits(next)) line = next; else { out.push(line); line = word; }
    }
    out.push(line);
  }
  while (out.length > 1 && !out.at(-1)) out.pop();
  return out;
}

const ellipsis = (s: string, font: PDFFont, size: number, width: number) => {
  if (font.widthOfTextAtSize(s, size) <= width) return s;
  let t = s;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > width) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
};

/** A rounded rectangle; (x, top) is its top-left corner in PDF coordinates. */
function roundRect(page: PDFPage, x: number, top: number, w: number, h: number, r: number, opts: { fill?: RGB; border?: RGB; borderWidth?: number }) {
  r = Math.min(r, w / 2, h / 2);
  const d = `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`;
  page.drawSvgPath(d, { x, y: top, color: opts.fill, borderColor: opts.border, borderWidth: opts.border ? opts.borderWidth ?? 0.8 : 0 });
}

const spaced = (text: string, f: Fonts, size: number) => [...text.toUpperCase()].reduce((w, ch) => w + f.semi.widthOfTextAtSize(ch, size) + size * 0.12, 0);

/** Spaced capitals, like the site's mono labels. */
function label(page: PDFPage, text: string, x: number, y: number, f: Fonts, color = C.muted, size = 7.2) {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    page.drawText(ch, { x: cx, y, size, font: f.semi, color });
    cx += f.semi.widthOfTextAtSize(ch, size) + size * 0.12;
  }
  return cx - x;
}

export type ReportInput = { title: string; rows: ReportRow[]; generatedAt: Date; module?: string };
export type ReportAssets = { regular: ArrayBuffer | Uint8Array; semi: ArrayBuffer | Uint8Array; bold: ArrayBuffer | Uint8Array; logo: ArrayBuffer | Uint8Array };

/** Downloads the fonts and the logo, then builds the report. */
export async function feedbackPdf(input: ReportInput): Promise<Uint8Array> {
  const load = (u: string) => fetch(u).then((r) => { if (!r.ok) throw new Error('a font or the logo could not be downloaded'); return r.arrayBuffer(); });
  const [regular, semi, bold, logo] = await Promise.all([load(interRegular), load(interSemi), load(interBold), load(bueLogo.src)]);
  return buildFeedbackPdf({ regular, semi, bold, logo }, input);
}

export async function buildFeedbackPdf(assets: ReportAssets, { title, rows, generatedAt, module = 'Mobile Development' }: ReportInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const { regular: reg, semi, bold, logo: logoBytes } = assets;
  const f: Fonts = { regular: await doc.embedFont(reg, { subset: false }), semi: await doc.embedFont(semi, { subset: false }), bold: await doc.embedFont(bold, { subset: false }) };
  const logo = await doc.embedPng(logoBytes);
  const clean = sanitizer(f.regular);

  const reportTitle = clean(title);
  const dateText = generatedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.setTitle(`${reportTitle} — Group feedback`);
  doc.setAuthor('The British University in Egypt · Faculty of Informatics & Computer Science');
  doc.setSubject('Project group feedback report');
  doc.setCreator('BUENOVA');
  doc.setCreationDate(generatedAt);

  let page!: PDFPage;
  let y = 0; // cursor: the top of the next thing to draw

  /* ------------------------------------------------------------ page frame */
  const newPage = (first = false) => {
    page = doc.addPage([W, H]);
    const band = first ? 132 : 58;
    page.drawRectangle({ x: 0, y: H - band, width: W, height: band, color: C.navy });
    page.drawRectangle({ x: 0, y: H - band - 4, width: W, height: 4, color: C.red });
    // Logo on a white plate (the logo has a transparent background and dark text).
    const lh = first ? 42 : 26;
    const lw = (logo.width / logo.height) * lh;
    const plateTop = H - (first ? 26 : 14);
    roundRect(page, M - 10, plateTop, lw + 20, lh + 12, 7, { fill: C.white });
    page.drawImage(logo, { x: M, y: plateTop - lh - 6, width: lw, height: lh });
    if (first) {
      const tx = M + lw + 34;
      page.drawRectangle({ x: tx - 16, y: plateTop - lh - 6, width: 0.8, height: lh, color: hex('#3B5078') });
      label(page, 'Faculty of', tx, plateTop - 17, f, hex('#AFC0DD'), 7);
      page.drawText('Informatics & Computer Science', { x: tx, y: plateTop - 33, size: 11, font: f.semi, color: C.white });
      page.drawText(module, { x: tx, y: plateTop - 47, size: 8.5, font: f.regular, color: hex('#C9D5EA') });
      label(page, 'Project feedback report', M, H - 92, f, hex('#AFC0DD'), 7.5);
      page.drawText(ellipsis(reportTitle, f.bold, 20, CW), { x: M, y: H - 116, size: 20, font: f.bold, color: C.white });
      const dw = f.regular.widthOfTextAtSize(dateText, 8.5);
      page.drawText(dateText, { x: W - M - dw, y: H - 92, size: 8.5, font: f.regular, color: hex('#C9D5EA') });
      y = H - band - 4 - 24;
    } else {
      const t = ellipsis(`${reportTitle} · Group feedback`, f.semi, 9.5, CW - lw - 40);
      page.drawText(t, { x: W - M - f.semi.widthOfTextAtSize(t, 9.5), y: H - 34, size: 9.5, font: f.semi, color: C.white });
      y = H - band - 4 - 22;
    }
  };
  const room = () => y - FOOT;

  newPage(true);

  /* -------------------------------------------------------------- summary */
  const students = rows.reduce((n, r) => n + r.members.length, 0);
  const tiles: [string, string][] = [
    ['Groups', String(rows.length)],
    ['Students', String(students)],
    ['Ideas approved', `${rows.filter((r) => r.idea).length} / ${rows.length}`],
    ['Feedback written', `${rows.filter((r) => r.feedback).length} / ${rows.length}`],
  ];
  const gap = 10, tw = (CW - gap * 3) / 4, th = 56;
  tiles.forEach(([k, v], i) => {
    const x = M + i * (tw + gap);
    roundRect(page, x, y, tw, th, 8, { fill: C.soft });
    page.drawRectangle({ x, y: y - th + 8, width: 3, height: th - 16, color: i === 0 ? C.red : C.navy });
    label(page, k, x + 14, y - 18, f, C.muted, 6.8);
    page.drawText(v, { x: x + 14, y: y - 44, size: 18, font: f.bold, color: C.navy });
  });
  y -= th + 26;

  /* ---------------------------------------------------------------- cards */
  const inner = CW - 2 * PAD;
  const colW = (inner - 16) / 2;
  const FB_SIZE = 9.8, FB_LEAD = 14.6;

  for (const row of rows) {
    const members = row.members.map((m) => ({ name: clean(m.name), id: clean(m.id) }));
    const memberRows = Math.max(1, Math.ceil(members.length / 2));
    const ideaLines = row.idea ? wrap(clean(row.idea), f.semi, 10.5, inner - 28 - 70) : [];
    const ideaH = row.idea ? 18 + ideaLines.length * 14 : 34;
    const fbLines = row.feedback ? wrap(clean(row.feedback), f.regular, FB_SIZE, inner) : [];
    const byline = row.feedbackBy
      ? `Written by ${clean(row.feedbackBy)}${row.feedbackAt ? ` · ${new Date(row.feedbackAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}`
      : '';
    const headH = 30 + 22 + memberRows * 17 + 12 + 18 + ideaH + 16 + 18 + (byline ? 16 : 0);
    const minFirst = headH + Math.min(3, Math.max(1, fbLines.length)) * FB_LEAD + PAD;
    if (room() < minFirst) newPage();

    let frameTop = y;
    const closeFrame = (bottom: number) => roundRect(page, M, frameTop, CW, frameTop - bottom, 10, { border: C.line, borderWidth: 0.9 });
    const x = M + PAD;

    // header: group pill + member count
    const pillText = clean(row.group).toUpperCase();
    const pw = spaced(pillText, f, 9) + 20;
    roundRect(page, x, y - PAD, pw, 20, 10, { fill: C.navy });
    label(page, pillText, x + 10, y - PAD - 13.5, f, C.white, 9);
    const count = `${members.length} member${members.length === 1 ? '' : 's'}`;
    page.drawText(count, { x: M + CW - PAD - f.regular.widthOfTextAtSize(count, 8.5), y: y - PAD - 13, size: 8.5, font: f.regular, color: C.muted });
    y -= PAD + 20 + 14;

    // members, two columns
    label(page, 'Group members', x, y - 8, f);
    y -= 22;
    if (!members.length) page.drawText('No members listed', { x, y: y - 10, size: 9.5, font: f.regular, color: C.faint });
    members.forEach((m, i) => {
      const cx = x + (i % 2) * (colW + 16);
      const cy = y - Math.floor(i / 2) * 17;
      page.drawCircle({ x: cx + 3, y: cy - 6.5, size: 2.2, color: C.red });
      const idW = f.regular.widthOfTextAtSize(m.id, 8.2);
      page.drawText(ellipsis(m.name, f.semi, 9.6, colW - idW - 22), { x: cx + 11, y: cy - 10, size: 9.6, font: f.semi, color: C.ink });
      page.drawText(m.id, { x: cx + colW - idW, y: cy - 10, size: 8.2, font: f.regular, color: C.muted });
    });
    y -= memberRows * 17 + 12;

    // approved idea
    label(page, 'Approved idea', x, y - 8, f);
    y -= 18;
    if (row.idea) {
      roundRect(page, x, y, inner, ideaH, 7, { fill: C.navySoft });
      page.drawRectangle({ x, y: y - ideaH, width: 3.5, height: ideaH, color: C.navy });
      ideaLines.forEach((l, i) => page.drawText(l, { x: x + 16, y: y - 18 - i * 14, size: 10.5, font: f.semi, color: C.navyDeep }));
      const tag = row.ideaMode === 'auto' ? 'APPROVED · DRAWN' : 'APPROVED';
      const tw2 = spaced(tag, f, 6.6) + 14;
      roundRect(page, x + inner - tw2 - 10, y - 9, tw2, 14, 7, { fill: C.navy });
      label(page, tag, x + inner - tw2 - 3, y - 18.6, f, C.white, 6.6);
    } else {
      roundRect(page, x, y, inner, ideaH, 7, { fill: C.warnSoft });
      page.drawText('No idea approved yet', { x: x + 14, y: y - 21, size: 9.8, font: f.semi, color: C.warn });
    }
    y -= ideaH + 16;

    // feedback (may continue on the next pages)
    label(page, 'Feedback', x, y - 8, f);
    y -= 18;
    if (byline) {
      page.drawText(ellipsis(byline, f.semi, 8.2, inner), { x, y: y - 9, size: 8.2, font: f.semi, color: C.muted });
      y -= 16;
    }
    if (!fbLines.length) {
      page.drawText('No feedback written.', { x, y: y - 10, size: FB_SIZE, font: f.regular, color: C.faint });
      y -= FB_LEAD;
    }
    for (const line of fbLines) {
      if (room() < FB_LEAD + PAD) {
        closeFrame(y - PAD + 4);
        newPage();
        frameTop = y;
        label(page, `${pillText} · feedback continued`, x, y - PAD - 8, f, C.muted, 7);
        y -= PAD + 22;
      }
      page.drawText(line, { x, y: y - 10, size: FB_SIZE, font: f.regular, color: C.ink, lineHeight: FB_LEAD });
      y -= FB_LEAD;
    }
    y -= PAD - 4;
    closeFrame(y);
    y -= 14;
  }

  if (!rows.length) page.drawText('No numbered groups yet.', { x: M, y: y - 12, size: 11, font: f.regular, color: C.muted });

  /* --------------------------------------------------------------- footers */
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawRectangle({ x: M, y: 30, width: CW, height: 0.7, color: C.line });
    p.drawText('The British University in Egypt · Faculty of Informatics & Computer Science', { x: M, y: 17, size: 7.5, font: f.regular, color: C.muted });
    const n = `Page ${i + 1} of ${pages.length}`;
    p.drawText(n, { x: W - M - f.semi.widthOfTextAtSize(n, 7.5), y: 17, size: 7.5, font: f.semi, color: C.navy });
  });

  return doc.save();
}
