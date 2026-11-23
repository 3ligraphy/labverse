// Lab 07: expo-camera and expo-haptics in the lab preview (src/lab/runtime/camera.tsx), rendered in happy-dom:
// the permission dialog, the viewfinder with sample codes, three reads per code, and haptics in the log.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register({ url: 'http://localhost/', width: 390, height: 844 });
const { createRuntime } = await import('../src/lab/runtime/core.ts');
const { compileAll } = await import('../src/lab/engine/compile.ts');
const { resetDevice } = await import('../src/lab/runtime/device.ts');

// the scan line animates forever: unmount every app at the end so the test process can exit
const runtimes: { unmount: () => void }[] = [];
after(() => {
  for (const r of runtimes) r.unmount();
});

function harness() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const runtime = createRuntime({ container, post: () => {} });
  runtimes.push(runtime);
  // the real preview sends console output to the runtime's log (src/lab/runtime/entry.ts); do the same here
  console.log = (...args: unknown[]) => runtime.log('log', args);
  let id = 0;
  async function run(files: Record<string, string>) {
    const compiled = compileAll(files);
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.errors));
    await runtime.run({ type: 'run', id: ++id, files: compiled.files, entry: 'App.tsx', frame: 'phone' });
  }
  const logs = async () => (await runtime.rpc('logs', [])) as string[];
  return { run, d: runtime.driver, logs };
}

const SCANNER = (lock: boolean) => `import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [data, setData] = useState<string | null>(null);
  const locked = useRef(false);

  function handleScan(scanned: string) {
    ${lock ? 'if (locked.current) return;\n    locked.current = true;' : ''}
    setData(scanned);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  if (!permission) return <Text>Checking camera permission…</Text>;
  if (!permission.granted) {
    return (
      <View>
        <Text>Camera permission needed</Text>
        {permission.canAskAgain ? (
          <Pressable onPress={requestPermission}><Text>Allow camera</Text></Pressable>
        ) : (
          <Text>Open settings</Text>
        )}
      </View>
    );
  }
  if (data) return <Text>Result: {data}</Text>;
  return <CameraView style={{ flex: 1 }} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={(scan) => handleScan(scan.data)} />;
}`;

const settle = (ms = 400) => new Promise((r) => setTimeout(r, ms));

test('the permission hook gives null first, then asks with the phone dialog', async () => {
  resetDevice();
  const { run, d } = harness();
  await run({ 'App.tsx': SCANNER(true) });
  assert.match(await d.text(), /Checking camera permission/);
  await settle(200);
  assert.match(await d.text(), /Camera permission needed/);
  assert.equal(await d.press({ text: 'Allow camera' }), true);
  assert.match(await d.text(), /Allow this app to take pictures/);
  assert.equal(await d.press({ text: 'While using the app' }), true);
  await settle(100);
  assert.match(await d.text(), /Back camera/);
  assert.doesNotMatch(await d.text(), /Allow this app/);
});

test('after two refusals the phone stops asking (canAskAgain false)', async () => {
  resetDevice();
  const { run, d } = harness();
  await run({ 'App.tsx': SCANNER(true) });
  await settle(200);
  await d.press({ text: 'Allow camera' });
  await d.press({ text: 'Don’t allow' });
  await settle(50);
  assert.match(await d.text(), /Allow camera/, 'Android asks a second time');
  await d.press({ text: 'Allow camera' });
  await d.press({ text: 'Don’t allow' });
  await settle(50);
  assert.match(await d.text(), /Open settings/);
});

test('a code is read three times: with a lock the app handles it once', async () => {
  resetDevice();
  const { run, d, logs } = harness();
  await run({ 'App.tsx': SCANNER(true) });
  await settle(200);
  await d.press({ text: 'Allow camera' });
  await d.press({ text: 'While using the app' });
  await settle(100);
  await d.press({ text: 'QR: Website' });
  await settle();
  assert.match(await d.text(), /Result: https:\/\/expo\.dev/);
  const buzzes = (await logs()).filter((l) => /Haptics: notification success/.test(l));
  assert.equal(buzzes.length, 1);
});

test('without a lock the same code is handled three times', async () => {
  resetDevice();
  const { run, d, logs } = harness();
  await run({ 'App.tsx': SCANNER(false) });
  await settle(200);
  await d.press({ text: 'Allow camera' });
  await d.press({ text: 'While using the app' });
  await settle(100);
  await d.press({ text: 'QR: Wi-Fi' });
  await settle();
  // the three reads arrive before React draws the result screen: without a useRef lock each one is handled
  const buzzes = (await logs()).filter((l) => /Haptics: notification success/.test(l));
  assert.equal(buzzes.length, 3);
});

const { projectFiles, SCANNER_A } = await import('../src/lab/exercises/lab-07/project.ts');

test('the real Smart QR project runs in the preview: permission, scan once, haptics, scan again, flip', async () => {
  resetDevice();
  const { run, d, logs } = harness();
  await run({ ...projectFiles() });
  assert.match(await d.text(), /Smart QR/);
  await d.press({ text: 'Start scanning' });
  await settle(200);
  assert.match(await d.text(), /Camera permission needed/);
  await d.press({ text: 'Allow camera' });
  await d.press({ text: 'While using the app' });
  await settle(150);
  assert.match(await d.text(), /Back camera/);
  await d.press({ text: 'QR: Website' });
  await settle(300);
  assert.match(await d.text(), /https:\/\/expo\.dev/);
  assert.match(await d.text(), /Website/);
  assert.equal((await logs()).filter((l) => l === 'Haptics: notification success').length, 1, 'scanned once, buzzed once');
  await d.press({ text: 'Scan again' });
  await settle(150);
  await d.press({ text: 'Flip camera' });
  await settle(100);
  assert.match(await d.text(), /Front camera/);
  assert.ok((await logs()).includes('Haptics: selection'));
  await d.press({ text: 'QR: Empty code' });
  await settle(300);
  assert.match(await d.text(), /This QR code is empty\./);
  assert.ok((await logs()).includes('Haptics: notification error'));
});

test('the Part 4 starter runs too: without permission the camera reports a mount error', async () => {
  resetDevice();
  const { run, d } = harness();
  await run({ ...projectFiles(SCANNER_A) });
  await d.press({ text: 'Start scanning' });
  await settle(200);
  assert.match(await d.text(), /Camera error: Camera permission is not granted/);
});
