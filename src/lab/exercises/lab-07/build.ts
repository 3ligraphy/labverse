/**
 * Lab 07 · Part 4 — build the scanner in four steps, in the real project's files (src/screens/ScannerScreen.tsx,
 * src/scan/feedback.ts). Exercises 5–8 (6 + 7 + 5 + 4 = 22 min). Every check starts on a fresh phone: the camera
 * permission was never asked.
 */
import type { CodeExercise } from '../types.ts';
import { LAB_ID } from './meta.ts';
import { FEEDBACK, FEEDBACK_STARTER, SCANNER, SCANNER_A, SCANNER_B, SCANNER_D, projectFiles } from './project.ts';
import { FEEDBACK_FILE, SCREEN, code, esc, lines, openCamera, scan, until, waitForResult, waitForText } from './shared.ts';

const id = (name: string) => `${LAB_ID}--${name}`;

/** the names the student gave the hook's two values, e.g. ['permission', 'requestPermission'] */
const hookNames = (src: string) => /const\s*\[\s*(\w+)\s*,\s*(\w+)\s*(?:,\s*\w+\s*)?\]\s*=\s*useCameraPermissions\s*\(\s*\)/.exec(src);

/* ------------------------------------------------------------------ Step A */

export const ex05: CodeExercise = {
  id: id('step-a-permission'),
  n: 5,
  title: 'Step A · Ask for the camera',
  minutes: 6,
  level: 4,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  freshDevice: true,
  prompt:
    'The scanner opens the camera **without asking**, so it shows “Camera error: Camera permission is not granted”. Write the Step A code from the walk-through above (the lines marked **+**) in `ScannerScreen.tsx`, at the three **TODO Step A** comments: read the permission with `useCameraPermissions()`, show “Checking camera permission…” while it is `null`, and when it is not granted show “Camera permission needed” with **Allow camera** (or **Open settings** when the phone will not ask again). Try it: press **Start scanning**, then answer the dialog.',
  files: projectFiles(SCANNER_A),
  checks: [
    {
      id: 'hook',
      label: 'reads the permission with `useCameraPermissions()`',
      fail: 'First line inside the component: `const [permission, requestPermission] = useCameraPermissions();`',
      static: (c) => Boolean(hookNames(code(c.files, SCREEN))),
    },
    {
      id: 'loading',
      label: 'shows “Checking camera permission…” while the permission is `null`',
      fail: 'Before anything else: `if (!permission) { return ( … <Text>Checking camera permission…</Text> … ); }`',
      static: (c) => {
        const src = code(c.files, SCREEN);
        const p = hookNames(src)?.[1] ?? 'permission';
        return /Checking camera permission/.test(src) && new RegExp(`!\\s*${esc(p)}\\s*\\)|${esc(p)}\\s*===?\\s*null`).test(src);
      },
    },
    {
      id: 'ask',
      label: 'Start scanning → Camera permission needed → Allow camera → the phone’s dialog → the camera opens',
      fail: 'Follow the path: “Camera permission needed”, a button **Allow camera** that calls `requestPermission`, and the camera after the user allows.',
      run: async (c) => {
        await c.app.press({ text: 'Start scanning' });
        const t = await waitForText(c.app, (x) => /Camera permission needed|Back camera|Camera error|Camera off/.test(x), 3000);
        if (!/Camera permission needed/.test(t)) {
          return /Camera error|Camera off/.test(t)
            ? 'The camera opened without permission. Before the camera: `if (!permission.granted) { return ( … “Camera permission needed” … ); }`'
            : 'After Start scanning the screen should say **Camera permission needed** (the permission is not granted yet on a new phone).';
        }
        if (!(await c.app.press({ text: 'Allow camera' }))) return 'There is no **Allow camera** button. Add `<AppButton title="Allow camera" testID="allow-camera" onPress={requestPermission} />`.';
        const dialog = await waitForText(c.app, (x) => /While using the app/.test(x), 2000);
        if (!/While using the app/.test(dialog)) return 'Allow camera did not show the phone’s dialog: its `onPress` must be `requestPermission`.';
        await c.app.press({ text: 'While using the app' });
        const on = await waitForText(c.app, (x) => /Back camera/.test(x), 3000);
        return /Back camera/.test(on) || 'The user allowed the camera, but it did not open. Show the camera when `permission.granted` is true.';
      },
    },
    {
      id: 'settings',
      label: 'after two “Don’t allow”: **Open settings** opens the phone’s Settings (`Linking.openSettings()`)',
      fail: 'When `permission.canAskAgain` is false, show **Open settings** with `onPress={() => Linking.openSettings()}` instead of Allow camera.',
      run: async (c) => {
        // a new phone again: the permission was never asked
        await c.app.resetDevice?.();
        await c.app.rerun();
        await c.app.press({ text: 'Start scanning' });
        for (let refusal = 0; refusal < 2; refusal += 1) {
          await waitForText(c.app, (x) => /Allow camera|Open settings/.test(x), 3000);
          if (!(await c.app.press({ text: 'Allow camera' }))) break;
          await waitForText(c.app, (x) => /Don’t allow/.test(x), 2000);
          await c.app.press({ text: 'Don’t allow' });
        }
        const t = await waitForText(c.app, (x) => /Open settings/.test(x), 2500);
        if (!/Open settings/.test(t)) return 'After two “Don’t allow” the phone stops asking (`canAskAgain` is false), but the screen still offers Allow camera. Show **Open settings** in that case: `permission.canAskAgain ? (…Allow camera…) : (…Open settings…)`.';
        await c.app.press({ text: 'Open settings' });
        const opened = await until(c.app, () => c.app.logs(), (l) => l.some((x) => x.startsWith('Linking: openSettings')), 2000);
        if (!opened.some((x) => x.startsWith('Linking: openSettings'))) return 'Open settings did nothing: `onPress={() => Linking.openSettings()}`.';
        // the user turns the camera on in Settings: the app must follow
        await c.app.press({ text: 'Allow only while using the app' });
        const on = await waitForText(c.app, (x) => /Back camera/.test(x), 2500);
        return /Back camera/.test(on) || 'The camera was allowed in Settings, but the app did not open it. Show the camera whenever `permission.granted` is true.';
      },
    },
  ],
  hints: [
    'The hook gives two things in an array: `const [permission, requestPermission] = useCameraPermissions();`',
    'Three states, three returns, in this order: `if (!permission)` → loading · `if (!permission.granted)` → ask · otherwise → the camera.',
    'Inside the “not granted” return: `{permission.canAskAgain ? <AppButton title="Allow camera" … onPress={requestPermission} /> : <AppButton title="Open settings" … onPress={() => Linking.openSettings()} />}`',
  ],
  solution: {
    explain: 'The permission has three states: not known yet (`null`), not granted (ask, or send the user to Settings), granted (the camera). The screen returns one view per state, in that order.',
    files: { [SCREEN]: SCANNER_B },
  },
  success: 'This is how every app asks for a phone feature: explain why, ask once, and when the user says no for good, show the way to Settings. The same pattern works for the microphone, location and photos.',
  challenge: 'Press **Don’t allow** twice, then **Open settings**: in the fake Settings page choose **Ask every time**. What does the app show now, and why?',
};

/* ------------------------------------------------------------------ Step B */

export const ex06: CodeExercise = {
  id: id('step-b-scan-once'),
  n: 6,
  title: 'Step B · Read a code, once',
  minutes: 7,
  level: 5,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  freshDevice: true,
  prompt:
    'The camera works but reads nothing. Write the Step B code from the walk-through above at the four **TODO Step B** comments: give `CameraView` the two props that read QR codes and send each one to `handleScan`, then add a **lock** (`useRef`) so one code is handled once — and opened again by **Scan again**. Try it: open the camera and press **QR: Website**. Watch the **Console**: each `Scanned:` line is one call of `handleScan`.',
  files: projectFiles(SCANNER_B),
  checks: [
    {
      id: 'qr-only',
      label: '`barcodeScannerSettings={{ barcodeTypes: [\'qr\'] }}`: the camera looks for QR codes only',
      fail: 'On `<CameraView …>`: `barcodeScannerSettings={{ barcodeTypes: [\'qr\'] }}`',
      static: (c) => /barcodeScannerSettings\s*=\s*\{\s*\{\s*barcodeTypes\s*:\s*\[\s*['"]qr['"]\s*\]\s*\}\s*\}/.test(code(c.files, SCREEN)),
    },
    {
      id: 'result',
      label: 'QR: Website → the result card shows `https://expo.dev`',
      fail: 'On `<CameraView …>`: `onBarcodeScanned={(scan) => handleScan(scan.data)}`. `scan.data` is the text inside the QR code.',
      run: async (c) => {
        const cam = await openCamera(c.app);
        if (!cam.ok) return `The camera did not open (the screen shows: ${cam.text.slice(0, 80)}). Step A must still work.`;
        await scan(c.app, 'Website');
        const t = await waitForResult(c.app);
        if (!/Scan again/.test(t)) return 'Nothing happened when the code was read. Send each read to handleScan: `onBarcodeScanned={(scan) => handleScan(scan.data)}`.';
        return /https:\/\/expo\.dev/.test(t) || 'A result appeared, but not the code’s text. Pass `scan.data` (the text in the code) to handleScan.';
      },
    },
    {
      id: 'once',
      label: 'one code → `handleScan` works once (one `Scanned:` line, not three)',
      fail: 'Add the lock: `const locked = useRef(false);` and in handleScan `if (locked.current) return; locked.current = true;`',
      run: async (c) => {
        const cam = await openCamera(c.app);
        if (!cam.ok) return 'The camera did not open, so this could not be tested.';
        await scan(c.app, 'Website');
        await waitForResult(c.app);
        await c.app.wait(150);
        const scanned = await lines(c.app, 'Scanned:');
        if (scanned.length > 1) return `The camera read the code ${scanned.length} times and handleScan worked ${scanned.length} times (${scanned.length} “Scanned:” lines). Close a lock on the first one: \`if (locked.current) return; locked.current = true;\``;
        if (scanned.length === 1) return true;
        // the student removed the log line: read the code instead
        const src = code(c.files, SCREEN);
        const lock = /const\s+(\w+)\s*=\s*useRef(?:<boolean>)?\s*\(\s*false\s*\)/.exec(src)?.[1];
        return Boolean(lock && new RegExp(`if\\s*\\(\\s*${esc(lock)}\\.current\\s*\\)\\s*return`).test(src) && new RegExp(`${esc(lock)}\\.current\\s*=\\s*true`).test(src));
      },
    },
    {
      id: 'again',
      label: 'Scan again → the camera reads the next code (QR: Text → `Room 3.12`)',
      fail: 'In scanAgain, open the lock before going back to the camera: `locked.current = false;`',
      run: async (c) => {
        const cam = await openCamera(c.app);
        if (!cam.ok) return 'The camera did not open, so this could not be tested.';
        await scan(c.app, 'Website');
        if (!/Scan again/.test(await waitForResult(c.app))) return 'The first code was not handled, so Scan again could not be tested.';
        await c.app.press({ text: 'Scan again' });
        const back = await waitForText(c.app, (x) => /Back camera|Front camera/.test(x), 2500);
        if (!/Back camera|Front camera/.test(back)) return 'Scan again did not go back to the camera: `setResult(null)` in scanAgain.';
        await scan(c.app, 'Text');
        const t = await waitForResult(c.app, 2500);
        return /Room 3\.12/.test(t) || 'After Scan again the next code is ignored: the lock is still closed. In scanAgain: `locked.current = false;`';
      },
    },
  ],
  hints: [
    'Two props on CameraView: `barcodeScannerSettings={{ barcodeTypes: [\'qr\'] }}` and `onBarcodeScanned={(scan) => handleScan(scan.data)}`.',
    'A lock that changes without drawing the screen again is a ref: `const locked = useRef(false);` next to the other hooks.',
    'handleScan starts with `if (locked.current) return;` then `locked.current = true;`. scanAgain starts with `locked.current = false;`.',
  ],
  solution: {
    explain: 'The camera calls `onBarcodeScanned` for every read, many times a second. A `useRef` changes at once (a state change waits for the next render), so the second and third reads find the lock closed and stop.',
    files: { [SCREEN]: SCANNER_D },
  },
  success: 'Here the extra calls only set the same result. In an app whose handleScan opens a link or saves to a server, each extra call would open it or save it again: the lock prevents that.',
  challenge: 'Change `useRef(false)` to a `useState(false)` lock and press QR: Website. How many `Scanned:` lines now? (The new state only arrives at the next render, after all three reads.)',
};

/* ------------------------------------------------------------------ Step C */

export const ex07: CodeExercise = {
  id: id('step-c-feedback'),
  n: 7,
  title: 'Step C · Feel the result',
  minutes: 5,
  level: 4,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  freshDevice: true,
  prompt:
    'The result card calls `successFeedback()` or `errorFeedback()` when it opens, but both are empty. Write the Step C code from the walk-through above in `src/scan/feedback.ts`: make them play the phone’s **Success** and **Error** vibrations, inside `try / catch` like `tapFeedback`. In the preview a vibration shakes the phone and writes `Haptics: …` in the **Console**.',
  files: { [FEEDBACK_FILE]: FEEDBACK_STARTER, ...projectFiles(SCANNER_D, FEEDBACK_STARTER) },
  checks: [
    {
      id: 'calls',
      label: '`successFeedback` plays `NotificationFeedbackType.Success`, `errorFeedback` plays `.Error`',
      fail: 'In successFeedback: `await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);` — in errorFeedback the same with `.Error`.',
      static: (c) => {
        const src = code(c.files, FEEDBACK_FILE);
        const body = (name: string) => new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}`).exec(src)?.[1] ?? '';
        const plays = (b: string, type: string) => new RegExp(`notificationAsync\\s*\\(\\s*Haptics\\.NotificationFeedbackType\\.${type}\\s*\\)`).test(b);
        const s = body('successFeedback'), e = body('errorFeedback');
        if (plays(s, 'Error') || plays(e, 'Success')) return 'The two patterns are swapped: Success goes in successFeedback, Error in errorFeedback.';
        return plays(s, 'Success') && plays(e, 'Error');
      },
    },
    {
      id: 'safe',
      label: 'both calls are inside `try / catch` (a phone with no vibration motor must not crash the app)',
      fail: 'Copy the shape of tapFeedback: `try { await Haptics.notificationAsync(…); } catch { }`',
      static: (c) => {
        const src = code(c.files, FEEDBACK_FILE);
        const body = (name: string) => new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}`).exec(src)?.[1] ?? '';
        return ['successFeedback', 'errorFeedback'].every((n) => /\btry\s*\{/.test(body(n)) && /\bcatch\b/.test(body(n)));
      },
    },
    {
      id: 'success-buzz',
      label: 'QR: Website → one Success vibration',
      fail: 'After a good code the Console should show `Haptics: notification success` once.',
      run: async (c) => {
        const cam = await openCamera(c.app);
        if (!cam.ok) return 'The camera did not open, so this could not be tested.';
        await scan(c.app, 'Website');
        await waitForResult(c.app);
        const buzz = await until(c.app, () => lines(c.app, 'Haptics: '), (l) => l.length > 0, 1500);
        if (buzz.includes('Haptics: notification error')) return 'A good code played the **Error** vibration. successFeedback must use `NotificationFeedbackType.Success`.';
        const n = buzz.filter((l) => l === 'Haptics: notification success').length;
        return n === 1 || (n > 1 ? `The phone vibrated ${n} times for one code. Vibrate once.` : 'No vibration after a good code. Fill successFeedback.');
      },
    },
    {
      id: 'error-buzz',
      label: 'QR: Empty code → “This QR code is empty.” and one Error vibration',
      fail: 'After an empty code the Console should show `Haptics: notification error`.',
      run: async (c) => {
        const cam = await openCamera(c.app);
        if (!cam.ok) return 'The camera did not open, so this could not be tested.';
        await scan(c.app, 'Empty code');
        const t = await waitForResult(c.app);
        if (!/This QR code is empty\./.test(t)) return 'The empty code did not show its error card.';
        const buzz = await until(c.app, () => lines(c.app, 'Haptics: '), (l) => l.length > 0, 1500);
        if (buzz.includes('Haptics: notification success')) return 'An empty code played the **Success** vibration. errorFeedback must use `NotificationFeedbackType.Error`.';
        return buzz.includes('Haptics: notification error') || 'No vibration after an empty code. Fill errorFeedback.';
      },
    },
  ],
  hints: [
    'Import is already there: `import * as Haptics from \'expo-haptics\';`. The function is `Haptics.notificationAsync(type)`.',
    'The type is `Haptics.NotificationFeedbackType.Success` (or `.Error`).',
    'Copy tapFeedback’s body into each function and change one line: `await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);`',
  ],
  solution: {
    explain: 'One function per meaning keeps the screens simple: they call `successFeedback()` and do not need to know about haptics. `try / catch` keeps the app working on a phone that cannot vibrate.',
    files: { [FEEDBACK_FILE]: FEEDBACK },
  },
  success: 'The vibration plays in ResultCard, after the camera closed: on an iPhone, haptics are off while the camera is active, so a buzz in handleScan would never be felt there.',
};

/* ------------------------------------------------------------------ Step D */

export const ex08: CodeExercise = {
  id: id('step-d-flip'),
  n: 8,
  title: 'Step D · Flip the camera',
  minutes: 4,
  level: 4,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  freshDevice: true,
  prompt: '**Flip camera** does nothing yet. Write the Step D code from the walk-through above at **TODO Step D** in `flipCamera`: a small tap (`tapFeedback()`), then switch `facing` between `\'back\'` and `\'front\'`. The viewfinder says which camera is on.',
  files: projectFiles(SCANNER_D),
  checks: [
    {
      id: 'flip',
      label: 'Flip camera → Front camera → Flip camera → Back camera',
      fail: 'In flipCamera: `setFacing((current) => (current === \'back\' ? \'front\' : \'back\'));`',
      run: async (c) => {
        const cam = await openCamera(c.app);
        if (!cam.ok) return 'The camera did not open, so this could not be tested.';
        await c.app.press({ text: 'Flip camera' });
        const front = await waitForText(c.app, (x) => /Front camera/.test(x), 1500);
        if (!/Front camera/.test(front)) return 'Flip camera did not change the camera. `facing` must change: `setFacing((current) => (current === \'back\' ? \'front\' : \'back\'));`';
        await c.app.press({ text: 'Flip camera' });
        const back = await waitForText(c.app, (x) => /Back camera/.test(x), 1500);
        return /Back camera/.test(back) || 'The second press did not go back to the back camera. Switch both ways: back → front and front → back.';
      },
    },
    {
      id: 'tap',
      label: 'each flip plays the small selection tap (`Haptics: selection`)',
      fail: 'First line of flipCamera: `tapFeedback();`',
      run: async (c) => {
        const cam = await openCamera(c.app);
        if (!cam.ok) return 'The camera did not open, so this could not be tested.';
        await c.app.press({ text: 'Flip camera' });
        const buzz = await until(c.app, () => lines(c.app, 'Haptics: '), (l) => l.includes('Haptics: selection'), 1500);
        return buzz.includes('Haptics: selection');
      },
    },
  ],
  hints: [
    '`facing` is state: change it with `setFacing`.',
    'Give setFacing a function: it gets the current value and returns the new one.',
    '`tapFeedback();` then `setFacing((current) => (current === \'back\' ? \'front\' : \'back\'));`',
  ],
  solution: {
    explain: 'The function form of `setFacing` always starts from the newest value, so two fast presses flip twice. The selection tap tells the finger that something changed.',
    files: { [SCREEN]: SCANNER },
  },
  success: 'The scanner is complete: the same files run in Expo Go on your phone. A real camera turns around; on an iPhone the tap is skipped while the camera is on.',
};
