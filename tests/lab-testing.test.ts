// Lab 07's in-browser test runner (src/lab/runtime/testing.ts): the Smart QR project's real Jest files — unit tests
// for parseScan and React Native Testing Library tests for ScannerScreen with a fake camera (jest.mock) — run in the
// lab preview runtime and give the same results as `npm test` did on a PC (12 passed), and failures read like Jest's.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register({ url: 'http://localhost/', width: 390, height: 844 });
const { createRuntime } = await import('../src/lab/runtime/core.ts');
const { compileAll } = await import('../src/lab/engine/compile.ts');
const P = await import('../src/lab/exercises/lab-07/project.ts');
type Run = import('../src/lab/runtime/protocol.ts').TestRun;

const runtimes: { unmount: () => void }[] = [];
after(() => runtimes.forEach((r) => r.unmount()));

async function run(files: Record<string, string>, paths?: string[]): Promise<Run> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const runtime = createRuntime({ container, post: () => {} });
  runtimes.push(runtime);
  const compiled = compileAll(files);
  assert.ok(compiled.ok, JSON.stringify(!compiled.ok && compiled.errors));
  return (await runtime.rpc('run-tests', [compiled.ok ? compiled.files : {}, paths])) as Run;
}

const project = (): Record<string, string> => ({
  ...P.projectFiles(),
  '__tests__/parseScan-test.ts': P.PARSE_TEST,
  '__tests__/ScannerScreen-test.tsx': P.SCREEN_TEST,
  'test-utils/fakeCamera.tsx': P.FAKE_CAMERA,
});
const summary = (r: Run) => r.files.map((f) => ({ file: f.file, error: f.error?.message, tests: f.tests.map((t) => `${t.status}: ${t.name}${t.error ? ` — ${t.error.message.split('\n')[0]}` : ''}`) }));

test('the real Smart QR tests pass: 7 unit tests and 5 component tests (fake camera, mocked haptics)', async () => {
  const r = await run(project());
  assert.deepEqual(r.files.map((f) => f.file), ['__tests__/ScannerScreen-test.tsx', '__tests__/parseScan-test.ts']);
  for (const f of r.files) assert.equal(f.error, undefined, JSON.stringify(summary(r), null, 1));
  const all = r.files.flatMap((f) => f.tests);
  assert.equal(all.filter((t) => t.status === 'passed').length, 12, JSON.stringify(summary(r), null, 1));
  assert.deepEqual(r.files[1].tests.map((t) => t.path), Array(7).fill(['parseScan']), 'the describe block names the group');
  // console.log in the app is kept with the results, with where it came from
  const logs = r.files[0].logs.filter((l) => l.text.startsWith('Scanned:'));
  assert.ok(logs.length >= 2, 'the Scanned: lines');
  assert.equal(logs[0].where?.file, 'src/screens/ScannerScreen.tsx');
});

test('a wrong expectation fails like Jest: the diff (− Expected, + Received) and the line of the test', async () => {
  const files = project();
  files['__tests__/parseScan-test.ts'] = P.PARSE_TEST.replace("expect(parseScan('')).toEqual({ ok: false, error: 'This QR code is empty.' });", "expect(parseScan('')).toEqual({ ok: false, error: 'The code is empty.' });");
  const r = await run(files, ['__tests__/parseScan-test.ts']);
  const failed = r.files[0].tests.filter((t) => t.status === 'failed');
  assert.equal(failed.length, 1);
  assert.equal(failed[0].name, 'an empty code is an error');
  const msg = failed[0].error!.message;
  assert.match(msg, /^expect\(received\)\.toEqual\(expected\) \/\/ deep equality/);
  assert.match(msg, /- Expected {2}- 1\n\+ Received {2}\+ 1/);
  assert.match(msg, /- {3}"error": "The code is empty\.",/);
  assert.match(msg, /\+ {3}"error": "This QR code is empty\.",/);
  assert.deepEqual(failed[0].error!.where && { file: failed[0].error!.where.file, line: failed[0].error!.where.line }, { file: '__tests__/parseScan-test.ts', line: 29 });
});

test('a component test catches a broken screen; a missing element gives React Native Testing Library’s message', async () => {
  const files = project();
  // the screen that always offers Allow camera (the Open settings branch is gone)
  files['src/screens/ScannerScreen.tsx'] = P.SCANNER.replace('{permission.canAskAgain ? (', '{true ? (');
  const r = await run(files, ['__tests__/ScannerScreen-test.tsx']);
  const failed = r.files[0].tests.filter((t) => t.status === 'failed');
  assert.deepEqual(failed.map((t) => t.name), ['sends the user to the settings when the phone will not ask again']);
  assert.match(failed[0].error!.message, /Unable to find an element with role: button, name: Open settings/);
});

test('jest.fn, toHaveBeenCalledWith, .not, toBe and a broken import are reported', async () => {
  const r = await run({
    'sum.ts': 'export const sum = (a: number, b: number) => a + b;',
    '__tests__/sum-test.ts': `import { sum } from '../sum';
test('adds', () => { expect(sum(2, 3)).toBe(5); });
test('wrong', () => { expect(sum(2, 2)).toBe(5); });
test('mocks', () => {
  const f = jest.fn().mockReturnValue(7);
  expect(f(1, 'x')).toBe(7);
  expect(f).toHaveBeenCalledWith(1, 'x');
  expect(f).not.toHaveBeenCalledWith(2);
  expect(f).toHaveBeenCalledTimes(1);
});
test.todo('later');`,
    // (an import that is never used is dropped, as TypeScript does: this one is used)
    '__tests__/broken-test.ts': "import { nope } from '../missing';\ntest('x', () => { expect(nope).toBe(1); });",
  });
  const sum = r.files.find((f) => f.file === '__tests__/sum-test.ts')!;
  assert.deepEqual(sum.tests.map((t) => t.status), ['passed', 'failed', 'passed', 'todo']);
  assert.match(sum.tests[1].error!.message, /Expected: 5\nReceived: 4/);
  const broken = r.files.find((f) => f.file === '__tests__/broken-test.ts')!;
  assert.match(broken.error!.message, /Cannot find '\.\.\/missing'/);
});
