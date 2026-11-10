/** Project templates, and ZIP import / export. */
import { unzipSync, zipSync } from 'fflate';
import { basename, h, join } from './dom';
import type { WorkspaceFS } from './fs';

export type Template = { id: string; name: string; description: string; iconName: string; open: string; files: Record<string, string> };

const pkg = (o: object) => JSON.stringify(o, null, 2) + '\n';

export const TEMPLATES: Template[] = [
  { id: 'empty', name: 'Empty workspace', description: 'Start with nothing.', iconName: 'file', open: '', files: {} },
  {
    id: 'expo', name: 'React Native (Expo + NativeWind)', description: 'A mobile app with Expo Router and NativeWind. Runs in the phone emulator.', iconName: 'device-mobile', open: '/app/index.tsx',
    files: {"/package.json": "{\n  \"name\": \"my-expo-app\",\n  \"version\": \"1.0.0\",\n  \"main\": \"expo-router/entry\",\n  \"scripts\": {\n    \"start\": \"expo start\",\n    \"android\": \"expo start --android\",\n    \"ios\": \"expo start --ios\",\n    \"web\": \"expo start --web\"\n  },\n  \"dependencies\": {\n    \"expo\": \"~52.0.0\",\n    \"expo-router\": \"~4.0.0\",\n    \"expo-status-bar\": \"~2.0.0\",\n    \"nativewind\": \"^4.1.23\",\n    \"react\": \"18.3.1\",\n    \"react-native\": \"0.76.5\",\n    \"react-native-reanimated\": \"~3.16.1\",\n    \"react-native-safe-area-context\": \"4.12.0\",\n    \"react-native-screens\": \"~4.4.0\",\n    \"tailwindcss\": \"^3.4.17\"\n  },\n  \"devDependencies\": {\n    \"@babel/core\": \"^7.25.0\",\n    \"@types/react\": \"~18.3.12\",\n    \"typescript\": \"^5.3.3\"\n  }\n}\n", "/app/_layout.tsx": "import '../global.css';\nimport { Stack } from 'expo-router';\n\nexport default function RootLayout() {\n  return (\n    <Stack\n      screenOptions={{\n        headerStyle: { backgroundColor: '#0f172a' },\n        headerTintColor: '#ffffff',\n      }}\n    >\n      <Stack.Screen name=\"index\" options={{ title: 'My Tasks' }} />\n      <Stack.Screen name=\"task/[id]\" options={{ title: 'Task' }} />\n    </Stack>\n  );\n}\n", "/app/index.tsx": "import { useState } from 'react';\nimport { FlatList, Pressable, Text, TextInput, View } from 'react-native';\nimport { TaskCard } from '../components/TaskCard';\nimport { starterTasks, type Task } from '../data/tasks';\n\nexport default function HomeScreen() {\n  const [tasks, setTasks] = useState<Task[]>(starterTasks);\n  const [title, setTitle] = useState('');\n\n  function addTask() {\n    if (!title.trim()) return;\n    setTasks([{ id: String(Date.now()), title: title.trim(), done: false }, ...tasks]);\n    setTitle('');\n  }\n\n  function toggleTask(id: string) {\n    setTasks(tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task)));\n  }\n\n  const left = tasks.filter((task) => !task.done).length;\n\n  return (\n    <View className=\"flex-1 bg-slate-100 p-4\">\n      <Text className=\"text-2xl font-bold text-slate-900\">Today</Text>\n      <Text className=\"mb-4 text-slate-500\">{left} tasks left</Text>\n\n      <View className=\"mb-4 flex-row gap-2\">\n        <TextInput\n          className=\"flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3\"\n          placeholder=\"Add a task\"\n          value={title}\n          onChangeText={setTitle}\n          onSubmitEditing={addTask}\n        />\n        <Pressable className=\"items-center justify-center rounded-xl bg-indigo-600 px-5\" onPress={addTask}>\n          <Text className=\"font-semibold text-white\">Add</Text>\n        </Pressable>\n      </View>\n\n      <FlatList\n        data={tasks}\n        keyExtractor={(task) => task.id}\n        renderItem={({ item }) => <TaskCard task={item} onToggle={() => toggleTask(item.id)} />}\n      />\n    </View>\n  );\n}\n", "/app/task/[id].tsx": "import { Link, useLocalSearchParams } from 'expo-router';\nimport { Text, View } from 'react-native';\nimport { starterTasks } from '../../data/tasks';\n\nexport default function TaskScreen() {\n  const { id } = useLocalSearchParams<{ id: string }>();\n  const task = starterTasks.find((item) => item.id === id);\n\n  return (\n    <View className=\"flex-1 items-center justify-center gap-3 bg-white p-6\">\n      <Text className=\"text-xl font-bold text-slate-900\">{task ? task.title : 'New task'}</Text>\n      <Text className=\"text-slate-500\">Task id: {id}</Text>\n      <Link href=\"/\" className=\"text-indigo-600\">\n        Back to the list\n      </Link>\n    </View>\n  );\n}\n", "/components/TaskCard.tsx": "import { Link } from 'expo-router';\nimport { Pressable, Text, View } from 'react-native';\nimport type { Task } from '../data/tasks';\n\ntype Props = {\n  task: Task;\n  onToggle: () => void;\n};\n\nexport function TaskCard({ task, onToggle }: Props) {\n  return (\n    <View className=\"mb-3 flex-row items-center gap-3 rounded-2xl bg-white p-4\">\n      <Pressable\n        onPress={onToggle}\n        className={`h-7 w-7 items-center justify-center rounded-full border-2 ${task.done ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'}`}\n      >\n        {task.done ? <Text className=\"font-bold text-white\">✓</Text> : null}\n      </Pressable>\n      <Text className={`flex-1 text-base ${task.done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{task.title}</Text>\n      <Link href={`/task/${task.id}`} className=\"text-indigo-600\">\n        Open\n      </Link>\n    </View>\n  );\n}\n", "/data/tasks.ts": "export type Task = {\n  id: string;\n  title: string;\n  done: boolean;\n};\n\nexport const starterTasks: Task[] = [\n  { id: '1', title: 'Open the phone emulator', done: true },\n  { id: '2', title: 'Change a className and watch it update', done: false },\n  { id: '3', title: 'Add a new screen in the app folder', done: false },\n];\n", "/global.css": "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n", "/tailwind.config.js": "/** @type {import('tailwindcss').Config} */\nmodule.exports = {\n  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],\n  presets: [require('nativewind/preset')],\n  theme: {\n    extend: {},\n  },\n  plugins: [],\n};\n", "/babel.config.js": "module.exports = function (api) {\n  api.cache(true);\n  return {\n    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],\n  };\n};\n", "/metro.config.js": "const { getDefaultConfig } = require('expo/metro-config');\nconst { withNativeWind } = require('nativewind/metro');\n\nconst config = getDefaultConfig(__dirname);\n\nmodule.exports = withNativeWind(config, { input: './global.css' });\n", "/app.json": "{\n  \"expo\": {\n    \"name\": \"my-expo-app\",\n    \"slug\": \"my-expo-app\",\n    \"scheme\": \"myexpoapp\",\n    \"version\": \"1.0.0\",\n    \"orientation\": \"portrait\",\n    \"plugins\": [\n      \"expo-router\"\n    ]\n  }\n}\n", "/tsconfig.json": "{\n  \"extends\": \"expo/tsconfig.base\",\n  \"compilerOptions\": {\n    \"strict\": true,\n    \"paths\": {\n      \"@/*\": [\n        \"./*\"\n      ]\n    }\n  },\n  \"include\": [\n    \"**/*.ts\",\n    \"**/*.tsx\",\n    \"nativewind-env.d.ts\"\n  ]\n}\n", "/nativewind-env.d.ts": "/// <reference types=\"nativewind/types\" />\n", "/README.md": "# Expo + React Native + NativeWind\n\n## In BUENOVA Code\n\nPress **Run** (or the phone icon) to open the **Phone Emulator**. The app reloads as you type.\n\nThe emulator runs your React Native code in the browser (react-native-web), with Expo Router and NativeWind classes.\nIt is not an Android or iOS system image: native modules (camera, sensors, notifications) do not run in it.\n\n## On a real phone or the Android emulator\n\n1. File → Export Workspace as ZIP, and unzip it on your computer.\n2. `npm install`\n3. `npx expo start`, then press `a` for the Android emulator or scan the QR code with Expo Go.\n"},
  },
  {
    id: 'static', name: 'Static website', description: 'HTML, CSS and JavaScript with a live preview.', iconName: 'globe', open: '/index.html',
    files: {
      '/index.html': '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <title>My site</title>\n    <link rel="stylesheet" href="style.css" />\n  </head>\n  <body>\n    <main>\n      <h1>Hello, world</h1>\n      <p>Edit <code>index.html</code> and watch the preview update.</p>\n      <button id="count">Clicked 0 times</button>\n    </main>\n    <script src="script.js"></script>\n  </body>\n</html>\n',
      '/style.css': 'body {\n  font-family: system-ui, sans-serif;\n  margin: 0;\n  min-height: 100vh;\n  display: grid;\n  place-items: center;\n  background: #10131a;\n  color: #f2f4f8;\n}\n\nmain {\n  text-align: center;\n}\n\nbutton {\n  font: inherit;\n  padding: 0.6em 1.2em;\n  border: 0;\n  border-radius: 8px;\n  background: #c8ff4d;\n  cursor: pointer;\n}\n',
      '/script.js': "const button = document.querySelector('#count');\nlet clicks = 0;\n\nbutton.addEventListener('click', () => {\n  clicks += 1;\n  button.textContent = `Clicked ${clicks} times`;\n  console.log('clicks:', clicks);\n});\n",
    },
  },
  {
    id: 'node', name: 'Node.js', description: 'A Node.js program. Run it with npm start.', iconName: 'terminal', open: '/index.js',
    files: {
      '/package.json': pkg({ name: 'node-app', version: '1.0.0', type: 'module', scripts: { start: 'node index.js' } }),
      '/index.js': "import os from 'node:os';\n\nfunction greet(name) {\n  return `Hello, ${name}!`;\n}\n\nconsole.log(greet('world'));\nconsole.log('Node', process.version, 'on', os.platform());\n",
    },
  },
  {
    id: 'express', name: 'Express API', description: 'A small web server with a JSON API.', iconName: 'server', open: '/server.js',
    files: {
      '/package.json': pkg({ name: 'express-api', version: '1.0.0', type: 'module', scripts: { dev: 'node --watch server.js', start: 'node server.js' }, dependencies: { express: '^4.21.2' } }),
      '/server.js': "import express from 'express';\n\nconst app = express();\nconst port = 3000;\nconst todos = [{ id: 1, title: 'Try the API', done: false }];\n\napp.use(express.json());\n\napp.get('/', (req, res) => {\n  res.send('<h1>Express is running</h1><p>Try <a href=\"/api/todos\">/api/todos</a></p>');\n});\n\napp.get('/api/todos', (req, res) => {\n  res.json(todos);\n});\n\napp.post('/api/todos', (req, res) => {\n  const todo = { id: todos.length + 1, title: req.body.title, done: false };\n  todos.push(todo);\n  res.status(201).json(todo);\n});\n\napp.listen(port, () => {\n  console.log(`Server ready on http://localhost:${port}`);\n});\n",
    },
  },
  {
    id: 'vite-react', name: 'React (Vite)', description: 'React app with hot reload. npm install, then npm run dev.', iconName: 'symbol-misc', open: '/src/App.jsx',
    files: {
      '/package.json': pkg({ name: 'react-app', private: true, version: '0.0.0', type: 'module', scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' }, dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' }, devDependencies: { '@vitejs/plugin-react': '^4.3.4', vite: '^5.4.11' } }),
      '/vite.config.js': "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()],\n});\n",
      '/index.html': '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>React app</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>\n',
      '/src/main.jsx': "import { StrictMode } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\nimport './index.css';\n\ncreateRoot(document.getElementById('root')).render(\n  <StrictMode>\n    <App />\n  </StrictMode>,\n);\n",
      '/src/App.jsx': "import { useState } from 'react';\n\nexport default function App() {\n  const [count, setCount] = useState(0);\n\n  return (\n    <main>\n      <h1>React + Vite</h1>\n      <button onClick={() => setCount((c) => c + 1)}>count is {count}</button>\n      <p>Edit <code>src/App.jsx</code> and save to see it update.</p>\n    </main>\n  );\n}\n",
      '/src/index.css': 'body {\n  font-family: system-ui, sans-serif;\n  margin: 0;\n  min-height: 100vh;\n  display: grid;\n  place-items: center;\n  background: #10131a;\n  color: #f2f4f8;\n}\n\nmain {\n  text-align: center;\n}\n\nbutton {\n  font: inherit;\n  padding: 0.6em 1.2em;\n  border-radius: 8px;\n  border: 0;\n  background: #61dafb;\n  cursor: pointer;\n}\n',
    },
  },
  {
    id: 'vite-ts', name: 'TypeScript (Vite)', description: 'Plain TypeScript with Vite.', iconName: 'symbol-class', open: '/src/main.ts',
    files: {
      '/package.json': pkg({ name: 'ts-app', private: true, version: '0.0.0', type: 'module', scripts: { dev: 'vite', build: 'tsc && vite build' }, devDependencies: { typescript: '^5.6.3', vite: '^5.4.11' } }),
      '/tsconfig.json': pkg({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler', strict: true, noEmit: true, lib: ['ES2022', 'DOM'] }, include: ['src'] }),
      '/index.html': '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>TypeScript app</title>\n  </head>\n  <body>\n    <div id="app"></div>\n    <script type="module" src="/src/main.ts"></script>\n  </body>\n</html>\n',
      '/src/main.ts': "interface Todo {\n  id: number;\n  title: string;\n  done: boolean;\n}\n\nconst todos: Todo[] = [\n  { id: 1, title: 'Learn TypeScript', done: true },\n  { id: 2, title: 'Build something', done: false },\n];\n\nconst app = document.querySelector<HTMLDivElement>('#app')!;\napp.innerHTML = `<h1>Todos</h1><ul>${todos.map((t) => `<li>${t.done ? '✅' : '⬜'} ${t.title}</li>`).join('')}</ul>`;\n",
    },
  },
  {
    id: 'python', name: 'Python', description: 'A Python program. Runs in the browser.', iconName: 'symbol-method', open: '/main.py',
    files: { '/main.py': 'def fib(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a\n\n\nname = input("What is your name? ")\nprint(f"Hello, {name}!")\n\nfor i in range(10):\n    print(i, fib(i))\n' },
  },
  {
    id: 'cpp', name: 'C++', description: 'A C++ program (the course subset of C++).', iconName: 'symbol-structure', open: '/main.cpp',
    files: { '/main.cpp': '#include <iostream>\nusing namespace std;\n\nint main() {\n    int n;\n    cout << "How many numbers? ";\n    cin >> n;\n\n    int sum = 0;\n    for (int i = 1; i <= n; i++) {\n        sum += i;\n    }\n\n    cout << "The sum of 1 to " << n << " is " << sum << endl;\n    return 0;\n}\n' },
  },
];

export async function applyTemplate(fs: WorkspaceFS, t: Template) {
  for (const [path, text] of Object.entries(t.files)) await fs.write(path, text);
}

/** Unpacks a ZIP into `dir`. A single top-level folder is flattened (the usual "project/…" wrapper). */
export async function importZip(fs: WorkspaceFS, bytes: Uint8Array, dir = '/'): Promise<number> {
  const files = unzipSync(bytes, { filter: (f) => !/(^|\/)(node_modules|\.git|__MACOSX)\//.test(f.name) && f.originalSize < 30_000_000 });
  const names = Object.keys(files).filter((n) => !n.endsWith('/'));
  const tops = new Set(names.map((n) => n.split('/')[0]));
  const strip = tops.size === 1 && names.every((n) => n.includes('/')) ? [...tops][0].length + 1 : 0;
  let n = 0;
  for (const name of names) {
    const rel = name.slice(strip);
    if (!rel || rel.split('/').some((s) => s === '..')) continue;
    await fs.write(join(dir, rel), files[name]);
    n++;
  }
  return n;
}

export async function exportZip(fs: WorkspaceFS, dir = '/'): Promise<Uint8Array> {
  const out: Record<string, Uint8Array> = {};
  for (const path of await fs.walk(dir)) out[path.slice(dir === '/' ? 1 : dir.length + 1)] = await fs.readBytes(path);
  return zipSync(out, { level: 6 });
}

export function downloadBytes(bytes: Uint8Array, name: string, type = 'application/octet-stream') {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  h('a', { href: url, download: basename(name) }).click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
