/** Lab 05 live examples — editable, not graded. Each one shows one idea before its exercises. */
import type { Demo } from '../types.ts';
import { SITE } from './shared.ts';

export const demos: Record<string, Demo> = {
  'json-to-screen': {
    id: 'json-to-screen',
    title: 'JSON text → object → screen',
    frame: 'phone',
    entry: 'App.tsx',
    files: {
      'App.tsx': `import { Text, View } from 'react-native';

// 1. JSON text: this is what arrives from a server (it is one long string)
const text = '{"name":"Mona Adel","year":2,"present":true,"courses":["Mobile","Web"]}';

// 2. JSON.parse turns the text into a JavaScript object
const student = JSON.parse(text);

// 3. Now the dot works: student.name, student.courses[0], …
export default function App() {
  return (
    <View className="flex-1 justify-center gap-2 bg-white p-6">
      <Text className="text-2xl font-bold">{student.name}</Text>
      <Text>Year {student.year}</Text>
      <Text>{student.present ? 'Present' : 'Absent'}</Text>
      <Text>First course: {student.courses[0]}</Text>
      <Text className="mt-4 font-mono text-xs text-slate-500">{JSON.stringify(student)}</Text>
    </View>
  );
}
`,
    },
    tryThis: [
      'Change `"present":true` to `false` inside the text: the screen says Absent.',
      'Show `student.courses.length`: how many courses are in the array?',
      'Remove one double quote from the text: JSON.parse throws an error. JSON is strict.',
    ],
  },
  'first-fetch': {
    id: 'first-fetch',
    title: 'A real GET request, line by line',
    frame: 'phone',
    entry: 'App.tsx',
    files: {
      'App.tsx': `import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

const API = '${SITE}/api/lab5';

export default function App() {
  const [student, setStudent] = useState(null);
  const [status, setStatus] = useState('Loading…');

  useEffect(() => {
    async function load() {
      // 1. Send a GET request and wait (await) for the answer
      const res = await fetch(\`\${API}/students/1\`);
      // 2. The answer has a status code: 200 means OK
      setStatus(\`Status: \${res.status} (ok: \${res.ok})\`);
      // 3. Read the body and turn the JSON into an object
      const data = await res.json();
      // 4. Save it in state: the screen draws again with the data
      setStudent(data);
    }
    load();
  }, []);

  return (
    <View className="flex-1 justify-center gap-2 bg-white p-6">
      <Text className="font-mono text-slate-500">{status}</Text>
      {student && <Text className="text-2xl font-bold">{student.name}</Text>}
      {student && <Text>ID: {student.studentId}</Text>}
    </View>
  );
}
`,
    },
    tryThis: [
      'Change `/students/1` to `/students/3`: another student arrives.',
      'Try `/students/9`: the status becomes 404 and `ok` becomes false.',
      'Show the whole answer: `<Text>{JSON.stringify(student)}</Text>`.',
    ],
  },
  'post-echo': {
    id: 'post-echo',
    title: 'A POST request and the server’s answer',
    frame: 'phone',
    entry: 'App.tsx',
    files: {
      'App.tsx': `import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

const API = '${SITE}/api/lab5';

export default function App() {
  const [answer, setAnswer] = useState('Press Send');

  async function send() {
    const res = await fetch(\`\${API}/echo\`, {
      method: 'POST',                                   // 1. POST = send data
      headers: { 'Content-Type': 'application/json' },  // 2. the body is JSON
      body: JSON.stringify({ name: 'Mona', year: 2 }),  // 3. the body: an object turned into JSON text
    });
    const data = await res.json();
    setAnswer(\`\${res.status}: \${JSON.stringify(data.received)}\`);
  }

  return (
    <View className="flex-1 justify-center gap-4 bg-white p-6">
      <Pressable onPress={send} className="items-center rounded-xl bg-indigo-600 py-3">
        <Text className="font-semibold text-white">Send</Text>
      </Pressable>
      <Text className="font-mono">{answer}</Text>
    </View>
  );
}
`,
    },
    tryThis: [
      'Add a key to the body, for example `course: "Mobile"`, and send again.',
      'Delete the `headers` line: the server can no longer read the body.',
      'Remove `JSON.stringify(…)` and send the object itself: what does the server say?',
    ],
  },
};
