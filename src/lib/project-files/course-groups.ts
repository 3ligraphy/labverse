/**
 * Server side of the course groups (src/lib/project-files/groups.ts → Canon): the proposal item's groups, loaded
 * from the store, are the groups of every item of the course. Each hand-in's group number on any item comes from
 * them, so Phase 1, Phase 2, the marking, the feedback, the results and the downloads all use the proposal's numbers.
 */
import { needsGroup, type Entry, type ProjectFile } from './core';
import { buildGroups, cleanPlan, emptyPlan, makeCanon, masterItem, type Canon, type Group, type Plan, type Student } from './groups';
import type { getFilesStore } from './server';

type Store = NonNullable<ReturnType<typeof getFilesStore>>;

/** An item's groups as the pages build them: its hand-ins, the class list and its saved plan (with the course groups on other items). */
export async function itemGroups(store: Store, file: Pick<ProjectFile, 'id'>, canon: Canon | null, given?: { entries?: Entry[]; plan?: unknown }): Promise<{ groups: Group[]; plan: Plan; entries: Entry[] }> {
  const [entries, roster, saved] = await Promise.all([
    given?.entries ?? store.listEntries(file.id),
    store.getGroupData<Student[]>('roster'),
    given?.plan !== undefined ? Promise.resolve(given.plan) : store.getGroupData<unknown>(`plan:${file.id}`),
  ]);
  const plan = saved ? cleanPlan(saved) : emptyPlan();
  return { groups: buildGroups(entries, roster ?? [], plan, canon), plan, entries };
}

/** The course groups: the groups of the course's proposal item, or null when the course has none. */
export async function loadCanon(store: Store, files?: readonly ProjectFile[]): Promise<Canon | null> {
  const master = masterItem(files ?? (await store.list()));
  if (!master) return null;
  const { groups, plan } = await itemGroups(store, master, null);
  return makeCanon(master, groups, plan);
}

/** The course groups to apply to an item: none for the proposal itself (it defines them) or for other modules' items. */
export const canonFor = (file: Pick<ProjectFile, 'id' | 'module'>, canon: Canon | null): Canon | null =>
  canon && needsGroup(file) && file.id !== canon.source ? canon : null;

/** Each hand-in of a course item with its group key ("G12", or '' when it is in no numbered group); other items unchanged. */
export async function withGroups(store: Store, file: Pick<ProjectFile, 'id' | 'module'>, entries: Entry[], canon?: Canon | null): Promise<(Entry & { group?: string })[]> {
  if (!needsGroup(file)) return entries;
  const all = canon === undefined ? await loadCanon(store) : canon;
  const { groups } = await itemGroups(store, file, canonFor(file, all), { entries });
  const keyOf = new Map(groups.flatMap((g) => g.entries.map((id) => [id, g.numbered ? g.key : ''] as const)));
  return entries.map((e) => ({ ...e, group: keyOf.get(e.id) ?? '' }));
}
