// Every Lab 06 exercise: the full solution (the one students can open after every hint) passes every check, the
// starter does not (and each failing check teaches), every demo runs, and the parts add up to the 150-minute plan.
// Runs the real preview runtime in happy-dom, with the phone storage of Lab 06 (SQLite on sql.js, the practice
// Supabase project, the Wi-Fi switch).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register({ url: 'http://localhost/', width: 390, height: 844 });
const { createRuntime } = await import('../src/lab/runtime/core.ts');
const { evaluate } = await import('../src/lab/engine/checks.ts');
const grade = await import('../src/lab/engine/grade.ts');
const { compileAll } = await import('../src/lab/engine/compile.ts');
const { exercises, demos, FINAL_ID, BLOCKS } = await import('../src/lab/exercises/lab-06/index.ts');
const { EXERCISE_IDS, EXERCISES } = await import('../src/lab/exercises/lab-06/meta.ts');
const { INTERACTIVE_LABS } = await import('../src/lab/exercises/registry.ts');

const wasm = readFileSync(new URL('../node_modules/sql.js/dist/sql-wasm-browser.wasm', import.meta.url));
const loadAsset = async () => wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength);

async function quiet<T>(fn: () => Promise<T>): Promise<T> {
  const saved = process.listeners('unhandledRejection');
  process.removeAllListeners('unhandledRejection');
  const ignore = () => {};
  process.on('unhandledRejection', ignore);
  try {
    const out = await fn();
    await new Promise((r) => setTimeout(r, 50));
    return out;
  } finally {
    process.off('unhandledRejection', ignore);
    for (const l of saved) process.on('unhandledRejection', l as never);
  }
}

/** One app at a time, like one preview phone: the previous test's app is closed (its listeners stop). */
const live: { unmount(): void }[] = [];

/** AppRunner backed by the real preview runtime in happy-dom, with Lab 06's storage controls. */
function nodeRunner() {
  for (const r of live.splice(0)) r.unmount();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const messages: { type: string; error?: { message: string } }[] = [];
  const runtime = createRuntime({ container, post: (m) => messages.push(m as never), loadAsset });
  live.push(runtime);
  let id = 0;
  return {
    async run(files: Record<string, string>, entry: string, frame: 'phone' | 'web') {
      messages.length = 0;
      await runtime.run({ type: 'run', id: ++id, files, entry, frame });
      const error = messages.find((m) => m.type === 'error')?.error;
      return error ? { ok: false, error } : { ok: true };
    },
    driver: {
      text: () => runtime.driver.text(),
      find: (q?: object) => runtime.driver.find(q),
      count: (q?: object) => runtime.driver.count(q),
      press: (q?: object) => runtime.driver.press(q),
      type: (q: object, v: string) => runtime.driver.type(q, v),
      wait: (ms: number) => runtime.driver.wait(ms),
      logs: async () => [],
      rerun: async () => {
        await runtime.rpc('rerun', []);
      },
      storage: () => runtime.rpc('storage', []) as never,
      network: async (online: boolean) => {
        await runtime.rpc('network', [online]);
      },
      resetDevice: async () => {
        await runtime.rpc('reset-device', []);
      },
      remote: async (op: object) => {
        await runtime.rpc('remote', [op]);
      },
    },
  };
}

type Ex = (typeof exercises)[number];
const codeExercises = exercises.filter((e): e is Extract<Ex, { kind: 'code' | 'fix' }> => e.kind === 'code' || e.kind === 'fix');

test('registry: ids match meta.ts in page order, numbered 1…18, three hints and a full solution each', () => {
  assert.deepEqual(exercises.map((e) => e.id), EXERCISE_IDS);
  assert.deepEqual(exercises.map((e) => e.n), exercises.map((_, i) => i + 1));
  for (const e of exercises) {
    assert.equal(e.hints.length, 3, `${e.id} has 3 hints`);
    assert.ok(e.solution && e.solution.explain.length > 20, `${e.id} has a solution with an explanation`);
    assert.ok(e.solution!.files || e.solution!.text, `${e.id}'s solution shows the answer`);
    assert.ok(e.success.length > 20, `${e.id} explains why it works`);
  }
  assert.equal(exercises.length, 18);
  // Part 5 (Supabase) in page order: keys, rows, auth, RLS (two), storage, realtime, errors
  assert.deepEqual(EXERCISES.filter((e) => e.block === 5).map((e) => e.id.replace('lab-06--', '')), ['supabase-parts', 'cloud-tasks', 'auth-screen', 'rls-predict', 'rls-policies', 'avatar-upload', 'realtime-tasks', 'supabase-errors']);
  assert.equal(FINAL_ID, 'lab-06--offline-sync');
  assert.ok(INTERACTIVE_LABS['lab-06'], 'Lab 06 is registered as an interactive lab');
  assert.equal(EXERCISES.filter((e) => e.final).map((e) => e.id).join(), FINAL_ID);
});

test('time: practice is 5 · 15 · 15 · 10 · 41 · 10 minutes per part (96 of the 180)', () => {
  const perPart = BLOCKS.map((b) => EXERCISES.filter((m) => m.block === b.part).reduce((sum, m) => sum + exercises.find((e) => e.id === m.id)!.minutes, 0));
  assert.deepEqual(perPart, [5, 15, 15, 10, 41, 10]);
  assert.equal(perPart.reduce((a, b) => a + b, 0), 96);
});

for (const ex of codeExercises) {
  test(`${ex.id} ${ex.title}: the full solution passes every check`, async () => {
    const files = { ...ex.files, ...ex.solution!.files };
    const out = await quiet(() => evaluate(ex, files, nodeRunner()));
    assert.equal(out.status, 'pass', JSON.stringify({ failed: out.results.filter((r) => !r.pass), blocker: out.blocker }, null, 1));
  });

  test(`${ex.id}: the starter code is not accepted (and every failing check teaches)`, async () => {
    const out = await quiet(() => evaluate(ex, ex.files, nodeRunner()));
    assert.notEqual(out.status, 'pass');
    assert.equal(out.results.length, ex.checks.length);
    for (const r of out.results) if (!r.pass) assert.ok(r.message && r.message.length > 10, `${ex.id}/${r.id} has a teaching message`);
  });
}

test('typical mistakes are caught with their own message', async () => {
  const find = (id: string) => codeExercises.find((e) => e.id === `lab-06--${id}`)!;
  const failedOf = async (ex: Ex & { kind: 'code' | 'fix' }, files: Record<string, string>) => {
    const out = await quiet(() => evaluate(ex, files, nodeRunner()));
    return Object.fromEntries(out.results.filter((r) => !r.pass).map((r) => [r.id, r.message ?? '']));
  };

  // settings saved as an object (no JSON.stringify)
  const s = find('settings-async');
  const noJson = (s.solution!.files!['App.tsx']).replace('JSON.stringify(next)', 'next as never');
  const f1 = await failedOf(s, { 'App.tsx': noJson });
  assert.match(f1.saved, /\[object Object\]/);

  // SQL built by pasting the title in
  const t = find('tasks-sqlite');
  const injected = t.solution!.files!['db.ts'].replace("db.runAsync('INSERT INTO tasks (title) VALUES (?)', title)", 'db.runAsync(`INSERT INTO tasks (title) VALUES (\'${title}\')`)');
  const f2 = await failedOf(t, { ...t.files, 'db.ts': injected });
  assert.match(f2.params, /pasted into the SQL/);

  // the token kept in AsyncStorage as well
  const k = find('token-store');
  const leaky = `import AsyncStorage from '@react-native-async-storage/async-storage';\n${k.solution!.files!['tokenStore.ts']}`;
  const f3 = await failedOf(k, { ...k.files, 'tokenStore.ts': leaky });
  assert.match(f3['no-plain'], /plain file/);

  // the avatar uploaded without upsert: the second photo is refused
  const a = find('avatar-upload');
  const noUpsert = a.solution!.files!['App.tsx'].replace(", upsert: true }", ' }');
  const f4 = await failedOf(a, { ...a.files, 'App.tsx': noUpsert });
  assert.match(f4.shown, /already exists/);

  // offline sync with insert instead of upsert: two quick syncs make two rows
  const o = find('offline-sync');
  const inserting = o.solution!.files!['sync.ts'].replace(".upsert(waiting.map((t) => ({ id: t.id, title: t.title, done: t.done === 1 })), { onConflict: 'id' })", '.insert(waiting.map((t) => ({ title: t.title, done: t.done === 1 })))');
  const f5 = await failedOf(o, { ...o.files, 'sync.ts': inserting });
  assert.ok(f5.upsert, 'the static check sees insert');
  assert.match(f5.twice ?? '', /copies/, 'and the running app really makes duplicates');

  // Realtime without the cleanup: every time the list opens, one more channel keeps listening
  const r = find('realtime-tasks');
  const noCleanup = r.solution!.files!['App.tsx'].replace(/return \(\) => \{\s*supabase\.removeChannel\(channel\);\s*\};/, '');
  assert.notEqual(noCleanup, r.solution!.files!['App.tsx'], 'the cleanup was taken out');
  const f6 = await failedOf(r, { ...r.files, 'App.tsx': noCleanup });
  assert.match(f6.cleanup ?? '', /removeChannel/);

  // the auth screen that ignores error.message: a wrong password shows nothing
  const au = find('auth-screen');
  const silent = au.solution!.files!['App.tsx'].replace('if (error) setMessage(error.message);', '');
  assert.notEqual(silent, au.solution!.files!['App.tsx'], 'the error line was taken out');
  const f7 = await failedOf(au, { ...au.files, 'App.tsx': silent });
  assert.match(f7['wrong-password'] ?? '', /error\.message/);
});

test('every starter compiles, and every demo runs and shows something', async () => {
  for (const ex of codeExercises) {
    assert.ok(compileAll(ex.files).ok, `${ex.id} starter compiles`);
    assert.ok(compileAll({ ...ex.files, ...ex.solution!.files }).ok, `${ex.id} solution compiles`);
  }
  for (const demo of Object.values(demos)) {
    const runner = nodeRunner();
    await runner.driver.resetDevice();
    const compiled = compileAll(demo.files);
    assert.ok(compiled.ok, `${demo.id} compiles`);
    const r = await quiet(() => runner.run(compiled.ok ? compiled.files : {}, demo.entry, demo.frame));
    assert.equal(r.ok, true, `${demo.id}: ${JSON.stringify(r.error)}`);
    await runner.driver.wait(80);
    assert.ok((await runner.driver.text()).length > 0, `${demo.id} shows something`);
  }
  for (const r of live.splice(0)) r.unmount();
});

test('small exercises grade: right answers pass, a wrong pick or one swap is partial', () => {
  for (const ex of exercises) {
    if (ex.kind === 'order') {
      assert.equal(grade.gradeOrder(ex, ex.items).status, 'pass');
      const swapped = [...ex.items];
      [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
      assert.notEqual(grade.gradeOrder(ex, swapped).status, 'pass');
    }
    if (ex.kind === 'predict') {
      for (const q of ex.questions) assert.equal(q.options.filter((o) => o.correct).length, 1, `${ex.id}: one right answer per question`);
    }
    if (ex.kind === 'match') {
      const targets = ex.pairs.map((p) => p.target);
      assert.equal(new Set(targets).size, targets.length, `${ex.id}: every target is different`);
    }
  }
});
