/**
 * Lab 06's final project, "Offline-Ready Tasks App", as a BUENOVA Code course project (see course-projects.ts).
 * It puts together what Exercises 3–14 built: AsyncStorage (a preference), SQLite (the tasks on the phone),
 * SecureStore (the session, encrypted: Supabase's LargeSecureStore), Supabase (the tasks in the cloud) and NetInfo
 * (send what waits when the phone is back online). Plain StyleSheet styles and an App.tsx entry, so the same files run
 * in the Code Editor's phone emulator and in a new Expo app on a PC (npx create-expo-app … --template blank-typescript).
 */

const PACKAGE_JSON = `{
  "name": "offline-tasks",
  "version": "1.0.0",
  "main": "index.ts",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios"
  },
  "dependencies": {
    "@react-native-async-storage/async-storage": "2.2.0",
    "@react-native-community/netinfo": "12.0.1",
    "@supabase/supabase-js": "^2.117.2",
    "aes-js": "^3.1.2",
    "expo": "~58.0.0",
    "expo-crypto": "~58.0.0",
    "expo-secure-store": "~58.0.3",
    "expo-sqlite": "~58.0.17",
    "expo-status-bar": "~58.0.0",
    "react": "19.3.0",
    "react-native": "0.88.0",
    "react-native-get-random-values": "~1.11.0",
    "react-native-url-polyfill": "^2.0.0"
  },
  "devDependencies": {
    "@types/aes-js": "^3.1.4",
    "@types/react": "~19.3.0",
    "typescript": "^5.9.0"
  },
  "private": true
}
`;

const ENV = `# Your Supabase project (Lab 06, Part 5). Expo copies EXPO_PUBLIC_ variables into the app:
# only the project URL and the PUBLISHABLE key belong here, never a secret (sb_secret_…) key.
#
# These two point at the lab's practice project, which lives in the Code Editor's phone emulator.
# Replace them with your own project's values: Dashboard → Project Settings → API Keys.
EXPO_PUBLIC_SUPABASE_URL=https://practice.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_practice
`;

const SUPABASE = `import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { LargeSecureStore } from './largeSecureStore';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    // the session (access + refresh token) is saved encrypted: Part 4 + Part 5
    storage: new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
`;

const LARGE_SECURE_STORE = `import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as aesjs from 'aes-js';
import 'react-native-get-random-values';

// From Supabase's Expo tutorial. A session is bigger than SecureStore is made for (some iOS versions refused values
// above about 2048 bytes). So: a random AES-256 key is kept in SecureStore (small, encrypted by the phone), and the
// session, encrypted with that key, is kept in AsyncStorage. Someone who copies AsyncStorage gets only ciphertext.
export class LargeSecureStore {
  private async _encrypt(key: string, value: string) {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async _decrypt(key: string, value: string) {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) return encryptionKeyHex;
    const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(encryptionKeyHex), new aesjs.Counter(1));
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string) {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return encrypted;
    return this._decrypt(key, encrypted);
  }

  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }

  async setItem(key: string, value: string) {
    const encrypted = await this._encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }
}
`;

const PREFERENCES = `import AsyncStorage from '@react-native-async-storage/async-storage';

// A small setting: AsyncStorage is the right place (Part 2, Exercise 3)
export type Theme = 'light' | 'dark';
const KEY = 'preferences.theme';

export async function loadTheme(): Promise<Theme> {
  try {
    const saved = await AsyncStorage.getItem(KEY);
    return saved === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export async function saveTheme(theme: Theme) {
  try {
    await AsyncStorage.setItem(KEY, theme);
  } catch (error) {
    console.warn('Could not save the theme', error);
  }
}
`;

const DB = `import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

// synced: 0 = changed on this phone and not sent yet, 1 = the cloud has this version (Part 6)
export type LocalTask = { id: string; title: string; done: number; synced: number; updated_at: string };

// The database, opened once, with its table (Part 3, Exercise 6)
export const dbPromise = SQLite.openDatabaseAsync('offline-tasks.db').then(async (db) => {
  await db.execAsync(\`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      synced INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
  \`);
  return db;
});

const now = () => new Date().toISOString();

// The phone makes the id: the same task has the same id here and in the cloud (Exercise 14)
export async function addLocal(title: string) {
  const db = await dbPromise;
  await db.runAsync('INSERT INTO tasks (id, title, updated_at) VALUES (?, ?, ?)', Crypto.randomUUID(), title, now());
}

// A change waits to be sent again: synced back to 0
export async function toggleLocal(id: string) {
  const db = await dbPromise;
  await db.runAsync('UPDATE tasks SET done = 1 - done, synced = 0, updated_at = ? WHERE id = ?', now(), id);
}

export async function getLocal(): Promise<LocalTask[]> {
  const db = await dbPromise;
  return db.getAllAsync<LocalTask>('SELECT * FROM tasks ORDER BY updated_at DESC');
}
`;

const SYNC = `import { supabase } from './supabase';
import { dbPromise, type LocalTask } from './db';

// PUSH: sends every task that changed on this phone (Exercise 14). Returns how many it sent.
export async function syncPending(): Promise<number> {
  const db = await dbPromise;
  const waiting = await db.getAllAsync<LocalTask>('SELECT * FROM tasks WHERE synced = 0');
  if (waiting.length === 0) return 0;

  // upsert on the phone's id: sending a task twice changes one row, never makes two
  const { error } = await supabase
    .from('tasks')
    .upsert(waiting.map((t) => ({ id: t.id, title: t.title, done: t.done === 1, updated_at: t.updated_at })), { onConflict: 'id' });
  if (error) throw error; // still synced = 0: sent again next time

  for (const t of waiting) {
    // only if it did not change again while it was being sent
    await db.runAsync('UPDATE tasks SET synced = 1 WHERE id = ? AND updated_at = ?', t.id, t.updated_at);
  }
  return waiting.length;
}

// PULL: copies the cloud's tasks to this phone (a new phone gets them after signing in).
// A task that changed on this phone and is still waiting (synced = 0) is kept: the phone's version is sent next.
export async function pullFromCloud(): Promise<void> {
  const { data, error } = await supabase.from('tasks').select('id, title, done, updated_at');
  if (error) throw error;
  const db = await dbPromise;
  for (const row of data) {
    const local = await db.getFirstAsync<LocalTask>('SELECT * FROM tasks WHERE id = ?', row.id);
    if (local && local.synced === 0) continue;
    if (local) await db.runAsync('UPDATE tasks SET title = ?, done = ?, synced = 1, updated_at = ? WHERE id = ?', row.title, row.done ? 1 : 0, row.updated_at, row.id);
    else await db.runAsync('INSERT INTO tasks (id, title, done, synced, updated_at) VALUES (?, ?, ?, 1, ?)', row.id, row.title, row.done ? 1 : 0, row.updated_at);
  }
}
`;

const APP = `import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { loadTheme, saveTheme, type Theme } from './lib/preferences';
import { addLocal, getLocal, toggleLocal, type LocalTask } from './lib/db';
import { pullFromCloud, syncPending } from './lib/sync';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    loadTheme().then(setTheme);
    // a saved session (decrypted from LargeSecureStore) signs the user in again
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  function switchTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    saveTheme(next);
  }

  const c = theme === 'dark' ? dark : light;
  if (checking) return <View style={[s.center, c.bg]}><ActivityIndicator /></View>;
  return session ? <Tasks c={c} onTheme={switchTheme} theme={theme} /> : <SignIn c={c} />;
}

function SignIn({ c }: { c: Colors }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  async function signIn() {
    setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
  }

  return (
    <View style={[s.center, c.bg, { padding: 24, gap: 12 }]}>
      <Text style={[s.h1, c.text]}>Offline tasks</Text>
      <TextInput style={[s.input, c.input]} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={[s.input, c.input]} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <Pressable style={s.button} onPress={signIn}><Text style={s.buttonText}>Sign in</Text></Pressable>
      {message ? <Text style={s.error}>{message}</Text> : null}
      <Text style={[s.small, c.muted]}>Practice project: student@practice.dev · practice-123</Text>
    </View>
  );
}

function Tasks({ c, theme, onTheme }: { c: Colors; theme: Theme; onTheme: () => void }) {
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [title, setTitle] = useState('');
  const [online, setOnline] = useState(true);
  const [note, setNote] = useState('');

  const refresh = useCallback(async () => setTasks(await getLocal()), []);

  const sync = useCallback(async () => {
    try {
      const sent = await syncPending(); // push what waits…
      await pullFromCloud(); // …then copy the cloud's tasks
      setNote(sent ? \`Sent \${sent} to the cloud\` : '');
    } catch (error) {
      setNote(\`Not sent yet: \${(error as { message?: string }).message ?? String(error)}\`);
    }
    await refresh();
  }, [refresh]);

  useEffect(() => {
    refresh();
    // every time the connection comes back (and once at the start), sync
    return NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected));
      if (state.isConnected) sync();
    });
  }, []);

  async function add() {
    if (!title.trim()) return;
    await addLocal(title.trim()); // saved on the phone first: works with no connection
    setTitle('');
    await refresh();
    if (online) sync();
  }

  async function toggle(id: string) {
    await toggleLocal(id);
    await refresh();
    if (online) sync();
  }

  const waiting = tasks.filter((t) => t.synced === 0).length;
  return (
    <View style={[s.screen, c.bg]}>
      <View style={s.row}>
        <Text style={[s.h1, c.text]}>My tasks</Text>
        <Text style={[s.pill, online ? s.online : s.offline]}>{online ? 'Online' : 'Offline'}</Text>
      </View>
      <View style={s.row}>
        <TextInput style={[s.input, c.input, { flex: 1 }]} placeholder="New task" value={title} onChangeText={setTitle} onSubmitEditing={add} />
        <Pressable style={s.button} onPress={add}><Text style={s.buttonText}>Add</Text></Pressable>
      </View>
      <View style={s.row}>
        <Text style={c.muted}>{waiting ? \`\${waiting} waiting to sync\` : 'Everything is in the cloud'}</Text>
        <Pressable onPress={sync}><Text style={s.link}>Sync now</Text></Pressable>
      </View>
      {note ? <Text style={[s.small, c.muted]}>{note}</Text> : null}
      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <Pressable style={[s.card, c.card]} onPress={() => toggle(item.id)}>
            <Text style={[c.text, item.done ? s.done : null, { flex: 1 }]}>{item.done ? '☑ ' : '☐ '}{item.title}</Text>
            <Text style={item.synced ? s.synced : s.waiting}>{item.synced ? 'in the cloud' : 'waiting'}</Text>
          </Pressable>
        )}
      />
      <View style={s.row}>
        <Pressable onPress={onTheme}><Text style={s.link}>{theme === 'light' ? 'Dark theme' : 'Light theme'}</Text></Pressable>
        <Pressable onPress={() => supabase.auth.signOut()}><Text style={s.link}>Sign out</Text></Pressable>
      </View>
    </View>
  );
}

type Colors = typeof light;
const light = {
  bg: { backgroundColor: '#f8fafc' },
  card: { backgroundColor: '#ffffff' },
  text: { color: '#0f172a' },
  muted: { color: '#475569' },
  input: { backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#0f172a' },
};
const dark: Colors = {
  bg: { backgroundColor: '#0f172a' },
  card: { backgroundColor: '#1e293b' },
  text: { color: '#f8fafc' },
  muted: { color: '#cbd5e1' },
  input: { backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' },
};

const s = StyleSheet.create({
  screen: { flex: 1, padding: 20, paddingTop: 60, gap: 12 },
  center: { flex: 1, alignItems: 'stretch', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  h1: { fontSize: 26, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  button: { backgroundColor: '#4f46e5', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: '#ffffff', fontWeight: '600' },
  link: { color: '#4f46e5', fontWeight: '600' },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, fontSize: 12, fontWeight: '700', overflow: 'hidden' },
  online: { backgroundColor: '#d1fae5', color: '#065f46' },
  offline: { backgroundColor: '#fef3c7', color: '#78350f' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, marginBottom: 8 },
  done: { textDecorationLine: 'line-through' },
  synced: { color: '#047857', fontSize: 12 },
  waiting: { color: '#92400e', fontSize: 12 },
  small: { fontSize: 13 },
  error: { color: '#b91c1c' },
});
`;

const SCHEMA = `-- Run this once in YOUR Supabase project: Dashboard → SQL Editor → New query → paste → Run.

-- 1. The tasks table: the same columns as the app's SQLite table, plus whose task it is
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) > 0),
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Only signed-in users reach it, and Row Level Security decides which rows
revoke all on table public.tasks from anon;
grant select, insert, update, delete on table public.tasks to authenticated;
alter table public.tasks enable row level security;

create policy "Users read their own tasks" on public.tasks
  for select to authenticated using ( (select auth.uid()) = user_id );
create policy "Users add their own tasks" on public.tasks
  for insert to authenticated with check ( (select auth.uid()) = user_id );
create policy "Users update their own tasks" on public.tasks
  for update to authenticated using ( (select auth.uid()) = user_id ) with check ( (select auth.uid()) = user_id );
create policy "Users delete their own tasks" on public.tasks
  for delete to authenticated using ( (select auth.uid()) = user_id );

-- 3. Optional (Exercise 12): profile photos in a public bucket, one folder per user
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
create policy "Users upload their own avatar" on storage.objects
  for insert to authenticated with check ( bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text );
create policy "Users replace their own avatar" on storage.objects
  for update to authenticated using ( bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text );
create policy "Users see their own avatar files" on storage.objects
  for select to authenticated using ( bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text );
`;

const GUIDE = `# Lab 06 · Offline-Ready Tasks App

This app puts together everything you built in Lab 06. It already runs: press **▶ Play** and sign in with the practice account **student@practice.dev** / **practice-123**. The steps below show where each part comes from, then connect it to **your own** Supabase project.

## Step 1 · A preference in AsyncStorage
Open [lib/preferences.ts](lib/preferences.ts). The theme is one small value, saved with \`setItem\` and read with \`getItem\` (Exercise 3). Press **Dark theme**, then **Restart** the emulator: the theme stays.

## Step 2 · The tasks in SQLite
Open [lib/db.ts](lib/db.ts). The \`tasks\` table lives on the phone (Exercise 6). Each task gets its id **on the phone** (\`Crypto.randomUUID()\`), and \`synced = 0\` means "changed here, not sent yet". A change sets \`synced\` back to 0.

## Step 3 · The session, encrypted
Open [lib/largeSecureStore.ts](lib/largeSecureStore.ts) and [lib/supabase.ts](lib/supabase.ts). Supabase saves the session (access and refresh token) through \`auth.storage\`. Here it is encrypted: the key lives in **SecureStore** (Exercise 8) and only ciphertext goes to AsyncStorage.

## Step 4 · Your own Supabase project
1. In Supabase, open your project → **SQL Editor** → **New query**, paste [supabase/schema.sql](supabase/schema.sql) and press **Run**.
2. **Authentication → Users → Add user → Create new user**: type an email and a password, tick **Auto Confirm User**, and create it.
3. **Project Settings → API Keys**: copy the **Project URL** and the **publishable key** (\`sb_publishable_…\`) into [.env](.env). Never the secret key.
4. Press **▶ Play** and sign in with the user you created. Your tasks now go to your project: watch them appear in **Table Editor → tasks**.

## Step 5 · Offline and sync
Open [lib/sync.ts](lib/sync.ts). \`syncPending\` is Exercise 14: read \`WHERE synced = 0\`, **upsert** on the id, mark \`synced = 1\` only after no error. \`pullFromCloud\` copies the cloud's tasks to the phone, and never overwrites a change that is still waiting.

## Step 6 · Test it
- Switch the emulator's **Wi-Fi off**, add two tasks: they show "waiting".
- Switch Wi-Fi on: they become "in the cloud", and the cloud has **one** row each.
- Restart the app: still signed in (the session was saved, encrypted), the theme stayed, the tasks are read from SQLite.
- Sign out and sign in again: the tasks come back from the cloud.

## On your PC (optional)
\`\`\`
npx create-expo-app@latest offline-tasks --template blank-typescript
cd offline-tasks
npx expo install @supabase/supabase-js react-native-url-polyfill expo-sqlite expo-secure-store expo-crypto @react-native-async-storage/async-storage @react-native-community/netinfo react-native-get-random-values
npm install aes-js
npm install --save-dev @types/aes-js
\`\`\`
Copy **App.tsx**, the **lib** folder and **.env** into the new project, then \`npx expo start\` and open it in **Expo Go**.
`;

export const LAB06_PROJECT = {
  id: 'lab06-tasks',
  title: 'Lab 06 · Offline-ready tasks',
  kind: 'react-native',
  lab: 'Lab 06',
  description: 'The final project of Lab 06: AsyncStorage, SQLite, SecureStore and Supabase together, with offline sync.',
  open: ['/lib/sync.ts', '/App.tsx'],
  files: (): Record<string, string> => ({
    '/GUIDE.md': GUIDE,
    '/App.tsx': APP,
    '/index.ts': "import { registerRootComponent } from 'expo';\nimport App from './App';\n\nregisterRootComponent(App);\n",
    '/lib/supabase.ts': SUPABASE,
    '/lib/largeSecureStore.ts': LARGE_SECURE_STORE,
    '/lib/preferences.ts': PREFERENCES,
    '/lib/db.ts': DB,
    '/lib/sync.ts': SYNC,
    '/supabase/schema.sql': SCHEMA,
    '/.env': ENV,
    '/package.json': PACKAGE_JSON,
    '/app.json': JSON.stringify({ expo: { name: 'offline-tasks', slug: 'offline-tasks', version: '1.0.0', orientation: 'portrait', userInterfaceStyle: 'automatic' } }, null, 2) + '\n',
    '/tsconfig.json': JSON.stringify({ extends: 'expo/tsconfig.base', compilerOptions: { strict: true } }, null, 2) + '\n',
  }),
};
