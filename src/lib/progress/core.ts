/**
 * PROGRESS TRACKING — core rules.
 * Pure TypeScript with no framework imports, so it runs in Astro, on Vercel and
 * directly under `node --test` (see tests/progress.test.ts).
 */
import { parseLabOutline } from '../lab.ts';
import { cleanName, cleanStudentId, nameError, studentIdError } from '../identity.ts';

/* ---------------------------------------------------------------- types */

export type Identity = { name: string; studentId: string; deviceKey: string };
export type LabStructure = {
  lab: string;
  title: string;
  tasks: { n: string; title: string }[];
  exercises: { id: string; task: string; title: string; checks: number }[];
  hasSubmission: boolean;
};
export type AttemptIn = Identity & { lab: string; exercise: string; passed: number; total: number; code: string };
export type TaskIn = Identity & { lab: string; task: string; done: boolean };
export type SubmissionIn = Identity & { lab: string; url: string };
export type Valid<T> = { ok: true; value: T & { studentKey: string } } | { ok: false; errors: Record<string, string> };
/** A student's best result on one exercise. */
export type Best = { exercise: string; passed: number; total: number; attempts: number; firstAt: string; solvedAt: string | null };

/* ----------------------------------------------------------- validation */

// name and student ID rules are shared with every form that identifies a student (src/lib/identity.ts)
const DEVICE_RE = /^[A-Za-z0-9_-]{16,64}$/;
const REPO_RE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/;
export const MAX_CODE = 20_000;

const obj = (input: unknown) => (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

export function validateStudentIdentity(input: unknown): Valid<Pick<Identity, 'name' | 'studentId'>> {
  const o = obj(input);
  const name = cleanName(o.name);
  const studentId = cleanStudentId(o.studentId);
  const errors: Record<string, string> = {};
  const badName = nameError(name);
  const badId = studentIdError(studentId);
  if (badName) errors.name = badName;
  if (badId) errors.studentId = badId;
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { name, studentId, studentKey: studentId.toLowerCase() } };
}

export function validateIdentity(input: unknown): Valid<Identity> {
  const identity = validateStudentIdentity(input);
  // the browser never blocks anyone: a missing or odd key is replaced
  const rawKey = String(obj(input).deviceKey ?? '').trim();
  const deviceKey = DEVICE_RE.test(rawKey) ? rawKey : 'unknown-device-0000';
  const errors: Record<string, string> = identity.ok ? {} : { ...identity.errors };
  if (!identity.ok || Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { ...identity.value, deviceKey } };
}

/** Identity + lab checks shared by every student write. */
function withLab<T>(input: unknown, labs: LabStructure[], check: (o: Record<string, unknown>, lab: LabStructure, errors: Record<string, string>) => T): Valid<Identity & { lab: string } & T> {
  const o = obj(input);
  const id = validateIdentity(o);
  const errors: Record<string, string> = id.ok ? {} : { ...id.errors };
  const lab = labs.find((l) => l.lab === o.lab);
  if (!lab) errors.lab = 'Unknown lab.';
  const extra = lab ? check(o, lab, errors) : ({} as T);
  if (!id.ok || Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { ...id.value, lab: lab!.lab, ...extra } };
}

export function validateAttempt(input: unknown, labs: LabStructure[]): Valid<AttemptIn> {
  return withLab(input, labs, (o, lab, errors) => {
    const exercise = String(o.exercise ?? '');
    const { passed, total } = o;
    const code = typeof o.code === 'string' ? o.code : '';
    if (!lab.exercises.some((e) => e.id === exercise)) errors.exercise = 'Unknown exercise.';
    if (!isInt(passed) || !isInt(total) || total < 1 || total > 50 || passed < 0 || passed > total) errors.score = 'Invalid score.';
    if (code.length > MAX_CODE) errors.code = 'The code is too long to save.';
    return { exercise, passed: passed as number, total: total as number, code };
  });
}

export function validateTask(input: unknown, labs: LabStructure[]): Valid<TaskIn> {
  return withLab(input, labs, (o, lab, errors) => {
    const task = String(o.task ?? '');
    if (!lab.tasks.some((t) => t.n === task)) errors.task = 'Unknown task.';
    if (typeof o.done !== 'boolean') errors.done = 'Invalid value.';
    return { task, done: o.done === true };
  });
}

export function validateSubmission(input: unknown, labs: LabStructure[]): Valid<SubmissionIn> {
  return withLab(input, labs, (o, lab, errors) => {
    const url = String(o.url ?? '').trim();
    if (!lab.hasSubmission) errors.lab = 'This lab has no repository to submit.';
    else if (!REPO_RE.test(url)) errors.url = 'Paste the link to your repository, like https://github.com/your-username/movies-app';
    return { url: url.replace(/\/$/, '') };
  });
}

export type CheckinIn = Identity & { lab: string };
export type ViewsIn = Identity & { lab: string; seen: string[]; activeSec: number };

export const ATTENDANCE_MIN_ACTIVE_SEC = 5 * 60;
export const ATTENDANCE_MIN_SEEN = 3;

/** Evidence required before the end-of-lab attendance write is allowed. */
export function attendanceEligibility(input: {
  student: { name: string; device_key: string | null } | null;
  name: string;
  activeSec: number;
  seen: number;
}): { ok: true } | { ok: false; reason: 'identity' | 'participation' } {
  // only "did they start the lab?": the name may differ (the last one typed is kept), from any device
  if (!input.student) return { ok: false, reason: 'identity' };
  if (input.activeSec < ATTENDANCE_MIN_ACTIVE_SEC || input.seen < ATTENDANCE_MIN_SEEN) return { ok: false, reason: 'participation' };
  return { ok: true };
}

/** "I was here": end-of-lab check-in. */
export function validateCheckin(input: unknown, labs: LabStructure[]): Valid<CheckinIn> {
  return withLab(input, labs, () => ({}));
}

/** A batch of reading data: tasks that were on screen long enough + active seconds since the last batch. */
export function validateViews(input: unknown, labs: LabStructure[]): Valid<ViewsIn> {
  return withLab(input, labs, (o, lab, errors) => {
    const raw = Array.isArray(o.seen) ? o.seen.map(String) : null;
    const known = new Set(lab.tasks.map((t) => t.n));
    if (!raw || raw.length > 100 || raw.some((n) => !known.has(n))) errors.seen = 'Invalid tasks.';
    if (!isInt(o.activeSec) || o.activeSec < 0 || o.activeSec > 900) errors.activeSec = 'Invalid time.';
    return { seen: [...new Set(raw ?? [])], activeSec: o.activeSec as number };
  });
}

/** Whether a lab's check-in is open right now. */
export function sessionState(s: { opens_at: string; closes_at: string | null } | null, now: number): { open: boolean; closesAt: string | null } {
  if (!s) return { open: false, closesAt: null };
  const open = Date.parse(s.opens_at) <= now && (s.closes_at === null || Date.parse(s.closes_at) > now);
  return { open, closesAt: open ? s.closes_at : null };
}

/* ---------------------------------------------------------- lab structure */

const attr = (src: string, name: string) => src.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];

/** Tasks come from <Task>; exercises come from legacy <Playground> or interactive <Exercise> blocks. */
export function labStructure(lab: string, title: string, body: string, info: (id: string) => { title: string; checks: number; task?: string } | null): LabStructure {
  let tasks = parseLabOutline(body).flatMap((p) => p.tasks.map((t) => ({ n: t.n, title: t.title })));
  const exercises: LabStructure['exercises'] = [];
  let task = '';
  for (const m of body.matchAll(/<(Part|Task|Playground|Exercise)\b([^>]*)>/g)) {
    const [, kind, attrs] = m;
    if (kind === 'Part' || kind === 'Task') task = attr(attrs, 'n') ?? task;
    else if (kind === 'Exercise' || !/\bdemo\b/.test(attrs)) {
      const id = attr(attrs, kind === 'Exercise' ? 'id' : 'ex');
      const meta = id ? info(id) : null;
      if (id && meta && meta.checks > 0) exercises.push({ id, task: meta.task ?? task, title: meta.title, checks: meta.checks });
    }
  }
  if (!tasks.length && exercises.length) tasks = exercises.map((e) => ({ n: e.id, title: e.title }));
  return { lab, title, tasks, exercises, hasSubmission: /<RepoSubmit\b/.test(body) };
}

/* ---------------------------------------------------------------- scoring */

/** exercises 70 · tasks 20 · repo 10 (75/25 without a repo; tasks only without exercises). */
export function scoreStudent(s: LabStructure, best: Best[], doneTasks: number, submitted: boolean): { percent: number; solved: number } {
  const ids = new Set(s.exercises.map((e) => e.id));
  const mine = best.filter((b) => ids.has(b.exercise));
  const solved = mine.filter((b) => b.total > 0 && b.passed >= b.total).length;
  const ex = s.exercises.length ? mine.reduce((a, b) => a + Math.min(1, b.total ? b.passed / b.total : 0), 0) / s.exercises.length : 0;
  const tasks = s.tasks.length ? Math.min(1, doneTasks / s.tasks.length) : 0;
  const sub = submitted ? 1 : 0;
  const hasEx = s.exercises.length > 0;
  const [we, wt, ws] = hasEx ? (s.hasSubmission ? [70, 20, 10] : [75, 25, 0]) : s.hasSubmission ? [0, 80, 20] : [0, 100, 0];
  return { percent: Math.round(we * ex + wt * tasks + ws * sub), solved };
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/** Class view per exercise. `bestByStudent` has one array per active student. */
export function exerciseStats(s: LabStructure, bestByStudent: Best[][]) {
  return s.exercises.map((e) => {
    const rows = bestByStudent.map((bs) => bs.find((b) => b.exercise === e.id)).filter(Boolean) as Best[];
    const solvers = rows.filter((b) => b.passed >= b.total && b.solvedAt);
    const attempts = rows.map((b) => b.attempts);
    return {
      id: e.id,
      solvedPct: bestByStudent.length ? Math.round((100 * solvers.length) / bestByStudent.length) : 0,
      avgAttempts: attempts.length ? Math.round((attempts.reduce((a, b) => a + b, 0) / attempts.length) * 10) / 10 : 0,
      medianSolveMs: median(solvers.map((b) => Date.parse(b.solvedAt!) - Date.parse(b.firstAt))),
    };
  });
}

/* ------------------------------------------------------------- live class */

/** What happened in a session lately (from ProgressStore.activity). */
export type Activity = {
  /** each student's latest Check, with how many failed Checks on that exercise since it last passed */
  last: { student_key: string; exercise: string; passed: number; total: number; at: string; fails: number }[];
  /** the last moment each student did anything (Check, Done tick, page heartbeat, joining) */
  active: { student_key: string; at: string }[];
  /** newest first */
  events: { student_key: string; kind: 'check' | 'task'; ref: string; passed: number; total: number; at: string }[];
};
export type LiveStatus = 'help' | 'active' | 'idle' | 'away' | 'done';
export type LiveRow = { key: string; status: LiveStatus; working: string | null; fails: number; lastActive: string | null; why: string };

export const LIVE = { IDLE_MIN: 4, AWAY_MIN: 10, HELP_FAILS: 3, HELP_WINDOW_MIN: 20 };

/**
 * The TA's live class view: who is working, who is stuck, who went quiet.
 *   done   every point earned
 *   away   nothing for 10+ min
 *   help   3+ failed Checks in a row on one exercise in the last 20 min
 *   idle   nothing for 4–10 min
 *   active otherwise
 */
export function liveClass(
  s: LabStructure,
  students: { key: string; percent: number; cells: Record<string, { passed: number; total: number }>; startedAt?: string }[],
  activity: Activity,
  now: number,
): { rows: LiveRow[]; counts: Record<LiveStatus, number> } {
  const last = new Map(activity.last.map((l) => [l.student_key, l]));
  const active = new Map(activity.active.map((a) => [a.student_key, a.at]));
  const counts: Record<LiveStatus, number> = { help: 0, active: 0, idle: 0, away: 0, done: 0 };
  const rows = students.map((st): LiveRow => {
    const l = last.get(st.key);
    const solved = (id: string) => { const c = st.cells[id]; return Boolean(c && c.total > 0 && c.passed >= c.total); };
    const working = l && !solved(l.exercise) ? l.exercise : (s.exercises.find((e) => !solved(e.id))?.id ?? null);
    const lastActive = active.get(st.key) ?? st.startedAt ?? null;
    const quietMin = lastActive ? (now - Date.parse(lastActive)) / 60_000 : Infinity;
    const fails = l && !solved(l.exercise) ? l.fails : 0;
    const recentFail = l ? (now - Date.parse(l.at)) / 60_000 <= LIVE.HELP_WINDOW_MIN : false;
    let status: LiveStatus;
    let why: string;
    if (st.percent >= 100) { status = 'done'; why = 'Finished the lab'; }
    else if (quietMin >= LIVE.AWAY_MIN) { status = 'away'; why = lastActive ? `Nothing for ${Math.round(quietMin)} min` : 'Joined, no activity yet'; }
    else if (fails >= LIVE.HELP_FAILS && recentFail) { status = 'help'; why = `${fails} failed Checks in a row`; }
    else if (quietMin >= LIVE.IDLE_MIN) { status = 'idle'; why = `Quiet for ${Math.round(quietMin)} min`; }
    else { status = 'active'; why = 'Working now'; }
    counts[status]++;
    return { key: st.key, status, working, fails, lastActive, why };
  });
  return { rows, counts };
}

/* ------------------------------------------------------------- statistics */

/** Raw rows for a module's statistics page, across every session of its labs (from ProgressStore.statsRaw). */
export type StatsRaw = {
  sessions: { id: string; lab: string; ta_name: string; time_slot: string; opens_at: string; joined: number; attended: number }[];
  /** per lab, student and exercise: best result, tries, and whether the first try passed */
  best: { lab: string; student_key: string; exercise: string; passed: number; total: number; attempts: number; first_ok: boolean }[];
  tasks: { lab: string; student_key: string; done: number }[];
  subs: { lab: string; student_key: string }[];
  /** the group a student last joined each lab with */
  members: { lab: string; student_key: string; group_name: string }[];
  /** Checks by weekday (0 = Sunday) and hour, Cairo time */
  heat: { dow: number; hour: number; n: number }[];
};

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

export function moduleStats(labs: LabStructure[], raw: StatsRaw) {
  const known = new Set(labs.map((l) => l.lab));
  const percents = new Map<string, number>(); // `${lab}|${student}` → score
  const perLab = labs.map((l) => {
    const students = [...new Set(raw.members.filter((m) => m.lab === l.lab).map((m) => m.student_key))];
    const scores = students.map((key) => {
      const best = raw.best.filter((b) => b.lab === l.lab && b.student_key === key)
        .map((b) => ({ exercise: b.exercise, passed: b.passed, total: b.total, attempts: b.attempts, firstAt: '', solvedAt: null }));
      const done = raw.tasks.find((t) => t.lab === l.lab && t.student_key === key)?.done ?? 0;
      const sub = raw.subs.some((x) => x.lab === l.lab && x.student_key === key);
      const p = scoreStudent(l, best, done, sub).percent;
      percents.set(`${l.lab}|${key}`, p);
      return p;
    });
    const spread = Array.from({ length: 10 }, () => 0);
    for (const p of scores) spread[Math.min(9, Math.floor(p / 10))]++;
    const exercises = l.exercises.map((e) => {
      const rows = raw.best.filter((b) => b.lab === l.lab && b.exercise === e.id && students.includes(b.student_key));
      const solved = rows.filter((b) => b.total > 0 && b.passed >= b.total);
      return {
        id: e.id, title: e.title, tried: rows.length,
        solvedPct: students.length ? Math.round((100 * solved.length) / students.length) : 0,
        avgTries: rows.length ? Math.round((rows.reduce((a, b) => a + b.attempts, 0) / rows.length) * 10) / 10 : 0,
        firstTryPct: rows.length ? Math.round((100 * rows.filter((b) => b.first_ok).length) / rows.length) : 0,
      };
    });
    const sessions = raw.sessions.filter((s) => s.lab === l.lab);
    return {
      lab: l.lab, title: l.title, students: students.length, sessions: sessions.length,
      avgPercent: avg(scores), finished: scores.filter((p) => p >= 80).length, spread, exercises,
    };
  });

  const groupScores = new Map<string, number[]>();
  for (const m of raw.members) {
    if (!known.has(m.lab)) continue;
    const g = m.group_name && m.group_name !== '—' ? m.group_name : 'No group';
    groupScores.set(g, [...(groupScores.get(g) ?? []), percents.get(`${m.lab}|${m.student_key}`) ?? 0]);
  }
  const groups = [...groupScores].map(([group, xs]) => ({ group, entries: xs.length, avgPercent: avg(xs) }))
    .sort((a, b) => (a.group === 'No group' ? 1 : b.group === 'No group' ? -1 : a.group.localeCompare(b.group, undefined, { numeric: true })));

  const sessions = raw.sessions.filter((s) => known.has(s.lab)).sort((a, b) => a.opens_at.localeCompare(b.opens_at));
  const joined = sessions.reduce((a, s) => a + s.joined, 0);
  const attended = sessions.reduce((a, s) => a + s.attended, 0);
  const heat = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const h of raw.heat) if (h.dow >= 0 && h.dow < 7 && h.hour >= 0 && h.hour < 24) heat[h.dow][h.hour] += h.n;
  const inLabs = raw.best.filter((b) => known.has(b.lab));
  return {
    totals: {
      students: new Set(raw.members.filter((m) => known.has(m.lab)).map((m) => m.student_key)).size,
      sessions: sessions.length,
      attendancePct: joined ? Math.round((100 * attended) / joined) : 0,
      checks: inLabs.reduce((a, b) => a + b.attempts, 0),
      solved: inLabs.filter((b) => b.total > 0 && b.passed >= b.total).length,
      firstTryPct: inLabs.length ? Math.round((100 * inLabs.filter((b) => b.first_ok).length) / inLabs.length) : 0,
    },
    sessions: sessions.map((s) => ({ id: s.id, lab: s.lab, ta: s.ta_name, slot: s.time_slot, at: s.opens_at, joined: s.joined, attended: s.attended })),
    labs: perLab,
    groups,
    heat,
  };
}

/* -------------------------------------------------------------------- CSV */

export function toCsv(rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(',')).join('\r\n');
}
