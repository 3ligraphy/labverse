/**
 * PHASE 1 RUBRIC — the marking sheet (Phase1_Marking.xlsx) as data: 9 criteria in 4 sections, 30 marks.
 * Total /100 = total / 30 × 100. Grade bands: A ≥ 70, B ≥ 60, C ≥ 50, D ≥ 40, F below; no grade before any mark.
 * Pure functions, unit-tested (tests/marking.test.ts). `col` is the criterion's column in the TA sheets.
 */

export const SECTIONS = [
  { id: 'uc', title: 'Use Case Diagram', max: 7.5, col: 'F' },
  { id: 'ad', title: 'Activity Diagram', max: 7.5, col: 'I' },
  { id: 'ui', title: 'UI Design & Implementation', max: 9, col: 'J' },
  { id: 'ar', title: 'Architecture / Design Pattern', max: 6, col: 'N' },
] as const;
export type SectionId = (typeof SECTIONS)[number]['id'];

export const CRITERIA = [
  { id: 'uc_actors', section: 'uc', label: 'Actors', max: 1, col: 'C' },
  { id: 'uc_logic', section: 'uc', label: 'Correct logic', max: 1.5, col: 'D' },
  { id: 'uc_mapping', section: 'uc', label: 'Mapping to functional reqs', max: 5, col: 'E' },
  { id: 'ad_reqs', section: 'ad', label: 'Functional reqs included', max: 5, col: 'G' },
  { id: 'ad_flow', section: 'ad', label: 'Correct & logical flow', max: 2.5, col: 'H' },
  { id: 'ui_screens', section: 'ui', label: 'Screens (1 each, 9 screens)', max: 9, col: 'J' },
  { id: 'ar_pattern', section: 'ar', label: 'Pattern selected', max: 2, col: 'K' },
  { id: 'ar_impl', section: 'ar', label: 'Correct implementation in structure', max: 2, col: 'L' },
  { id: 'ar_reason', section: 'ar', label: 'Reasoning', max: 2, col: 'M' },
] as const satisfies readonly { id: string; section: SectionId; label: string; max: number; col: string }[];
export type CriterionId = (typeof CRITERIA)[number]['id'];
export type Scores = Partial<Record<CriterionId, number>>;

export const TOTAL_MAX = 30;
export const MAX_COMMENT = 4000;
export const isCriterion = (id: string): id is CriterionId => CRITERIA.some((c) => c.id === id);

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A mark from a form or a sheet: 0…max with at most 2 decimals; blank or text is "no mark" (null). */
export function cleanScore(v: unknown, max: number): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
  if (String(v).trim() === '' || !Number.isFinite(n)) return null;
  return round2(Math.min(max, Math.max(0, n)));
}

/** Only known criteria, each clamped to its maximum. */
export function cleanScores(input: unknown): Scores {
  const out: Scores = {};
  if (!input || typeof input !== 'object') return out;
  for (const c of CRITERIA) {
    const v = cleanScore((input as Record<string, unknown>)[c.id], c.max);
    if (v !== null) out[c.id] = v;
  }
  return out;
}

export function gradeOf(percent: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  return percent >= 70 ? 'A' : percent >= 60 ? 'B' : percent >= 50 ? 'C' : percent >= 40 ? 'D' : 'F';
}

export type Totals = { sections: Record<SectionId, number>; total: number; percent: number; grade: '' | 'A' | 'B' | 'C' | 'D' | 'F'; missing: CriterionId[] };

/** Subtotals, the total /30, the total /100 and the grade, the way the final sheet computes them. */
export function totals(scores: Scores): Totals {
  const sections = Object.fromEntries(SECTIONS.map((s) => [s.id, 0])) as Record<SectionId, number>;
  const missing: CriterionId[] = [];
  for (const c of CRITERIA) {
    const v = scores[c.id];
    if (typeof v === 'number') sections[c.section] = round2(sections[c.section] + v);
    else missing.push(c.id);
  }
  const total = round2(Object.values(sections).reduce((a, b) => a + b, 0));
  const percent = round2((total / TOTAL_MAX) * 100);
  return { sections, total, percent, grade: missing.length === CRITERIA.length ? '' : gradeOf(percent), missing };
}
