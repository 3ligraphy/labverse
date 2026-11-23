/** Lab 07 helpers for checks: wait for the screen, walk from Home to the camera, read the haptics in the log. */
import type { PreviewDriver } from '../../runtime/protocol.ts';

/** The code of one file without comments, so a TODO comment never counts as code. */
export const code = (files: Record<string, string>, file: string) =>
  (files[file] ?? '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

export const SCREEN = 'src/screens/ScannerScreen.tsx';
export const FEEDBACK_FILE = 'src/scan/feedback.ts';
export const PARSE_FILE = 'src/scan/parseScan.ts';

/** Asks `test` again and again (the permission answer and the screens take a moment) until it passes or time is up. */
export async function until<T>(app: PreviewDriver, read: () => Promise<T>, test: (value: T) => boolean, ms = 4000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const value = await read();
    if (test(value) || Date.now() > end) return value;
    await app.wait(100);
  }
}

export const waitForText = (app: PreviewDriver, test: (text: string) => boolean, ms = 4000) => until(app, () => app.text(), test, ms);

/** The console lines that start with `prefix`, e.g. 'Haptics: ' or 'Scanned:'. */
export async function lines(app: PreviewDriver, prefix: string): Promise<string[]> {
  return (await app.logs()).filter((l) => l.startsWith(prefix));
}

const CAMERA_ON = /Back camera|Front camera/;
const SETTLED = /Back camera|Front camera|Camera permission needed|Camera error|Camera off|Open settings/;

/**
 * Home → Start scanning → the permission dialog (While using the app) → the camera.
 * `ok` is true when the viewfinder is on; `text` is what the screen shows at the end.
 */
export async function openCamera(app: PreviewDriver): Promise<{ ok: boolean; text: string }> {
  let text = await waitForText(app, (t) => /Start scanning/.test(t) || SETTLED.test(t), 3000);
  if (/Start scanning/.test(text)) {
    await app.press({ text: 'Start scanning' });
    text = await waitForText(app, (t) => SETTLED.test(t), 3000);
  }
  if (/Allow camera/.test(text)) {
    await app.press({ text: 'Allow camera' });
    await waitForText(app, (t) => /While using the app/.test(t), 2000);
    await app.press({ text: 'While using the app' });
    text = await waitForText(app, (t) => CAMERA_ON.test(t), 3000);
  }
  return { ok: CAMERA_ON.test(text), text };
}

/** Holds a sample code in front of the preview camera ("QR: Website", "QR: Wi-Fi", "QR: Text", "QR: Empty code"). */
export async function scan(app: PreviewDriver, label: 'Website' | 'Wi-Fi' | 'Text' | 'Empty code'): Promise<boolean> {
  return app.press({ text: `QR: ${label}` });
}

/** After a scan: waits for the result card (its Scan again button) and returns the screen text. */
export const waitForResult = (app: PreviewDriver, ms = 3000) => waitForText(app, (t) => /Scan again/.test(t), ms);

/** Escapes a name for use inside a RegExp. */
export const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
