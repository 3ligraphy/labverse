// Bundles the lab preview runtime (src/lab/runtime/entry.ts) into public/lab-runtime/runtime.js.
// It runs inside a sandboxed iframe, so it must be ONE classic script (no ES modules / CORS).
// Next to it: files the preview asks the page for when a lab needs them (src/lab/engine/preview.ts → loadAsset):
//   sql-wasm-browser.wasm  SQLite's engine (expo-sqlite in Lab 06), copied from sql.js
//   supabase.js            the real supabase-js, for a student's own Supabase project (src/lab/runtime/addons)
// Used by astro.config.mjs: built once when Astro starts, rebuilt in dev when runtime files change.
import { buildSync } from 'esbuild';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// absolute paths: works whatever folder the dev server / build is started from
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT_DIR = fileURLToPath(new URL('../public/lab-runtime/', import.meta.url));
const OUTFILE = fileURLToPath(new URL('../public/lab-runtime/runtime.js', import.meta.url));
const SUPABASE = fileURLToPath(new URL('../public/lab-runtime/supabase.js', import.meta.url));
const WASM_FROM = fileURLToPath(new URL('../node_modules/sql.js/dist/sql-wasm-browser.wasm', import.meta.url));
const WASM_TO = fileURLToPath(new URL('../public/lab-runtime/sql-wasm-browser.wasm', import.meta.url));

const common = {
  absWorkingDir: ROOT,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  legalComments: 'none',
  logLevel: 'warning',
};

export function buildLabRuntime() {
  mkdirSync(OUT_DIR, { recursive: true });
  buildSync({
    ...common,
    entryPoints: [fileURLToPath(new URL('../src/lab/runtime/entry.ts', import.meta.url))],
    outfile: OUTFILE,
    // any library asking for 'react-native' gets react-native-web (the real package can't run in a browser)
    alias: { 'react-native': 'react-native-web' },
    // `global` is Node's name for the global object; react-native-web uses it (global.cancelAnimationFrame when an
    // animation stops, global.performance), and a browser only has `globalThis`
    define: { 'process.env.NODE_ENV': '"production"', __DEV__: 'false', global: 'globalThis' },
  });
  buildSync({
    ...common,
    entryPoints: [fileURLToPath(new URL('../src/lab/runtime/addons/supabase-real.ts', import.meta.url))],
    outfile: SUPABASE,
  });
  copyFileSync(WASM_FROM, WASM_TO);
  const hash = createHash('sha256');
  for (const file of [OUTFILE, SUPABASE, WASM_TO]) hash.update(readFileSync(file));
  return hash.digest('hex').slice(0, 10);
}

/** Vite plugin: exposes __LAB_RUNTIME_VERSION__ (cache-busting) and rebuilds on change in dev. */
export function labRuntime() {
  let version = buildLabRuntime();
  return {
    name: 'lab-runtime',
    config() {
      return { define: { __LAB_RUNTIME_VERSION__: JSON.stringify(version) } };
    },
    configureServer(server) {
      server.watcher.on('change', (file) => {
        if (!file.replace(/\\/g, '/').includes('/src/lab/runtime/')) return;
        try {
          version = buildLabRuntime();
          server.ws.send({ type: 'full-reload' });
        } catch (error) {
          console.error('[lab-runtime] build failed:', error.message);
        }
      });
    },
  };
}
