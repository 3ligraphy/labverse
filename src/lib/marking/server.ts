/**
 * Server side of Admin → Marking: who the marker is (admin / TA / none), the marking document in the
 * project-files store, and the numbered groups of the item whose numbers are used (the proposal).
 */
import type { Access } from '@/lib/accounts/access';
import { getAccountStore } from '@/lib/accounts/server';
import { buildGroups, cleanPlan, emptyPlan, type Group, type Student } from '@/lib/project-files/groups';
import type { getFilesStore } from '@/lib/project-files/server';
import { MARKING_KEY, cleanDoc, type MarkingDoc, type Marker } from './doc';
import { autoLink, withDefaultLoad } from './defaults';

type Store = NonNullable<ReturnType<typeof getFilesStore>>;

export const MARKING_MODULE = 'mobile-development';

/** Admins: the master password, super admins, doctors, and module leaders/admins. TAs: platform or module TAs. */
export function markerOf(a: Access): Marker {
  const moduleRole = a.who.modules[MARKING_MODULE];
  const admin = a.master || a.who.platformRole === 'super_admin' || a.who.platformRole === 'doctor' || moduleRole === 'leader' || moduleRole === 'admin';
  const ta = a.who.platformRole === 'ta' || moduleRole === 'ta';
  return { role: admin ? 'admin' : ta ? 'ta' : 'none', email: a.user?.email ?? null, name: a.by };
}

export type Staff = { name: string; email: string };

/** Active staff accounts (everyone who is not a student), by name: the accounts a marking-load row can link to. */
export async function staffList(): Promise<Staff[]> {
  const users = (await getAccountStore()?.list().catch(() => [])) ?? [];
  return users.filter((u) => u.active && u.role !== 'student').map((u) => ({ name: u.name, email: u.email.toLowerCase() })).sort((x, y) => x.name.localeCompare(y.name));
}

/** The document as everyone sees it: the team's default load until an admin saves one, rows linked to accounts by first name. */
export function prepared(doc: MarkingDoc, staff: readonly Staff[]): MarkingDoc {
  const d = withDefaultLoad(doc);
  return { ...d, tas: autoLink(d.tas, staff) };
}

export const loadMarking = async (store: Store): Promise<MarkingDoc> => cleanDoc(await store.getGroupData<unknown>(MARKING_KEY));

export type MarkGroup = { number: number; members: { id: string; name: string }[]; idea: string };

const numberOf = (g: Pick<Group, 'key' | 'numbered'>) => (g.numbered ? Number(/^G(\d+)$/.exec(g.key)?.[1] ?? NaN) : NaN);

async function groupsRaw(store: Store, fileId: string, plan?: unknown) {
  const [entries, roster, saved] = await Promise.all([store.listEntries(fileId), store.getGroupData<Student[]>('roster'), plan === undefined ? store.getGroupData<unknown>(`plan:${fileId}`) : Promise.resolve(plan)]);
  const p = saved ? cleanPlan(saved) : emptyPlan();
  return { groups: buildGroups(entries, roster ?? [], p), plan: p };
}

/** The item's numbered groups (number, members, approved idea), in number order. */
export async function markGroups(store: Store, fileId: string): Promise<MarkGroup[]> {
  const { groups, plan } = await groupsRaw(store, fileId);
  return groups
    .map((g) => ({ number: numberOf(g), members: g.members.map((m) => ({ id: m.id, name: m.name })), idea: plan.choices[g.key]?.idea ?? '' }))
    .filter((g) => Number.isInteger(g.number))
    .sort((a, b) => a.number - b.number);
}

/** Hand-in id → group key, for the plan saved now or for a plan about to be saved (the number lock). */
export async function keysByEntry(store: Store, fileId: string, plan?: unknown): Promise<Map<string, string>> {
  const { groups } = await groupsRaw(store, fileId, plan);
  const out = new Map<string, string>();
  for (const g of groups) for (const e of g.entries) out.set(e, g.key);
  return out;
}

/** The item a new marking document starts from: the one called "proposal", else the first. */
export async function defaultSource(store: Store): Promise<string | null> {
  const files = await store.list();
  return (files.find((f) => /proposal/i.test(f.title)) ?? files[0])?.id ?? null;
}
