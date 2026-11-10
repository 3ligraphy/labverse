/**
 * What a student types to identify themselves — one set of rules for the lab start card, the attendance page,
 * progress tracking, manual attendance and sign-up, in the browser and on the server.
 *   name      letters (any language), spaces, apostrophes, dots and hyphens; no digits
 *   studentId 5–9 digits (e.g. 241995); spaces are ignored
 *   group     a short code with a number: "12", "g12", "Group 12" → "G12"; "A3" stays "A3"
 */
export const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}'’. -]*[\p{L}\p{M}.]$/u;
export const STUDENT_ID_RE = /^\d{5,9}$/;
export const GROUP_RE = /^(?=[A-Z]{0,3}\d)[A-Z]{0,3}\d{1,3}$/;

export const NAME_HINT = 'Type your full name using letters only — no numbers.';
export const ID_HINT = 'Your student ID is 5–9 digits, numbers only (e.g. 241995).';
export const GROUP_HINT = 'Your group is a number or a short code with a number, e.g. G12.';

export const cleanName = (v: unknown) => String(v ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
export const cleanStudentId = (v: unknown) => String(v ?? '').replace(/\s+/g, '').trim();
export function cleanGroup(v: unknown): string {
  const s = String(v ?? '').normalize('NFKC').toUpperCase().replace(/\s+/g, '').replace(/^GROUP/, 'G');
  return /^\d{1,3}$/.test(s) ? `G${s}` : s;
}

/** null when fine, otherwise a sentence saying what to change */
export function nameError(name: string): string | null {
  if (/\d/.test(name)) return 'A name can’t contain numbers. Type your full name; your ID goes in the Student ID box.';
  if (name.length < 2 || name.length > 60 || !NAME_RE.test(name)) return NAME_HINT;
  return null;
}
export function studentIdError(id: string): string | null {
  if (!id) return 'Type your student ID.';
  if (/[\p{L}]/u.test(id)) return 'A student ID has only numbers — did you type your name here? ' + ID_HINT;
  if (!STUDENT_ID_RE.test(id)) return ID_HINT;
  return null;
}
/**
 * The lab start card's group: optional and free. A code with a number is tidied ("12" → "G12"); anything else
 * is kept as typed (trimmed, at most 20 characters). '' when left empty.
 */
export function looseGroup(v: unknown): string {
  const raw = String(v ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (!raw || raw === '—') return '';
  const tidy = cleanGroup(raw);
  return GROUP_RE.test(tidy) ? tidy : raw.slice(0, 20);
}
export function groupError(group: string): string | null {
  if (!group) return 'Type your group, e.g. G12.';
  if (!GROUP_RE.test(group)) return GROUP_HINT;
  return null;
}
