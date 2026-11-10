/** Lab 05 · Part 8 — sending data: POST, the server's answers, and the real check-in (final). Exercises 11–13. */
import type { CodeExercise, MatchExercise } from '../types.ts';
import { getStudent } from '../../ui/store.ts';
import { LAB_ID } from './meta.ts';
import { SITE, code, shownIn, waitForText } from './shared.ts';

const id = (name: string) => `${LAB_ID}--${name}`;
const hasTry = (src: string) => /\btry\s*\{[\s\S]*\}\s*catch\b/.test(src);
const API5 = `${SITE}/api/lab5`;

export const ex11: CodeExercise = {
  id: id('post-echo'),
  n: 11,
  title: 'Send your first POST',
  minutes: 7,
  level: 6,
  kind: 'fix',
  frame: 'phone',
  entry: 'App.tsx',
  prompt: 'This request should **send** your name to the echo server, which answers with exactly what it received. It is wrong in three places: fix the method, add the JSON header, and turn the body into JSON text.',
  files: {
    'App.tsx': `import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

const API = '${API5}';

export default function App() {
  const [name, setName] = useState('');
  const [reply, setReply] = useState('');

  async function send() {
    // This request is wrong in three places: find them
    const res = await fetch(\`\${API}/echo\`, {
      method: 'GET',
      body: { name: name },
    });
    const data = await res.json();
    setReply(\`The server received: \${data.received.name}\`);
  }

  return (
    <View className="flex-1 justify-center gap-3 bg-white p-6">
      <TextInput placeholder="Your name" value={name} onChangeText={setName} className="rounded-xl border border-slate-300 px-4 py-3" />
      <Pressable onPress={send} className="items-center rounded-xl bg-indigo-600 py-3">
        <Text className="font-semibold text-white">Send</Text>
      </Pressable>
      <Text className="text-slate-700">{reply}</Text>
    </View>
  );
}
`,
  },
  checks: [
    {
      id: 'post',
      label: "method: 'POST'",
      fail: "Sending data needs `method: 'POST'`. A GET request cannot carry a body.",
      static: (c) => /method\s*:\s*['"`]POST['"`]/i.test(code(c.files)),
    },
    {
      id: 'header',
      label: 'the Content-Type: application/json header',
      fail: "Add `headers: { 'Content-Type': 'application/json' },` so the server knows the body is JSON.",
      static: (c) => /['"`]?content-type['"`]?\s*:\s*['"`]application\/json/i.test(code(c.files)),
    },
    {
      id: 'stringify',
      label: 'the body is JSON text: JSON.stringify(…)',
      fail: 'The body must be text: `body: JSON.stringify({ name }),`',
      static: (c) => /body\s*:\s*JSON\.stringify\s*\(/.test(code(c.files)),
    },
    {
      id: 'reply',
      label: 'the server sends your name back',
      fail: 'Type a name and press **Send**: the screen should show “The server received: …” with that name.',
      run: async (c) => {
        await c.app.type({ placeholder: /name/i }, 'Mona');
        if (!(await c.app.press({ text: /^send$/i }))) return 'I can’t find the **Send** button.';
        return Boolean(await waitForText(c.app, (t) => /The server received:\s*Mona/.test(t)));
      },
    },
  ],
  hints: [
    "Sending data needs `method: 'POST'`. A GET request cannot carry a body.",
    "Add a line: `headers: { 'Content-Type': 'application/json' },`. It tells the server how to read the body.",
    'A body must be text: `body: JSON.stringify({ name }),`. `JSON.stringify` turns the object into JSON text.',
  ],
  success: 'Method, headers, body: those three lines are every POST you will write. The echo server sent your JSON straight back, so you could see exactly what arrived.',
};

export const ex12: MatchExercise = {
  id: id('response-match'),
  n: 12,
  title: "Read the server's answer",
  minutes: 4,
  level: 6,
  kind: 'match',
  prompt: 'These are the real answers of `POST /api/attendance`. Match each answer with what your app should show the student.',
  pairs: [
    { chip: '201 { ok: true, entry }', target: '✓ Checked in', why: '201 Created: this is your first check-in, and it is saved.' },
    { chip: '200 { ok: true, already: true }', target: 'You were already checked in', why: 'The API keeps your first check-in. Sending again is not an error.' },
    { chip: '400 { error: "invalid", errors }', target: 'Fix the name or the student ID', why: '400 means the data you sent is wrong. `errors` says which field.' },
    { chip: '503 { error: "closed" }', target: 'Attendance is closed right now', why: '503 means the service is not open. Try again later.' },
    { chip: 'fetch throws (no answer)', target: 'No connection. Try again.', why: 'There was no answer at all, so `catch` runs.' },
  ],
  mono: true,
  hints: ['Start with the 2xx answers: both are a success.', '`already: true` is still `ok: true`.', 'When `fetch` itself throws, the server never answered.'],
  success: 'Your check-in screen will need a message for each of these answers. You just wrote its plan.',
};

export const ex13: CodeExercise = {
  id: id('check-in'),
  n: 13,
  title: 'Check in with the API',
  minutes: 18,
  level: 8,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  prompt: `The core of the lab: a real check-in screen. Send \`{ name, studentId, deviceId }\` with a POST to \`${SITE}/api/attendance\` and show every answer. When you press **Check** it checks you in for real with the name and ID you typed in Start lab, and your TA sees it.`,
  files: {
    'App.tsx': `import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

const API = '${SITE}/api';

// The API needs a device ID: 16–64 letters, digits, dots or dashes. This makes one when the app starts.
const deviceId = 'lab05-' + Math.random().toString(36).slice(2) + Date.now().toString(36);

export default function App() {
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  // one of: 'idle' | 'sending' | 'done' | 'already' | 'invalid' | 'error'
  const [state, setState] = useState('idle');
  const [time, setTime] = useState('');

  async function checkIn() {
    // 1. Empty name or ID → setState('invalid') and stop
    // 2. setState('sending')
    // 3. POST \`\${API}/attendance\` with the JSON body { name, studentId, deviceId }
    // 4. Read the JSON answer:
    //      status 201                 → setTime(the hour and minute of data.entry.at), setState('done')
    //      status 200 and data.already → setState('already')
    //      status 400                 → setState('invalid')
    //      anything else              → setState('error')
    // 5. No connection (catch) → setState('error')
  }

  return (
    <View className="flex-1 justify-center gap-3 bg-slate-100 p-6">
      <Text className="text-2xl font-bold">Lab 05 check-in</Text>
      <TextInput placeholder="Full name" value={name} onChangeText={setName} className="rounded-xl border border-slate-300 bg-white px-4 py-3" />
      <TextInput placeholder="Student ID" value={studentId} onChangeText={setStudentId} keyboardType="number-pad" className="rounded-xl border border-slate-300 bg-white px-4 py-3" />
      <Pressable onPress={checkIn} className="items-center rounded-xl bg-indigo-600 py-3">
        <Text className="font-semibold text-white">Check in</Text>
      </Pressable>
      {/* 6. Show the result:
            sending → <ActivityIndicator />
            done    → "✓ Checked in at 10:42" in green
            already → "You were already checked in" in green
            invalid → "Type your full name and your student ID" in red
            error   → "Could not check in. Try again." in red */}
    </View>
  );
}
`,
  },
  target: {
    caption: 'The goal after a successful check-in',
    html: `<div style="font:14px system-ui;height:100%;display:flex;flex-direction:column;justify-content:center;gap:10px;padding:16px;box-sizing:border-box;background:#f1f5f9"><b style="font-size:19px">Lab 05 check-in</b><div style="background:#fff;border:1px solid #cbd5e1;border-radius:10px;padding:9px">Mona Adel</div><div style="background:#fff;border:1px solid #cbd5e1;border-radius:10px;padding:9px">240001</div><div style="background:#4f46e5;color:#fff;text-align:center;border-radius:10px;padding:9px;font-weight:600">Check in</div><b style="color:#16a34a">✓ Checked in at 10:42</b></div>`,
  },
  checks: [
    {
      id: 'post',
      label: 'POST to /attendance',
      fail: "Inside checkIn: `const res = await fetch(`${API}/attendance`, { method: 'POST', … });`",
      static: (c) => /fetch\s*\(\s*[`'"][^`'"]*\/attendance[`'"]/.test(code(c.files)) && /method\s*:\s*['"`]POST['"`]/i.test(code(c.files)),
    },
    {
      id: 'json',
      label: 'a JSON body with name, studentId and deviceId',
      fail: "Add `headers: { 'Content-Type': 'application/json' }` and `body: JSON.stringify({ name, studentId, deviceId })`.",
      static: (c) => {
        const src = code(c.files);
        const body = /JSON\.stringify\s*\(\s*\{([^}]*)\}/.exec(src)?.[1] ?? '';
        return /content-type['"`]?\s*:\s*['"`]application\/json/i.test(src) && ['name', 'studentId', 'deviceId'].every((k) => new RegExp(`\\b${k}\\b`).test(body));
      },
    },
    {
      id: 'safe',
      label: 'catches a lost connection with try / catch',
      fail: "Wrap the request in `try { … } catch { setState('error'); }`.",
      static: (c) => hasTry(code(c.files)),
    },
    {
      id: 'empty',
      label: 'empty fields show a message and send nothing',
      fail: "First line of checkIn: `if (!name.trim() || !studentId.trim()) { setState('invalid'); return; }`, and show “Type your full name and your student ID” in red.",
      run: async (c) => {
        if (!(await c.app.press({ text: /^check in$/i }))) return 'I can’t find the **Check in** button.';
        const t = await waitForText(c.app, (x) => /type your|full name and|fill in|empty|required/i.test(x), 1500);
        if (!t) return 'Pressing **Check in** with empty fields should show a message, for example “Type your full name and your student ID”.';
        return shownIn(c.app, /type your|full name and|fill in|empty|required/i, 'red');
      },
    },
    {
      id: 'real',
      label: 'a real check-in works (with your own name and ID)',
      fail: 'Type a name and an ID, press **Check in**: the screen should say “✓ Checked in at …” (or “You were already checked in”).',
      run: async (c) => {
        const me = getStudent();
        if (!me) return 'Start the lab first: type your name and student ID in **Start lab** at the top of the page, then check again.';
        await c.app.type({ placeholder: /name/i }, me.name);
        await c.app.type({ placeholder: /student id|\bid\b/i }, me.id);
        if (!(await c.app.press({ text: /^check in$/i }))) return 'I can’t find the **Check in** button.';
        const t = await waitForText(c.app, (x) => /checked in|already/i.test(x.replace(/Lab 05 check-in/i, '')) || /could not|try again|error/i.test(x), 9000);
        if (!t) return 'No answer appeared on the screen. Show a message for every state (step 6).';
        if (!/checked in|already/i.test(t.replace(/Lab 05 check-in/i, ''))) return 'The screen shows an error. Check the URL (`${API}/attendance`), the method, the header and the body.';
        return (await shownIn(c.app, /checked in|already/i, 'green')) || 'You are checked in! Now colour that message green (`text-green-600`).';
      },
    },
  ],
  hints: [
    "Start checkIn with `if (!name.trim() || !studentId.trim()) { setState('invalid'); return; }` then `setState('sending');`.",
    "The request: `const res = await fetch(`${API}/attendance`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, studentId, deviceId }) }); const data = await res.json();`",
    "Then: `if (res.status === 201) { setTime(new Date(data.entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })); setState('done'); } else if (data.already) setState('already'); else if (res.status === 400) setState('invalid'); else setState('error');`. Wrap it all in `try { … } catch { setState('error'); }` and draw one `<Text>` per state.",
  ],
  success: 'That was a real request: your Lab 05 attendance is saved on the course server, and your TA can see it. This screen used everything from Parts 5–8: JSON, a POST with headers and a body, status codes, loading and errors.',
};
