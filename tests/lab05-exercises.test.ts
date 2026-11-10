// Every Lab 05 exercise: reference solutions pass, starters don't, and the network is a fake course server
// (the same answers as /api/lab5/* and /api/attendance), so the tests never touch the real one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register({ url: 'http://localhost/', width: 390, height: 844 });
const { createRuntime } = await import('../src/lab/runtime/core.ts');
const { evaluate } = await import('../src/lab/engine/checks.ts');
const grade = await import('../src/lab/engine/grade.ts');
const { exercises, demos, FINAL_ID } = await import('../src/lab/exercises/lab-05/index.ts');
const { EXERCISE_IDS, EXERCISES } = await import('../src/lab/exercises/lab-05/meta.ts');
const { INTERACTIVE_LABS } = await import('../src/lab/exercises/registry.ts');
const { solutions } = await import('./support/lab05-solutions.ts');
const { compileAll } = await import('../src/lab/engine/compile.ts');
const { tone } = await import('../src/lab/exercises/lab-05/shared.ts');

/* ------------------------------------------------------------------ a fake course server */
const SITE = 'https://labverse-indol.vercel.app';
const STUDENTS = [
  { id: 1, name: 'Mona Adel', studentId: '240001', present: true },
  { id: 2, name: 'Omar Khaled', studentId: '240002', present: false },
  { id: 3, name: 'Salma Hassan', studentId: '240003', present: true },
  { id: 4, name: 'Youssef Ali', studentId: '240004', present: true },
  { id: 5, name: 'Nour Samir', studentId: '240005', present: false },
];
const posted: { url: string; body: unknown }[] = [];
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
(globalThis as { fetch: unknown }).fetch = async (input: string, init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) => {
  const url = new URL(String(input));
  const method = (init.method ?? 'GET').toUpperCase();
  if ((method === 'GET' || method === 'HEAD') && init.body !== undefined) throw new TypeError('Request with GET/HEAD method cannot have body.');
  await new Promise((r) => setTimeout(r, 5));
  if (url.origin !== SITE) throw new TypeError('Failed to fetch');
  const json = () => {
    const type = Object.entries(init.headers ?? {}).find(([k]) => k.toLowerCase() === 'content-type')?.[1] ?? '';
    if (typeof init.body !== 'string' || !/application\/json/i.test(type)) return null;
    try { return JSON.parse(init.body) as Record<string, unknown>; } catch { return null; }
  };
  if (url.pathname === '/api/lab5/students' && method === 'GET') {
    const p = url.searchParams.get('present');
    return reply(p === 'true' ? STUDENTS.filter((s) => s.present) : p === 'false' ? STUDENTS.filter((s) => !s.present) : STUDENTS);
  }
  const one = /^\/api\/lab5\/students\/(\d+)$/.exec(url.pathname);
  if (one) { const s = STUDENTS.find((x) => x.id === Number(one[1])); return s ? reply(s) : reply({ error: 'not-found' }, 404); }
  if (url.pathname === '/api/lab5/echo' && method === 'POST') {
    const body = json();
    return body ? reply({ ok: true, received: body, at: new Date().toISOString() }, 201) : reply({ error: 'invalid-json' }, 400);
  }
  if (url.pathname === '/api/attendance/status') return reply({ open: true, database: 'connected', password: true });
  if (url.pathname === '/api/attendance' && method === 'POST') {
    const body = json();
    if (!body || !body.name || !body.studentId || !body.deviceId) return reply({ error: 'invalid', errors: {} }, 400);
    posted.push({ url: url.href, body });
    return reply({ ok: true, entry: { name: body.name, studentId: body.studentId, lab: 'lab-05', at: new Date().toISOString() } }, 201);
  }
  return reply({ error: 'not-found' }, 404);
};

// A broken student handler (a GET with a body, reading a key of an error answer) rejects inside an event handler.
// In the browser the preview reports it on the phone screen; here it must not fail the test that checks it.
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

// the student started the lab (the final exercise checks in with this identity)
localStorage.setItem('lab:student', JSON.stringify({ name: 'Mona Adel', id: '240001', group: '—', sessionId: 'open_lab-05' }));

/** AppRunner backed by the real preview runtime in happy-dom. */
function nodeRunner() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const messages: { type: string; error?: { message: string } }[] = [];
  const runtime = createRuntime({ container, post: (m) => messages.push(m as never) });
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
    },
  };
}

type Ex = (typeof exercises)[number];
const codeExercises = exercises.filter((e): e is Extract<Ex, { kind: 'code' | 'fix' }> => e.kind === 'code' || e.kind === 'fix');

test('registry: ids match meta.ts in page order, numbered 1…13, three hints each, the final one is the check-in', () => {
  assert.deepEqual(exercises.map((e) => e.id), EXERCISE_IDS);
  assert.deepEqual(exercises.map((e) => e.n), exercises.map((_, i) => i + 1));
  for (const e of exercises) assert.equal(e.hints.length, 3, `${e.id} has 3 hints`);
  assert.equal(FINAL_ID, 'lab-05--check-in');
  assert.ok(INTERACTIVE_LABS['lab-05'], 'Lab 05 is registered as an interactive lab');
  assert.equal(EXERCISES.filter((e) => e.final).map((e) => e.id).join(), FINAL_ID);
});

test('rhythm: 3 small + 1 big, then 2 small + 1 big per part, ending with the API check-in', () => {
  const big = (e: Ex) => e.kind === 'code';
  const perPart = [5, 6, 7, 8].map((p) => EXERCISES.filter((m) => m.block === p).map((m) => exercises.find((e) => e.id === m.id)!));
  assert.deepEqual(perPart.map((list) => list.map((e) => (big(e) ? 'BIG' : 'small'))), [
    ['small', 'small', 'small', 'BIG'],
    ['small', 'small', 'BIG'],
    ['small', 'small', 'BIG'],
    ['small', 'small', 'BIG'],
  ]);
  assert.equal(perPart[3].at(-1)!.id, FINAL_ID);
});

for (const ex of codeExercises) {
  test(`${ex.id} ${ex.title}: the reference solution passes every check`, async () => {
    const files = solutions[ex.id];
    assert.ok(files, `solution for ${ex.id} exists`);
    const out = await evaluate(ex, files, nodeRunner());
    assert.equal(out.status, 'pass', JSON.stringify({ failed: out.results.filter((r) => !r.pass), blocker: out.blocker }, null, 1));
  });

  test(`${ex.id}: the starter code is not accepted (and every failing check teaches)`, async () => {
    const out = await quiet(() => evaluate(ex, ex.files, nodeRunner()));
    assert.notEqual(out.status, 'pass');
    assert.equal(out.results.length, ex.checks.length);
    for (const r of out.results) if (!r.pass) assert.ok(r.message && r.message.length > 10, `${ex.id}/${r.id} has a teaching message`);
  });
}

test('the final exercise really sends the student’s own name and ID to /api/attendance', async () => {
  posted.length = 0;
  const ex = codeExercises.find((e) => e.id === FINAL_ID)!;
  const out = await evaluate(ex, solutions[FINAL_ID], nodeRunner());
  assert.equal(out.status, 'pass');
  assert.equal(posted.length, 1, 'exactly one check-in is sent');
  const body = posted[0].body as Record<string, string>;
  assert.equal(body.name, 'Mona Adel');
  assert.equal(body.studentId, '240001');
  assert.match(body.deviceId, /^[A-Za-z0-9._-]{16,64}$/, 'a device ID the API accepts');
});

test('the final exercise asks the student to start the lab first when no identity is saved', async () => {
  const saved = localStorage.getItem('lab:student');
  localStorage.removeItem('lab:student');
  try {
    const ex = codeExercises.find((e) => e.id === FINAL_ID)!;
    const out = await evaluate(ex, solutions[FINAL_ID], nodeRunner());
    const real = out.results.find((r) => r.id === 'real')!;
    assert.equal(real.pass, false);
    assert.match(real.message!, /Start lab/);
  } finally {
    localStorage.setItem('lab:student', saved!);
  }
});

test('a POST without the JSON header or JSON.stringify is caught by the checks', async () => {
  const ex = codeExercises.find((e) => e.id === 'lab-05--post-echo')!;
  const files = { 'App.tsx': solutions['lab-05--post-echo']['App.tsx'].replace("      headers: { 'Content-Type': 'application/json' },\n", '').replace('JSON.stringify({ name })', '{ name }') };
  const out = await quiet(() => evaluate(ex, files, nodeRunner()));
  const failed = out.results.filter((r) => !r.pass).map((r) => r.id);
  assert.ok(failed.includes('header') && failed.includes('stringify') && failed.includes('reply'), String(failed));
});

test('starter files compile, and every demo runs and shows something', async () => {
  for (const ex of codeExercises) assert.ok(compileAll(ex.files).ok, `${ex.id} starter compiles`);
  for (const demo of Object.values(demos)) {
    const runner = nodeRunner();
    const compiled = compileAll(demo.files);
    assert.ok(compiled.ok, `${demo.id} compiles`);
    const r = await runner.run(compiled.ok ? compiled.files : {}, demo.entry, demo.frame);
    assert.equal(r.ok, true, `${demo.id}: ${JSON.stringify(r.error)}`);
    await runner.driver.wait(50);
    assert.ok((await runner.driver.text()).length > 0, `${demo.id} shows something`);
  }
});

test('small exercises grade: right answers pass, one swap or wrong pick is partial', () => {
  for (const ex of exercises) {
    if (ex.kind === 'order') {
      assert.equal(grade.gradeOrder(ex, ex.items).status, 'pass');
      const swapped = [...ex.items];
      [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
      assert.notEqual(grade.gradeOrder(ex, swapped).status, 'pass');
    }
    if (ex.kind === 'predict') {
      for (const q of ex.questions) assert.equal(q.options.filter((o) => o.correct).length, 1, `${ex.id}: one right answer per question`);
      const right = ex.questions.map((q) => q.options.findIndex((o) => o.correct));
      assert.equal(grade.gradePredict(ex, right).status, 'pass');
      assert.notEqual(grade.gradePredict(ex, right.map((i, k) => (k === 0 ? (i + 1) % ex.questions[0].options.length : i))).status, 'pass');
    }
    if (ex.kind === 'match') {
      const targets = ex.pairs.map((p) => p.target);
      assert.equal(new Set(targets).size, targets.length, `${ex.id}: every target is different`);
    }
  }
});

test('colour reading: greens and reds from NativeWind and CSS', () => {
  assert.equal(tone('#16a34a'), 'green');
  assert.equal(tone('#22c55e'), 'green');
  assert.equal(tone('#dc2626'), 'red');
  assert.equal(tone('rgb(239, 68, 68)'), 'red');
  assert.equal(tone('#0f172a'), null);
  assert.equal(tone('#ffffff'), null);
});
