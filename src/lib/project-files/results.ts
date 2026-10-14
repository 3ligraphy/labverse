/**
 * PROPOSAL RESULTS: what a student sees on /project once staff publish an item's results. A student types their
 * ID and gets their own group only (number, member names, approved idea, written feedback), never the class list.
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

export type StudentResult = { group: string; members: string[]; idea: string; feedback: string | null };

/** "G12" → "Group 12"; a group still without a number has no label yet. */
export const groupLabel = (g: Pick<Group, 'key' | 'numbered'>) => (g.numbered ? `Group ${/^G(\d+)$/.exec(g.key)?.[1] ?? g.key}` : 'Your group (number still to come)');

/** The result for one student ID, or null when they are in no group of this item. */
export function resultFor(groups: readonly Group[], plan: Pick<Plan, 'choices'>, notes: ReadonlyMap<string, Note>, studentId: string): StudentResult | null {
  const id = normId(studentId);
  const g = groups.find((x) => x.members.some((m) => m.id === id));
  if (!g) return null;
  return {
    group: groupLabel(g),
    members: g.members.map((m) => m.name),
    idea: plan.choices[g.key]?.idea ?? '',
    feedback: notes.get(g.key)?.text.trim() || null,
  };
}
