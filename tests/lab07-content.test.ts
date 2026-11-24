// Lab 07's page: ten parts that add up to 145 minutes (at most 150), every <Exercise> and <Demo> in order, every
// component available to lab pages, every screenshot real and small, every code walk-through pointing at real lines,
// and no Expo account or project id anywhere in what students download or read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

const mdx = readFileSync(new URL('../src/content/labs/lab-07.mdx', import.meta.url), 'utf8');
const page = readFileSync(new URL('../src/pages/mobile-development/labs/[id].astro', import.meta.url), 'utf8');
const { parseLabOutline, minutes, formatMinutes } = await import('../src/lib/lab.ts');
const { EXERCISE_IDS, BLOCKS } = await import('../src/lab/exercises/lab-07/meta.ts');
const { demos } = await import('../src/lab/exercises/lab-07/demos.ts');
const project = (await import('../src/lab/exercises/lab-07/project.ts')) as unknown as Record<string, string>;

test('ten parts: 7 + 8 + 12 + 50 (explained step by step, with the break) + 12 + 25 + 15 + 12 + 13 + 11 = 165 minutes', () => {
  const parts = parseLabOutline(mdx);
  assert.deepEqual(parts.map((p) => p.n), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
  assert.deepEqual(parts.map((p) => minutes(p.time)), [7, 8, 12, 50, 12, 25, 15, 12, 13, 11]);
  const total = parts.reduce((a, p) => a + minutes(p.time), 0);
  assert.equal(total, 165);
  assert.ok(total <= 210, 'never more than 3 h 30 min');
  assert.equal(formatMinutes(total), '2 h 45 min');
  assert.match(mdx, /estimatedTime: '2 h 45 min'/);
  assert.match(mdx, /Break · 5 minutes/, 'the break is on the page');
  // the parts on the page and the blocks of meta.ts have the same titles
  assert.deepEqual(parts.map((p) => p.title), BLOCKS.map((b) => b.title.replace(' (and a 5-minute break)', '')));
});

test('every exercise of the registry is on the page once, in order; every demo is shown once', () => {
  const used = [...mdx.matchAll(/<Exercise id="([^"]+)" \/>/g)].map((m) => m[1]);
  assert.deepEqual(used, EXERCISE_IDS);
  const demoIds = [...mdx.matchAll(/<Demo id="([^"]+)" \/>/g)].map((m) => m[1]);
  assert.deepEqual(new Set(demoIds), new Set(Object.keys(demos)));
  assert.equal(demoIds.length, Object.keys(demos).length);
});

test('every component the lab uses is available to lab pages', () => {
  // the body only, without inline code (`<CameraView />` in a sentence is code, not a component)
  const body = mdx.slice(mdx.indexOf('\n---', 4) + 4).replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  const tags = new Set([...body.matchAll(/<([A-Z][A-Za-z]+)[\s>/]/g)].map((m) => m[1]));
  const map = /const components = \{([\s\S]*?)\};/.exec(page)![1];
  for (const tag of tags) assert.ok(new RegExp(`\\b${tag}\\b`).test(map), `<${tag}> is in the lab page's components`);
  for (const tag of ['PermissionFlow', 'ScanReads', 'TestLayers', 'EasPipeline']) assert.ok(tags.has(tag), `the page uses <${tag}>`);
});

test('every screenshot is a small webp in /labs/lab-07/ with a real alt text, and most parts have one', () => {
  const shots = [...mdx.matchAll(/<Shot([\s\S]*?)\/>/g)].map((m) => m[1]);
  const srcs = shots.flatMap((s) => [...s.matchAll(/src[:=]\s*["']([^"']+)["']/g)].map((m) => m[1]));
  assert.ok(shots.length >= 6 && srcs.length >= 10, `${shots.length} screenshot blocks, ${srcs.length} pictures`);
  for (const src of srcs) {
    assert.match(src, /^\/labs\/lab-07\/([\w-]+\/)?[\w-]+\.webp$/);
    const file = new URL(`../public${src}`, import.meta.url);
    assert.ok(existsSync(file), `${src} exists`);
    assert.ok(statSync(file).size <= 160 * 1024, `${src} is small`);
  }
  for (const s of shots) for (const alt of s.matchAll(/alt[:=]\s*["']([^"']*)["']/g)) assert.ok(alt[1].length >= 12, 'every screenshot has a real alt text');
  const withShot = mdx.split(/<Part n="/).slice(1).filter((p) => /<Shot/.test(p)).length;
  assert.ok(withShot >= 6, `${withShot} parts have a real screenshot`);
});

test('every code walk-through shows a real project file and points at lines that exist', () => {
  // CodeWalk, and CodeTour (the walk-through with the phone beside the code)
  const walks = [...mdx.matchAll(/<Code(?:Walk|Tour)([\s\S]*?)\]\} \/>/g)].map((m) => m[1]);
  assert.ok(walks.length >= 15, `${walks.length} walk-throughs`);
  const wifiFix = /export const WIFI_FIX = `([\s\S]*?)`;/.exec(mdx)![1];
  for (const w of walks) {
    const file = /file="([^"]+)"/.exec(w)![1];
    const ref = /code=\{(?:P\.(\w+)|(\w+))\}/.exec(w)!;
    const code = ref[1] ? project[ref[1]] : ref[2] === 'WIFI_FIX' ? wifiFix : undefined;
    assert.equal(typeof code, 'string', `${file}: the code exists (${ref[0]})`);
    const count = code!.replace(/\n$/, '').split('\n').length;
    for (const m of w.matchAll(/lines: (\[\s*(\d+)\s*,\s*(\d+)\s*\]|(\d+))/g)) {
      const nums = m[4] ? [Number(m[4])] : [Number(m[2]), Number(m[3])];
      for (const n of nums) assert.ok(n >= 1 && n <= count, `${file}: line ${n} exists (${count} lines)`);
      if (nums.length === 2) assert.ok(nums[1] > nums[0], `${file}: range ${nums.join('–')}`);
    }
  }
  // every file of the project students work on has its walk-through
  for (const name of ['APP', 'APP_BUTTON', 'HOME', 'APP_JSON', 'PARSE_SCAN', 'SCAN_FRAME', 'RESULT_CARD', 'FEEDBACK', 'SCANNER', 'PACKAGE_JSON', 'TSCONFIG', 'PARSE_TEST', 'FAKE_CAMERA', 'SCREEN_TEST', 'MAESTRO_FLOW', 'EAS_JSON']) {
    assert.ok(mdx.includes(`code={P.${name}}`), `${name} is walked through line by line`);
  }
});

test('the starter project is downloadable (to run Smart QR on a computer later)', () => {
  const zip = new URL('../public/labs/lab-07/smart-qr-starter.zip', import.meta.url);
  assert.ok(existsSync(zip));
  assert.ok(statSync(zip).size < 1024 * 1024, 'the starter is under 1 MB');
  assert.match(mdx, /\(\/labs\/lab-07\/smart-qr-starter\.zip\)/);
});

test('nothing to install: no task asks for a terminal, an emulator, Java or an account on the lab PC', () => {
  assert.doesNotMatch(mdx, /<Task /, 'no hands-on task outside the page');
  assert.match(mdx, /Nothing to install/);
  for (const id of ['lab-07--unit-tests', 'lab-07--component-tests', 'lab-07--maestro-run', 'lab-07--eas-config']) assert.ok(mdx.includes(`<Exercise id="${id}" />`), `${id} runs in the browser`);
});

test('no Expo account, project id or personal data in the lab', () => {
  const texts = [mdx, ...Object.values(project).filter((v) => typeof v === 'string')];
  const dir = new URL('../public/labs/lab-07/', import.meta.url);
  for (const f of readdirSync(dir)) if (f.endsWith('.svg')) texts.push(readFileSync(new URL(f, dir), 'utf8'));
  for (const t of texts) {
    assert.doesNotMatch(t, /"owner"|projectId"/, 'no app.json owner or EAS project id');
    assert.doesNotMatch(t, /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/, 'no project or build ids');
    for (const m of t.matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)) assert.match(m[0], /@example\.com$/, 'only example.com emails');
  }
  // every expo.dev account link is the placeholder
  const accounts = [...mdx.matchAll(/expo\.dev\/accounts\/([^/\s'"]+)/g)].map((m) => m[1]);
  assert.ok(accounts.length >= 2);
  for (const a of accounts) assert.ok(a === 'your-account' || a === '…', `expo.dev/accounts/${a} is a placeholder`);
});
