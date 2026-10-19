// Lab 03: every exercise's reference solution passes, starters don't, typical mistakes get the right feedback,
// demos run, and the page keeps the builder lab's progress key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register({ url: 'http://localhost/', width: 390, height: 844 });
const { createRuntime } = await import('../src/lab/runtime/core.ts');
const { evaluate } = await import('../src/lab/engine/checks.ts');
const grade = await import('../src/lab/engine/grade.ts');
const { exercises, demos, LAB_ID } = await import('../src/lab/exercises/lab-03/index.ts');
const { EXERCISE_IDS, EXERCISES } = await import('../src/lab/exercises/lab-03/meta.ts');
const { solutions, mistakes } = await import('./support/lab03-solutions.ts');
const { compileAll } = await import('../src/lab/engine/compile.ts');
const { FILE_LAB_KEYS } = await import('../src/lib/lab/claimed.ts');
const { LABS } = await import('../src/lib/lab/core.ts');
const { mobileDevelopmentLab03 } = await import('../src/lib/platform/seeds/mobile-development-lab-03.ts');
const { compileLab } = await import('../src/lib/platform/core.ts');

type Ex = (typeof exercises)[number];

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

const codeExercises = exercises.filter((e): e is Extract<Ex, { kind: 'code' | 'fix' }> => e.kind === 'code' || e.kind === 'fix');
const byId = (id: string) => exercises.find((e) => e.id === id)!;
const mdx = fs.readFileSync(new URL('../src/content/labs/lab-03.mdx', import.meta.url), 'utf8');

test('Lab 03 keeps the builder lab key, its four original exercise ids, and is the only copy listed', () => {
  assert.equal(LAB_ID, 'mobile-development--lab-03');
  assert.match(mdx, /^trackingKey: mobile-development--lab-03$/m);
  assert.equal(FILE_LAB_KEYS[LAB_ID], 'lab-03');
  assert.ok(LABS[LAB_ID], 'progress events for Lab 03 are accepted');
  const original = Object.keys(compileLab(mobileDevelopmentLab03(), LAB_ID).exercises);
  for (const id of original) assert.ok(EXERCISE_IDS.includes(id), `${id} keeps its progress`);
  assert.match(mdx, /<RepoSubmit lab="mobile-development--lab-03" \/>/);
});

test('registry ids match meta.ts and the page, in order, numbered 1…15, three hints each', () => {
  assert.deepEqual(exercises.map((e) => e.id), EXERCISE_IDS);
  assert.deepEqual(exercises.map((e) => e.n), exercises.map((_, i) => i + 1));
  assert.deepEqual([...mdx.matchAll(/<Exercise id="([^"]+)"/g)].map((m) => m[1]), EXERCISE_IDS);
  for (const e of exercises) assert.equal(e.hints.length, 3, `${e.id} has 3 hints`);
  // every exercise sits in the Part of its block
  const parts = [...mdx.matchAll(/<Part n="(\d+)"|<Exercise id="([^"]+)"/g)];
  let part = 0;
  for (const m of parts) {
    if (m[1]) part = Number(m[1]);
    else assert.equal(EXERCISES.find((e) => e.id === m[2])!.block, part, `${m[2]} is in Part ${part}`);
  }
});

for (const ex of codeExercises) {
  test(`${ex.title}: the reference solution passes every check`, async () => {
    const files = solutions[ex.id];
    assert.ok(files, `solution for ${ex.id} exists`);
    const out = await evaluate(ex, files, nodeRunner());
    assert.equal(out.status, 'pass', JSON.stringify({ failed: out.results.filter((r) => !r.pass), blocker: out.blocker }, null, 1));
  });

  test(`${ex.title}: the starter is not accepted and every failure teaches`, async () => {
    const out = await evaluate(ex, ex.files, nodeRunner());
    assert.notEqual(out.status, 'pass');
    assert.equal(out.results.length, ex.checks.length);
    for (const r of out.results) if (!r.pass) assert.ok(r.message && r.message.length > 10, `${ex.id}/${r.id} has a teaching message`);
  });
}

for (const m of mistakes) {
  test(`mistake — ${m.name}`, async () => {
    const out = await evaluate(byId(m.ex) as never, m.files, nodeRunner());
    const failed = out.results.filter((r) => !r.pass).map((r) => r.id);
    for (const id of m.fails) assert.ok(failed.includes(id), `${id} should fail; failed = ${failed}`);
    for (const id of m.passes ?? []) assert.ok(!failed.includes(id), `${id} should pass; failed = ${failed}`);
    assert.notEqual(out.status, 'pass');
  });
}

test('starter files compile', () => {
  for (const ex of codeExercises) {
    const c = compileAll(ex.files);
    assert.ok(c.ok, `${ex.id} starter compiles: ${JSON.stringify(!c.ok && c.errors)}`);
  }
});

test('every Lab 03 demo runs without errors', async () => {
  for (const demo of Object.values(demos)) {
    const runner = nodeRunner();
    const compiled = compileAll(demo.files);
    assert.ok(compiled.ok, `${demo.id} compiles: ${JSON.stringify(!compiled.ok && compiled.errors)}`);
    const r = await runner.run(compiled.ok ? compiled.files : {}, demo.entry, demo.frame);
    assert.equal(r.ok, true, `${demo.id}: ${JSON.stringify(r.error)}`);
    assert.ok((await runner.driver.text()).length > 0, `${demo.id} shows something`);
  }
});

test('the campus shell demo really navigates: tap an event, then Back', async () => {
  const runner = nodeRunner();
  const compiled = compileAll(demos['campus-shell'].files);
  assert.ok(compiled.ok);
  await runner.run(compiled.ok ? compiled.files : {}, 'App.tsx', 'phone');
  await runner.driver.press({ text: 'Campus Fair' });
  await runner.driver.wait(40);
  assert.match(await runner.driver.text(), /opened from featured/);
  await runner.driver.press({ text: 'Back' });
  await runner.driver.wait(40);
  assert.match(await runner.driver.text(), /Coding night/);
});

test('match and predict exercises: the right answers pass, a decoy or a wrong pick teaches', () => {
  for (const ex of exercises) {
    if (ex.kind === 'match') {
      const right = Object.fromEntries(ex.pairs.map((p) => [p.target, p.chip]));
      assert.equal(grade.gradeMatch(ex as never, right).status, 'pass', ex.id);
      if (ex.decoys?.length) {
        const out = grade.gradeMatch(ex as never, { ...right, [ex.pairs[0].target]: ex.decoys[0].chip });
        assert.notEqual(out.status, 'pass');
        assert.ok(out.results.some((r) => !r.pass && r.message?.includes(ex.decoys![0].why)), `${ex.id}: the decoy explains itself`);
      }
    }
    if (ex.kind === 'predict') {
      const right = ex.questions.map((q) => q.options.findIndex((o) => o.correct));
      assert.equal(grade.gradePredict(ex as never, right).status, 'pass', ex.id);
      for (const q of ex.questions) assert.equal(q.options.filter((o) => o.correct).length, 1, `${ex.id}: one right answer per question`);
    }
  }
});
