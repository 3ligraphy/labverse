/** Lab 06 · Part 5 — the cloud: Supabase. Exercises 9–12 (3 + 8 + 3 + 6 = 20 min). */
import type { CodeExercise, MatchExercise, PredictExercise } from '../types.ts';
import { LAB_ID } from './meta.ts';
import { cloudFiles, cloudRows, code, STUDENT, SUPABASE_CLIENT, until, waitForText } from './shared.ts';

const id = (name: string) => `${LAB_ID}--${name}`;

export const ex09: MatchExercise = {
  id: id('supabase-parts'),
  n: 9,
  title: 'Keys and parts of Supabase',
  minutes: 3,
  level: 2,
  kind: 'match',
  prompt: 'Drag each thing to where it belongs in a Supabase project. One of them must never be anywhere near an app: leave it out.',
  pairs: [
    { chip: 'sb_publishable_…', target: 'in the app (.env, EXPO_PUBLIC_…): safe to ship', why: 'The publishable key only reaches what Row Level Security allows. It is made to be in apps.' },
    { chip: 'sb_secret_…', target: 'only on a server you control', why: 'A secret key skips Row Level Security. In an app, anyone could read it and see every row.' },
    { chip: 'A row of the tasks table', target: 'Supabase Database (Postgres)', why: 'Rows and columns live in the Postgres database.' },
    { chip: 'avatar.png', target: 'Supabase Storage (a bucket)', why: 'Files live in buckets; the database can keep their path or URL.' },
    { chip: 'The signed-in user and their session', target: 'Supabase Auth', why: 'Auth checks the password and gives the app a session: an access token and a refresh token.' },
    { chip: 'using ( (select auth.uid()) = user_id )', target: 'Row Level Security: who may see which rows', why: 'A policy runs inside the database for every row and every request.' },
  ],
  decoys: [{ chip: 'service_role key in EXPO_PUBLIC_SUPABASE_KEY', why: '`service_role` is the old name of a secret key. EXPO_PUBLIC_ values are built into the app for everyone to read.' }],
  mono: true,
  hints: [
    'Two keys: one is made for apps (publishable), one for servers only (secret).',
    'Rows go to the Database, files to Storage, users and sessions to Auth.',
    'The line with `auth.uid()` is a policy: Row Level Security.',
  ],
  solution: {
    explain: 'The app only ever holds the project URL and the publishable key; everything it may do is decided by Auth (who you are) and Row Level Security (what you may touch).',
    text: 'sb_publishable_… → in the app · sb_secret_… → server only · a row → Database · avatar.png → Storage · user and session → Auth · `auth.uid() = user_id` → Row Level Security. Left out: a service_role key in EXPO_PUBLIC_.',
  },
  success: 'Exercises 10 to 12 use each part: the Database (tasks), Auth (signing in), Storage (a photo) and RLS (only your rows).',
};

/* -------------------------------------------------------------- Exercise 10 */

const CLOUD_STARTER = `import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { supabase } from './lib/supabase';

type Task = { id: string; title: string; done: boolean; created_at: string };

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('Signing in…');

  // Sign in with the practice project's student account (Row Level Security needs a user)
  useEffect(() => {
    supabase.auth.signInWithPassword({ email: '${STUDENT.email}', password: '${STUDENT.password}' }).then(({ error }) => {
      if (error) return setMessage(error.message);
      setMessage('');
      load();
    });
  }, []);

  // 1. SELECT: this user's tasks, oldest first: supabase.from('tasks').select('*').order('created_at')
  //    If error: setMessage(error.message). Else: setTasks(data)
  async function load() {
  }

  // 2. INSERT one task with this title, then load() again (check error first)
  async function add() {
    setTitle('');
  }

  // 3. UPDATE done to the opposite value, only for this task: .eq('id', task.id), then load()
  async function toggle(task: Task) {
  }

  // 4. DELETE this task: .eq('id', task.id), then load()
  async function remove(task: Task) {
  }

  return (
    <View className="flex-1 bg-slate-50 p-5 pt-14">
      <Text className="text-2xl font-bold text-slate-900">Cloud tasks</Text>
      <View className="mt-4 flex-row gap-2">
        <TextInput testID="title" value={title} onChangeText={setTitle} placeholder="New task" className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2" />
        <Pressable testID="add" onPress={add} className="justify-center rounded-xl bg-emerald-600 px-4">
          <Text className="font-semibold text-white">Add</Text>
        </Pressable>
      </View>
      {message ? <Text testID="message" className="mt-3 text-red-700">{message}</Text> : null}
      <FlatList
        className="mt-4"
        data={tasks}
        keyExtractor={(t) => t.id}
        renderItem={({ item, index }) => (
          <View className="mb-2 flex-row items-center gap-3 rounded-xl bg-white p-3">
            <Pressable testID={\`toggle-\${index}\`} onPress={() => toggle(item)}>
              <Text className="text-lg text-emerald-700">{item.done ? '☑' : '☐'}</Text>
            </Pressable>
            <Text className={\`flex-1 \${item.done ? 'text-slate-500 line-through' : 'text-slate-900'}\`}>{item.title}</Text>
            <Pressable testID={\`delete-\${index}\`} onPress={() => remove(item)}>
              <Text className="text-red-700">Delete</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}
`;

export const CLOUD_SOLUTION = CLOUD_STARTER.replace(
  `  async function load() {
  }`,
  `  async function load() {
    const { data, error } = await supabase.from('tasks').select('*').order('created_at');
    if (error) return setMessage(error.message);
    setTasks(data);
  }`,
).replace(
  `  async function add() {
    setTitle('');
  }`,
  `  async function add() {
    if (!title.trim()) return;
    const { error } = await supabase.from('tasks').insert({ title: title.trim() });
    if (error) return setMessage(error.message);
    setTitle('');
    load();
  }`,
).replace(
  `  async function toggle(task: Task) {
  }`,
  `  async function toggle(task: Task) {
    const { error } = await supabase.from('tasks').update({ done: !task.done }).eq('id', task.id);
    if (error) return setMessage(error.message);
    load();
  }`,
).replace(
  `  async function remove(task: Task) {
  }`,
  `  async function remove(task: Task) {
    const { error } = await supabase.from('tasks').delete().eq('id', task.id);
    if (error) return setMessage(error.message);
    load();
  }`,
);

const titled = (rows: Record<string, unknown>[], title: string) => rows.filter((r) => r.title === title);

export const ex10: CodeExercise = {
  id: id('cloud-tasks'),
  n: 10,
  title: 'Tasks in the cloud',
  minutes: 8,
  level: 5,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  freshDevice: true,
  prompt: 'The app signs in to the lab’s **practice Supabase project**. Write `load`, `add`, `toggle` and `remove` with `supabase.from(\'tasks\')`, and check `error` after every call. **Device storage** shows the cloud table (every user’s rows) and each request your app sends.',
  files: { 'App.tsx': CLOUD_STARTER, 'lib/supabase.ts': SUPABASE_CLIENT },
  checks: [
    {
      id: 'errors',
      label: 'every call reads `{ data, error }` and handles the error',
      fail: 'Write `const { data, error } = await supabase…` and `if (error) return setMessage(error.message);` after each call.',
      static: (c) => (code(c.files).match(/\{\s*(data\s*,\s*)?error\s*\}\s*=\s*await\s+supabase/g) ?? []).length >= 4 && /if\s*\(\s*error\s*\)/.test(code(c.files)),
    },
    {
      id: 'filters',
      label: 'update and delete are limited with `.eq(\'id\', task.id)`',
      fail: 'Without a filter Supabase refuses the request (or would change every row you may see). Add `.eq(\'id\', task.id)`.',
      static: (c) => (code(c.files).match(/\.eq\s*\(\s*['"]id['"]\s*,\s*task\.id\s*\)/g) ?? []).length >= 2,
    },
    {
      id: 'select',
      label: 'the list shows your task, and not Omar’s (Row Level Security)',
      fail: 'In `load`: `const { data, error } = await supabase.from(\'tasks\').select(\'*\').order(\'created_at\');` then `setTasks(data)`.',
      run: async (c) => {
        const t = await waitForText(c.app, (x) => x.includes('Read Part 5 of the lab') || /error|violates|Could not/i.test(x), 5000);
        if (t.includes('Omar')) return 'Omar’s task is on the screen. Only Row Level Security should decide what you see: do not fetch other users’ rows another way.';
        return t.includes('Read Part 5 of the lab');
      },
    },
    {
      id: 'insert',
      label: 'Add saves “Buy milk” in the cloud table',
      fail: 'In `add`: `const { error } = await supabase.from(\'tasks\').insert({ title });` then `load()`.',
      run: async (c) => {
        await waitForText(c.app, (x) => x.includes('Read Part 5 of the lab'), 5000);
        await c.app.type({ testID: 'title' }, 'Buy milk');
        await c.app.press({ testID: 'add' });
        const rows = await until(c.app, () => cloudRows(c.app, 'tasks'), (r) => titled(r, 'Buy milk').length > 0, 5000);
        const mine = titled(rows, 'Buy milk');
        if (!mine.length) {
          const msg = await c.app.text();
          return /violates row-level security/.test(msg) ? 'Row Level Security refused the insert: are you signed in? Insert after the sign-in has finished.' : false;
        }
        const screen = await waitForText(c.app, (x) => x.includes('Buy milk'), 4000);
        return screen.includes('Buy milk') ? true : 'The row is in the cloud, but not on the screen: call `load()` after the insert.';
      },
    },
    {
      id: 'update',
      label: 'the box of the first task sets `done = true` in the cloud',
      fail: 'In `toggle`: `await supabase.from(\'tasks\').update({ done: !task.done }).eq(\'id\', task.id);` then `load()`.',
      run: async (c) => {
        await waitForText(c.app, (x) => x.includes('Read Part 5 of the lab'), 5000);
        await c.app.press({ testID: 'toggle-0' });
        const rows = await until(c.app, () => cloudRows(c.app, 'tasks'), (r) => titled(r, 'Read Part 5 of the lab')[0]?.done === true, 5000);
        return titled(rows, 'Read Part 5 of the lab')[0]?.done === true;
      },
    },
    {
      id: 'delete',
      label: 'Delete on “Buy milk” removes it from the cloud',
      fail: 'In `remove`: `await supabase.from(\'tasks\').delete().eq(\'id\', task.id);` then `load()`.',
      run: async (c) => {
        await waitForText(c.app, (x) => x.includes('Buy milk'), 5000);
        await c.app.press({ testID: 'delete-1' });
        const rows = await until(c.app, () => cloudRows(c.app, 'tasks'), (r) => titled(r, 'Buy milk').length === 0, 5000);
        return titled(rows, 'Buy milk').length === 0;
      },
    },
  ],
  hints: [
    'Reading: `const { data, error } = await supabase.from(\'tasks\').select(\'*\').order(\'created_at\');` — then `if (error) return setMessage(error.message);` and `setTasks(data);`',
    'Writing: `insert({ title })`, `update({ done: !task.done }).eq(\'id\', task.id)`, `delete().eq(\'id\', task.id)` — each followed by `load()`.',
    'You never send `user_id`: the table fills it with `auth.uid()`, and Row Level Security keeps every query to your own rows.',
  ],
  solution: {
    explain: 'Every call returns `{ data, error }`: check `error` first. The filters (`.eq(\'id\', task.id)`) pick one row; Row Level Security makes sure that row is yours. `load()` reads the table again so the screen matches the cloud.',
    files: { 'App.tsx': CLOUD_SOLUTION },
  },
  success: 'This is the cloud half of the final project. Look at Device storage: the cloud table holds Omar’s task too, but your app never received it. That is Row Level Security, enforced by the database, not by your app.',
};

/* -------------------------------------------------------------- Exercise 11 */

export const ex11: PredictExercise = {
  id: id('rls-predict'),
  n: 11,
  title: 'Debug Row Level Security',
  minutes: 3,
  level: 4,
  kind: 'predict',
  prompt: 'The `notes` table has 10 rows. Row Level Security is on. For each step, choose what happens.',
  questions: [
    {
      code: `alter table public.notes enable row level security;
-- no policy yet

const { data, error } = await supabase.from('notes').select('*');`,
      question: 'What does the app get?',
      options: [
        { text: 'data = [] and error = null', correct: true, why: 'With RLS on and no policy, no row is allowed, so the database returns none. It is not an error: an empty list.' },
        { text: 'all 10 notes', why: 'That is what happens with RLS off: every row is open through the API.' },
        { text: 'an error: permission denied', why: 'For reading, RLS filters rows silently. Errors come when you try to write a row the policies do not allow.' },
      ],
    },
    {
      code: `const { error } = await supabase.from('notes').insert({ body: 'hi' });
console.log(error.code, error.message);`,
      question: 'Same table, still no policy. What is printed?',
      options: [
        { text: '42501 new row violates row-level security policy for table "notes"', correct: true, why: 'Writing a row that no policy allows is refused with code 42501.' },
        { text: 'Nothing: the insert works', why: 'No policy allows inserts, so the new row is refused.' },
        { text: '404 the table was not found', why: 'The table exists. RLS refused the row.' },
      ],
    },
    {
      code: `create policy "Users read their own notes"
on public.notes for select
to authenticated
using ( (select auth.uid()) = user_id );`,
      question: 'Which rows can the signed-in student read now?',
      options: [
        { text: 'Only the rows whose user_id is the student’s own id', correct: true, why: '`using` is checked for every row: only rows where `user_id` equals the signed-in user’s id are returned.' },
        { text: 'Every row', why: 'The `using` condition filters the rows.' },
        { text: 'Still none: a policy for select is not enough', why: 'This policy allows reading. Inserting still needs its own policy (`for insert … with check`).' },
      ],
    },
    {
      code: `// RLS is off, so every task reaches the phone
const { data } = await supabase.from('tasks').select('*');
const mine = data.filter((t) => t.user_id === me.id);`,
      question: 'Does this filter keep other users’ tasks private?',
      options: [
        { text: 'No: their rows already reached the phone, and anyone can call the API without your app', correct: true, why: 'The publishable key is public. Only a check inside the database (RLS) keeps rows away from people who should not see them.' },
        { text: 'Yes: the user never sees them on the screen', why: 'The screen hides them, but the data was sent. Anyone can send the same request with a script.' },
        { text: 'Yes, if the app’s code is minified', why: 'Minifying does not stop anyone from calling the API directly.' },
      ],
    },
  ],
  hints: [
    'With RLS on, everything is closed until a policy opens it.',
    'Reading closed rows gives an empty list. Writing a closed row gives error 42501.',
    'Hiding rows in the app is not security: the API is public, the database must decide.',
  ],
  solution: {
    explain: 'RLS starts closed. Each policy opens one operation for rows that pass its condition, and the database applies it to every request, whatever app sends it.',
    text: '1 · data = [] (no error) — 2 · 42501 new row violates row-level security policy — 3 · only rows with the student’s own user_id — 4 · No: filtering in the app is not security',
  },
  success: 'When a Supabase list is unexpectedly empty, check RLS first: is it on, and is there a `select` policy that matches your rows?',
};

/* -------------------------------------------------------------- Exercise 12 */

const AVATAR_STARTER = `import { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from './lib/supabase';

export default function App() {
  const [userId, setUserId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [status, setStatus] = useState('Signing in…');

  useEffect(() => {
    supabase.auth.signInWithPassword({ email: '${STUDENT.email}', password: '${STUDENT.password}' }).then(({ data, error }) => {
      if (error) return setStatus(error.message);
      setUserId(data.user!.id);
      setStatus('Choose a photo');
    });
  }, []);

  async function chooseAndUpload() {
    // the photo, with its bytes as base64 text
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8, base64: true });
    if (result.canceled || !userId) return;
    const photo = result.assets[0];
    setStatus('Uploading…');

    // 1. The path: one folder per user → \`\${userId}/avatar.png\`
    // 2. Upload to the 'avatars' bucket: decode(photo.base64!) gives the bytes.
    //    Options: { contentType: 'image/png', upsert: true } (upsert: a new photo replaces the old one)
    // 3. If error: setStatus(error.message) and stop
    // 4. getPublicUrl(path) gives data.publicUrl → setAvatarUrl(…) and setStatus('Uploaded')
  }

  return (
    <View className="flex-1 items-center justify-center gap-5 bg-white p-6">
      <View className="h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-slate-200">
        {avatarUrl ? <Image testID="avatar" source={{ uri: avatarUrl }} style={{ width: 128, height: 128 }} /> : <Text className="text-slate-600">No photo</Text>}
      </View>
      <Text testID="status" className="text-slate-700">{status}</Text>
      <Pressable testID="upload" onPress={chooseAndUpload} className="rounded-xl bg-indigo-600 px-6 py-3">
        <Text className="font-semibold text-white">Choose a photo</Text>
      </Pressable>
    </View>
  );
}
`;

export const AVATAR_SOLUTION = AVATAR_STARTER.replace(
  `    // 1. The path: one folder per user → \`\${userId}/avatar.png\`
    // 2. Upload to the 'avatars' bucket: decode(photo.base64!) gives the bytes.
    //    Options: { contentType: 'image/png', upsert: true } (upsert: a new photo replaces the old one)
    // 3. If error: setStatus(error.message) and stop
    // 4. getPublicUrl(path) gives data.publicUrl → setAvatarUrl(…) and setStatus('Uploaded')`,
  `    const path = \`\${userId}/avatar.png\`; // one folder per user: the bucket's policy allows only your own
    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, decode(photo.base64!), { contentType: 'image/png', upsert: true });
    if (error) return setStatus(error.message);

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setStatus('Uploaded');`,
);

export const ex12: CodeExercise = {
  id: id('avatar-upload'),
  n: 12,
  title: 'Upload a profile photo',
  minutes: 6,
  level: 5,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  freshDevice: true,
  prompt: 'Upload the chosen photo to the public **avatars** bucket, in the user’s own folder, then show it with its public URL. Press **Choose a photo** twice: the second upload must replace the first.',
  files: { 'App.tsx': AVATAR_STARTER, 'lib/supabase.ts': SUPABASE_CLIENT },
  checks: [
    {
      id: 'upload',
      label: 'uploads with `supabase.storage.from(\'avatars\').upload(…)`',
      fail: 'Write `await supabase.storage.from(\'avatars\').upload(path, decode(photo.base64!), { contentType: \'image/png\', upsert: true })`.',
      static: (c) => /storage\s*\.\s*from\s*\(\s*['"]avatars['"]\s*\)\s*\.\s*upload\s*\(/.test(code(c.files)) && /decode\s*\(/.test(code(c.files)),
    },
    {
      id: 'url',
      label: 'shows it with `getPublicUrl`, and handles `error`',
      fail: 'After the upload: `if (error) return setStatus(error.message);` then `const { data } = supabase.storage.from(\'avatars\').getPublicUrl(path);` and `setAvatarUrl(data.publicUrl)`.',
      static: (c) => /\.getPublicUrl\s*\(/.test(code(c.files)) && /if\s*\(\s*error\s*\)/.test(code(c.files)),
    },
    {
      id: 'folder',
      label: 'the file is saved at `avatars/<your user id>/avatar.png`',
      fail: 'The path must start with the user’s id: `${userId}/avatar.png`. The bucket’s policy lets each user write only in their own folder.',
      run: async (c) => {
        await waitForText(c.app, (t) => /Choose a photo$/m.test(t) || t.includes('Choose a photo'), 5000);
        await waitForText(c.app, (t) => !/Signing in/.test(t), 5000);
        await c.app.press({ testID: 'upload' });
        const files = await until(c.app, () => cloudFiles(c.app), (f) => f.includes(`avatars/${STUDENT.id}/avatar.png`), 5000);
        if (files.includes(`avatars/${STUDENT.id}/avatar.png`)) return true;
        const status = await c.app.text();
        if (/row-level security/.test(status)) return 'The bucket refused the file (row-level security): the path must start with your user id, `${userId}/avatar.png`.';
        return files.length ? `The file was saved as **${files[0]}**. Use the path \`\${userId}/avatar.png\`.` : false;
      },
    },
    {
      id: 'shown',
      label: 'a second photo replaces the first, and the picture is shown',
      fail: 'Add `upsert: true` to the upload options, then `setAvatarUrl(data.publicUrl)` so `<Image testID="avatar">` appears.',
      run: async (c) => {
        await waitForText(c.app, (t) => !/Signing in/.test(t), 5000);
        await c.app.press({ testID: 'upload' }); // the file already exists from the check before
        const t = await waitForText(c.app, (x) => /Uploaded|exists|violates/.test(x), 5000);
        if (/already exists/.test(t)) return 'The second upload failed: “The resource already exists”. Add `upsert: true` so the new photo replaces the old one.';
        if (!/Uploaded/.test(t)) return false;
        return (await c.app.count({ testID: 'avatar' })) === 1 ? true : 'The upload worked, but no picture is shown: `setAvatarUrl(data.publicUrl)`.';
      },
    },
  ],
  hints: [
    'The path starts with the user’s id, one folder per user: `const path = userId + \'/avatar.png\';`',
    'The upload: `const { error } = await supabase.storage.from(\'avatars\').upload(path, decode(photo.base64!), { contentType: \'image/png\', upsert: true });`',
    'Then `if (error) return setStatus(error.message);`, `const { data } = supabase.storage.from(\'avatars\').getPublicUrl(path);`, `setAvatarUrl(data.publicUrl);` and `setStatus(\'Uploaded\')`.',
  ],
  solution: {
    explain: 'Storage wants the file’s bytes: `decode` turns the picker’s base64 text into an ArrayBuffer. The path starts with the user’s id because the bucket’s policy allows each user only their own folder, and `upsert: true` lets a new photo replace the old one. A public bucket gives a plain URL; a private bucket would need `createSignedUrl(path, 60)` instead.',
    files: { 'App.tsx': AVATAR_SOLUTION },
  },
  success: 'The photo is a file in a bucket, and the database only needs its path or URL (for example in `profiles.avatar_url`). Device storage shows the file in the cloud, with its size and type.',
};
