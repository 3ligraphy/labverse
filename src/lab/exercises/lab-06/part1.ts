/** Lab 06 · Part 1 — where your app keeps data. Exercise 1 (5 min). */
import type { MatchExercise } from '../types.ts';
import { LAB_ID } from './meta.ts';

const id = (name: string) => `${LAB_ID}--${name}`;

export const ex01: MatchExercise = {
  id: id('where-data-lives'),
  n: 1,
  title: 'Where should this data live?',
  minutes: 5,
  level: 1,
  kind: 'match',
  prompt: 'Six pieces of data from one tasks app. Drag each one to the place it should be stored. One piece should not be stored at all: leave it out.',
  pairs: [
    { chip: 'Dark mode: on or off', target: 'Key-value storage on the phone (AsyncStorage or MMKV)', why: 'One small setting under one key. It must survive a restart, and it is not a secret.' },
    { chip: 'The sign-in token', target: 'Secure storage on the phone (SecureStore)', why: 'A token lets anyone act as the user. It must be encrypted on the phone.' },
    { chip: '300 tasks you search, sort and filter', target: 'A database on the phone (SQLite)', why: 'Many rows with the same columns, read with conditions (WHERE, ORDER BY). That is what a database does.' },
    { chip: 'A profile photo', target: 'File storage in the cloud (Supabase Storage)', why: 'A photo is a file (bytes), not a row. File storage keeps it and gives it a URL.' },
    { chip: 'Every user’s profile, the same on every phone', target: 'A database in the cloud (Supabase)', why: 'Data that many phones share must live on a server that every phone can reach.' },
    { chip: 'The words typed in a search box', target: 'Memory only (useState)', why: 'It is needed only while the screen is open. When the app closes it can be lost.' },
  ],
  decoys: [{ chip: 'The user’s password, to sign in again later', why: 'Never store a password on the phone. Sign in once and store the token the server gives you, in SecureStore.' }],
  hints: [
    'Ask two questions for each piece: must it survive closing the app? Must other phones see it?',
    'Secrets (tokens) go to SecureStore. Files (photos) go to file storage. Many rows you search go to a database.',
    'The search-box text is lost when the app closes, and that is fine: it lives in memory. The password is never stored.',
  ],
  solution: {
    explain: 'Each kind of data has one right place: how long it must last, who must see it, and whether it is a secret decide it.',
    text: 'Dark mode → key-value storage · sign-in token → SecureStore · 300 tasks → SQLite · profile photo → Supabase Storage · every user’s profile → Supabase database · search-box text → useState · the password → nowhere (keep the token instead).',
  },
  success: 'This lab follows exactly this map: Part 2 key-value storage, Part 3 SQLite, Part 4 SecureStore, Part 5 Supabase (database and storage), Part 6 both together.',
};
