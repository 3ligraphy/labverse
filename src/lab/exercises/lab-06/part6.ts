/** Lab 06 · Part 6 — local and cloud together: offline basics. Exercises 13–14 (3 + 7 = 10 min). */
import type { CodeExercise, OrderExercise } from '../types.ts';
import { LAB_ID } from './meta.ts';
import { cloudRows, code, sqliteRows, STUDENT, SUPABASE_CLIENT, until, waitForText } from './shared.ts';

const id = (name: string) => `${LAB_ID}--${name}`;

export const ex13: OrderExercise = {
  id: id('sync-order'),
  n: 13,
  title: 'The sync steps, in order',
  minutes: 3,
  level: 3,
  kind: 'order',
  prompt: 'A student adds a task on the bus with no connection. Put the steps of the app in order, from pressing **Add** to the task being safe in the cloud.',
  items: [
    'Save the task in SQLite with synced = 0, and show it at once',
    'Check the connection with NetInfo',
    'When online: read every row WHERE synced = 0',
    'Send them to Supabase with upsert, keeping the id the phone made',
    'If there was no error: UPDATE those rows SET synced = 1',
    'If it failed: leave synced = 0 and send them the next time the phone is online',
  ],
  hints: [
    'The phone always saves first: the screen must not wait for the network.',
    'Only rows that are not in the cloud yet (synced = 0) are sent.',
    'A row is marked as synced only after Supabase answered without an error.',
  ],
  solution: {
    explain: 'Local first: the task is saved and shown at once. Sending is a separate step that can fail and try again, and `synced` remembers what is still waiting.',
    text: 'Save in SQLite (synced = 0) → check NetInfo → read WHERE synced = 0 → upsert to Supabase with the same id → UPDATE synced = 1 → on failure keep synced = 0 and retry later',
  },
  success: 'This is the plan of Exercise 14 and of the final project. The two ideas that make it work: the `synced` column (what is waiting) and the id made on the phone (the same task never becomes two rows).',
};

/* -------------------------------------------------------------- Exercise 14 */

const OFFLINE_DB = `import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

// synced: 0 = only on this phone (waiting), 1 = in the cloud too
export type LocalTask = { id: string; title: string; done: number; synced: number };

// The database, ready with its table (every function waits for this)
export const dbPromise = SQLite.openDatabaseAsync('offline.db').then(async (db) => {
  await db.execAsync(\`CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    synced INTEGER NOT NULL DEFAULT 0
  )\`);
  return db;
});

// The phone makes the id (a UUID): the same task keeps the same id here and in the cloud
export async function addLocal(title: string) {
  const db = await dbPromise;
  await db.runAsync('INSERT INTO tasks (id, title) VALUES (?, ?)', Crypto.randomUUID(), title);
}

export async function getLocal(): Promise<LocalTask[]> {
  const db = await dbPromise;
  return db.getAllAsync<LocalTask>('SELECT * FROM tasks ORDER BY rowid');
}
`;

const SYNC_STARTER = `import { supabase } from './lib/supabase';
import { dbPromise, type LocalTask } from './db';

// Sends every task that is still only on this phone. Returns how many it sent.
export async function syncPending(): Promise<number> {
  const db = await dbPromise;

  // 1. The tasks still waiting: db.getAllAsync<LocalTask>('SELECT * FROM tasks WHERE synced = 0')
  const waiting: LocalTask[] = [];
  if (waiting.length === 0) return 0;

  // 2. Send them with upsert, keeping the phone's id, so sending twice never makes two rows:
  //    supabase.from('tasks').upsert(waiting.map((t) => ({ id: t.id, title: t.title, done: t.done === 1 })), { onConflict: 'id' })
  // 3. If there is an error: throw it (the tasks stay synced = 0 and are sent next time)

  // 4. Mark each one as synced: db.runAsync('UPDATE tasks SET synced = 1 WHERE id = ?', t.id)

  return waiting.length;
}
`;

export const SYNC_SOLUTION = `import { supabase } from './lib/supabase';
import { dbPromise, type LocalTask } from './db';

// Sends every task that is still only on this phone. Returns how many it sent.
export async function syncPending(): Promise<number> {
  const db = await dbPromise;

  const waiting = await db.getAllAsync<LocalTask>('SELECT * FROM tasks WHERE synced = 0');
  if (waiting.length === 0) return 0;

  // the same id as on the phone: sending a task twice updates one row instead of making two
  const { error } = await supabase
    .from('tasks')
    .upsert(waiting.map((t) => ({ id: t.id, title: t.title, done: t.done === 1 })), { onConflict: 'id' });
  if (error) throw error; // still synced = 0: sent again next time

  for (const t of waiting) {
    await db.runAsync('UPDATE tasks SET synced = 1 WHERE id = ?', t.id);
  }
  return waiting.length;
}
`;

const OFFLINE_APP = `import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './lib/supabase';
import { addLocal, getLocal, type LocalTask } from './db';
import { syncPending } from './sync';

// This screen is ready. You write syncPending() in sync.ts.
export default function App() {
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [title, setTitle] = useState('');
  const [online, setOnline] = useState(true);
  const [note, setNote] = useState('');

  const refresh = useCallback(async () => setTasks(await getLocal()), []);

  const sync = useCallback(async () => {
    try {
      const sent = await syncPending();
      setNote(sent ? \`Sent \${sent} to the cloud\` : '');
    } catch (error) {
      setNote(\`Not sent yet: \${error instanceof Error ? error.message : (error as { message?: string }).message}\`);
    }
    await refresh();
  }, [refresh]);

  useEffect(() => {
    let stop = () => {};
    (async () => {
      await supabase.auth.signInWithPassword({ email: '${STUDENT.email}', password: '${STUDENT.password}' });
      await refresh();
      // every time the connection comes back, send what is waiting
      stop = NetInfo.addEventListener((state) => {
        setOnline(Boolean(state.isConnected));
        if (state.isConnected) sync();
      });
    })();
    return () => stop();
  }, []);

  async function add() {
    if (!title.trim()) return;
    await addLocal(title.trim()); // on the phone first: works with no connection
    setTitle('');
    await refresh();
    if (online) sync();
  }

  const waiting = tasks.filter((t) => t.synced === 0).length;
  return (
    <View className="flex-1 bg-slate-50 p-5 pt-14">
      <View className="flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-slate-900">Offline tasks</Text>
        <Text testID="net" className={\`rounded-full px-3 py-1 text-xs font-semibold \${online ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}\`}>{online ? 'Online' : 'Offline'}</Text>
      </View>
      <View className="mt-4 flex-row gap-2">
        <TextInput testID="title" value={title} onChangeText={setTitle} placeholder="New task" className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2" />
        <Pressable testID="add" onPress={add} className="justify-center rounded-xl bg-indigo-600 px-4">
          <Text className="font-semibold text-white">Add</Text>
        </Pressable>
      </View>
      <View className="mt-3 flex-row items-center justify-between">
        <Text testID="waiting" className="text-slate-700">{waiting ? \`\${waiting} waiting to sync\` : 'Everything is in the cloud'}</Text>
        <Pressable testID="sync" onPress={sync} className="rounded-lg bg-slate-200 px-3 py-1.5">
          <Text className="font-semibold text-slate-900">Sync now</Text>
        </Pressable>
      </View>
      {note ? <Text className="mt-2 text-slate-600">{note}</Text> : null}
      <FlatList
        className="mt-4"
        data={tasks}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <View className="mb-2 flex-row items-center justify-between rounded-xl bg-white p-3">
            <Text className="text-slate-900">{item.title}</Text>
            <Text className={item.synced ? 'text-emerald-700' : 'text-amber-800'}>{item.synced ? 'in the cloud' : 'waiting'}</Text>
          </View>
        )}
      />
    </View>
  );
}
`;

const cloudCount = async (app: Parameters<typeof cloudRows>[0], title: string) => (await cloudRows(app, 'tasks')).filter((r) => r.title === title).length;

export const ex14: CodeExercise = {
  id: id('offline-sync'),
  n: 14,
  title: 'Offline-ready tasks',
  minutes: 7,
  level: 6,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  freshDevice: true,
  prompt: 'Tasks are saved in SQLite first, with `synced = 0`. Write `syncPending()` in **sync.ts**: read the waiting rows, **upsert** them to Supabase with the phone’s id, then mark them `synced = 1`. Test it: switch **Wi-Fi off** under the phone, add a task, switch Wi-Fi on.',
  files: { 'sync.ts': SYNC_STARTER, 'App.tsx': OFFLINE_APP, 'db.ts': OFFLINE_DB, 'lib/supabase.ts': SUPABASE_CLIENT },
  checks: [
    {
      id: 'pending',
      label: 'reads the waiting rows: `WHERE synced = 0`',
      fail: '`const waiting = await db.getAllAsync<LocalTask>(\'SELECT * FROM tasks WHERE synced = 0\');`',
      static: (c) => /getAllAsync[\s\S]{0,80}?WHERE\s+synced\s*=\s*0/i.test(code(c.files, 'sync.ts')),
    },
    {
      id: 'upsert',
      label: 'sends them with `upsert` on the id (never two rows for one task)',
      fail: 'Use `supabase.from(\'tasks\').upsert(rows, { onConflict: \'id\' })` with `id: t.id` in each row: an `insert` makes a second row when a task is sent twice.',
      static: (c) => {
        const src = code(c.files, 'sync.ts');
        if (/\.insert\s*\(/.test(src)) return '`insert` makes a new row every time: if the same task is sent twice (a retry, two taps on Sync), the cloud gets two. Use `upsert` with `{ onConflict: \'id\' }`.';
        return /\.upsert\s*\(/.test(src) && /onConflict\s*:\s*['"]id['"]/.test(src) && /id\s*:\s*t\.id/.test(src);
      },
    },
    {
      id: 'mark',
      label: 'marks sent rows with `UPDATE tasks SET synced = 1 WHERE id = ?`, only after no error',
      fail: 'After `if (error) throw error;`: `await db.runAsync(\'UPDATE tasks SET synced = 1 WHERE id = ?\', t.id);` for each task.',
      static: (c) => {
        const src = code(c.files, 'sync.ts');
        const upd = src.search(/UPDATE\s+tasks\s+SET\s+synced\s*=\s*1\s+WHERE\s+id\s*=\s*\?/i);
        const thr = src.search(/if\s*\(\s*error\s*\)\s*throw/);
        if (upd < 0) return false;
        return thr >= 0 && thr < upd ? true : 'Check the error first (`if (error) throw error;`), and mark the rows only after it: a failed send must stay synced = 0.';
      },
    },
    {
      id: 'offline',
      label: 'with Wi-Fi off, a new task waits on the phone (1 waiting, not in the cloud)',
      fail: 'With no connection the task must stay on the phone with synced = 0.',
      run: async (c) => {
        await waitForText(c.app, (t) => t.includes('Everything is in the cloud'), 5000);
        await c.app.network!(false);
        await waitForText(c.app, (t) => t.includes('Offline'), 3000);
        await c.app.type({ testID: 'title' }, 'Offline task');
        await c.app.press({ testID: 'add' });
        const t = await waitForText(c.app, (x) => x.includes('1 waiting to sync'), 4000);
        return t.includes('1 waiting to sync') && (await cloudCount(c.app, 'Offline task')) === 0;
      },
    },
    {
      id: 'online',
      label: 'when Wi-Fi comes back, it is sent once and marked synced',
      fail: 'When the connection is back, `syncPending` should upsert the waiting row and set `synced = 1`.',
      run: async (c) => {
        await c.app.network!(true);
        const n = await until(c.app, () => cloudCount(c.app, 'Offline task'), (x) => x >= 1, 6000);
        if (n === 0) return 'The task never reached the cloud. Read the rows `WHERE synced = 0` and upsert them.';
        const local = await until(c.app, () => sqliteRows(c.app, 'offline.db', 'tasks'), (r) => r?.find((x) => x.title === 'Offline task')?.synced === 1, 5000);
        if (local?.find((x) => x.title === 'Offline task')?.synced !== 1) return 'The task is in the cloud but still synced = 0 on the phone: it would be sent again and again. Run the UPDATE … SET synced = 1.';
        return n === 1 ? true : `The cloud has ${n} copies of the task. Use upsert with the phone’s id.`;
      },
    },
    {
      id: 'twice',
      label: 'two quick taps on Sync now still make only one row in the cloud',
      fail: 'Two syncs at the same time sent the same task twice. `upsert` with `onConflict: \'id\'` and the phone’s id keeps it one row.',
      run: async (c) => {
        await c.app.network!(false);
        await waitForText(c.app, (t) => t.includes('Offline'), 3000);
        await c.app.type({ testID: 'title' }, 'Second task');
        await c.app.press({ testID: 'add' });
        await waitForText(c.app, (t) => t.includes('waiting to sync'), 4000);
        await c.app.network!(true);
        await c.app.press({ testID: 'sync' });
        await c.app.press({ testID: 'sync' });
        const n = await until(c.app, () => cloudCount(c.app, 'Second task'), (x) => x >= 1, 6000);
        await c.app.wait(700); // a second copy, if any, arrives just after the first
        const final = await cloudCount(c.app, 'Second task');
        return final === 1 ? true : final === 0 || n === 0 ? 'The task was not sent when the connection came back.' : `The cloud has ${final} copies of “Second task”: use upsert on the phone’s id.`;
      },
    },
  ],
  hints: [
    'Read: `const waiting = await db.getAllAsync<LocalTask>(\'SELECT * FROM tasks WHERE synced = 0\');`',
    'Send: `const { error } = await supabase.from(\'tasks\').upsert(waiting.map((t) => ({ id: t.id, title: t.title, done: t.done === 1 })), { onConflict: \'id\' });` then `if (error) throw error;`',
    'Mark: `for (const t of waiting) await db.runAsync(\'UPDATE tasks SET synced = 1 WHERE id = ?\', t.id);` — after the error check, never before.',
  ],
  solution: {
    explain: 'The phone made each id, so the cloud row has the same id. `upsert` on that id turns a second send into an update of the same row, so retries and double taps never make duplicates. The rows are marked `synced = 1` only after Supabase answered without an error, so a failed send is simply tried again.',
    files: { 'sync.ts': SYNC_SOLUTION },
  },
  success: 'Your app works offline: it saves on the phone at once and catches up with the cloud when it can. A production app would also handle edits made on two phones (conflicts) and retry on a timer; this is the base they all start from.',
};
