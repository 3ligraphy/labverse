/**
 * Lab 07 exercise list — plain data shared by the lab page, the progress API and /admin.
 * Keep ids stable: progress is stored by id. `block` is the Part number the exercise belongs to.
 * The lab is 145 minutes: 10 parts (140) + a 5-minute break at the end of Part 4. Everything runs in the browser:
 * nothing is installed on the lab PCs (tests and Maestro flows run on the page, src/lab/runtime/testing.ts and
 * src/lab/engine/maestro.ts). Practice time per Part: 4 · 3 · 7 · 22 · 4 · 21 · 10 · 8 · 8 · 9 = 96 minutes.
 */
import type { ExerciseMeta } from '../lab-02/meta.ts';

export const LAB_ID = 'lab-07';
const id = (name: string) => `${LAB_ID}--${name}`;

export const BLOCKS = [
  { n: 1, part: 1, time: '0–7', title: 'Meet the Smart QR Scanner' },
  { n: 2, part: 2, time: '7–15', title: 'The project in your browser' },
  { n: 3, part: 3, time: '15–27', title: 'Camera and haptics: how they work' },
  { n: 4, part: 4, time: '27–57', title: 'Build the scanner (and a 5-minute break)' },
  { n: 5, part: 5, time: '57–69', title: 'Testing: three tools, three layers' },
  { n: 6, part: 6, time: '69–94', title: 'Unit and component tests' },
  { n: 7, part: 7, time: '94–109', title: 'Maestro: test the whole journey' },
  { n: 8, part: 8, time: '109–121', title: 'Deployment: EAS Build, Submit, Update' },
  { n: 9, part: 9, time: '121–134', title: 'EAS Build: configure and watch a real build' },
  { n: 10, part: 10, time: '134–145', title: 'Final challenge and recap' },
] as const;

export const EXERCISES: ExerciseMeta[] = [
  { id: id('tools-jobs'), n: 1, block: 1, kind: 'match', title: 'Which tool does which job?' },
  { id: id('expo-go-predict'), n: 2, block: 2, kind: 'predict', title: 'Expo Go or a new build?' },
  { id: id('permission-predict'), n: 3, block: 3, kind: 'predict', title: 'What does the camera give your code?' },
  { id: id('haptics-match'), n: 4, block: 3, kind: 'match', title: 'Which vibration for which moment?' },
  { id: id('step-a-permission'), n: 5, block: 4, kind: 'code', title: 'Step A · Ask for the camera' },
  { id: id('step-b-scan-once'), n: 6, block: 4, kind: 'code', title: 'Step B · Read a code, once' },
  { id: id('step-c-feedback'), n: 7, block: 4, kind: 'code', title: 'Step C · Feel the result' },
  { id: id('step-d-flip'), n: 8, block: 4, kind: 'code', title: 'Step D · Flip the camera' },
  { id: id('test-layers'), n: 9, block: 5, kind: 'match', title: 'Which test catches this bug?' },
  { id: id('jest-failure'), n: 10, block: 6, kind: 'predict', title: 'Read a failing test' },
  { id: id('unit-tests'), n: 11, block: 6, kind: 'code', title: 'Write the two missing unit tests' },
  { id: id('rntl-match'), n: 12, block: 6, kind: 'match', title: 'Find, press, check: the test tools' },
  { id: id('test-order'), n: 13, block: 6, kind: 'order', title: 'A component test, in order' },
  { id: id('component-tests'), n: 14, block: 6, kind: 'code', title: 'Write the two missing component tests' },
  { id: id('maestro-order'), n: 15, block: 7, kind: 'order', title: 'The Maestro flow, in order' },
  { id: id('maestro-run'), n: 16, block: 7, kind: 'code', title: 'Finish the flow and run it' },
  { id: id('update-or-build'), n: 17, block: 8, kind: 'predict', title: 'eas update or a new build?' },
  { id: id('config-match'), n: 18, block: 8, kind: 'match', title: 'What does each setting do?' },
  { id: id('eas-config'), n: 19, block: 9, kind: 'code', title: 'Get the project ready for EAS Build' },
  { id: id('eas-predict'), n: 20, block: 9, kind: 'predict', title: 'What will this build give you?' },
  { id: id('wifi-name'), n: 21, block: 10, kind: 'code', title: 'Final: the Wi-Fi name, never the password', final: true },
];

export const EXERCISE_IDS = EXERCISES.map((e) => e.id);
export const FINAL_ID = id('wifi-name');
