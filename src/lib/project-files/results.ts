/**
 * PROPOSAL RESULTS: what a student sees on /project once staff publish an item's results. A student types their
 * ID and gets their own group only (number, members' names and IDs, approved idea, written feedback), never the class list.
 * Pure functions, unit-tested (tests/project-results.test.ts); served by src/pages/api/project/result.ts.
 */
import type { Group, Plan } from './groups.ts';
import { normId } from './groups.ts';
import type { Note } from './feedback.ts';

/** Whether students can see an item's results, and who last changed it. */
export type Release = { published: boolean; at: string; by: string };

export function cleanRelease(input: unknown): Release {
  const r = (input && typeof input === 'object' ? input : {}) as Partial<Release>;
  return { published: r.published === true, at: String(r.at ?? '').slice(0, 40), by: String(r.by ?? '').slice(0, 120) };
}

export type StudentResult = { group: string; members: { name: string; id: string }[]; idea: string; feedback: string | null };

/** "G12" → "Group 12"; a group still without a number has no label yet. */
export const groupLabel = (g: Pick<Group, 'key' | 'numbered'>) => (g.numbered ? `Group ${/^G(\d+)$/.exec(g.key)?.[1] ?? g.key}` : 'Your group (number still to come)');

/** The result for one student ID, or null when they are in no group of this item. */
export function resultFor(groups: readonly Group[], plan: Pick<Plan, 'choices'>, notes: ReadonlyMap<string, Note>, studentId: string): StudentResult | null {
  const id = normId(studentId);
  const g = groups.find((x) => x.members.some((m) => m.id === id));
  if (!g) return null;
  return {
    group: groupLabel(g),
    members: g.members.map((m) => ({ name: m.name, id: m.id })),
    idea: plan.choices[g.key]?.idea ?? '',
    feedback: notes.get(g.key)?.text.trim() || null,
  };
}

/** One student's lookups of their result (recorded by /api/project/result when the ID is in a group). */
export type View = { studentId: string; firstAt: string; lastAt: string; count: number };

export type Checked = { name: string; id: string; group: string; view: View | null };

/**
 * Who has looked up their result, for the admin feedback page: every group member with their lookups (or none).
 * Note that anyone who knows an ID can type it, so this shows the ID was looked up, not who typed it.
 */
export function whoChecked(groups: readonly Group[], views: readonly View[]): { rows: Checked[]; checked: number; total: number } {
  const byId = new Map(views.map((v) => [normId(v.studentId), v]));
  const rows = groups.flatMap((g) => g.members.map((m) => ({ name: m.name, id: m.id, group: groupLabel(g), view: byId.get(m.id) ?? null })));
  return { rows, checked: rows.filter((r) => r.view).length, total: rows.length };
}
