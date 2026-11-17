/**
 * The Phase 1 marking load the course team agreed (TA → project group numbers, as in the proposal report), used
 * until an admin saves another load. Staff accounts are linked to a TA row by first name when exactly one staff
 * account has that first name; an admin can change any link on the Marking load tab.
 * Pure functions, unit-tested (tests/marking-more.test.ts).
 */
import type { MarkingDoc, TA } from './doc.ts';

export const DEFAULT_TAS: readonly { name: string; groups: number[] }[] = [
  { name: 'Amr', groups: [3, 5, 9, 12, 18, 20, 21, 30, 33, 39, 41] },
  { name: 'Ramy', groups: [4, 13, 19, 23, 29, 32, 36, 37, 43, 45, 46] },
  { name: 'Ali', groups: [1, 6, 8, 11, 14, 22, 26, 27, 34, 35, 42, 44] },
  { name: 'Youssef', groups: [2, 7, 10, 15, 16, 17, 24, 25, 28, 31, 38, 40] },
];

/** The saved load, or the team's default load when none was saved yet. */
export function withDefaultLoad(doc: MarkingDoc): MarkingDoc {
  if (doc.tas.length) return doc;
  return { ...doc, tas: DEFAULT_TAS.map((t) => ({ name: t.name, email: null, groups: [...t.groups] })) };
}

/** The first name, without a title such as Dr. or Eng. */
const firstName = (s: string) => s.trim().replace(/^(?:dr|eng|prof|mr|mrs|ms)\.?\s+/i, '').split(/\s+/)[0]?.toLowerCase() ?? '';

/** Rows without an account get the one staff account whose first name is the row's name (never a guess between two). */
export function autoLink(tas: readonly TA[], staff: readonly { name: string; email: string }[]): TA[] {
  return tas.map((t) => {
    if (t.email) return { ...t };
    const matches = staff.filter((s) => firstName(s.name) === firstName(t.name));
    return { ...t, email: matches.length === 1 ? matches[0].email.toLowerCase() : null };
  });
}
