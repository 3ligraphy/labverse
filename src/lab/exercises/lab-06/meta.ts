/**
 * Lab 06 exercise list — plain data shared by the lab page, the progress API and /admin.
 * Keep ids stable: progress is stored by id. `block` is the Part number the exercise belongs to.
 * Practice time per Part (the lab's 150-minute plan): 5 · 15 · 15 · 10 · 20 · 10 = 75 minutes.
 */
import type { ExerciseMeta } from '../lab-02/meta.ts';

export const LAB_ID = 'lab-06';
const id = (name: string) => `${LAB_ID}--${name}`;

export const BLOCKS = [
  { n: 1, part: 1, time: '0–13', title: 'Where your app keeps data' },
  { n: 2, part: 2, time: '13–43', title: 'Key-value storage: AsyncStorage and MMKV' },
  { n: 3, part: 3, time: '43–70', title: 'A database on the phone: SQLite' },
  { n: 4, part: 4, time: '70–90', title: 'Secrets: secure storage' },
  { n: 5, part: 5, time: '90–130', title: 'The cloud: Supabase' },
  { n: 6, part: 6, time: '130–150', title: 'Local and cloud together: offline basics' },
] as const;

export const EXERCISES: ExerciseMeta[] = [
  { id: id('where-data-lives'), n: 1, block: 1, kind: 'match', title: 'Where should this data live?' },
  { id: id('async-predict'), n: 2, block: 2, kind: 'predict', title: 'What does storage give back?' },
  { id: id('settings-async'), n: 3, block: 2, kind: 'code', title: 'Settings that survive a restart' },
  { id: id('settings-mmkv'), n: 4, block: 2, kind: 'code', title: 'The same setting with MMKV' },
  { id: id('sql-match'), n: 5, block: 3, kind: 'match', title: 'What does each SQL line do?' },
  { id: id('tasks-sqlite'), n: 6, block: 3, kind: 'code', title: 'A tasks database on the phone' },
  { id: id('secrets-predict'), n: 7, block: 4, kind: 'predict', title: 'Who can read the token?' },
  { id: id('token-store'), n: 8, block: 4, kind: 'code', title: 'A token service with SecureStore' },
  { id: id('supabase-parts'), n: 9, block: 5, kind: 'match', title: 'Keys and parts of Supabase' },
  { id: id('cloud-tasks'), n: 10, block: 5, kind: 'code', title: 'Tasks in the cloud' },
  { id: id('rls-predict'), n: 11, block: 5, kind: 'predict', title: 'Debug Row Level Security' },
  { id: id('avatar-upload'), n: 12, block: 5, kind: 'code', title: 'Upload a profile photo' },
  { id: id('sync-order'), n: 13, block: 6, kind: 'order', title: 'The sync steps, in order' },
  { id: id('offline-sync'), n: 14, block: 6, kind: 'code', title: 'Offline-ready tasks', final: true },
];

export const EXERCISE_IDS = EXERCISES.map((e) => e.id);
export const FINAL_ID = id('offline-sync');
