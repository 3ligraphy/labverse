/**
 * MARKING DOCUMENT — everything Admin → Marking saves, as one JSON document in the project-files store
 * (key `marking:phase1`): the item whose group numbers are used, the marking load (TA name → linked account
 * email → group numbers), each group's marks and comment, and whether students may see them.
 * Rules: admins edit every group and the load; a TA edits only the groups of the load row linked to their email.
 * Pure functions, unit-tested (tests/marking.test.ts).
 */
import { MAX_COMMENT, cleanScores, type CriterionId, type Scores } from './rubric.ts';
import { cleanAnswers, type Answers } from './assistant.ts';

export const MARKING_KEY = 'marking:phase1';

export type TA = { name: string; email: string | null; groups: number[] };
/** `help`: the grading assistant's answers behind the marks (how they were reached), when the TA used it. */
export type GroupMarks = { scores: Scores; comment: string; by: string; at: string; members: string[]; help?: Partial<Record<CriterionId, Answers>> };
export type MarkingDoc = {
  v: 1;
  /** the submission item (usually the proposal) whose group numbers are used */
  source: string | null;
  tas: TA[];
  marks: Record<string, GroupMarks>;
  published: boolean;
  publishedAt: string;
  publishedBy: string;
  /** an admin may unlock renumbering on the Groups page while marks exist (off by default) */
  unlocked: boolean;
};
export type Marker = { role: 'admin' | 'ta' | 'none'; email: string | null; name?: string };
export type ImportRow = { group: number; ta?: string; scores: Record<string, unknown>; comment?: string };

export const emptyDoc = (): MarkingDoc => ({ v: 1, source: null, tas: [], marks: {}, published: false, publishedAt: '', publishedBy: '', unlocked: false });

/** A group number from a cell or a form: 12, "12", "G12" or "Group 12". */
export const groupNumber = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim().replace(/^(?:group|grp|g)\s*#?\s*(?=\d)/i, ''));
  return Number.isInteger(n) && n > 0 && n < 1000 ? n : null;
};
const cleanEmail = (v: unknown) => (typeof v === 'string' && /^[^\s@]+@[^\s@]+$/.test(v.trim()) ? v.trim().toLowerCase().slice(0, 200) : null);
const cleanText = (v: unknown, max: number) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/[^\S\n]+$/gm, '').trim().slice(0, max);
const cleanName = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
const uniqueSorted = (ns: number[]) => [...new Set(ns)].sort((a, b) => a - b);

/** A stored or posted document, with anything malformed dropped. */
export function cleanDoc(input: unknown): MarkingDoc {
  const doc = emptyDoc();
  if (!input || typeof input !== 'object' || Array.isArray(input)) return doc;
  const i = input as Record<string, unknown>;
  doc.source = typeof i.source === 'string' && i.source.length <= 80 ? i.source : null;
  if (Array.isArray(i.tas)) {
    for (const t of i.tas.slice(0, 30)) {
      const name = cleanName((t as TA)?.name);
      if (!name) continue;
      const groups = Array.isArray((t as TA).groups) ? uniqueSorted((t as TA).groups.map(groupNumber).filter((n): n is number => n !== null)) : [];
      doc.tas.push({ name, email: cleanEmail((t as TA).email), groups });
    }
  }
  if (i.marks && typeof i.marks === 'object') {
    for (const [k, m] of Object.entries(i.marks as Record<string, GroupMarks>).slice(0, 500)) {
      const n = groupNumber(k);
      if (n === null || !m || typeof m !== 'object') continue;
      doc.marks[String(n)] = {
        scores: cleanScores(m.scores),
        comment: cleanText(m.comment, MAX_COMMENT),
        by: cleanName(m.by),
        at: String(m.at ?? '').slice(0, 40),
        members: Array.isArray(m.members) ? m.members.map((x) => String(x).slice(0, 32)).slice(0, 12) : [],
      };
      const help = cleanAnswers(m.help);
      if (Object.keys(help).length) doc.marks[String(n)].help = help;
    }
  }
  doc.published = i.published === true;
  doc.publishedAt = String(i.publishedAt ?? '').slice(0, 40);
  doc.publishedBy = cleanName(i.publishedBy);
  doc.unlocked = i.unlocked === true;
  return doc;
}

/** The load row linked to this account, if any. */
export const myRow = (doc: MarkingDoc, email: string | null): TA | null => (email ? doc.tas.find((t) => t.email === email.trim().toLowerCase()) ?? null : null);

export function canEdit(m: Marker, doc: MarkingDoc, group: number): boolean {
  if (m.role === 'admin') return true;
  if (m.role !== 'ta') return false;
  return myRow(doc, m.email)?.groups.includes(group) ?? false;
}

/** Saves one group's marks (scores clamped, comment trimmed) with the members it was marked for. */
export function applyMarks(doc: MarkingDoc, m: Marker, group: number, input: { scores: unknown; comment?: unknown; help?: unknown }, members: string[], now = new Date()): { ok: true } | { ok: false; error: string } {
  if (!canEdit(m, doc, group)) return { ok: false, error: `Group ${group} is not one of your groups in the marking load.` };
  const scores = cleanScores(input.scores);
  // the assistant's answers are kept only for criteria that still have a mark
  const help = Object.fromEntries(Object.entries(cleanAnswers(input.help)).filter(([id]) => id in scores));
  doc.marks[String(group)] = {
    scores,
    comment: cleanText(input.comment, MAX_COMMENT),
    by: cleanName(m.name) || (m.email ?? ''),
    at: now.toISOString(),
    members: [...members],
    ...(Object.keys(help).length ? { help } : {}),
  };
  return { ok: true };
}

/**
 * Imports the rows read from a marking file: only groups the uploader may edit, only rows with marks or a comment.
 * A file fills, it never clears: an empty cell keeps the saved mark, an empty comment keeps the saved comment.
 */
export function applyImport(doc: MarkingDoc, m: Marker, rows: readonly ImportRow[], membersOf: (group: number) => string[], now = new Date()) {
  const imported: number[] = [];
  const skipped: { group: number; reason: string }[] = [];
  for (const row of rows) {
    const n = groupNumber(row.group);
    if (n === null) continue;
    if (!canEdit(m, doc, n)) {
      skipped.push({ group: n, reason: `Group ${n} is not one of your groups in the marking load.` });
      continue;
    }
    const scores = cleanScores(row.scores);
    if (!Object.keys(scores).length && !cleanText(row.comment, MAX_COMMENT)) {
      skipped.push({ group: n, reason: 'There are no marks in this row yet.' });
      continue;
    }
    const old = doc.marks[String(n)];
    const help = Object.fromEntries(Object.entries(old?.help ?? {}).filter(([id]) => !(id in scores)));
    applyMarks(doc, m, n, { scores: { ...old?.scores, ...scores }, comment: cleanText(row.comment, MAX_COMMENT) || old?.comment || '', help }, membersOf(n), now);
    imported.push(n);
  }
  return { imported: uniqueSorted(imported), skipped };
}

/** The marking load from a workbook's "Assigned TA" column. Accounts already linked to a TA name are kept. */
export function loadFromRows(doc: MarkingDoc, rows: readonly { group: number; ta?: string }[]) {
  const byName = new Map<string, TA>();
  for (const r of rows) {
    const name = cleanName(r.ta);
    const n = groupNumber(r.group);
    if (!name || n === null) continue;
    const key = name.toLowerCase();
    const ta = byName.get(key) ?? { name, email: doc.tas.find((t) => t.name.toLowerCase() === key)?.email ?? null, groups: [] };
    ta.groups = uniqueSorted([...ta.groups, n]);
    byName.set(key, ta);
  }
  doc.tas = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Marked groups whose members are not the ones they were marked for. */
export function memberChanges(doc: MarkingDoc, groups: readonly { number: number; members: readonly string[] }[]) {
  const out: { group: number; added: string[]; removed: string[] }[] = [];
  for (const g of groups) {
    const m = doc.marks[String(g.number)];
    if (!m || !m.members.length) continue;
    const now = new Set(g.members);
    const then = new Set(m.members);
    const added = [...now].filter((x) => !then.has(x)).sort();
    const removed = [...then].filter((x) => !now.has(x)).sort();
    if (added.length || removed.length) out.push({ group: g.number, added, removed });
  }
  return out;
}

/** True when any hand-in would move to another group (number) — new or removed hand-ins do not count. */
export function renumbered(before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>): boolean {
  for (const [entry, key] of before) if (after.has(entry) && after.get(entry) !== key) return true;
  return false;
}
