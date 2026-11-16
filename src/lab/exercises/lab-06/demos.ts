/** Lab 06 live examples — editable, not graded. Each one shows one idea before its exercises. */
import type { Demo } from '../types.ts';
import { STUDENT, SUPABASE_CLIENT } from './shared.ts';

export const demos: Record<string, Demo> = {
  'memory-vs-storage': {
    id: 'memory-vs-storage',
    title: 'Memory or storage: what survives a restart?',
    frame: 'phone',
    entry: 'App.tsx',
    files: {
      'App.tsx': `import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  // in memory (useState): gone when the app closes
  const [inMemory, setInMemory] = useState(0);
  // in storage (AsyncStorage): read back when the app opens
  const [saved, setSaved] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem('count').then((text) => setSaved(Number(text ?? 0)));
  }, []);

  async function addOne() {
    setInMemory(inMemory + 1);
    const next = saved + 1;
    setSaved(next);
    await AsyncStorage.setItem('count', String(next)); // storage keeps text
  }

  return (
    <View className="flex-1 justify-center gap-4 bg-white p-6">
      <Text className="text-lg text-slate-700">In memory (useState): <Text className="font-bold text-slate-900">{inMemory}</Text></Text>
      <Text className="text-lg text-slate-700">Saved (AsyncStorage): <Text className="font-bold text-slate-900">{saved}</Text></Text>
      <Pressable onPress={addOne} className="items-center rounded-xl bg-indigo-600 py-3">
        <Text className="font-semibold text-white">Add one to both</Text>
      </Pressable>
      <Text className="text-slate-600">Press it three times, then press Restart app under the phone.</Text>
    </View>
  );
}
`,
    },
    tryThis: [
      'Press **Add one** three times, then **Restart app**: memory goes back to 0, the saved number stays 3.',
      'Press **Erase phone**: the saved number is gone too, like uninstalling the app.',
      'Look at **Device storage**: the number is saved as the text "3".',
    ],
  },

  'async-storage-api': {
    id: 'async-storage-api',
    title: 'Every AsyncStorage call, one button each',
    frame: 'phone',
    entry: 'App.tsx',
    files: {
      'App.tsx': `import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  const [log, setLog] = useState<string[]>([]);
  const say = (line: string) => setLog((old) => [line, ...old].slice(0, 7));

  const actions: [string, () => Promise<void>][] = [
    ['Save', async () => {
      await AsyncStorage.setItem('user', JSON.stringify({ name: 'Mona', year: 2 }));
      say("setItem('user', JSON text)");
    }],
    ['Read', async () => {
      const text = await AsyncStorage.getItem('user'); // text, or null
      say(\`getItem → \${text}\`);
      if (text) say(\`JSON.parse(text).name → \${JSON.parse(text).name}\`);
    }],
    ['Update', async () => {
      await AsyncStorage.mergeItem('user', JSON.stringify({ year: 3 })); // changes one field
      say('mergeItem: year → 3');
    }],
    ['Keys', async () => say(\`getAllKeys → \${JSON.stringify(await AsyncStorage.getAllKeys())}\`)],
    ['Remove', async () => {
      await AsyncStorage.removeItem('user');
      say("removeItem('user')");
    }],
    ['Clear', async () => {
      await AsyncStorage.clear(); // every key of this app
      say('clear(): everything removed');
    }],
  ];

  return (
    <View className="flex-1 gap-3 bg-white p-5 pt-14">
      <Text className="text-2xl font-bold text-slate-900">AsyncStorage</Text>
      <View className="flex-row flex-wrap gap-2">
        {actions.map(([label, run]) => (
          <Pressable key={label} onPress={() => run().catch((e) => say('error: ' + e.message))} className="rounded-lg bg-indigo-600 px-3 py-2">
            <Text className="font-semibold text-white">{label}</Text>
          </Pressable>
        ))}
      </View>
      {log.map((line, i) => (
        <Text key={i} className={i === 0 ? 'font-mono text-xs text-slate-900' : 'font-mono text-xs text-slate-600'}>{line}</Text>
      ))}
    </View>
  );
}
`,
    },
    tryThis: [
      'Press **Read** before **Save**: `getItem` gives `null`.',
      'Press **Save**, then **Update**: `mergeItem` changes the year and keeps the name.',
      'In the code, save the object without `JSON.stringify`: the console warns, and Device storage shows "[object Object]".',
    ],
  },

  'sqlite-first': {
    id: 'sqlite-first',
    title: 'A first SQLite database',
    frame: 'phone',
    entry: 'App.tsx',
    files: {
      'App.tsx': `import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import * as SQLite from 'expo-sqlite';

type Task = { id: number; title: string; done: number };

export default function App() {
  const [rows, setRows] = useState<Task[]>([]);

  useEffect(() => {
    (async () => {
      // 1. open (or create) the database file
      const db = await SQLite.openDatabaseAsync('demo.db');
      // 2. create the table once
      await db.execAsync(\`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0);
      \`);
      // 3. add rows only the first time (the table is empty)
      const count = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM tasks');
      if (count?.n === 0) {
        await db.runAsync('INSERT INTO tasks (title, done) VALUES (?, ?)', 'Install expo-sqlite', 1);
        await db.runAsync('INSERT INTO tasks (title, done) VALUES (?, ?)', 'Create the table', 1);
        await db.runAsync('INSERT INTO tasks (title, done) VALUES (?, ?)', 'Write the first SELECT', 0);
      }
      // 4. read the rows: an array of objects, one per row
      setRows(await db.getAllAsync<Task>('SELECT * FROM tasks ORDER BY id'));
    })();
  }, []);

  return (
    <View className="flex-1 gap-2 bg-white p-5 pt-14">
      <Text className="mb-2 text-2xl font-bold text-slate-900">tasks</Text>
      {rows.map((t) => (
        <Text key={t.id} className="font-mono text-sm text-slate-800">{t.id} · {t.title} · done = {t.done}</Text>
      ))}
    </View>
  );
}
`,
    },
    tryThis: [
      'Change the SELECT to `SELECT * FROM tasks WHERE done = 0`: only one row is left.',
      'Change `ORDER BY id` to `ORDER BY title`: the rows are sorted by their title.',
      'Press **Restart app**: the rows are read from the file and not inserted again (COUNT is 3).',
    ],
  },

  'secure-vs-plain': {
    id: 'secure-vs-plain',
    title: 'The same token, plain and encrypted',
    frame: 'phone',
    entry: 'App.tsx',
    files: {
      'App.tsx': `import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.student-240001.k2Lm9Qx';

export default function App() {
  const [plain, setPlain] = useState<string | null>(null);
  const [secure, setSecure] = useState<string | null>(null);

  async function saveBoth() {
    await AsyncStorage.setItem('token', TOKEN); // a plain file: never do this with a real token
    await SecureStore.setItemAsync('token', TOKEN); // encrypted by the Keychain / Keystore
    setPlain(await AsyncStorage.getItem('token'));
    setSecure(await SecureStore.getItemAsync('token'));
  }

  return (
    <View className="flex-1 justify-center gap-4 bg-white p-6">
      <Pressable onPress={saveBoth} className="items-center rounded-xl bg-indigo-600 py-3">
        <Text className="font-semibold text-white">Save the token in both</Text>
      </Pressable>
      <Text className="text-slate-700">AsyncStorage gives back: <Text className="font-mono text-slate-900">{plain ?? '—'}</Text></Text>
      <Text className="text-slate-700">SecureStore gives back: <Text className="font-mono text-slate-900">{secure ?? '—'}</Text></Text>
      <Text className="text-slate-600">Your app reads the same token from both. Now look at how each one is kept on the phone, in Device storage.</Text>
    </View>
  );
}
`,
    },
    tryThis: [
      'Press **Save** and look at **Device storage**: AsyncStorage shows the token as plain text, SecureStore only unreadable bytes.',
      'Both give the app the same token back: encryption changes how it is kept on disk, not what your code reads.',
      'Change the SecureStore key to `\'my token\'` (with a space): SecureStore refuses it. Keys allow letters, numbers, `.`, `-` and `_`.',
    ],
  },

  'supabase-first': {
    id: 'supabase-first',
    title: 'Talk to the practice Supabase project',
    frame: 'phone',
    entry: 'App.tsx',
    files: {
      'lib/supabase.ts': SUPABASE_CLIENT,
      'App.tsx': `import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { supabase } from './lib/supabase';

export default function App() {
  const [out, setOut] = useState('Press a button');

  async function select() {
    const { data, error } = await supabase.from('tasks').select('title, done');
    setOut(JSON.stringify({ data, error }, null, 2));
  }
  async function signIn() {
    const { data, error } = await supabase.auth.signInWithPassword({ email: '${STUDENT.email}', password: '${STUDENT.password}' });
    setOut(error ? error.message : \`Signed in as \${data.user?.email}\`);
  }
  async function signOut() {
    await supabase.auth.signOut();
    setOut('Signed out');
  }

  return (
    <View className="flex-1 gap-3 bg-white p-5 pt-14">
      <Text className="text-2xl font-bold text-slate-900">Supabase</Text>
      <View className="flex-row flex-wrap gap-2">
        {[['Select', select], ['Sign in', signIn], ['Sign out', signOut]].map(([label, run]) => (
          <Pressable key={label as string} onPress={run as () => void} className="rounded-lg bg-emerald-600 px-3 py-2">
            <Text className="font-semibold text-white">{label as string}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView className="flex-1 rounded-xl bg-slate-100 p-3">
        <Text className="font-mono text-xs text-slate-800">{out}</Text>
      </ScrollView>
    </View>
  );
}
`,
    },
    tryThis: [
      'Press **Select** before signing in: `data` is `[]` and `error` is `null`. Row Level Security shows nothing to an anonymous user.',
      'Press **Sign in**, then **Select**: only the student’s task. Device storage shows that the cloud also holds Omar’s.',
      'Change `from(\'tasks\')` to `from(\'taskz\')` and press **Select**: read the `error` object (code PGRST205).',
    ],
  },

  netinfo: {
    id: 'netinfo',
    title: 'NetInfo: is the phone online?',
    frame: 'phone',
    entry: 'App.tsx',
    files: {
      'lib/supabase.ts': SUPABASE_CLIENT,
      'App.tsx': `import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { supabase } from './lib/supabase';

export default function App() {
  const net = useNetInfo(); // updates by itself when the connection changes
  const [result, setResult] = useState('');

  async function load() {
    const { data, error } = await supabase.from('tasks').select('title');
    setResult(error ? \`error: \${error.message}\` : \`ok: \${data.length} rows\`);
  }

  return (
    <View className="flex-1 justify-center gap-4 bg-white p-6">
      <Text className={net.isConnected ? 'text-2xl font-bold text-emerald-700' : 'text-2xl font-bold text-red-700'}>
        {net.isConnected ? 'Online' : 'Offline'}
      </Text>
      <Text className="font-mono text-slate-700">type: {net.type} · isConnected: {String(net.isConnected)}</Text>
      <Pressable onPress={load} className="items-center rounded-xl bg-indigo-600 py-3">
        <Text className="font-semibold text-white">Load from Supabase</Text>
      </Pressable>
      <Text className="font-mono text-slate-800">{result}</Text>
    </View>
  );
}
`,
    },
    tryThis: [
      'Press **Wi-Fi on** under the phone to switch it off: the screen changes at once, `isConnected` is false.',
      'Press **Load** with Wi-Fi off: the request fails with “Network request failed”.',
      'Switch Wi-Fi on again: NetInfo tells the app, and Load works.',
    ],
  },
};
