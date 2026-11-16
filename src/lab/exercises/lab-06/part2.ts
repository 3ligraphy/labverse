/** Lab 06 · Part 2 — key-value storage: AsyncStorage and MMKV. Exercises 2–4 (3 + 8 + 4 = 15 min). */
import type { CodeExercise, PredictExercise } from '../types.ts';
import { LAB_ID } from './meta.ts';
import { asyncValue, code, mmkvRow, until, waitForText } from './shared.ts';

const id = (name: string) => `${LAB_ID}--${name}`;

export const ex02: PredictExercise = {
  id: id('async-predict'),
  n: 2,
  title: 'What does storage give back?',
  minutes: 3,
  level: 2,
  kind: 'predict',
  prompt: 'Read each piece of code and choose what `console.log` prints. Every line runs inside an `async` function.',
  questions: [
    {
      code: `await AsyncStorage.setItem('user', JSON.stringify({ name: 'Mona' }));
const text = await AsyncStorage.getItem('user');
console.log(typeof text);`,
      question: 'What is printed?',
      options: [
        { text: 'string', correct: true, why: 'AsyncStorage gives back exactly what you saved: JSON text. `JSON.parse(text)` turns it into an object again.' },
        { text: 'object', why: 'Only after `JSON.parse(text)`. AsyncStorage itself keeps text.' },
        { text: 'undefined', why: 'The key was saved one line before, so there is a value.' },
      ],
    },
    {
      code: `// nothing was ever saved under 'theme'
const theme = await AsyncStorage.getItem('theme');
console.log(theme);`,
      question: 'What is printed?',
      options: [
        { text: 'null', correct: true, why: 'A key that was never saved gives `null`. Plan for it: `theme ?? \'light\'` gives a default.' },
        { text: 'undefined', why: 'AsyncStorage answers `null` for a missing key, not `undefined`.' },
        { text: 'an empty string', why: 'An empty string would mean you saved `\'\'` before.' },
      ],
    },
    {
      code: `const theme = AsyncStorage.getItem('theme');
console.log(theme);`,
      question: 'What is printed?',
      options: [
        { text: 'a Promise', correct: true, why: 'Without `await` you get the Promise: the answer that comes later. Add `await` to get the text.' },
        { text: 'the saved text', why: 'Reading takes time, so AsyncStorage returns a Promise. Only `await` gives the text.' },
        { text: 'null', why: '`null` comes after `await`, when nothing is saved.' },
      ],
    },
    {
      code: `await AsyncStorage.setItem('count', String(5));
const n = await AsyncStorage.getItem('count');
console.log(n + 1);`,
      question: 'What is printed?',
      options: [
        { text: '51', correct: true, why: '`n` is the text `\'5\'`. Text + 1 joins them: `\'51\'`. Turn it into a number first: `Number(n) + 1` is 6.' },
        { text: '6', why: 'Only with `Number(n) + 1`. AsyncStorage gives back text.' },
        { text: 'an error', why: 'JavaScript joins text and numbers without an error, which is why this bug is easy to miss.' },
      ],
    },
    {
      code: `const storage = createMMKV();
storage.set('count', 5);
console.log(storage.getNumber('count') + 1);`,
      question: 'What is printed (MMKV this time)?',
      options: [
        { text: '6', correct: true, why: 'MMKV keeps the type: a number comes back as a number. And it answers at once, so there is no `await`.' },
        { text: '51', why: 'That is AsyncStorage, which keeps only text. MMKV keeps numbers as numbers.' },
        { text: 'a Promise', why: 'MMKV is synchronous: `getNumber` returns the value at once.' },
      ],
    },
  ],
  hints: [
    'AsyncStorage keeps only text, and every call returns a Promise.',
    'A key that was never saved gives `null`.',
    'Text plus a number joins them: `\'5\' + 1` is `\'51\'`. MMKV keeps the type you saved.',
  ],
  solution: {
    explain: 'Two rules explain all five: AsyncStorage keeps text and answers later (await), MMKV keeps the type and answers at once.',
    text: '1 · string — 2 · null — 3 · a Promise — 4 · 51 — 5 · 6',
  },
  success: 'These are the four AsyncStorage bugs you will meet most: an object saved without `JSON.stringify`, a missing key (`null`), a missing `await`, and a number that came back as text.',
};

/* --------------------------------------------------------------- Exercise 3 */

const SETTINGS_STARTER = `import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Settings = { dark: boolean; size: number };
const DEFAULTS: Settings = { dark: false, size: 16 };
const KEY = 'settings';

export default function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    async function load() {
      // 1. Load: read the text saved under KEY (await AsyncStorage.getItem).
      //    If there is text, turn it back into an object with JSON.parse and call setSettings(…).
      //    Put it in try / catch: reading can fail.
    }
    load();
  }, []);

  async function change(next: Settings) {
    setSettings(next);
    // 2. Save: AsyncStorage keeps text only, so save JSON.stringify(next) under KEY (in try / catch).
  }

  const { dark, size } = settings;
  return (
    <View className={\`flex-1 gap-4 p-6 pt-16 \${dark ? 'bg-slate-900' : 'bg-white'}\`}>
      <Text className={\`text-3xl font-bold \${dark ? 'text-white' : 'text-slate-900'}\`}>Settings</Text>
      <Text style={{ fontSize: size }} className={dark ? 'text-slate-200' : 'text-slate-700'}>Theme: {dark ? 'dark' : 'light'}</Text>
      <Text style={{ fontSize: size }} className={dark ? 'text-slate-200' : 'text-slate-700'}>Text size: {size}</Text>
      <Pressable testID="toggle-dark" onPress={() => change({ ...settings, dark: !dark })} className="items-center rounded-xl bg-indigo-600 py-3">
        <Text className="font-semibold text-white">Switch theme</Text>
      </Pressable>
      <Pressable testID="bigger" onPress={() => change({ ...settings, size: size + 2 })} className="items-center rounded-xl bg-indigo-600 py-3">
        <Text className="font-semibold text-white">Bigger text</Text>
      </Pressable>
    </View>
  );
}
`;

export const SETTINGS_SOLUTION = SETTINGS_STARTER.replace(
  `    async function load() {
      // 1. Load: read the text saved under KEY (await AsyncStorage.getItem).
      //    If there is text, turn it back into an object with JSON.parse and call setSettings(…).
      //    Put it in try / catch: reading can fail.
    }`,
  `    async function load() {
      try {
        const text = await AsyncStorage.getItem(KEY); // the saved JSON text, or null
        if (text) setSettings(JSON.parse(text)); // text → object
      } catch (error) {
        console.warn('Could not load the settings', error);
      }
    }`,
).replace(
  `    setSettings(next);
    // 2. Save: AsyncStorage keeps text only, so save JSON.stringify(next) under KEY (in try / catch).`,
  `    setSettings(next);
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(next)); // object → text
    } catch (error) {
      console.warn('Could not save the settings', error);
    }`,
);

export const ex03: CodeExercise = {
  id: id('settings-async'),
  n: 3,
  title: 'Settings that survive a restart',
  minutes: 8,
  level: 3,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  freshDevice: true,
  prompt: 'The theme and text size live in `useState` only, so **Restart app** loses them. Save them with **AsyncStorage** as JSON text, and load them when the app opens. Try it: change something, then press **Restart app** under the phone and watch **Device storage**.',
  files: { 'App.tsx': SETTINGS_STARTER },
  checks: [
    {
      id: 'save',
      label: 'saves the settings as JSON text with `AsyncStorage.setItem`',
      fail: 'In `change`: `await AsyncStorage.setItem(KEY, JSON.stringify(next));`',
      static: (c) => /AsyncStorage\s*\.\s*setItem\s*\(/.test(code(c.files)) && /JSON\s*\.\s*stringify\s*\(/.test(code(c.files)),
    },
    {
      id: 'load',
      label: 'loads them with `getItem` and `JSON.parse` when the app opens',
      fail: 'In `load`: `const text = await AsyncStorage.getItem(KEY);` then `if (text) setSettings(JSON.parse(text));`',
      static: (c) => /AsyncStorage\s*\.\s*getItem\s*\(/.test(code(c.files)) && /JSON\s*\.\s*parse\s*\(/.test(code(c.files)),
    },
    {
      id: 'errors',
      label: 'reading and saving are inside `try / catch`',
      fail: 'Storage can fail (a full disk, a broken value). Put the `getItem` and the `setItem` lines inside `try { … } catch (error) { … }`.',
      static: (c) => (code(c.files).match(/\btry\s*\{/g) ?? []).length >= 2 && /\bcatch\b/.test(code(c.files)),
    },
    {
      id: 'saved',
      label: 'after Switch theme and Bigger text, AsyncStorage holds `{"dark":true,"size":18}`',
      fail: 'Nothing was saved under `settings`. Save in `change`: `await AsyncStorage.setItem(KEY, JSON.stringify(next));`',
      run: async (c) => {
        await c.app.press({ testID: 'toggle-dark' });
        await c.app.wait(120);
        await c.app.press({ testID: 'bigger' });
        const value = await until(c.app, () => asyncValue(c.app, 'settings'), (v) => v === '{"dark":true,"size":18}');
        if (value === '[object Object]') return 'AsyncStorage got an object, and keeps only text: it saved **[object Object]**. Save `JSON.stringify(next)` instead.';
        if (value && value !== '{"dark":true,"size":18}') return `AsyncStorage holds **${value}**. After Switch theme and Bigger text it should be {"dark":true,"size":18}: save the new settings (\`next\`), not the old ones.`;
        return value === '{"dark":true,"size":18}';
      },
    },
    {
      id: 'restart',
      label: 'after Restart app the screen still shows the dark theme and size 18',
      fail: 'After the restart the screen shows the defaults again. Load in `useEffect`: `getItem(KEY)`, then `setSettings(JSON.parse(text))`.',
      run: async (c) => {
        // the checker restarts the app before this check, like the Restart app button
        const t = await waitForText(c.app, (x) => /Theme: dark/.test(x) && /Text size: 18/.test(x), 4000);
        return /Theme: dark/.test(t) && /Text size: 18/.test(t);
      },
    },
  ],
  hints: [
    'Saving: `await AsyncStorage.setItem(KEY, JSON.stringify(next));` inside `change`, after `setSettings(next)`.',
    'Loading: `const text = await AsyncStorage.getItem(KEY);` — it is `null` the first time, so check `if (text)` before `JSON.parse(text)`.',
    'Wrap both in `try { … } catch (error) { console.warn(…) }`. Then press Switch theme, Bigger text and **Restart app**: the settings stay.',
  ],
  solution: {
    explain: '`change` updates the screen and saves the same object as JSON text. `load` runs once when the app opens: it reads the text, and only if there is some, turns it back into an object. Both are in `try / catch` because storage can fail.',
    files: { 'App.tsx': SETTINGS_SOLUTION },
  },
  success: 'This is the pattern for every small setting: **object → JSON.stringify → setItem** to save, **getItem → JSON.parse → setState** to load. In Device storage you saw the value as plain text: AsyncStorage is a plain file.',
  challenge: 'Add a **Reset** button that calls `AsyncStorage.removeItem(KEY)` and `setSettings(DEFAULTS)`.',
};

/* --------------------------------------------------------------- Exercise 4 */

const MMKV_STARTER = `import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { createMMKV } from 'react-native-mmkv';

// 1. One storage for the whole app: const storage = createMMKV();

export default function App() {
  // 2. Start from the saved value: storage.getBoolean('dark') ?? false
  //    MMKV answers at once (synchronous): no await, no useEffect.
  const [dark, setDark] = useState(false);

  function toggle() {
    const next = !dark;
    setDark(next);
    // 3. Save it: storage.set('dark', next) — a boolean stays a boolean
  }

  return (
    <View className={\`flex-1 items-center justify-center gap-4 p-6 \${dark ? 'bg-slate-900' : 'bg-white'}\`}>
      <Text className={\`text-2xl font-bold \${dark ? 'text-white' : 'text-slate-900'}\`}>{dark ? 'Dark mode' : 'Light mode'}</Text>
      <Pressable testID="toggle" onPress={toggle} className="rounded-xl bg-indigo-600 px-6 py-3">
        <Text className="font-semibold text-white">Switch</Text>
      </Pressable>
    </View>
  );
}
`;

export const MMKV_SOLUTION = MMKV_STARTER.replace(
  '// 1. One storage for the whole app: const storage = createMMKV();',
  'const storage = createMMKV(); // one storage for the whole app',
).replace(
  `  // 2. Start from the saved value: storage.getBoolean('dark') ?? false
  //    MMKV answers at once (synchronous): no await, no useEffect.
  const [dark, setDark] = useState(false);`,
  `  // the saved value, read at once (undefined the first time → false)
  const [dark, setDark] = useState(() => storage.getBoolean('dark') ?? false);`,
).replace(
  `    // 3. Save it: storage.set('dark', next) — a boolean stays a boolean`,
  `    storage.set('dark', next); // saved at once, as a boolean`,
);

export const ex04: CodeExercise = {
  id: id('settings-mmkv'),
  n: 4,
  title: 'The same setting with MMKV',
  minutes: 4,
  level: 3,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  freshDevice: true,
  prompt: 'Save dark mode with **MMKV**: create the storage, start from the saved boolean, and save on every switch. Compare it with Exercise 3: no `await`, no `useEffect`, no JSON.',
  files: { 'App.tsx': MMKV_STARTER },
  checks: [
    {
      id: 'create',
      label: 'creates the storage with `createMMKV()`',
      fail: 'Above the component: `const storage = createMMKV();`',
      static: (c) => /createMMKV\s*\(/.test(code(c.files)),
    },
    {
      id: 'sync',
      label: 'reads with `getBoolean` and writes with `set`, without `await`',
      fail: 'MMKV is synchronous: `storage.getBoolean(\'dark\')` and `storage.set(\'dark\', next)`, with no `await` in front.',
      static: (c) => {
        const src = code(c.files);
        if (/await\s+storage\s*\./.test(src)) return 'MMKV answers at once: remove `await` before `storage.…`.';
        return /\.getBoolean\s*\(\s*['"]dark['"]/.test(src) && /\.set\s*\(\s*['"]dark['"]/.test(src);
      },
    },
    {
      id: 'saved',
      label: 'after Switch, MMKV holds `dark = true` as a boolean',
      fail: 'In `toggle`: `storage.set(\'dark\', next);` (a boolean, not text).',
      run: async (c) => {
        await c.app.press({ testID: 'toggle' });
        const row = await until(c.app, () => mmkvRow(c.app, 'dark'), (r) => r?.value === 'true');
        if (row && row.type !== 'boolean') return `MMKV holds dark as a **${row.type}**. Save the boolean itself: \`storage.set('dark', next)\`.`;
        return row?.value === 'true';
      },
    },
    {
      id: 'restart',
      label: 'after Restart app the screen still says Dark mode',
      fail: 'Start the state from the saved value: `useState(() => storage.getBoolean(\'dark\') ?? false)`.',
      run: async (c) => /Dark mode/.test(await waitForText(c.app, (t) => /Dark mode/.test(t), 3000)),
    },
  ],
  hints: [
    'Line 1: `const storage = createMMKV();` above `export default function App`.',
    'The first value: `useState(() => storage.getBoolean(\'dark\') ?? false)`. `?? false` is for the first time, when nothing is saved.',
    'In `toggle`, after `setDark(next)`: `storage.set(\'dark\', next);`',
  ],
  solution: {
    explain: 'MMKV reads and writes at once, so the saved value can be the first state directly. It keeps the boolean as a boolean, so there is no JSON and no `await`.',
    files: { 'App.tsx': MMKV_SOLUTION },
  },
  success: 'Same result as Exercise 3 in fewer lines. The price: MMKV needs a **development build** (it is native code that Expo Go does not include), while AsyncStorage works in Expo Go.',
};
