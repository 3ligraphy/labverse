// Lab 07's Maestro runner (src/lab/engine/maestro.ts): the Smart QR project's real flow (.maestro/scan-sample.yaml)
// plays on the lab's preview phone like `maestro test` did on the Android emulator — every step COMPLETED, optional
// steps WARNED when there is nothing to tap, the first failed assertion stops the flow with Maestro's message.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register({ url: 'http://localhost/', width: 390, height: 844 });
const { createRuntime } = await import('../src/lab/runtime/core.ts');
const { compileAll } = await import('../src/lab/engine/compile.ts');
const { resetDevice } = await import('../src/lab/runtime/device.ts');
const { parseFlow, runFlow, flowLines } = await import('../src/lab/engine/maestro.ts');
const P = await import('../src/lab/exercises/lab-07/project.ts');

const runtimes: { unmount: () => void }[] = [];
after(() => runtimes.forEach((r) => r.unmount()));

async function phone() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const runtime = createRuntime({ container, post: () => {} });
  runtimes.push(runtime);
  const compiled = compileAll(P.projectFiles());
  assert.ok(compiled.ok);
  await runtime.run({ type: 'run', id: 1, files: compiled.ok ? compiled.files : {}, entry: 'App.tsx', frame: 'phone' });
  const d = runtime.driver;
  return {
    text: d.text,
    find: d.find,
    count: d.count,
    press: d.press,
    type: d.type,
    wait: d.wait,
    logs: async () => (await runtime.rpc('logs', [])) as string[],
    rerun: async () => {
      await runtime.rpc('rerun', []);
    },
    resetDevice: async () => {
      await runtime.rpc('reset-device', []);
    },
  };
}

test('the flow file is read like Maestro reads it: settings, ---, commands with inline and indented options', () => {
  const parsed = parseFlow(P.MAESTRO_FLOW);
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  assert.equal(parsed.flow.config.appId, 'host.exp.exponent');
  assert.deepEqual(parsed.flow.commands.map((c) => c.command), ['stopApp', 'openLink', 'extendedWaitUntil', 'tapOn', 'tapOn', 'tapOn', 'tapOn', 'assertVisible', 'assertVisible', 'takeScreenshot']);
  assert.deepEqual(parsed.flow.commands[2].arg, { visible: 'Start scanning', timeout: 60000 });
  assert.deepEqual(parsed.flow.commands[4].arg, { text: 'Allow camera', optional: true });
  assert.deepEqual(parsed.flow.commands[6].arg, { id: 'sample-scan' });
  const inline = parseFlow('appId: x\n---\n- tapOn: { text: "Allow camera", optional: true } # the dialog\n- launchApp');
  assert.ok(inline.ok && inline.flow.commands[0].arg && (inline.flow.commands[0].arg as { optional: boolean }).optional === true);
  assert.equal(parseFlow('- tapOn: "x"').ok, false, 'no --- line');
  const bad = parseFlow('appId: x\n---\ntapOn: x');
  assert.ok(!bad.ok && bad.line === 3);
});

test('the real scan-sample.yaml passes on the lab phone, step by step like the emulator run', async () => {
  resetDevice();
  const d = await phone();
  const r = await runFlow(P.MAESTRO_FLOW, d, { name: 'scan-sample' });
  assert.equal(r.ok, true, JSON.stringify(r.steps, null, 1));
  assert.deepEqual(flowLines(r).map((l) => l.text), [
    'Running on BUENOVA phone',
    ' > Flow scan-sample',
    'Stop host.exp.exponent... COMPLETED',
    'Open ${APP_URL}... COMPLETED',
    'Assert that "Start scanning" is visible... COMPLETED',
    'Tap on "Start scanning"... COMPLETED',
    'Tap on (Optional) "Allow camera"... COMPLETED',
    'Tap on (Optional) "While using the app"... COMPLETED',
    'Tap on id: sample-scan... COMPLETED',
    'Assert that "https://expo.dev" is visible... COMPLETED',
    'Assert that id: scan-again is visible... COMPLETED',
    'Take screenshot scan-result... COMPLETED',
  ]);
  // a second run: the camera is already allowed, so the optional taps find nothing and are WARNED, not failed
  const again = await runFlow(P.MAESTRO_FLOW, d, { name: 'scan-sample', timeouts: { optional: 300 } });
  assert.equal(again.ok, true);
  assert.deepEqual(again.steps.filter((s) => s.status === 'WARNED').map((s) => s.detail), ['Warning: Element not found: Text matching regex: Allow camera', 'Warning: Element not found: Text matching regex: While using the app']);
});

test('a wrong expectation stops the flow with Maestro’s message; an unknown command says what the phone can do', async () => {
  resetDevice();
  const d = await phone();
  const r = await runFlow(P.MAESTRO_FLOW.replace('assertVisible: "https://expo.dev"', 'assertVisible: "https://expo.com"'), d, { name: 'scan-fail', timeouts: { find: 600 } });
  assert.equal(r.ok, false);
  const last = r.steps.at(-1)!;
  assert.equal(last.text, 'Assert that "https://expo.com" is visible');
  assert.equal(last.detail, 'Assertion is false: "https://expo.com" is visible');
  assert.ok(!r.steps.some((s) => s.text.startsWith('Take screenshot')), 'the flow stops at the failure');
  const unknown = await runFlow('appId: x\n---\n- swipe: { direction: LEFT }', d);
  assert.match(unknown.steps[0].detail ?? '', /swipe is not available on the lab's phone/);
});
