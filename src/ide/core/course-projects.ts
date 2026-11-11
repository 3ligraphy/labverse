/**
 * Course projects: ready-made BUENOVA Code projects that a lab opens with one button (and the start screen lists).
 * The first is Lab 05's attendance app: the project of Lab 05 Parts 9–10 (Amr's starter files), set up so it runs
 * in the code editor's phone emulator with nothing to install, with GUIDE.md shown in the Guide panel.
 * Opening a course project again reopens the student's own copy instead of making a new one.
 */
import { WorkspaceFS } from './fs';
import { TEMPLATES } from './project';
import { memo, workspaces } from './settings';

export const SITE = 'https://labverse-indol.vercel.app';

export type CourseProject = { id: string; title: string; kind: string; description: string; lab: string; open: string[]; files: () => Record<string, string> };

const rn = () => TEMPLATES.find((t) => t.id === 'react-native')!.files;

const LAB05_INDEX = `import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';

type Status = { kind: 'idle' } | { kind: 'loading' } | { kind: 'success'; message: string } | { kind: 'error'; message: string };

export default function CheckInScreen() {
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const submit = async () => {
    setStatus({ kind: 'loading' });
    // TODO (Exercise 10.1): call checkIn(name, studentId) from '@/features/attendance/api'
    // and turn the result into setStatus({ kind: 'success', message } | { kind: 'error', message }).
  };

  const disabled = !name.trim() || !studentId.trim() || status.kind === 'loading';

  return (
    <View className="flex-1 bg-slate-50 px-6 pt-20">
      <View className="mb-8">
        <Text className="text-xs font-bold tracking-widest text-emerald-600">ATTENDANCE</Text>
        <Text className="mt-1.5 text-3xl font-bold text-slate-900">Check in</Text>
        <Text className="mt-2 text-base leading-snug text-slate-500">Type your name and student ID, then submit.</Text>
      </View>

      <View className="gap-4">
        <View className="gap-2">
          <Text className="text-sm font-semibold text-slate-700">Full name</Text>
          <TextInput
            className="h-14 rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-900"
            value={name}
            onChangeText={setName}
            placeholder="Mariam Ahmed"
            placeholderTextColor="#94a3b8"
            autoCapitalize="words"
          />
        </View>

        <View className="gap-2">
          <Text className="text-sm font-semibold text-slate-700">Student ID</Text>
          <TextInput
            className="h-14 rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-900"
            value={studentId}
            onChangeText={setStudentId}
            placeholder="236541"
            placeholderTextColor="#94a3b8"
            keyboardType="number-pad"
          />
        </View>

        <Pressable
          className={\`mt-1.5 h-14 items-center justify-center rounded-2xl \${disabled ? 'bg-emerald-300' : 'bg-emerald-600 active:scale-[0.98] active:opacity-90'}\`}
          onPress={submit}
          disabled={disabled}
        >
          {status.kind === 'loading' ? <ActivityIndicator color="#ffffff" /> : <Text className="text-base font-bold text-white">Submit</Text>}
        </Pressable>

        {status.kind === 'success' && (
          <View className="rounded-2xl bg-emerald-100 p-3.5"><Text className="text-sm font-semibold text-slate-900">{status.message}</Text></View>
        )}
        {status.kind === 'error' && (
          <View className="rounded-2xl bg-red-100 p-3.5"><Text className="text-sm font-semibold text-slate-900">{status.message}</Text></View>
        )}
      </View>
    </View>
  );
}
`;

const LAB05_LOOKUP = `import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Image } from 'react-native';

type Pokemon = { name: string; sprite: string; types: string[] };
type Status = { kind: 'idle' } | { kind: 'loading' } | { kind: 'success'; data: Pokemon } | { kind: 'error'; message: string };

export default function PokemonScreen() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const search = async () => {
    if (!query.trim()) return;
    setStatus({ kind: 'loading' });
    // TODO (Exercise 10.3): call getPokemon(query) from '@/features/external/api'
    // and turn the result into setStatus({ kind: 'success', data } | { kind: 'error', message }).
  };

  return (
    <View className="flex-1 bg-slate-50 px-6 pt-20">
      <View className="mb-7">
        <Text className="text-xs font-bold tracking-widest text-emerald-600">EXTERNAL API</Text>
        <Text className="mt-1.5 text-3xl font-bold text-slate-900">Pokémon lookup</Text>
        <Text className="mt-2 text-base text-slate-500">Type a name, e.g. pikachu.</Text>
      </View>

      <View className="flex-row gap-2.5">
        <TextInput
          className="h-14 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-900"
          value={query}
          onChangeText={setQuery}
          placeholder="pikachu"
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={search}
        />
        <Pressable className="h-14 items-center justify-center rounded-2xl bg-emerald-600 px-6 active:scale-[0.98] active:opacity-90" onPress={search}>
          <Text className="text-[15px] font-bold text-white">Search</Text>
        </Pressable>
      </View>

      <View className="mt-8 items-center">
        {status.kind === 'idle' && <Text className="text-sm text-slate-400">Results show up here.</Text>}
        {status.kind === 'loading' && <ActivityIndicator color="#059669" />}
        {status.kind === 'error' && <Text className="text-sm font-semibold text-red-600">{status.message}</Text>}
        {status.kind === 'success' && (
          <View className="w-full items-center rounded-2xl border border-slate-200 bg-white p-6">
            <Image source={{ uri: status.data.sprite }} className="h-32 w-32" />
            <Text className="mt-2 text-xl font-bold capitalize text-slate-900">{status.data.name}</Text>
            <View className="mt-3 flex-row gap-2">
              {status.data.types.map((t) => (
                <View key={t} className="rounded-full bg-emerald-100 px-3 py-1.5">
                  <Text className="text-xs font-bold capitalize text-emerald-700">{t}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
`;

const LAB05_GUIDE = `# Lab 05 · Attendance app

This is your Lab 05 project. It runs here in the browser: **nothing to install**.
The phone on the right is your app. It updates every time you type.

**How to work:** read one step, click the file it names to open it, write the code, then look at the phone.
The full explanations, hints and solutions are in **Lab 05, Part 10** on the course site.

## Step 1 · Look around (5 min)

The app has two screens. Switch between them with the tabs at the bottom of the phone.

- [app/(tabs)/index.tsx](app/(tabs)/index.tsx): the **Check in** screen. The form is ready; the request is missing.
- [app/(tabs)/lookup.tsx](app/(tabs)/lookup.tsx): the **Pokémon lookup** screen. Ready too; the request is missing.

The requests live in their own files:

- [features/attendance/api.ts](features/attendance/api.ts): talks to the course attendance API.
- [features/external/api.ts](features/external/api.ts): talks to PokeAPI.
- [shared/device.ts](shared/device.ts): makes one device ID for this app. It is already done.

If the phone is not showing, press **▶ Run** (F5).

## Step 2 · Exercise 10.1: check in for real (30 min)

1. Open [features/attendance/api.ts](features/attendance/api.ts) and finish \`checkIn(name, studentId)\`. It sends a **POST** to \`BASE\` with the JSON body \`{ name, studentId, deviceId: getDeviceId() }\`:
   - \`method: 'POST'\`
   - \`headers: { 'Content-Type': 'application/json' }\`
   - \`body: JSON.stringify({ name, studentId, deviceId: getDeviceId() })\`
2. Read the answer with \`await res.json()\`, then return what the screen needs:
   - **201**: \`{ ok: true, entry }\`. You are checked in now.
   - **200** with \`already: true\`: \`{ ok: true, entry, already: true }\`. You were checked in before.
   - **400**: \`{ ok: false, reason: 'invalid' }\`. The name or the student ID is wrong.
   - **503**: \`{ ok: false, reason: 'closed' }\`. Attendance is closed.
   - anything else: \`{ ok: false, reason: 'error' }\`.
3. Open [app/(tabs)/index.tsx](app/(tabs)/index.tsx) and finish \`submit()\`:
   - add \`import { checkIn } from '@/features/attendance/api';\` at the top
   - \`const result = await checkIn(name, studentId);\`
   - \`result.ok\` is true: \`setStatus({ kind: 'success', message: 'Checked in ✓' })\`
   - otherwise: \`setStatus({ kind: 'error', message: … })\` with a message for the reason
4. In the phone, type **your real full name and your student ID**, then press **Submit**.

When the phone says you are checked in, **your Lab 05 attendance is saved** and your TA can see it.

Prefer Axios? It works here too, without installing anything: \`import axios from 'axios';\`. The lab shows both versions.

## Step 3 · Exercise 10.2: is attendance open? (15 min)

1. In [features/attendance/api.ts](features/attendance/api.ts), add \`attendanceOpen()\`: a **GET** to \`\${BASE}/status\`. Return \`Boolean(data.open)\`.
2. In [app/(tabs)/index.tsx](app/(tabs)/index.tsx):
   - \`const [open, setOpen] = useState(true);\`
   - \`useEffect(() => { attendanceOpen().then(setOpen); }, []);\` (import \`useEffect\` from \`'react'\`)
   - when \`open\` is \`false\`, show "Attendance is not open yet" instead of the form.

## Step 4 · Exercise 10.3: look up a Pokémon (30 min)

1. Open [features/external/api.ts](features/external/api.ts) and finish \`getPokemon(name)\`:
   - a GET to \`https://pokeapi.co/api/v2/pokemon/\` plus the name, trimmed and lowercased
   - \`res.ok\` is false: \`throw new Error('Not found — check the spelling.')\`
   - return \`{ name: data.name, sprite: data.sprites.front_default, types: data.types.map((t) => t.type.name) }\`
2. Open [app/(tabs)/lookup.tsx](app/(tabs)/lookup.tsx) and finish \`search()\` with \`try { … } catch { … }\`:
   - success: \`setStatus({ kind: 'success', data })\`
   - error: \`setStatus({ kind: 'error', message: error.message })\`
3. In the phone, open the **Pokémon** tab, type \`pikachu\` and press **Search**. Then try a wrong name: the app must show the error, not crash.

## When something goes wrong

- A red message on the phone, or a red line under your code: read it. It says which file and which line.
- The phone does not change: press **⟳** above the phone to reload the app.
- \`console.log(…)\` output: press the console button above the phone.
- Still stuck: open the 3 hints of the exercise in Lab 05, Part 10.

## Working on your own computer instead?

File → **Export Workspace as ZIP**. Unzip it, open the folder in VS Code, then run \`npm install\` and \`npx expo start\` (Lab 05, Part 9, Option B).
`;

export const COURSE_PROJECTS: CourseProject[] = [
  {
    id: 'lab05-attendance',
    title: 'Lab 05 · Attendance app',
    kind: 'react-native',
    lab: 'Lab 05',
    description: 'The React Native app of Lab 05 Parts 9–10: check in with the attendance API, and look up a Pokémon.',
    open: ['/features/attendance/api.ts', '/app/(tabs)/index.tsx'],
    files: () => {
      const base = rn();
      const pkg = JSON.parse(base['/package.json']);
      pkg.name = 'attendance-app';
      pkg.dependencies = Object.fromEntries(Object.entries({ ...pkg.dependencies, axios: '^1.7.9' }).sort(([a], [b]) => a.localeCompare(b)));
      const app = JSON.parse(base['/app.json']);
      app.expo.name = 'attendance-app';
      app.expo.slug = 'attendance-app';
      app.expo.scheme = 'attendanceapp';
      return {
        '/GUIDE.md': LAB05_GUIDE,
        '/app/_layout.tsx': `import '../global.css';
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
`,
        '/app/(tabs)/_layout.tsx': `import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#059669' }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Check in', tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-circle" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="lookup"
        options={{ title: 'Pokémon', tabBarIcon: ({ color, size }) => <Ionicons name="search" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
`,
        '/app/(tabs)/index.tsx': LAB05_INDEX,
        '/app/(tabs)/lookup.tsx': LAB05_LOOKUP,
        '/shared/device.ts': `let cached: string | null = null;
export function getDeviceId() {
  if (!cached) cached = crypto.randomUUID(); // 36 chars — well within the 16–64 range the API requires
  return cached;
}
`,
        '/features/attendance/api.ts': `import { getDeviceId } from '@/shared/device';

// The course attendance API (Lab 05). Your check-in counts for Lab 05.
const BASE = '${SITE}/api/attendance';

export async function checkIn(name: string, studentId: string) {
  // TODO: POST { name, studentId, deviceId: getDeviceId() } to BASE as JSON
  // TODO: 201 -> { ok: true, entry }                  (checked in now)
  // TODO: 200 with data.already -> { ok: true, entry, already: true }   (you were checked in before)
  // TODO: 400 -> { ok: false, reason: 'invalid' }     (the name or the student ID is wrong)
  // TODO: 503 -> { ok: false, reason: 'closed' }
  // TODO: anything else -> { ok: false, reason: 'error' }
}

// Exercise 10.2: add attendanceOpen() here — a GET to \`\${BASE}/status\` that returns Boolean(data.open)
`,
        '/features/external/api.ts': `export async function getPokemon(name: string) {
  // TODO: GET https://pokeapi.co/api/v2/pokemon/<name, trimmed + lowercased>
  // TODO: not found -> throw a friendly Error
  // TODO: return { name, sprite, types } pulled from the response
}
`,
        '/global.css': base['/global.css'],
        '/tailwind.config.js': `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './features/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: { extend: {} },
  plugins: [],
};
`,
        '/babel.config.js': base['/babel.config.js'],
        '/metro.config.js': base['/metro.config.js'],
        '/nativewind-env.d.ts': base['/nativewind-env.d.ts'],
        '/tsconfig.json': base['/tsconfig.json'],
        '/app.json': JSON.stringify(app, null, 2) + '\n',
        '/package.json': JSON.stringify(pkg, null, 2) + '\n',
      };
    },
  },
];

const KEY = (id: string) => `course:${id}`;

/** The student's own copy of a course project in this browser, if they opened it before. */
export function existingCourseWorkspace(id: string): string | null {
  const ws = memo.get<string | null>(KEY(id), null);
  return ws && workspaces.get(ws) ? ws : null;
}

/** Makes the student's copy of a course project (or finds the one made before) and returns its workspace id. */
export async function courseWorkspace(id: string): Promise<string> {
  const found = existingCourseWorkspace(id);
  if (found) return found;
  const p = COURSE_PROJECTS.find((x) => x.id === id);
  if (!p) throw new Error(`No course project "${id}".`);
  const ws = workspaces.create(p.title, p.kind);
  const fs = new WorkspaceFS(ws.id);
  for (const [path, text] of Object.entries(p.files())) await fs.write(path, text);
  await fs.flush();
  memo.set(`tabs:${ws.id}`, [{ tabs: p.open, active: p.open[0] }]);
  memo.set(KEY(id), ws.id);
  return ws.id;
}

/** Opens a course project in the code editor (a new tab by default, so the lab page stays open). */
export async function openCourseProject(id: string, newTab = true) {
  const win = newTab ? window.open('about:blank', '_blank') : null;
  try {
    const ws = await courseWorkspace(id);
    const url = `/ide?ws=${encodeURIComponent(ws)}`;
    if (win) win.location.href = url;
    else location.href = url;
  } catch (error) {
    win?.close();
    throw error;
  }
}
