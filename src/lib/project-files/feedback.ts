/**
 * PROJECT FEEDBACK — rules for /admin/project/[id]/feedback. Written feedback for each project group, saved per
 * submission item next to its group plan. A note remembers the hand-ins of the group it was written for, so it
 * follows the group when the Groups page renumbers it. Pure functions only (tests/project-feedback.test.ts).
 */
import type { Group, Plan } from './groups.ts';

export const MAX_FEEDBACK = 4000;

export type Note = {
  text: string;
  /** IDs of the group's hand-ins when the note was written. */
  entries: string[];
  updatedAt: string;
  by: string;
};
/** Group key (when written) → its note. */
export type Feedback = Record<string, Note>;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const cleanText = (v: unknown) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/[^\S\n]+$/gm, '').trim();
const keyOk = (k: string) => k.length > 0 && k.length <= 40;
const ids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.map((x) => String(x).slice(0, 64)).filter(Boolean))].slice(0, 50) : []);

/** Server-side check of saved feedback: drops anything malformed. */
export function cleanFeedback(input: unknown): Feedback {
  const out: Feedback = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>).slice(0, 1000)) {
    const n = v as Partial<Note> | null;
    const text = cleanText(n?.text).slice(0, MAX_FEEDBACK);
    if (!keyOk(k) || !n || !text) continue;
    out[k] = { text, entries: ids(n.entries), updatedAt: String(n.updatedAt ?? '').slice(0, 40), by: String(n.by ?? '').slice(0, 120) };
  }
  return out;
}

/** One card's save request. Empty text clears the note. */
export function parseNote(input: Record<string, unknown>): Result<{ key: string; text: string; entries: string[] }> {
  const key = String(input.key ?? '').trim();
  const text = cleanText(input.text);
  if (!keyOk(key)) return { ok: false, error: 'Unknown group.' };
  if (text.length > MAX_FEEDBACK) return { ok: false, error: `Keep the feedback under ${MAX_FEEDBACK} characters.` };
  return { ok: true, value: { key, text, entries: ids(input.entries) } };
}

/** Saves or clears one group's note (returns a new object). */
export function setNote(all: Feedback, key: string, text: string, entries: string[], by: string, now = new Date()): Feedback {
  const next = { ...all };
  // The group may have been renumbered since: drop its note under the old key too.
  for (const [k, n] of Object.entries(next)) if (k !== key && entries.length && n.entries.some((e) => entries.includes(e))) delete next[k];
  if (text) next[key] = { text, entries, updatedAt: now.toISOString(), by };
  else delete next[key];
  return next;
}

/**
 * Which group each saved note belongs to now: the group holding most of the note's hand-ins, or else the group
 * with the same key. Notes whose group is gone are returned as `orphans`.
 */
export function placeNotes(groups: readonly Pick<Group, 'key' | 'entries'>[], all: Feedback): { notes: Map<string, Note>; orphans: [string, Note][] } {
  const notes = new Map<string, Note>();
  const orphans: [string, Note][] = [];
  const newest = (a: Note | undefined, b: Note) => (!a || b.updatedAt > a.updatedAt ? b : a);
  for (const [key, note] of Object.entries(all)) {
    let best: [string, number] | null = null;
    for (const g of groups) {
      const n = note.entries.filter((e) => g.entries.includes(e)).length;
      if (n && (!best || n > best[1])) best = [g.key, n];
    }
    const home = best?.[0] ?? (groups.some((g) => g.key === key) ? key : null);
    if (home) notes.set(home, newest(notes.get(home), note)); else orphans.push([key, note]);
  }
  return { notes, orphans };
}

/* ------------------------------------------------------------------ report */

export type ReportRow = {
  group: string;
  members: { id: string; name: string }[];
  idea: string;
  ideaMode: 'manual' | 'auto' | null;
  feedback: string;
  feedbackBy: string;
  feedbackAt: string;
};

/** The rows of the feedback report, in group order. Groups without a number are left out unless `all`. */
export function reportRows(groups: readonly Group[], plan: Pick<Plan, 'choices'>, notes: Map<string, Note>, all = false): ReportRow[] {
  return groups.filter((g) => all || g.numbered).map((g) => {
    const choice = plan.choices[g.key];
    return {
      group: g.numbered ? g.key.replace(/^G(\d+)$/, 'Group $1') : g.title,
      members: g.members.map(({ id, name }) => ({ id, name })),
      idea: choice?.idea ?? '',
      ideaMode: choice?.idea ? choice.mode : null,
      feedback: notes.get(g.key)?.text ?? '',
      feedbackBy: notes.get(g.key)?.by ?? '',
      feedbackAt: notes.get(g.key)?.updatedAt ?? '',
    };
  });
}

/** A file name for the report: "project-proposal-submission-feedback.pdf". */
export const reportFileName = (title: string) =>
  `${title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project'}-feedback.pdf`;
