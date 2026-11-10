/**
 * Lab 05 exercise list — plain data shared by the lab page, the progress API and /admin.
 * Keep ids stable: progress is stored by id. Parts 1–4 are reading parts and Parts 9–10 the
 * Expo project; the exercises live in Parts 5–8, from JSON up to a real check-in through the attendance API (the final exercise).
 * `block` is the Part number the exercise belongs to.
 */
import type { ExerciseMeta } from '../lab-02/meta.ts';

export const LAB_ID = 'lab-05';
const id = (name: string) => `${LAB_ID}--${name}`;

export const BLOCKS = [
  { n: 5, part: 5, time: '0–35', title: 'Data your app can read: objects and JSON' },
  { n: 6, part: 6, time: '35–75', title: 'What is an API? Requests and responses' },
  { n: 7, part: 7, time: '75–110', title: 'Waiting for the answer: await and errors' },
  { n: 8, part: 8, time: '110–155', title: 'Sending data: POST and the real check-in' },
] as const;

export const EXERCISES: ExerciseMeta[] = [
  { id: id('json-parts'), n: 1, block: 5, kind: 'match', title: 'Name every part of a JSON object' },
  { id: id('json-predict'), n: 2, block: 5, kind: 'predict', title: 'What will the code print?' },
  { id: id('json-parse'), n: 3, block: 5, kind: 'fix', title: 'Turn JSON text into an object' },
  { id: id('json-list'), n: 4, block: 5, kind: 'code', title: 'Show a class list from JSON' },
  { id: id('call-order'), n: 5, block: 6, kind: 'order', title: 'Put one API call in order' },
  { id: id('status-match'), n: 6, block: 6, kind: 'match', title: 'What does each status code mean?' },
  { id: id('first-get'), n: 7, block: 6, kind: 'code', title: 'Your first GET: load the class list' },
  { id: id('await-predict'), n: 8, block: 7, kind: 'predict', title: 'What does await do?' },
  { id: id('catch-error'), n: 9, block: 7, kind: 'fix', title: 'Catch the error' },
  { id: id('status-screen'), n: 10, block: 7, kind: 'code', title: 'Is attendance open?' },
  { id: id('post-echo'), n: 11, block: 8, kind: 'fix', title: 'Send your first POST' },
  { id: id('response-match'), n: 12, block: 8, kind: 'match', title: "Read the server's answer" },
  { id: id('check-in'), n: 13, block: 8, kind: 'code', title: 'Check in with the API', final: true },
];

export const EXERCISE_IDS = EXERCISES.map((e) => e.id);
export const FINAL_ID = id('check-in');
