/**
 * Lab 07 · Part 10 — the final challenge: a Wi-Fi code shows the network name, never the password, and a unit test
 * that proves it (it passes on the fix and fails on the old parseScan). Exercise 21 (9 min).
 */
import type { RunContext } from '../../engine/checks.ts';
import type { CodeExercise } from '../types.ts';
import { LAB_ID } from './meta.ts';
import { PARSE_SCAN, PARSE_TEST, projectFiles } from './project.ts';
import { UNIT_TEST, allPass, catches } from './runners.ts';
import { PARSE_FILE, code, openCamera, scan, waitForResult, waitForText } from './shared.ts';

const id = (name: string) => `${LAB_ID}--${name}`;

const WIFI_NOW = `  if (lower.startsWith('wifi:')) {
    return { ok: true, kind: 'wifi', label: 'Wi-Fi network', value };
  }`;

/** parseScan.ts as the project has it, with the challenge written above the Wi-Fi line */
export const PARSE_FINAL_STARTER = PARSE_SCAN.replace(
  WIFI_NOW,
  `  if (lower.startsWith('wifi:')) {
    // FINAL CHALLENGE: this shows the whole code, password included: "WIFI:S:Lab-5G;T:WPA;P:secret123;;"
    // Show only the network name: the text after "S:", up to the next ";". No name in the code? Show "Hidden network".
    return { ok: true, kind: 'wifi', label: 'Wi-Fi network', value };
  }`,
);

export const PARSE_FINAL_SOLUTION = PARSE_SCAN.replace(
  WIFI_NOW,
  `  if (lower.startsWith('wifi:')) {
    // "WIFI:S:Lab-5G;T:WPA;P:secret123;;" → the text after "WIFI:", cut at each ";"
    const fields = value.slice(5).split(';');
    // the field that starts with "S:" holds the network name ("S:Lab-5G")
    const nameField = fields.find((field) => field.startsWith('S:'));
    const name = nameField ? nameField.slice(2) : '';
    return { ok: true, kind: 'wifi', label: 'Wi-Fi network', value: name || 'Hidden network' };
  }`,
);

const LAST = '\n});\n';
if (!PARSE_TEST.endsWith(LAST)) throw new Error('lab-07 final: the unit test file changed');
/** the unit tests, with the place for the final challenge's test */
export const PARSE_TEST_FINAL_STARTER = `${PARSE_TEST.slice(0, -LAST.length)}\n\n  // TODO (final challenge): a Wi-Fi code shows the network name, never the password${LAST}`;
export const PARSE_TEST_FINAL_SOLUTION = `${PARSE_TEST.slice(0, -LAST.length)}

  test('a Wi-Fi code shows the network name, never the password', () => {
    const result = parseScan('WIFI:S:Lab-5G;T:WPA;P:secret123;;');
    expect(result).toMatchObject({ ok: true, kind: 'wifi', value: 'Lab-5G' });
  });${LAST}`;

/** Home → camera → QR: Wi-Fi; the result card's text, or null when the camera did not open */
async function scanWifi(c: RunContext) {
  const cam = await openCamera(c.app);
  if (!cam.ok) return null;
  await scan(c.app, 'Wi-Fi');
  return waitForResult(c.app);
}

export const ex17: CodeExercise = {
  id: id('wifi-name'),
  n: 21,
  title: 'Final: the Wi-Fi name, never the password',
  minutes: 9,
  level: 6,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  freshDevice: true,
  runner: { kind: 'tests', files: [UNIT_TEST] },
  prompt:
    'Scan **QR: Wi-Fi**: the result card shows the whole code, **password included**. (1) In `src/scan/parseScan.ts`, make a Wi-Fi code show only the network name (`Lab-5G`), and “Hidden network” when the code has no name; every other kind of code must still work. (2) In the test file, replace the **TODO** with a test that proves it, and press **Run tests**.',
  files: { [PARSE_FILE]: PARSE_FINAL_STARTER, [UNIT_TEST]: PARSE_TEST_FINAL_STARTER, ...projectFiles() },
  checks: [
    {
      id: 'name',
      label: 'QR: Wi-Fi → “Wi-Fi network” and `Lab-5G`',
      fail: 'For a Wi-Fi code, `value` should be the network name: the text after `S:` up to the next `;`.',
      run: async (c) => {
        const t = await scanWifi(c);
        if (t === null) return 'The camera did not open, so this could not be tested.';
        if (!/Scan again/.test(t)) return 'The Wi-Fi code did not show a result card. Does parseScan still return `{ ok: true, kind: \'wifi\', … }`?';
        if (!/Wi-Fi network/i.test(t)) return 'The card should still say **Wi-Fi network** (the label).';
        return /Lab-5G/.test(t) && !/S:Lab-5G/.test(t);
      },
    },
    {
      id: 'secret',
      label: 'the password (`secret123`) is never on the screen',
      fail: 'The card still shows the password. Return the name only: `value: name`.',
      run: async (c) => {
        const t = await scanWifi(c);
        if (t === null) return 'The camera did not open, so this could not be tested.';
        if (/secret123/.test(t)) return 'The password **secret123** is on the screen. Return the network name only.';
        return !/WIFI:/i.test(t) || 'The raw code (`WIFI:…`) is on the screen. Return the network name only.';
      },
    },
    {
      id: 'hidden',
      label: 'a Wi-Fi code without a name gives “Hidden network”',
      fail: 'When there is no `S:` field: `value: name || \'Hidden network\'`.',
      static: (c) => /Hidden network/.test(code(c.files, PARSE_FILE)),
    },
    {
      id: 'others',
      label: 'websites, text and empty codes work as before',
      fail: 'Only the Wi-Fi branch should change.',
      run: async (c) => {
        const cam = await openCamera(c.app);
        if (!cam.ok) return 'The camera did not open, so this could not be tested.';
        await scan(c.app, 'Website');
        if (!/https:\/\/expo\.dev/.test(await waitForResult(c.app))) return 'QR: Website no longer shows https://expo.dev.';
        await c.app.press({ text: 'Scan again' });
        await waitForText(c.app, (x) => /Back camera|Front camera/.test(x), 2000);
        await scan(c.app, 'Text');
        if (!/Room 3\.12/.test(await waitForResult(c.app))) return 'QR: Text no longer shows Room 3.12.';
        await c.app.press({ text: 'Scan again' });
        await waitForText(c.app, (x) => /Back camera|Front camera/.test(x), 2000);
        await scan(c.app, 'Empty code');
        return /This QR code is empty\./.test(await waitForResult(c.app)) || 'An empty code no longer shows “This QR code is empty.”';
      },
    },
    {
      id: 'test-written',
      label: 'a new test expects the network name `Lab-5G` on its own',
      fail: "In place of the TODO: a test with `parseScan('WIFI:S:Lab-5G;T:WPA;P:secret123;;')` that expects `value: 'Lab-5G'`.",
      // the old tests only use Lab-5G inside the whole Wi-Fi code; the new one expects the name as its own text
      static: (c) => /['"`]Lab-5G['"`]/.test(code(c.files, UNIT_TEST)),
    },
    {
      id: 'test-passes',
      label: 'all the unit tests pass on your fixed parseScan (8 or more)',
      fail: 'Press **Run tests** and fix the test that fails.',
      run: (c) => allPass(c, [UNIT_TEST], 8),
    },
    {
      id: 'test-proves',
      label: 'your new test fails on the old parseScan (the one that showed the password)',
      fail: "Your tests still pass on the old parseScan. Expect the name: `expect(result).toMatchObject({ kind: 'wifi', value: 'Lab-5G' });`",
      run: (c) => catches(c, { [PARSE_FILE]: PARSE_SCAN }, [UNIT_TEST], "Your tests still pass on the old parseScan, which shows the password. Expect the name: `expect(result).toMatchObject({ kind: 'wifi', value: 'Lab-5G' });`"),
    },
  ],
  hints: [
    'Cut the text after `WIFI:` into fields: `value.slice(5).split(\';\')` gives `[\'S:Lab-5G\', \'T:WPA\', \'P:secret123\', \'\', \'\']`.',
    'Find the field that starts with `S:` (`fields.find(…)`), then drop those two letters with `.slice(2)`.',
    'Return `value: name || \'Hidden network\'`: an empty name falls back to the text.',
  ],
  solution: {
    explain: 'A Wi-Fi QR code is fields separated by `;`. The app keeps the field it needs (S: the name) and never puts the password (P:) on the screen.',
    files: { [PARSE_FILE]: PARSE_FINAL_SOLUTION, [UNIT_TEST]: PARSE_TEST_FINAL_SOLUTION },
  },
  success: 'A real change, finished: the fix, a test that fails without it, and the decision how it ships. Only JavaScript changed, so `eas update` is enough.',
  challenge: "Test the hidden network too: `expect(parseScan('WIFI:T:WPA;P:x;;')).toMatchObject({ value: 'Hidden network' });` and press Run tests.",
};
