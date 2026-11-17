/**
 * Reads a marking file in the browser: an Excel workbook (.xlsx: shared strings, inline strings, numbers, and
 * formulas through their cached values) or a CSV file (Excel's "Save as CSV" with commas or semicolons, CSV UTF-8,
 * Unicode text, or a simple sheet with one header row), then its marking rows.
 * A marking sheet has "Group" in column A of one of its first 5 rows and the criteria's names (Actors, Correct
 * logic, …, or ids such as ad_reqs) in its header rows; one row per group under it. In Phase1_Marking.xlsx the
 * rows of the TA sheets win; the final "Phase 1 Marks" sheet only fills groups no TA sheet has.
 * No DOM needed (plain text parsing), so it runs in Node tests too (tests/marking*.test.ts).
 */
import { strFromU8, unzipSync } from 'fflate';
import { CRITERIA, cleanScore, type CriterionId } from './rubric.ts';
import { groupNumber } from './doc.ts';

export type Cell = string | number | null;
export type SheetData = { name: string; cells: Map<string, Cell> };
export type ParsedRow = { group: number; ta: string; scores: Partial<Record<CriterionId, number>>; comment: string; sheet: string };
export type ParsedFile = { rows: ParsedRow[]; sheets: string[]; warnings: string[] };

const decode = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
/** All the <t> texts inside one shared string or inline string (rich text has several runs). */
const texts = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join('').replace(/\r\n?/g, '\n');
const attr = (attrs: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1] ?? null;

const isZip = (b: Uint8Array) => b[0] === 0x50 && b[1] === 0x4b;
const isOldExcel = (b: Uint8Array) => b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0;
const OLD_EXCEL = 'This is an old Excel file (.xls). In Excel choose File → Save As → Excel Workbook (.xlsx) or CSV, then upload that file.';

export function readWorkbook(bytes: Uint8Array): SheetData[] {
  if (isOldExcel(bytes)) throw new Error(OLD_EXCEL);
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error('This is not an Excel workbook (.xlsx). Save the sheet as .xlsx or .csv and try again.');
  }
  const text = (name: string) => (files[name] ? strFromU8(files[name]) : '');
  const workbook = text('xl/workbook.xml');
  if (!workbook) throw new Error('This is not an Excel workbook (.xlsx). Save the sheet as .xlsx or .csv and try again.');
  const rels = new Map([...text('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b([^>]*)\/?>/g)].map((m) => [attr(m[1], 'Id'), attr(m[1], 'Target')]));
  const shared = [...text('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]));
  const sheets: SheetData[] = [];
  for (const m of workbook.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = decode(attr(m[1], 'name') ?? '');
    const target = rels.get(attr(m[1], 'r:id'));
    if (!target) continue;
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
    const xml = text(path);
    const cells = new Map<string, Cell>();
    for (const c of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attr(c[1], 'r');
      if (!ref) continue;
      const type = attr(c[1], 't');
      const inner = c[2] ?? '';
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      let value: Cell = null;
      if (type === 's') value = v !== undefined ? shared[Number(v)] ?? null : null;
      else if (type === 'inlineStr') value = texts(inner);
      else if (type === 'str' || type === 'e') value = v !== undefined ? decode(v) : null;
      else if (type === 'b') value = v === '1' ? 1 : 0;
      else if (v !== undefined && v !== '') value = Number(v);
      if (value !== null && value !== '') cells.set(ref, value);
    }
    sheets.push({ name, cells });
  }
  return sheets;
}

/* ------------------------------------------------------------------ CSV */

/** A1-style column letters: 0 → A, 26 → AA. */
const colName = (i: number) => {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

/** The separator of the first line that has one, outside quotes: comma, semicolon (Excel with decimal commas) or tab. */
function guessDelimiter(s: string): string {
  let quoted = false;
  let counts = { ',': 0, ';': 0, '\t': 0 } as Record<string, number>;
  for (const ch of s.slice(0, 20000)) {
    if (ch === '"') quoted = !quoted;
    else if (quoted) continue;
    else if (ch in counts) counts[ch]++;
    else if (ch === '\n') {
      const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (best[1] > 0) return best[0];
      counts = { ',': 0, ';': 0, '\t': 0 };
    }
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ',';
}

/** One CSV text as a sheet: quoted fields (with "" for a quote and line breaks inside), BOM and "sep=;" line handled. */
export function readCsv(text: string, name = 'CSV'): SheetData {
  let s = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  let delim = '';
  const hint = /^sep=(.)\n/i.exec(s);
  if (hint) {
    delim = hint[1];
    s = s.slice(hint[0].length);
  }
  if (!delim) delim = guessDelimiter(s);
  const cells = new Map<string, Cell>();
  let row = 1;
  let col = 0;
  let field = '';
  let quoted = false;
  let started = false;
  const put = () => {
    // a leading apostrophe protects text that Excel would read as a formula (added by sheetToCsv)
    const v = /^'[=+\-@]/.test(field) ? field.slice(1) : field;
    if (v.trim() !== '') cells.set(`${colName(col)}${row}`, v);
    field = '';
    started = false;
  };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch !== '"') field += ch;
      else if (s[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = false;
    } else if (ch === '"' && !started) {
      quoted = true;
      started = true;
    } else if (ch === delim) {
      put();
      col++;
    } else if (ch === '\n') {
      put();
      row++;
      col = 0;
    } else {
      field += ch;
      started = true;
    }
  }
  if (field !== '' || col > 0) put();
  return { name, cells };
}

/** Text from a CSV file's bytes: UTF-8 (with or without BOM), UTF-16 ("Unicode text"), else Windows-1252. */
function decodeText(b: Uint8Array): string {
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b);
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(b);
  } catch {
    return new TextDecoder('windows-1252').decode(b);
  }
}

/* ------------------------------------------------------------------ marking rows */

const colOf = (ref: string) => /^[A-Z]+/.exec(ref)?.[0] ?? '';
const rowOf = (ref: string) => Number(/\d+$/.exec(ref)?.[0] ?? 0);
const norm = (v: Cell | undefined) => String(v ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const simple = (t: string) => t.replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
const isFinal = (name: string) => /phase\s*1\s*marks|final|summary/i.test(name);
const MAX_WARNINGS = 25;
type Criterion = (typeof CRITERIA)[number];

/** Header cells: "Group" row and the rows under it until the first group row (at most 3 rows), text only. */
function headerCells(s: SheetData, headerRow: number) {
  const out: { text: string; col: string }[] = [];
  for (let r = headerRow; r < headerRow + 3; r++) {
    if (r > headerRow && groupNumber(s.cells.get(`A${r}`)) !== null) break;
    for (const [ref, v] of s.cells) if (rowOf(ref) === r && typeof v === 'string' && norm(v)) out.push({ text: norm(v), col: colOf(ref) });
  }
  return out;
}

/**
 * Each criterion's column, by its name or id: an exact match first, then a header that starts with the name
 * ("Actors (1)"), then a short header that only one criterion's name starts with ("Screens").
 */
function criterionColumns(header: { text: string; col: string }[]) {
  const passes: ((t: string, c: Criterion) => boolean)[] = [
    (t, c) => t === c.label.toLowerCase() || simple(t) === simple(c.id),
    (t, c) => t.startsWith(c.label.toLowerCase()),
    (t, c) => t.length >= 4 && c.label.toLowerCase().startsWith(t) && CRITERIA.filter((o) => o.label.toLowerCase().startsWith(t)).length === 1,
  ];
  const found = new Map<CriterionId, string>();
  const used = new Set<string>();
  for (const pass of passes)
    for (const c of CRITERIA) {
      if (found.has(c.id)) continue;
      const hit = header.find((h) => !used.has(h.col) && pass(h.text, c));
      if (hit) {
        found.set(c.id, hit.col);
        used.add(hit.col);
      }
    }
  return found;
}

/** The marking rows of every sheet that has the marking header, with warnings for values that were changed. */
export function parseSheets(input: readonly SheetData[]): ParsedFile {
  const warnings: string[] = [];
  const found: { sheet: string; final: boolean; rows: ParsedRow[] }[] = [];
  const notes = new Map<ParsedRow, string[]>();
  for (const s of input) {
    let headerRow = 0;
    for (let r = 1; r <= 5 && !headerRow; r++) if (norm(s.cells.get(`A${r}`)) === 'group') headerRow = r;
    if (!headerRow) continue;
    const header = headerCells(s, headerRow);
    const byName = criterionColumns(header);
    // the Phase1_Marking.xlsx layout: its usual columns are used for a criterion whose name was changed
    const standard = norm(s.cells.get(`B${headerRow}`)) === 'assigned ta' || (byName.size > 0 && [...byName].every(([id, col]) => CRITERIA.find((c) => c.id === id)!.col === col));
    const cols = CRITERIA.map((c) => ({ c, col: byName.get(c.id) ?? (standard ? c.col : null) })).filter((x): x is { c: Criterion; col: string } => x.col !== null);
    if (!cols.length) {
      warnings.push(`Sheet “${s.name}”: no criteria columns were found (Actors, Correct logic, Mapping to functional reqs, …).`);
      continue;
    }
    const colWhere = (test: (t: string) => boolean, fallback: string | null) => header.find((h) => test(h.text))?.col ?? (standard ? fallback : null);
    const taCol = colWhere((t) => ['assigned ta', 'ta', 'marker', 'marked by', 'ta name'].includes(t), 'B');
    const commentCol = colWhere((t) => t.startsWith('comment') || ['feedback', 'notes', 'remarks'].includes(t), 'R');
    const rows: ParsedRow[] = [];
    const seen = new Set<number>();
    const last = Math.max(0, ...[...s.cells.keys()].map(rowOf));
    for (let r = headerRow + 1; r <= last; r++) {
      const group = groupNumber(s.cells.get(`A${r}`));
      if (group === null) continue;
      if (seen.has(group)) {
        warnings.push(`Sheet “${s.name}”: group ${group} has two rows; the first one is used.`);
        continue;
      }
      seen.add(group);
      const scores: Partial<Record<CriterionId, number>> = {};
      const issues: string[] = [];
      for (const { c, col } of cols) {
        const raw = s.cells.get(`${col}${r}`);
        if (raw === undefined || raw === null || String(raw).trim() === '') continue;
        const v = cleanScore(raw, c.max);
        const n = typeof raw === 'number' ? raw : Number(String(raw).trim().replace(',', '.'));
        if (v === null) issues.push(`group ${group}, ${c.label}: “${String(raw).trim()}” is not a number, so it was left empty.`);
        else {
          scores[c.id] = v;
          if (Math.abs(n - v) >= 0.005) issues.push(`group ${group}, ${c.label}: ${n} is ${n > c.max ? `more than ${c.max}` : 'below 0'}, read as ${v}.`);
        }
      }
      const comment = commentCol ? String(s.cells.get(`${commentCol}${r}`) ?? '').trim() : '';
      const row: ParsedRow = { group, ta: taCol ? String(s.cells.get(`${taCol}${r}`) ?? '').trim() : '', scores, comment, sheet: s.name };
      if (issues.length) notes.set(row, issues);
      rows.push(row);
    }
    if (rows.length) found.push({ sheet: s.name, final: isFinal(s.name), rows });
  }
  if (!found.length) {
    if (!warnings.length) warnings.push('No sheet looks like a marking sheet: it needs “Group” in column A and the criteria (Actors, Correct logic, …) in the header.');
    return { rows: [], sheets: [], warnings };
  }
  // TA sheets first; the final sheet only for groups that no TA sheet has
  const byGroup = new Map<number, ParsedRow>();
  for (const f of found.filter((x) => !x.final)) for (const r of f.rows) if (!byGroup.has(r.group)) byGroup.set(r.group, r);
  for (const f of found.filter((x) => x.final)) for (const r of f.rows) if (!byGroup.has(r.group)) byGroup.set(r.group, r);
  const rows = [...byGroup.values()].sort((a, b) => a.group - b.group);
  for (const r of rows) for (const n of notes.get(r) ?? []) warnings.push(found.length > 1 ? `Sheet “${r.sheet}”, ${n}` : n.charAt(0).toUpperCase() + n.slice(1));
  const extra = warnings.length - MAX_WARNINGS;
  return { rows, sheets: found.map((f) => f.sheet), warnings: extra > 0 ? [...warnings.slice(0, MAX_WARNINGS), `…and ${extra} more.`] : warnings };
}

/** The marking rows of a workbook (Phase1_Marking.xlsx or one TA's sheet). */
export const parseMarkingWorkbook = (bytes: Uint8Array): ParsedFile => parseSheets(readWorkbook(bytes));

/** The marking rows of an uploaded file: .xlsx by its content, anything else read as CSV text. */
export function parseMarkingFile(bytes: Uint8Array, name = ''): ParsedFile {
  if (isZip(bytes) || isOldExcel(bytes) || /\.xls[xm]?$/i.test(name)) return parseMarkingWorkbook(bytes);
  return parseSheets([readCsv(decodeText(bytes), name.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '') || 'CSV')]);
}
