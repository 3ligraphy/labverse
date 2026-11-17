/**
 * Reads a marking workbook (.xlsx) in the browser: the sheets, their cells (shared strings, inline strings,
 * numbers, and formulas through their cached values), then the marking rows of Phase1_Marking.xlsx.
 * Each TA sheet (and the final "Phase 1 Marks" sheet) has a header with "Group" in A1, the criteria's labels in
 * row 2, and one row per group. Rows from TA sheets win; the final sheet only fills groups no TA sheet has.
 * No DOM needed (plain text parsing), so it runs in Node tests too (tests/marking.test.ts).
 */
import { strFromU8, unzipSync } from 'fflate';
import { CRITERIA, cleanScore, type CriterionId } from './rubric.ts';
import { groupNumber } from './doc.ts';

export type Cell = string | number | null;
export type SheetData = { name: string; cells: Map<string, Cell> };
export type ParsedRow = { group: number; ta: string; scores: Partial<Record<CriterionId, number>>; comment: string; sheet: string };

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

export function readWorkbook(bytes: Uint8Array): SheetData[] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error('This is not an Excel workbook (.xlsx). Save the sheet as .xlsx and try again.');
  }
  const text = (name: string) => (files[name] ? strFromU8(files[name]) : '');
  const workbook = text('xl/workbook.xml');
  if (!workbook) throw new Error('This is not an Excel workbook (.xlsx): it has no xl/workbook.xml.');
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

const colOf = (ref: string) => /^[A-Z]+/.exec(ref)?.[0] ?? '';
const rowOf = (ref: string) => Number(/\d+$/.exec(ref)?.[0] ?? 0);
const norm = (v: Cell | undefined) => String(v ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const isFinal = (name: string) => /phase\s*1\s*marks|final|summary/i.test(name);

/** The marking rows of every sheet that has the marking header. */
export function parseMarkingWorkbook(bytes: Uint8Array): { rows: ParsedRow[]; sheets: string[]; warnings: string[] } {
  const warnings: string[] = [];
  const found: { sheet: string; final: boolean; rows: ParsedRow[] }[] = [];
  for (const s of readWorkbook(bytes)) {
    // the header: "Group" in column A of one of the first 5 rows
    let headerRow = 0;
    for (let r = 1; r <= 5 && !headerRow; r++) if (norm(s.cells.get(`A${r}`)) === 'group') headerRow = r;
    if (!headerRow) continue;
    // columns by their labels in the next rows, or the sheet's usual columns
    const labelCol = new Map<string, string>();
    for (const [ref, v] of s.cells) if (rowOf(ref) >= headerRow && rowOf(ref) <= headerRow + 2 && typeof v === 'string') labelCol.set(norm(v), colOf(ref));
    const colFor = (label: string, fallback: string) => {
      const l = label.toLowerCase();
      for (const [text, col] of labelCol) if (text === l || text.startsWith(l)) return col;
      return fallback;
    };
    const cols = CRITERIA.map((c) => ({ id: c.id, max: c.max, col: colFor(c.label, c.col) }));
    const taCol = colFor('assigned ta', 'B');
    const commentCol = colFor('comments', 'R');
    const rows: ParsedRow[] = [];
    const last = Math.max(0, ...[...s.cells.keys()].map(rowOf));
    for (let r = headerRow + 1; r <= last; r++) {
      const group = groupNumber(s.cells.get(`A${r}`));
      if (group === null) continue;
      const scores: Partial<Record<CriterionId, number>> = {};
      for (const c of cols) {
        const v = cleanScore(s.cells.get(`${c.col}${r}`), c.max);
        if (v !== null) scores[c.id] = v;
      }
      const comment = String(s.cells.get(`${commentCol}${r}`) ?? '').trim();
      rows.push({ group, ta: String(s.cells.get(`${taCol}${r}`) ?? '').trim(), scores, comment, sheet: s.name });
    }
    if (rows.length) found.push({ sheet: s.name, final: isFinal(s.name), rows });
  }
  if (!found.length) {
    warnings.push('No sheet looks like the marking sheet: it needs "Group" in column A and the criteria (Actors, Correct logic, …) in the rows under it.');
    return { rows: [], sheets: [], warnings };
  }
  // TA sheets first; the final sheet only for groups that no TA sheet has
  const byGroup = new Map<number, ParsedRow>();
  for (const f of found.filter((x) => !x.final)) for (const r of f.rows) if (!byGroup.has(r.group)) byGroup.set(r.group, r);
  for (const f of found.filter((x) => x.final)) for (const r of f.rows) if (!byGroup.has(r.group)) byGroup.set(r.group, r);
  return { rows: [...byGroup.values()].sort((a, b) => a.group - b.group), sheets: found.map((f) => f.sheet), warnings };
}
