// Reference solutions for Lab 05's code exercises (what a student should end up with). Used by the tests only.
const SITE = 'https://labverse-indol.vercel.app';
const id = (name: string) => `lab-05--${name}`;

export const solutions: Record<string, Record<string, string>> = {
  [id('json-parse')]: {
    'App.tsx': `import { Text, View } from 'react-native';

const text = '{"name":"Mona Adel","studentId":"240001","present":true}';
const student = JSON.parse(text);

export default function App() {
  return (
    <View className="flex-1 items-center justify-center gap-2 bg-white p-6">
      <Text className="text-2xl font-bold">{student.name}</Text>
      <Text className="text-slate-500">ID: {student.studentId}</Text>
      <Text>{student.present ? 'Present' : 'Absent'}</Text>
    </View>
  );
}
`,
  },
  [id('json-list')]: {
    'App.tsx': `import { FlatList, Text, View } from 'react-native';

const json = \`[
  { "id": 1, "name": "Mona Adel", "present": true },
  { "id": 2, "name": "Omar Khaled", "present": false },
  { "id": 3, "name": "Salma Hassan", "present": true }
]\`;

const students = JSON.parse(json);

export default function App() {
  return (
    <View className="flex-1 bg-slate-100 p-4 pt-12">
      <Text className="mb-3 text-2xl font-bold">Class list</Text>
      <FlatList
        data={students}
        keyExtractor={(s) => String(s.id)}
        renderItem={({ item }) => (
          <View className="mb-2 flex-row justify-between rounded-xl bg-white p-4">
            <Text>{item.name}</Text>
            <Text className={item.present ? 'rounded-full bg-green-500 px-2 text-white' : 'rounded-full bg-red-500 px-2 text-white'}>{item.present ? 'Present' : 'Absent'}</Text>
          </View>
        )}
      />
    </View>
  );
}
`,
  },
  [id('first-get')]: {
    'App.tsx': `import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

const API = '${SITE}/api/lab5';

export default function App() {
  const [students, setStudents] = useState([]);

  async function loadAll() {
    const res = await fetch(\`\${API}/students\`);
    const data = await res.json();
    setStudents(data);
  }

  async function loadPresent() {
    const res = await fetch(\`\${API}/students?present=true\`);
    const data = await res.json();
    setStudents(data);
  }

  useEffect(() => {
    loadAll();
  }, []);

  return (
    <View className="flex-1 bg-slate-100 p-4 pt-12">
      <Text className="text-2xl font-bold">Class list</Text>
      <Text className="mb-3 text-slate-500">{students.length} students</Text>
      <Pressable onPress={loadPresent} className="mb-3 self-start rounded-full bg-indigo-600 px-4 py-2">
        <Text className="text-white">Present only</Text>
      </Pressable>
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
  [id('catch-error')]: {
    'App.tsx': `import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

const API = '${SITE}/api/lab5';

export default function App() {
  const [message, setMessage] = useState('Loading…');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(\`\${API}/student/1\`);
        if (!res.ok) {
          setMessage(\`Error \${res.status}\`);
          return;
        }
        const student = await res.json();
        setMessage(\`Hello, \${student.name}\`);
      } catch {
        setMessage('No connection. Try again.');
      }
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
  [id('status-screen')]: {
    'App.tsx': `import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

const API = '${SITE}/api';

export default function App() {
  const [state, setState] = useState('loading');

  async function check() {
    setState('loading');
    try {
      const res = await fetch(\`\${API}/attendance/status\`);
      if (!res.ok) {
        setState('error');
        return;
      }
      const data = await res.json();
      setState(data.open ? 'open' : 'closed');
    } catch {
      setState('error');
    }
  }

  useEffect(() => {
    check();
  }, []);

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-white p-6">
      <Text className="text-lg text-slate-500">Lab 05 attendance</Text>
      {state === 'loading' && <ActivityIndicator />}
      {state === 'open' && <Text className="text-2xl font-bold text-green-600">Attendance is OPEN</Text>}
      {state === 'closed' && <Text className="text-2xl font-bold text-red-600">Attendance is CLOSED</Text>}
      {state === 'error' && <Text className="text-red-600">Could not check. Try again.</Text>}
      <Pressable onPress={check} className="rounded-xl bg-slate-900 px-5 py-3">
        <Text className="font-semibold text-white">Check again</Text>
      </Pressable>
    </View>
  );
}
`,
  },
  [id('post-echo')]: {
    'App.tsx': `import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

const API = '${SITE}/api/lab5';

export default function App() {
  const [name, setName] = useState('');
  const [reply, setReply] = useState('');

  async function send() {
    const res = await fetch(\`\${API}/echo\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
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
  [id('check-in')]: {
    'App.tsx': `import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

const API = '${SITE}/api';
const deviceId = 'lab05-' + Math.random().toString(36).slice(2) + Date.now().toString(36);

export default function App() {
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [state, setState] = useState('idle');
  const [time, setTime] = useState('');

  async function checkIn() {
    if (!name.trim() || !studentId.trim()) {
      setState('invalid');
      return;
    }
    setState('sending');
    try {
      const res = await fetch(\`\${API}/attendance\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, studentId, deviceId }),
      });
      const data = await res.json();
      if (res.status === 201) {
        setTime(new Date(data.entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        setState('done');
      } else if (data.already) setState('already');
      else if (res.status === 400) setState('invalid');
      else setState('error');
    } catch {
      setState('error');
    }
  }

  return (
    <View className="flex-1 justify-center gap-3 bg-slate-100 p-6">
      <Text className="text-2xl font-bold">Lab 05 check-in</Text>
      <TextInput placeholder="Full name" value={name} onChangeText={setName} className="rounded-xl border border-slate-300 bg-white px-4 py-3" />
      <TextInput placeholder="Student ID" value={studentId} onChangeText={setStudentId} className="rounded-xl border border-slate-300 bg-white px-4 py-3" />
      <Pressable onPress={checkIn} className="items-center rounded-xl bg-indigo-600 py-3">
        <Text className="font-semibold text-white">Check in</Text>
      </Pressable>
      {state === 'sending' && <ActivityIndicator />}
      {state === 'done' && <Text className="font-bold text-green-600">✓ Checked in at {time}</Text>}
      {state === 'already' && <Text className="font-bold text-green-600">You were already checked in</Text>}
      {state === 'invalid' && <Text className="text-red-600">Type your full name and your student ID</Text>}
      {state === 'error' && <Text className="text-red-600">Could not check in. Try again.</Text>}
    </View>
  );
}
`,
  },
};
