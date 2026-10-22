// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_STORED, modulesWith, parseMatrix, permitted, type Who } from '../src/lib/accounts/permissions.ts';
import { AUTH_LIMITS, GENERAL, SUPER_ADMINS, checkPasswordRules, fitsStudent, hasSpecialization, inSemester, isForStudent, loginThrottle, parseAccount, parseProfile, parseSettings, signupBlock, teamAccountBlock, upgradeYears, DEFAULT_SETTINGS } from '../src/lib/accounts/core.ts';
import { hashPassword, signToken, verifyPassword, verifyToken } from '../src/lib/accounts/tokens.ts';

const who = (o: Partial<Who>): Who => ({ platformRole: null, master: false, modules: {}, ...o });

test('super admins and the master password can do everything, including roles & permissions', () => {
  assert.equal(permitted(DEFAULT_STORED, who({ platformRole: 'super_admin' }), 'platform.roles'), true);
  assert.equal(permitted(DEFAULT_STORED, who({ master: true }), 'module.assessment', 'anything'), true);
  assert.equal(permitted(DEFAULT_STORED, who({ platformRole: 'doctor' }), 'platform.roles'), false, 'fixed: super admin only');
});

test('module roles only count in their own module', () => {
  const leader = who({ platformRole: 'ta', modules: { 'web-development': 'leader' } });
  assert.equal(permitted(DEFAULT_STORED, leader, 'module.assessment', 'web-development'), true);
  assert.equal(permitted(DEFAULT_STORED, leader, 'module.assessment', 'mobile-development'), false);
  assert.equal(permitted(DEFAULT_STORED, leader, 'module.invite', 'web-development'), true);
  assert.equal(permitted(DEFAULT_STORED, leader, 'module.build'), true, 'any module');
  assert.deepEqual(modulesWith(DEFAULT_STORED, leader, 'module.invite'), ['web-development']);
  const admin = who({ platformRole: 'ta', modules: { 'mobile-development': 'admin' } });
  assert.equal(permitted(DEFAULT_STORED, admin, 'module.assessment', 'mobile-development'), false, 'only leaders set the assessment');
  assert.equal(permitted(DEFAULT_STORED, admin, 'module.build', 'mobile-development'), true);
});

test('platform roles grant across modules; students get nothing by default', () => {
  assert.equal(permitted(DEFAULT_STORED, who({ platformRole: 'doctor' }), 'modules.create'), true);
  assert.equal(permitted(DEFAULT_STORED, who({ platformRole: 'doctor' }), 'accounts.staff'), false, 'only super admins create staff by default');
  assert.equal(permitted(DEFAULT_STORED, who({ platformRole: 'ta' }), 'module.sessions', 'web-development'), true);
  assert.equal(permitted(DEFAULT_STORED, who({ platformRole: 'student' }), 'module.progress', 'x'), false);
});

test('parseMatrix keeps known permissions, refuses fixed ones and platform-only ones on module roles', () => {
  const m = parseMatrix({
    platform: { doctor: ['accounts.staff', 'platform.roles', 'nope'], ta: [], student: [] },
    module: { leader: ['module.assessment', 'accounts.staff'], admin: [], ta: ['module.sessions'] },
  });
  assert.deepEqual(m, { platform: { doctor: ['accounts.staff'], ta: [], student: [] }, module: { leader: ['module.assessment'], admin: [], ta: ['module.sessions'] } });
  assert.equal(parseMatrix({}), null);
  // the edited matrix takes effect
  assert.equal(permitted(m!, who({ platformRole: 'doctor' }), 'accounts.staff'), true);
});

test('accounts: password rules, validation, hashing and signed tokens', () => {
  assert.equal(checkPasswordRules('short1'), 'Use at least 10 characters.');
  assert.equal(checkPasswordRules('onlyletters'), 'Mix letters and numbers.');
  assert.equal(checkPasswordRules('Good-pass-2026'), null);
  const a = parseAccount({ role: 'student', name: 'Sara Ali', email: ' SARA@BUE.edu.eg ', password: 'Good-pass-2026', studentId: ' 23 1001 ' }, ['student']);
  assert.deepEqual(a.ok && [a.value.email, a.value.studentId], ['sara@bue.edu.eg', '231001']);
  assert.equal(parseAccount({ role: 'doctor', name: 'X Y', email: 'x@y.com', password: 'Good-pass-2026' }, ['student']).ok, false, 'role not allowed');

  const h = hashPassword('Good-pass-2026');
  assert.equal(verifyPassword('Good-pass-2026', h), true);
  assert.equal(verifyPassword('wrong-pass-2026', h), false);
  const t = signToken({ u: 'id1', r: 'ta', n: 'Ali', v: 0 }, 'secret', 60_000, 1_000);
  assert.equal(verifyToken(t, 'secret', 2_000)?.u, 'id1');
  assert.equal(verifyToken(t, 'other-secret', 2_000), null, 'wrong secret');
  assert.equal(verifyToken(t, 'secret', 70_000), null, 'expired');
  assert.equal(verifyToken(t.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')), 'secret', 2_000), null, 'tampered');
});

test('onboarding profile: valid year/specialization, only allowed optional modules; no Data Science', () => {
  assert.ok(!DEFAULT_SETTINGS.specializations.includes('Data Science'));
  const p = parseProfile({ faculty: 'informatics-computer-science', year: 'Year 3', specialization: 'Software Engineering', modules: ['mobile-development', 'web-development'] }, DEFAULT_SETTINGS, ['mobile-development']);
  assert.deepEqual(p.ok && p.value.modules, ['mobile-development'], 'invitation-only modules cannot be self-chosen');
  assert.equal(parseProfile({ faculty: 'informatics-computer-science', year: 'Year 9', specialization: 'Software Engineering' }, DEFAULT_SETTINGS, []).ok, false);
  assert.equal(parseSettings({ years: 'Year 1\nYear 2', specializations: 'A, B' }).ok, false, 'no commas');
  assert.equal(isForStudent({ slug: 'm', category: 'Optional', kind: 'elective', open: true, years: [], specializations: [], semester: 'Both', faculty: 'informatics-computer-science' }, { year: 'Year 1', specialization: GENERAL, modules: ['m'], faculty: '' }), true);
});

test('BUE years: Prep year then Years 1–3; specializations start in Year 2', () => {
  const s = DEFAULT_SETTINGS;
  assert.deepEqual(s.years, ['Prep year', 'Year 1', 'Year 2', 'Year 3']);
  assert.equal(hasSpecialization(s, 'Prep year', 'Semester 2'), false);
  assert.equal(hasSpecialization(s, 'Year 1', 'Semester 2'), false);
  assert.equal(hasSpecialization(s, 'Year 2', 'Semester 1'), true);
  assert.equal(hasSpecialization(s, 'Year 3', 'Semester 2'), true);
  // before it starts the student is "General", whatever they send
  const ics = { faculty: 'informatics-computer-science' };
  const y1 = parseProfile({ ...ics, year: 'Year 1', specialization: 'Software Engineering' }, s, []);
  assert.deepEqual(y1.ok && y1.value.specialization, GENERAL);
  const y2 = parseProfile({ ...ics, year: 'Year 2', specialization: '' }, s, []);
  assert.equal(y2.ok, false, 'Year 2 must choose');
  const y3 = parseProfile({ ...ics, year: 'Year 3', specialization: 'Cyber Security' }, s, []);
  assert.deepEqual(y3.ok && y3.value.specialization, 'Cyber Security');
  // a later start set by the admin still works
  const late = { ...s, specFrom: { year: 'Year 2', semester: 'Semester 2' as const } };
  assert.equal(hasSpecialization(late, 'Year 2', 'Semester 1'), false);
  assert.equal(hasSpecialization(late, 'Year 2', 'Semester 2'), true);
});

test('an untouched old catalogue (Year 1–4) reads as the BUE years; an edited one is kept', () => {
  assert.deepEqual(upgradeYears(undefined, undefined), { years: DEFAULT_SETTINGS.years, specFrom: DEFAULT_SETTINGS.specFrom });
  assert.deepEqual(upgradeYears(['Year 1', 'Year 2', 'Year 3', 'Year 4'], { year: 'Year 3', semester: 'Semester 2' }),
    { years: ['Prep year', 'Year 1', 'Year 2', 'Year 3'], specFrom: { year: 'Year 2', semester: 'Semester 1' } });
  assert.deepEqual(upgradeYears(['Foundation', 'Level 1'], { year: 'Level 1', semester: 'Semester 2' }),
    { years: ['Foundation', 'Level 1'], specFrom: { year: 'Level 1', semester: 'Semester 2' } });
  // a start year that is no longer listed falls back to a listed one
  assert.equal(upgradeYears(['A', 'B', 'C'], { year: 'Z', semester: 'Semester 1' }).specFrom.year, 'C');
});

test('modules by semester and specialization', () => {
  assert.equal(inSemester({ semester: 'Both' }, 'Semester 2'), true);
  assert.equal(inSemester({ semester: 'Semester 1' }, 'Semester 2'), false);
  const ai = { years: ['Year 4'], specializations: ['Artificial Intelligence'] };
  assert.equal(fitsStudent(ai, { year: 'Year 4', specialization: 'Artificial Intelligence' }), true);
  assert.equal(fitsStudent(ai, { year: 'Year 4', specialization: 'Cyber Security' }), false);
  assert.equal(fitsStudent(ai, { year: 'Year 2', specialization: GENERAL }), false);
  assert.equal(fitsStudent({ years: [], specializations: [] }, { year: 'Year 1', specialization: GENERAL }), true);
  assert.equal(fitsStudent({ years: [], specializations: ['Software Engineering'] }, { year: 'Year 3', specialization: GENERAL }), false, 'General students only see modules open to every specialization');
});

test('settings: active semester and where specializations start', () => {
  const r = parseSettings({ years: ['Year 1', 'Year 2', 'Year 3', 'Year 4'], specializations: 'Software Engineering', activeSemester: 'Semester 2', specFromYear: 'Year 3', specFromSemester: 'Semester 2' });
  assert.deepEqual(r.ok && [r.value.activeSemester, r.value.specFrom], ['Semester 2', { year: 'Year 3', semester: 'Semester 2' }]);
  assert.equal(parseSettings({ years: 'Year 1', specializations: 'General' }).ok, false, '"General" is reserved');
});

import { kindOf, optionalFor } from '../src/lib/accounts/core.ts';
test('catalogue categories: admin-defined, core vs elective; only open electives can be self-chosen', () => {
  const cats = [{ name: 'Core', kind: 'core' as const }, { name: 'University requirement', kind: 'core' as const }, { name: 'Elective', kind: 'elective' as const }];
  assert.equal(kindOf(cats, 'university requirement'), 'core');
  assert.equal(kindOf(cats, 'Unknown'), 'elective', 'unknown categories never reach students unasked');
  const ok = parseSettings({ years: ['Year 1'], specializations: ['SE'], categories: [{ name: ' Elective ', kind: 'elective' }, { name: 'Core', kind: 'core' }] });
  assert.deepEqual(ok.ok && ok.value.categories, [{ name: 'Elective', kind: 'elective' }, { name: 'Core', kind: 'core' }]);
  assert.equal(parseSettings({ years: ['Year 1'], specializations: ['SE'], categories: [{ name: 'A', kind: 'core' }, { name: 'a', kind: 'core' }] }).ok, false, 'duplicates');
  const mods = [
    { slug: 'mobile', category: 'Optional', kind: 'elective' as const, open: true, years: [], specializations: [], semester: 'Semester 1' as const, faculty: 'all' },
    { slug: 'web', category: 'Elective', kind: 'elective' as const, open: false, years: [], specializations: [], semester: 'Both' as const, faculty: 'all' },
  ];
  assert.deepEqual(optionalFor(mods, { year: 'Year 3', specialization: GENERAL }).map((m) => m.slug), ['mobile']);
});

test('sign-up refuses emails that only an invitation may claim', () => {
  const none = { staffRole: false, pendingInvite: false };
  assert.equal(signupBlock('new.student@bue.edu.eg', none), null);
  assert.match(signupBlock('ta.member@bue.edu.eg', { ...none, staffRole: true }) ?? '', /invitation/);
  assert.match(signupBlock('invited@bue.edu.eg', { ...none, pendingInvite: true }) ?? '', /invitation/);
  assert.notEqual(signupBlock(SUPER_ADMINS[0].toUpperCase(), none), null, 'the super admin email, in any case');
});

test('module team pages cannot create doctors or claim the super admin email without the right permission', () => {
  const leader = { canCreateStaff: false, canManageRoles: false };
  assert.equal(teamAccountBlock({ email: 'new.ta@bue.edu.eg', platformRole: 'ta', ...leader }), null);
  assert.equal(teamAccountBlock({ email: 'student@bue.edu.eg', platformRole: 'student', ...leader }), null);
  assert.match(teamAccountBlock({ email: 'new.dr@bue.edu.eg', platformRole: 'doctor', ...leader }) ?? '', /account manager/);
  assert.equal(teamAccountBlock({ email: 'new.dr@bue.edu.eg', platformRole: 'doctor', canCreateStaff: true, canManageRoles: false }), null);
  assert.match(teamAccountBlock({ email: SUPER_ADMINS[0], platformRole: 'ta', ...leader }) ?? '', /super admin/);
  assert.equal(teamAccountBlock({ email: SUPER_ADMINS[0], platformRole: 'ta', canCreateStaff: true, canManageRoles: true }), null);
});

test('a whole class on one network can sign in; password guessing is limited per account', () => {
  assert.equal(loginThrottle({ network: 120, failures: 0 }), null, 'a full lab signing in together');
  assert.equal(loginThrottle({ network: 1, failures: AUTH_LIMITS.loginFailuresPerEmail - 1 }), null);
  assert.match(loginThrottle({ network: 1, failures: AUTH_LIMITS.loginFailuresPerEmail }) ?? '', /wrong passwords/);
  assert.match(loginThrottle({ network: AUTH_LIMITS.loginNetworkPer10Min + 1, failures: 0 }) ?? '', /network/);
  assert.ok(AUTH_LIMITS.signupNetworkPerHour >= 100, 'a cohort can create accounts in one lab');
});
