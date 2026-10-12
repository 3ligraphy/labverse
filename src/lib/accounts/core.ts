/**
 * ACCOUNTS — rules. Doctors and TAs sign in to run the platform; students may sign in (or just type their
 * name and ID in each lab, as before). Students are onboarded with their year, specialization and the
 * optional modules they chose, and see their modules first.
 * Pure functions only (no Node APIs), so they are unit-tested and shared with the browser.
 */

export const ROLES = ['super_admin', 'doctor', 'ta', 'student'] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABEL: Record<Role, string> = { super_admin: 'Super admin', doctor: 'Doctor', ta: 'Teaching assistant', student: 'Student' };
/** Platform super admins (by email). They can manage roles & permissions and every account. */
export const SUPER_ADMINS = ['ali.motawea@bue.edu.eg'];

/** faculty: a Faculty slug ('' on accounts made before faculties existed = the default faculty, see facultyOfProfile). */
export type Profile = { year: string; specialization: string; modules: string[]; faculty: string };
export type PublicUser = { id: string; role: Role; name: string; email: string; studentId: string | null; profile: Profile; active: boolean; created_at: string; last_login: string | null };

export const SEMESTERS = ['Semester 1', 'Semester 2'] as const;
export type Semester = (typeof SEMESTERS)[number];
/** "General" = no specialization yet (before the specialization starts). */
export const GENERAL = 'General';

/**
 * A faculty (e.g. Informatics & Computer Science, Arts & Humanities) owns its specializations. Specialization names
 * are unique across faculties, so `Settings.specializations` (every faculty's list, flattened) still names one.
 * The slug never changes once created; the name can be renamed.
 */
export type Faculty = { slug: string; name: string; specializations: string[] };
/** The faculty of everything made before faculties existed (accounts, builder modules, the built-in course). */
export const DEFAULT_FACULTY = 'informatics-computer-science';
/** A module whose faculty is ANY_FACULTY is for every faculty. */
export const ANY_FACULTY = 'all';
const ICS_SPECIALIZATIONS = ['Computer Science', 'Software Engineering', 'Artificial Intelligence', 'Cyber Security', 'Information Systems'];
export const DEFAULT_FACULTIES: Faculty[] = [
  { slug: DEFAULT_FACULTY, name: 'Informatics & Computer Science', specializations: ICS_SPECIALIZATIONS },
  { slug: 'arts-humanities', name: 'Arts & Humanities', specializations: ['Psychology'] },
];
/** A student's faculty (accounts from before faculties existed belong to the default faculty). */
export const facultyOfProfile = (p: { faculty?: string } | null | undefined) => (p?.faculty || DEFAULT_FACULTY);
/** The faculty a specialization belongs to, or undefined. */
export const facultyOfSpecialization = (faculties: Faculty[], spec: string) =>
  faculties.find((f) => f.specializations.some((s) => s.toLowerCase() === spec.toLowerCase()));
/** A module's faculty from its stored value (missing = the default faculty; ANY_FACULTY = every faculty). */
export const moduleFaculty = (v: string | undefined) => (v ?? '').trim() || DEFAULT_FACULTY;
/** Kebab slug from a faculty name ("Arts & Humanities" → "arts-humanities"). */
export const facultySlug = (name: string) =>
  name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50).replace(/-+$/, '') || 'faculty';

/**
 * Faculties from storage. Before faculties existed only a flat specialization list was stored: it becomes the
 * default faculty's list, and the other default faculties are added (unless they would repeat a specialization).
 */
export function upgradeFaculties(faculties: Faculty[] | undefined, specializations: string[] | undefined): Faculty[] {
  if (Array.isArray(faculties) && faculties.length) return faculties;
  const first = { ...DEFAULT_FACULTIES[0], specializations: specializations?.length ? specializations : DEFAULT_FACULTIES[0].specializations };
  return [first, ...DEFAULT_FACULTIES.slice(1).filter((f) => !f.specializations.some((s) => first.specializations.includes(s)))];
}

/** A module category, created by the admin. Core modules go to every matching student; electives only to those who pick or are enrolled. */
export type Category = { name: string; kind: 'core' | 'elective' };

export const DEFAULT_SETTINGS = {
  categories: [{ name: 'Core', kind: 'core' }, { name: 'Optional', kind: 'elective' }] as Category[],
  /** BUE: a preparatory year, then Years 1–3 */
  years: ['Prep year', 'Year 1', 'Year 2', 'Year 3'],
  /** the semester the platform is running now (the admin switches it) */
  activeSemester: 'Semester 1' as Semester,
  /** specializations start here (the second year after prep) and continue to the final year */
  specFrom: { year: 'Year 2', semester: 'Semester 1' as Semester },
  /** every faculty's specializations, flattened (kept for code that only needs the names) */
  specializations: DEFAULT_FACULTIES.flatMap((f) => f.specializations),
  faculties: DEFAULT_FACULTIES,
};
export type Settings = { categories: Category[]; years: string[]; specializations: string[]; faculties: Faculty[]; activeSemester: Semester; specFrom: { year: string; semester: Semester } };

/**
 * The first catalogue listed "Year 1"–"Year 4" with specializations from Year 3 · Semester 2. A catalogue still on
 * exactly those untouched defaults is read as the BUE years (Prep year, Year 1–3, specializations from Year 2).
 * A list the admin edited is kept as it is.
 */
export const LEGACY_DEFAULTS = { years: ['Year 1', 'Year 2', 'Year 3', 'Year 4'], specFrom: { year: 'Year 3', semester: 'Semester 2' } };
export function upgradeYears(years: string[] | undefined, specFrom: Settings['specFrom'] | undefined): Pick<Settings, 'years' | 'specFrom'> {
  const legacy = !years || (years.length === LEGACY_DEFAULTS.years.length && years.every((y, i) => y === LEGACY_DEFAULTS.years[i]));
  if (!legacy) return { years: years!, specFrom: specFrom && years!.includes(specFrom.year) ? specFrom : { year: years![Math.min(2, years!.length - 1)], semester: DEFAULT_SETTINGS.specFrom.semester } };
  const oldSpec = !specFrom || (specFrom.year === LEGACY_DEFAULTS.specFrom.year && specFrom.semester === LEGACY_DEFAULTS.specFrom.semester);
  return { years: DEFAULT_SETTINGS.years, specFrom: oldSpec || !DEFAULT_SETTINGS.years.includes(specFrom!.year) ? DEFAULT_SETTINGS.specFrom : specFrom! };
}

/** Does a student in this year (during this semester) have a specialization? From specFrom (Year 2 · Semester 1 by default) on. */
export function hasSpecialization(s: Pick<Settings, 'years' | 'specFrom'>, year: string, semester: Semester): boolean {
  const y = s.years.indexOf(year), from = s.years.indexOf(s.specFrom.year);
  if (y < 0 || from < 0) return false;
  return y > from || (y === from && SEMESTERS.indexOf(semester) >= SEMESTERS.indexOf(s.specFrom.semester));
}
/** Audience of the built-in course (Mobile Development): an optional module open to every specialization. */
export const BUILT_IN_AUDIENCE = { category: 'Optional', years: '', specializations: '', semester: 'Semester 1', open: true, faculty: DEFAULT_FACULTY };

export const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}'’. -]*[\p{L}\p{M}.]$/u;
export const STUDENT_ID_RE = /^[A-Za-z0-9-]{3,20}$/;
const EMAIL_RE = /^[^\s@<>()",;]{1,64}@[^\s@<>()",;]{1,190}\.[A-Za-z]{2,24}$/;
export const MIN_PASSWORD = 10;
type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export const normalEmail = (v: unknown) => text(v).toLowerCase();

export function checkPasswordRules(pw: unknown): string | null {
  const p = typeof pw === 'string' ? pw : '';
  if (p.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (p.length > 200) return 'That password is too long.';
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return 'Mix letters and numbers.';
  return null;
}

/** A student's year / specialization / optional modules, checked against the platform settings. */
export function parseProfile(input: Record<string, unknown>, settings: Settings, optional: string[]): Result<Profile> {
  // one faculty: nobody has to choose it
  const faculty = settings.faculties.length === 1 ? settings.faculties[0].slug : text(input.faculty);
  const fac = settings.faculties.find((f) => f.slug === faculty);
  if (!fac) return { ok: false, error: 'Choose your faculty.' };
  const year = text(input.year);
  if (!settings.years.includes(year)) return { ok: false, error: 'Choose your year.' };
  // before the specialization starts (Year 2 by default) every student is "General"
  let specialization = text(input.specialization);
  if (!hasSpecialization(settings, year, settings.activeSemester)) specialization = GENERAL;
  else if (!fac.specializations.includes(specialization)) return { ok: false, error: `Choose your specialization in ${fac.name}.` };
  const list = Array.isArray(input.modules) ? input.modules.map(String) : [];
  const modules = [...new Set(list)].filter((m) => optional.includes(m)).slice(0, 30);
  return { ok: true, value: { year, specialization, modules, faculty } };
}

export type NewAccount = { role: Role; name: string; email: string; password: string; studentId: string | null };

/** Validates a new account: students sign themselves up; doctors create doctor and TA accounts. */
export function parseAccount(input: Record<string, unknown>, allowed: readonly Role[]): Result<NewAccount> {
  const role = text(input.role) as Role;
  if (!allowed.includes(role)) return { ok: false, error: 'Choose a valid role.' };
  const name = text(input.name).normalize('NFC').replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 60 || !NAME_RE.test(name)) return { ok: false, error: 'Enter a full name (letters only).' };
  const email = normalEmail(input.email);
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  const pwError = checkPasswordRules(input.password);
  if (pwError) return { ok: false, error: pwError };
  let studentId: string | null = null;
  if (role === 'student') {
    studentId = text(input.studentId).toUpperCase();
    if (!STUDENT_ID_RE.test(studentId)) return { ok: false, error: 'Your student ID should be 3–20 letters or numbers.' };
  }
  return { ok: true, value: { role, name, email, password: input.password as string, studentId } };
}

/**
 * Sign-in and sign-up limits. A whole class signs in from one campus network (one public IP), so the
 * per-network ceilings are high and only stop floods; guessing a password is limited per email, counting
 * failed attempts only, so one person's typos never lock anyone else out.
 */
export const AUTH_LIMITS = {
  loginNetworkPer10Min: 300,
  loginFailuresPerEmail: 8,
  loginFailureWindowSec: 15 * 60,
  signupNetworkPerHour: 150,
} as const;

/** Why a sign-in attempt is refused before checking the password, or null. */
export function loginThrottle(counts: { network: number; failures: number }): string | null {
  if (counts.failures >= AUTH_LIMITS.loginFailuresPerEmail) return 'Too many wrong passwords for this account. Wait 15 minutes, or ask a module leader to reset it.';
  if (counts.network > AUTH_LIMITS.loginNetworkPer10Min) return 'Too many sign-in attempts from this network. Wait ten minutes and try again.';
  return null;
}

/**
 * Self-sign-up never proves that the person owns the email, while staff roles, invitations and super-admin status
 * are all keyed by email. So an email that already holds one of those can only get an account through its
 * invitation link (or from an admin): returns why sign-up is refused, or null when it may go ahead.
 */
export function signupBlock(email: string, holds: { staffRole: boolean; pendingInvite: boolean }): string | null {
  if (SUPER_ADMINS.includes(normalEmail(email)) || holds.staffRole || holds.pendingInvite) {
    return 'This email belongs to an invited teaching-team member. Open the invitation link sent to it, or ask the module leader to resend it.';
  }
  return null;
}

/**
 * What the module team page may create for another person. Module leaders invite and add people to their own
 * module, but a platform-wide doctor account needs the account-manager permission, and the super admin's email
 * is never handed out from a module page (an account made for it would take over the super admin's identity).
 */
export function teamAccountBlock(input: { email: string; platformRole: Role; canCreateStaff: boolean; canManageRoles: boolean }): string | null {
  if (SUPER_ADMINS.includes(normalEmail(input.email)) && !input.canManageRoles) return 'This email belongs to the platform super admin.';
  if (input.platformRole === 'doctor' && !input.canCreateStaff) return 'Only an account manager can create doctor accounts. Invite them as a TA, or ask the super admin.';
  return null;
}

/** Comma list → clean items ("Year 2, Year 3" → ["Year 2", "Year 3"]); empty means "everyone". */
export const listOf = (v: string | undefined) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const has = (list: string[], v: string) => !list.length || list.some((x) => x.toLowerCase() === v.toLowerCase());

/** Who a module is for: its category, years, semester and specializations (empty list = everyone). */
export type Audience = {
  slug: string; category: string; kind: Category['kind']; years: string[]; specializations: string[]; semester: 'Both' | Semester;
  /** a Faculty slug, or ANY_FACULTY */
  faculty: string;
  /** students may add it themselves (otherwise only by invitation or enrolment) */
  open: boolean;
};
/** The kind of a category name (unknown names count as electives, so they never reach students unasked). */
export const kindOf = (categories: Category[], name: string): Category['kind'] => categories.find((c) => c.name.toLowerCase() === name.toLowerCase())?.kind ?? 'elective';

/** Runs in this semester? */
export const inSemester = (m: Pick<Audience, 'semester'>, semester: Semester) => m.semester === 'Both' || m.semester === semester;
/** Is this module for this student's faculty, year and specialization? ("General" students only match modules open to every specialization.) */
export const fitsStudent = (m: Pick<Audience, 'years' | 'specializations'> & { faculty?: string }, p: Pick<Profile, 'year' | 'specialization'> & { faculty?: string }) =>
  (moduleFaculty(m.faculty) === ANY_FACULTY || moduleFaculty(m.faculty) === facultyOfProfile(p))
  && has(m.years, p.year) && (!m.specializations.length || (p.specialization !== GENERAL && has(m.specializations, p.specialization)));

/** Is this module for this student? Core: their year/specialization. Optional: only if they chose it. */
export function isForStudent(m: Audience, p: Profile): boolean {
  if (m.kind === 'elective') return p.modules.includes(m.slug);
  return fitsStudent(m, p);
}

/** Optional modules a student may pick during onboarding (open to their year and specialization). */
export const optionalFor = (all: Audience[], p: Pick<Profile, 'year' | 'specialization'> & { faculty?: string }) => all.filter((m) => m.kind === 'elective' && m.open && fitsStudent(m, p));

/**
 * The catalogue from the admin. `faculties: [{ slug?, name, specializations[] }]`; a request without faculties
 * (the old form) puts its flat `specializations` into the default faculty and keeps the other current faculties.
 */
export function parseSettings(input: Record<string, unknown>, current?: Pick<Settings, 'faculties'>): Result<Settings> {
  const clean = (v: unknown) => (Array.isArray(v) ? v : typeof v === 'string' ? v.split('\n') : []).map((s) => String(s).trim()).filter(Boolean);
  const years = [...new Set(clean(input.years))].slice(0, 12);
  if (!years.length) return { ok: false, error: 'Add at least one year.' };
  if (years.some((s) => s.length > 60 || s.includes(','))) return { ok: false, error: 'Keep each item under 60 characters, without commas.' };

  const rawFaculties = Array.isArray(input.faculties)
    ? (input.faculties as { slug?: unknown; name?: unknown; specializations?: unknown }[])
    : (() => {
        const flat = clean(input.specializations);
        if (!flat.length) return [];
        const others = upgradeFaculties(current?.faculties, undefined).filter((f) => f.slug !== DEFAULT_FACULTY);
        return [{ ...DEFAULT_FACULTIES[0], specializations: flat }, ...others.filter((f) => !f.specializations.some((s) => flat.includes(s)))];
      })();
  if (!rawFaculties.length) return { ok: false, error: 'Add at least one specialization.' };
  if (rawFaculties.length > 20) return { ok: false, error: 'Keep 1–20 faculties.' };
  const faculties: Faculty[] = [];
  const allSpecs = new Map<string, string>();
  for (const f of rawFaculties) {
    const name = String(f?.name ?? '').trim().replace(/\s+/g, ' ');
    if (!name || name.length > 80 || name.includes(',')) return { ok: false, error: 'Each faculty needs a name (up to 80 characters, no commas).' };
    const slug = typeof f?.slug === 'string' && /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/.test(f.slug) ? f.slug : facultySlug(name);
    if (slug === ANY_FACULTY) return { ok: false, error: `“${name}” can't be used as a faculty name.` };
    if (faculties.some((x) => x.slug === slug || x.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: `The faculty “${name}” is listed twice.` };
    const specializations = [...new Set(clean(f?.specializations))].slice(0, 40);
    if (!specializations.length) return { ok: false, error: `Add at least one specialization to ${name}.` };
    for (const sp of specializations) {
      if (sp.length > 60 || sp.includes(',')) return { ok: false, error: 'Keep each item under 60 characters, without commas.' };
      if (sp === GENERAL) return { ok: false, error: '“General” is reserved for students before their specialization.' };
      const other = allSpecs.get(sp.toLowerCase());
      if (other) return { ok: false, error: `“${sp}” is in both ${other} and ${name}. Each specialization belongs to one faculty.` };
      allSpecs.set(sp.toLowerCase(), name);
    }
    faculties.push({ slug, name, specializations });
  }
  const specializations = faculties.flatMap((f) => f.specializations);

  const rawCats = Array.isArray(input.categories) ? (input.categories as { name?: unknown; kind?: unknown }[]) : DEFAULT_SETTINGS.categories;
  const categories: Category[] = [];
  for (const c of rawCats) {
    const name = String(c?.name ?? '').trim().replace(/\s+/g, ' ');
    if (!name || name.length > 40 || name.includes(',')) return { ok: false, error: 'Each category needs a name (up to 40 characters, no commas).' };
    if (categories.some((x) => x.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: `“${name}” is listed twice.` };
    categories.push({ name, kind: c?.kind === 'core' ? 'core' : 'elective' });
  }
  if (!categories.length || categories.length > 12) return { ok: false, error: 'Keep 1–12 categories.' };
  const sem = (v: unknown, fallback: Semester) => ((SEMESTERS as readonly string[]).includes(String(v)) ? (String(v) as Semester) : fallback);
  const activeSemester = sem(input.activeSemester, DEFAULT_SETTINGS.activeSemester);
  const fromYear = years.includes(String(input.specFromYear)) ? String(input.specFromYear) : years[Math.min(2, years.length - 1)];
  return { ok: true, value: { categories, years, specializations, faculties, activeSemester, specFrom: { year: fromYear, semester: sem(input.specFromSemester, DEFAULT_SETTINGS.specFrom.semester) } } };
}
