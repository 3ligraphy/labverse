// Every Lab 07 exercise: the full solution (the one students can open after every hint) passes every check, the
// starter does not (and each failing check teaches), typical mistakes get their own message, every demo runs, and
// the practice minutes per part match the 145-minute plan. Runs the real preview runtime in happy-dom, with the
// lab's camera (permission dialog, sample codes read three times) and haptics (lines in the console).
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register({ url: 'http://localhost/', width: 390, height: 844 });
const { createRuntime } = await import('../src/lab/runtime/core.ts');
const { evaluate } = await import('../src/lab/engine/checks.ts');
const grade = await import('../src/lab/engine/grade.ts');
const { compileAll } = await import('../src/lab/engine/compile.ts');
const { exercises, demos, FINAL_ID, BLOCKS } = await import('../src/lab/exercises/lab-07/index.ts');
const { EXERCISE_IDS, EXERCISES } = await import('../src/lab/exercises/lab-07/meta.ts');
const { INTERACTIVE_LABS } = await import('../src/lab/exercises/registry.ts');
const project = await import('../src/lab/exercises/lab-07/project.ts');

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

/** One app at a time, like one preview phone. The scan line animates forever, so every app is closed at the end. */
const live: { unmount(): void }[] = [];
const consoleLog = console.log;
after(() => {
  for (const r of live.splice(0)) r.unmount();
  console.log = consoleLog;
});

/** AppRunner backed by the real preview runtime in happy-dom. The app's console.log goes to the runtime's log, as in the browser. */
function nodeRunner() {
  for (const r of live.splice(0)) r.unmount();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const messages: { type: string; error?: { message: string } }[] = [];
  const runtime = createRuntime({ container, post: (m) => messages.push(m as never) });
  live.push(runtime);
  console.log = (...args: unknown[]) => runtime.log('log', args);
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
      logs: async () => (await runtime.rpc('logs', [])) as string[],
      rerun: async () => {
        await runtime.rpc('rerun', []);
      },
      storage: () => runtime.rpc('storage', []) as never,
      resetDevice: async () => {
        await runtime.rpc('reset-device', []);
      },
    },
  };
}

type Ex = (typeof exercises)[number];
const codeExercises = exercises.filter((e): e is Extract<Ex, { kind: 'code' | 'fix' }> => e.kind === 'code' || e.kind === 'fix');

test('registry: ids match meta.ts in page order, numbered 1…17, three hints and a full solution each', () => {
  assert.deepEqual(exercises.map((e) => e.id), EXERCISE_IDS);
  assert.deepEqual(exercises.map((e) => e.n), exercises.map((_, i) => i + 1));
  for (const e of exercises) {
    assert.equal(e.hints.length, 3, `${e.id} has 3 hints`);
    assert.ok(e.solution && e.solution.explain.length > 20, `${e.id} has a solution with an explanation`);
    assert.ok(e.solution!.files || e.solution!.text, `${e.id}'s solution shows the answer`);
    assert.ok(e.success.length > 20, `${e.id} explains why it works`);
    const meta = EXERCISES.find((m) => m.id === e.id)!;
    assert.equal(meta.kind, e.kind, `${e.id}: meta.ts says the same kind`);
    assert.equal(meta.title, e.title, `${e.id}: meta.ts has the same title`);
  }
  assert.equal(exercises.length, 17);
  assert.equal(FINAL_ID, 'lab-07--wifi-name');
  assert.equal(EXERCISES.filter((e) => e.final).map((e) => e.id).join(), FINAL_ID);
  assert.ok(INTERACTIVE_LABS['lab-07'], 'Lab 07 is registered as an interactive lab');
  assert.deepEqual(BLOCKS.map((b) => b.part), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('time: practice is 4 · 3 · 7 · 22 · 4 · 11 · 4 · 8 · 3 · 8 minutes per part (74 of the 145)', () => {
  const perPart = BLOCKS.map((b) => EXERCISES.filter((m) => m.block === b.part).reduce((sum, m) => sum + exercises.find((e) => e.id === m.id)!.minutes, 0));
  assert.deepEqual(perPart, [4, 3, 7, 22, 4, 11, 4, 8, 3, 8]);
  assert.equal(perPart.reduce((a, b) => a + b, 0), 74);
  // the blocks' times run from 0 to 145 without a gap
  let end = 0;
  for (const b of BLOCKS) {
    const [from, to] = b.time.split('–').map(Number);
    assert.equal(from, end, `part ${b.part} starts where the last one ended`);
    end = to;
  }
  assert.equal(end, 145);
});

test('the Part 4 steps build on each other: each solution is the next step’s starter', () => {
  const step = (name: string) => codeExercises.find((e) => e.id === `lab-07--${name}`)!;
  const SCREEN = 'src/screens/ScannerScreen.tsx';
  assert.equal(step('step-a-permission').solution!.files![SCREEN], step('step-b-scan-once').files[SCREEN]);
  assert.equal(step('step-b-scan-once').solution!.files![SCREEN], step('step-c-feedback').files[SCREEN]);
  assert.equal(step('step-c-feedback').solution!.files!['src/scan/feedback.ts'], step('step-d-flip').files['src/scan/feedback.ts']);
  assert.equal(step('step-d-flip').solution!.files![SCREEN], project.SCANNER, 'the last step ends with the real project file');
  // the file to edit opens first
  assert.equal(Object.keys(step('step-c-feedback').files)[0], 'src/scan/feedback.ts');
  assert.equal(Object.keys(step('wifi-name').files)[0], 'src/scan/parseScan.ts');
  assert.equal(Object.keys(step('step-a-permission').files)[0], SCREEN);
  // nobody's Expo account or project in the lab: no owner, no project id, no expo.dev account link, only example.com emails
  for (const text of Object.values(project).filter((v) => typeof v === 'string') as string[]) {
    assert.doesNotMatch(text, /"owner"|projectId|expo\.dev\/accounts\//);
    assert.doesNotMatch(text, /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/);
    for (const m of text.matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)) assert.match(m[0], /@example\.com$/);
  }
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
  const find = (id: string) => codeExercises.find((e) => e.id === `lab-07--${id}`)!;
  const SCREEN = 'src/screens/ScannerScreen.tsx';
  const failedOf = async (ex: Ex & { kind: 'code' | 'fix' }, files: Record<string, string>) => {
    const out = await quiet(() => evaluate(ex, files, nodeRunner()));
    return Object.fromEntries(out.results.filter((r) => !r.pass).map((r) => [r.id, r.message ?? '']));
  };

  // Step B with a useState lock: the new state arrives after all three reads, so the code is handled three times
  const b = find('step-b-scan-once');
  const solved = b.solution!.files![SCREEN];
  const stateLock = solved
    .replace('const locked = useRef(false);', 'const [locked, setLocked] = useState(false);')
    .replace('if (locked.current) return;\n    locked.current = true;', 'if (locked) return;\n    setLocked(true);')
    .replace('locked.current = false;', 'setLocked(false);');
  assert.notEqual(stateLock, solved, 'the lock was changed to state');
  const f1 = await failedOf(b, { ...b.files, [SCREEN]: stateLock });
  assert.match(f1.once ?? '', /3 times/);

  // Step B without opening the lock again: Scan again shows the camera, but the next code is ignored
  const neverOpened = solved.replace('    locked.current = false;\n', '');
  assert.notEqual(neverOpened, solved);
  const f2 = await failedOf(b, { ...b.files, [SCREEN]: neverOpened });
  assert.deepEqual(Object.keys(f2), ['again']);
  assert.match(f2.again, /locked\.current = false/);

  // Step C with the two patterns swapped
  const c = find('step-c-feedback');
  const good = c.solution!.files!['src/scan/feedback.ts'];
  const swapped = good.replace('NotificationFeedbackType.Success', 'NotificationFeedbackType.TEMP').replace('NotificationFeedbackType.Error', 'NotificationFeedbackType.Success').replace('NotificationFeedbackType.TEMP', 'NotificationFeedbackType.Error');
  const f3 = await failedOf(c, { ...c.files, 'src/scan/feedback.ts': swapped });
  assert.match(f3.calls ?? '', /swapped/);
  assert.match(f3['success-buzz'] ?? '', /Error/);

  // Step A that always offers Allow camera (never Open settings)
  const a = find('step-a-permission');
  const alwaysAsk = a.solution!.files![SCREEN].replace('{permission.canAskAgain ? (', '{true ? (');
  assert.notEqual(alwaysAsk, a.solution!.files![SCREEN]);
  const f4 = await failedOf(a, { ...a.files, [SCREEN]: alwaysAsk });
  assert.deepEqual(Object.keys(f4), ['settings']);
  assert.match(f4.settings, /Open settings/);

  // the final challenge that keeps the "S:" in front of the name
  const w = find('wifi-name');
  const keepsS = w.solution!.files!['src/scan/parseScan.ts'].replace('nameField.slice(2)', 'nameField');
  const f5 = await failedOf(w, { ...w.files, 'src/scan/parseScan.ts': keepsS });
  assert.ok(f5.name, 'S:Lab-5G is not the name');
  assert.equal(f5.secret, undefined, 'but the password is still hidden');
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
    await runner.driver.wait(200);
    assert.ok((await runner.driver.text()).length > 0, `${demo.id} shows something`);
  }
});

test('the scan-lock demo: one code with the lock is handled once, without it three times', async () => {
  const runner = nodeRunner();
  await runner.driver.resetDevice();
  const compiled = compileAll(demos['scan-lock'].files);
  assert.ok(compiled.ok);
  await quiet(() => runner.run(compiled.ok ? compiled.files : {}, 'App.tsx', 'phone'));
  const d = runner.driver;
  await d.wait(200);
  await d.press({ text: 'Allow camera' });
  await d.press({ text: 'While using the app' });
  await d.wait(150);
  await d.press({ text: 'QR: Website' });
  await d.wait(150);
  assert.match(await d.text(), /handleScan ran 1 times/);
  await d.press({ text: 'Lock: on' });
  await d.wait(100);
  await d.press({ text: 'QR: Website' });
  await d.wait(150);
  assert.match(await d.text(), /handleScan ran 3 times/);
});

test('Linking.openSettings opens the phone’s settings page, where the camera can be allowed again', async () => {
  const runner = nodeRunner();
  await runner.driver.resetDevice();
  const compiled = compileAll(demos['camera-permission'].files);
  assert.ok(compiled.ok);
  await quiet(() => runner.run(compiled.ok ? compiled.files : {}, 'App.tsx', 'phone'));
  const d = runner.driver;
  await d.wait(200);
  assert.match(await d.text(), /status: undetermined/);
  for (let i = 0; i < 2; i += 1) {
    await d.press({ text: 'requestPermission()' });
    await d.press({ text: 'Don’t allow' });
    await d.wait(60);
  }
  assert.match(await d.text(), /canAskAgain: false/);
  await d.press({ text: 'requestPermission()' });
  await d.wait(60);
  assert.doesNotMatch(await d.text(), /While using the app/, 'the dialog never comes back');
  await d.press({ text: 'Linking.openSettings()' });
  assert.match(await d.text(), /Settings › Apps/);
  await d.press({ text: 'Allow only while using the app' });
  await d.wait(80);
  assert.match(await d.text(), /granted: true/);
  assert.match(await d.text(), /Back camera/);
  assert.ok((await d.logs()).includes('Settings: camera allowed'));
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
      const chips = [...ex.pairs.map((p) => p.chip), ...(ex.decoys ?? []).map((d) => d.chip)];
      assert.equal(new Set(chips).size, chips.length, `${ex.id}: every chip is different`);
    }
  }
});
