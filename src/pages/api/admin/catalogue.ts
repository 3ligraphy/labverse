/**
 * The catalogue (permission `platform.settings`; the super admin always has it):
 *   GET                                         { settings, modules: [{ slug, title, builtIn, audience }], students: {facultySlug: n} }
 *   PUT    { categories, years, faculties: [{ slug?, name, specializations[] }], activeSemester, specFromYear, specFromSemester, renames? }
 *          renames: { years?: {old: new}, specializations?: {old: new} } carries a rename into every module and profile.
 *          A faculty that modules or students still use can't be deleted (409). A specialization moved to another
 *          faculty takes its students with it. The legacy flat `specializations` (no faculties) still works.
 *   PATCH  ?module=… { faculty, category, years[], semester, specializations[], open }   one module's audience
 *          (faculty: a faculty slug or 'all'; its specializations must belong to that faculty)
 */
import type { APIRoute } from 'astro';
import { json } from '@/lib/progress/server';
import { access } from '@/lib/accounts/access';
import { ANY_FACULTY, DEFAULT_FACULTY, facultyOfSpecialization, listOf, moduleFaculty, parseSettings } from '@/lib/accounts/core';
import { getAccountStore } from '@/lib/accounts/server';
import { compileModule, orderFlow } from '@/lib/platform/core';
import { BUILT_IN_MODULE, getPlatformStore } from '@/lib/platform/server';

export const prerender = false;

async function guard(cookies: Parameters<typeof access>[0]) {
  const store = getAccountStore();
  if (!store) return { error: json({ error: 'Accounts need a database.' }, 503) };
  if (!(await access(cookies)).can('platform.settings')) return { error: json({ error: 'You do not manage the catalogue.' }, 403) };
  return { store, platform: getPlatformStore() };
}
type Guarded = { store: NonNullable<ReturnType<typeof getAccountStore>>; platform: ReturnType<typeof getPlatformStore> };
type StoredSettings = Awaited<ReturnType<Guarded['store']['getSettings']>>;

const audienceOf = (meta: Record<string, string>) => ({
  category: meta.category || 'Core', years: listOf(meta.years), semester: meta.semester || 'Semester 1',
  specializations: listOf(meta.specializations), open: meta.open === 'Yes', faculty: moduleFaculty(meta.faculty),
});

/** Every module (the built-in course first) with its audience. */
async function catalogueModules(g: Guarded, settings: StoredSettings) {
  // the built-in course also has a builder record with the same slug: list it once
  const rows = ((await g.platform?.listModules().catch(() => [])) ?? []).filter((m) => m.slug !== BUILT_IN_MODULE.slug);
  const b = settings.builtIn;
  return [
    { slug: BUILT_IN_MODULE.slug, title: BUILT_IN_MODULE.title, code: BUILT_IN_MODULE.code, color: BUILT_IN_MODULE.color, builtIn: true, published: true,
      audience: { category: b.category, years: listOf(b.years), semester: b.semester, specializations: listOf(b.specializations), open: b.open !== false, faculty: moduleFaculty(b.faculty) } },
    ...rows.map((m) => { const meta = compileModule(m.flow).meta; return { slug: m.slug, title: meta.title || m.title, code: meta.code ?? '', color: meta.color || '#7cb1ff', builtIn: false, published: m.published, audience: audienceOf(meta) }; }),
  ];
}

/** Students per faculty (accounts from before faculties count in the default faculty). */
async function studentsPerFaculty(g: Guarded): Promise<Record<string, number>> {
  const raw = await g.store.facultyCounts().catch(() => ({} as Record<string, number>));
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(raw)) out[k || DEFAULT_FACULTY] = (out[k || DEFAULT_FACULTY] ?? 0) + n;
  return out;
}

export const GET: APIRoute = async ({ cookies }) => {
  const g = await guard(cookies);
  if (g.error) return g.error;
  const settings = await g.store.getSettings();
  return json({ settings, modules: await catalogueModules(g, settings), students: await studentsPerFaculty(g) });
};

export const PUT: APIRoute = async ({ cookies, request }) => {
  const g = await guard(cookies);
  if (g.error) return g.error;
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const cur = await g.store.getSettings();
  const s = parseSettings(body, cur);
  if (!s.ok) return json({ error: s.error }, 400);
  try {
    // a deleted faculty must be empty: its modules and students move first
    const kept = new Set(s.value.faculties.map((f) => f.slug));
    const gone = cur.faculties.filter((f) => !kept.has(f.slug));
    if (gone.length) {
      const [mods, students] = await Promise.all([catalogueModules(g, cur), studentsPerFaculty(g)]);
      for (const f of gone) {
        const used = mods.filter((m) => m.audience.faculty === f.slug).map((m) => m.title);
        if (used.length) return json({ error: `${f.name} still has ${used.length === 1 ? 'a module' : `${used.length} modules`} (${used.slice(0, 3).join(', ')}${used.length > 3 ? '…' : ''}). Move ${used.length === 1 ? 'it' : 'them'} to another faculty first.` }, 409);
        const n = students[f.slug] ?? 0;
        if (n) return json({ error: `${f.name} still has ${n} student${n === 1 ? '' : 's'}. Move them to another faculty in Accounts first.` }, 409);
      }
    }
    const renames = (body.renames ?? {}) as { years?: Record<string, string>; specializations?: Record<string, string> };
    const mapList = (list: string, map: Record<string, string> = {}) => listOf(list).map((v) => map[v] ?? v).join(', ');
    const anyRename = Object.keys(renames.years ?? {}).length + Object.keys(renames.specializations ?? {}).length > 0;
    if (anyRename) {
      for (const [from, to] of Object.entries(renames.years ?? {})) await g.store.renameProfiles('year', from, to);
      for (const [from, to] of Object.entries(renames.specializations ?? {})) await g.store.renameProfiles('specialization', from, to);
      // builder modules
      for (const m of (await g.platform?.listModules()) ?? []) {
        const root = m.flow.nodes.find((n) => n.type === 'module');
        if (!root) continue;
        root.data.years = mapList(root.data.years ?? '', renames.years);
        root.data.specializations = mapList(root.data.specializations ?? '', renames.specializations);
        await g.platform!.saveModule(m.slug, { flow: m.flow });
      }
      // the built-in course
      await g.store.setSetting('builtIn', { ...cur.builtIn, years: mapList(cur.builtIn.years, renames.years), specializations: mapList(cur.builtIn.specializations, renames.specializations) });
    }
    // a specialization now in another faculty takes its students with it
    const wasNamed = Object.fromEntries(Object.entries(renames.specializations ?? {}).map(([from, to]) => [to, from]));
    for (const f of s.value.faculties) for (const sp of f.specializations) {
      const before = facultyOfSpecialization(cur.faculties, wasNamed[sp] ?? sp);
      if (before && before.slug !== f.slug) await g.store.moveSpecialization(sp, f.slug);
    }
    await Promise.all([
      g.store.setSetting('categories', s.value.categories), g.store.setSetting('years', s.value.years),
      g.store.setSetting('faculties', s.value.faculties),
      // flattened, for code that only needs the names
      g.store.setSetting('specializations', s.value.specializations), g.store.setSetting('activeSemester', s.value.activeSemester),
      g.store.setSetting('specFrom', s.value.specFrom),
    ]);
    return json({ settings: await g.store.getSettings() });
  } catch (error) {
    console.error('[catalogue] save failed', error);
    return json({ error: 'Could not save the catalogue.' }, 500);
  }
};

export const PATCH: APIRoute = async ({ cookies, request, url }) => {
  const g = await guard(cookies);
  if (g.error) return g.error;
  const module = url.searchParams.get('module') ?? '';
  const b = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const settings = await g.store.getSettings();
  const category = String(b.category ?? '').trim();
  if (!settings.categories.some((c) => c.name === category)) return json({ error: 'Choose one of the catalogue’s categories.' }, 400);
  const pick = (v: unknown, allowed: string[]) => (Array.isArray(v) ? v.map(String).filter((x) => allowed.includes(x)) : []);
  const years = pick(b.years, settings.years);
  const semester = ['Semester 1', 'Semester 2', 'Both'].includes(String(b.semester)) ? String(b.semester) : 'Semester 1';
  const open = b.open === true;
  // a faculty slug or 'all' (a request without one keeps the module's); specializations come from that faculty
  const audience = (current: string | undefined) => {
    const faculty = b.faculty === undefined ? moduleFaculty(current) : String(b.faculty);
    const fac = settings.faculties.find((f) => f.slug === faculty);
    if (faculty !== ANY_FACULTY && !fac) return null;
    return { faculty, specializations: pick(b.specializations, fac ? fac.specializations : settings.specializations).join(', ') };
  };
  const badFaculty = () => json({ error: 'Choose one of the catalogue’s faculties.' }, 400);
  try {
    if (module === BUILT_IN_MODULE.slug) {
      const a = audience(settings.builtIn.faculty);
      if (!a) return badFaculty();
      await g.store.setSetting('builtIn', { ...settings.builtIn, ...a, category, years: years.join(', '), semester, open });
      return json({ ok: true });
    }
    const m = await g.platform?.getModule(module);
    if (!m) return json({ error: 'Module not found.' }, 404);
    const root = orderFlow(m.flow, 'module')[0];
    if (!root) return json({ error: 'This module has no Module node.' }, 400);
    const a = audience(root.data.faculty);
    if (!a) return badFaculty();
    Object.assign(root.data, { ...a, category, years: years.join(', '), semester, open: open ? 'Yes' : 'No' });
    await g.platform!.saveModule(module, { flow: m.flow });
    return json({ ok: true });
  } catch (error) {
    console.error('[catalogue] module save failed', error);
    return json({ error: 'Could not save.' }, 500);
  }
};
