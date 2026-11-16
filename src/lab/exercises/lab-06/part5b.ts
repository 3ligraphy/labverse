/**
 * Lab 06 · Part 5 — the Supabase exercises added for Auth, RLS policies, Realtime and errors:
 * Exercise 11 (auth screen, 8 min), 13 (RLS policies, 3), 15 (Realtime, 7) and 16 (errors, 3).
 */
import type { CodeExercise, MatchExercise } from '../types.ts';
import { LAB_ID } from './meta.ts';
import { code, sections, STUDENT, SUPABASE_CLIENT, waitForText } from './shared.ts';
import type { PreviewDriver } from '../../runtime/protocol.ts';

const id = (name: string) => `${LAB_ID}--${name}`;

/* -------------------------------------------------------------- Exercise 11 */

const AUTH_STYLES = `const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, paddingTop: 64, gap: 12, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#d4d4d8', borderRadius: 10, padding: 12, fontSize: 16 },
  button: { backgroundColor: '#4f46e5', borderRadius: 10, padding: 14, alignItems: 'center' },
  secondary: { backgroundColor: '#71717a' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  error: { color: '#b91c1c', fontSize: 15 },
});`;

const AUTH_VIEW = `  if (user) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Signed in as {user}</Text>
        <Pressable testID="sign-out" style={styles.button} onPress={signOut}>
          <Text style={styles.buttonText}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Welcome</Text>
      <TextInput testID="email" style={styles.input} placeholder="Email" autoCapitalize="none" value={email} onChangeText={setEmail} />
      <TextInput testID="password" style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <Pressable testID="sign-in" style={styles.button} onPress={signIn}>
        <Text style={styles.buttonText}>Sign in</Text>
      </Pressable>
      <Pressable testID="sign-up" style={[styles.button, styles.secondary]} onPress={signUp}>
        <Text style={styles.buttonText}>Create account</Text>
      </Pressable>
      {message ? <Text style={styles.error}>{message}</Text> : null}
    </View>
  );
}

${AUTH_STYLES}
`;

const AUTH_STARTER = `import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from './lib/supabase';

export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<string | null>(null); // the signed-in email, or null
  const [message, setMessage] = useState('');

  // 1. Who is signed in? Auth tells you once at the start (from the saved session)
  //    and again after every sign in and sign out:
  //    const { data } = supabase.auth.onAuthStateChange((event, session) => setUser(session?.user.email ?? null));
  //    Remove the listener when the screen closes: return () => data.subscription.unsubscribe();
  useEffect(() => {
  }, []);

  async function signIn() {
    setMessage('');
    // 2. const { error } = await supabase.auth.signInWithPassword({ email, password });
    //    if (error) setMessage(error.message);
  }

  async function signUp() {
    setMessage('');
    // 3. const { data, error } = await supabase.auth.signUp({ email, password });
    //    if (error) setMessage(error.message);
    //    else if (!data.session) setMessage('Check your email to confirm your account.');
  }

  async function signOut() {
    // 4. await supabase.auth.signOut();
  }

${AUTH_VIEW}`;

const AUTH_SOLUTION = `import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from './lib/supabase';

export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<string | null>(null); // the signed-in email, or null
  const [message, setMessage] = useState('');

  // 1. Auth tells us who is signed in: at the start (the saved session) and after every change
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user.email ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function signIn() {
    setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
  }

  async function signUp() {
    setMessage('');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) setMessage(error.message);
    else if (!data.session) setMessage('Check your email to confirm your account.');
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

${AUTH_VIEW}`;

async function signInAs(app: PreviewDriver, email: string, password: string) {
  await waitForText(app, (t) => t.includes('Welcome') || t.includes('Signed in as'), 4000);
  await app.type({ testID: 'email' }, email);
  await app.type({ testID: 'password' }, password);
  await app.press({ testID: 'sign-in' });
}

export const ex11Auth: CodeExercise = {
  id: id('auth-screen'),
  n: 11,
  title: 'Sign in, stay signed in, sign out',
  minutes: 8,
  level: 6,
  kind: 'code',
  prompt: 'Finish the four numbered steps: listen to Auth, sign in (show `error.message` when it fails), create an account, and sign out. Try a wrong password first, then **student@practice.dev** / **practice-123**, then press **Restart app**.',
  frame: 'phone',
  entry: 'App.tsx',
  freshDevice: true,
  files: { 'App.tsx': AUTH_STARTER, 'lib/supabase.ts': SUPABASE_CLIENT },
  checks: [
    {
      id: 'listener',
      label: 'the screen listens with `onAuthStateChange` and stops listening in the cleanup',
      fail: 'In `useEffect`: `const { data } = supabase.auth.onAuthStateChange((event, session) => setUser(session?.user.email ?? null));` and `return () => data.subscription.unsubscribe();`',
      static: (c) => /onAuthStateChange\s*\(/.test(code(c.files)) && /\.unsubscribe\s*\(\s*\)/.test(code(c.files)),
    },
    {
      id: 'wrong-password',
      label: 'a wrong password shows “Invalid login credentials”',
      fail: 'A failed sign in must say why. After `signInWithPassword`: `if (error) setMessage(error.message);` (the message is **Invalid login credentials**).',
      run: async (c) => {
        await signInAs(c.app, STUDENT.email, 'wrong-password');
        const t = await waitForText(c.app, (x) => x.includes('Invalid login credentials') || x.includes('Signed in as'), 4000);
        if (t.includes('Signed in as')) return 'A wrong password signed in? Use the email and password the student typed.';
        return t.includes('Invalid login credentials');
      },
    },
    {
      id: 'sign-in',
      label: 'the right password shows “Signed in as student@practice.dev”',
      fail: 'Sign in with `signInWithPassword({ email, password })`. The screen changes when `onAuthStateChange` sets the user (`session?.user.email`).',
      run: async (c) => {
        await signInAs(c.app, STUDENT.email, STUDENT.password);
        const t = await waitForText(c.app, (x) => x.includes('Signed in as'), 4000);
        return t.includes(`Signed in as ${STUDENT.email}`);
      },
    },
    {
      id: 'restart',
      label: 'after Restart app the user is still signed in',
      fail: 'Supabase saved the session on the phone, but the screen does not read it. `onAuthStateChange` tells you at the start (event INITIAL_SESSION): set the user from that session too.',
      run: async (c) => {
        // the app was started again before this check (like Restart app); the session from the last check is saved
        const t = await waitForText(c.app, (x) => x.includes('Signed in as'), 4000);
        return t.includes(`Signed in as ${STUDENT.email}`);
      },
    },
    {
      id: 'sign-out',
      label: 'Sign out shows the sign-in form again',
      fail: 'In `signOut`: `await supabase.auth.signOut();` — Auth then sends SIGNED_OUT with no session, and the form comes back.',
      run: async (c) => {
        const before = await waitForText(c.app, (x) => x.includes('Signed in as'), 4000);
        if (!before.includes('Signed in as')) return 'Sign in first (and keep the user signed in after a restart): then Sign out can be tested.';
        await c.app.press({ testID: 'sign-out' });
        const t = await waitForText(c.app, (x) => x.includes('Welcome'), 4000);
        return t.includes('Welcome');
      },
    },
    {
      id: 'sign-up',
      label: 'Create account signs a new user in',
      fail: 'In `signUp`: `const { data, error } = await supabase.auth.signUp({ email, password });` then show `error.message` if there is one. With “Confirm email” off, the new user is signed in at once.',
      run: async (c) => {
        await waitForText(c.app, (x) => x.includes('Welcome') || x.includes('Signed in as'), 4000);
        if ((await c.app.text()).includes('Signed in as')) {
          await c.app.press({ testID: 'sign-out' });
          await waitForText(c.app, (x) => x.includes('Welcome'), 4000);
        }
        await c.app.type({ testID: 'email' }, 'new.student@practice.dev');
        await c.app.type({ testID: 'password' }, 'practice-789');
        await c.app.press({ testID: 'sign-up' });
        const t = await waitForText(c.app, (x) => x.includes('Signed in as new.student@practice.dev') || /already registered|Password should/i.test(x), 4000);
        return t.includes('Signed in as new.student@practice.dev');
      },
    },
  ],
  hints: [
    'Step 1 runs once: `useEffect(() => { const { data } = supabase.auth.onAuthStateChange((event, session) => setUser(session?.user.email ?? null)); return () => data.subscription.unsubscribe(); }, []);`',
    'Every Auth call returns `{ data, error }`. Show the problem with `if (error) setMessage(error.message);` — you do not need to set the user yourself: `onAuthStateChange` does it.',
    'Sign out is one line: `await supabase.auth.signOut();`. Sign up is `supabase.auth.signUp({ email, password })`; when `data.session` is null, the project wants an email confirmation first.',
  ],
  solution: {
    explain: 'The screen never decides by itself who is signed in: it listens to Auth. `onAuthStateChange` reports the saved session at the start (INITIAL_SESSION), then SIGNED_IN and SIGNED_OUT. The sign-in, sign-up and sign-out buttons only call Auth and show `error.message` when something fails.',
    files: { 'App.tsx': AUTH_SOLUTION },
  },
  success: 'This is the sign-in screen of the final project. The session is saved by supabase-js (in `auth.storage`), so the user stays signed in after a restart, and `onAuthStateChange` keeps the screen in step with it.',
};

/* -------------------------------------------------------------- Exercise 13 */

export const ex13Policies: MatchExercise = {
  id: id('rls-policies'),
  n: 13,
  title: 'What does each policy allow?',
  minutes: 3,
  level: 5,
  kind: 'match',
  prompt: 'The tasks table has Row Level Security on. Drag each line of SQL to what it allows. One line is a mistake for private data: leave it out.',
  pairs: [
    { chip: 'for select to authenticated using ( (select auth.uid()) = user_id )', target: 'Each user reads only their own tasks', why: '`using` is checked on the rows that already exist: only rows whose `user_id` is the signed-in user are returned.' },
    { chip: 'for insert to authenticated with check ( (select auth.uid()) = user_id )', target: 'A user may add a task only for themself', why: '`with check` is checked on the new row: its `user_id` must be the signed-in user.' },
    { chip: 'for update to authenticated using (…) with check (…)', target: 'A user edits their own tasks, and cannot give one to someone else', why: '`using` picks the rows they may change; `with check` checks the row after the change.' },
    { chip: 'for delete to authenticated using ( (select auth.uid()) = user_id )', target: 'A user deletes only their own tasks', why: 'Delete has no new row, so only `using` is needed.' },
    { chip: 'alter table tasks enable row level security;  -- no policy yet', target: 'Nobody can read or write the table through the API yet', why: 'With RLS on and no policy, everything is refused: select returns [], insert fails with 42501.' },
  ],
  decoys: [{ chip: 'for select to anon using ( true )', why: '`using (true)` for `anon` lets every visitor read every row, even without an account. Never for private data.' }],
  mono: true,
  hints: [
    '`using ( … )` filters rows that are already in the table; `with check ( … )` checks a row that is being written.',
    'The word after `for` is the action: select = read, insert = add, update = edit, delete = delete.',
    'RLS on with no policy blocks everything. `using ( true )` for `anon` opens everything to everyone.',
  ],
  solution: {
    explain: 'One policy per action. Reading and deleting use `using` (which rows), adding uses `with check` (the new row), editing uses both. `to authenticated` means a request with no signed-in user is never covered.',
    text: 'select … using → reads own tasks · insert … with check → adds only for themself · update … using … with check → edits own, cannot give away · delete … using → deletes own · RLS on, no policy → nothing allowed yet · `to anon using (true)` → leave out',
  },
  success: 'These four policies are in `supabase/schema.sql` of the final project. Try them in the RLS simulator above: pick a user and an action and watch which rows pass.',
};

/* -------------------------------------------------------------- Exercise 15 */

const RT_TOP = `import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from './lib/supabase';

type Task = { id: string; title: string; done: boolean; created_at: string };

export default function App() {
  const [ready, setReady] = useState(false);
  const [show, setShow] = useState(true);

  useEffect(() => {
    supabase.auth
      .signInWithPassword({ email: '${STUDENT.email}', password: '${STUDENT.password}' })
      .then(({ error }) => setReady(!error));
  }, []);

  if (!ready) return <Text style={styles.screen}>Signing in…</Text>;
  return (
    <View style={styles.screen}>
      <Pressable testID="toggle" style={styles.button} onPress={() => setShow(!show)}>
        <Text style={styles.buttonText}>{show ? 'Close the list' : 'Open the list'}</Text>
      </Pressable>
      {show && <TaskList />}
    </View>
  );
}
`;

const RT_BOTTOM = `
  return (
    <View style={styles.list}>
      <Text style={styles.title}>My tasks ({tasks.length})</Text>
      {tasks.map((t) => (
        <Text key={t.id} style={styles.task}>{t.title}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, paddingTop: 64, gap: 12, backgroundColor: '#fff' },
  button: { backgroundColor: '#4f46e5', borderRadius: 10, padding: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  list: { gap: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  task: { fontSize: 16, padding: 12, borderRadius: 10, backgroundColor: '#f4f4f5' },
});
`;

const RT_STARTER = `${RT_TOP}
function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    // load the list once
    supabase.from('tasks').select('*').order('created_at').then(({ data }) => setTasks(data ?? []));

    // 1. Listen for new rows: open a channel
    //    const channel = supabase
    //      .channel('my-tasks')
    //      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' },
    //        (payload) => setTasks((list) => [...list, payload.new as Task]))
    //      .subscribe();

    // 2. When the list closes, stop listening: return () => { supabase.removeChannel(channel); };
  }, []);
${RT_BOTTOM}`;

const RT_SOLUTION = `${RT_TOP}
function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    // load the list once
    supabase.from('tasks').select('*').order('created_at').then(({ data }) => setTasks(data ?? []));

    // 1. new rows arrive here, without loading the list again
    const channel = supabase
      .channel('my-tasks')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' },
        (payload) => setTasks((list) => [...list, payload.new as Task]))
      .subscribe();

    // 2. the list closes: stop listening
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
${RT_BOTTOM}`;

const TABLET = 'From your tablet';
async function realtimeLine(app: PreviewDriver) {
  const s = (await sections(app)).find((x) => x.id === 'supabase-db');
  return (s?.lines ?? []).find((l) => l.startsWith('Realtime:')) ?? '';
}
async function waitForChannel(app: PreviewDriver, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (/Realtime: \d+ channels? open(?! \()/.test(await realtimeLine(app))) return true;
    await app.wait(80);
  }
  return false;
}
const count = (text: string, word: string) => text.split(word).length - 1;

export const ex15Realtime: CodeExercise = {
  id: id('realtime-tasks'),
  n: 15,
  title: 'A list that updates by itself',
  minutes: 7,
  level: 7,
  kind: 'code',
  prompt: 'Open a Realtime channel in `TaskList` so new tasks appear without loading the list again, and remove it when the list closes. Test it with **Add a task from your tablet** under the phone.',
  frame: 'phone',
  entry: 'App.tsx',
  freshDevice: true,
  files: { 'App.tsx': RT_STARTER, 'lib/supabase.ts': SUPABASE_CLIENT },
  checks: [
    {
      id: 'channel',
      label: 'a channel listens for INSERT on the tasks table',
      fail: "Open it with `supabase.channel('my-tasks').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, (payload) => …).subscribe();`",
      static: (c) => {
        const src = code(c.files);
        return /\.channel\s*\(/.test(src) && /postgres_changes/.test(src) && /event\s*:\s*['"](INSERT|\*)['"]/.test(src) && /table\s*:\s*['"]tasks['"]/.test(src) && /\.subscribe\s*\(/.test(src);
      },
    },
    {
      id: 'live',
      label: 'a task added on the tablet appears on the phone',
      fail: 'The tablet’s task is in the cloud (see Device storage), but the phone did not hear it. Open the channel, call `.subscribe()`, and in the callback add `payload.new` to the list.',
      run: async (c) => {
        await waitForText(c.app, (x) => x.includes('Read Part 5 of the lab'), 5000);
        if (!(await waitForChannel(c.app))) return 'No channel is open on the phone yet: `.channel(…).on(…).subscribe()` inside the `useEffect` of TaskList.';
        await c.app.remote?.({ kind: 'insert', table: 'tasks', title: TABLET });
        const t = await waitForText(c.app, (x) => x.includes(TABLET), 4000);
        return t.includes(TABLET);
      },
    },
    {
      id: 'once',
      label: 'each new task appears once',
      fail: 'The new task appears more than once. Add `payload.new` in the callback only, and do not load and add it again.',
      run: async (c) => {
        await waitForText(c.app, (x) => x.includes('Read Part 5 of the lab'), 5000);
        if (!(await waitForChannel(c.app))) return 'No channel is open on the phone: subscribe first.';
        await c.app.remote?.({ kind: 'insert', table: 'tasks', title: `${TABLET} again` });
        const t = await waitForText(c.app, (x) => x.includes(`${TABLET} again`), 4000);
        if (!t.includes(`${TABLET} again`)) return 'The new task did not appear: subscribe and add `payload.new` to the list.';
        await c.app.wait(500);
        return count(await c.app.text(), `${TABLET} again`) === 1;
      },
    },
    {
      id: 'cleanup',
      label: 'closing and opening the list leaves one channel open',
      fail: 'Every time the list opens, a new channel opens and the old one keeps listening. Return a cleanup from the `useEffect`: `return () => { supabase.removeChannel(channel); };`',
      run: async (c) => {
        await waitForText(c.app, (x) => x.includes('Read Part 5 of the lab'), 5000);
        if (!(await waitForChannel(c.app))) return 'No channel is open on the phone: subscribe first.';
        for (let i = 0; i < 4; i++) {
          await c.app.press({ testID: 'toggle' });
          await c.app.wait(150);
        }
        await waitForText(c.app, (x) => x.includes('Read Part 5 of the lab'), 4000);
        await c.app.wait(300);
        const line = await realtimeLine(c.app);
        const n = Number(/Realtime: (\d+)/.exec(line)?.[1] ?? 0);
        if (n > 1) return `After closing and opening the list twice, ${n} channels are open: the old ones still listen. Return a cleanup from the \`useEffect\`: \`return () => { supabase.removeChannel(channel); };\``;
        return n === 1;
      },
    },
  ],
  hints: [
    'Inside the `useEffect` of TaskList: `const channel = supabase.channel(\'my-tasks\').on(\'postgres_changes\', { event: \'INSERT\', schema: \'public\', table: \'tasks\' }, (payload) => …).subscribe();`',
    'In the callback, add the new row to what is already there: `setTasks((list) => [...list, payload.new as Task])`.',
    'At the end of the `useEffect`: `return () => { supabase.removeChannel(channel); };` — React runs it when the list closes.',
  ],
  solution: {
    explain: 'The list loads once with `select`. After that, Realtime pushes every new row the user may see (RLS still applies) into the callback, which adds `payload.new` to the list. The cleanup removes the channel when the list closes, so only one channel is ever open.',
    files: { 'App.tsx': RT_SOLUTION },
  },
  success: 'Realtime only sends changes while the phone is online and listening. A phone that was offline must load the list again with `select` when it comes back: Realtime does not keep missed changes.',
};

/* -------------------------------------------------------------- Exercise 16 */

export const ex16Errors: MatchExercise = {
  id: id('supabase-errors'),
  n: 16,
  title: 'Read the error, find the fix',
  minutes: 3,
  level: 5,
  kind: 'match',
  prompt: 'Each thing came back from supabase-js. Drag it to what it means.',
  pairs: [
    { chip: "error.code '42501'", target: 'Row Level Security refused the write (no policy allows it, or not signed in)', why: '42501 is Postgres for "insufficient privilege": the insert or update broke a policy.' },
    { chip: '{ data: [], error: null }', target: 'RLS hid every row: not signed in, or no select policy', why: 'RLS does not complain when it hides rows. An empty list with no error is the clue.' },
    { chip: "error.code 'PGRST116'", target: '`.single()` got no row (or more than one)', why: '`.single()` wants exactly one row. Use `.maybeSingle()` when "none" is fine.' },
    { chip: "error.code '23505'", target: 'A row with this id already exists', why: 'A duplicate primary key. To send the same task twice safely, use `upsert`.' },
    { chip: "error.code 'PGRST204'", target: 'A column name the table does not have (a typo)', why: 'For example `titel` instead of `title`.' },
    { chip: "error.message 'Invalid login credentials'", target: 'Wrong email or password', why: 'Supabase does not say which one is wrong, so nobody can test which emails have accounts.' },
  ],
  mono: true,
  hints: [
    'Codes with letters (PGRST…) come from the API in front of the database; codes with 5 digits come from Postgres.',
    '42501 is a refused write; an empty list with no error is a hidden read. Both are RLS.',
    '23505 is a duplicate key; PGRST116 is `.single()` with no row; PGRST204 is a column name that does not exist.',
  ],
  solution: {
    explain: 'Always read `error` first. The code says where to look: RLS (42501, or an empty list), the query (PGRST116, PGRST204), the data (23505), or Auth (Invalid login credentials).',
    text: "42501 → RLS refused the write · [] with no error → RLS hid the rows · PGRST116 → .single() got no row · 23505 → the id already exists (use upsert) · PGRST204 → no such column · Invalid login credentials → wrong email or password",
  },
  success: 'The Logs page of the Supabase dashboard (Logs → API) shows the same requests with their status codes: open it when the app gets an error you do not understand.',
};
