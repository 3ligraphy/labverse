/**
 * The merged marking workbook (values, the Phase1_Marking.xlsx layout): "Phase 1 Marks" with every group, one
 * sheet per TA with their groups, and "TA Summary". It reads back with parseMarkingWorkbook (tests/marking.test.ts).
 */
import type { XCell, XSheet } from '../xlsx.ts';
import { CRITERIA, totals } from './rubric.ts';
import type { MarkingDoc } from './doc.ts';

const HEADER: XCell[][] = [
  ['Group', 'Assigned TA', 'Use Case Diagram', null, null, null, 'Activity Diagram', null, null, 'UI Design & Implementation', 'Architecture / Design Pattern', null, null, null, 'Total (/30)', 'Total (/100)', 'Grade', 'Comments'],
  [null, null, 'Actors', 'Correct logic', 'Mapping to functional reqs', 'Subtotal', 'Functional reqs included', 'Correct & logical flow', 'Subtotal', 'Screens (1 each, 9 screens)', 'Pattern selected', 'Correct implementation in structure', 'Reasoning', 'Subtotal', null, null, null, null],
  [null, null, 1, 1.5, 5, 7.5, 5, 2.5, 7.5, 9, 2, 2, 2, 6, null, null, null, null],
].map((r) => r.map((v) => (v === null ? null : { v, s: 'header' as const })));
const WIDTHS = [8, 14, 9, 9, 12, 9, 12, 12, 9, 14, 11, 14, 10, 9, 10, 11, 7, 80];

const taOf = (doc: MarkingDoc, group: number) => doc.tas.find((t) => t.groups.includes(group))?.name ?? '';

function groupRow(doc: MarkingDoc, group: number): XCell[] {
  const m = doc.marks[String(group)];
  const s = m?.scores ?? {};
  const t = totals(s);
  const v = (id: (typeof CRITERIA)[number]['id']) => s[id] ?? null;
  const marked = !!m && t.grade !== '';
  return [
    group, taOf(doc, group),
    v('uc_actors'), v('uc_logic'), v('uc_mapping'), marked ? t.sections.uc : null,
    v('ad_reqs'), v('ad_flow'), marked ? t.sections.ad : null,
    v('ui_screens'),
    v('ar_pattern'), v('ar_impl'), v('ar_reason'), marked ? t.sections.ar : null,
    marked ? t.total : null, marked ? t.percent : null, marked ? t.grade : null,
    m?.comment ?? null,
  ];
}

/** Every group of the item (numbers), in order; marks and TA from the document. */
export function markingSheets(doc: MarkingDoc, groups: readonly number[]): XSheet[] {
  const all = [...new Set([...groups, ...Object.keys(doc.marks).map(Number)])].sort((a, b) => a - b);
  const sheets: XSheet[] = [{ name: 'Phase 1 Marks', rows: [...HEADER, ...all.map((g) => groupRow(doc, g))], widths: WIDTHS, freezeRows: 3, freezeCols: 2 }];
  for (const ta of doc.tas) sheets.push({ name: ta.name.slice(0, 31), rows: [...HEADER, ...ta.groups.map((g) => groupRow(doc, g))], widths: WIDTHS, freezeRows: 3, freezeCols: 2 });
  const summary: XCell[][] = [[{ v: 'TA', s: 'header' }, { v: 'Groups', s: 'header' }, { v: 'Avg % (marked)', s: 'header' }, { v: 'Marked', s: 'header' }]];
  for (const ta of doc.tas) {
    const marked = ta.groups.map((g) => doc.marks[String(g)]).filter((m) => m && totals(m.scores).missing.length === 0);
    const avg = marked.length ? Math.round((marked.reduce((a, m) => a + totals(m!.scores).percent, 0) / marked.length) * 100) / 100 : null;
    summary.push([ta.name, ta.groups.length, avg, marked.length]);
  }
  sheets.push({ name: 'TA Summary', rows: summary, widths: [16, 10, 16, 10], freezeRows: 1 });
  return sheets;
}
