// Auto-mark (evidence from a hand-in + the TA's marking pattern), the app-source picker for "Open in BUENOVA Code",
// and the build retry rule for failures of the build computer. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { screensIn, namedPattern, requirementsIn, readEvidence, taPattern, groupsMarkedBy, autoMark } = await import('../src/lib/marking/automark.ts');
const { emptyDoc } = await import('../src/lib/marking/doc.ts');
const { appRoot, appFiles, keepFile } = await import('../src/lib/previews/source.ts');
const { needsBuild, builderFault } = await import('../src/lib/previews/core.ts');

test('screens: Expo Router routes and screen files, without layouts, sign-in or registration', () => {
  const files = [
    'app/_layout.tsx', 'app/+not-found.tsx', 'app/index.tsx', 'app/(tabs)/_layout.tsx', 'app/(tabs)/profile.tsx', 'app/(tabs)/settings.tsx',
    'app/(auth)/login.tsx', 'app/(auth)/register.tsx', 'app/task/[id].tsx', 'app/cart/index.tsx',
    'components/Button.tsx', 'hooks/useTasks.ts', 'app.json', 'package.json',
  ];
  assert.deepEqual(screensIn(files), ['cart', 'home', 'profile', 'settings', 'task[id]']);
  const classic = ['src/screens/HomeScreen.tsx', 'src/screens/LoginScreen.tsx', 'src/screens/SignUpScreen.js', 'src/screens/Details/index.tsx', 'src/screens/styles.ts', 'src/OrdersScreen.jsx', 'src/screens/components/Card.tsx'];
  assert.deepEqual(screensIn(classic), ['details', 'home', 'orders']);
  assert.deepEqual(screensIn(['README.md']), []);
});

test('the pattern the report names, and whether it is clear', () => {
  assert.equal(namedPattern('We use MVVM. The MVVM view models hold the state. MVVM keeps it simple.')?.def.name, 'MVVM');
  assert.equal(namedPattern('We use MVVM. The MVVM view models hold the state.')?.level, 'clear');
  assert.equal(namedPattern('Our app follows MVC and MVVM ideas, MVC for data and MVVM for screens.')?.level, 'partly');
  assert.equal(namedPattern('Our MVP is a shopping list app.'), null, 'MVP as minimum viable product is not a pattern');
  assert.equal(namedPattern('No architecture here.'), null);
});

test('functional requirements listed in the report (sign-in and sign-up not counted)', () => {
  const report = 'Introduction blah. Functional Requirements FR1 The user can sign up FR2 The user can log in FR3 Add a task FR4 Edit a task FR5 Share a list FR6 Get reminders Non-functional requirements NFR1 fast';
  assert.equal(requirementsIn(report), 4);
  assert.equal(requirementsIn('Functional requirements: 1. Browse products 2. Add to cart 3. Pay 4. Sign in with Google. Use case diagram ...'), 3);
  assert.equal(requirementsIn('Non-functional requirements only: fast and safe.'), null);
});

const REPORT = `${'Intro text. '.repeat(30)} Functional Requirements FR1 Browse meals FR2 Order a meal FR3 Track the order FR4 Rate the meal FR5 Save favourites FR6 Pay online.
Non-functional requirements ... Architecture: we chose MVVM because it separates the screens from the logic, so the code is maintainable and testable. MVVM fits our app.`;

test('evidence from a hand-in becomes assistant answers', () => {
  const files = ['app/index.tsx', 'app/menu.tsx', 'app/order.tsx', 'viewmodels/useOrder.ts', 'models/Meal.ts', 'package.json'];
  const ev = readEvidence(REPORT, files);
  assert.deepEqual(ev.answers.ui_screens, { screens: 3 });
  assert.deepEqual(ev.answers.uc_mapping, { reqs: 6 });
  assert.deepEqual(ev.answers.ar_pattern, { level: 'clear' });
  assert.deepEqual(ev.answers.ar_impl, { level: 'clear' });
  assert.deepEqual(ev.answers.ar_reason, { level: 'clear' });
  assert.match(ev.found.ar_impl!, /2 of 2 MVVM folders/);
  // no code, short report: nothing is guessed
  const none = readEvidence('short', []);
  assert.deepEqual(none.answers, {});
  // a report with no pattern: pattern and reasoning are none, implementation is not guessed
  const noPattern = readEvidence('A long report. '.repeat(40), ['app/index.tsx']);
  assert.deepEqual(noPattern.answers.ar_pattern, { level: 'none' });
  assert.deepEqual(noPattern.answers.ar_reason, { level: 'none' });
  assert.equal(noPattern.answers.ar_impl, undefined);
});

function docWith() {
  const doc = emptyDoc();
  doc.tas = [{ name: 'Amr', email: null, groups: [1, 2, 3, 4] }, { name: 'Ali', email: null, groups: [5, 6, 7] }];
  const m = (scores: Record<string, number>, by: string, help = {}) => ({ scores, comment: '', by, at: '', members: [], editors: [by], help });
  // Amr gives +0.5 over the assistant on screens, usually 1 for actors and 4 for mapping
  doc.marks['1'] = m({ uc_actors: 1, uc_mapping: 4, ui_screens: 7.5 }, 'Amr', { ui_screens: { screens: 7 } });
  doc.marks['2'] = m({ uc_actors: 1, uc_mapping: 4, ui_screens: 9 }, 'Amr', { ui_screens: { screens: 9 } });
  doc.marks['3'] = m({ uc_actors: 0.5, uc_mapping: 3.5, ui_screens: 6.5 }, 'Amr', { ui_screens: { screens: 6 } });
  // Ali is strict
  doc.marks['5'] = m({ uc_actors: 0.5, uc_mapping: 2 }, 'Ali');
  doc.marks['6'] = m({ uc_actors: 0.5, uc_mapping: 2.5 }, 'Ali');
  doc.marks['7'] = m({ uc_actors: 0, uc_mapping: 2 }, 'Ali');
  // a group of Ali's load that Amr also saved counts for Amr
  doc.marks['9'] = m({ uc_actors: 1 }, 'Amr');
  return doc;
}

test('a TA’s pattern: their groups, usual marks and leniency against the assistant', () => {
  const doc = docWith();
  assert.deepEqual(groupsMarkedBy(doc, doc.tas[0]), [1, 2, 3, 9]);
  const p = taPattern(doc, doc.tas[0], 4);
  assert.equal(p.by.uc_actors.median, 1);
  assert.equal(p.by.ui_screens.biasN, 3);
  // +0.5, +0, +0.5 → 1 over 3 groups, shrunk: 1 / (3 + 2)
  assert.equal(p.by.ui_screens.bias, 0.2);
  assert.deepEqual(taPattern(doc, doc.tas[0], 1).groups, [2, 3, 9], 'the group being marked is left out');
});

test('auto-mark follows the chosen TA: evidence + their bias, else their usual mark', () => {
  const doc = docWith();
  const ev = { answers: { ui_screens: { screens: 8 } }, found: { ui_screens: '8 screens in the code' } };
  const cls = taPattern(doc, null, 4);
  const amr = autoMark(ev, {}, taPattern(doc, doc.tas[0], 4), cls, 'Amr');
  assert.equal(amr.marks.ui_screens?.value, 8.2, '8 by the rule, +0.2 as Amr marks');
  assert.equal(amr.marks.ui_screens?.source, 'evidence');
  assert.equal(amr.marks.uc_actors?.value, 1);
  assert.equal(amr.marks.uc_actors?.source, 'pattern');
  assert.equal(amr.marks.uc_mapping?.value, 4);
  assert.equal(amr.marks.ad_flow, undefined, 'nobody marked it: left empty');
  const ali = autoMark(ev, {}, taPattern(doc, doc.tas[1], 4), cls, 'Ali');
  assert.equal(ali.marks.uc_mapping?.value, 2, 'the same group, as strict Ali marks it');
  assert.equal(ali.marks.ui_screens?.value, 8, 'Ali never used the assistant: no bias');
  // the TA's own answers win over the evidence
  const own = autoMark(ev, { ui_screens: { screens: 5 } }, taPattern(doc, doc.tas[1], 4), cls, 'Ali');
  assert.equal(own.marks.ui_screens?.value, 5);
  assert.equal(own.marks.ui_screens?.source, 'answers');
  assert.deepEqual(own.help.ui_screens, { screens: 5 });
});

test('the app folder of a ZIP or repo, and the files worth opening', () => {
  const pkgs = [
    { path: 'repo-main/package.json', text: JSON.stringify({ devDependencies: { eslint: '9' } }) },
    { path: 'repo-main/mobile/package.json', text: JSON.stringify({ dependencies: { expo: '~52.0.0' } }) },
    { path: 'repo-main/mobile/node_modules/expo/package.json', text: JSON.stringify({ dependencies: { expo: '1' } }) },
    { path: 'repo-main/server/package.json', text: '{broken' },
  ];
  assert.equal(appRoot(pkgs), 'repo-main/mobile/');
  assert.equal(appRoot([{ path: 'package.json', text: JSON.stringify({ dependencies: { 'react-native': '0.76' } }) }]), '');
  assert.equal(appRoot([{ path: 'package.json', text: '{}' }]), null);
  assert.equal(keepFile('node_modules/x/index.js', 10), false);
  assert.equal(keepFile('android/app/build.gradle', 10), false);
  assert.equal(keepFile('assets/video.mp4', 50 * 1024 * 1024), false);
  assert.equal(keepFile('app/index.tsx', 10), true);
  const names = [{ name: 'r/mobile/app/index.tsx', size: 10 }, { name: 'r/mobile/assets/icon.png', size: 10 }, { name: 'r/mobile/.git/config', size: 10 }, { name: 'r/server/index.js', size: 10 }, { name: 'r/mobile/app/', size: 0 }];
  assert.deepEqual(appFiles(names, 'r/mobile/'), ['r/mobile/app/index.tsx', 'r/mobile/assets/icon.png']);
  // the app is the whole repo: the repo folder's own entry is not a file (it made "Open in BUENOVA Code" fail: EISDIR)
  assert.equal(keepFile('', 0), false);
  assert.deepEqual(appFiles([{ name: 'estateshare-HEAD/', size: 0 }, { name: 'estateshare-HEAD/App.js', size: 10 }], 'estateshare-HEAD/'), ['estateshare-HEAD/App.js']);
});

test('a build that failed on the build computer (EACCES) is built again at once, not a day later', () => {
  const failedAt = new Date(Date.now() - 60_000).toISOString();
  const e = { updatedAt: 'v1', repo: 'a/b', built: null };
  const note = "EACCES, Permission denied: '/home/runner/work/_temp/app-builds-1/out/.work/5covok6d319admzxetbf'";
  assert.equal(builderFault(note), true);
  assert.equal(builderFault('npm install failed'), false);
  assert.equal(needsBuild({ ...e, failed: { handIn: 'v1', at: failedAt, note } }, { now: Date.now(), pin: true }), 'build');
  assert.equal(needsBuild({ ...e, failed: { handIn: 'v1', at: failedAt, note: 'expo export failed' } }, { now: Date.now(), pin: true }), 'wait');
  assert.equal(needsBuild({ ...e, failed: { handIn: 'v1', at: failedAt } }, { now: Date.now(), pin: true }), 'wait', 'older lists without a note');
});
