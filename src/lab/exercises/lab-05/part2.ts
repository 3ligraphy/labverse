/** Lab 05 · Part 6 — what an API is: requests, responses, status codes, a first GET. Exercises 5–7 (2 small, 1 big). */
import type { CodeExercise, MatchExercise, OrderExercise } from '../types.ts';
import { LAB_ID } from './meta.ts';
import { SITE, code, waitForText } from './shared.ts';

const id = (name: string) => `${LAB_ID}--${name}`;

export const ex05: OrderExercise = {
  id: id('call-order'),
  n: 5,
  title: 'Put one API call in order',
  minutes: 3,
  level: 3,
  kind: 'order',
  prompt: 'Every API call goes through the same five steps. Drag them into the right order.',
  items: [
    'The app builds a request: a method (GET) and a URL',
    'The request travels over the internet to the server',
    'The server reads the request and finds the data',
    'The server sends back a response: a status code and JSON',
    'The app turns the JSON into an object and updates the screen',
  ],
  hints: ['It always starts in the app.', 'The server can only answer after it received something.', 'The screen changes last.'],
  success: 'Request → server → response → screen. Every `fetch` you write in this lab follows this loop.',
};

export const ex06: MatchExercise = {
  id: id('status-match'),
  n: 6,
  title: 'What does each status code mean?',
  minutes: 4,
  level: 3,
  kind: 'match',
  prompt: 'Every response starts with a **status code**: a three-digit number that says how the request went. Match each code to its meaning.',
  pairs: [
    { chip: '200', target: 'OK: here is what you asked for', why: '2xx means success. 200 is the usual answer to a GET.' },
    { chip: '201', target: 'Created: something new was saved', why: 'The attendance API answers 201 when your check-in is saved for the first time.' },
    { chip: '400', target: 'Bad request: the data you sent is wrong', why: '4xx means a problem with the request, for example an empty name.' },
    { chip: '404', target: 'Not found: nothing lives at this URL', why: 'Check the spelling of the path.' },
    { chip: '500', target: 'Server error: the server broke', why: '5xx means the problem is on the server, not in your request.' },
  ],
  decoys: [{ chip: '1000', why: 'Status codes always have three digits, from 100 to 599.' }],
  mono: true,
  hints: ['The first digit tells the family: 2 = success, 4 = your request, 5 = the server.', '201 is a success where something was **created**.', '404 is the one you get for a wrong URL.'],
  success: 'You only need the first digit to know who must fix a problem: **2** all good, **4** fix your request, **5** tell the server team.',
};

const API = `${SITE}/api/lab5`;

export const ex07: CodeExercise = {
  id: id('first-get'),
  n: 7,
  title: 'Your first GET: load the class list',
  minutes: 12,
  level: 4,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  prompt: `Load the class list from the course server with \`fetch\`: a GET to \`${API}/students\`. Then add a **Present only** button that loads \`/students?present=true\`.`,
  files: {
    'App.tsx': `import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

// The address of the course server's practice API
const API = '${API}';

type Student = { id: number; name: string; studentId: string; present: boolean };

export default function App() {
  const [students, setStudents] = useState<Student[]>([]);

  async function loadAll() {
    // 1. GET \`\${API}/students\` with fetch, and wait for the answer (await)
    // 2. Read the JSON from the answer: await res.json()
    // 3. Save it with setStudents(...)
  }

  // 4. loadPresent(): the same, with ?present=true at the end of the URL

  // When the screen opens, load everyone once
  useEffect(() => {
    loadAll();
  }, []);

  return (
    <View className="flex-1 bg-slate-100 p-4 pt-12">
      <Text className="text-2xl font-bold">Class list</Text>
      <Text className="mb-3 text-slate-500">{students.length} students</Text>
      {/* 5. A Pressable "Present only" that calls loadPresent */}
      <FlatList
        data={students}
        keyExtractor={(s) => String(s.id)}
        renderItem={({ item }) => (
          <View className="mb-2 rounded-xl bg-white p-4">
            <Text className="font-semibold">{item.name}</Text>
            <Text className="text-slate-500">{item.studentId}</Text>
          </View>
        )}
      />
    </View>
  );
}
`,
  },
  checks: [
    {
      id: 'fetch',
      label: 'fetch() asks for /students',
      fail: 'Inside loadAll: `const res = await fetch(`${API}/students`);`',
      static: (c) => /fetch\s*\(\s*[`'"][^`'"]*\/students/.test(code(c.files)),
    },
    {
      id: 'json',
      label: 'reads the answer with await res.json()',
      fail: 'After the fetch: `const data = await res.json();` then `setStudents(data);`',
      static: (c) => /await\s+\w+\.json\s*\(\s*\)/.test(code(c.files)),
    },
    {
      id: 'list',
      label: 'shows the 5 students from the server',
      fail: 'The list is still empty. Did you call `setStudents(data)` with the JSON from the answer?',
      run: async (c) => Boolean(await waitForText(c.app, (t) => ['Mona Adel', 'Omar Khaled', 'Salma Hassan', 'Youssef Ali', 'Nour Samir'].every((n) => t.includes(n)))),
    },
    {
      id: 'filter',
      label: 'Present only shows the 3 present students',
      fail: 'Add `loadPresent()` that fetches `${API}/students?present=true`, and a `<Pressable onPress={loadPresent}><Text>Present only</Text></Pressable>`.',
      run: async (c) => {
        if (!(await waitForText(c.app, (t) => t.includes('Omar Khaled')))) return 'Load the full list first: the 5 students should appear when the screen opens.';
        if (!(await c.app.press({ text: /present only/i }))) return 'I can’t find a **Present only** button to press.';
        return Boolean(await waitForText(c.app, (t) => t.includes('Mona Adel') && !t.includes('Omar Khaled') && !t.includes('Nour Samir')));
      },
    },
  ],
  hints: [
    'Inside loadAll: `const res = await fetch(`${API}/students`);` sends the GET and waits for the answer.',
    '`const data = await res.json();` reads the JSON. Then `setStudents(data);` puts it on the screen.',
    'Copy loadAll into `async function loadPresent()` and change the URL to `${API}/students?present=true`. The button: `<Pressable onPress={loadPresent} className="mb-3 self-start rounded-full bg-indigo-600 px-4 py-2"><Text className="text-white">Present only</Text></Pressable>`.',
  ],
  success: 'Your app just asked a real server for data and drew the answer. The query string `?present=true` changed **which** students came back, with the same path.',
};
