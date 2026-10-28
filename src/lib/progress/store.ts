/**
 * PROGRESS TRACKING — storage. One interface, two backends:
 *   MemoryStore  deterministic unit tests only
 *   NeonStore    Neon in Vercel or standard PostgreSQL locally; tables are created on first use
 */
import { neon } from '@neondatabase/serverless';
import { Pool } from 'pg';
import { type Activity, type Best, type Identity, type StatsRaw } from './core.ts';

export type StudentRow = { student_key: string; student_id: string; name: string; device_key: string | null; created_at: string; last_seen: string; group_name?: string; session_started_at?: string };
export type AttemptRow = { id: number; exercise: string; passed: number; total: number; code: string; created_at: string };
export type SubmissionRow = { student_key: string; url: string; reviewed: boolean; note: string; updated_at: string };
export type LabData = {
  students: StudentRow[];
  best: (Best & { student_key: string })[];
  tasks: { student_key: string; done: number }[];
  submissions: SubmissionRow[];
  checkins: { student_key: string; at: string }[];
  views: { student_key: string; seen: string[]; active_sec: number }[];
};
export type Session = {
  id: string;
  lab: string;
  ta_name: string;
  time_slot: string;
  opens_at: string;
  closes_at: string | null;
  duration_minutes: number | null;
};
export type StudentData = {
  student: StudentRow | null;
  attempts: AttemptRow[];
  tasks: { task: string; done: boolean }[];
  submission: { url: string; reviewed: boolean; note: string } | null;
  checkin: string | null;
  views: { seen: string[]; active_sec: number } | null;
};

export interface ProgressStore {
  addManualAttendance(lab: string, sessionId: string, student: { studentKey: string; studentId: string; name: string }): Promise<string | null>;
  /** Creates the student or updates them: the name and ID last typed win, from any device. */
  touchStudent(i: Identity & { studentKey: string }): Promise<'ok'>;
  joinSession(sessionId: string, studentKey: string, group: string): Promise<void>;
  isSessionStudent(sessionId: string, studentKey: string): Promise<boolean>;
  addAttempt(a: { studentKey: string; lab: string; exercise: string; passed: number; total: number; code: string; sessionId?: string }): Promise<void>;
  setTask(t: { studentKey: string; lab: string; task: string; done: boolean; sessionId?: string }): Promise<void>;
  setSubmission(s: { studentKey: string; lab: string; url: string; sessionId?: string }): Promise<void>;
  /** Counts calls per key inside a time window (rate limiting). */
  hit(key: string, windowSec: number): Promise<number>;
  /** The current count for a key without adding to it (0 once its window has passed). */
  count(key: string): Promise<number>;
  labData(lab: string, sessionId?: string): Promise<LabData>;
  studentData(lab: string, studentKey: string, sessionId?: string): Promise<StudentData>;
  /** Live class view: latest Check per student, last activity, and the newest events of one session. */
  activity(sessionId: string, limit?: number): Promise<Activity>;
  /** Everything the statistics page needs for these labs, across all their sessions. */
  statsRaw(labs: string[]): Promise<StatsRaw>;
  unlock(studentKey: string): Promise<void>;
  review(studentKey: string, lab: string, reviewed: boolean, note: string, sessionId?: string): Promise<void>;
  /* per-lab attendance + reading */
  getSession(lab: string): Promise<Session | null>;
  getSessionById(id: string): Promise<Session | null>;
  listSessions(lab: string): Promise<Session[]>;
  createSession(lab: string, taName: string, timeSlot: string, minutes?: number | null): Promise<Session>;
  updateSession(lab: string, sessionId: string, taName: string, timeSlot: string, minutes: number | null): Promise<Session | null>;
  startSession(lab: string, sessionId: string, minutes: number | null): Promise<Session | null>;
  deleteSession(lab: string, sessionId: string): Promise<boolean>;
  openSession(lab: string, minutes: number | null, taName?: string, timeSlot?: string): Promise<Session>;
  closeSession(lab: string, sessionId?: string): Promise<void>;
  /** Returns the check-in time; the first check-in is kept. */
  checkIn(studentKey: string, lab: string, sessionId?: string): Promise<string>;
  addViews(studentKey: string, lab: string, seen: string[], activeSec: number, sessionId?: string): Promise<void>;
  /** Open practice: students may solve the lab with no session running (nothing is recorded). */
  getPractice(lab: string): Promise<boolean>;
  setPractice(lab: string, on: boolean): Promise<void>;
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));

/* ------------------------------------------------------------------ memory */

export class MemoryStore implements ProgressStore {
  async addManualAttendance(lab: string, sessionId: string, student: { studentKey: string; studentId: string; name: string }) {
    if (this.sessions.get(sessionId)?.lab !== lab) return null;
    // Staff are trusted: the ID decides, and a student already on record keeps their name.
    const existing = this.students.get(student.studentKey);
    if (!existing) this.students.set(student.studentKey, {
      student_key: student.studentKey, student_id: student.studentId, name: student.name,
      device_key: null, created_at: this.stamp(), last_seen: this.stamp(),
    });
    if (!(await this.isSessionStudent(sessionId, student.studentKey))) await this.joinSession(sessionId, student.studentKey, '');
    return this.checkIn(student.studentKey, lab, sessionId);
  }
  private students = new Map<string, StudentRow>();
  private attempts: (AttemptRow & { student_key: string; lab: string; session_id?: string })[] = [];
  private tasks = new Map<string, { student_key: string; lab: string; task: string; done: boolean; session_id?: string }>();
  private subs = new Map<string, SubmissionRow & { lab: string; session_id?: string }>();
  private hits = new Map<string, { n: number; until: number }>();
  private sessions = new Map<string, Session>();
  private memberships = new Map<string, { session_id: string; student_key: string; group_name: string; joined_at: string }>();
  private checkins = new Map<string, { student_key: string; lab: string; at: string; session_id?: string }>();
  private views = new Map<string, { student_key: string; lab: string; seen: Set<string>; active_sec: number; session_id?: string }>();
  private practice = new Set<string>();
  private acted = new Map<string, string>(); // `${sessionId}|${studentKey}` → last activity
  private taskLog: { session_id?: string; student_key: string; task: string; at: string; n: number }[] = [];
  private seq = 0;
  private now: () => number;
  constructor(now: () => number = Date.now) {
    this.now = now;
  }
  private stamp = () => new Date(this.now()).toISOString();

  async touchStudent(i: Identity & { studentKey: string }) {
    const row = this.students.get(i.studentKey) ?? null;
    const t = this.stamp();
    this.students.set(i.studentKey, {
      student_key: i.studentKey, student_id: i.studentId, name: i.name, device_key: i.deviceKey,
      created_at: row?.created_at ?? t, last_seen: t,
    });
    return 'ok' as const;
  }
  async joinSession(sessionId: string, studentKey: string, group: string) {
    const key = `${sessionId}|${studentKey}`;
    const previous = this.memberships.get(key);
    this.memberships.set(key, { session_id: sessionId, student_key: studentKey, group_name: group, joined_at: previous?.joined_at ?? this.stamp() });
  }
  async isSessionStudent(sessionId: string, studentKey: string) {
    return this.memberships.has(`${sessionId}|${studentKey}`);
  }
  async addAttempt(a: { studentKey: string; lab: string; exercise: string; passed: number; total: number; code: string; sessionId?: string }) {
    this.attempts.push({ id: ++this.seq, student_key: a.studentKey, lab: a.lab, session_id: a.sessionId, exercise: a.exercise, passed: a.passed, total: a.total, code: a.code, created_at: this.stamp() });
    this.acted.set(`${a.sessionId ?? ''}|${a.studentKey}`, this.stamp());
  }
  async setTask(t: { studentKey: string; lab: string; task: string; done: boolean; sessionId?: string }) {
    this.tasks.set(`${t.sessionId ?? ''}|${t.studentKey}|${t.lab}|${t.task}`, { student_key: t.studentKey, lab: t.lab, task: t.task, done: t.done, session_id: t.sessionId });
    this.acted.set(`${t.sessionId ?? ''}|${t.studentKey}`, this.stamp());
    if (t.done) this.taskLog.push({ session_id: t.sessionId, student_key: t.studentKey, task: t.task, at: this.stamp(), n: this.seq + 0.5 }); // sorts after earlier Checks
  }
  async setSubmission(s: { studentKey: string; lab: string; url: string; sessionId?: string }) {
    const k = `${s.sessionId ?? ''}|${s.studentKey}|${s.lab}`;
    const old = this.subs.get(k);
    this.subs.set(k, { student_key: s.studentKey, lab: s.lab, session_id: s.sessionId, url: s.url, reviewed: old?.url === s.url ? old.reviewed : false, note: old?.note ?? '', updated_at: this.stamp() });
  }
  async hit(key: string, windowSec: number) {
    const t = this.now();
    const h = this.hits.get(key);
    const next = !h || h.until < t ? { n: 1, until: t + windowSec * 1000 } : { n: h.n + 1, until: h.until };
    this.hits.set(key, next);
    return next.n;
  }
  async count(key: string) {
    const h = this.hits.get(key);
    return h && h.until >= this.now() ? h.n : 0;
  }
  async labData(lab: string, sessionId?: string): Promise<LabData> {
    const inSession = (row: { session_id?: string }) => sessionId === undefined || row.session_id === sessionId;
    const att = this.attempts.filter((a) => a.lab === lab && inSession(a));
    const tasks = [...this.tasks.values()].filter((t) => t.lab === lab && inSession(t));
    const subs = [...this.subs.values()].filter((s) => s.lab === lab && inSession(s));
    const checkins = [...this.checkins.values()].filter((c) => c.lab === lab && inSession(c));
    const views = [...this.views.values()].filter((v) => v.lab === lab && inSession(v));
    const keys = new Set([...(sessionId ? [...this.memberships.values()].filter((m) => m.session_id === sessionId) : []), ...att, ...tasks, ...subs, ...checkins, ...views].map((r) => r.student_key));
    const groups = new Map<string, typeof att>();
    for (const a of att) groups.set(`${a.student_key}|${a.exercise}`, [...(groups.get(`${a.student_key}|${a.exercise}`) ?? []), a]);
    const best = [...groups.values()].map((g) => {
      const top = [...g].sort((a, b) => b.passed - a.passed || b.id - a.id)[0];
      const solved = g.filter((a) => a.passed === a.total).map((a) => a.created_at).sort()[0] ?? null;
      return { student_key: top.student_key, exercise: top.exercise, passed: top.passed, total: top.total, attempts: g.length, firstAt: g.map((a) => a.created_at).sort()[0], solvedAt: solved };
    });
    const done = new Map<string, number>();
    for (const t of tasks) done.set(t.student_key, (done.get(t.student_key) ?? 0) + (t.done ? 1 : 0));
    return {
      students: [...keys].map((k) => {
        const student = this.students.get(k)!;
        const member = sessionId ? this.memberships.get(`${sessionId}|${k}`) : null;
        return student ? { ...student, ...(member ? { group_name: member.group_name, session_started_at: member.joined_at } : {}) } : student;
      }).filter(Boolean),
      best,
      tasks: [...done].map(([student_key, n]) => ({ student_key, done: n })),
      submissions: subs.map(({ lab: _lab, ...s }) => s),
      checkins: checkins.map(({ student_key, at }) => ({ student_key, at })),
      views: views.map((v) => ({ student_key: v.student_key, seen: [...v.seen], active_sec: v.active_sec })),
    };
  }
  async studentData(lab: string, studentKey: string, sessionId?: string): Promise<StudentData> {
    const key = `${sessionId ?? ''}|${studentKey}|${lab}`;
    const sub = this.subs.get(key);
    const match = (row: { session_id?: string }) => sessionId === undefined || row.session_id === sessionId;
    return {
      student: this.students.get(studentKey) ?? null,
      attempts: this.attempts.filter((a) => a.lab === lab && a.student_key === studentKey && match(a)).reverse().map(({ student_key: _s, lab: _l, session_id: _q, ...a }) => a),
      tasks: [...this.tasks.values()].filter((t) => t.lab === lab && t.student_key === studentKey && match(t)).map(({ task, done }) => ({ task, done })),
      submission: sub ? { url: sub.url, reviewed: sub.reviewed, note: sub.note } : null,
      checkin: this.checkins.get(key)?.at ?? null,
      views: (() => {
        const v = this.views.get(key);
        return v ? { seen: [...v.seen], active_sec: v.active_sec } : null;
      })(),
    };
  }
  async unlock(studentKey: string) {
    const row = this.students.get(studentKey);
    if (row) row.device_key = null;
  }
  async review(studentKey: string, lab: string, reviewed: boolean, note: string, sessionId?: string) {
    const sub = this.subs.get(`${sessionId ?? ''}|${studentKey}|${lab}`);
    if (sub) Object.assign(sub, { reviewed, note });
  }
  async getSession(lab: string) {
    const now = this.now();
    return [...this.sessions.values()].filter((s) => s.lab === lab && (!s.closes_at || Date.parse(s.closes_at) > now)).sort((a, b) => b.opens_at.localeCompare(a.opens_at))[0] ?? null;
  }
  async getSessionById(id: string) { return this.sessions.get(id) ?? null; }
  async getPractice(lab: string) { return this.practice.has(lab); }
  async setPractice(lab: string, on: boolean) { if (on) this.practice.add(lab); else this.practice.delete(lab); }
  async listSessions(lab: string) { return [...this.sessions.values()].filter((s) => s.lab === lab).sort((a, b) => b.opens_at.localeCompare(a.opens_at)); }
  async createSession(lab: string, taName: string, timeSlot: string, minutes: number | null = 90) {
    const t = this.now();
    const id = `s_${t}_${++this.seq}`;
    const stamp = new Date(t).toISOString();
    const session = { id, lab, ta_name: taName, time_slot: timeSlot, opens_at: stamp, closes_at: stamp, duration_minutes: minutes };
    this.sessions.set(id, session);
    return session;
  }
  async updateSession(lab: string, sessionId: string, taName: string, timeSlot: string, minutes: number | null) {
    const session = this.sessions.get(sessionId);
    if (!session || session.lab !== lab) return null;
    const now = this.now();
    const isOpen = Date.parse(session.opens_at) <= now && (!session.closes_at || Date.parse(session.closes_at) > now);
    session.ta_name = taName;
    session.time_slot = timeSlot;
    session.duration_minutes = minutes;
    if (isOpen) session.closes_at = minutes === null ? null : new Date(Date.parse(session.opens_at) + minutes * 60_000).toISOString();
    return session;
  }
  async startSession(lab: string, sessionId: string, minutes: number | null) {
    const session = this.sessions.get(sessionId);
    if (!session || session.lab !== lab) return null;
    const t = this.now();
    session.opens_at = new Date(t).toISOString();
    session.closes_at = minutes ? new Date(t + minutes * 60_000).toISOString() : null;
    session.duration_minutes = minutes;
    return session;
  }
  async deleteSession(lab: string, sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session || session.lab !== lab) return false;
    this.sessions.delete(sessionId);
    this.memberships.forEach((value, key) => { if (value.session_id === sessionId) this.memberships.delete(key); });
    this.attempts = this.attempts.filter((row) => row.session_id !== sessionId);
    this.tasks.forEach((row, key) => { if (row.session_id === sessionId) this.tasks.delete(key); });
    this.subs.forEach((row, key) => { if (row.session_id === sessionId) this.subs.delete(key); });
    this.checkins.forEach((row, key) => { if (row.session_id === sessionId) this.checkins.delete(key); });
    this.views.forEach((row, key) => { if (row.session_id === sessionId) this.views.delete(key); });
    return true;
  }
  async openSession(lab: string, minutes: number | null, taName = 'TA', timeSlot = 'Unspecified') {
    const session = await this.createSession(lab, taName, timeSlot, minutes);
    return (await this.startSession(lab, session.id, minutes))!;
  }
  async closeSession(lab: string, sessionId?: string) {
    const s = sessionId ? this.sessions.get(sessionId) : await this.getSession(lab);
    if (s) s.closes_at = this.stamp();
  }
  async checkIn(studentKey: string, lab: string, sessionId?: string) {
    const k = `${sessionId ?? ''}|${studentKey}|${lab}`;
    if (!this.checkins.has(k)) this.checkins.set(k, { student_key: studentKey, lab, session_id: sessionId, at: this.stamp() });
    return this.checkins.get(k)!.at;
  }
  async addViews(studentKey: string, lab: string, seen: string[], activeSec: number, sessionId?: string) {
    const k = `${sessionId ?? ''}|${studentKey}|${lab}`;
    const v = this.views.get(k) ?? { student_key: studentKey, lab, session_id: sessionId, seen: new Set<string>(), active_sec: 0 };
    seen.forEach((n) => v.seen.add(n));
    v.active_sec += activeSec;
    this.views.set(k, v);
    this.acted.set(`${sessionId ?? ''}|${studentKey}`, this.stamp());
  }
  async statsRaw(labs: string[]): Promise<StatsRaw> {
    const sessions = [...this.sessions.values()].filter((x) => labs.includes(x.lab));
    const labOf = new Map(sessions.map((x) => [x.id, x.lab]));
    const members = [...this.memberships.values()].filter((m) => labOf.has(m.session_id));
    const att = this.attempts.filter((a) => a.session_id && labOf.has(a.session_id));
    const groups = new Map<string, typeof att>();
    for (const a of att) groups.set(`${a.lab}|${a.student_key}|${a.exercise}`, [...(groups.get(`${a.lab}|${a.student_key}|${a.exercise}`) ?? []), a]);
    const done = new Map<string, Set<string>>();
    for (const t of this.tasks.values()) if (t.done && t.session_id && labOf.has(t.session_id)) done.set(`${t.lab}|${t.student_key}`, (done.get(`${t.lab}|${t.student_key}`) ?? new Set()).add(t.task));
    const heat = new Map<string, number>();
    for (const a of att) {
      const d = new Date(Date.parse(a.created_at) + 3 * 3600_000); // Cairo (UTC+3 in the teaching term)
      const k = `${d.getUTCDay()}|${d.getUTCHours()}`;
      heat.set(k, (heat.get(k) ?? 0) + 1);
    }
    return {
      sessions: sessions.map((x) => ({ id: x.id, lab: x.lab, ta_name: x.ta_name, time_slot: x.time_slot, opens_at: x.opens_at,
        joined: members.filter((m) => m.session_id === x.id).length,
        attended: [...this.checkins.values()].filter((c) => c.session_id === x.id).length })),
      best: [...groups.values()].map((g) => {
        const top = [...g].sort((a, b) => b.passed - a.passed || b.id - a.id)[0];
        return { lab: top.lab, student_key: top.student_key, exercise: top.exercise, passed: top.passed, total: top.total, attempts: g.length, first_ok: g[0].passed >= g[0].total };
      }),
      tasks: [...done].map(([k, set]) => ({ lab: k.split('|')[0], student_key: k.split('|')[1], done: set.size })),
      subs: [...this.subs.values()].filter((x) => x.session_id && labOf.has(x.session_id)).map((x) => ({ lab: x.lab, student_key: x.student_key })),
      members: [...new Map([...members].sort((a, b) => a.joined_at.localeCompare(b.joined_at)).map((m) => [`${labOf.get(m.session_id)}|${m.student_key}`, { lab: labOf.get(m.session_id)!, student_key: m.student_key, group_name: m.group_name }])).values()],
      heat: [...heat].map(([k, n]) => ({ dow: Number(k.split('|')[0]), hour: Number(k.split('|')[1]), n })),
    };
  }
  async activity(sessionId: string, limit = 40): Promise<Activity> {
    const att = this.attempts.filter((a) => a.session_id === sessionId);
    const latest = new Map<string, (typeof att)[number]>();
    for (const a of att) latest.set(a.student_key, a);
    const last = [...latest.values()].map((l) => {
      const mine = att.filter((a) => a.student_key === l.student_key && a.exercise === l.exercise);
      const lastPass = Math.max(0, ...mine.filter((a) => a.passed >= a.total).map((a) => a.id));
      return { student_key: l.student_key, exercise: l.exercise, passed: l.passed, total: l.total, at: l.created_at, fails: mine.filter((a) => a.id > lastPass && a.passed < a.total).length };
    });
    const active = [...this.memberships.values()].filter((m) => m.session_id === sessionId)
      .map((m) => ({ student_key: m.student_key, at: this.acted.get(`${sessionId}|${m.student_key}`) ?? m.joined_at }));
    const events = [
      ...att.map((a) => ({ student_key: a.student_key, kind: 'check' as const, ref: a.exercise, passed: a.passed, total: a.total, at: a.created_at, n: a.id })),
      ...this.taskLog.filter((t) => t.session_id === sessionId).map((t) => ({ student_key: t.student_key, kind: 'task' as const, ref: t.task, passed: 1, total: 1, at: t.at, n: t.n })),
    ].sort((a, b) => b.at.localeCompare(a.at) || b.n - a.n).slice(0, limit).map(({ n: _n, ...e }) => e);
    return { last, active, events };
  }
}

/* -------------------------------------------------------------------- neon */


type Prefix = 'progress' | 'progress_dev';

export class NeonStore implements ProgressStore {
  private run: (text: string, params?: unknown[]) => Promise<any[]>;
  private ready: Promise<void> | null = null;
  private t: { students: string; attempts: string; tasks: string; subs: string; hits: string; checkins: string; sessions: string; views: string; settings: string };
  private v2: { sessions: string; members: string; attempts: string; tasks: string; subs: string; checkins: string; views: string };

  constructor(url: string, prefix: Prefix, driver: 'neon' | 'postgres' = 'neon') {
    if (driver === 'postgres') {
      const pool = new Pool({ connectionString: url, allowExitOnIdle: true });
      this.run = async (text, params = []) => (await pool.query(text, params)).rows;
    } else {
      const sql = neon(url);
      this.run = async (text, params = []) => (await sql.query(text, params)) as any[];
    }
    this.t = {
      students: `${prefix}_students`, attempts: `${prefix}_attempts`, tasks: `${prefix}_tasks`, subs: `${prefix}_submissions`, hits: `${prefix}_hits`,
      checkins: `${prefix}_checkins`, sessions: `${prefix}_sessions`, views: `${prefix}_views`, settings: `${prefix}_lab_settings`,
    };
    this.v2 = {
      sessions: `${prefix}_class_sessions`, members: `${prefix}_session_students`, attempts: `${prefix}_session_attempts`,
      tasks: `${prefix}_session_tasks`, subs: `${prefix}_session_submissions`, checkins: `${prefix}_session_checkins`, views: `${prefix}_session_views`,
    };
  }

  private async q<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
    await (this.ready ??= this.migrate());
    return (await this.run(text, params)) as T[];
  }

  /** Tables are created on first use (idempotent), so there is no SQL to run by hand. */
  private async migrate() {
    const { students, attempts, tasks, subs, hits } = this.t;
    const statements = [
      `create table if not exists ${students} (
        student_key text primary key, student_id text not null, name text not null, device_key text,
        created_at timestamptz not null default now(), last_seen timestamptz not null default now())`,
      // Students may use any device (shared lab PCs included), so one browser is no longer tied to one ID.
      `drop index if exists ${students}_one_device`,
      `create table if not exists ${attempts} (
        id bigint generated always as identity primary key,
        student_key text not null references ${students}(student_key) on delete cascade,
        lab text not null, exercise text not null, passed int not null, total int not null, code text not null,
        created_at timestamptz not null default now())`,
      `create index if not exists ${attempts}_lab on ${attempts} (lab, student_key, exercise)`,
      `create table if not exists ${tasks} (
        student_key text not null references ${students}(student_key) on delete cascade,
        lab text not null, task text not null, done boolean not null, updated_at timestamptz not null default now(),
        primary key (student_key, lab, task))`,
      `create table if not exists ${subs} (
        student_key text not null references ${students}(student_key) on delete cascade,
        lab text not null, url text not null, reviewed boolean not null default false, note text not null default '',
        updated_at timestamptz not null default now(), primary key (student_key, lab))`,
      `create table if not exists ${hits} (key text primary key, n int not null, until timestamptz not null)`,
      `create table if not exists ${this.t.checkins} (
        student_key text not null references ${students}(student_key) on delete cascade,
        lab text not null, at timestamptz not null default now(), primary key (student_key, lab))`,
      `create table if not exists ${this.t.sessions} (lab text primary key, opens_at timestamptz not null, closes_at timestamptz)`,
      `create table if not exists ${this.t.views} (
        student_key text not null references ${students}(student_key) on delete cascade,
        lab text not null, seen text[] not null default '{}', active_sec int not null default 0,
        updated_at timestamptz not null default now(), primary key (student_key, lab))`,
      `create table if not exists ${this.v2.sessions} (
        id text primary key, lab text not null, ta_name text not null, time_slot text not null,
        opens_at timestamptz not null default now(), closes_at timestamptz, duration_minutes int)`,
      `alter table ${this.v2.sessions} add column if not exists duration_minutes int`,
      `create index if not exists ${this.v2.sessions}_lab on ${this.v2.sessions} (lab, opens_at desc)`,
      `drop index if exists ${this.v2.sessions}_one_open`,
      `create table if not exists ${this.v2.members} (
        session_id text not null references ${this.v2.sessions}(id) on delete cascade,
        student_key text not null references ${students}(student_key) on delete cascade,
        group_name text not null, joined_at timestamptz not null default now(), primary key (session_id, student_key))`,
      `create table if not exists ${this.v2.attempts} (
        id bigint generated always as identity primary key, session_id text not null references ${this.v2.sessions}(id) on delete cascade,
        student_key text not null references ${students}(student_key) on delete cascade,
        lab text not null, exercise text not null, passed int not null, total int not null, code text not null, created_at timestamptz not null default now())`,
      `create index if not exists ${this.v2.attempts}_session on ${this.v2.attempts} (session_id, student_key, exercise)`,
      `create table if not exists ${this.v2.tasks} (
        session_id text not null references ${this.v2.sessions}(id) on delete cascade, student_key text not null references ${students}(student_key) on delete cascade,
        lab text not null, task text not null, done boolean not null, updated_at timestamptz not null default now(), primary key (session_id, student_key, task))`,
      `create table if not exists ${this.v2.subs} (
        session_id text not null references ${this.v2.sessions}(id) on delete cascade, student_key text not null references ${students}(student_key) on delete cascade,
        lab text not null, url text not null, reviewed boolean not null default false, note text not null default '', updated_at timestamptz not null default now(), primary key (session_id, student_key))`,
      `create table if not exists ${this.v2.checkins} (
        session_id text not null references ${this.v2.sessions}(id) on delete cascade, student_key text not null references ${students}(student_key) on delete cascade,
        lab text not null, at timestamptz not null default now(), primary key (session_id, student_key))`,
      `create table if not exists ${this.v2.views} (
        session_id text not null references ${this.v2.sessions}(id) on delete cascade, student_key text not null references ${students}(student_key) on delete cascade,
        lab text not null, seen text[] not null default '{}', active_sec int not null default 0, updated_at timestamptz not null default now(), primary key (session_id, student_key))`,
      `create table if not exists ${this.t.settings} (lab text primary key, practice boolean not null default false, updated_at timestamptz not null default now())`,
    ];
    try {
      for (const s of statements) await this.run(s);
    } catch (e) {
      this.ready = null; // try again on the next request
      throw e;
    }
  }

  async touchStudent(i: Identity & { studentKey: string }) {
    // No locks: any device, and the name typed last is the one kept (students fix typos by typing again).
    await this.q(
      `insert into ${this.t.students} (student_key, student_id, name, device_key) values ($1, $2, $3, $4)
       on conflict (student_key) do update set name = excluded.name, student_id = excluded.student_id, device_key = excluded.device_key, last_seen = now()`,
      [i.studentKey, i.studentId, i.name, i.deviceKey],
    );
    return 'ok' as const;
  }

  async joinSession(sessionId: string, studentKey: string, group: string) {
    await this.q(
      `insert into ${this.v2.members} (session_id, student_key, group_name) values ($1, $2, $3)
       on conflict (session_id, student_key) do update set group_name = excluded.group_name`,
      [sessionId, studentKey, group],
    );
  }

  async isSessionStudent(sessionId: string, studentKey: string) {
    const rows = await this.q(`select 1 from ${this.v2.members} where session_id = $1 and student_key = $2`, [sessionId, studentKey]);
    return rows.length > 0;
  }

  async addAttempt(a: { studentKey: string; lab: string; exercise: string; passed: number; total: number; code: string; sessionId?: string }) {
    if (a.sessionId) {
      await this.q(`insert into ${this.v2.attempts} (session_id, student_key, lab, exercise, passed, total, code) values ($1, $2, $3, $4, $5, $6, $7)`, [a.sessionId, a.studentKey, a.lab, a.exercise, a.passed, a.total, a.code]);
      return;
    }
    await this.q(`insert into ${this.t.attempts} (student_key, lab, exercise, passed, total, code) values ($1, $2, $3, $4, $5, $6)`, [a.studentKey, a.lab, a.exercise, a.passed, a.total, a.code]);
  }

  async setTask(t: { studentKey: string; lab: string; task: string; done: boolean; sessionId?: string }) {
    if (t.sessionId) {
      await this.q(`insert into ${this.v2.tasks} (session_id, student_key, lab, task, done) values ($1, $2, $3, $4, $5)
        on conflict (session_id, student_key, task) do update set done = excluded.done, updated_at = now()`, [t.sessionId, t.studentKey, t.lab, t.task, t.done]);
      return;
    }
    await this.q(
      `insert into ${this.t.tasks} (student_key, lab, task, done) values ($1, $2, $3, $4)
       on conflict (student_key, lab, task) do update set done = excluded.done, updated_at = now()`,
      [t.studentKey, t.lab, t.task, t.done],
    );
  }

  async setSubmission(s: { studentKey: string; lab: string; url: string; sessionId?: string }) {
    if (s.sessionId) {
      await this.q(`insert into ${this.v2.subs} as p (session_id, student_key, lab, url) values ($1, $2, $3, $4)
        on conflict (session_id, student_key) do update set url = excluded.url, updated_at = now(), reviewed = case when p.url = excluded.url then p.reviewed else false end`, [s.sessionId, s.studentKey, s.lab, s.url]);
      return;
    }
    const subs = this.t.subs;
    await this.q(
      `insert into ${subs} as p (student_key, lab, url) values ($1, $2, $3)
       on conflict (student_key, lab) do update set url = excluded.url, updated_at = now(),
         reviewed = case when p.url = excluded.url then p.reviewed else false end`,
      [s.studentKey, s.lab, s.url],
    );
  }

  async hit(key: string, windowSec: number) {
    const [row] = await this.q<{ n: number }>(
      `insert into ${this.t.hits} as h (key, n, until) values ($1, 1, now() + make_interval(secs => $2::double precision))
       on conflict (key) do update set
         n = case when h.until < now() then 1 else h.n + 1 end,
         until = case when h.until < now() then now() + make_interval(secs => $2::double precision) else h.until end
       returning n`,
      [key, windowSec],
    );
    return Number(row?.n ?? 0);
  }

  async count(key: string) {
    const [row] = await this.q<{ n: number }>(`select n from ${this.t.hits} where key = $1 and until >= now()`, [key]);
    return Number(row?.n ?? 0);
  }

  async labData(lab: string, sessionId?: string): Promise<LabData> {
    if (sessionId) {
      const v = this.v2;
      const [studentRows, best, taskRows, subRows, checkinRows, viewRows] = await Promise.all([
        this.q(`select s.*, m.group_name, m.joined_at as session_started_at from ${this.t.students} s join ${v.members} m on m.student_key = s.student_key where m.session_id = $1`, [sessionId]),
        this.q(`select student_key, exercise, max(passed) as passed, count(*)::int as attempts, min(created_at) as first_at,
          min(created_at) filter (where passed = total) as solved_at, (array_agg(total order by passed desc, created_at desc))[1] as total
          from ${v.attempts} where session_id = $1 group by student_key, exercise`, [sessionId]),
        this.q(`select student_key, (count(*) filter (where done))::int as done from ${v.tasks} where session_id = $1 group by student_key`, [sessionId]),
        this.q(`select student_key, url, reviewed, note, updated_at from ${v.subs} where session_id = $1`, [sessionId]),
        this.q(`select student_key, at from ${v.checkins} where session_id = $1`, [sessionId]),
        this.q(`select student_key, seen, active_sec from ${v.views} where session_id = $1`, [sessionId]),
      ]);
      return {
        checkins: checkinRows.map((r) => ({ student_key: r.student_key, at: iso(r.at)! })),
        views: viewRows.map((r) => ({ student_key: r.student_key, seen: r.seen ?? [], active_sec: Number(r.active_sec) })),
        students: studentRows.map((r) => ({ ...r, created_at: iso(r.created_at)!, last_seen: iso(r.last_seen)!, session_started_at: iso(r.session_started_at) ?? undefined })),
        best: best.map((r) => ({ student_key: r.student_key, exercise: r.exercise, passed: Number(r.passed), total: Number(r.total), attempts: Number(r.attempts), firstAt: iso(r.first_at)!, solvedAt: iso(r.solved_at) })),
        tasks: taskRows.map((r) => ({ student_key: r.student_key, done: Number(r.done) })),
        submissions: subRows.map((r) => ({ ...r, updated_at: iso(r.updated_at)! })),
      };
    }
    const { students, attempts, tasks, subs, checkins, views } = this.t;
    const [studentRows, best, taskRows, subRows, checkinRows, viewRows] = await Promise.all([
      this.q(
        `select * from ${students} where student_key in (
           select student_key from ${attempts} where lab = $1
           union select student_key from ${tasks} where lab = $1
           union select student_key from ${subs} where lab = $1
           union select student_key from ${checkins} where lab = $1
           union select student_key from ${views} where lab = $1)`,
        [lab],
      ),
      this.q(
        `select student_key, exercise, max(passed) as passed, count(*)::int as attempts,
                min(created_at) as first_at,
                min(created_at) filter (where passed = total) as solved_at,
                (array_agg(total order by passed desc, created_at desc))[1] as total
         from ${attempts} where lab = $1 group by student_key, exercise`,
        [lab],
      ),
      this.q(`select student_key, (count(*) filter (where done))::int as done from ${tasks} where lab = $1 group by student_key`, [lab]),
      this.q(`select student_key, url, reviewed, note, updated_at from ${subs} where lab = $1`, [lab]),
      this.q(`select student_key, at from ${checkins} where lab = $1`, [lab]),
      this.q(`select student_key, seen, active_sec from ${views} where lab = $1`, [lab]),
    ]);
    return {
      checkins: checkinRows.map((r) => ({ student_key: r.student_key, at: iso(r.at)! })),
      views: viewRows.map((r) => ({ student_key: r.student_key, seen: r.seen ?? [], active_sec: Number(r.active_sec) })),
      students: studentRows.map((r) => ({ ...r, created_at: iso(r.created_at)!, last_seen: iso(r.last_seen)! })),
      best: best.map((r) => ({
        student_key: r.student_key, exercise: r.exercise, passed: Number(r.passed), total: Number(r.total),
        attempts: Number(r.attempts), firstAt: iso(r.first_at)!, solvedAt: iso(r.solved_at),
      })),
      tasks: taskRows.map((r) => ({ student_key: r.student_key, done: Number(r.done) })),
      submissions: subRows.map((r) => ({ ...r, updated_at: iso(r.updated_at)! })),
    };
  }

  async statsRaw(labs: string[]): Promise<StatsRaw> {
    const v = this.v2;
    const [sessions, best, tasks, subs, members, heat] = await Promise.all([
      this.q(`select s.id, s.lab, s.ta_name, s.time_slot, s.opens_at,
                (select count(*) from ${v.members} m where m.session_id = s.id)::int as joined,
                (select count(*) from ${v.checkins} c where c.session_id = s.id)::int as attended
              from ${v.sessions} s where s.lab = any($1)`, [labs]),
      this.q(`select lab, student_key, exercise, max(passed) as passed, (array_agg(total order by passed desc, id desc))[1] as total,
                count(*)::int as attempts, (array_agg(passed >= total order by id))[1] as first_ok
              from ${v.attempts} where lab = any($1) group by lab, student_key, exercise`, [labs]),
      this.q(`select lab, student_key, (count(distinct task) filter (where done))::int as done from ${v.tasks} where lab = any($1) group by lab, student_key`, [labs]),
      this.q(`select distinct lab, student_key from ${v.subs} where lab = any($1)`, [labs]),
      this.q(`select distinct on (s.lab, m.student_key) s.lab, m.student_key, m.group_name
              from ${v.members} m join ${v.sessions} s on s.id = m.session_id where s.lab = any($1)
              order by s.lab, m.student_key, m.joined_at desc`, [labs]),
      this.q(`select extract(dow from created_at at time zone 'Africa/Cairo')::int as dow, extract(hour from created_at at time zone 'Africa/Cairo')::int as hour, count(*)::int as n
              from ${v.attempts} where lab = any($1) group by 1, 2`, [labs]),
    ]);
    return {
      sessions: sessions.map((r) => ({ id: r.id, lab: r.lab, ta_name: r.ta_name, time_slot: r.time_slot, opens_at: iso(r.opens_at)!, joined: Number(r.joined), attended: Number(r.attended) })),
      best: best.map((r) => ({ lab: r.lab, student_key: r.student_key, exercise: r.exercise, passed: Number(r.passed), total: Number(r.total), attempts: Number(r.attempts), first_ok: Boolean(r.first_ok) })),
      tasks: tasks.map((r) => ({ lab: r.lab, student_key: r.student_key, done: Number(r.done) })),
      subs: subs.map((r) => ({ lab: r.lab, student_key: r.student_key })),
      members: members.map((r) => ({ lab: r.lab, student_key: r.student_key, group_name: r.group_name })),
      heat: heat.map((r) => ({ dow: Number(r.dow), hour: Number(r.hour), n: Number(r.n) })),
    };
  }

  async activity(sessionId: string, limit = 40): Promise<Activity> {
    const v = this.v2;
    const [last, active, events] = await Promise.all([
      this.q(`with l as (select distinct on (student_key) id, student_key, exercise, passed, total, created_at from ${v.attempts}
                where session_id = $1 order by student_key, id desc)
              select l.student_key, l.exercise, l.passed, l.total, l.created_at,
                (select count(*) from ${v.attempts} a where a.session_id = $1 and a.student_key = l.student_key and a.exercise = l.exercise and a.passed < a.total
                   and a.id > coalesce((select max(b.id) from ${v.attempts} b where b.session_id = $1 and b.student_key = l.student_key and b.exercise = l.exercise and b.passed >= b.total), 0))::int as fails
              from l`, [sessionId]),
      this.q(`select m.student_key, greatest(m.joined_at,
                (select max(created_at) from ${v.attempts} a where a.session_id = $1 and a.student_key = m.student_key),
                (select max(updated_at) from ${v.tasks} t where t.session_id = $1 and t.student_key = m.student_key),
                (select updated_at from ${v.views} w where w.session_id = $1 and w.student_key = m.student_key)) as at
              from ${v.members} m where m.session_id = $1`, [sessionId]),
      this.q(`(select student_key, 'check' as kind, exercise as ref, passed, total, created_at as at from ${v.attempts} where session_id = $1 order by id desc limit $2)
              union all
              (select student_key, 'task' as kind, task as ref, 1, 1, updated_at as at from ${v.tasks} where session_id = $1 and done order by updated_at desc limit $2)
              order by at desc limit $2`, [sessionId, limit]),
    ]);
    return {
      last: last.map((r) => ({ student_key: r.student_key, exercise: r.exercise, passed: Number(r.passed), total: Number(r.total), at: iso(r.created_at)!, fails: Number(r.fails) })),
      active: active.map((r) => ({ student_key: r.student_key, at: iso(r.at)! })),
      events: events.map((r) => ({ student_key: r.student_key, kind: r.kind, ref: r.ref, passed: Number(r.passed), total: Number(r.total), at: iso(r.at)! })),
    };
  }

  async studentData(lab: string, studentKey: string, sessionId?: string): Promise<StudentData> {
    if (sessionId) {
      const v = this.v2;
      const [[student], attemptRows, taskRows, [sub], [checkin], [view]] = await Promise.all([
        this.q(`select s.* from ${this.t.students} s join ${v.members} m on m.student_key = s.student_key where m.session_id = $1 and s.student_key = $2`, [sessionId, studentKey]),
        this.q(`select id, exercise, passed, total, code, created_at from ${v.attempts} where session_id = $1 and student_key = $2 order by id desc limit 500`, [sessionId, studentKey]),
        this.q(`select task, done from ${v.tasks} where session_id = $1 and student_key = $2`, [sessionId, studentKey]),
        this.q(`select url, reviewed, note from ${v.subs} where session_id = $1 and student_key = $2`, [sessionId, studentKey]),
        this.q(`select at from ${v.checkins} where session_id = $1 and student_key = $2`, [sessionId, studentKey]),
        this.q(`select seen, active_sec from ${v.views} where session_id = $1 and student_key = $2`, [sessionId, studentKey]),
      ]);
      return {
        student: student ? { ...student, created_at: iso(student.created_at)!, last_seen: iso(student.last_seen)! } : null,
        attempts: attemptRows.map((r) => ({ ...r, id: Number(r.id), created_at: iso(r.created_at)! })), tasks: taskRows,
        submission: sub ?? null, checkin: checkin ? iso(checkin.at) : null,
        views: view ? { seen: view.seen ?? [], active_sec: Number(view.active_sec) } : null,
      };
    }
    const { students, attempts, tasks, subs, checkins, views } = this.t;
    const [[student], attemptRows, taskRows, [sub], [checkin], [view]] = await Promise.all([
      this.q(`select * from ${students} where student_key = $1`, [studentKey]),
      this.q(`select id, exercise, passed, total, code, created_at from ${attempts} where lab = $1 and student_key = $2 order by id desc limit 500`, [lab, studentKey]),
      this.q(`select task, done from ${tasks} where lab = $1 and student_key = $2`, [lab, studentKey]),
      this.q(`select url, reviewed, note from ${subs} where lab = $1 and student_key = $2`, [lab, studentKey]),
      this.q(`select at from ${checkins} where lab = $1 and student_key = $2`, [lab, studentKey]),
      this.q(`select seen, active_sec from ${views} where lab = $1 and student_key = $2`, [lab, studentKey]),
    ]);
    return {
      student: student ? { ...student, created_at: iso(student.created_at)!, last_seen: iso(student.last_seen)! } : null,
      attempts: attemptRows.map((r) => ({ ...r, id: Number(r.id), created_at: iso(r.created_at)! })),
      tasks: taskRows,
      submission: sub ?? null,
      checkin: checkin ? iso(checkin.at) : null,
      views: view ? { seen: view.seen ?? [], active_sec: Number(view.active_sec) } : null,
    };
  }

  private sessionRow(row: any): Session {
    return { id: row.id, lab: row.lab, ta_name: row.ta_name, time_slot: row.time_slot, opens_at: iso(row.opens_at)!, closes_at: iso(row.closes_at), duration_minutes: row.duration_minutes == null ? null : Number(row.duration_minutes) };
  }
  async addManualAttendance(lab: string, sessionId: string, student: { studentKey: string; studentId: string; name: string }) {
    // One statement makes identity, membership and attendance atomic. Staff are
    // trusted, so the ID decides even when the typed name differs. Existing names,
    // device bindings, groups and attendance timestamps are preserved.
    const [row] = await this.q(`with identity as (
      insert into ${this.t.students} as s (student_key, student_id, name)
      select $3, $4, $5 where exists (select 1 from ${this.v2.sessions} where id = $2 and lab = $1)
      on conflict (student_key) do update set student_id = s.student_id
      returning student_key
    ), membership as (
      insert into ${this.v2.members} (session_id, student_key, group_name)
      select $2, student_key, '' from identity
      on conflict (session_id, student_key) do nothing
    )
    insert into ${this.v2.checkins} as c (session_id, student_key, lab)
    select $2, student_key, $1 from identity
    on conflict (session_id, student_key) do update set at = c.at returning at`,
    [lab, sessionId, student.studentKey, student.studentId, student.name]);
    return row ? iso(row.at)! : null;
  }
  async getSession(lab: string) {
    const [row] = await this.q(`select * from ${this.v2.sessions} where lab = $1 and (closes_at is null or closes_at > now()) order by opens_at desc limit 1`, [lab]);
    return row ? this.sessionRow(row) : null;
  }
  async getSessionById(id: string) {
    const [row] = await this.q(`select * from ${this.v2.sessions} where id = $1`, [id]);
    return row ? this.sessionRow(row) : null;
  }
  async getPractice(lab: string) {
    const [row] = await this.q<{ practice: boolean }>(`select practice from ${this.t.settings} where lab = $1`, [lab]);
    return Boolean(row?.practice);
  }
  async setPractice(lab: string, on: boolean) {
    await this.q(`insert into ${this.t.settings} (lab, practice) values ($1, $2)
      on conflict (lab) do update set practice = excluded.practice, updated_at = now()`, [lab, on]);
  }
  async listSessions(lab: string) {
    const rows = await this.q(`select * from ${this.v2.sessions} where lab = $1 order by opens_at desc limit 200`, [lab]);
    return rows.map((row) => this.sessionRow(row));
  }
  async createSession(lab: string, taName: string, timeSlot: string, minutes: number | null = 90) {
    const id = `s_${Date.now().toString(36)}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const [row] = await this.q(`insert into ${this.v2.sessions} (id, lab, ta_name, time_slot, opens_at, closes_at, duration_minutes)
      values ($1, $2, $3, $4, now(), now(), $5) returning *`, [id, lab, taName, timeSlot, minutes]);
    return this.sessionRow(row);
  }
  async updateSession(lab: string, sessionId: string, taName: string, timeSlot: string, minutes: number | null) {
    const [row] = await this.q(`update ${this.v2.sessions}
      set ta_name = $3,
          time_slot = $4,
          duration_minutes = $5,
          closes_at = case
            when opens_at <= now() and (closes_at is null or closes_at > now())
              then case when $5::int is null then null else opens_at + make_interval(mins => $5::int) end
            else closes_at
          end
      where lab = $1 and id = $2 returning *`, [lab, sessionId, taName, timeSlot, minutes]);
    return row ? this.sessionRow(row) : null;
  }
  async startSession(lab: string, sessionId: string, minutes: number | null) {
    const [row] = await this.q(`update ${this.v2.sessions} set opens_at = now(), closes_at = case when $3::int is null then null else now() + make_interval(mins => $3::int) end, duration_minutes = $3 where lab = $1 and id = $2 returning *`, [lab, sessionId, minutes]);
    return row ? this.sessionRow(row) : null;
  }
  async deleteSession(lab: string, sessionId: string) {
    const rows = await this.q(`delete from ${this.v2.sessions} where lab = $1 and id = $2 returning id`, [lab, sessionId]);
    return rows.length > 0;
  }
  async openSession(lab: string, minutes: number | null, taName = 'TA', timeSlot = 'Unspecified') {
    const session = await this.createSession(lab, taName, timeSlot, minutes);
    return (await this.startSession(lab, session.id, minutes))!;
  }
  async closeSession(lab: string, sessionId?: string) {
    await this.q(`update ${this.v2.sessions} set closes_at = now() where lab = $1 and ($2::text is null or id = $2) and (closes_at is null or closes_at > now())`, [lab, sessionId ?? null]);
  }

  async checkIn(studentKey: string, lab: string, sessionId?: string) {
    if (sessionId) {
      const [row] = await this.q(`insert into ${this.v2.checkins} as c (session_id, student_key, lab) values ($1, $2, $3)
        on conflict (session_id, student_key) do update set at = c.at returning at`, [sessionId, studentKey, lab]);
      return iso(row.at)!;
    }
    const [row] = await this.q(
      `insert into ${this.t.checkins} as c (student_key, lab) values ($1, $2)
       on conflict (student_key, lab) do update set at = c.at returning at`,
      [studentKey, lab],
    );
    return iso(row.at)!;
  }

  async addViews(studentKey: string, lab: string, seen: string[], activeSec: number, sessionId?: string) {
    if (sessionId) {
      await this.q(`insert into ${this.v2.views} as v (session_id, student_key, lab, seen, active_sec) values ($1, $2, $3, $4::text[], $5)
        on conflict (session_id, student_key) do update set seen = array(select distinct unnest(v.seen || excluded.seen)), active_sec = v.active_sec + excluded.active_sec, updated_at = now()`, [sessionId, studentKey, lab, seen, activeSec]);
      return;
    }
    const views = this.t.views;
    await this.q(
      `insert into ${views} as v (student_key, lab, seen, active_sec) values ($1, $2, $3::text[], $4)
       on conflict (student_key, lab) do update set
         seen = array(select distinct unnest(v.seen || excluded.seen)),
         active_sec = v.active_sec + excluded.active_sec,
         updated_at = now()`,
      [studentKey, lab, seen, activeSec],
    );
  }

  async unlock(studentKey: string) {
    await this.q(`update ${this.t.students} set device_key = null where student_key = $1`, [studentKey]);
  }

  async review(studentKey: string, lab: string, reviewed: boolean, note: string, sessionId?: string) {
    if (sessionId) {
      await this.q(`update ${this.v2.subs} set reviewed = $3, note = $4 where student_key = $1 and session_id = $2`, [studentKey, sessionId, reviewed, note]);
      return;
    }
    await this.q(`update ${this.t.subs} set reviewed = $3, note = $4 where student_key = $1 and lab = $2`, [studentKey, lab, reviewed, note]);
  }
}
