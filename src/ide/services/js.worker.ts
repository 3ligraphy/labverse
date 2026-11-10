/**
 * JavaScript and TypeScript programs, run in a worker (off the page, so an endless loop never freezes the IDE).
 * Each file is compiled with Sucrase (types removed, import/export → require), local files can import each
 * other, JSON files can be imported, `fetch` works, and `prompt()` reads a line typed in the terminal.
 * Messages in:  { type: 'run', entry, files: {path: text}, shared: SharedArrayBuffer }
 * Messages out: { type: 'out' | 'err', text } · { type: 'input' } · { type: 'done', exit }
 */
import { transform } from 'sucrase';

const post = (m: Record<string, unknown>) => (self as unknown as Worker).postMessage(m);
const dec = new TextDecoder();

function show(v: unknown, depth = 0): string {
  if (typeof v === 'string') return depth ? JSON.stringify(v) : v;
  if (v === undefined) return 'undefined';
  if (v === null || typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v) + (typeof v === 'bigint' ? 'n' : '');
  if (typeof v === 'function') return `[Function: ${v.name || 'anonymous'}]`;
  if (typeof v === 'symbol') return v.toString();
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  if (depth > 3) return Array.isArray(v) ? '[Array]' : '[Object]';
  if (Array.isArray(v)) return `[ ${v.map((x) => show(x, depth + 1)).join(', ')} ]`;
  if (v instanceof Map) return `Map(${v.size}) { ${[...v].map(([k, x]) => `${show(k, depth + 1)} => ${show(x, depth + 1)}`).join(', ')} }`;
  if (v instanceof Set) return `Set(${v.size}) { ${[...v].map((x) => show(x, depth + 1)).join(', ')} }`;
  if (v instanceof Date) return v.toISOString();
  if (v instanceof Promise) return 'Promise { <pending> }';
  const name = (v as object).constructor?.name;
  const body = Object.entries(v as object).map(([k, x]) => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${show(x, depth + 1)}`).join(', ');
  return `${name && name !== 'Object' ? `${name} ` : ''}{ ${body} }`.replace('{  }', '{}');
}
const line = (args: unknown[]) => args.map((a) => show(a)).join(' ') + '\n';

/* ---------------------------------------------------------------- knowing when the program is finished */
let pending = 0;
let mainDone = false;
let finished = false;
const realSetTimeout = setTimeout;
// checks on the real timer: a counted timer here would keep itself (and the program) alive forever
const settle = () => {
  realSetTimeout(() => {
    if (!finished && mainDone && pending <= 0) { finished = true; post({ type: 'done', exit: 0 }); }
  }, 0);
};
const realClearTimeout = clearTimeout;
const realSetInterval = setInterval;
const realClearInterval = clearInterval;
const timers = new Set<unknown>();
const intervals = new Set<unknown>();
(self as any).setTimeout = (fn: (...a: unknown[]) => void, ms?: number, ...args: unknown[]) => {
  pending++;
  const t = realSetTimeout(() => { timers.delete(t); pending--; try { fn(...args); } finally { settle(); } }, ms);
  timers.add(t);
  return t;
};
(self as any).clearTimeout = (t: ReturnType<typeof setTimeout>) => { if (timers.delete(t)) { pending--; settle(); } realClearTimeout(t); };
(self as any).setInterval = (fn: (...a: unknown[]) => void, ms?: number, ...args: unknown[]) => {
  pending++;
  const t = realSetInterval(() => fn(...args), ms);
  intervals.add(t);
  return t;
};
(self as any).clearInterval = (t: ReturnType<typeof setInterval>) => { if (intervals.delete(t)) { pending--; settle(); } realClearInterval(t); };
const realFetch = fetch.bind(self);
(self as any).fetch = (...a: Parameters<typeof fetch>) => {
  pending++;
  return realFetch(...a).finally(() => { pending--; settle(); });
};

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data as { type: string; entry: string; files: Record<string, string>; shared: SharedArrayBuffer };
  if (msg.type !== 'run') return;
  const ctl = new Int32Array(msg.shared, 0, 2);
  const bytes = new Uint8Array(msg.shared, 8);

  const c = console as unknown as Record<string, (...a: unknown[]) => void>;
  c.log = c.info = c.debug = (...a: unknown[]) => post({ type: 'out', text: line(a) });
  c.warn = (...a: unknown[]) => post({ type: 'err', text: line(a), warn: true });
  c.error = (...a: unknown[]) => post({ type: 'err', text: line(a) });
  c.table = (data: unknown) => {
    if (!data || typeof data !== 'object') return c.log(data);
    const rows = Object.entries(data as object);
    const cols = [...new Set(rows.flatMap(([, r]) => (r && typeof r === 'object' ? Object.keys(r) : ['Values'])))];
    const cells = rows.map(([k, r]) => [k, ...cols.map((col) => (r && typeof r === 'object' ? show((r as Record<string, unknown>)[col], 1) : col === 'Values' ? show(r, 1) : ''))]);
    const head = ['(index)', ...cols];
    const w = head.map((hd, i) => Math.max(hd.length, ...cells.map((r) => String(r[i]).length)));
    const fmt = (r: string[]) => `│ ${r.map((x, i) => String(x).padEnd(w[i])).join(' │ ')} │`;
    post({ type: 'out', text: [`┌${w.map((n) => '─'.repeat(n + 2)).join('┬')}┐`, fmt(head), `├${w.map((n) => '─'.repeat(n + 2)).join('┼')}┤`, ...cells.map(fmt), `└${w.map((n) => '─'.repeat(n + 2)).join('┴')}┘`].join('\n') + '\n' });
  };
  // prompt('Your name?') waits for a line typed in the terminal
  (self as any).prompt = (question = '') => {
    if (question) post({ type: 'out', text: String(question) + ' ' });
    Atomics.store(ctl, 0, 0);
    post({ type: 'input' });
    Atomics.wait(ctl, 0, 0);
    const n = Atomics.load(ctl, 1);
    return n < 0 ? null : dec.decode(bytes.slice(0, n)).replace(/\r?\n$/, '');
  };
  (self as any).alert = (text: unknown) => post({ type: 'out', text: `[alert] ${show(text)}\n` });

  const files = msg.files;
  const cache = new Map<string, { exports: any }>();
  const resolve = (from: string, spec: string): string | null => {
    const parts = (spec.startsWith('/') ? spec : from.slice(0, from.lastIndexOf('/')) + '/' + spec).split('/');
    const out: string[] = [];
    for (const s of parts) { if (!s || s === '.') continue; if (s === '..') out.pop(); else out.push(s); }
    const base = '/' + out.join('/');
    return [base, ...['.ts', '.js', '.mjs', '.cjs', '.tsx', '.jsx', '.json', '/index.ts', '/index.js'].map((x) => base + x)].find((p) => p in files) ?? null;
  };
  const compile = (path: string) => transform(files[path], {
    transforms: /\.tsx?$/.test(path) ? ['typescript', 'imports', ...(path.endsWith('x') ? ['jsx' as const] : [])] : /\.jsx$/.test(path) ? ['jsx', 'imports'] : ['imports'],
    filePath: path,
    production: true,
  }).code;
  const requireFrom = (from: string) => (spec: string) => {
    if (/^(\.|\/)/.test(spec)) {
      const f = resolve(from, spec);
      if (f) return load(f, false);
      throw new Error(`Cannot find the file '${spec}' (imported in ${from.slice(1)}). Check the name and the folder.`);
    }
    throw new Error(`The package '${spec}' is not available: programs here can use your own files, fetch and the built-in JavaScript objects (no npm packages).`);
  };
  const AsyncFunction = (async () => {}).constructor as new (...a: string[]) => (...a: unknown[]) => Promise<unknown>;
  function load(path: string, entry: boolean): any {
    const hit = cache.get(path);
    if (hit) return hit.exports;
    const mod = { exports: {} as any };
    cache.set(path, mod);
    if (path.endsWith('.json')) { mod.exports = JSON.parse(files[path]); return mod.exports; }
    const code = `${compile(path)}\n//# sourceURL=file://${path}`;
    if (entry) return new AsyncFunction('require', 'module', 'exports', '__filename', code)(requireFrom(path), mod, mod.exports, path);
    new Function('require', 'module', 'exports', '__filename', code)(requireFrom(path), mod, mod.exports, path);
    return mod.exports;
  }

  const report = (err: unknown) => {
    const stack = err instanceof Error ? String(err.stack ?? '') : '';
    const at = /file:\/\/(\/[^:)\s]+):(\d+):(\d+)/.exec(stack);
    // new Function / AsyncFunction put two lines of their own before the code
    const where = at ? `\n    at ${at[1].slice(1)}:${Math.max(1, Number(at[2]) - 2)}` : '';
    if (err instanceof SyntaxError || (err as { name?: string })?.name === 'SyntaxError') post({ type: 'err', text: `SyntaxError: ${(err as Error).message}${where}\n` });
    else post({ type: 'err', text: `Uncaught ${err instanceof Error ? `${err.name}: ${err.message}` : show(err)}${where}\n` });
  };
  self.addEventListener('unhandledrejection', (ev) => { ev.preventDefault(); report(ev.reason); });
  self.addEventListener('error', (ev) => { ev.preventDefault(); report(ev.error ?? ev.message); });

  try {
    await load(msg.entry, true);
  } catch (err) {
    report(err);
    finished = true;
    post({ type: 'done', exit: 1 });
    return;
  }
  mainDone = true;
  settle();
};
