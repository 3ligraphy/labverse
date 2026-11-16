// The phone storage of the lab preview (Lab 06): AsyncStorage, MMKV, SecureStore, NetInfo, SQLite (sql.js) and the
// practice Supabase project — same APIs as the real packages, data that survives "Restart app", and the snapshot the
// Device storage panel shows. Runs the real preview runtime in happy-dom.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register({ url: 'http://localhost/', width: 390, height: 844 });
const { createRuntime } = await import('../src/lab/runtime/core.ts');
const { compileAll } = await import('../src/lab/engine/compile.ts');
const device = await import('../src/lab/runtime/device.ts');
const practice = await import('../src/lab/runtime/supabase-practice.ts');

const wasm = readFileSync(new URL('../node_modules/sql.js/dist/sql-wasm-browser.wasm', import.meta.url));
const loadAsset = async (name: string) => {
  assert.equal(name, 'sql-wasm-browser.wasm');
  return wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength);
};

function harness() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const posted: { type: string; error?: { message: string } }[] = [];
  const runtime = createRuntime({ container, post: (m) => posted.push(m as never), loadAsset });
  return {
    runtime,
    async run(files: Record<string, string>) {
      posted.length = 0;
      const c = compileAll(files);
      assert.ok(c.ok, JSON.stringify(!c.ok && c.errors));
      await runtime.run({ type: 'run', id: 1, files: c.ok ? c.files : {}, entry: 'App.tsx', frame: 'phone' });
      return posted.find((m) => m.type === 'error')?.error ?? null;
    },
    text: () => runtime.driver.text(),
    press: (q: object) => runtime.driver.press(q),
    wait: (ms: number) => new Promise((r) => setTimeout(r, ms)),
    async until(test: (t: string) => boolean, ms = 3000) {
      const end = Date.now() + ms;
      for (;;) {
        const t = await runtime.driver.text();
        if (test(t)) return t;
        if (Date.now() > end) return t;
        await new Promise((r) => setTimeout(r, 40));
      }
    },
  };
}

test('AsyncStorage: JSON text saved, survives a restart (rerun), React state does not', async () => {
  device.resetDevice();
  const h = harness();
  const err = await h.run({
    'App.tsx': `import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
export default function App() {
  const [saved, setSaved] = useState('(nothing)');
  const [clicks, setClicks] = useState(0);
  useEffect(() => { AsyncStorage.getItem('settings').then((t) => t && setSaved(JSON.parse(t).theme)); }, []);
  return (
    <View>
      <Text>saved: {saved}</Text>
      <Text>clicks: {clicks}</Text>
      <Pressable testID="save" onPress={async () => { setClicks(clicks + 1); await AsyncStorage.setItem('settings', JSON.stringify({ theme: 'dark' })); setSaved('dark'); }}><Text>Save</Text></Pressable>
    </View>
  );
}`,
  });
  assert.equal(err, null);
  assert.match(await h.text(), /saved: \(nothing\)/);
  await h.press({ testID: 'save' });
  assert.match(await h.until((t) => /saved: dark/.test(t)), /clicks: 1/);
  await h.runtime.rpc('rerun', []);
  const after = await h.until((t) => /saved: dark/.test(t));
  assert.match(after, /saved: dark/, 'the setting is still there after a restart');
  assert.match(after, /clicks: 0/, 'state starts again');
  const snap = device.snapshot();
  const rows = snap.sections.find((s) => s.id === 'async-storage')!.rows!;
  assert.deepEqual(rows, [{ key: 'settings', value: '{"theme":"dark"}', type: 'string' }]);
});

test('MMKV v4: createMMKV is synchronous and keeps types; objects need JSON.stringify', async () => {
  device.resetDevice();
  const h = harness();
  const err = await h.run({
    'App.tsx': `import { Text } from 'react-native';
import { createMMKV } from 'react-native-mmkv';
const storage = createMMKV();
storage.set('count', 5);
storage.set('dark', true);
let objectError = '';
try { storage.set('user', { name: 'Mona' }); } catch (e) { objectError = e.message; }
export default function App() {
  return <Text>{storage.getNumber('count') + 1} {String(storage.getBoolean('dark'))} {String(storage.getString('count'))} {objectError ? 'object refused' : ''}</Text>;
}`,
  });
  assert.equal(err, null);
  assert.equal((await h.text()).trim(), '6 true undefined object refused');
  const mmkv = device.snapshot().sections.find((s) => s.id === 'mmkv:mmkv.default')!;
  assert.deepEqual(mmkv.rows!.map((r) => [r.key, r.type]), [['count', 'number'], ['dark', 'boolean']]);
});

test('SecureStore: strings only, valid keys, shown encrypted in the panel', async () => {
  device.resetDevice();
  const h = harness();
  const err = await h.run({
    'App.tsx': `import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import * as SecureStore from 'expo-secure-store';
export default function App() {
  const [out, setOut] = useState('…');
  useEffect(() => {
    (async () => {
      await SecureStore.setItemAsync('auth.token', 'eyJhbGciOi.secret.token');
      const back = await SecureStore.getItemAsync('auth.token');
      let bad = '';
      try { await SecureStore.setItemAsync('my token', 'x'); } catch (e) { bad = e.message; }
      setOut(back + ' | ' + (bad.includes('Invalid key') ? 'bad key refused' : 'no'));
    })();
  }, []);
  return <Text>{out}</Text>;
}`,
  });
  assert.equal(err, null);
  assert.equal(await h.until((t) => t.includes('|')), 'eyJhbGciOi.secret.token | bad key refused');
  const s = device.snapshot().sections.find((x) => x.id === 'secure-store')!;
  assert.equal(s.encrypted, true);
  assert.equal(s.rows!.length, 1);
  assert.ok(!s.rows![0].value.includes('secret'), 'the panel never shows the secret itself');
});

test('expo-sqlite on real SQLite: CRUD with ? parameters, survives a restart, shown as a table', async () => {
  device.resetDevice();
  const h = harness();
  const files = {
    'App.tsx': `import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import * as SQLite from 'expo-sqlite';
export default function App() {
  const [out, setOut] = useState('…');
  useEffect(() => {
    (async () => {
      const db = await SQLite.openDatabaseAsync('tasks.db');
      await db.execAsync('CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0)');
      const before = await db.getAllAsync('SELECT * FROM tasks');
      if (before.length === 0) {
        const r = await db.runAsync('INSERT INTO tasks (title) VALUES (?)', 'Buy milk');
        await db.runAsync('INSERT INTO tasks (title) VALUES (?)', ['Read']);
        await db.runAsync('UPDATE tasks SET done = ? WHERE id = $id', { $id: r.lastInsertRowId }); // wrong on purpose: mixed styles are not allowed
      }
      const rows = await db.getAllAsync('SELECT title, done FROM tasks ORDER BY id');
      const one = await db.getFirstAsync('SELECT COUNT(*) AS n FROM tasks');
      setOut(rows.map((t) => t.title + ':' + t.done).join(', ') + ' / ' + one.n);
    })().catch((e) => setOut('error ' + e.message));
  }, []);
  return <Text>{out}</Text>;
}`,
  };
  assert.equal(await h.run(files), null);
  const first = await h.until((t) => t !== '…');
  assert.match(first, /^error SQLite error:/, 'binding mistakes surface as SQLite errors');

  // a correct version: the data written before the error stays (no transaction)
  const ok = { 'App.tsx': files['App.tsx'].replace("await db.runAsync('UPDATE tasks SET done = ? WHERE id = $id', { $id: r.lastInsertRowId });", "await db.runAsync('UPDATE tasks SET done = 1 WHERE id = ?', r.lastInsertRowId);") };
  device.resetDevice();
  assert.equal(await h.run(ok), null);
  assert.equal(await h.until((t) => t !== '…'), 'Buy milk:1, Read:0 / 2');
  await h.runtime.rpc('rerun', []);
  assert.equal(await h.until((t) => t !== '…'), 'Buy milk:1, Read:0 / 2', 'the database file is still there after a restart');
  const t = device.snapshot().sections.find((s) => s.id === 'sqlite:tasks.db')!.tables!.find((x) => x.name === 'tasks')!;
  assert.deepEqual(t.columns, ['id', 'title', 'done']);
  assert.deepEqual(t.rows, [[1, 'Buy milk', 1], [2, 'Read', 0]]);
});

test('practice Supabase: RLS hides other users’ rows, blocks anonymous writes, returns Postgres codes', async () => {
  practice.resetPractice();
  const sb = practice.createPracticeClient(practice.PRACTICE_URL, practice.PRACTICE_KEY);
  // not signed in: RLS shows nothing and refuses inserts
  assert.deepEqual((await sb.from('tasks').select('*')).data, []);
  const anon = await sb.from('tasks').insert({ title: 'x' });
  assert.equal(anon.error?.code, '42501');
  assert.match(anon.error!.message, /row-level security policy for table "tasks"/);
  // signed in as Mona: only her task
  const login = await sb.auth.signInWithPassword({ email: practice.MONA.email, password: practice.MONA.password });
  assert.equal(login.error, null);
  const mine = await sb.from('tasks').select('title').order('created_at');
  assert.deepEqual(mine.data, [{ title: 'Read Part 5 of the lab' }]);
  // insert returns nothing unless .select() is chained
  const plain = await sb.from('tasks').insert({ title: 'Buy milk' });
  assert.equal(plain.data, null);
  assert.equal(plain.status, 201);
  const back = await sb.from('tasks').insert({ title: 'Read' }).select().single();
  assert.equal((back.data as { title: string }).title, 'Read');
  assert.equal((back.data as { user_id: string }).user_id, practice.MONA.id, 'user_id defaults to auth.uid()');
  // update/delete need a filter, and only touch your rows
  assert.equal((await sb.from('tasks').update({ done: true })).error?.code, '21000');
  const upd = await sb.from('tasks').update({ done: true }).eq('title', 'Buy milk').select();
  assert.equal((upd.data as unknown[]).length, 1);
  const theirs = await sb.from('tasks').delete().eq('id', 'b2222222-2222-4222-8222-222222222222').select();
  assert.deepEqual(theirs.data, [], 'another user’s row is not deleted (RLS)');
  // wrong column, empty title, notes table without a policy
  assert.equal((await sb.from('tasks').insert({ titel: 'x' })).error?.code, 'PGRST204');
  assert.equal((await sb.from('tasks').insert({ title: '' })).error?.code, '23514');
  assert.deepEqual((await sb.from('notes').select()).data, []);
  assert.equal((await sb.from('notes').insert({ body: 'hi' })).error?.code, '42501');
  // upsert with the same id twice: one row, not two
  const id = 'd4444444-4444-4444-8444-444444444444';
  await sb.from('tasks').upsert({ id, title: 'Synced once' }, { onConflict: 'id' });
  await sb.from('tasks').upsert({ id, title: 'Synced once' }, { onConflict: 'id' });
  assert.equal(practice.practiceRows('tasks').filter((r) => r.id === id).length, 1);
});

test('practice Supabase: offline requests fail like fetch, storage keeps per-user folders, public URLs resolve', async () => {
  practice.resetPractice();
  device.setOnline(true);
  const sb = practice.createPracticeClient(practice.PRACTICE_URL, practice.PRACTICE_KEY);
  await sb.auth.signInWithPassword({ email: practice.MONA.email, password: practice.MONA.password });
  device.setOnline(false);
  const off = await sb.from('tasks').select();
  assert.equal(off.data, null);
  assert.equal(off.error?.message, 'TypeError: Network request failed');
  device.setOnline(true);
  const bytes = new Uint8Array([137, 80, 78, 71]).buffer;
  const wrong = await sb.storage.from('avatars').upload('someone-else/avatar.png', bytes, { contentType: 'image/png' });
  assert.equal((wrong.error as { statusCode: string }).statusCode, '403');
  const ok = await sb.storage.from('avatars').upload(`${practice.MONA.id}/avatar.png`, bytes, { contentType: 'image/png' });
  assert.equal(ok.error, null);
  assert.equal((ok.data as { fullPath: string }).fullPath, `avatars/${practice.MONA.id}/avatar.png`);
  const again = await sb.storage.from('avatars').upload(`${practice.MONA.id}/avatar.png`, bytes, { contentType: 'image/png' });
  assert.equal((again.error as { statusCode: string }).statusCode, '409', 'no overwrite without upsert');
  const { data } = sb.storage.from('avatars').getPublicUrl(`${practice.MONA.id}/avatar.png`);
  assert.equal(data.publicUrl, `${practice.PRACTICE_URL}/storage/v1/object/public/avatars/${practice.MONA.id}/avatar.png`);
});

test('a secret key is refused before anything runs', async () => {
  const { createClient } = await import('../src/lab/runtime/supabase.ts');
  assert.throws(() => createClient('https://practice.supabase.co', 'sb_secret_abc'), /secret key must never be in an app/);
});

test('NetInfo follows the Wi-Fi switch', async () => {
  device.resetDevice();
  const h = harness();
  const err = await h.run({
    'App.tsx': `import { Text } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
export default function App() {
  const net = useNetInfo();
  return <Text>{net.isConnected ? 'online' : 'offline'} {net.type}</Text>;
}`,
  });
  assert.equal(err, null);
  assert.equal(await h.until((t) => t.startsWith('online')), 'online wifi');
  await h.runtime.rpc('network', [false]);
  assert.equal(await h.until((t) => t.startsWith('offline')), 'offline none');
  await h.runtime.rpc('network', [true]);
});

test('.env: EXPO_PUBLIC_ variables reach process.env, others do not', async () => {
  device.resetDevice();
  const h = harness();
  const err = await h.run({
    '.env': 'EXPO_PUBLIC_SUPABASE_URL=https://practice.supabase.co\nSECRET_THING=nope\n# comment',
    'App.tsx': `import { Text } from 'react-native';
export default function App() { return <Text>{process.env.EXPO_PUBLIC_SUPABASE_URL} {String(process.env.SECRET_THING)}</Text>; }`,
  });
  assert.equal(err, null);
  assert.equal(await h.text(), 'https://practice.supabase.co undefined');
});

test('the practice cloud shows in the panel only after the app makes a Supabase client', () => {
  device.resetDevice();
  const ids = () => device.snapshot().sections.map((s) => s.id);
  assert.ok(!ids().includes('supabase-db'), 'an AsyncStorage or SQLite app shows no cloud');
  practice.createPracticeClient(practice.PRACTICE_URL, practice.PRACTICE_KEY);
  assert.ok(ids().includes('supabase-db'), 'shown once a client exists');
  device.resetDevice();
  assert.ok(!ids().includes('supabase-db'), 'Erase phone hides it again until the app makes a client');
});

/* ------------------------------------------------------------ Realtime (Lab 06 Part 5 H) */

type Payload = { schema: string; table: string; eventType: string; new: Record<string, unknown>; old: Record<string, unknown>; errors: null };
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(test: () => boolean, ms = 1500) {
  const end = Date.now() + ms;
  while (!test() && Date.now() < end) await pause(20);
  return test();
}
async function signedInClient(who = practice.MONA) {
  const sb = practice.createPracticeClient(practice.PRACTICE_URL, practice.PRACTICE_KEY);
  const { error } = await sb.auth.signInWithPassword({ email: who.email, password: who.password });
  assert.equal(error, null);
  return sb;
}
function listen(sb: ReturnType<typeof practice.createPracticeClient>, event: 'INSERT' | '*' = 'INSERT') {
  const got: Payload[] = [];
  const statuses: string[] = [];
  const ch = sb
    .channel('tasks-feed')
    .on('postgres_changes', { event, schema: 'public', table: 'tasks' }, (p: Payload) => got.push(p))
    .subscribe((s: string) => statuses.push(s));
  return { ch, got, statuses };
}

test('realtime: an insert from another phone reaches a subscribed app once', async () => {
  device.resetDevice();
  const sb = await signedInClient();
  const { got, statuses } = listen(sb);
  assert.ok(await waitFor(() => statuses.includes('SUBSCRIBED')), 'the channel says SUBSCRIBED');
  practice.practiceRemote({ kind: 'insert', table: 'tasks', title: 'From the tablet' });
  assert.ok(await waitFor(() => got.length > 0), 'the event arrives');
  await pause(300);
  assert.equal(got.length, 1, 'once');
  assert.equal(got[0].eventType, 'INSERT');
  assert.equal(got[0].schema, 'public');
  assert.equal(got[0].table, 'tasks');
  assert.equal(got[0].new.title, 'From the tablet');
  assert.equal(got[0].errors, null);
});

test('realtime: other users’ rows are not delivered (RLS)', async () => {
  device.resetDevice();
  const sb = await signedInClient();
  const { got, statuses } = listen(sb, '*');
  await waitFor(() => statuses.includes('SUBSCRIBED'));
  practice.practiceRemote({ kind: 'insert', table: 'tasks', title: 'Omar’s new task' }, practice.CLASSMATE.id);
  await pause(500);
  assert.equal(got.length, 0, 'Omar’s row is not sent to Mona');
  practice.practiceRemote({ kind: 'insert', table: 'tasks', title: 'Mona on the tablet' });
  assert.ok(await waitFor(() => got.length === 1));
});

test('realtime: removeChannel and offline stop delivery, and nothing is replayed', async () => {
  device.resetDevice();
  const sb = await signedInClient();
  const first = listen(sb);
  await waitFor(() => first.statuses.includes('SUBSCRIBED'));
  assert.equal(await sb.removeChannel(first.ch), 'ok');
  practice.practiceRemote({ kind: 'insert', table: 'tasks', title: 'After remove' });
  await pause(400);
  assert.equal(first.got.length, 0, 'a removed channel hears nothing');
  assert.equal(practice.activeChannels(), 0);

  const second = listen(sb);
  await waitFor(() => second.statuses.includes('SUBSCRIBED'));
  device.setOnline(false);
  practice.practiceRemote({ kind: 'insert', table: 'tasks', title: 'While offline' });
  await pause(400);
  device.setOnline(true);
  await pause(400);
  assert.equal(second.got.length, 0, 'offline: no event, and none replayed when back online');
  practice.practiceRemote({ kind: 'insert', table: 'tasks', title: 'Back online' });
  assert.ok(await waitFor(() => second.got.length === 1), 'events flow again once online');
  assert.equal(second.got[0].new.title, 'Back online');
});

test('realtime: a restart (rerun) leaves one subscription, and the panel shows it', async () => {
  device.resetDevice();
  const h = harness();
  const err = await h.run({
    'App.tsx': `import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://practice.supabase.co', 'sb_publishable_practice');
export default function App() {
  const [items, setItems] = useState<string[]>([]);
  useEffect(() => {
    supabase.auth.signInWithPassword({ email: 'student@practice.dev', password: 'practice-123' }).then(() => {
      supabase.channel('feed').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, (p) => setItems((x) => [...x, p.new.title])).subscribe();
    });
  }, []);
  return <Text>{items.length ? items.join(',') : 'none'}</Text>;
}`,
  });
  assert.equal(err, null);
  assert.ok(await waitFor(() => practice.activeChannels() === 1, 3000), 'one channel after the first start');
  await h.runtime.rpc('rerun', []);
  await pause(50);
  assert.ok(await waitFor(() => practice.activeChannels() === 1, 3000), 'still one channel after Restart app');
  const line = device.snapshot().sections.find((s) => s.id === 'supabase-db')?.lines?.join('\n') ?? '';
  assert.match(line, /Realtime: 1 channel open/);
  practice.practiceRemote({ kind: 'insert', table: 'tasks', title: 'From the tablet' });
  assert.equal(await h.until((t) => t.includes('From the tablet')), 'From the tablet', 'shown once, not twice');
  h.runtime.unmount();
});

test('auth: startAutoRefresh / stopAutoRefresh (the AppState pattern) exist', async () => {
  const sb = await signedInClient();
  await sb.auth.startAutoRefresh();
  await sb.auth.stopAutoRefresh();
});
