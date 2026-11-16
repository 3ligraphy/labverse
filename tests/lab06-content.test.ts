// Lab 06's page: the parts add up to the 150-minute plan, every <Exercise> and <Demo> exists and appears in order,
// every component it uses is available to lab pages, and the final project opens in the Code Editor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mdx = readFileSync(new URL('../src/content/labs/lab-06.mdx', import.meta.url), 'utf8');
const page = readFileSync(new URL('../src/pages/mobile-development/labs/[id].astro', import.meta.url), 'utf8');
const { parseLabOutline, minutes, formatMinutes } = await import('../src/lib/lab.ts');
const { EXERCISE_IDS } = await import('../src/lab/exercises/lab-06/meta.ts');
const { demos } = await import('../src/lab/exercises/lab-06/demos.ts');

test('the seven parts take 13 + 30 + 27 + 20 + 40 + 20 + 0 = 150 minutes', () => {
  const parts = parseLabOutline(mdx);
  assert.deepEqual(parts.map((p) => p.n), ['1', '2', '3', '4', '5', '6', '7']);
  assert.deepEqual(parts.map((p) => minutes(p.time)), [13, 30, 27, 20, 40, 20, 0]);
  const total = parts.reduce((a, p) => a + minutes(p.time), 0);
  assert.equal(total, 150);
  assert.equal(formatMinutes(total), '2 h 30 min');
  assert.match(mdx, /estimatedTime: '2 h 30 min'/);
});

test('every exercise of the registry is on the page once, in order; every demo exists', () => {
  const used = [...mdx.matchAll(/<Exercise id="([^"]+)" \/>/g)].map((m) => m[1]);
  assert.deepEqual(used, EXERCISE_IDS);
  const demoIds = [...mdx.matchAll(/<Demo id="([^"]+)" \/>/g)].map((m) => m[1]);
  assert.ok(demoIds.length >= 5);
  for (const id of demoIds) assert.ok(demos[id], `demo ${id} exists`);
  assert.deepEqual(new Set(demoIds), new Set(Object.keys(demos)), 'every demo is shown once');
});

test('every component the lab uses is available to lab pages', () => {
  const tags = new Set([...mdx.matchAll(/<([A-Z][A-Za-z]+)[\s>/]/g)].map((m) => m[1]));
  const map = /const components = \{([\s\S]*?)\};/.exec(page)![1];
  for (const tag of tags) assert.ok(new RegExp(`\\b${tag}\\b`).test(map), `<${tag}> is in the lab page's components`);
});

test('the final project opens in the Code Editor, and the plan is built from the exercises', async () => {
  assert.match(mdx, /<OpenInCodeEditor project="lab06-tasks" \/>/);
  const { LAB06_PROJECT } = await import('../src/ide/core/course-lab06.ts');
  const files = LAB06_PROJECT.files();
  for (const f of ['/App.tsx', '/lib/supabase.ts', '/lib/largeSecureStore.ts', '/lib/preferences.ts', '/lib/db.ts', '/lib/sync.ts', '/supabase/schema.sql', '/.env', '/GUIDE.md']) assert.ok(files[f], `${f} is in the project`);
  assert.doesNotMatch(files['/.env'], /^[A-Z_]+=\s*sb_secret_/m, 'no secret key in the app');
  assert.match(files['/.env'], /^EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_/m);
  assert.match(files['/supabase/schema.sql'], /enable row level security/);
  assert.match(files['/GUIDE.md'], /## Step 1[\s\S]*## Step 6/);
});

test('no caching topics (out of scope for this lab)', () => {
  for (const banned of [/TanStack/i, /React Query/i, /stale-while-revalidate/i, /staleTime/i, /cache invalidation/i]) assert.doesNotMatch(mdx, banned);
});
