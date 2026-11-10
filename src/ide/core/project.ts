/** Project templates (one per language or framework), and ZIP import / export. */
import { unzipSync, zipSync } from 'fflate';
import { basename, h, join } from './dom';
import type { WorkspaceFS } from './fs';

/** A starter project. `id` is also the project's kind: it decides what ▶ Run does. */
export type Template = { id: ProjectKind; name: string; tag: string; description: string; iconName: string; color: string; open: string; files: Record<string, string> };
export type ProjectKind = 'react-native' | 'react' | 'web' | 'javascript' | 'typescript' | 'python' | 'cpp' | 'sql';
export const KINDS: ProjectKind[] = ['react-native', 'react', 'web', 'javascript', 'typescript', 'python', 'cpp', 'sql'];

const pkg = (o: object) => JSON.stringify(o, null, 2) + '\n';

export const TEMPLATES: Template[] = [
 {
  "id": "react-native",
  "name": "React Native",
  "tag": "Mobile",
  "description": "A phone app with Expo Router and NativeWind. Runs in the phone emulator.",
  "iconName": "device-mobile",
  "color": "#61dafb",
  "open": "/app/index.tsx",
  "files": {
   "/package.json": "{\n  \"name\": \"my-expo-app\",\n  \"version\": \"1.0.0\",\n  \"main\": \"expo-router/entry\",\n  \"scripts\": {\n    \"start\": \"expo start\",\n    \"android\": \"expo start --android\",\n    \"ios\": \"expo start --ios\",\n    \"web\": \"expo start --web\"\n  },\n  \"dependencies\": {\n    \"expo\": \"~52.0.0\",\n    \"expo-constants\": \"~17.0.0\",\n    \"expo-linking\": \"~7.0.0\",\n    \"expo-router\": \"~4.0.22\",\n    \"expo-status-bar\": \"~2.0.0\",\n    \"nativewind\": \"^4.1.23\",\n    \"query-string\": \"^7.1.3\",\n    \"react\": \"18.3.1\",\n    \"react-native\": \"0.76.9\",\n    \"react-native-gesture-handler\": \"~2.20.2\",\n    \"react-native-reanimated\": \"~3.16.1\",\n    \"react-native-safe-area-context\": \"4.12.0\",\n    \"react-native-screens\": \"~4.4.0\",\n    \"tailwindcss\": \"^3.4.17\"\n  },\n  \"devDependencies\": {\n    \"@babel/core\": \"^7.25.0\",\n    \"@types/react\": \"~18.3.12\",\n    \"typescript\": \"^5.3.3\"\n  }\n}\n",
   "/app/_layout.tsx": "import '../global.css';\nimport { Stack } from 'expo-router';\n\nexport default function RootLayout() {\n  return (\n    <Stack\n      screenOptions={{\n        headerStyle: { backgroundColor: '#0f172a' },\n        headerTintColor: '#ffffff',\n      }}\n    >\n      <Stack.Screen name=\"index\" options={{ title: 'My Tasks' }} />\n      <Stack.Screen name=\"task/[id]\" options={{ title: 'Task' }} />\n    </Stack>\n  );\n}\n",
   "/app/index.tsx": "import { useState } from 'react';\nimport { FlatList, Pressable, Text, TextInput, View } from 'react-native';\nimport { TaskCard } from '../components/TaskCard';\nimport { starterTasks, type Task } from '../data/tasks';\n\nexport default function HomeScreen() {\n  const [tasks, setTasks] = useState<Task[]>(starterTasks);\n  const [title, setTitle] = useState('');\n\n  function addTask() {\n    if (!title.trim()) return;\n    setTasks([{ id: String(Date.now()), title: title.trim(), done: false }, ...tasks]);\n    setTitle('');\n  }\n\n  function toggleTask(id: string) {\n    setTasks(tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task)));\n  }\n\n  const left = tasks.filter((task) => !task.done).length;\n\n  return (\n    <View className=\"flex-1 bg-slate-100 p-4\">\n      <Text className=\"text-2xl font-bold text-slate-900\">Today</Text>\n      <Text className=\"mb-4 text-slate-500\">{left} tasks left</Text>\n\n      <View className=\"mb-4 flex-row gap-2\">\n        <TextInput\n          className=\"flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3\"\n          placeholder=\"Add a task\"\n          value={title}\n          onChangeText={setTitle}\n          onSubmitEditing={addTask}\n        />\n        <Pressable className=\"items-center justify-center rounded-xl bg-indigo-600 px-5\" onPress={addTask}>\n          <Text className=\"font-semibold text-white\">Add</Text>\n        </Pressable>\n      </View>\n\n      <FlatList\n        data={tasks}\n        keyExtractor={(task) => task.id}\n        renderItem={({ item }) => <TaskCard task={item} onToggle={() => toggleTask(item.id)} />}\n      />\n    </View>\n  );\n}\n",
   "/app/task/[id].tsx": "import { Link, useLocalSearchParams } from 'expo-router';\nimport { Text, View } from 'react-native';\nimport { starterTasks } from '../../data/tasks';\n\nexport default function TaskScreen() {\n  const { id } = useLocalSearchParams<{ id: string }>();\n  const task = starterTasks.find((item) => item.id === id);\n\n  return (\n    <View className=\"flex-1 items-center justify-center gap-3 bg-white p-6\">\n      <Text className=\"text-xl font-bold text-slate-900\">{task ? task.title : 'New task'}</Text>\n      <Text className=\"text-slate-500\">Task id: {id}</Text>\n      <Link href=\"/\" className=\"text-indigo-600\">\n        Back to the list\n      </Link>\n    </View>\n  );\n}\n",
   "/components/TaskCard.tsx": "import { Link } from 'expo-router';\nimport { Pressable, Text, View } from 'react-native';\nimport type { Task } from '../data/tasks';\n\ntype Props = {\n  task: Task;\n  onToggle: () => void;\n};\n\nexport function TaskCard({ task, onToggle }: Props) {\n  return (\n    <View className=\"mb-3 flex-row items-center gap-3 rounded-2xl bg-white p-4\">\n      <Pressable\n        onPress={onToggle}\n        className={`h-7 w-7 items-center justify-center rounded-full border-2 ${task.done ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'}`}\n      >\n        {task.done ? <Text className=\"font-bold text-white\">✓</Text> : null}\n      </Pressable>\n      <Text className={`flex-1 text-base ${task.done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{task.title}</Text>\n      <Link href={`/task/${task.id}`} className=\"text-indigo-600\">\n        Open\n      </Link>\n    </View>\n  );\n}\n",
   "/data/tasks.ts": "export type Task = {\n  id: string;\n  title: string;\n  done: boolean;\n};\n\nexport const starterTasks: Task[] = [\n  { id: '1', title: 'Open the phone emulator', done: true },\n  { id: '2', title: 'Change a className and watch it update', done: false },\n  { id: '3', title: 'Add a new screen in the app folder', done: false },\n];\n",
   "/global.css": "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n",
   "/tailwind.config.js": "/** @type {import('tailwindcss').Config} */\nmodule.exports = {\n  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],\n  presets: [require('nativewind/preset')],\n  theme: {\n    extend: {},\n  },\n  plugins: [],\n};\n",
   "/babel.config.js": "module.exports = function (api) {\n  api.cache(true);\n  return {\n    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],\n  };\n};\n",
   "/metro.config.js": "const { getDefaultConfig } = require('expo/metro-config');\nconst { withNativeWind } = require('nativewind/metro');\n\nconst config = getDefaultConfig(__dirname);\n\nmodule.exports = withNativeWind(config, { input: './global.css' });\n",
   "/app.json": "{\n  \"expo\": {\n    \"name\": \"my-expo-app\",\n    \"slug\": \"my-expo-app\",\n    \"scheme\": \"myexpoapp\",\n    \"version\": \"1.0.0\",\n    \"orientation\": \"portrait\",\n    \"plugins\": [\n      \"expo-router\"\n    ]\n  }\n}\n",
   "/tsconfig.json": "{\n  \"extends\": \"expo/tsconfig.base\",\n  \"compilerOptions\": {\n    \"strict\": true,\n    \"paths\": {\n      \"@/*\": [\n        \"./*\"\n      ]\n    }\n  },\n  \"include\": [\n    \"**/*.ts\",\n    \"**/*.tsx\",\n    \"nativewind-env.d.ts\"\n  ]\n}\n",
   "/nativewind-env.d.ts": "/// <reference types=\"nativewind/types\" />\n",
   "/README.md": "# Expo + React Native + NativeWind\n\n## In BUENOVA Code\n\nPress **Run** (or the phone icon) to open the **Phone Emulator**. The app reloads as you type.\n\nThe emulator runs your React Native code in the browser (react-native-web), with Expo Router and NativeWind classes.\nIt is not an Android or iOS system image: native modules (camera, sensors, notifications) do not run in it.\n\n## On a real phone or the Android emulator\n\n1. File → Export Workspace as ZIP, and unzip it on your computer.\n2. `npm install`\n3. `npx expo start`, then press `a` for the Android emulator or scan the QR code with Expo Go.\n"
  }
 },
 {
  "id": "react",
  "name": "React",
  "tag": "Web",
  "description": "A web app made of components, with state and events. Runs in the preview.",
  "iconName": "symbol-misc",
  "color": "#61dafb",
  "open": "/src/App.jsx",
  "files": {
   "/src/main.jsx": "import { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\n\n// Draw the App component inside the <div id=\"root\"> of the page\ncreateRoot(document.getElementById('root')).render(<App />);\n",
   "/src/App.jsx": "import { useState } from 'react';\nimport Counter from './components/Counter.jsx';\nimport TodoList from './components/TodoList.jsx';\nimport './App.css';\n\nexport default function App() {\n  const [name, setName] = useState('Mona');\n\n  return (\n    <main className=\"app\">\n      <h1>Hello, {name}!</h1>\n      <input value={name} onChange={(e) => setName(e.target.value)} placeholder=\"Your name\" />\n      <Counter start={0} />\n      <TodoList />\n    </main>\n  );\n}\n",
   "/src/components/Counter.jsx": "import { useState } from 'react';\n\n// A component: a function that returns what to draw. `start` is a prop.\nexport default function Counter({ start }) {\n  const [count, setCount] = useState(start);\n\n  return (\n    <section className=\"card\">\n      <h2>Counter</h2>\n      <p>You clicked {count} times</p>\n      <button onClick={() => setCount(count + 1)}>Click me</button>\n      <button onClick={() => setCount(start)}>Reset</button>\n    </section>\n  );\n}\n",
   "/src/components/TodoList.jsx": "import { useState } from 'react';\n\nexport default function TodoList() {\n  const [todos, setTodos] = useState(['Learn components', 'Learn state']);\n  const [text, setText] = useState('');\n\n  function add() {\n    if (!text.trim()) return;\n    setTodos([...todos, text.trim()]);\n    setText('');\n  }\n\n  return (\n    <section className=\"card\">\n      <h2>To do</h2>\n      <div className=\"row\">\n        <input value={text} onChange={(e) => setText(e.target.value)} placeholder=\"New task\" />\n        <button onClick={add}>Add</button>\n      </div>\n      <ul>\n        {todos.map((todo, i) => (\n          <li key={i}>{todo}</li>\n        ))}\n      </ul>\n    </section>\n  );\n}\n",
   "/src/App.css": "body {\n  margin: 0;\n  font-family: system-ui, sans-serif;\n  background: #f1f5f9;\n  color: #0f172a;\n}\n\n.app {\n  max-width: 520px;\n  margin: 0 auto;\n  padding: 24px;\n  display: grid;\n  gap: 16px;\n}\n\n.card {\n  background: white;\n  border-radius: 12px;\n  padding: 16px;\n  box-shadow: 0 1px 3px rgb(0 0 0 / 0.1);\n}\n\n.row {\n  display: flex;\n  gap: 8px;\n}\n\ninput {\n  font: inherit;\n  padding: 8px 10px;\n  border: 1px solid #cbd5e1;\n  border-radius: 8px;\n}\n\nbutton {\n  font: inherit;\n  padding: 8px 14px;\n  border: 0;\n  border-radius: 8px;\n  background: #4f46e5;\n  color: white;\n  cursor: pointer;\n  margin-right: 6px;\n}\n",
   "/README.md": "# React\n\nPress **▶ Run** (F5): the app opens in the preview and updates as you type.\n\n- `src/main.jsx` draws `App` on the page.\n- `src/App.jsx` is the main component.\n- `src/components/` holds smaller components.\n- `src/App.css` styles the page.\n"
  }
 },
 {
  "id": "web",
  "name": "HTML, CSS & JavaScript",
  "tag": "Web",
  "description": "A website with pages, styles and scripts. Runs in the preview.",
  "iconName": "globe",
  "color": "#e44d26",
  "open": "/index.html",
  "files": {
   "/index.html": "<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"utf-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n    <title>My website</title>\n    <link rel=\"stylesheet\" href=\"css/style.css\" />\n  </head>\n  <body>\n    <nav>\n      <a href=\"index.html\">Home</a>\n      <a href=\"about.html\">About</a>\n    </nav>\n    <main>\n      <h1>Hello, world</h1>\n      <p>Edit <code>index.html</code> and watch the preview update.</p>\n      <button id=\"count\">Clicked 0 times</button>\n    </main>\n    <script src=\"js/script.js\"></script>\n  </body>\n</html>\n",
   "/about.html": "<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"utf-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n    <title>About</title>\n    <link rel=\"stylesheet\" href=\"css/style.css\" />\n  </head>\n  <body>\n    <nav>\n      <a href=\"index.html\">Home</a>\n      <a href=\"about.html\">About</a>\n    </nav>\n    <main>\n      <h1>About</h1>\n      <p>This is a second page. The links in the menu open it in the preview.</p>\n    </main>\n  </body>\n</html>\n",
   "/css/style.css": "body {\n  margin: 0;\n  font-family: system-ui, sans-serif;\n  background: #10131a;\n  color: #f2f4f8;\n}\n\nnav {\n  display: flex;\n  gap: 16px;\n  padding: 16px 24px;\n  background: #181c25;\n}\n\nnav a {\n  color: #c8ff4d;\n  text-decoration: none;\n}\n\nmain {\n  padding: 32px 24px;\n}\n\nbutton {\n  font: inherit;\n  padding: 0.6em 1.2em;\n  border: 0;\n  border-radius: 8px;\n  background: #c8ff4d;\n  cursor: pointer;\n}\n",
   "/js/script.js": "const button = document.querySelector('#count');\nlet clicks = 0;\n\nbutton.addEventListener('click', () => {\n  clicks += 1;\n  button.textContent = `Clicked ${clicks} times`;\n  console.log('clicks:', clicks);\n});\n"
  }
 },
 {
  "id": "javascript",
  "name": "JavaScript",
  "tag": "Console",
  "description": "Programs that print to the terminal. Use fetch to call APIs.",
  "iconName": "symbol-variable",
  "color": "#e8d44d",
  "open": "/main.js",
  "files": {
   "/main.js": "import { average, grade } from './utils/math.js';\nimport students from './data/students.json';\n\nconsole.log('Class report');\nconsole.log('------------');\n\nfor (const student of students) {\n  const avg = average(student.marks);\n  console.log(`${student.name}: ${avg.toFixed(1)} (${grade(avg)})`);\n}\n\n// prompt() asks a question in the terminal and waits for your answer\nconst name = prompt('What is your name?');\nconsole.log(`Hello, ${name}!`);\n\n// fetch works too: ask a real API for data\nconst res = await fetch('https://labverse-indol.vercel.app/api/lab5/students?present=true');\nconst present = await res.json();\nconsole.log(`${present.length} students are present today.`);\nconsole.table(present);\n",
   "/utils/math.js": "// Two small functions that main.js imports\n\nexport function average(numbers) {\n  const total = numbers.reduce((sum, n) => sum + n, 0);\n  return total / numbers.length;\n}\n\nexport function grade(mark) {\n  if (mark >= 85) return 'A';\n  if (mark >= 75) return 'B';\n  if (mark >= 65) return 'C';\n  return 'D';\n}\n",
   "/data/students.json": "[\n  {\n    \"name\": \"Mona Adel\",\n    \"marks\": [\n      90,\n      84,\n      88\n    ]\n  },\n  {\n    \"name\": \"Omar Khaled\",\n    \"marks\": [\n      70,\n      65,\n      78\n    ]\n  },\n  {\n    \"name\": \"Salma Hassan\",\n    \"marks\": [\n      95,\n      91,\n      89\n    ]\n  }\n]\n"
  }
 },
 {
  "id": "typescript",
  "name": "TypeScript",
  "tag": "Console",
  "description": "JavaScript with types. Programs that print to the terminal.",
  "iconName": "symbol-class",
  "color": "#3178c6",
  "open": "/main.ts",
  "files": {
   "/main.ts": "import { type Student, describe, topStudent } from './models/student';\n\nconst students: Student[] = [\n  { name: 'Mona Adel', year: 2, marks: [90, 84, 88] },\n  { name: 'Omar Khaled', year: 1, marks: [70, 65, 78] },\n  { name: 'Salma Hassan', year: 3, marks: [95, 91, 89] },\n];\n\nfor (const s of students) {\n  console.log(describe(s));\n}\n\nconst best = topStudent(students);\nconsole.log(`Top student: ${best.name}`);\n",
   "/models/student.ts": "// A type describes the shape of an object: TypeScript checks it while you type\nexport interface Student {\n  name: string;\n  year: number;\n  marks: number[];\n}\n\nexport function average(marks: number[]): number {\n  return marks.reduce((sum, m) => sum + m, 0) / marks.length;\n}\n\nexport function describe(s: Student): string {\n  return `${s.name} (year ${s.year}): average ${average(s.marks).toFixed(1)}`;\n}\n\nexport function topStudent(list: Student[]): Student {\n  return list.reduce((best, s) => (average(s.marks) > average(best.marks) ? s : best));\n}\n"
  }
 },
 {
  "id": "python",
  "name": "Python",
  "tag": "Console",
  "description": "Python 3 programs with input(), files and modules.",
  "iconName": "symbol-method",
  "color": "#4b8bbe",
  "open": "/main.py",
  "files": {
   "/main.py": "from helpers.grades import average, letter\n\nname = input(\"What is your name? \")\nprint(f\"Hello, {name}!\")\n\n# read the students from a file in the project\nwith open(\"data/students.csv\") as f:\n    next(f)  # skip the header line\n    for line in f:\n        student, *marks = line.strip().split(\",\")\n        marks = [int(m) for m in marks]\n        avg = average(marks)\n        print(f\"{student}: {avg:.1f} ({letter(avg)})\")\n",
   "/helpers/grades.py": "def average(marks):\n    return sum(marks) / len(marks)\n\n\ndef letter(mark):\n    if mark >= 85:\n        return \"A\"\n    if mark >= 75:\n        return \"B\"\n    if mark >= 65:\n        return \"C\"\n    return \"D\"\n",
   "/data/students.csv": "name,mark1,mark2,mark3\nMona Adel,90,84,88\nOmar Khaled,70,65,78\nSalma Hassan,95,91,89\n"
  }
 },
 {
  "id": "cpp",
  "name": "C++",
  "tag": "Console",
  "description": "C++ programs with cin and cout (the course subset of C++).",
  "iconName": "symbol-structure",
  "color": "#599eff",
  "open": "/main.cpp",
  "files": {
   "/main.cpp": "#include <iostream>\n#include <string>\nusing namespace std;\n\nint main() {\n    string name;\n    cout << \"What is your name? \";\n    cin >> name;\n\n    int n;\n    cout << \"How many numbers? \";\n    cin >> n;\n\n    int sum = 0;\n    for (int i = 1; i <= n; i++) {\n        sum += i;\n    }\n\n    cout << \"Hello, \" << name << \"!\" << endl;\n    cout << \"The sum of 1 to \" << n << \" is \" << sum << endl;\n    return 0;\n}\n"
  }
 },
 {
  "id": "sql",
  "name": "SQL",
  "tag": "Data",
  "description": "Create tables and ask questions about the data (SQLite).",
  "iconName": "database",
  "color": "#dad8d8",
  "open": "/queries.sql",
  "files": {
   "/schema.sql": "-- schema.sql runs first: it creates the tables and fills them\n\nCREATE TABLE students (\n  id INTEGER PRIMARY KEY,\n  name TEXT NOT NULL,\n  year INTEGER\n);\n\nCREATE TABLE marks (\n  student_id INTEGER REFERENCES students(id),\n  course TEXT,\n  mark INTEGER\n);\n\nINSERT INTO students (id, name, year) VALUES\n  (1, 'Mona Adel', 2),\n  (2, 'Omar Khaled', 1),\n  (3, 'Salma Hassan', 3);\n\nINSERT INTO marks (student_id, course, mark) VALUES\n  (1, 'Mobile', 90), (1, 'Web', 84),\n  (2, 'Mobile', 70), (2, 'Web', 65),\n  (3, 'Mobile', 95), (3, 'Web', 91);\n",
   "/queries.sql": "-- Press Run: schema.sql runs first, then this file. Every SELECT shows a table.\n\nSELECT * FROM students;\n\nSELECT name, year\nFROM students\nWHERE year >= 2\nORDER BY name;\n\nSELECT s.name, AVG(m.mark) AS average\nFROM students s\nJOIN marks m ON m.student_id = s.id\nGROUP BY s.name\nORDER BY average DESC;\n"
  }
 }
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
