/** Lab 06 helpers for checks: wait for the screen, read what the preview phone stored (the Device storage panel's data). */
import type { DeviceSection, PreviewDriver } from '../../runtime/protocol.ts';

/** The JavaScript of one file without comments, so a TODO comment never counts as code. */
export const code = (files: Record<string, string>, file = 'App.tsx') => (files[file] ?? '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
/** Every file's code (comments removed). */
export const allCode = (files: Record<string, string>) => Object.keys(files).map((f) => code(files, f)).join('\n');

export const sleep = (app: PreviewDriver, ms: number) => app.wait(ms);

/** Asks `test` again and again (storage answers and network replies take a moment) until it passes or time is up. */
export async function until<T>(app: PreviewDriver, read: () => Promise<T>, test: (value: T) => boolean, ms = 6000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const value = await read();
    if (test(value) || Date.now() > end) return value;
    await app.wait(150);
  }
}

export const waitForText = (app: PreviewDriver, test: (text: string) => boolean, ms = 6000) => until(app, () => app.text(), test, ms);

export async function sections(app: PreviewDriver): Promise<DeviceSection[]> {
  return (await app.storage?.())?.sections ?? [];
}

/** AsyncStorage: the text saved under `key`, or null. */
export async function asyncValue(app: PreviewDriver, key: string): Promise<string | null> {
  const s = (await sections(app)).find((x) => x.id === 'async-storage');
  return s?.rows?.find((r) => r.key === key)?.value ?? null;
}

/** MMKV (default instance): the row saved under `key` (value as text, and its type). */
export async function mmkvRow(app: PreviewDriver, key: string, id = 'mmkv.default') {
  const s = (await sections(app)).find((x) => x.id === `mmkv:${id}`);
  return s?.rows?.find((r) => r.key === key) ?? null;
}

/** SecureStore: the keys that hold a value. */
export async function secureKeys(app: PreviewDriver): Promise<string[]> {
  const s = (await sections(app)).find((x) => x.id === 'secure-store');
  return s?.rows?.map((r) => r.key) ?? [];
}

/** A SQLite table on the phone, as objects (column → value), or null when the database or table does not exist. */
export async function sqliteRows(app: PreviewDriver, database: string, table: string): Promise<Record<string, unknown>[] | null> {
  const s = (await sections(app)).find((x) => x.id === `sqlite:${database}`);
  const t = s?.tables?.find((x) => x.name === table);
  return t ? t.rows.map((row) => Object.fromEntries(t.columns.map((c, i) => [c, row[i]]))) : null;
}

/** A table of the practice Supabase project (every user's rows: what the cloud really holds). */
export async function cloudRows(app: PreviewDriver, table: string): Promise<Record<string, unknown>[]> {
  const s = (await sections(app)).find((x) => x.id === 'supabase-db');
  const t = s?.tables?.find((x) => x.name === `public.${table}`);
  return t ? t.rows.map((row) => Object.fromEntries(t.columns.map((c, i) => [c, row[i]]))) : [];
}

/** Files in the practice Supabase project's buckets, as "bucket/path". */
export async function cloudFiles(app: PreviewDriver): Promise<string[]> {
  const s = (await sections(app)).find((x) => x.id === 'supabase-storage');
  return s?.files?.map((f) => f.path) ?? [];
}

/** The practice project's student account (the same one the starter code signs in with). */
export const STUDENT = { email: 'student@practice.dev', password: 'practice-123', id: 'c0ffee00-0000-4000-8000-000000000001' };

/** lib/supabase.ts of the exercises: the official Expo quickstart client, pointed at the practice project. */
export const SUPABASE_CLIENT = `import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import 'expo-sqlite/localStorage/install';

// The lab's practice project: it lives in this preview, no account needed.
// In your own app these two come from .env:
//   process.env.EXPO_PUBLIC_SUPABASE_URL and process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const supabaseUrl = 'https://practice.supabase.co';
const supabasePublishableKey = 'sb_publishable_practice';

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: localStorage, // the session is saved on the phone, so the user stays signed in
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
`;
