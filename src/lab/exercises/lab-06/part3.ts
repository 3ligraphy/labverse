/** Lab 06 · Part 3 — a database on the phone: SQLite. Exercises 5–6 (3 + 12 = 15 min). */
import type { CodeExercise, MatchExercise } from '../types.ts';
import { LAB_ID } from './meta.ts';
import { code, sqliteRows, until, waitForText } from './shared.ts';

const id = (name: string) => `${LAB_ID}--${name}`;

export const ex05: MatchExercise = {
  id: id('sql-match'),
  n: 5,
  title: 'What does each SQL line do?',
  minutes: 3,
  level: 2,
  kind: 'match',
  prompt: 'Drag each SQL line to what it does to the `tasks` table. Two lines are dangerous: leave them out.',
  pairs: [
    { chip: 'CREATE TABLE IF NOT EXISTS tasks (…)', target: 'makes the table once, with its columns', why: '`IF NOT EXISTS` makes it safe to run every time the app opens: the second time it does nothing.' },
    { chip: 'INSERT INTO tasks (title) VALUES (?)', target: 'adds one new row', why: 'The `?` is filled with the value you pass after the SQL, safely.' },
    { chip: 'SELECT * FROM tasks WHERE done = 0', target: 'reads the rows that are not done', why: '`SELECT` only reads. `WHERE` keeps the rows that match.' },
    { chip: 'UPDATE tasks SET done = 1 WHERE id = ?', target: 'changes one row', why: '`WHERE id = ?` picks exactly one row by its primary key.' },
    { chip: 'DELETE FROM tasks WHERE id = ?', target: 'removes one row', why: 'Without the `WHERE` it would remove every row.' },
  ],
  decoys: [
    { chip: 'DELETE FROM tasks', why: 'No `WHERE`: this removes every row of the table.' },
    { chip: "INSERT INTO tasks (title) VALUES ('${title}')", why: 'The user’s text is pasted into the SQL. A title with a quote (Mona’s task) breaks it, and a crafted title can run other SQL (SQL injection). Use `?`.' },
  ],
  mono: true,
  hints: [
    'Read the first word: CREATE makes, INSERT adds, SELECT reads, UPDATE changes, DELETE removes.',
    '`WHERE` decides which rows: without it, UPDATE and DELETE touch every row.',
    'Never build SQL by pasting text into it: `?` keeps the value apart from the SQL.',
  ],
  solution: {
    explain: 'Every statement starts with its action word, and `WHERE` limits it to the rows you mean.',
    text: 'CREATE TABLE IF NOT EXISTS → makes the table once · INSERT … VALUES (?) → adds one row · SELECT … WHERE done = 0 → reads the rows not done · UPDATE … WHERE id = ? → changes one row · DELETE … WHERE id = ? → removes one row. Left out: `DELETE FROM tasks` (every row) and the INSERT with `${title}` pasted in (SQL injection).',
  },
  success: 'These five statements are all the SQL the tasks app needs. In Exercise 6 you write each one into a function.',
};

/* --------------------------------------------------------------- Exercise 6 */

const DB_STARTER = `import * as SQLite from 'expo-sqlite';

export type Task = { id: number; title: string; done: number };

// The database file tasks.db on the phone (opened once, shared by every function)
export const dbPromise = SQLite.openDatabaseAsync('tasks.db');

// 1. Create the table once:
//    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0
export async function setup() {
  const db = await dbPromise;
}

// 2. INSERT one task. Put ? where the title goes, and pass the title after the SQL
export async function addTask(title: string) {
  const db = await dbPromise;
}

// 3. SELECT every task, newest first (ORDER BY id DESC)
export async function getTasks(): Promise<Task[]> {
  const db = await dbPromise;
  return [];
}

// 4. UPDATE one task: done becomes 1 when it was 0, and 0 when it was 1 (SET done = 1 - done)
export async function toggleTask(id: number) {
  const db = await dbPromise;
}

// 5. DELETE one task by its id
export async function deleteTask(id: number) {
  const db = await dbPromise;
}
`;

export const DB_SOLUTION = `import * as SQLite from 'expo-sqlite';

export type Task = { id: number; title: string; done: number };

// The database file tasks.db on the phone (opened once, shared by every function)
export const dbPromise = SQLite.openDatabaseAsync('tasks.db');

export async function setup() {
  const db = await dbPromise;
  await db.execAsync(\`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0
    );
  \`);
}

export async function addTask(title: string) {
  const db = await dbPromise;
  await db.runAsync('INSERT INTO tasks (title) VALUES (?)', title);
}

export async function getTasks(): Promise<Task[]> {
  const db = await dbPromise;
  return db.getAllAsync<Task>('SELECT * FROM tasks ORDER BY id DESC');
}

export async function toggleTask(id: number) {
  const db = await dbPromise;
  await db.runAsync('UPDATE tasks SET done = 1 - done WHERE id = ?', id);
}

export async function deleteTask(id: number) {
  const db = await dbPromise;
  await db.runAsync('DELETE FROM tasks WHERE id = ?', id);
}
`;

const TASKS_APP = `import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { addTask, deleteTask, getTasks, setup, toggleTask, type Task } from './db';

// This screen is ready: it calls the five functions of db.ts.
export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  async function run(action: () => Promise<void>) {
    try {
      setError('');
      await action();
      setTasks(await getTasks()); // read the table again after every change
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    run(setup);
  }, []);

  return (
    <View className="flex-1 bg-slate-50 p-5 pt-14">
      <Text className="text-2xl font-bold text-slate-900">My tasks</Text>
      <View className="mt-4 flex-row gap-2">
        <TextInput testID="title" value={title} onChangeText={setTitle} placeholder="New task" className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2" />
        <Pressable testID="add" onPress={() => run(async () => { if (title.trim()) await addTask(title.trim()); setTitle(''); })} className="justify-center rounded-xl bg-indigo-600 px-4">
          <Text className="font-semibold text-white">Add</Text>
        </Pressable>
      </View>
      {error ? <Text className="mt-3 text-red-700">{error}</Text> : null}
      <FlatList
        className="mt-4"
        data={tasks}
        keyExtractor={(t) => String(t.id)}
        renderItem={({ item }) => (
          <View className="mb-2 flex-row items-center gap-3 rounded-xl bg-white p-3">
            <Pressable testID={\`toggle-\${item.id}\`} onPress={() => run(() => toggleTask(item.id))}>
              <Text className="text-lg text-indigo-700">{item.done ? '☑' : '☐'}</Text>
            </Pressable>
            <Text className={\`flex-1 \${item.done ? 'text-slate-500 line-through' : 'text-slate-900'}\`}>{item.title}</Text>
            <Pressable testID={\`delete-\${item.id}\`} onPress={() => run(() => deleteTask(item.id))}>
              <Text className="text-red-700">Delete</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}
`;

async function add(c: { app: Parameters<typeof waitForText>[0] }, title: string) {
  await c.app.type({ testID: 'title' }, title);
  await c.app.press({ testID: 'add' });
  return waitForText(c.app, (t) => t.includes(title), 3000);
}

export const ex06: CodeExercise = {
  id: id('tasks-sqlite'),
  n: 6,
  title: 'A tasks database on the phone',
  minutes: 12,
  level: 5,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  freshDevice: true,
  prompt: 'The screen is ready. Write the five functions in **db.ts**: create the `tasks` table, then INSERT, SELECT, UPDATE and DELETE with `?` parameters. Watch the table fill in **Device storage** as you add tasks.',
  files: { 'db.ts': DB_STARTER, 'App.tsx': TASKS_APP },
  checks: [
    {
      id: 'params',
      label: 'every value goes through a `?` parameter, never pasted into the SQL',
      fail: 'Write `?` in the SQL and pass the value after it: `db.runAsync(\'INSERT INTO tasks (title) VALUES (?)\', title)`.',
      static: (c) => {
        const src = code(c.files, 'db.ts');
        if (/`[^`]*\b(INSERT|UPDATE|DELETE|SELECT)\b[^`]*\$\{/i.test(src) || /['"][^'"\n]*\b(INSERT|UPDATE|DELETE)\b[^'"\n]*['"]\s*\+/i.test(src)) {
          return 'A value is pasted into the SQL text (`${…}` or `+`). Use `?` and pass the value after the SQL: a quote in a title would break the query.';
        }
        return /runAsync\s*\(\s*['"`]\s*INSERT[\s\S]*?\?/i.test(src) && /runAsync\s*\(\s*['"`]\s*UPDATE[\s\S]*?\?/i.test(src) && /runAsync\s*\(\s*['"`]\s*DELETE[\s\S]*?\?/i.test(src);
      },
    },
    {
      id: 'table',
      label: 'opening the app creates the `tasks` table with id, title and done',
      fail: 'In `setup`: `await db.execAsync(\'CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0)\');`',
      run: async (c) => {
        const rows = await until(c.app, () => sqliteRows(c.app, 'tasks.db', 'tasks'), (r) => r !== null, 4000);
        if (rows === null) return 'There is no `tasks` table in tasks.db yet. Write the CREATE TABLE in `setup` (with `execAsync`).';
        const t = (await c.app.storage!()).sections.find((s) => s.id === 'sqlite:tasks.db')!.tables!.find((x) => x.name === 'tasks')!;
        const missing = ['id', 'title', 'done'].filter((col) => !t.columns.includes(col));
        return missing.length ? `The tasks table has no ${missing.join(', ')} column. Check the CREATE TABLE.` : true;
      },
    },
    {
      id: 'insert',
      label: 'Add saves rows: “Buy milk” and “Read” are in the table',
      fail: 'In `addTask`: `await db.runAsync(\'INSERT INTO tasks (title) VALUES (?)\', title);`',
      run: async (c) => {
        await add(c, 'Buy milk');
        await add(c, 'Read');
        const rows = await until(c.app, () => sqliteRows(c.app, 'tasks.db', 'tasks'), (r) => (r?.length ?? 0) >= 2, 3000);
        const titles = (rows ?? []).map((r) => r.title);
        return titles.includes('Buy milk') && titles.includes('Read') ? true : `The table holds ${titles.length ? titles.map((t) => `“${t}”`).join(', ') : 'no rows'}. addTask should INSERT the title.`;
      },
    },
    {
      id: 'select',
      label: 'after Restart app the list is read from the table, newest first',
      fail: 'In `getTasks`: `return db.getAllAsync<Task>(\'SELECT * FROM tasks ORDER BY id DESC\');`',
      run: async (c) => {
        const t = await waitForText(c.app, (x) => x.includes('Buy milk') && x.includes('Read'), 3000);
        if (!t.includes('Buy milk') || !t.includes('Read')) return 'The list is empty after the restart, but the rows are in the table. `getTasks` should SELECT them (and return them).';
        return t.indexOf('Read') < t.indexOf('Buy milk') ? true : 'The newest task should be first: `ORDER BY id DESC`.';
      },
    },
    {
      id: 'update',
      label: 'pressing the box of “Buy milk” sets done = 1 in its row',
      fail: 'In `toggleTask`: `await db.runAsync(\'UPDATE tasks SET done = 1 - done WHERE id = ?\', id);`',
      run: async (c) => {
        await waitForText(c.app, (x) => x.includes('Buy milk'), 3000);
        await c.app.press({ testID: 'toggle-1' });
        const rows = await until(c.app, () => sqliteRows(c.app, 'tasks.db', 'tasks'), (r) => r?.find((x) => x.id === 1)?.done === 1, 3000);
        const row = rows?.find((x) => x.id === 1);
        if (rows && rows.filter((x) => x.done === 1).length > 1) return 'More than one row changed. Add `WHERE id = ?` so only this task changes.';
        return row?.done === 1;
      },
    },
    {
      id: 'delete',
      label: 'Delete on “Read” removes its row (and only its row)',
      fail: 'In `deleteTask`: `await db.runAsync(\'DELETE FROM tasks WHERE id = ?\', id);`',
      run: async (c) => {
        await waitForText(c.app, (x) => x.includes('Read'), 3000);
        await c.app.press({ testID: 'delete-2' });
        const rows = await until(c.app, () => sqliteRows(c.app, 'tasks.db', 'tasks'), (r) => !!r && !r.some((x) => x.id === 2), 3000);
        if (!rows || rows.some((x) => x.id === 2)) return false;
        return rows.some((x) => x.id === 1) ? true : 'Every row was deleted. Add `WHERE id = ?` so only this task goes.';
      },
    },
  ],
  hints: [
    'setup: `await db.execAsync(\'CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0)\');`',
    'Writes use `runAsync(sql, value)`: `INSERT INTO tasks (title) VALUES (?)`, `UPDATE tasks SET done = 1 - done WHERE id = ?`, `DELETE FROM tasks WHERE id = ?`.',
    'Reads use `getAllAsync`: `return db.getAllAsync<Task>(\'SELECT * FROM tasks ORDER BY id DESC\');`',
  ],
  solution: {
    explain: '`execAsync` runs the CREATE TABLE (no values, so no `?`). Every statement with a value uses `runAsync` or `getAllAsync` with `?`, so the value is never part of the SQL text. `1 - done` flips 0 to 1 and 1 to 0 in one statement.',
    files: { 'db.ts': DB_SOLUTION },
  },
  success: 'You built the local half of the final project: a real SQLite table on the phone. It survived the restart, and each change touched exactly one row thanks to `WHERE id = ?`.',
  challenge: 'Add a **Clear done** button: `DELETE FROM tasks WHERE done = 1`.',
};
