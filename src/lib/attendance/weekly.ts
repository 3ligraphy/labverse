/**
 * WEEKLY ATTENDANCE & WARNINGS — pure rules (no framework imports; tested in tests/attendance-weekly.test.ts).
 *
 * The register of one module is built from its lab sessions and check-ins:
 *  - Weeks run Saturday → Friday in Cairo time. A week is a teaching week when a TA session was opened in it,
 *    or when anyone checked in during it (with sessions off — ALWAYS_OPEN — each lab has one permanent
 *    "Open lab" session whose open date says nothing about when classes ran, so check-in times decide).
 *    Weeks are numbered from the module's first teaching week.
 *  - A student is present in a week when they checked in (to any session of the module), or joined a TA
 *    session, during that week. Joining the permanent "Open lab" session does not count.
 *  - The roster is everyone who joined or checked in to at least one session of the module.
 *  - An absence only counts once the week is over (until then the student may still attend another slot);
 *    staff may excuse an absence, and excused absences never count.
 *  - Absences → warnings: 2 = Warning 1, 3 = Warning 2, 4 or more = Barred.
 */
import type { AttendanceRaw, Excuse, Session } from '../progress/store.ts';
import { OPEN_LAB } from '../progress/mode.ts';

/** The permanent session of a lab while sessions are off (never closes, opened when first used). */
export const isPermanentSession = (s: Pick<Session, 'ta_name' | 'closes_at'>) => s.ta_name === OPEN_LAB.ta && s.closes_at === null;

export const TIME_ZONE = 'Africa/Cairo';
const DAY = 86_400_000;

/** Absences needed for each level; level n is reached at WARNING_AT[n - 1] absences. */
export const WARNING_AT = [2, 3, 4] as const;
export const LEVEL_LABELS = ['Good standing', 'Warning 1', 'Warning 2', 'Barred'] as const;
export type Level = 0 | 1 | 2 | 3;

export function levelFor(absences: number): Level {
  let level = 0;
  WARNING_AT.forEach((at, i) => { if (absences >= at) level = i + 1; });
  return level as Level;
}

/* ------------------------------------------------------------------ dates */

const ymdFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** The Cairo calendar date of an instant, as YYYY-MM-DD. */
export function cairoDate(iso: string | number | Date): string {
  return ymdFormat.format(new Date(iso));
}

const addDays = (ymd: string, days: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

/** The Saturday (YYYY-MM-DD) that starts the Cairo week of this instant: the week's key. */
export function weekKey(iso: string | number | Date): string {
  const ymd = cairoDate(iso);
  const dow = new Date(`${ymd}T00:00:00Z`).getUTCDay(); // 0 Sunday … 6 Saturday
  return addDays(ymd, -((dow + 1) % 7));
}

/** The instant a week (by key) ends: the next Saturday at 00:00 Cairo time. */
export function weekEnd(key: string): number {
  const next = addDays(key, 7);
  // Cairo is UTC+2 or UTC+3; find the offset that day by formatting noon UTC.
  const noon = Date.parse(`${next}T12:00:00Z`);
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', hourCycle: 'h23' }).format(noon));
  return Date.parse(`${next}T00:00:00Z`) - (hour - 12) * 3_600_000;
}

const shortDay = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "12 Oct – 18 Oct" */
export const weekRange = (key: string) => `${shortDay(key)} – ${shortDay(addDays(key, 6))}`;

/** A session counts once it was really opened (created-but-never-started sessions close the instant they are made). */
export const wasOpened = (s: Session) => !s.closes_at || Date.parse(s.closes_at) > Date.parse(s.opens_at);

/* ---------------------------------------------------------------- register */

export type CellStatus = 'present' | 'absent' | 'excused' | 'pending';
export type Cell = { status: CellStatus; sessionId?: string; at?: string; note?: string; by?: string };
export type WeekInfo = {
  key: string;
  number: number;
  label: string;
  range: string;
  over: boolean;
  sessions: { id: string; lab: string; labTitle: string; ta: string; slot: string; opensAt: string; closesAt: string | null; checkedIn: number }[];
  present: number;
};
export type RegisterStudent = {
  key: string;
  id: string;
  name: string;
  group: string;
  cells: Record<string, Cell>;
  attended: number;
  absences: number;
  excused: number;
  level: Level;
  status: (typeof LEVEL_LABELS)[number];
};
export type Register = {
  weeks: WeekInfo[];
  students: RegisterStudent[];
  totals: { students: number; weeks: number; warning1: number; warning2: number; barred: number; attendancePct: number };
};

export function buildRegister(raw: AttendanceRaw, excuses: Excuse[], labTitles: Map<string, string>, now = Date.now()): Register {
  const sessions = raw.sessions.filter(wasOpened).sort((a, b) => a.opens_at.localeCompare(b.opens_at));
  const known = new Set(sessions.map((s) => s.id));
  // a TA session marks its week as taught; a permanent "Open lab" session's open date does not
  const taught = sessions.filter((s) => !isPermanentSession(s));
  // Attendance evidence: a check-in, or joining a TA session (class slots ran before the check-in step was
  // used, and many students only joined). Joining the permanent "Open lab" session is not evidence: students
  // can open the lab from anywhere.
  const taSession = new Set(taught.map((s) => s.id));
  const checkins = [
    ...raw.checkins.filter((c) => known.has(c.session_id)),
    ...raw.members.filter((m) => taSession.has(m.session_id)).map((m) => ({ session_id: m.session_id, student_key: m.student_key, at: m.joined_at })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const keys = [...new Set([...taught.map((s) => weekKey(s.opens_at)), ...checkins.map((c) => weekKey(c.at))])].sort();

  // the first evidence of each student in each week (the week of its time), and distinct students per session per week
  const firstIn = new Map<string, { sessionId: string; at: string }>();
  const attendees = new Map<string, Set<string>>();
  for (const c of checkins) {
    const week = weekKey(c.at);
    const sk = `${c.session_id}|${week}`;
    if (!attendees.has(sk)) attendees.set(sk, new Set());
    attendees.get(sk)!.add(c.student_key);
    const k = `${c.student_key}|${week}`;
    if (!firstIn.has(k)) firstIn.set(k, { sessionId: c.session_id, at: c.at });
  }
  // the sessions shown for a week: TA sessions opened in it, and any session someone checked in to during it
  const weekSessions = (key: string) => sessions.filter((s) =>
    (!isPermanentSession(s) && weekKey(s.opens_at) === key) || attendees.has(`${s.id}|${key}`));
  const excused = new Map(excuses.map((e) => [`${e.student_key}|${e.week}`, e]));

  // the latest non-empty group each student joined with
  const group = new Map<string, { name: string; at: string }>();
  for (const m of raw.members) {
    if (!m.group_name) continue;
    const g = group.get(m.student_key);
    if (!g || m.joined_at > g.at) group.set(m.student_key, { name: m.group_name, at: m.joined_at });
  }

  const weeks: WeekInfo[] = keys.map((key, i) => ({
    key,
    number: i + 1,
    label: `Week ${i + 1}`,
    range: weekRange(key),
    over: now >= weekEnd(key),
    sessions: weekSessions(key).map((s) => ({
      id: s.id, lab: s.lab, labTitle: labTitles.get(s.lab) ?? s.lab, ta: s.ta_name, slot: s.time_slot,
      opensAt: s.opens_at, closesAt: s.closes_at, checkedIn: attendees.get(`${s.id}|${key}`)?.size ?? 0,
    })),
    present: 0,
  }));

  const students: RegisterStudent[] = raw.students.map((st) => {
    const cells: Record<string, Cell> = {};
    let attended = 0, absences = 0, excusedCount = 0;
    for (const w of weeks) {
      const hit = firstIn.get(`${st.student_key}|${w.key}`);
      const ex = excused.get(`${st.student_key}|${w.key}`);
      if (hit) {
        cells[w.key] = { status: 'present', sessionId: hit.sessionId, at: hit.at };
        attended++;
        w.present++;
      } else if (ex) {
        cells[w.key] = { status: 'excused', note: ex.note, by: ex.by_name };
        excusedCount++;
      } else if (w.over) {
        cells[w.key] = { status: 'absent' };
        absences++;
      } else {
        cells[w.key] = { status: 'pending' };
      }
    }
    const level = levelFor(absences);
    return {
      key: st.student_key, id: st.student_id, name: st.name, group: group.get(st.student_key)?.name ?? '',
      cells, attended, absences, excused: excusedCount, level, status: LEVEL_LABELS[level],
    };
  });
  students.sort((a, b) => b.level - a.level || b.absences - a.absences || a.name.localeCompare(b.name));

  const counted = weeks.filter((w) => w.over).length;
  const possible = counted * students.length;
  const presentInOver = students.reduce((n, s) => n + weeks.filter((w) => w.over && s.cells[w.key].status === 'present').length, 0);
  return {
    weeks,
    students,
    totals: {
      students: students.length,
      weeks: weeks.length,
      warning1: students.filter((s) => s.level === 1).length,
      warning2: students.filter((s) => s.level === 2).length,
      barred: students.filter((s) => s.level === 3).length,
      attendancePct: possible ? Math.round((presentInOver / possible) * 100) : 0,
    },
  };
}
