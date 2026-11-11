// Lab 05 in the Code Editor: the attendance app project (src/ide/core/course-projects.ts) and the small Axios of the
// phone emulator (src/lab/runtime/axios.ts). The project runs in the same preview runtime as the emulator, against a
// fake course server and a fake PokeAPI, so these tests never touch the real ones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register({ url: 'http://localhost/', width: 390, height: 844 });
const { axios, createAxios } = await import('../src/lab/runtime/axios.ts');
const { createRuntime } = await import('../src/lab/runtime/core.ts');
const { compileAll } = await import('../src/lab/engine/compile.ts');
const { COURSE_PROJECTS, SITE } = await import('../src/ide/core/course-projects.ts');

/* ------------------------------------------------------------------ fake servers */
type Sent = { method: string; url: string; headers: Record<string, string>; body?: string };
const sent: Sent[] = [];
const checkedIn = new Set<string>();
let open = true;
const reply = (data: unknown, status = 200) => new Response(typeof data === 'string' ? data : JSON.stringify(data), { status, headers: { 'content-type': typeof data === 'string' ? 'text/plain' : 'application/json' } });
const POKEMON: Record<string, unknown> = {
  pikachu: { name: 'pikachu', sprites: { front_default: 'https://img.example/25.png' }, types: [{ slot: 1, type: { name: 'electric' } }] },
  charizard: { name: 'charizard', sprites: { front_default: 'https://img.example/6.png' }, types: [{ slot: 1, type: { name: 'fire' } }, { slot: 2, type: { name: 'flying' } }] },
};

(globalThis as { fetch: unknown }).fetch = async (input: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) => {
  const url = new URL(String(input));
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = Object.fromEntries(Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  if ((method === 'GET' || method === 'HEAD') && init.body !== undefined) throw new TypeError('Request with GET/HEAD method cannot have body.');
  sent.push({ method, url: url.href, headers, body: init.body });
  await new Promise((r) => setTimeout(r, 5));
  if (url.origin === 'https://pokeapi.co') {
    const m = /^\/api\/v2\/pokemon\/([^/]+)$/.exec(url.pathname);
    return m && POKEMON[m[1]] ? reply(POKEMON[m[1]]) : reply('Not Found', 404);
  }
  if (url.origin !== SITE) throw new TypeError('Failed to fetch');
  if (url.pathname === '/api/attendance/status' && method === 'GET') return reply({ open, database: 'connected', password: true });
  if (url.pathname === '/api/attendance' && method === 'POST') {
    // the same rules as the real API: letters-only name, 5–9 digit ID, a 16–64 character device ID, JSON only
    let body: Record<string, unknown> | null = null;
    if (/application\/json/i.test(headers['content-type'] ?? '') && typeof init.body === 'string') { try { body = JSON.parse(init.body); } catch { body = null; } }
    const name = String(body?.name ?? '').trim();
    const studentId = String(body?.studentId ?? '').trim();
    const deviceId = String(body?.deviceId ?? '');
    if (!/^\p{L}+(?:[ '-]\p{L}+)+$/u.test(name) || !/^\d{5,9}$/.test(studentId) || deviceId.length < 16 || deviceId.length > 64) return reply({ error: 'invalid', errors: {} }, 400);
    if (!open) return reply({ error: 'closed' }, 503);
    const entry = { name, studentId, lab: 'lab-05', at: '2026-11-11T10:00:00.000Z' };
    if (checkedIn.has(studentId)) return reply({ ok: true, already: true, entry });
    checkedIn.add(studentId);
    return reply({ ok: true, entry }, 201);
  }
  return reply({ error: 'not-found' }, 404);
};

/* ------------------------------------------------------------------ the Axios of the emulator */
test('axios: get with params, res.data is parsed JSON', async () => {
  sent.length = 0;
  const res = await axios.get(`${SITE}/api/attendance/status`, { params: { lab: 'lab-05', skip: undefined } });
  assert.equal(res.status, 200);
  assert.equal((res.data as { open: boolean }).open, true);
  assert.equal(sent[0].url, `${SITE}/api/attendance/status?lab=lab-05`);
  assert.equal(sent[0].body, undefined);
});

test('axios.create({ baseURL }).post sends JSON with the JSON header', async () => {
  sent.length = 0;
  const api = axios.create({ baseURL: `${SITE}/api/` });
  const res = await api.post('/attendance', { name: 'Mona Adel', studentId: '990001', deviceId: 'd'.repeat(36) });
  assert.equal(res.status, 201);
  assert.equal(sent[0].method, 'POST');
  assert.equal(sent[0].url, `${SITE}/api/attendance`);
  assert.equal(sent[0].headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(sent[0].body!), { name: 'Mona Adel', studentId: '990001', deviceId: 'd'.repeat(36) });
  // an empty url is the baseURL itself (no extra "/")
  sent.length = 0;
  await createAxios({ baseURL: `${SITE}/api/attendance/status` }).get('');
  assert.equal(sent[0].url, `${SITE}/api/attendance/status`);
});

test('axios: a status outside 200–299 throws, with err.response', async () => {
  const bad = await axios.post(`${SITE}/api/attendance`, { name: 'M0na', studentId: '1', deviceId: 'x' }).then(() => null, (e) => e);
  assert.ok(bad, 'a 400 throws');
  assert.equal(axios.isAxiosError(bad), true);
  assert.equal(bad.message, 'Request failed with status code 400');
  assert.equal(bad.response.status, 400);
  assert.equal(bad.response.data.error, 'invalid');
  const missing = await axios.get('https://pokeapi.co/api/v2/pokemon/pikachuu').then(() => null, (e) => e);
  assert.equal(missing.response.status, 404);
  assert.equal(missing.response.data, 'Not Found', 'a text answer stays text');
});

test('axios: no answer at all is a Network Error without err.response', async () => {
  const err = await axios.get('https://nowhere.example/api').then(() => null, (e) => e);
  assert.equal(err.message, 'Network Error');
  assert.equal(err.code, 'ERR_NETWORK');
  assert.equal(err.response, undefined);
});

/* ------------------------------------------------------------------ the project */
const project = COURSE_PROJECTS.find((p) => p.id === 'lab05-attendance')!;
const CODE = /\.(tsx?|jsx?)$/;
const NOT_APP = /(^|\/)(babel|metro|tailwind)\.config\.js$|\.d\.ts$/;

test('the project: a React Native project with GUIDE.md, the real site address, and links to files that exist', () => {
  assert.ok(project, 'lab05-attendance is a course project');
  assert.equal(project.kind, 'react-native');
  assert.equal(SITE, 'https://labverse-indol.vercel.app');
  const files = project.files();
  for (const p of project.open) assert.ok(files[p], `${p} (opened first) exists`);
  for (const p of ['/app/_layout.tsx', '/app/(tabs)/_layout.tsx', '/app/(tabs)/index.tsx', '/app/(tabs)/lookup.tsx', '/shared/device.ts', '/features/attendance/api.ts', '/features/external/api.ts', '/package.json']) assert.ok(files[p], `${p} exists`);
  assert.match(files['/features/attendance/api.ts'], /const BASE = 'https:\/\/labverse-indol\.vercel\.app\/api\/attendance';/);
  assert.ok(JSON.parse(files['/package.json']).dependencies.axios, 'axios is listed for the computer version');
  const guide = files['/GUIDE.md'];
  const links = [...guide.matchAll(/\]\(((?:[^()\s]|\([^()]*\))+)\)/g)].map((m) => m[1]).filter((t) => !/^https?:/.test(t));
  assert.ok(links.length >= 8, 'the guide links the files it talks about');
  for (const l of links) assert.ok(files['/' + l.replace(/^\.?\//, '')], `the guide link ${l} opens a real file`);
  assert.deepEqual([...guide.matchAll(/^## (Step \d+)/gm)].map((m) => m[1]), ['Step 1', 'Step 2', 'Step 3', 'Step 4']);
  assert.match(guide, /npx expo start/, 'the computer steps are still there');
});

/** Runs project files in the preview runtime, like the code editor's phone emulator. */
async function runProject(files: Record<string, string>) {
  const code: Record<string, string> = {};
  for (const [p, text] of Object.entries(files)) if (CODE.test(p) && !NOT_APP.test(p.slice(1))) code[p.slice(1)] = text;
  const compiled = compileAll(code);
  assert.ok(compiled.ok, JSON.stringify(!compiled.ok && compiled.errors));
  const container = document.createElement('div');
  document.body.appendChild(container);
  const errors: string[] = [];
  const runtime = createRuntime({ container, post: (m) => { const msg = m as unknown as { type: string; error?: { message: string } }; if (msg.type === 'error') errors.push(msg.error!.message); } });
  await runtime.run({ type: 'run', id: 1, files: compiled.files, entry: 'app/_layout.tsx', frame: 'phone' });
  assert.deepEqual(errors, [], 'the app starts without an error');
  const d = runtime.driver;
  const settle = async (ms = 80) => { await d.wait(ms); };
  return { d, settle, errors, close: () => container.remove() };
}

/** Changes one exact piece of a starter file; fails loudly if the starter changed. */
function swap(text: string, from: string, to: string) {
  assert.ok(text.includes(from), `starter still has: ${from.slice(0, 70)}`);
  return text.replace(from, to);
}

test('the starter runs in the emulator: both tabs, the form, and nothing sent yet', async () => {
  sent.length = 0;
  const app = await runProject(project.files());
  const text = await app.d.text();
  for (const t of ['ATTENDANCE', 'Check in', 'Full name', 'Student ID', 'Submit', 'Pokémon']) assert.ok(text.includes(t), `shows "${t}"`);
  assert.equal(sent.length, 0);
  app.close();
});

/** The solution of Exercises 10.1 and 10.2 with fetch, and 10.3 with Axios, written into the starter files. */
function solved() {
  const f = project.files();
  f['/features/attendance/api.ts'] = swap(f['/features/attendance/api.ts'], `export async function checkIn(name: string, studentId: string) {
  // TODO: POST { name, studentId, deviceId: getDeviceId() } to BASE as JSON`, `export async function checkIn(name: string, studentId: string) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, studentId, deviceId: getDeviceId() }),
  });
  const data = await res.json();
  if (res.status === 201) return { ok: true as const, entry: data.entry };
  if (res.status === 200 && data.already) return { ok: true as const, entry: data.entry, already: true as const };
  if (res.status === 400) return { ok: false as const, reason: 'invalid' as const };
  if (res.status === 503) return { ok: false as const, reason: 'closed' as const };
  return { ok: false as const, reason: 'error' as const };`) + `
export async function attendanceOpen() {
  const res = await fetch(\`\${BASE}/status\`);
  const data = await res.json();
  return Boolean(data.open);
}
`;
  let index = swap(f['/app/(tabs)/index.tsx'], `import { useState } from 'react';`, `import { useEffect, useState } from 'react';\nimport { attendanceOpen, checkIn } from '@/features/attendance/api';`);
  index = swap(index, `  const [status, setStatus] = useState<Status>({ kind: 'idle' });\n`, `  const [status, setStatus] = useState<Status>({ kind: 'idle' });\n  const [open, setOpen] = useState(true);\n  useEffect(() => { attendanceOpen().then(setOpen); }, []);\n`);
  index = swap(index, `    // TODO (Exercise 10.1): call checkIn(name, studentId) from '@/features/attendance/api'
    // and turn the result into setStatus({ kind: 'success', message } | { kind: 'error', message }).`, `    const result = await checkIn(name, studentId);
    if (result.ok) setStatus({ kind: 'success', message: 'already' in result ? 'You were already checked in ✓' : 'Checked in ✓' });
    else setStatus({ kind: 'error', message: result.reason === 'invalid' ? 'Check your name and student ID.' : result.reason === 'closed' ? 'Attendance is closed.' : 'Could not check in. Try again.' });`);
  index = swap(index, `      <View className="gap-4">\n        <View className="gap-2">`, `      {!open && <Text className="text-base text-slate-500">Attendance is not open yet</Text>}\n      {open && <View className="gap-4">\n        <View className="gap-2">`);
  index = swap(index, `        )}\n      </View>\n    </View>\n  );`, `        )}\n      </View>}\n    </View>\n  );`);
  f['/app/(tabs)/index.tsx'] = index;
  f['/features/external/api.ts'] = `import axios from 'axios';

export async function getPokemon(name: string) {
  try {
    const res = await axios.get(\`https://pokeapi.co/api/v2/pokemon/\${name.trim().toLowerCase()}\`);
    return { name: res.data.name as string, sprite: res.data.sprites.front_default as string, types: res.data.types.map((t: any) => t.type.name as string) };
  } catch {
    throw new Error('Not found — check the spelling.');
  }
}
`;
  let lookup = swap(f['/app/(tabs)/lookup.tsx'], `import { View, Text, TextInput, Pressable, ActivityIndicator, Image } from 'react-native';`, `import { View, Text, TextInput, Pressable, ActivityIndicator, Image } from 'react-native';\nimport { getPokemon } from '@/features/external/api';`);
  lookup = swap(lookup, `    // TODO (Exercise 10.3): call getPokemon(query) from '@/features/external/api'
    // and turn the result into setStatus({ kind: 'success', data } | { kind: 'error', message }).`, `    try {
      const data = await getPokemon(query);
      setStatus({ kind: 'success', data });
    } catch (error) {
      setStatus({ kind: 'error', message: (error as Error).message });
    }`);
  f['/app/(tabs)/lookup.tsx'] = lookup;
  return f;
}

test('10.1 in the emulator: a real check-in (201), then "already" (200), and a wrong name (400)', async () => {
  sent.length = 0;
  open = true;
  const app = await runProject(solved());
  await app.settle();
  await app.d.type({ placeholder: 'Mariam Ahmed' }, 'Mona Adel');
  await app.d.type({ placeholder: '236541' }, '240001');
  await app.d.press({ text: 'Submit' });
  await app.settle(150);
  assert.ok((await app.d.text()).includes('Checked in ✓'), await app.d.text());
  const post = sent.find((s) => s.method === 'POST')!;
  assert.equal(post.url, `${SITE}/api/attendance`);
  assert.equal(post.headers['content-type'], 'application/json');
  const body = JSON.parse(post.body!);
  assert.deepEqual([body.name, body.studentId], ['Mona Adel', '240001']);
  assert.match(body.deviceId, /^[0-9a-f-]{36}$/, 'crypto.randomUUID() works in the emulator');

  await app.d.press({ text: 'Submit' });
  await app.settle(150);
  assert.ok((await app.d.text()).includes('You were already checked in ✓'));
  const posts = sent.filter((s) => s.method === 'POST');
  assert.equal(JSON.parse(posts[1].body!).deviceId, body.deviceId, 'the same device ID both times');

  await app.d.type({ placeholder: 'Mariam Ahmed' }, 'M0na');
  await app.d.press({ text: 'Submit' });
  await app.settle(150);
  assert.ok((await app.d.text()).includes('Check your name and student ID.'));
  app.close();
});

test('10.2 in the emulator: the form hides while attendance is closed', async () => {
  open = false;
  const app = await runProject(solved());
  await app.settle(150);
  const text = await app.d.text();
  assert.ok(text.includes('Attendance is not open yet'), text);
  assert.ok(!text.includes('Submit'), 'no form while closed');
  app.close();
  open = true;
});

test('10.3 in the emulator (Axios): the Pokémon tab finds pikachu and survives a typo', async () => {
  const app = await runProject(solved());
  await app.settle();
  await app.d.press({ text: 'Pokémon' });
  await app.settle();
  assert.ok((await app.d.text()).includes('Pokémon lookup'));
  await app.d.type({ placeholder: 'pikachu' }, '  Pikachu ');
  await app.d.press({ text: 'Search' });
  await app.settle(150);
  let text = await app.d.text();
  assert.ok(text.includes('pikachu') && text.includes('electric'), text);
  assert.ok(sent.some((s) => s.url === 'https://pokeapi.co/api/v2/pokemon/pikachu'), 'the name is trimmed and lowercased');
  await app.d.type({ placeholder: 'pikachu' }, 'pikachuu');
  await app.d.press({ text: 'Search' });
  await app.settle(150);
  text = await app.d.text();
  assert.ok(text.includes('Not found — check the spelling.'), text);
  assert.deepEqual(app.errors, [], 'no crash');
  app.close();
});
