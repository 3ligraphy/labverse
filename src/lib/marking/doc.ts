/**
 * MARKING DOCUMENT — everything Admin → Marking saves, as one JSON document in the project-files store
 * (key `marking:phase1`): the item whose group numbers are used, the marking load (TA name → linked account
 * email → group numbers), each group's marks and comment, the groups called in to discuss their project
 * (the AI button: those students see only the call), and whether students may see the marks.
 * Rules: every TA and admin may mark every group (the load only says whose groups they are: "My groups"); only
 * admins change the load, the item and publishing. Everyone who saves a group's marks is kept in its `editors`.
 * Pure functions, unit-tested (tests/marking.test.ts).
 */
import { CRITERIA, MAX_COMMENT, SECTIONS, cleanScores, totals, type CriterionId, type Scores } from './rubric.ts';
import { cleanAnswers, type Answers } from './assistant.ts';

export const MARKING_KEY = 'marking:phase1';

export type TA = { name: string; email: string | null; groups: number[] };
/**
 * `by`: who saved last. `editors`: everyone who saved this group's marks, first to last (they are part of its
 * marking). `help`: the grading assistant's answers behind the marks (how they were reached), when the TA used it.
 */
export type GroupMarks = { scores: Scores; comment: string; by: string; at: string; members: string[]; editors?: string[]; help?: Partial<Record<CriterionId, Answers>> };
/** A group called in to discuss its project with its TA (the AI button: for example, when the work looks AI-made). */
export type Call = { by: string; at: string };
export type MarkingDoc = {
  v: 1;
  /** the submission item (usually the proposal) whose group numbers are used */
  source: string | null;
  tas: TA[];
  marks: Record<string, GroupMarks>;
  /** groups called to discuss their project: their students see only the call, never marks or feedback */
  calls: Record<string, Call>;
  published: boolean;
  publishedAt: string;
  publishedBy: string;
  /** an admin may unlock renumbering on the Groups page while marks exist (off by default) */
  unlocked: boolean;
};
export type Marker = { role: 'admin' | 'ta' | 'none'; email: string | null; name?: string };
export type ImportRow = { group: number; ta?: string; scores: Record<string, unknown>; comment?: string };

export const emptyDoc = (): MarkingDoc => ({ v: 1, source: null, tas: [], marks: {}, calls: {}, published: false, publishedAt: '', publishedBy: '', unlocked: false });

/** A group number from a cell or a form: 12, "12", "G12" or "Group 12". */
export const groupNumber = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim().replace(/^(?:group|grp|g)\s*#?\s*(?=\d)/i, ''));
  return Number.isInteger(n) && n > 0 && n < 1000 ? n : null;
};
const cleanEmail = (v: unknown) => (typeof v === 'string' && /^[^\s@]+@[^\s@]+$/.test(v.trim()) ? v.trim().toLowerCase().slice(0, 200) : null);
const cleanText = (v: unknown, max: number) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/[^\S\n]+$/gm, '').trim().slice(0, max);
const cleanName = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
const uniqueSorted = (ns: number[]) => [...new Set(ns)].sort((a, b) => a - b);
const MAX_EDITORS = 12;
const NO_RIGHTS = 'Only TAs and admins can mark.';
const nameOf = (m: Marker) => cleanName(m.name) || (m.email ?? '');

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
      const editors = Array.isArray(m.editors) ? [...new Set(m.editors.map(cleanName).filter(Boolean))].slice(-MAX_EDITORS) : [];
      if (editors.length) doc.marks[String(n)].editors = editors;
      const help = cleanAnswers(m.help);
      if (Object.keys(help).length) doc.marks[String(n)].help = help;
    }
  }
  if (i.calls && typeof i.calls === 'object' && !Array.isArray(i.calls)) {
    for (const [k, c] of Object.entries(i.calls as Record<string, Call>).slice(0, 500)) {
      const n = groupNumber(k);
      if (n === null || !c || typeof c !== 'object') continue;
      doc.calls[String(n)] = { by: cleanName(c.by), at: String(c.at ?? '').slice(0, 40) };
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

/** Every TA and admin may mark every group; the load row only decides "My groups". */
export function canEdit(m: Marker, _doc: MarkingDoc, _group: number): boolean {
  return m.role === 'admin' || m.role === 'ta';
}

/** Saves one group's marks (scores clamped, comment trimmed) with the members it was marked for; the saver joins its editors. */
export function applyMarks(doc: MarkingDoc, m: Marker, group: number, input: { scores: unknown; comment?: unknown; help?: unknown }, members: string[], now = new Date()): { ok: true } | { ok: false; error: string } {
  if (!canEdit(m, doc, group)) return { ok: false, error: NO_RIGHTS };
  const scores = cleanScores(input.scores);
  // the assistant's answers are kept only for criteria that still have a mark
  const help = Object.fromEntries(Object.entries(cleanAnswers(input.help)).filter(([id]) => id in scores));
  const old = doc.marks[String(group)];
  const who = nameOf(m);
  // marks saved before editors were kept start from the one who saved them
  const editors = [...new Set([...(old?.editors ?? (old?.by ? [old.by] : [])), who].filter(Boolean))].slice(-MAX_EDITORS);
  doc.marks[String(group)] = {
    scores,
    comment: cleanText(input.comment, MAX_COMMENT),
    by: who,
    at: now.toISOString(),
    members: [...members],
    ...(editors.length ? { editors } : {}),
    ...(Object.keys(help).length ? { help } : {}),
  };
  return { ok: true };
}

/** Calls a group to discuss its project with its TA (on), or lifts the call (off). Same rights as marking the group. */
export function setCall(doc: MarkingDoc, m: Marker, group: number, on: boolean, now = new Date()): { ok: true } | { ok: false; error: string } {
  if (!canEdit(m, doc, group)) return { ok: false, error: NO_RIGHTS };
  if (on) doc.calls[String(group)] = { by: nameOf(m), at: now.toISOString() };
  else delete doc.calls[String(group)];
  return { ok: true };
}

export type StudentMarks = {
  sections: { title: string; max: number; score: number }[];
  criteria: { label: string; max: number; score: number | null }[];
  total: number;
  percent: number;
  grade: string;
  comment: string | null;
};
export type StudentPhase1 = { call: true } | ({ call: false } & StudentMarks);

/**
 * What a student of `group` sees for Phase 1 on the Project page: while the group is called, only the call
 * (no marks, no feedback); otherwise their marks once all 9 are in and the marks are published; else nothing.
 */
export function studentPhase1(doc: MarkingDoc, group: number | null, marksPublished: boolean): StudentPhase1 | null {
  if (group === null) return null;
  if (doc.calls[String(group)]) return { call: true };
  const m = marksPublished ? doc.marks[String(group)] : undefined;
  if (!m) return null;
  const t = totals(m.scores);
  if (!t.grade || t.missing.length) return null;
  return {
    call: false,
    sections: SECTIONS.map((s) => ({ title: s.title, max: s.max, score: t.sections[s.id] })),
    criteria: CRITERIA.map((c) => ({ label: c.label, max: c.max, score: m.scores[c.id] ?? null })),
    total: t.total,
    percent: t.percent,
    grade: t.grade,
    comment: m.comment || null,
  };
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
      skipped.push({ group: n, reason: NO_RIGHTS });
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
