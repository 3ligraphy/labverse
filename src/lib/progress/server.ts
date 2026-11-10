/**
 * PROGRESS TRACKING — server glue (Astro + Vercel). Rules live in ./core.ts, storage in ./store.ts.
 *
 * Needs, in Vercel → Project → Storage: a Neon database connected to the project
 * (it adds DATABASE_URL). Previews and laptops use the progress_dev_* tables, production progress_*.
 * Local development requires LOCAL_DATABASE_URL; there is no runtime in-memory fallback.
 */
import { getSecret } from 'astro:env/server';
import { getCollection } from 'astro:content';
import { getPlayground } from '@/lib/playgrounds';
import { exerciseMeta } from '@/lab/exercises/registry';
import { claimedByFileLab } from '@/lib/lab/claimed';
import { noStore } from '@/lib/attendance/server';
import { ALL_SESSIONS, ALWAYS_OPEN, LAB_DONE, OPEN_LAB, exerciseStats, labStructure, liveClass, moduleStats, scoreStudent, sessionState, type Identity, type LabStructure, type Valid } from './core';
import { NeonStore, type ProgressStore, type Session } from './store';
import { looseGroup } from '@/lib/identity';
import { publishedLabSources } from '@/lib/platform/server';
import { splitLabKey } from '@/lib/platform/core';
import { ANY_FACULTY, DEFAULT_FACULTY } from '@/lib/accounts/core';
import { hubData } from '@/lib/accounts/hub';

const env = (key: string) => getSecret(key) || undefined;
const onVercel = () => Boolean(env('VERCEL'));
const databaseUrl = () => onVercel()
  ? env('DATABASE_URL') ?? env('POSTGRES_URL')
  : env('LOCAL_DATABASE_URL') ?? env('DATABASE_URL') ?? env('POSTGRES_URL');

let store: ProgressStore | null | undefined;

/** The progress store, or null when a deployment has no database yet. */
export function getProgressStore(): ProgressStore | null {
  if (store !== undefined) return store;
  const url = databaseUrl();
  if (url) store = new NeonStore(url, env('VERCEL_ENV') === 'production' ? 'progress' : 'progress_dev', onVercel() ? 'neon' : 'postgres');
  else store = null;
  return store;
}

export const progressSetup = () => ({ database: Boolean(databaseUrl()) });

/* ---------------------------------------------------------- lab structure */

let structures: Promise<LabStructure[]> | null = null;
let builderLabs: { at: number; labs: Promise<LabStructure[]> } | null = null;
const BUILDER_TTL_MS = 30_000;

/**
 * Every lab's tasks and auto-checked exercises: the file-based labs (src/content) followed by the
 * published labs of builder modules (/admin/builder), so attendance, sessions and progress cover both.
 */
export async function getStructures(): Promise<LabStructure[]> {
  if (!builderLabs || Date.now() - builderLabs.at > BUILDER_TTL_MS) {
    builderLabs = {
      at: Date.now(),
      labs: publishedLabSources()
        // a builder lab rewritten as a file lab is counted once, as the file lab
        .then((sources) => sources.filter((l) => !claimedByFileLab(l.key)).map((l) => labStructure(l.key, l.title, l.outline, (id) => {
          const ex = l.exercises[id];
          return ex ? { title: ex.title, checks: ex.checks.length } : null;
        })))
        .catch((error) => { console.error('[platform] could not load builder labs', error); builderLabs = null; return []; }),
    };
  }
  const [files, built] = await Promise.all([fileStructures(), builderLabs.labs]);
  return [...files, ...built];
}

function fileStructures(): Promise<LabStructure[]> {
  if (structures && onVercel()) return structures;
  structures = (async () => {
    const labs = (await getCollection('labs', (e) => !e.data.draft)).sort((a, b) => a.data.number - b.data.number);
    return labs.map((lab) =>
      labStructure(lab.data.trackingKey ?? lab.id, `Lab ${String(lab.data.number).padStart(2, '0')}: ${lab.data.title}`, lab.body ?? '', (id) => {
        try {
          const p = getPlayground(id);
          return { title: p.title, checks: p.checks.length };
        } catch {
          const exercise = exerciseMeta(id);
          return exercise ? { title: exercise.title, checks: 1, task: String(exercise.block) } : null;
        }
      }),
    );
  })();
  return structures;
}

/* --------------------------------------------------------------- responses */

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...noStore } });

const WRITES_PER_WINDOW = 600;
const WINDOW_SEC = 10 * 60;

/* ---------------------------------------------------- sessions off (ALWAYS_OPEN) */

const permanent = new Map<string, { at: number; session: Promise<Session> }>();
const PERMANENT_TTL_MS = 60_000;

/** The lab's permanent session, remembered for a minute per server (it never closes, so this is safe). */
export function permanentSession(store: ProgressStore, lab: string): Promise<Session> {
  const hit = permanent.get(lab);
  if (hit && Date.now() - hit.at < PERMANENT_TTL_MS) return hit.session;
  const session = store.permanentSession(lab);
  permanent.set(lab, { at: Date.now(), session });
  session.catch(() => permanent.delete(lab)); // a failed lookup is tried again on the next request
  return session;
}

/** Whether this is a lab's permanent session (it is always open, whatever the clocks say). */
export const isPermanent = (s: Pick<Session, 'ta_name' | 'closes_at'>) => s.ta_name === OPEN_LAB.ta && s.closes_at === null;

/**
 * The session a student's request belongs to. With sessions off, a missing, ended or other lab's session falls back
 * to the lab's permanent session, so a student's work is never turned away. With sessions on: null when it is not
 * open.
 */
export async function liveSession(store: ProgressStore, lab: string, sessionId: string): Promise<Session | null> {
  const s = sessionId ? await store.getSessionById(sessionId) : null;
  if (s && s.lab === lab && (sessionState(s, Date.now()).open || (ALWAYS_OPEN && isPermanent(s)))) return s;
  return ALWAYS_OPEN ? permanentSession(store, lab) : null;
}

/** Are the labs of this lab's module locked by staff? Then students can't start the lab or save work in it. */
export async function labLocked(lab: string): Promise<boolean> {
  const { settings } = await hubData();
  return settings.locked.includes(labModuleOf(lab));
}
export const LOCKED_MESSAGE = 'This module’s labs are locked by your teaching team for now.';

/** The sessions the TA pages read: the chosen one, or — with sessions off — every session of the lab, added up. */
export async function sessionScope(store: ProgressStore, lab: string, sessionParam: string | null | undefined): Promise<string | string[] | undefined> {
  if (ALWAYS_OPEN && (!sessionParam || sessionParam === ALL_SESSIONS)) return (await store.listSessions(lab)).map((s) => s.id);
  return sessionParam || undefined;
}

/**
 * Shared flow of every student write: validate → session → flood guard → store. No device or network locks.
 * `act` may return a Response (sent as is) or extra fields for the JSON answer.
 */
export async function studentWrite<V extends Identity>(
  request: Request,
  validate: (body: unknown, labs: LabStructure[]) => Valid<V>,
  act: (store: ProgressStore, value: V & { studentKey: string; sessionId: string }) => Promise<Response | Record<string, unknown> | void>,
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad-request' }, 400);
  }
  const v = validate(body, await getStructures());
  if (!v.ok) return json({ error: 'invalid', errors: v.errors }, 400);

  const s = getProgressStore();
  if (!s) return json({ error: 'closed', message: 'Progress tracking is not set up yet.' }, 503);
  try {
    const lab = String((v.value as any).lab ?? '');
    if (await labLocked(lab)) return json({ error: 'locked', message: LOCKED_MESSAGE }, 403);
    let session = await liveSession(s, lab, String((body as Record<string, unknown>)?.sessionId ?? ''));
    if (!session) {
      return json({ error: 'session-closed', message: 'This lab session has not been started, or it has already ended. You can still read the lab content.' }, 403);
    }
    if ((await s.hit(`w:${v.value.studentKey}`, WINDOW_SEC)) > WRITES_PER_WINDOW) return json({ error: 'slow-down', message: 'Too many saves at once. Wait a minute.' }, 429);
    if (!(await s.isSessionStudent(session.id, v.value.studentKey))) {
      if (!ALWAYS_OPEN) return json({ error: 'not-started', message: 'Enter your name, ID and group at the top of the lab before starting.' }, 403);
      // sessions are off: a student who is not in that session joins the lab's permanent one, and the work is saved
      if (!isPermanent(session)) session = await permanentSession(s, lab);
      await s.touchStudent(v.value);
      if (!(await s.isSessionStudent(session.id, v.value.studentKey))) await s.joinSession(session.id, v.value.studentKey, looseGroup((body as Record<string, unknown>)?.group) || '—');
    } else await s.touchStudent(v.value);
    const out = await act(s, { ...v.value, sessionId: session.id });
    return out instanceof Response ? out : json({ ok: true, ...(out ?? {}) });
  } catch (err) {
    console.error('[progress] write failed', err);
    return json({ error: 'server' }, 500);
  }
}

/* --------------------------------------------------------------- dashboard */

export type DashboardStudent = {
  key: string;
  id: string;
  name: string;
  group: string;
  startedAt: string;
  lastSeen: string;
  locked: boolean;
  percent: number;
  solved: number;
  tasksDone: number;
  submission: { url: string; reviewed: boolean; note: string } | null;
  cells: Record<string, { passed: number; total: number; attempts: number }>;
  /** end-of-lab check-in time, or null */
  attended: string | null;
  checkedInAt: string | null;
  /** tasks that were on screen long enough */
  seen: number;
  activeSec: number;
};

/**
 * The lab picker on the admin dashboards: each lab with its module and faculty, so staff choose
 * Faculty → Module → Lab. File-based labs belong to the built-in course; builder labs are "<module>--<lab>".
 */
async function labChoices(labs: LabStructure[]) {
  const { settings, cards } = await hubData().catch(() => ({ settings: null, cards: [] as Awaited<ReturnType<typeof hubData>>['cards'] }));
  const card = new Map(cards.map((c) => [c.slug, c]));
  const facultyName = new Map((settings?.faculties ?? []).map((f) => [f.slug, f.name]));
  return labs.map((l) => {
    const key = splitLabKey(l.lab);
    const module = key?.module ?? 'mobile-development';
    const c = card.get(module);
    const moduleTitle = c?.title ?? module;
    const faculty = c?.faculty ?? DEFAULT_FACULTY;
    return {
      id: l.lab,
      // builder lab titles are "<module>: <lab>"; the module has its own picker now
      title: key && l.title.startsWith(`${moduleTitle}: `) ? l.title.slice(moduleTitle.length + 2) : l.title,
      module, moduleTitle, faculty,
      facultyName: faculty === ANY_FACULTY ? 'All faculties' : facultyName.get(faculty) ?? faculty,
      href: claimedByFileLab(l.lab) ? `/mobile-development/labs/${claimedByFileLab(l.lab)}` : key ? `/${key.module}/${key.lab}` : `/mobile-development/labs/${l.lab}`,
    };
  });
}

/* ------------------------------------------------------------ home page */

const BUILT_IN_SLUG = 'mobile-development';
/** the module a lab belongs to: builder labs carry it in their id ("<module>--<lab>"); file labs are the course's */
export const labModuleOf = (lab: string) => splitLabKey(lab)?.module ?? BUILT_IN_SLUG;
/** where a lab opens */
export const labHref = (lab: string) => {
  const k = splitLabKey(lab);
  return k && k.module !== BUILT_IN_SLUG ? `/${k.module}/${k.lab}` : `/${BUILT_IN_SLUG}/labs/${k?.lab ?? lab}`;
};

export type ModuleProgress = { percent: number; done: number; labs: number; started: boolean; next: { title: string; href: string } | null };

/**
 * A student's progress in each module, from every lab and session: the average of its labs' scores (the TA's
 * score), how many labs are done (LAB_DONE, as on the statistics page), and the first lab not done yet.
 */
export async function studentModules(studentKey: string): Promise<Record<string, ModuleProgress>> {
  const s = getProgressStore();
  if (!s) return {};
  const [labs, mine] = await Promise.all([getStructures(), s.studentProgress(studentKey)]);
  const out: Record<string, ModuleProgress & { sum: number }> = {};
  for (const l of labs) {
    const slug = labModuleOf(l.lab);
    const best = mine.best.filter((b) => b.lab === l.lab).map((b) => ({ ...b, attempts: 1, firstAt: '', solvedAt: null }));
    const percent = scoreStudent(l, best, mine.tasks.find((t) => t.lab === l.lab)?.done ?? 0, mine.subs.includes(l.lab)).percent;
    const m = (out[slug] ??= { percent: 0, done: 0, labs: 0, started: false, next: null, sum: 0 });
    m.labs++;
    m.sum += percent;
    m.started ||= best.length > 0 || percent > 0;
    if (percent >= LAB_DONE) m.done++;
    else m.next ??= { title: l.title, href: labHref(l.lab) };
  }
  return Object.fromEntries(Object.entries(out).map(([slug, { sum, ...m }]) => [slug, { ...m, percent: m.labs ? Math.round(sum / m.labs) : 0 }]));
}

export type ClassProgress = { students: number; avgPercent: number; labs: number };
let overview: { at: number; data: Promise<Record<string, ClassProgress>> } | null = null;

/** Each module's class: students who started any of its labs, and their average score (weighted by lab). Cached a minute. */
export function classOverview(): Promise<Record<string, ClassProgress>> {
  if (overview && Date.now() - overview.at < 60_000) return overview.data;
  const data = (async () => {
    const s = getProgressStore();
    if (!s) return {};
    const labs = await getStructures();
    const raw = await s.statsRaw(labs.map((l) => l.lab));
    const stats = moduleStats(labs, raw);
    const out: Record<string, { students: Set<string>; weighted: number; n: number; labs: number }> = {};
    for (const l of labs) (out[labModuleOf(l.lab)] ??= { students: new Set(), weighted: 0, n: 0, labs: 0 }).labs++;
    for (const m of raw.members) out[labModuleOf(m.lab)]?.students.add(m.student_key);
    for (const l of stats.labs) {
      const m = out[labModuleOf(l.lab)];
      if (!m || !l.students) continue;
      m.weighted += l.avgPercent * l.students;
      m.n += l.students;
    }
    return Object.fromEntries(Object.entries(out).map(([slug, m]) => [slug, { students: m.students.size, avgPercent: m.n ? Math.round(m.weighted / m.n) : 0, labs: m.labs }]));
  })();
  overview = { at: Date.now(), data };
  data.catch(() => { overview = null; });
  return data;
}

/** The statistics page for one module: every lab the person may see, across all sessions. */
export async function buildStats(moduleSlug: string, allow: (lab: string) => boolean) {
  const s = getProgressStore();
  if (!s) return null;
  const labs = (await getStructures()).filter((l) => allow(l.lab) && (splitLabKey(l.lab)?.module ?? 'mobile-development') === moduleSlug);
  const titles = new Map((await labChoices(labs)).map((c) => [c.id, c.title]));
  const raw = labs.length ? await s.statsRaw(labs.map((l) => l.lab)) : { sessions: [], best: [], tasks: [], subs: [], members: [], heat: [] };
  const stats = moduleStats(labs.map((l) => ({ ...l, title: titles.get(l.lab) ?? l.title })), raw);
  return { ...stats, updatedAt: new Date().toISOString() };
}

/** Everything /admin/progress shows for one lab. */
/** `allow` limits which labs the dashboard offers (lab dashboards follow the permission matrix). */
export async function buildDashboard(labParam: string | null, sessionParam?: string | null, allow: (lab: string) => boolean = () => true, moduleParam?: string | null) {
  const labs = (await getStructures()).filter((l) => allow(l.lab));
  // ?module= (from a module's Sessions / Progress button) opens that module's first lab
  const inModule = moduleParam ? labs.find((l) => (splitLabKey(l.lab)?.module ?? 'mobile-development') === moduleParam) : undefined;
  const structure = labs.find((l) => l.lab === labParam) ?? inModule ?? labs.find((l) => l.exercises.length) ?? labs[0];
  const s = getProgressStore();
  if (!structure || !s) return null;
  const listed = await s.listSessions(structure.lab);
  // sessions off: the default view adds up every session of the lab (everyone who ever started it, all their work)
  const all: (Session & { all: true }) | null = ALWAYS_OPEN
    ? { id: ALL_SESSIONS, lab: structure.lab, ta_name: 'All students', time_slot: 'Always open', opens_at: listed.at(-1)?.opens_at ?? new Date().toISOString(), closes_at: null, duration_minutes: null, all: true }
    : null;
  const sessions: Session[] = all ? [all, ...listed] : listed;
  const selected = sessions.find((session) => session.id === sessionParam) ?? sessions[0] ?? null;
  const scope = selected && 'all' in selected ? listed.map((x) => x.id) : selected?.id;
  const [data, activity] = selected && scope?.length
    ? await Promise.all([s.labData(structure.lab, scope), s.activity(scope)])
    : [{ students: [], best: [], tasks: [], submissions: [], checkins: [], views: [] }, { last: [], active: [], events: [] }];
  const stateOf = (x: Session) => ('all' in x || (ALWAYS_OPEN && isPermanent(x)) ? { open: true, closesAt: null } : sessionState(x, Date.now()));
  const students: DashboardStudent[] = data.students.map((st) => {
    const best = data.best.filter((b) => b.student_key === st.student_key);
    const tasksDone = data.tasks.find((t) => t.student_key === st.student_key)?.done ?? 0;
    const sub = data.submissions.find((x) => x.student_key === st.student_key) ?? null;
    const score = scoreStudent(structure, best, tasksDone, Boolean(sub));
    const view = data.views.find((v) => v.student_key === st.student_key);
    return {
      attended: data.checkins.find((c) => c.student_key === st.student_key)?.at ?? null,
      checkedInAt: data.checkins.find((c) => c.student_key === st.student_key)?.at ?? null,
      seen: view?.seen.length ?? 0,
      activeSec: view?.active_sec ?? 0,
      key: st.student_key,
      id: st.student_id,
      name: st.name,
      group: st.group_name ?? '—',
      startedAt: st.session_started_at ?? st.created_at,
      lastSeen: st.last_seen,
      locked: st.device_key !== null,
      percent: score.percent,
      solved: score.solved,
      tasksDone,
      submission: sub && { url: sub.url, reviewed: sub.reviewed, note: sub.note },
      cells: Object.fromEntries(best.map((b) => [b.exercise, { passed: b.passed, total: b.total, attempts: b.attempts }])),
    };
  });
  students.sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name));
  const exercises = exerciseStats(structure, data.students.map((st) => data.best.filter((b) => b.student_key === st.student_key)));
  const live = liveClass(structure, students, activity, Date.now());
  const names = new Map(students.map((st) => [st.key, st.name]));
  return {
    live: { ...live, events: activity.events.filter((e) => names.has(e.student_key)).map((e) => ({ ...e, name: names.get(e.student_key)! })) },
    labs: await labChoices(labs),
    structure,
    students,
    exercises,
    totals: {
      active: students.length,
      avgPercent: students.length ? Math.round(students.reduce((a, b) => a + b.percent, 0) / students.length) : 0,
      solved: students.reduce((a, b) => a + b.solved, 0),
      submitted: students.filter((x) => x.submission).length,
      checkedIn: students.filter((x) => x.attended).length,
    },
    session: selected ? { ...selected, ...stateOf(selected) } : { open: false, closesAt: null },
    practice: await s.getPractice(structure.lab),
    sessions: sessions.map((session) => ({ ...session, ...stateOf(session) })),
    alwaysOpen: ALWAYS_OPEN,
    updatedAt: new Date().toISOString(),
  };
}
