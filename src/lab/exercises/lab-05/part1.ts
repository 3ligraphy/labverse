/** Lab 05 · Part 5 — data your app can read: objects, arrays and JSON. Exercises 1–4 (3 small, 1 big). */
import type { CodeExercise, MatchExercise, PredictExercise } from '../types.ts';
import { el, imports } from '../helpers.ts';
import { LAB_ID } from './meta.ts';
import { code, shownIn } from './shared.ts';

const id = (name: string) => `${LAB_ID}--${name}`;

export const ex01: MatchExercise = {
  id: id('json-parts'),
  n: 1,
  title: 'Name every part of a JSON object',
  minutes: 4,
  level: 1,
  kind: 'match',
  prompt: 'This is one student as **JSON**:\n`{ "name": "Mona Adel", "year": 2, "present": true, "courses": ["Mobile", "Web"], "address": { "city": "Cairo" } }`\nDrag each piece onto what it is.',
  pairs: [
    { chip: '"name"', target: 'a key: the label of a value', why: 'A key is always text in double quotes. It names the value written after the colon.' },
    { chip: '"Mona Adel"', target: 'a string: text', why: 'Text values are wrapped in double quotes.' },
    { chip: '2', target: 'a number', why: 'Numbers are written without quotes, so you can do maths with them.' },
    { chip: 'true', target: 'a boolean: true or false', why: '`true` and `false` have no quotes. They mean yes and no.' },
    { chip: '["Mobile", "Web"]', target: 'an array: a list of values', why: 'Square brackets hold a list. Commas separate the items.' },
    { chip: '{ "city": "Cairo" }', target: 'an object inside the object', why: 'Curly braces hold keys and values. An object can hold another object.' },
  ],
  decoys: [{ chip: "'Mona Adel'", why: 'JSON allows double quotes only. Single quotes make the whole text invalid JSON.' }],
  mono: true,
  hints: [
    'Look at the brackets first: `[ ]` is a list, `{ }` is an object.',
    'Anything in double quotes is a string, except the key before the colon.',
    'Values without quotes are numbers, or `true` / `false`.',
  ],
  success: 'Every API in this lab answers with exactly these six building blocks. Once you can name them, you can read any API answer.',
};

export const ex02: PredictExercise = {
  id: id('json-predict'),
  n: 2,
  title: 'What will the code print?',
  minutes: 4,
  level: 1,
  kind: 'predict',
  prompt: 'Read each piece of code and choose what `console.log` prints.',
  questions: [
    {
      code: `const student = { name: 'Mona Adel', present: true };
console.log(student.name);`,
      question: 'What is printed?',
      options: [
        { text: 'Mona Adel', correct: true, why: '`student.name` reads the value stored under the key `name`.' },
        { text: 'name', why: 'That is the key. The dot gives you the value stored under it.' },
        { text: 'undefined', why: '`undefined` only appears when the key does not exist.' },
      ],
    },
    {
      code: `const text = JSON.stringify({ name: 'Mona', present: true });
console.log(text);`,
      question: 'What is printed?',
      options: [
        { text: '{"name":"Mona","present":true}', correct: true, why: '`JSON.stringify` turns an object into JSON text: double quotes around every key and every string, no spaces.' },
        { text: "{ name: 'Mona', present: true }", why: 'That is how JavaScript code writes the object. JSON text always uses double quotes.' },
        { text: '[object Object]', why: 'You get that from `String(obj)`, not from `JSON.stringify`.' },
      ],
    },
    {
      code: `const student = JSON.parse('{"name":"Mona","courses":["Mobile","Web"]}');
console.log(student.courses[1]);`,
      question: 'What is printed?',
      options: [
        { text: 'Web', correct: true, why: '`JSON.parse` makes a real object. `courses` is an array, and `[1]` is its second item: counting starts at 0.' },
        { text: 'Mobile', why: '`[0]` is the first item. `[1]` is the second.' },
        { text: 'undefined', why: 'After `JSON.parse` the text is an object, so `.courses` works.' },
      ],
    },
    {
      code: `const text = '{"present":true}';
console.log(text.present);`,
      question: 'What is printed?',
      options: [
        { text: 'undefined', correct: true, why: '`text` is still a string. A string has no key called `present`: turn it into an object first with `JSON.parse(text)`.' },
        { text: 'true', why: 'That would be right after `JSON.parse(text)`.' },
        { text: 'an error', why: 'Reading a key that does not exist does not throw an error. It gives `undefined`.' },
      ],
    },
  ],
  hints: [
    'A dot after an object reads the value of that key: `student.name`.',
    '`JSON.stringify` makes text; `JSON.parse` makes an object.',
    'Text that looks like JSON is still just text until you parse it.',
  ],
  success: 'The last question is the bug you will meet most: using JSON **text** as if it were an object. The fix is always `JSON.parse` (or `res.json()`).',
};

const STUDENT_TEXT = `'{"name":"Mona Adel","studentId":"240001","present":true}'`;

export const ex03: CodeExercise = {
  id: id('json-parse'),
  n: 3,
  title: 'Turn JSON text into an object',
  minutes: 5,
  level: 2,
  kind: 'fix',
  frame: 'phone',
  entry: 'App.tsx',
  prompt: 'A server sent this student as **JSON text**. Turn it into an object with `JSON.parse`, then show the name, the ID, and **Present** or **Absent**.',
  files: {
    'App.tsx': `import { Text, View } from 'react-native';

// This is what a server sends: JSON text (a string), not an object yet
const text = ${STUDENT_TEXT};

// 1. Turn the text into an object
const student = text;

export default function App() {
  return (
    <View className="flex-1 items-center justify-center gap-2 bg-white p-6">
      <Text className="text-2xl font-bold">{student.name}</Text>
      <Text className="text-slate-500">ID: {student.studentId}</Text>
      {/* 2. Show "Present" when student.present is true, otherwise "Absent" */}
    </View>
  );
}
`,
  },
  checks: [
    {
      id: 'parse',
      label: 'turns the text into an object with JSON.parse',
      fail: 'Replace `const student = text;` with `const student = JSON.parse(text);`',
      static: (c) => /JSON\.parse\s*\(\s*text\s*\)/.test(code(c.files)),
    },
    {
      id: 'name',
      label: 'shows the name and the ID',
      fail: 'The screen should show **Mona Adel** and **240001**. Are you still reading keys from the text instead of the object?',
      run: async (c) => {
        const t = await c.app.text();
        return /Mona Adel/.test(t) && /240001/.test(t);
      },
    },
    {
      id: 'present',
      label: 'shows Present (Mona is present)',
      fail: 'Add `<Text>{student.present ? \'Present\' : \'Absent\'}</Text>` under the ID.',
      run: async (c) => {
        const t = await c.app.text();
        if (/Absent/.test(t) && !/Present/.test(t)) return '`student.present` is `true`, so the screen should say **Present**.';
        return /\bPresent\b/.test(t);
      },
    },
  ],
  hints: [
    '`JSON.parse(text)` reads JSON text and gives back a JavaScript object.',
    'Change one line: `const student = JSON.parse(text);`',
    'For the last line: `<Text>{student.present ? \'Present\' : \'Absent\'}</Text>`. `? :` picks the first text when the value is true, the second when it is false.',
  ],
  success: 'Every API answer arrives as text. `JSON.parse` is the step that turns it into an object you can read with a dot. Soon `res.json()` will do this step for you.',
};

const CLASS_JSON = `\`[
  { "id": 1, "name": "Mona Adel", "present": true },
  { "id": 2, "name": "Omar Khaled", "present": false },
  { "id": 3, "name": "Salma Hassan", "present": true }
]\``;

export const ex04: CodeExercise = {
  id: id('json-list'),
  n: 4,
  title: 'Show a class list from JSON',
  minutes: 10,
  level: 3,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  prompt: 'Turn the JSON text into an array, then draw one card per student with a `FlatList`: the name and a badge, **Present** in green or **Absent** in red.',
  files: {
    'App.tsx': `import { FlatList, Text, View } from 'react-native';

// JSON text with three students: a server sends exactly this
const json = ${CLASS_JSON};

// 1. Turn the JSON text into an array of student objects
const students = [];

export default function App() {
  return (
    <View className="flex-1 bg-slate-100 p-4 pt-12">
      <Text className="mb-3 text-2xl font-bold">Class list</Text>
      {/* 2. A FlatList: data={students}, keyExtractor gives each row a key, renderItem draws one card */}
      {/* 3. Each card: the name, and a badge "Present" (green) or "Absent" (red) */}
    </View>
  );
}
`,
  },
  target: {
    caption: 'The goal: one card per student, with a green or red badge',
    html: `<div style="font:13px system-ui;padding:14px;background:#f1f5f9;height:100%;box-sizing:border-box"><b style="font-size:17px">Class list</b>
<div style="display:flex;justify-content:space-between;align-items:center;background:#fff;border-radius:10px;padding:10px;margin-top:10px">Mona Adel <span style="background:#22c55e;color:#fff;border-radius:99px;padding:2px 8px">Present</span></div>
<div style="display:flex;justify-content:space-between;align-items:center;background:#fff;border-radius:10px;padding:10px;margin-top:8px">Omar Khaled <span style="background:#ef4444;color:#fff;border-radius:99px;padding:2px 8px">Absent</span></div>
<div style="display:flex;justify-content:space-between;align-items:center;background:#fff;border-radius:10px;padding:10px;margin-top:8px">Salma Hassan <span style="background:#22c55e;color:#fff;border-radius:99px;padding:2px 8px">Present</span></div></div>`,
  },
  checks: [
    {
      id: 'parse',
      label: 'turns the JSON text into an array',
      fail: 'Replace `const students = [];` with `const students = JSON.parse(json);`',
      static: (c) => /JSON\.parse\s*\(\s*json\s*\)/.test(code(c.files)),
    },
    {
      id: 'list',
      label: 'draws the list with a FlatList',
      fail: 'Add `<FlatList data={students} keyExtractor={(s) => String(s.id)} renderItem={({ item }) => …} />` and import `FlatList`.',
      static: (c) => el(c.file(), 'FlatList').length > 0 && Boolean(imports(c.file()).get('react-native')?.has('FlatList')),
    },
    {
      id: 'names',
      label: 'shows all three names',
      fail: 'Show `{item.name}` inside renderItem. All three students should be on the screen.',
      run: async (c) => {
        const t = await c.app.text();
        return ['Mona Adel', 'Omar Khaled', 'Salma Hassan'].every((n) => t.includes(n));
      },
    },
    {
      id: 'badges',
      label: 'two Present badges and one Absent badge',
      fail: 'Each card needs `{item.present ? \'Present\' : \'Absent\'}`: Mona and Salma are present, Omar is absent.',
      run: async (c) => (await c.app.count({ rn: 'Text', text: /^Present$/ })) === 2 && (await c.app.count({ rn: 'Text', text: /^Absent$/ })) === 1,
    },
    {
      id: 'colors',
      label: 'Present is green, Absent is red',
      fail: 'Colour the badge: `className={item.present ? \'bg-green-500 …\' : \'bg-red-500 …\'}` (or the text colour: `text-green-600` / `text-red-600`).',
      run: async (c) => (await shownIn(c.app, /^Present$/, 'green')) && (await shownIn(c.app, /^Absent$/, 'red')),
    },
  ],
  hints: [
    '`const students = JSON.parse(json);` gives an array of three objects.',
    '`<FlatList data={students} keyExtractor={(s) => String(s.id)} renderItem={({ item }) => …} />`. Inside renderItem, `item` is one student.',
    'One card: `<View className="mb-2 flex-row justify-between rounded-xl bg-white p-4"><Text>{item.name}</Text><Text className={item.present ? \'rounded-full bg-green-500 px-2 text-white\' : \'rounded-full bg-red-500 px-2 text-white\'}>{item.present ? \'Present\' : \'Absent\'}</Text></View>`',
  ],
  success: 'This is the shape of most API screens: JSON text comes in, `JSON.parse` makes an array, and `FlatList` draws one row per item. In Part 6 the same JSON comes from a real server.',
};
