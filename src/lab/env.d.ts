/** Injected by the lab-runtime Vite plugin (scripts/lab-runtime.mjs): hash of public/lab-runtime/runtime.js */
declare const __LAB_RUNTIME_VERSION__: string;

declare module 'react-native-web';

/** aes-js 3 (CommonJS, no bundled types): Lab 06's LargeSecureStore example runs with it in the preview */
declare module 'aes-js';
/** sql.js' browser build (no Node imports): the preview's SQLite engine (src/lab/runtime/sqlite.ts) */
declare module 'sql.js/dist/sql-wasm-browser.js';
