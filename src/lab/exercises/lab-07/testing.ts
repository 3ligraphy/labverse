/** Lab 07 · Parts 5–7 — testing: which layer, reading Jest, RNTL tools, test order, the Maestro flow. Exercises 9, 10, 12, 13, 15. */
import type { MatchExercise, OrderExercise, PredictExercise } from '../types.ts';
import { LAB_ID } from './meta.ts';

const id = (name: string) => `${LAB_ID}--${name}`;

export const ex09: MatchExercise = {
  id: id('test-layers'),
  n: 9,
  title: 'Which test catches this bug?',
  minutes: 4,
  level: 4,
  kind: 'match',
  prompt: 'Four bugs in Smart QR. Drag the kind of test that catches each one **first** (the fastest test that can see it). One chip catches none of them.',
  pairs: [
    { chip: 'Unit test (Jest)', target: '`parseScan(\'tel:+20100…\')` gives kind “text” instead of “phone”', why: 'One function, one input, one expected output: a unit test runs it in milliseconds.' },
    { chip: 'Component test (React Native Testing Library)', target: 'When the phone will not ask again, the screen still shows Allow camera instead of Open settings', why: 'One screen with a fake permission: the test draws it and reads its buttons.' },
    { chip: 'End-to-end test (Maestro)', target: 'In the real app on the emulator, Start scanning leads to a white screen', why: 'Only the real app on a real (or emulated) phone shows that all the parts work together.' },
    { chip: 'A person with a real phone', target: 'The success vibration is too weak to notice', why: 'No test can feel a vibration. Some checks need a human and a real device.' },
  ],
  decoys: [{ chip: 'A type check (npx tsc)', why: 'TypeScript finds wrong types (a missing prop, a typo in a name). These four bugs type-check fine and still behave wrong.' }],
  hints: [
    'Ask: how much of the app must run to see this bug? One function, one screen, or the whole app on a phone?',
    'A bug inside parseScan needs no screen at all.',
    'Vibration strength is something only a person can judge.',
  ],
  solution: {
    explain: 'Pick the smallest test that can see the bug: it is the fastest to run and points straight at the broken part.',
    text: 'parseScan bug → unit test · Open settings missing → component test · white screen in the real app → Maestro · weak vibration → a person with a real phone · tsc → none of them.',
  },
  success: 'This is why Smart QR has many unit tests, a few component tests and one Maestro flow: fast tests for the details, one slow test for the whole journey.',
};

export const ex10: PredictExercise = {
  id: id('jest-failure'),
  n: 10,
  title: 'Read a failing test',
  minutes: 3,
  level: 4,
  kind: 'predict',
  prompt: 'This is real Jest output from the Smart QR project after one line of a test was changed. Read it, then answer.',
  questions: [
    {
      code: `FAIL __tests__/parseScan-test.ts
  ● parseScan › an empty code is an error

    expect(received).toEqual(expected) // deep equality

    - Expected  - 1
    + Received  + 1

      Object {
    -   "error": "The code is empty.",
    +   "error": "This QR code is empty.",
        "ok": false,
      }`,
      question: 'Which text did `parseScan` (the app’s code) return?',
      options: [
        { text: '"This QR code is empty."', correct: true, why: '**Received** (the + line) is what your code gave. **Expected** (the − line) is what the test asked for.' },
        { text: '"The code is empty."', why: 'That is the Expected line: what the test wanted.' },
        { text: 'Both', why: 'The diff shows one line from each side: − is the test, + is the code.' },
      ],
    },
    {
      code: `// parseScan is right: users should see "This QR code is empty."`,
      question: 'What do you fix?',
      options: [
        { text: 'The test: expect "This QR code is empty."', correct: true, why: 'A failing test means the code and the test disagree. Here the test is the wrong one.' },
        { text: 'parseScan: return "The code is empty."', why: 'Then the app would show a text you decided against, just to please a wrong test.' },
        { text: 'Delete the test', why: 'Then nothing checks the empty-code case any more.' },
      ],
    },
    {
      code: `Tests:       1 failed, 11 passed, 12 total`,
      question: 'What does this line tell you?',
      options: [
        { text: 'One of the 12 tests found a difference; the other 11 still pass', correct: true, why: 'Read the failure above this summary to see which test and why.' },
        { text: 'The app crashes', why: 'Tests run in Node, not on a phone. A failure says code and test disagree, nothing more.' },
        { text: '11 tests failed', why: 'Read it again: 1 failed, 11 passed.' },
      ],
    },
    {
      code: `  28 |   test('an empty code is an error', () => {
> 29 |     expect(parseScan('')).toEqual({ ok: false, error: 'The code is empty.' });
     |                           ^
  30 |     expect(parseScan('    ')).toEqual({ ok: false, error: 'This QR code is empty.' });

  at Object.toEqual (__tests__/parseScan-test.ts:29:27)`,
      question: 'What do the `>`, the `^` and `29:27` show?',
      options: [
        { text: 'The line and the place in the test file where the check failed', correct: true, why: 'Line 29, column 27 of `__tests__/parseScan-test.ts`: the `.toEqual` that failed. The lines around it are there to help you find it.' },
        { text: 'The line of parseScan.ts that has the bug', why: 'The frame points into the test file, at the `expect` that failed.' },
        { text: 'A syntax error', why: 'A syntax error would stop the file from running at all; here the test ran and compared.' },
      ],
    },
  ],
  hints: [
    'In a Jest diff, − (minus) lines are Expected (the test), + (plus) lines are Received (your code).',
    'When a test fails, decide which one is right: the code or the test.',
    'The code frame (with `>` and `^`) always points into the test file.',
  ],
  solution: {
    explain: 'Read a failure in this order: the test name (● …), the diff (− test, + code), then the code frame (where).',
    text: '1 · "This QR code is empty." — 2 · fix the test — 3 · one failed, eleven passed — 4 · the failing line in the test file',
  },
  success: 'You will read many failures. The order is always the same: which test, what differs, where.',
};

export const ex11: MatchExercise = {
  id: id('rntl-match'),
  n: 12,
  title: 'Find, press, check: the test tools',
  minutes: 3,
  level: 5,
  kind: 'match',
  mono: true,
  prompt: 'Drag each line from the Smart QR component test to what it does. One chip works but is not the recommended way: leave it out.',
  pairs: [
    { chip: "screen.getByRole('button', { name: 'Allow camera' })", target: 'Find a button the way a screen reader names it (fails if it is missing)', why: '`getBy…` finds exactly one element or fails. By role and name is how users (and screen readers) find a button.' },
    { chip: "screen.queryByText('Allow camera')", target: 'Check that something is NOT on the screen', why: '`queryBy…` gives `null` instead of failing, so you can write `.not.toBeOnTheScreen()`.' },
    { chip: "await screen.findByText('https://expo.dev')", target: 'Wait for text that appears a moment later', why: '`findBy…` keeps looking for up to a second: the result card appears after the scan.' },
    { chip: 'await user.press(button)', target: 'Press like a finger: press in, then press out', why: '`userEvent.setup()` gives `user`; `user.press` runs the same steps a real touch does.' },
    { chip: "jest.mock('expo-camera', () => require('../test-utils/fakeCamera'))", target: 'Use a fake package in this test file', why: 'Tests have no camera. The fake CameraView has buttons that “scan” a code.' },
    { chip: 'expect(Haptics.notificationAsync).toHaveBeenCalledWith(…Success)', target: 'Check that a function was called with this value', why: '`jest.mock(\'expo-haptics\')` turns every haptics function into a mock that remembers its calls.' },
  ],
  decoys: [{ chip: 'fireEvent.press(button)', why: 'It still works, but it only calls `onPress`. React Native Testing Library recommends `user.press`, which acts like a real touch.' }],
  hints: [
    'getBy = must be there · queryBy = may be missing · findBy = wait for it.',
    '`jest.mock` replaces a package for the whole test file; `toHaveBeenCalledWith` reads what a mock remembers.',
    'The recommended press is the one that comes from `userEvent.setup()`.',
  ],
  solution: {
    explain: 'Find (getBy, queryBy, findBy), act (user.press), check (expect + a matcher), and fake what a computer does not have (jest.mock).',
    text: 'getByRole → find a named button · queryByText → check it is NOT there · findByText → wait for text · user.press → press like a finger · jest.mock → fake package · toHaveBeenCalledWith → a function was called with a value · fireEvent.press → not recommended.',
  },
  success: 'Every line of `__tests__/ScannerScreen-test.tsx` is one of these six.',
};

export const ex12: OrderExercise = {
  id: id('test-order'),
  n: 13,
  title: 'A component test, in order',
  minutes: 2,
  level: 5,
  kind: 'order',
  mono: true,
  prompt: 'Put the lines of the test “a scanned website shows its result and the success vibration” in the order they must run.',
  items: [
    "jest.mock('expo-camera', () => require('../test-utils/fakeCamera'));",
    'givePermission({ granted: true, canAskAgain: true });',
    'await render(<ScannerScreen onBack={jest.fn()} />);',
    'const user = userEvent.setup();',
    "await user.press(screen.getByTestId('fake-scan-website'));",
    "expect(await screen.findByText('https://expo.dev')).toBeOnTheScreen();",
    'expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);',
  ],
  hints: [
    'Prepare (fake package, permission), then draw, then act, then check.',
    'The fake permission must be set before the screen is drawn: the screen reads it while drawing.',
    'Wait for the result text first: the vibration happens when the result card opens.',
  ],
  solution: {
    explain: 'Arrange (mock + permission), render, act (press), assert (wait for the text, then the vibration that came with it).',
    text: 'jest.mock → givePermission → render → userEvent.setup → press → findByText → toHaveBeenCalledWith',
  },
  success: 'Arrange, act, assert: every test you write has these three parts, in this order.',
};

export const ex13: OrderExercise = {
  id: id('maestro-order'),
  n: 15,
  title: 'The Maestro flow, in order',
  minutes: 3,
  level: 5,
  kind: 'order',
  mono: true,
  prompt: 'Put the lines of `.maestro/scan-sample.yaml` in order, so Maestro can drive Smart QR in Expo Go from a fresh start to the result.',
  items: [
    'appId: host.exp.exponent',
    '---',
    '- stopApp',
    '- openLink: ${APP_URL}',
    '- extendedWaitUntil: { visible: "Start scanning", timeout: 60000 }',
    '- tapOn: "Start scanning"',
    '- tapOn: { text: "Allow camera", optional: true }',
    '- tapOn: { id: "sample-scan" }',
    '- assertVisible: "https://expo.dev"',
    '- takeScreenshot: scan-result',
  ],
  hints: [
    'The settings (appId) come first, then the `---` line, then the commands.',
    'Close the app, open your project’s link, and wait for the first screen (the bundle can take a while).',
    'Tap through the app the way a user would, check the result, and keep a picture last.',
  ],
  solution: {
    explain: 'A flow is the settings, `---`, then the steps a user takes. `optional: true` lets the flow go on when the permission was already given.',
    text: 'appId → --- → stopApp → openLink → extendedWaitUntil → tapOn Start scanning → tapOn Allow camera (optional) → tapOn sample-scan → assertVisible → takeScreenshot',
  },
  success: 'In Expo Go the app is Expo Go (`host.exp.exponent`), so the flow opens your project with `openLink`. With your own build (Part 9) it would be `appId: com.yourname.smartqr` and `- launchApp`.',
};
