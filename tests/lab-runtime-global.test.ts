// The lab phone (public/lab-runtime/runtime.js) runs in a browser, where Node's `global` does not exist.
// react-native-web's animations call `global.cancelAnimationFrame()` when they stop — e.g. Smart QR's scan frame when
// a scanned code replaces the camera — so a free `global` in the bundle crashed the result card ("global is not
// defined", Lab 07). The bundle must use `globalThis` instead.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildLabRuntime } from '../scripts/lab-runtime.mjs';

test('the phone runtime never uses Node’s `global` (it does not exist in a browser)', () => {
  buildLabRuntime();
  const js = readFileSync(new URL('../public/lab-runtime/runtime.js', import.meta.url), 'utf8');
  // `global.` as a free name: not `globalThis.`, not `x.global.`, not inside a word
  const free = js.match(/(?<![\w$.])global\.[A-Za-z_$]+/g) ?? [];
  assert.deepEqual([...new Set(free)], [], 'free `global` references in the bundle');
});
