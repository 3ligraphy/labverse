/**
 * Lab 03 exercise list — plain data shared by the lab page, the progress API and /admin.
 * Keep ids stable: progress is stored by id. Lab 03 started as a builder lab, so it keeps that lab's tracking
 * key (sessions, check-ins and hand-ins carry on) and the ids of its four original exercises.
 */
import type { ExerciseMeta } from '../lab-02/meta.ts';

export const LAB_ID = 'mobile-development--lab-03';
const id = (name: string) => `${LAB_ID}--${name}`;

export const BLOCKS = [
  { n: 1, part: 1, time: '0–35', title: 'Start the semester app' },
  { n: 2, part: 1, time: '35–90', title: 'A UI system with NativeWind' },
  { n: 3, part: 2, time: '90–125', title: 'Feature architecture & aliases' },
  { n: 4, part: 2, time: '125–180', title: 'Typed navigation' },
  { n: 5, part: 3, time: '180–215', title: 'Dev, staging & production' },
] as const;

export const EXERCISES: ExerciseMeta[] = [
  { id: id('brief-match'), n: 1, block: 1, kind: 'match', title: 'Read a product brief' },
  { id: id('exercise-project-card'), n: 2, block: 1, kind: 'code', title: 'Visualize the semester app idea' },
  { id: id('class-match'), n: 3, block: 2, kind: 'match', title: 'Classes with a purpose' },
  { id: id('exercise-ui'), n: 4, block: 2, kind: 'code', title: 'Accessible save card' },
  { id: id('button-fix'), n: 5, block: 2, kind: 'fix', title: 'Fix the AppButton primitive' },
  { id: id('folders-match'), n: 6, block: 3, kind: 'match', title: 'Where does each file live?' },
  { id: id('imports-predict'), n: 7, block: 3, kind: 'predict', title: 'Which imports are allowed?' },
  { id: id('alias-code'), n: 8, block: 3, kind: 'code', title: 'Replace fragile paths with @/' },
  { id: id('navigator-predict'), n: 9, block: 4, kind: 'predict', title: 'Stack, tabs or drawer?' },
  { id: id('stack-code'), n: 10, block: 4, kind: 'code', title: 'A typed stack with a route parameter' },
  { id: id('calls-match'), n: 11, block: 4, kind: 'match', title: 'What does each navigation call do?' },
  { id: id('tabs-code'), n: 12, block: 4, kind: 'code', title: 'Bottom tabs with icons' },
  { id: id('exercise-navigation'), n: 13, block: 4, kind: 'code', title: 'Jump into a nested tab' },
  { id: id('env-predict'), n: 14, block: 5, kind: 'predict', title: 'Public or secret?' },
  { id: id('exercise-environment'), n: 15, block: 5, kind: 'code', title: 'Make the environment visible', final: true },
];

export const EXERCISE_IDS = EXERCISES.map((e) => e.id);
export const FINAL_ID = id('exercise-environment');
