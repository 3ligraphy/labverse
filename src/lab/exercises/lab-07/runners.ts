/**
 * Lab 07 · Parts 6–7 in the browser (nothing to install): writing Jest unit tests and React Native Testing Library
 * component tests (run with the lab's test runner, like `npm test`), and finishing a Maestro flow (played on the
 * preview phone, like `maestro test`). A test is accepted when it passes on the real code AND fails on a broken copy
 * of it: a test that cannot catch the bug it was written for would pass either way.
 */
import type { RunContext } from '../../engine/checks.ts';
import { runFlow } from '../../engine/maestro.ts';
import { summaryLine } from '../../engine/test-report.ts';
import type { TestRun } from '../../runtime/protocol.ts';
import type { CodeExercise, Demo } from '../types.ts';
import { LAB_ID } from './meta.ts';
import { FAKE_CAMERA, FEEDBACK, MAESTRO_FLOW, PARSE_SCAN, PARSE_TEST, SCANNER, SCREEN_TEST, projectFiles } from './project.ts';
import { FEEDBACK_FILE, PARSE_FILE, SCREEN, code } from './shared.ts';

const id = (name: string) => `${LAB_ID}--${name}`;
export const UNIT_TEST = '__tests__/parseScan-test.ts';
export const SCREEN_TEST_FILE = '__tests__/ScannerScreen-test.tsx';
export const FAKE_CAMERA_FILE = 'test-utils/fakeCamera.tsx';
export const FLOW_FILE = '.maestro/scan-sample.yaml';

const must = (text: string, old: string, replacement: string) => {
  if (!text.includes(old)) throw new Error(`lab-07 runners: the project changed, "${old.slice(0, 40)}…" is gone`);
  return text.replace(old, replacement);
};

/* ------------------------------------------------------------------ helpers for checks */

/** Runs the test files on `files` (the student's, or a broken copy); null when this preview cannot run tests. */
async function run(c: RunContext, files: Record<string, string>, paths: string[]): Promise<TestRun | null> {
  if (!c.app.runTests) return null;
  return c.app.runTests(files, paths);
}
const failedTests = (r: TestRun) => r.files.flatMap((f) => (f.error ? [{ name: 'the file', message: f.error.message }] : f.tests.filter((t) => t.status === 'failed').map((t) => ({ name: t.name, message: t.error?.message ?? '' }))));
const passedCount = (r: TestRun) => r.files.flatMap((f) => f.tests).filter((t) => t.status === 'passed').length;
const NO_RUNNER = 'This page could not run tests. Reload the page and press Check again.';

/** "all pass" check: names the first failing test and the first line of why */
export async function allPass(c: RunContext, paths: string[], atLeast: number): Promise<string | true> {
  const r = await run(c, c.files, paths);
  if (!r) return NO_RUNNER;
  const failed = failedTests(r);
  if (failed.length) return `A test fails on the real app: **${failed[0].name}** — ${failed[0].message.split('\n').find((l) => l.trim()) ?? ''}. Press **Run tests** to read the whole message.`;
  if (passedCount(r) < atLeast) return `Only ${passedCount(r)} tests ran and passed (${summaryLine(r)}); write the missing ones (at least ${atLeast} in all).`;
  return true;
}

/** "catches the bug" check: the same tests on a broken copy of the app must fail */
export async function catches(c: RunContext, broken: Record<string, string>, paths: string[], miss: string): Promise<string | boolean> {
  const r = await run(c, { ...c.files, ...broken }, paths);
  if (!r) return NO_RUNNER;
  return failedTests(r).length > 0 || miss;
}

/* ------------------------------------------------------------------ Part 6 demo: run the unit tests */

export const unitTestDemo: Demo = {
  id: 'unit-tests-run',
  title: 'Run the unit tests, then break one',
  frame: 'phone',
  entry: 'App.tsx',
  files: { [UNIT_TEST]: PARSE_TEST, [PARSE_FILE]: PARSE_SCAN, ...projectFiles() },
  runner: { kind: 'tests', files: [UNIT_TEST] },
  tryThis: [
    'Press **Run tests**: `PASS`, seven ✓ lines and `Tests: 7 passed, 7 total`, as `npm test` prints them on a PC.',
    'In line 29 change `\'This QR code is empty.\'` to `\'The code is empty.\'` and run again. Read the **− Expected** (the test) and **+ Received** (the code) lines, and the `>` under the failing line.',
    'Change it back: all 7 pass again.',
  ],
};

/* ------------------------------------------------------------------ Exercise: the two missing unit tests */

const UNIT_STARTER = must(
  must(
    PARSE_TEST,
    `  test('a Wi-Fi code is a Wi-Fi network', () => {
    const result = parseScan('WIFI:S:Lab-5G;T:WPA;P:secret123;;');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.kind).toBe('wifi');
  });
`,
    `  // TODO 1: a Wi-Fi code is a Wi-Fi network
  //   parseScan('WIFI:S:Lab-5G;T:WPA;P:secret123;;') gives ok: true and kind: 'wifi'
`,
  ),
  `  test('an empty code is an error', () => {
    expect(parseScan('')).toEqual({ ok: false, error: 'This QR code is empty.' });
    expect(parseScan('    ')).toEqual({ ok: false, error: 'This QR code is empty.' });
    expect(parseScan(null)).toEqual({ ok: false, error: 'This QR code is empty.' });
  });
`,
  `  // TODO 2: an empty code is an error
  //   parseScan(''), parseScan('    ') and parseScan(null) all give { ok: false, error: 'This QR code is empty.' }
`,
);

export const exUnitTests: CodeExercise = {
  id: id('unit-tests'),
  n: 11,
  title: 'Write the two missing unit tests',
  minutes: 6,
  level: 5,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  runner: { kind: 'tests', files: [UNIT_TEST] },
  prompt:
    'Five tests of `parseScan` are written; two are **TODO** comments. Write them: a Wi-Fi code is a Wi-Fi network, and an empty code (`\'\'`, `\'    \'` and `null`) is an error. Press **Run tests** as often as you like. **Check** also runs your tests on a broken `parseScan`: a good test fails there.',
  files: { [UNIT_TEST]: UNIT_STARTER, [PARSE_FILE]: PARSE_SCAN, ...projectFiles() },
  checks: [
    {
      id: 'wifi-test',
      label: 'a test gives parseScan a `WIFI:` code and expects the kind `\'wifi\'`',
      fail: 'In place of TODO 1: `test(\'a Wi-Fi code is a Wi-Fi network\', () => { const result = parseScan(\'WIFI:S:Lab-5G;T:WPA;P:secret123;;\'); … });`',
      static: (c) => /parseScan\(\s*['"`]WIFI:/i.test(code(c.files, UNIT_TEST)) && /['"`]wifi['"`]/.test(code(c.files, UNIT_TEST)),
    },
    {
      id: 'empty-test',
      label: 'a test expects the error `This QR code is empty.` for an empty code',
      fail: 'In place of TODO 2: `expect(parseScan(\'\')).toEqual({ ok: false, error: \'This QR code is empty.\' });` (and the same for `\'    \'` and `null`)',
      static: (c) => /parseScan\(\s*(['"`]\s*['"`]|null)\s*\)/.test(code(c.files, UNIT_TEST)) && /This QR code is empty\./.test(code(c.files, UNIT_TEST)),
    },
    {
      id: 'pass',
      label: 'all the tests pass on the real parseScan (7 or more)',
      fail: 'Press **Run tests** and fix the test that fails.',
      run: (c) => allPass(c, [UNIT_TEST], 7),
    },
    {
      id: 'catches-wifi',
      label: 'your tests fail when parseScan calls a Wi-Fi code plain text',
      fail: 'Your tests still pass when a Wi-Fi code comes back as kind \'text\'. Check the kind: `if (result.ok) expect(result.kind).toBe(\'wifi\');`',
      run: (c) => catches(c, { [PARSE_FILE]: must(PARSE_SCAN, "return { ok: true, kind: 'wifi', label: 'Wi-Fi network', value };", "return { ok: true, kind: 'text', label: 'Text', value };") }, [UNIT_TEST], 'Your tests still pass when a Wi-Fi code comes back as kind \'text\'. Check the kind: `if (result.ok) expect(result.kind).toBe(\'wifi\');`'),
    },
    {
      id: 'catches-empty',
      label: 'your tests fail when parseScan accepts an empty code',
      fail: 'Your tests still pass when an empty code is accepted. Expect the whole error object: `expect(parseScan(\'\')).toEqual({ ok: false, error: \'This QR code is empty.\' });`',
      run: (c) =>
        catches(c, { [PARSE_FILE]: must(PARSE_SCAN, "    return { ok: false, error: 'This QR code is empty.' };", "    return { ok: true, kind: 'text', label: 'Text', value };") }, [UNIT_TEST], 'Your tests still pass when an empty code is accepted. Expect the whole error object: `expect(parseScan(\'\')).toEqual({ ok: false, error: \'This QR code is empty.\' });`'),
    },
  ],
  hints: [
    'Copy the shape of the first test: `test(\'…\', () => { const result = parseScan(…); expect(…)…; });`',
    'Wi-Fi: `expect(result.ok).toBe(true);` then `if (result.ok) expect(result.kind).toBe(\'wifi\');`',
    'Empty: `expect(parseScan(\'\')).toEqual({ ok: false, error: \'This QR code is empty.\' });` — then the same line with `\'    \'` and with `null`.',
  ],
  solution: {
    explain: 'One test per rule of parseScan. `toBe` checks one value; `toEqual` checks the whole object, so a wrong message or a wrong `ok` fails too.',
    files: { [UNIT_TEST]: PARSE_TEST },
  },
  success: 'Check ran your tests twice: on the real parseScan (all pass) and on broken copies (they fail). That is what a useful test does: it fails when the code it guards breaks.',
};

/* ------------------------------------------------------------------ Exercise: the two missing component tests */

const SCREEN_STARTER = (() => {
  const settings = /test\('sends the user to the settings[\s\S]*?\n\}\);\n/.exec(SCREEN_TEST)?.[0];
  const empty = /test\('an empty code shows an error[\s\S]*?\n\}\);\n/.exec(SCREEN_TEST)?.[0];
  if (!settings || !empty) throw new Error('lab-07 runners: the component tests changed');
  return SCREEN_TEST.replace(
    settings,
    `// TODO 1: when the phone will not ask again (canAskAgain: false), the screen shows
//   an "Open settings" button and no "Allow camera" button
`,
  ).replace(
    empty,
    `// TODO 2: an empty code shows "This QR code is empty." and the Error vibration
//   (press the fake button with the testID 'fake-scan-empty')
`,
  );
})();

export const exComponentTests: CodeExercise = {
  id: id('component-tests'),
  n: 14,
  title: 'Write the two missing component tests',
  minutes: 7,
  level: 6,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  runner: { kind: 'tests', files: [SCREEN_TEST_FILE] },
  prompt:
    'Three tests of `ScannerScreen` are written, with a fake camera (`jest.mock`) and fake haptics. Write the two **TODO** tests: (1) when the phone will not ask again, the screen shows **Open settings** and no **Allow camera**; (2) an empty code shows “This QR code is empty.” and plays the **Error** vibration. **Check** also runs them on a broken screen.',
  files: { [SCREEN_TEST_FILE]: SCREEN_STARTER, [FAKE_CAMERA_FILE]: FAKE_CAMERA, ...projectFiles() },
  checks: [
    {
      id: 'settings-test',
      label: 'a test gives the permission `canAskAgain: false` and looks for **Open settings**',
      fail: 'TODO 1: `givePermission({ granted: false, canAskAgain: false });`, render the screen, then `expect(screen.getByRole(\'button\', { name: \'Open settings\' })).toBeOnTheScreen();`',
      static: (c) => /canAskAgain:\s*false/.test(code(c.files, SCREEN_TEST_FILE)) && /Open settings/.test(code(c.files, SCREEN_TEST_FILE)),
    },
    {
      id: 'empty-test',
      label: 'a test presses `fake-scan-empty` and expects the Error vibration',
      fail: 'TODO 2: `await user.press(screen.getByTestId(\'fake-scan-empty\'));` then `expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);`',
      static: (c) => /fake-scan-empty/.test(code(c.files, SCREEN_TEST_FILE)) && /NotificationFeedbackType\.Error/.test(code(c.files, SCREEN_TEST_FILE)),
    },
    {
      id: 'pass',
      label: 'all the tests pass on the real screen (5 or more)',
      fail: 'Press **Run tests** and fix the test that fails.',
      run: (c) => allPass(c, [SCREEN_TEST_FILE], 5),
    },
    {
      id: 'catches-settings',
      label: 'your tests fail when the screen never offers Open settings',
      fail: 'Your tests still pass on a screen that always shows Allow camera. Check the button that must NOT be there too: `expect(screen.queryByRole(\'button\', { name: \'Allow camera\' })).not.toBeOnTheScreen();`',
      run: (c) =>
        catches(c, { [SCREEN]: must(SCANNER, '{permission.canAskAgain ? (', '{true ? (') }, [SCREEN_TEST_FILE], 'Your tests still pass on a screen that always shows Allow camera. Look for the Open settings button: `screen.getByRole(\'button\', { name: \'Open settings\' })`.'),
    },
    {
      id: 'catches-buzz',
      label: 'your tests fail when an empty code plays the wrong vibration',
      fail: 'Your tests still pass when an empty code plays the Success vibration. Expect the type: `toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error)`.',
      run: (c) =>
        catches(c, { [FEEDBACK_FILE]: must(FEEDBACK, 'Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)', 'Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)') }, [SCREEN_TEST_FILE], 'Your tests still pass when an empty code plays the Success vibration. Expect the type: `toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error)`.'),
    },
  ],
  hints: [
    'Start each test like the first one: `givePermission({ … });` then `await render(<ScannerScreen onBack={jest.fn()} />);`',
    'TODO 1: `getByRole(\'button\', { name: \'Open settings\' })` must be there; `queryByRole(\'button\', { name: \'Allow camera\' })` must `.not.toBeOnTheScreen()`.',
    'TODO 2 is the website test with `fake-scan-empty`, the text `This QR code is empty.` and `NotificationFeedbackType.Error`.',
  ],
  solution: {
    explain: 'Each test sets the fake permission, draws the screen, acts like a user and checks what the user would see (and what the phone would feel).',
    files: { [SCREEN_TEST_FILE]: SCREEN_TEST },
  },
  success: 'These are the tests a real project runs on every change: Check ran them on a screen without the Open settings branch and on one with the wrong vibration, and both broken screens were caught.',
};

/* ------------------------------------------------------------------ Exercise: finish the Maestro flow and run it */

const FLOW_STARTER = must(
  MAESTRO_FLOW,
  `- assertVisible: "https://expo.dev"
- assertVisible:
    id: "scan-again"
- takeScreenshot: scan-result
`,
  `# TODO: check that the result card shows https://expo.dev and the Scan again button (id: scan-again),
#       then take a screenshot named scan-result
`,
);

export const exMaestroRun: CodeExercise = {
  id: id('maestro-run'),
  n: 16,
  title: 'Finish the flow and run it',
  minutes: 7,
  level: 5,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  freshDevice: true,
  runner: { kind: 'flow', files: [FLOW_FILE] },
  prompt:
    'The flow opens the app, allows the camera and presses **Use sample QR**, but checks nothing yet. Replace the **TODO** with three steps: the text `https://expo.dev` is visible, the element with the id `scan-again` is visible, and a screenshot named `scan-result`. Press **Run flow** and watch the phone.',
  files: { [FLOW_FILE]: FLOW_STARTER, ...projectFiles() },
  checks: [
    {
      id: 'text',
      label: '`assertVisible: "https://expo.dev"`',
      fail: 'Add the line `- assertVisible: "https://expo.dev"` after the tap on sample-scan.',
      static: (c) => /^\s*-\s*assertVisible:\s*["']?https:\/\/expo\.dev["']?\s*$/m.test(c.files[FLOW_FILE] ?? ''),
    },
    {
      id: 'id',
      label: 'the Scan again button, found by its id `scan-again`',
      fail: 'Add `- assertVisible:` with `id: "scan-again"` indented under it (or `- assertVisible: { id: "scan-again" }`).',
      static: (c) => /assertVisible:[\s\S]{0,40}id:\s*["']?scan-again/.test(c.files[FLOW_FILE] ?? ''),
    },
    {
      id: 'shot',
      label: '`takeScreenshot: scan-result` at the end',
      fail: 'Last line: `- takeScreenshot: scan-result`',
      static: (c) => /-\s*takeScreenshot:\s*["']?scan-result/.test(c.files[FLOW_FILE] ?? ''),
    },
    {
      id: 'passes',
      label: 'the flow passes on the phone, from a new phone to the result',
      fail: 'Press **Run flow** and read the step that failed.',
      run: async (c) => {
        const r = await runFlow(c.files[FLOW_FILE] ?? '', c.app, { name: 'scan-sample' });
        if (r.error) return r.error;
        if (r.ok) return true;
        const failed = r.steps.at(-1);
        return `Step **${failed?.text}** failed (line ${failed?.line}): ${failed?.detail ?? ''}`;
      },
    },
  ],
  hints: [
    'Each step starts with `- `. A text in quotes is matched against the whole text on the screen.',
    'By id: `- assertVisible:` and on the next line, indented by 4 spaces, `id: "scan-again"`.',
    'The three lines: `- assertVisible: "https://expo.dev"`, then the id step, then `- takeScreenshot: scan-result`.',
  ],
  solution: {
    explain: 'A flow does what a user does, then checks what a user sees. The id finds the button even if its words change later.',
    files: { [FLOW_FILE]: MAESTRO_FLOW },
  },
  success: 'This is the same file that passed on a real Android emulator with `maestro test` (Part 7 shows that run): the steps and their order do not change.',
};

export { UNIT_STARTER, SCREEN_STARTER, FLOW_STARTER };
