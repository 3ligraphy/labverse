/**
 * PROJECT GROUPS — rules for /admin/project/[id]/groups. Balances project teams from one submission item
 * (usually the proposal): who is in which group (the student who handed in + everyone named in the
 * contribution table of their file), random members for groups under the team size, and the idea each group
 * works on. Pure functions only, so they are unit-tested (tests/project-groups.test.ts).
 */
import { ID_RE, notATeamNumber, type Entry } from './core.ts';

/** The largest team size. */
export const TEAM_SIZE = 4;
export const MAX_ROSTER = 2000;
export const MAX_IDEAS = 12;
const MAX_IDEA_LEN = 200;

export type Student = { id: string; name: string };
/** How a member got into a group: they handed in, they are named in a group's file, or they were added here. */
export type Source = 'submitted' | 'document' | 'added';
export type Member = Student & { source: Source };

/** Bump when reading files changes (e.g. better idea finding), so saved results are refreshed automatically. */
export const SCAN_VERSION = 5;

/** What the browser read out of one hand-in's file. Kept so files are only read again when re-submitted. */
export type Scan = {
  updatedAt: string;
  /** SCAN_VERSION when it was read: files read by an older reader are read again. */
  v?: number;
  /** Roster student IDs found in the file (by ID or by full name). */
  ids: string[];
  ideas: string[];
  /** Why the file could not be read (unsupported type, download failed…). */
  error?: string;
};

export type Choice = { mode: 'manual' | 'auto'; idea: string };

/** The saved state of the page for one submission item. */
export type Plan = {
  /** Group key → IDs of students added to it on this page, in the order they were added. */
  added: Record<string, string[]>;
  /** Group key → IDs of students found in the group's files whom the admin took out (a wrong match, or a student in two groups). */
  removed: Record<string, string[]>;
  /** Group key → ideas typed in by the admin (on top of those found in the files). */
  extraIdeas: Record<string, string[]>;
  /** Group key → the chosen idea and how it was chosen. */
  choices: Record<string, Choice>;
  /** Choose every group's idea at random. */
  autoAll: boolean;
  /** Groups under the team size the admin chose to fill later. */
  later: string[];
  /** Entry ID → what its file contained. */
  scans: Record<string, Scan>;
  /** Entry ID → the team number the admin typed for it (when the student typed an ID or a lab group code). */
  teams: Record<string, string>;
};

export const emptyPlan = (): Plan => ({ added: {}, removed: {}, extraIdeas: {}, choices: {}, autoAll: false, later: [], scans: {}, teams: {} });

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/* ------------------------------------------------------------- normalising */

export const normId = (s: string) => s.trim().toUpperCase();
/** Lowercase, no accents, letters and digits only, single spaces: for matching names written differently. */
export const normName = (s: string) =>
  s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const cleanName = (s: string) => s.normalize('NFC').replace(/\s+/g, ' ').trim();

/** "g1", "Group 01", "team 1" and "G 1" are the same group: "G1". Anything else is kept, uppercased. */
export function groupKey(name: string): string {
  const s = name.trim().replace(/\s+/g, ' ');
  const n = /^(?:g|grp|group|team|t)?\s*[-#.:]?\s*0*(\d+)$/i.exec(s);
  if (n) return `G${n[1] || '0'}`;
  return s.toUpperCase() || 'NO GROUP';
}
/** Keys of groups that have no team number yet start with this (followed by a student ID, to keep them apart). */
export const NO_NUMBER = '?';
export const isNumbered = (key: string) => !key.startsWith(NO_NUMBER);

/** A team number the admin typed: short, letters/digits, and not an ID or lab code. Null when it isn't one. */
export function cleanTeam(v: unknown): string | null {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  return s && s.length <= 20 && /^[\p{L}\p{N} #.-]+$/u.test(s) && !notATeamNumber(s) ? s : null;
}

/** Natural order: G2 before G10, named groups after numbered ones, groups without a number last. */
export function compareGroups(a: string, b: string): number {
  if (isNumbered(a) !== isNumbered(b)) return isNumbered(a) ? -1 : 1;
  const na = /^G(\d+)$/.exec(a);
  const nb = /^G(\d+)$/.exec(b);
  if (na && nb) return Number(na[1]) - Number(nb[1]);
  if (na || nb) return na ? -1 : 1;
  return a.localeCompare(b);
}

/* ------------------------------------------------------------------ roster */

const looksLikeId = (s: string) => ID_RE.test(s) && /\d/.test(s);

/**
 * Reads a class list pasted from a spreadsheet or a CSV file: one student per line, a name and an ID in either
 * order, separated by a tab, comma or semicolon (or just a space before/after the ID). Header lines and blank
 * lines are skipped; lines that don't fit are reported with their line number.
 */
export function parseRoster(text: string): { students: Student[]; skipped: string[] } {
  const students = new Map<string, Student>();
  const skipped: string[] = [];
  text.replace(/^﻿/, '').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    let cells = line.split(/\t|;|,/).map((c) => c.trim().replace(/^"(.*)"$/, '$1').trim()).filter(Boolean);
    if (cells.length === 1) {
      const m = /^(\S+)\s+(.+)$/.exec(line) ?? null;
      const n = /^(.+?)\s+(\S+)$/.exec(line) ?? null;
      cells = m && looksLikeId(m[1]) ? [m[1], m[2]] : n && looksLikeId(n[2]) ? [n[1], n[2]] : cells;
    }
    const idAt = cells.findIndex(looksLikeId);
    const nameAt = cells.findIndex((c, j) => j !== idAt && /\p{L}/u.test(c) && !looksLikeId(c));
    if (idAt < 0 || nameAt < 0) {
      // A header row ("Name, Student ID") is expected, not an error.
      if (!(i === 0 && /name|id/i.test(line))) skipped.push(`Line ${i + 1}: ${line.slice(0, 60)}`);
      return;
    }
    const id = normId(cells[idAt]);
    if (!students.has(id)) students.set(id, { id, name: cleanName(cells[nameAt]).slice(0, 80) });
  });
  return { students: [...students.values()].slice(0, MAX_ROSTER), skipped };
}

/** Server-side check of a saved roster. */
export function cleanRoster(input: unknown): Result<Student[]> {
  if (!Array.isArray(input)) return { ok: false, error: 'Send the class list as a list.' };
  if (input.length > MAX_ROSTER) return { ok: false, error: `The class list can hold up to ${MAX_ROSTER} students.` };
  const seen = new Map<string, Student>();
  for (const s of input) {
    const id = normId(String(s?.id ?? ''));
    const name = cleanName(String(s?.name ?? '')).slice(0, 80);
    if (!ID_RE.test(id) || !name) return { ok: false, error: `Check the student “${name || id || '?'}”: it needs a name and a 3–20 character ID.` };
    if (!seen.has(id)) seen.set(id, { id, name });
  }
  return { ok: true, value: [...seen.values()] };
}

/* ------------------------------------------------------- reading the files */

/** Roster students named in a file: by student ID (as a whole word) or by full name (two words or more). */
export function findStudents(text: string, roster: readonly Student[]): string[] {
  const tokens = new Set(text.toUpperCase().match(/[A-Z0-9-]{3,20}/g) ?? []);
  const words = ` ${normName(text)} `;
  return roster
    .filter((s) => tokens.has(s.id) || (normName(s.name).includes(' ') && words.includes(` ${normName(s.name)} `)))
    .map((s) => s.id);
}

/* How proposals name their ideas. ORD: "1", "B", "two", "second"…; LEAD: "1. ", "a) ", "First ", "2nd "… */
const ORD = String.raw`(?:\d{1,2}|[a-e]|one|two|three|four|five)`;
const LEAD = String.raw`(?:(?:\d{1,2}|[a-z])[.)]\s*)?(?:(?:first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\s+)?`;
const KIND = String.raw`(?:(?:the|our|my|proposed|suggested|selected|chosen|main|project|app|application|mobile\s+app)\s+)*(?:idea|option|suggestion)s?`;
const SEP = String.raw`\s*[:.)\-–—|]\s*`;
/**
 * "Idea 1: X", "Proposed idea – X", "Second idea: X", "Option B) X", "Idea title: X", "Proposal 2: X", "The ideas : X, Y",
 * "Idea 1 Description: X", "Project Proposal: X".
 */
const IDEA_LINE = new RegExp(String.raw`^${LEAD}(?:${KIND}|(?:(?:project|app|application|mobile\s+app)\s+)?proposal)\s*(?:#|no\.?|number)?\s*${ORD}?\s*(title|name|description|summary)?${SEP}(.{3,})$`, 'i');
/** After "Idea 1 Description:", only a short name counts (not the description's first sentence). */
const looksLikeName = (s: string) => s.length <= 80 && !/[.!?]$/.test(s.trim());
/** "Project title: X", "App name - X", "Name of the app: X", "Project title | X" (a two-column table row). */
const TITLE_LINE = new RegExp(String.raw`^${LEAD}(?:(?:project|app|application|mobile\s+app|idea)\s+(?:title|name)|(?:title|name)\s+of\s+(?:the\s+)?(?:project|app|application|idea))${SEP}(.{3,})$`, 'i');
/** "Our idea is to build X", "The app idea is X". */
const IDEA_IS = /^(?:our|the|my)\s+(?:project\s+|app\s+|main\s+)?idea\s+(?:is|will\s+be)\s+(?:to\s+(?:build|create|make|develop)\s+)?(.{3,})$/i;
/** A heading on its own line: "Idea 1", "Second idea", "Proposed ideas", "Project idea:", "Project title". */
const IDEA_HEADING = new RegExp(String.raw`^${LEAD}${KIND}s?\s*(?:#|no\.?|number)?\s*${ORD}?\s*(?:title|name|list|options|proposals?)?\s*:?$`, 'i');
const TITLE_HEADING = /^(?:\d+[.)]\s*)?(?:(?:project|app|application|mobile\s+app|idea)\s+(?:title|name)s?|(?:title|name)\s+of\s+(?:the\s+)?(?:project|app|application|mobile\s+app|idea))\s*:?$/i;
/** "CookBook Project Proposal", "StudyBuddy – App Proposal": the app's name in the document title (used when nothing else is found). */
const PROPOSAL_TITLE = /^(.{3,60}?)\s*[-–—:]?\s*(?:(?:mobile\s+)?app(?:lication)?\s+)?(?:project\s+)?proposal$/i;
/** A numbered heading: "1. KinoLog App (Movie Tracking and Social Networking Application)". */
const NUMBERED_TITLE = /^(?:\d{1,2}|[a-e])[.)]\s+(\p{Lu}.{2,119})$/u;
const APP_WORD = /\b(?:app|application|platform|system)\b/i;
/** Numbered lines that read like sentences, not names: "The app will…", "Users can…". */
const SENTENCE_START = /^(?:the|this|our|it|we|they|users?|students?|a|an|each|every|when|if|in|for|to)\b/i;
const GENERIC_TITLE = /^(?:the|our|my|a|an)?\s*(?:mobile|project|app|application|course|module|coursework|cw|final|group|team)\b/i;
/** A table column that holds ideas. */
const IDEA_COLUMN = /^(?:proposed\s+|project\s+|app\s+)?(?:ideas?|idea\s+(?:title|name)|(?:project|app|application)\s+(?:title|name)|title|name\s+of\s+(?:the\s+)?(?:app|idea|project))$/i;
const NUMBERED = /^\(?(?:\d{1,2}|[a-e])[.)]\s*(.{3,})$/i;
const BULLET = /^[•\-*▪◦●○■□➢►–✓✔]\s*(.{3,})$/;
const OTHER_SECTION = /^(?:\d+[.)]?\s*)?(?:contribution|team|group|members?|student|names?|signature|declaration|introduction|problem|objectives?|features?|requirements?|references?|conclusion|description|overview|target|users?|scope|technolog|tools?|timeline|plan)\b/i;
/** Lines that are the document's own title, not an idea. */
const NOT_AN_IDEA = /^(?:mobile\s+(?:app(?:lication)?\s+)?development|(?:project\s+)?proposal|course\s*work|cw\s*\d|module|phase\s*\d|(?:group|team)\s*#?\s*\d+)\b|^[\d\s.#|-]*$/i;

const tidyIdea = (s: string) => {
  const t = s.replace(/\s+/g, ' ').replace(/^["“”']+|["“”']+$/g, '').replace(/\s*\|\s*$/, '').trim();
  return t.length > MAX_IDEA_LEN ? `${t.slice(0, MAX_IDEA_LEN - 1).trimEnd()}…` : t;
};

/**
 * Proposed ideas in a file's text. Recognises:
 * - labelled lines: "Idea 1: X", "Second idea – X", "Project title: X", "App name: X", "Our idea is to build X"
 * - a heading on its own ("Idea 1", "Proposed ideas", "Project title"), then the line under it, or the
 *   numbered/bulleted list under it (a feature list under one idea is not read as more ideas)
 * - a table with an "Idea" / "Title" / "App name" column (rows read as "cell | cell | cell")
 */
export function extractIdeas(lines: readonly string[]): string[] {
  const ideas: string[] = [];
  // after a heading: 'await' the idea under it; 'list' while reading its list (numbered or bulleted)
  let state: 'none' | 'await' | 'list' = 'none';
  let style: RegExp | null = null;
  let column = -1;
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (!line) continue;
    const cells = line.includes(' | ') ? line.split(' | ').map((c) => c.trim()) : null;
    if (cells) {
      const at = cells.findIndex((c) => IDEA_COLUMN.test(c));
      if (at >= 0 && cells.length > 1 && !TITLE_LINE.test(line) && !IDEA_LINE.test(line)) { column = at; state = 'none'; continue; }
      if (column >= 0) { if (cells[column]) ideas.push(cells[column].replace(NUMBERED, '$1')); continue; }
    } else column = -1;
    const labelled = IDEA_LINE.exec(line);
    if (labelled && /^(?:description|summary)$/i.test(labelled[1] ?? '')) {
      // "Idea 1 Description: Campus Lost and Found" names the idea; "Idea description: This app helps…" doesn't.
      if (looksLikeName(labelled[2])) ideas.push(labelled[2]);
      state = 'none';
      continue;
    }
    const found = labelled?.[2] ?? (TITLE_LINE.exec(line) ?? IDEA_IS.exec(line))?.[1];
    if (found) {
      // "The ideas : restaurant app ,Fitness Challenge App": several ideas on one line
      const plural = /\b(?:ideas|options|suggestions)\b/i.test(line.slice(0, line.length - found.length));
      ideas.push(...(plural ? found.split(/\s*[,;]\s*/) : [found]));
      state = 'none';
      continue;
    }
    if (IDEA_HEADING.test(line) || TITLE_HEADING.test(line)) { state = 'await'; style = null; continue; }
    if (state === 'none') continue;
    const numbered = NUMBERED.exec(line);
    const bullet = BULLET.exec(line);
    const item = numbered ?? bullet;
    if (state === 'await') {
      if (item) { ideas.push(item[1]); style = numbered ? NUMBERED : BULLET; state = 'list'; }
      else if (OTHER_SECTION.test(line)) state = 'none';
      else { ideas.push(line); state = 'none'; } // the title under the heading; its description follows
      continue;
    }
    // state === 'list': only items of the list's own kind count (sub-bullets are features, not ideas)
    const same = style?.exec(line);
    if (same) ideas.push(same[1]);
    else if (!item && (OTHER_SECTION.test(line) || line.length < 60)) state = 'none';
  }
  // Nothing labelled as an idea: numbered app headings, each followed by its description —
  // "1. KinoLog App (Movie Tracking …)" then "KinoLog is a social application …".
  if (!ideas.length) {
    const clean = lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    clean.forEach((line, i) => {
      const m = NUMBERED_TITLE.exec(line);
      if (!m || /[.!?;,]$/.test(m[1]) || SENTENCE_START.test(m[1])) return;
      const name = m[1].split(/[\s(:–—-]/)[0].toLowerCase();
      const next = (clean[i + 1] ?? '').toLowerCase();
      const describedNext = name.length >= 3 && next.length > 30 && (next.startsWith(`${name} is `) || next.startsWith(`${name} will `) || next.startsWith(`${name} lets `) || next.startsWith(`${name} helps `));
      if (APP_WORD.test(m[1]) || describedNext) ideas.push(m[1]);
    });
  }
  // Still nothing: fall back to the app name in the document title ("CookBook Project Proposal").
  if (!ideas.length) {
    for (const raw of lines) {
      const t = PROPOSAL_TITLE.exec(raw.replace(/\s+/g, ' ').trim());
      if (t && !GENERIC_TITLE.test(t[1])) { ideas.push(t[1]); break; }
    }
  }
  const seen = new Set<string>();
  return ideas.map(tidyIdea)
    .filter((i) => i.length >= 3 && /\p{L}{2}/u.test(i) && !NOT_AN_IDEA.test(i) && !seen.has(i.toLowerCase()) && seen.add(i.toLowerCase()))
    .slice(0, MAX_IDEAS);
}

/* ------------------------------------------------------------------ groups */

export type Group = {
  key: string;
  /** "G7", or "No number · Mourad" for a group still waiting for its team number. */
  title: string;
  numbered: boolean;
  /** The group names students typed for it ("G1", "group 1", or the lab code they typed by mistake). */
  labels: string[];
  /** IDs of the hand-ins in this group. */
  entries: string[];
  members: Member[];
  ideas: string[];
  /** Entries whose files could not be read. */
  unread: number;
};

type EntryLike = Pick<Entry, 'id' | 'student_id' | 'name' | 'group_name' | 'note'>;

/**
 * Which group each hand-in belongs to. The team number the admin typed wins, then the one the student typed.
 * A hand-in whose "group" is really a student ID or lab group code has no number: it joins the numbered group
 * that shares the most people with it (by the submitter and the contribution table), or else the hand-ins that
 * share people with each other form one group, keyed "?<smallest submitter ID>" until the admin numbers it.
 */
export function entryKeys(entries: readonly EntryLike[], plan: Plan): Map<string, string> {
  const keys = new Map<string, string>();
  const people = (e: EntryLike) => new Set([normId(e.student_id), ...(plan.scans[e.id]?.ids ?? [])]);
  const pending: EntryLike[] = [];
  for (const e of entries) {
    const team = cleanTeam(plan.teams[e.id]) ?? (notATeamNumber(e.group_name) ? null : e.group_name);
    if (team) keys.set(e.id, groupKey(team)); else pending.push(e);
  }
  const inGroup = new Map<string, Set<string>>();
  for (const e of entries) if (keys.has(e.id)) {
    const set = inGroup.get(keys.get(e.id)!) ?? new Set<string>();
    for (const id of people(e)) set.add(id);
    inGroup.set(keys.get(e.id)!, set);
  }
  const left: EntryLike[] = [];
  for (const e of pending) {
    const mine = people(e);
    let best: [string, number] | null = null;
    for (const [key, set] of inGroup) {
      const n = [...mine].filter((id) => set.has(id)).length;
      if (n && (!best || n > best[1])) best = [key, n];
    }
    if (best) keys.set(e.id, best[0]); else left.push(e);
  }
  // The rest: hand-ins that share anyone end up together (union-find over shared people).
  const parent = left.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const sets = left.map(people);
  for (let i = 0; i < left.length; i++) for (let j = i + 1; j < left.length; j++) {
    if ([...sets[i]].some((id) => sets[j].has(id))) parent[find(i)] = find(j);
  }
  const keyOf = new Map<number, string>();
  left.forEach((e, i) => {
    const root = find(i);
    const id = normId(e.student_id);
    if (!keyOf.has(root) || id < keyOf.get(root)!.slice(1)) keyOf.set(root, NO_NUMBER + id);
  });
  left.forEach((e, i) => keys.set(e.id, keyOf.get(find(i))!));
  return keys;
}

/**
 * Builds the groups: submitters, then students named in the group's files, then students added on this page.
 * A student is listed once per group (the first source wins).
 */
export function buildGroups(entries: readonly EntryLike[], roster: readonly Student[], plan: Plan): Group[] {
  const byId = new Map(roster.map((s) => [s.id, s]));
  const keys = entryKeys(entries, plan);
  const groups = new Map<string, Group>();
  const get = (key: string) => {
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { key, title: key, numbered: isNumbered(key), labels: [], entries: [], members: [], ideas: [], unread: 0 }));
    return g;
  };
  const add = (g: Group, id: string, name: string, source: Source) => {
    if (!g.members.some((m) => m.id === id)) g.members.push({ id, name, source });
  };
  for (const e of entries) {
    const g = get(keys.get(e.id)!);
    g.entries.push(e.id);
    if (!g.labels.includes(e.group_name)) g.labels.push(e.group_name);
    add(g, normId(e.student_id), byId.get(normId(e.student_id))?.name ?? e.name, 'submitted');
  }
  for (const e of entries) {
    const g = get(keys.get(e.id)!);
    const scan = plan.scans[e.id];
    if (scan?.error) g.unread++;
    for (const id of scan?.ids ?? []) { const s = byId.get(id); if (s && !plan.removed[g.key]?.includes(id)) add(g, s.id, s.name, 'document'); }
    g.ideas.push(...(scan?.ideas ?? []), ...extractIdeas(e.note.split(/\r?\n/)));
  }
  for (const [key, ids] of Object.entries(plan.added)) {
    const g = groups.get(key);
    if (!g) continue;
    for (const id of ids) add(g, id, byId.get(id)?.name ?? id, 'added');
  }
  for (const g of groups.values()) {
    if (!g.numbered) g.title = `No number · ${g.members[0]?.name ?? g.key.slice(1)}`;
    const seen = new Set<string>();
    g.ideas = [...g.ideas, ...(plan.extraIdeas[g.key] ?? [])].map(tidyIdea).filter((i) => i && !seen.has(i.toLowerCase()) && seen.add(i.toLowerCase()));
  }
  return [...groups.values()].sort((a, b) => compareGroups(a.key, b.key));
}

/** When a group last handed in: the newest of its hand-ins (ISO time, or '' when unknown). */
export function lastHandIn(g: Pick<Group, 'entries'>, entries: readonly Pick<Entry, 'id' | 'updated_at'>[]): string {
  const at = new Set(g.entries);
  return entries.filter((e) => at.has(e.id)).map((e) => e.updated_at).sort().at(-1) ?? '';
}

export const SORTS = {
  newest: 'Newest hand-in first',
  oldest: 'Oldest hand-in first',
  number: 'Group number',
  members: 'Fewest members first',
  unchosen: 'No idea chosen first',
} as const;
export type Sort = keyof typeof SORTS;

/** The groups in the chosen order (ties: newest hand-in, then group number). */
export function sortGroups(groups: readonly Group[], sort: Sort, entries: readonly Pick<Entry, 'id' | 'updated_at'>[], plan: Pick<Plan, 'choices'>): Group[] {
  const at = new Map(groups.map((g) => [g.key, lastHandIn(g, entries)]));
  const newest = (a: Group, b: Group) => (at.get(b.key)! > at.get(a.key)! ? 1 : at.get(b.key)! < at.get(a.key)! ? -1 : compareGroups(a.key, b.key));
  const by: Record<Sort, (a: Group, b: Group) => number> = {
    newest,
    oldest: (a, b) => -newest(a, b) || compareGroups(a.key, b.key),
    number: (a, b) => compareGroups(a.key, b.key),
    members: (a, b) => a.members.length - b.members.length || newest(a, b),
    unchosen: (a, b) => Number(Boolean(plan.choices[a.key]?.idea)) - Number(Boolean(plan.choices[b.key]?.idea)) || newest(a, b),
  };
  return [...groups].sort(by[sort] ?? newest);
}

/** Students listed in more than one group (each should be in exactly one). */
export function conflicts(groups: readonly Group[]): { id: string; name: string; groups: string[] }[] {
  const where = new Map<string, { name: string; groups: string[] }>();
  for (const g of groups) for (const m of g.members) {
    const w = where.get(m.id) ?? { name: m.name, groups: [] };
    w.groups.push(g.title);
    where.set(m.id, w);
  }
  return [...where].filter(([, w]) => w.groups.length > 1).map(([id, w]) => ({ id, ...w }));
}

/** Roster students who are in no group yet: the only ones who may be added to a group. */
export function unassigned(groups: readonly Group[], roster: readonly Student[]): Student[] {
  const taken = new Set(groups.flatMap((g) => g.members.map((m) => m.id)));
  return roster.filter((s) => !taken.has(s.id));
}

/** How many more members a group can take. */
export const openSeats = (g: Pick<Group, 'members'>) => Math.max(0, TEAM_SIZE - g.members.length);

/** A random whole number in [0, n). Pass a seeded one in tests. */
export type Rand = (n: number) => number;
export const cryptoRand: Rand = (n) => {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / n) * n; // reject the tail so every value is equally likely
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return buf[0] % n;
};

/**
 * Adds random unassigned students to the requested groups. Each request is capped at the group's open seats,
 * and a student is never added to two groups. Groups are served in random order, so when there aren't enough
 * students for everyone, which groups miss out is random too. Returns the new `added` map and what happened.
 */
export function assignRandom(
  groups: readonly Group[], roster: readonly Student[], plan: Plan, requests: Record<string, number>, rand: Rand = cryptoRand,
): { added: Record<string, string[]>; placed: Record<string, Student[]>; short: number } {
  const pool = unassigned(groups, roster).slice();
  const added: Record<string, string[]> = Object.fromEntries(Object.entries(plan.added).map(([k, v]) => [k, [...v]]));
  const placed: Record<string, Student[]> = {};
  let short = 0;
  const order = groups.filter((g) => (requests[g.key] ?? 0) > 0);
  for (let i = order.length - 1; i > 0; i--) { const j = rand(i + 1); [order[i], order[j]] = [order[j], order[i]]; }
  for (const g of order) {
    const want = Math.min(Math.floor(requests[g.key]), openSeats(g));
    for (let n = 0; n < want; n++) {
      if (!pool.length) { short += want - n; break; }
      const [s] = pool.splice(rand(pool.length), 1);
      (added[g.key] ??= []).push(s.id);
      (placed[g.key] ??= []).push(s);
    }
  }
  return { added, placed, short };
}

/** A random idea from the list (null when there are none). */
export const randomIdea = (ideas: readonly string[], rand: Rand = cryptoRand) => (ideas.length ? ideas[rand(ideas.length)] : null);

/* ------------------------------------------------------------- saved plan */

const strList = (v: unknown, max: number, len: number) =>
  Array.isArray(v) ? [...new Set(v.map((x) => String(x).trim().slice(0, len)).filter(Boolean))].slice(0, max) : [];
const record = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.entries(v as Record<string, unknown>).slice(0, 1000) : []);
const keyOk = (k: string) => k.length > 0 && k.length <= 40;

/** Server-side check of a saved plan: drops anything malformed, caps every list. */
export function cleanPlan(input: unknown): Plan {
  const p = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const plan = emptyPlan();
  for (const [k, v] of record(p.added)) if (keyOk(k)) { const ids = strList(v, TEAM_SIZE, 20).map(normId).filter((id) => ID_RE.test(id)); if (ids.length) plan.added[k] = ids; }
  for (const [k, v] of record(p.removed)) if (keyOk(k)) { const ids = strList(v, 20, 20).map(normId).filter((id) => ID_RE.test(id)); if (ids.length) plan.removed[k] = ids; }
  for (const [k, v] of record(p.extraIdeas)) if (keyOk(k)) { const ideas = strList(v, MAX_IDEAS, MAX_IDEA_LEN); if (ideas.length) plan.extraIdeas[k] = ideas; }
  for (const [k, v] of record(p.choices)) {
    const c = v as Partial<Choice> | null;
    if (keyOk(k) && c && (c.mode === 'manual' || c.mode === 'auto')) plan.choices[k] = { mode: c.mode, idea: String(c.idea ?? '').trim().slice(0, MAX_IDEA_LEN) };
  }
  plan.autoAll = p.autoAll === true;
  plan.later = strList(p.later, 1000, 40);
  for (const [k, v] of record(p.scans)) {
    const s = v as Partial<Scan> | null;
    if (!keyOk(k) || !s || typeof s.updatedAt !== 'string') continue;
    plan.scans[k] = { updatedAt: s.updatedAt.slice(0, 40), ...(Number.isInteger(s.v) ? { v: s.v } : {}), ids: strList(s.ids, 20, 20).map(normId), ideas: strList(s.ideas, MAX_IDEAS, MAX_IDEA_LEN), ...(s.error ? { error: String(s.error).slice(0, 200) } : {}) };
  }
  for (const [k, v] of record(p.teams)) { const team = cleanTeam(v); if (keyOk(k) && team) plan.teams[k] = team; }
  return plan;
}

/**
 * Gives a group its team number: every hand-in in it gets the number, and what was saved under its old key
 * (added members, taken-out members, ideas, the chosen idea, "later") moves to the new key. Returns the new key.
 */
export function numberGroup(plan: Plan, group: Pick<Group, 'key' | 'entries'>, team: string): string {
  const to = groupKey(team);
  for (const id of group.entries) plan.teams[id] = team;
  const from = group.key;
  if (from === to) return to;
  const merge = (m: Record<string, string[]>) => {
    if (!m[from]) return;
    m[to] = [...new Set([...(m[to] ?? []), ...m[from]])];
    delete m[from];
  };
  merge(plan.added);
  merge(plan.removed);
  merge(plan.extraIdeas);
  if (plan.choices[from]) { plan.choices[to] ??= plan.choices[from]; delete plan.choices[from]; }
  plan.later = [...new Set(plan.later.map((k) => (k === from ? to : k)))];
  return to;
}

/**
 * The platform's group numbers, drawn like lots: groups without a number (or every group, with `all`) get the
 * lowest numbers not already in use, in random order. Saved in the plan, so they don't change on reload.
 * Returns each renumbered group's old key → new key.
 */
export function autoNumber(groups: readonly Group[], plan: Plan, rand: Rand = cryptoRand, all = false): Record<string, string> {
  const targets = groups.filter((g) => all || !g.numbered);
  if (!targets.length) return {};
  const taken = new Set(all ? [] : groups.filter((g) => g.numbered).map((g) => /^G(\d+)$/.exec(g.key)?.[1]).filter(Boolean).map(Number));
  const free: number[] = [];
  for (let n = 1; free.length < targets.length; n++) if (!taken.has(n)) free.push(n);
  for (let i = free.length - 1; i > 0; i--) { const j = rand(i + 1); [free[i], free[j]] = [free[j], free[i]]; }
  // Two steps when renumbering everyone, so a group never lands on a number another group still holds.
  const moved = targets.map((g, i) => (all ? { key: numberGroup(plan, g, `renumber-${i}`), entries: g.entries } : g));
  return Object.fromEntries(targets.map((g, i) => [g.key, numberGroup(plan, moved[i], String(free[i]))]));
}

/* ------------------------------------------------------------------- sheet */

const who = (m: Student) => `${m.name} (${m.id})`;

/** The groups sheet (CSV, opens in Excel/Sheets). Same columns after the random assignment and after choosing ideas. */
export function groupsCsv(groups: readonly Group[], plan: Plan, only?: ReadonlySet<string>): string {
  const cell = (v: string) => {
    const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const rows = [['Group number', 'Group name(s) submitted', 'All members', 'Newly added members', 'Members added', 'Total members', 'Idea selected', 'How the idea was chosen']];
  for (const g of groups) {
    if (only && !only.has(g.key)) continue;
    const added = g.members.filter((m) => m.source === 'added');
    const choice = plan.choices[g.key];
    rows.push([
      g.numbered ? g.key : 'No team number yet', g.labels.join(' / '), g.members.map(who).join('; '), added.map(who).join('; '), String(added.length), String(g.members.length),
      choice?.idea ?? '', choice?.idea ? (choice.mode === 'auto' ? 'Random' : 'Manual') : '',
    ]);
  }
  return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
