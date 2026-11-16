// Lab 06's page: the parts add up to the 150-minute plan, every <Exercise> and <Demo> exists and appears in order,
// every component it uses is available to lab pages, and the final project opens in the Code Editor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';

const mdx = readFileSync(new URL('../src/content/labs/lab-06.mdx', import.meta.url), 'utf8');
const page = readFileSync(new URL('../src/pages/mobile-development/labs/[id].astro', import.meta.url), 'utf8');
const { parseLabOutline, minutes, formatMinutes } = await import('../src/lib/lab.ts');
const { EXERCISE_IDS } = await import('../src/lab/exercises/lab-06/meta.ts');
const { demos } = await import('../src/lab/exercises/lab-06/demos.ts');

test('the seven parts take 14 + 30 + 27 + 20 + 68 + 21 + 0 = 180 minutes (3 hours at most)', () => {
  const parts = parseLabOutline(mdx);
  assert.deepEqual(parts.map((p) => p.n), ['1', '2', '3', '4', '5', '6', '7']);
  assert.deepEqual(parts.map((p) => minutes(p.time)), [14, 30, 27, 20, 68, 21, 0]);
  const total = parts.reduce((a, p) => a + minutes(p.time), 0);
  assert.equal(total, 180);
  assert.equal(formatMinutes(total), '3 h');
  assert.match(mdx, /estimatedTime: '3 h'/);
});

test('every part has a real screenshot; each one exists, is small and has alt text', () => {
  const parts = mdx.split(/<Part n="/).slice(1, 7); // Parts 1–6
  parts.forEach((p, i) => assert.match(p, /<Shot[\s\S]*?\/>/, `Part ${i + 1} has a real screenshot`));
  const shots = [...mdx.matchAll(/<Shot([\s\S]*?)\/>/g)].map((m) => m[1]);
  assert.ok(shots.length >= 12, `${shots.length} screenshots`);
  const srcs = shots.flatMap((s) => [...s.matchAll(/src[:=]\s*["']([^"']+)["']/g)].map((m) => m[1]));
  let total = 0;
  for (const src of srcs) {
    assert.match(src, /^\/labs\/lab-06\/[\w-]+\.webp$/, `${src} is a webp in /labs/lab-06/`);
    const file = new URL(`../public${src}`, import.meta.url);
    assert.ok(existsSync(file), `${src} exists`);
    const size = statSync(file).size;
    assert.ok(size <= 160 * 1024, `${src} is ${Math.round(size / 1024)} KB (at most 160 KB)`);
    total += size;
  }
  assert.ok(total <= 2.5 * 1024 * 1024, `all screenshots together: ${Math.round(total / 1024)} KB (at most 2.5 MB)`);
  for (const s of shots) assert.match(s, /alt[:=]\s*["'][^"']{12,}/, 'every screenshot has a real alt text');
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

test('the Lab 06 visuals for real screenshots, RLS, Auth and Realtime are available to lab pages', () => {
  const map = /const components = \{([\s\S]*?)\};/.exec(page)![1];
  for (const name of ['Shot', 'RlsSimulator', 'AuthFlow', 'RealtimeFlow']) {
    assert.match(map, new RegExp(`\\b${name}\\b`), `${name} is in the components map`);
    assert.match(page, new RegExp(`import ${name} from '@/components/lab/interactive/${name}.astro'`), `${name} is imported`);
  }
});
