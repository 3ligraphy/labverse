/** Lab 05 · Part 7 — waiting for the answer: await, res.ok, try/catch, loading states. Exercises 8–10 (2 small, 1 big). */
import type { CodeExercise, PredictExercise } from '../types.ts';
import { el } from '../helpers.ts';
import { LAB_ID } from './meta.ts';
import { SITE, code, shownIn, waitForText } from './shared.ts';

const id = (name: string) => `${LAB_ID}--${name}`;
const hasTry = (src: string) => /\btry\s*\{[\s\S]*\}\s*catch\b/.test(src);

export const ex08: PredictExercise = {
  id: id('await-predict'),
  n: 8,
  title: 'What does await do?',
  minutes: 4,
  level: 4,
  kind: 'predict',
  prompt: 'Each piece of code runs inside an `async` function. Choose what happens.',
  questions: [
    {
      code: `console.log('1. before');
const res = await fetch(\`\${API}/students\`);
console.log('2. after');`,
      question: 'What does `await` do here?',
      options: [
        { text: 'It pauses this function until the answer arrives, then line 3 runs', correct: true, why: '`await` waits for the answer. While it waits, the screen keeps working.' },
        { text: 'It skips the request and runs line 3 at once', why: 'Without `await`, `res` would not be the answer yet.' },
        { text: 'It freezes the whole phone until the answer arrives', why: 'Only this one function waits. The app stays responsive (Part 3).' },
      ],
    },
    {
      code: `const res = await fetch(\`\${API}/nope\`);
console.log(res.ok, res.status);`,
      question: 'This address does not exist. What is printed?',
      options: [
        { text: 'false 404', correct: true, why: '`fetch` does not throw for a 404. You get an answer with `ok` = `false` and the status code.' },
        { text: 'An error is thrown', why: '`fetch` throws only when there is no answer at all, for example no internet. A 404 is still an answer.' },
        { text: 'true 404', why: '`ok` is `true` only for status codes 200–299.' },
      ],
    },
    {
      code: `fetch(\`\${API}/students\`);
console.log('done');`,
      question: 'There is no `await`. Which comes first?',
      options: [
        { text: "'done' is printed before the answer arrives", correct: true, why: 'Without `await`, the request starts in the background and the next line runs at once.' },
        { text: 'The answer arrives, then done is printed', why: 'Nothing waits for the request: there is no `await`.' },
      ],
    },
    {
      code: `const res = await fetch(\`\${API}/students\`);
const data = res.json();
console.log(data.length);`,
      question: 'Someone forgot one `await`. What is printed?',
      options: [
        { text: 'undefined', correct: true, why: '`res.json()` also takes time, so it gives a promise. A promise has no `length`. Write `await res.json()`.' },
        { text: '5', why: 'That needs `const data = await res.json();`.' },
        { text: 'An error is thrown', why: 'Reading a key a promise does not have gives `undefined`, not an error.' },
      ],
    },
  ],
  hints: ['`await` = wait for this answer before the next line.', 'A 404 is still an answer: `fetch` gives it to you with `ok` = false.', '`res.json()` needs its own `await`.'],
  success: 'Two rules carry you through the rest of the lab: **await** both `fetch(…)` and `res.json()`, and **check `res.ok`** because `fetch` does not throw for 404 or 500.',
};

const API5 = `${SITE}/api/lab5`;

export const ex09: CodeExercise = {
  id: id('catch-error'),
  n: 9,
  title: 'Catch the error',
  minutes: 6,
  level: 5,
  kind: 'fix',
  frame: 'phone',
  entry: 'App.tsx',
  prompt: 'This screen asks for an address that does not exist, so it shows “Hello, undefined”. Show **Error 404** instead, and catch a lost connection with `try` / `catch`.',
  files: {
    'App.tsx': `import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

const API = '${API5}';

export default function App() {
  const [message, setMessage] = useState('Loading…');

  useEffect(() => {
    async function load() {
      // This address does not exist: the server answers 404
      const res = await fetch(\`\${API}/student/1\`);
      // 1. If the answer is not OK: show "Error 404" (use res.status) and stop with return
      const student = await res.json();
      setMessage(\`Hello, \${student.name}\`);
      // 2. Wrap everything in try { … } catch { … } and show "No connection" in catch
    }
    load();
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-white p-6">
      <Text className="text-xl">{message}</Text>
    </View>
  );
}
`,
  },
  checks: [
    {
      id: 'ok',
      label: 'checks res.ok before reading the JSON',
      fail: 'Before `res.json()`: `if (!res.ok) { setMessage(`Error ${res.status}`); return; }`',
      static: (c) => /!\s*res\.ok|res\.ok\s*===?\s*false|res\.status\s*(!==?|===?|>=?|<)/.test(code(c.files)),
    },
    {
      id: 'try',
      label: 'catches a lost connection with try / catch',
      fail: 'Wrap the code inside `load()` in `try { … } catch { setMessage(\'No connection\'); }`',
      static: (c) => hasTry(code(c.files)),
    },
    {
      id: 'shows-404',
      label: 'the screen shows Error 404',
      fail: 'The screen should say **Error 404**: `setMessage(`Error ${res.status}`)` when `res.ok` is false.',
      run: async (c) => {
        const t = await waitForText(c.app, (x) => /404/.test(x) || /undefined/.test(x));
        if (t && /undefined/.test(t)) return 'The screen still shows “undefined”: stop with `return` when `res.ok` is false, before `res.json()`.';
        return Boolean(t && /error\s*404/i.test(t));
      },
    },
  ],
  hints: [
    '`res.ok` is `true` only for status 200–299. For a 404 it is `false`.',
    '`if (!res.ok) { setMessage(`Error ${res.status}`); return; }`. The `return` stops before `res.json()`.',
    'Put the three lines inside `try { … } catch { setMessage(\'No connection. Try again.\'); }`. `catch` runs when there is no answer at all.',
  ],
  success: 'There are two kinds of failure: the server answered with an error (`res.ok` is false), or there was no answer (`catch`). A good app shows both instead of “undefined”.',
};

const API = `${SITE}/api`;

export const ex10: CodeExercise = {
  id: id('status-screen'),
  n: 10,
  title: 'Is attendance open?',
  minutes: 12,
  level: 6,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  prompt: `Ask the real attendance API \`GET ${API}/attendance/status\` and show its answer: a spinner while loading, **Attendance is OPEN** in green or **Attendance is CLOSED** in red, and an error message when it fails.`,
  files: {
    'App.tsx': `import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

const API = '${API}';

export default function App() {
  // one of: 'loading' | 'open' | 'closed' | 'error'
  const [state, setState] = useState('loading');

  async function check() {
    setState('loading');
    // 1. GET \`\${API}/attendance/status\`
    // 2. Not OK → setState('error') and stop
    // 3. Read the JSON. data.open is true or false → setState('open') or setState('closed')
    // 4. No connection (catch) → setState('error')
  }

  useEffect(() => {
    check();
  }, []);

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-white p-6">
      <Text className="text-lg text-slate-500">Lab 05 attendance</Text>
      {/* 5. One thing per state:
            loading → <ActivityIndicator />
            open    → "Attendance is OPEN" in green
            closed  → "Attendance is CLOSED" in red
            error   → "Could not check. Try again." */}
      <Pressable onPress={check} className="rounded-xl bg-slate-900 px-5 py-3">
        <Text className="font-semibold text-white">Check again</Text>
      </Pressable>
    </View>
  );
}
`,
  },
  target: {
    caption: 'The goal while attendance is open',
    html: `<div style="font:14px system-ui;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#fff"><span style="color:#64748b">Lab 05 attendance</span><b style="font-size:20px;color:#16a34a">Attendance is OPEN</b><span style="background:#0f172a;color:#fff;border-radius:10px;padding:8px 14px">Check again</span></div>`,
  },
  checks: [
    {
      id: 'fetch',
      label: 'GET /attendance/status',
      fail: 'Inside check(): `const res = await fetch(`${API}/attendance/status`);`',
      static: (c) => /fetch\s*\(\s*[`'"][^`'"]*\/attendance\/status/.test(code(c.files)),
    },
    {
      id: 'safe',
      label: 'checks res.ok and catches errors',
      fail: 'Add `if (!res.ok) { setState(\'error\'); return; }` and wrap the code in `try { … } catch { setState(\'error\'); }`.',
      static: (c) => /!\s*res\.ok|res\.ok\s*===?\s*false/.test(code(c.files)) && hasTry(code(c.files)),
    },
    {
      id: 'spinner',
      label: 'a spinner while loading',
      fail: 'Show `{state === \'loading\' && <ActivityIndicator />}`.',
      static: (c) => el(c.file(), 'ActivityIndicator').length > 0,
    },
    {
      id: 'answer',
      label: 'shows the real answer: OPEN or CLOSED',
      fail: 'After the answer: `setState(data.open ? \'open\' : \'closed\')`, and draw “Attendance is OPEN” / “Attendance is CLOSED”.',
      run: async (c) => {
        const t = await waitForText(c.app, (x) => /attendance is (open|closed)/i.test(x) || /could not|try again|error/i.test(x));
        if (!t) return 'Nothing appeared after the answer. Draw a `<Text>` for the open and closed states.';
        if (!/attendance is (open|closed)/i.test(t)) return 'The screen shows an error. Check the URL: `${API}/attendance/status`.';
        return true;
      },
    },
    {
      id: 'colors',
      label: 'OPEN is green, CLOSED is red',
      fail: 'Colour the result: `className="text-2xl font-bold text-green-600"` for OPEN and `text-red-600` for CLOSED.',
      run: async (c) => {
        const t = await waitForText(c.app, (x) => /attendance is (open|closed)/i.test(x));
        if (!t) return 'The answer did not appear, so the colour can’t be checked yet.';
        return /attendance is open/i.test(t) ? shownIn(c.app, /attendance is open/i, 'green') : shownIn(c.app, /attendance is closed/i, 'red');
      },
    },
  ],
  hints: [
    'Inside check(): `const res = await fetch(`${API}/attendance/status`);` then `if (!res.ok) { setState(\'error\'); return; }`.',
    '`const data = await res.json(); setState(data.open ? \'open\' : \'closed\');`. Put it all inside `try { … } catch { setState(\'error\'); }`.',
    'Draw one thing per state: `{state === \'loading\' && <ActivityIndicator />}` and `{state === \'open\' && <Text className="text-2xl font-bold text-green-600">Attendance is OPEN</Text>}`. Do the same for closed and error.',
  ],
  success: 'A screen that waits for a server always has these states: loading, success (here: open or closed) and error. The check-in in Part 8 uses the same pattern.',
};
