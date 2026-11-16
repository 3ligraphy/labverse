// Lab 06's final project (the Code Editor course project "lab06-tasks") runs in the phone emulator's runtime: sign in
// with the practice account, add tasks, go offline and back, and the session is stored encrypted (LargeSecureStore).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register({ url: 'http://localhost/', width: 390, height: 844 });
const { createRuntime } = await import('../src/lab/runtime/core.ts');
const { compileAll } = await import('../src/lab/engine/compile.ts');
const device = await import('../src/lab/runtime/device.ts');
const practice = await import('../src/lab/runtime/supabase-practice.ts');
const { LAB06_PROJECT } = await import('../src/ide/core/course-lab06.ts');

const wasm = readFileSync(new URL('../node_modules/sql.js/dist/sql-wasm-browser.wasm', import.meta.url));
const loadAsset = async () => wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength);

test('the final project: sign in, add, offline, back online — one cloud row each, session encrypted, survives a restart', async () => {
  device.resetDevice();
  // the Code Editor sends the code files and .env, without the leading /
  const files = Object.fromEntries(Object.entries(LAB06_PROJECT.files()).filter(([p]) => /\.(tsx?|jsx?)$|^\/\.env$/.test(p)).map(([p, c]) => [p.slice(1), c]));
  const compiled = compileAll(files);
  assert.ok(compiled.ok, JSON.stringify(!compiled.ok && compiled.errors));
  const container = document.createElement('div');
  document.body.appendChild(container);
  const errors: string[] = [];
  const runtime = createRuntime({ container, post: (m) => { if ((m as { type: string }).type === 'error') errors.push(JSON.stringify(m)); }, loadAsset });
  const d = runtime.driver;
  const until = async (test: (t: string) => boolean, ms = 6000) => {
    const end = Date.now() + ms;
    for (;;) {
      const t = await d.text();
      if (test(t) || Date.now() > end) return t;
      await new Promise((r) => setTimeout(r, 60));
    }
  };

  await runtime.run({ type: 'run', id: 1, files: compiled.ok ? compiled.files : {}, entry: 'App.tsx', frame: 'phone' });
  assert.deepEqual(errors, []);
  assert.match(await until((t) => t.includes('Sign in')), /Offline tasks/);
  await d.type({ placeholder: 'Email' }, practice.MONA.email);
  await d.type({ placeholder: 'Password' }, practice.MONA.password);
  await d.press({ rn: 'Pressable', text: 'Sign in' });
  assert.match(await until((t) => t.includes('My tasks')), /My tasks/, 'signed in');

  // online: added, sent, one row
  await d.type({ placeholder: 'New task' }, 'Buy milk');
  await d.press({ rn: 'Pressable', text: /^Add$/ });
  await until((t) => /Buy milk/.test(t) && /Everything is in the cloud/.test(t));
  assert.equal(practice.practiceRows('tasks').filter((r) => r.title === 'Buy milk').length, 1);

  // offline: it waits on the phone
  device.setOnline(false);
  assert.match(await until((t) => t.includes('Offline')), /Offline/);
  await d.type({ placeholder: 'New task' }, 'Offline one');
  await d.press({ rn: 'Pressable', text: /^Add$/ });
  assert.match(await until((t) => t.includes('1 waiting to sync')), /1 waiting to sync/);
  assert.equal(practice.practiceRows('tasks').filter((r) => r.title === 'Offline one').length, 0);

  // back online: sent once
  device.setOnline(true);
  await until((t) => /Everything is in the cloud/.test(t));
  assert.equal(practice.practiceRows('tasks').filter((r) => r.title === 'Offline one').length, 1);

  // the session: ciphertext in AsyncStorage, its key in SecureStore (LargeSecureStore)
  const snap = device.snapshot();
  const plain = snap.sections.find((s) => s.id === 'async-storage')?.rows?.find((r) => r.key === 'sb-practice-auth-token');
  assert.ok(plain, 'the session is saved');
  assert.match(plain!.value, /^[0-9a-f]+…?$/, 'as hex ciphertext');
  assert.doesNotMatch(plain!.value, /access_token/);
  assert.ok(snap.sections.find((s) => s.id === 'secure-store')?.rows?.some((r) => r.key === 'sb-practice-auth-token'), 'the key is in SecureStore');

  // restart: still signed in, tasks read from SQLite
  await runtime.rpc('rerun', []);
  const after = await until((t) => t.includes('Buy milk') && t.includes('Offline one'));
  assert.match(after, /My tasks/);
  assert.match(after, /Offline one/);
  assert.deepEqual(errors, []);
  runtime.unmount();
});
