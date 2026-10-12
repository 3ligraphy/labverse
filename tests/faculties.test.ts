// Faculties: each owns its specializations; modules belong to one faculty (or all); students pick theirs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANY_FACULTY, DEFAULT_FACULTIES, DEFAULT_FACULTY, DEFAULT_SETTINGS, GENERAL, facultyOfProfile, facultyOfSpecialization, facultySlug,
  fitsStudent, moduleFaculty, optionalFor, parseProfile, parseSettings, upgradeFaculties, type Settings,
} from '../src/lib/accounts/core.ts';

const ARTS = 'arts-humanities';
const base = { years: ['Prep year', 'Year 1', 'Year 2', 'Year 3'], specFromYear: 'Year 2', specFromSemester: 'Semester 1' };

test('default catalogue: Informatics & Computer Science plus Arts & Humanities (Psychology)', () => {
  assert.deepEqual(DEFAULT_SETTINGS.faculties.map((f) => f.slug), [DEFAULT_FACULTY, ARTS]);
  assert.deepEqual(DEFAULT_SETTINGS.specializations, DEFAULT_FACULTIES.flatMap((f) => f.specializations), 'flattened');
  assert.equal(facultyOfSpecialization(DEFAULT_FACULTIES, 'psychology')?.slug, ARTS, 'any case');
  assert.equal(facultyOfSpecialization(DEFAULT_FACULTIES, 'Cyber Security')?.slug, DEFAULT_FACULTY);
  assert.equal(facultySlug('Arts & Humanities'), ARTS);
  assert.equal(facultySlug('Économie  Politique'), 'economie-politique');
});

test('parseSettings with faculties: slugs kept or derived, specializations flattened, duplicates across faculties refused', () => {
  const r = parseSettings({ ...base, faculties: [
    { slug: DEFAULT_FACULTY, name: 'Informatics & Computer Science', specializations: ['Software Engineering', 'Cyber Security'] },
    { name: 'Arts & Humanities', specializations: ['Psychology', 'English'] },
  ] });
  assert.ok(r.ok);
  assert.deepEqual(r.value.faculties.map((f) => f.slug), [DEFAULT_FACULTY, ARTS]);
  assert.deepEqual(r.value.specializations, ['Software Engineering', 'Cyber Security', 'Psychology', 'English']);

  const dup = parseSettings({ ...base, faculties: [
    { name: 'Informatics', specializations: ['Psychology'] },
    { name: 'Arts & Humanities', specializations: ['psychology'] },
  ] });
  assert.equal(dup.ok, false);
  assert.match(!dup.ok ? dup.error : '', /both Informatics and Arts & Humanities/);
  assert.equal(parseSettings({ ...base, faculties: [{ name: 'A', specializations: ['X'] }, { name: 'a', specializations: ['Y'] }] }).ok, false, 'faculty named twice');
  assert.equal(parseSettings({ ...base, faculties: [{ name: 'Empty', specializations: [] }] }).ok, false, 'a faculty needs a specialization');
  assert.equal(parseSettings({ ...base, faculties: [{ name: 'All', specializations: ['X'] }] }).ok, false, '"all" means every faculty');
  assert.equal(parseSettings({ ...base, faculties: [{ name: 'Arts', specializations: [GENERAL] }] }).ok, false, '"General" is reserved');
});

test('parseSettings legacy flat specializations: into the default faculty, other current faculties kept', () => {
  const r = parseSettings({ ...base, specializations: 'Software Engineering\nData Science' }, { faculties: DEFAULT_FACULTIES });
  assert.ok(r.ok);
  assert.deepEqual(r.value.faculties.map((f) => [f.slug, f.specializations]), [
    [DEFAULT_FACULTY, ['Software Engineering', 'Data Science']],
    [ARTS, ['Psychology']],
  ]);
  // a flat list that now names another faculty's specialization drops that faculty instead of duplicating it
  const clash = parseSettings({ ...base, specializations: ['Psychology'] }, { faculties: DEFAULT_FACULTIES });
  assert.deepEqual(clash.ok && clash.value.faculties.map((f) => f.slug), [DEFAULT_FACULTY]);
  assert.equal(parseSettings({ ...base }).ok, false, 'no specializations at all');
});

test('upgradeFaculties: stored faculties win; an old flat list becomes the default faculty', () => {
  const stored = [{ slug: 'x', name: 'X', specializations: ['A'] }];
  assert.equal(upgradeFaculties(stored, ['ignored']), stored);
  assert.deepEqual(upgradeFaculties(undefined, undefined), DEFAULT_FACULTIES);
  const old = upgradeFaculties(undefined, ['Software Engineering', 'Robotics']);
  assert.deepEqual(old.map((f) => [f.slug, f.specializations]), [[DEFAULT_FACULTY, ['Software Engineering', 'Robotics']], [ARTS, ['Psychology']]]);
  // an old list that already had Psychology keeps it in the default faculty (never in two faculties)
  assert.deepEqual(upgradeFaculties([], ['Psychology']).map((f) => f.slug), [DEFAULT_FACULTY]);
});

test('parseProfile: a faculty is required with more than one, and the specialization must be in it', () => {
  const s = DEFAULT_SETTINGS as Settings;
  assert.match((() => { const r = parseProfile({ year: 'Year 3', specialization: 'Psychology' }, s, []); return r.ok ? '' : r.error; })(), /faculty/);
  const psych = parseProfile({ faculty: ARTS, year: 'Year 3', specialization: 'Psychology' }, s, []);
  assert.deepEqual(psych.ok && psych.value, { faculty: ARTS, year: 'Year 3', specialization: 'Psychology', modules: [] });
  const wrong = parseProfile({ faculty: ARTS, year: 'Year 3', specialization: 'Cyber Security' }, s, []);
  assert.match(!wrong.ok ? wrong.error : '', /Arts & Humanities/);
  assert.equal(parseProfile({ faculty: 'nope', year: 'Year 3', specialization: 'Psychology' }, s, []).ok, false);
  // before the specialization starts any faculty's student is General
  const y1 = parseProfile({ faculty: ARTS, year: 'Year 1', specialization: '' }, s, []);
  assert.deepEqual(y1.ok && [y1.value.faculty, y1.value.specialization], [ARTS, GENERAL]);
  // one faculty: nobody chooses it
  const one = { ...s, faculties: [DEFAULT_FACULTIES[0]] };
  const p = parseProfile({ year: 'Year 3', specialization: 'Cyber Security' }, one, []);
  assert.deepEqual(p.ok && p.value.faculty, DEFAULT_FACULTY);
});

test('fitsStudent matches the faculty: "all" fits everyone, a missing faculty is the default, legacy profiles too', () => {
  const psychMod = { years: [], specializations: [], faculty: ARTS };
  const icsMod = { years: [], specializations: [], faculty: DEFAULT_FACULTY };
  const everyone = { years: [], specializations: [], faculty: ANY_FACULTY };
  const oldMod = { years: [], specializations: [] }; // stored before faculties
  const psych = { year: 'Year 2', specialization: 'Psychology', faculty: ARTS };
  const cs = { year: 'Year 2', specialization: 'Computer Science', faculty: DEFAULT_FACULTY };
  const legacy = { year: 'Year 2', specialization: 'Computer Science', faculty: '' };
  assert.equal(fitsStudent(psychMod, psych), true);
  assert.equal(fitsStudent(psychMod, cs), false);
  assert.equal(fitsStudent(icsMod, psych), false);
  assert.equal(fitsStudent(everyone, psych), true);
  assert.equal(fitsStudent(everyone, cs), true);
  assert.equal(fitsStudent(oldMod, cs), true, 'a module without a faculty is in the default faculty');
  assert.equal(fitsStudent(oldMod, psych), false);
  assert.equal(fitsStudent(icsMod, legacy), true, 'a profile without a faculty is in the default faculty');
  assert.equal(fitsStudent(psychMod, legacy), false);
  assert.equal(facultyOfProfile(legacy), DEFAULT_FACULTY);
  assert.equal(facultyOfProfile(undefined), DEFAULT_FACULTY);
  assert.equal(moduleFaculty(undefined), DEFAULT_FACULTY);
  assert.equal(moduleFaculty(' all '), ANY_FACULTY);
  // optional modules offered at onboarding follow the faculty too
  const mods = [
    { slug: 'mobile', category: 'Optional', kind: 'elective' as const, open: true, years: [], specializations: [], semester: 'Semester 1' as const, faculty: DEFAULT_FACULTY },
    { slug: 'mind', category: 'Optional', kind: 'elective' as const, open: true, years: [], specializations: [], semester: 'Both' as const, faculty: ARTS },
    { slug: 'writing', category: 'Optional', kind: 'elective' as const, open: true, years: [], specializations: [], semester: 'Both' as const, faculty: ANY_FACULTY },
  ];
  assert.deepEqual(optionalFor(mods, psych).map((m) => m.slug), ['mind', 'writing']);
  assert.deepEqual(optionalFor(mods, legacy).map((m) => m.slug), ['mobile', 'writing']);
});
