/**
 * ▶ Run: everything runs inside this browser tab, built in, with nothing to install.
 *   React Native  → the phone emulator (react-native-web: the same engine as the Mobile Development labs)
 *   React         → a browser preview of the app (components, state, CSS files)
 *   HTML/CSS/JS   → a browser preview of the page (CSS and scripts of the project are put in, links between pages work)
 *   JavaScript, TypeScript → a worker; output and prompt() in the terminal
 *   Python        → CPython in WebAssembly (Pyodide); output and input() in the terminal
 *   C++           → the course's C++ engine; output and cin in the terminal
 *   SQL           → SQLite in WebAssembly; schema.sql first, then the file; tables in the terminal
 * Previews update as you type.
 */
import * as monaco from 'monaco-editor';
import { basename, debounce, dirname, extname, h, join } from '../core/dom';
import { register, run } from '../core/commands';
import type { IDE } from '../core/ide';
import { TEMPLATES, type ProjectKind } from '../core/project';
import { compileAll } from '../../lab/engine/compile';
import { LabPreview } from '../../lab/engine/preview';
import { compile as cppCompile, Machine } from '../../lab/cpp/index';
import { uriOf } from '../ui/editors';
import { iconButton } from '../ui/workbench';
import { notify } from '../ui/widgets';
import type { Session, Terminals } from './terminal';

const DEVICES = [
  { id: 'fill', label: 'Responsive', w: 0, h: 0 }, { id: 'desktop', label: 'Desktop 1280×800', w: 1280, h: 800 },
  { id: 'tablet', label: 'Tablet 768×1024', w: 768, h: 1024 }, { id: 'mobile', label: 'Mobile 390×844', w: 390, h: 844 },
];
const PHONES = [
  { id: 'iphone', label: 'iPhone 15 · 393×852', w: 393, h: 852 }, { id: 'pixel', label: 'Pixel 8 · 412×915', w: 412, h: 915 },
  { id: 'small', label: 'Small Android · 360×740', w: 360, h: 740 }, { id: 'tablet', label: 'Tablet · 820×1180', w: 820, h: 1180 },
];
const CODE = /\.(tsx?|jsx?|mjs|cjs)$/;
const NOT_APP = /(^|\/)(babel|metro|tailwind|postcss|vite|webpack|jest|eslint|prettier|next|astro|app)\.config\.[cm]?[jt]s$|\.d\.ts$|(^|\/)(node_modules|dist|build|\.expo|android|ios|scripts|__tests__)\//;
/** Puts the preview's console.log and errors in the Output panel ("Preview"). */
const BRIDGE = `<script>(function(){var s=function(l,a){try{parent.postMessage({__idePreview:1,level:l,text:[].map.call(a,function(x){try{return typeof x==="string"?x:JSON.stringify(x)}catch(e){return String(x)}}).join(" ")},"*")}catch(e){}};["log","info","warn","error","debug"].forEach(function(l){var o=console[l];console[l]=function(){s(l,arguments);o.apply(console,arguments)}});addEventListener("error",function(e){s("error",[e.message+" ("+(e.filename||"page").split("/").pop()+":"+e.lineno+")"])});addEventListener("unhandledrejection",function(e){s("error",["Unhandled promise rejection: "+(e.reason&&e.reason.message||e.reason)])});document.addEventListener("click",function(e){var a=e.target&&e.target.closest&&e.target.closest("a[href]");if(!a)return;var h=a.getAttribute("href");if(!h||/^(https?:|mailto:|tel:|#|javascript:)/i.test(h))return;e.preventDefault();parent.postMessage({__idePreview:1,navigate:h},"*")},true)})()</` + 'script>';
const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon', avif: 'image/avif', mp3: 'audio/mpeg', mp4: 'video/mp4', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf' };

export function installRun(ide: IDE, terminals: Terminals) {
  const { fs, editors, wb, output } = ide;
  const sourceOf = async (path: string) => editors.getModelIfOpen(path)?.getValue() ?? (await fs.readText(path));

  /* ================================================================== what kind of project is this? */
  async function isReactNative(): Promise<boolean> {
    if (ide.ws.kind) return ide.ws.kind === 'react-native';
    try { const pkg = JSON.parse(await fs.readText('/package.json')); const d = { ...pkg.dependencies, ...pkg.devDependencies }; if (d['react-native'] || d.expo) return true; } catch { /* no package.json */ }
    for (const p of (await fs.walk('/')).filter((x) => CODE.test(x)).slice(0, 80)) if (/from\s+['"](react-native|expo-router|nativewind)['"]/.test(await sourceOf(p))) return true;
    return false;
  }
  /** The project's kind: chosen when it was made, or guessed from its files (older projects, imported ZIPs). */
  async function kindOf(): Promise<ProjectKind | null> {
    if (ide.ws.kind) return ide.ws.kind as ProjectKind;
    if (await isReactNative()) return 'react-native';
    const files = await fs.walk('/');
    const has = (re: RegExp) => files.some((f) => re.test(f));
    if (has(/\.jsx$|\.tsx$/) && files.some((f) => /App\.(jsx|tsx)$/.test(f))) return 'react';
    if (has(/\.html?$/)) return 'web';
    if (has(/\.py$/)) return 'python';
    if (has(/\.(cpp|cc|cxx)$/)) return 'cpp';
    if (has(/\.sql$/)) return 'sql';
    if (has(/\.ts$/)) return 'typescript';
    if (has(/\.m?js$/)) return 'javascript';
    return null;
  }

  /* ================================================================== the phone emulator (React Native) */
  async function codeFiles(): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const p of await fs.walk('/')) if (CODE.test(p) && !NOT_APP.test(p.slice(1))) out[p.slice(1)] = await sourceOf(p);
    return out;
  }
  function rnEntry(files: Record<string, string>): string | null {
    const has = (p: string) => p in files;
    for (const base of ['app', 'src/app']) for (const f of ['_layout', 'index']) for (const e of ['tsx', 'jsx', 'ts', 'js']) if (has(`${base}/${f}.${e}`)) return `${base}/${f}.${e}`;
    for (const f of ['App', 'src/App', 'index', 'src/index', 'main', 'src/main']) for (const e of ['tsx', 'jsx', 'ts', 'js']) if (has(`${f}.${e}`)) return `${f}.${e}`;
    const active = editors.activePath?.slice(1);
    return active && has(active) ? active : null;
  }
  const mark = (source: string, errors: { file: string; message: string; line: number; column: number; hint?: string }[]) => {
    for (const m of monaco.editor.getModels()) monaco.editor.setModelMarkers(m, source, []);
    for (const e of errors) {
      const model = monaco.editor.getModel(uriOf(`/${e.file}`));
      if (model) monaco.editor.setModelMarkers(model, source, [{ severity: monaco.MarkerSeverity.Error, message: e.hint ? `${e.message}\n${e.hint}` : e.message, startLineNumber: e.line, startColumn: e.column, endLineNumber: e.line, endColumn: model.getLineMaxColumn(Math.min(Math.max(1, e.line), model.getLineCount())), source }]);
    }
  };
  /** Re-runs `go` while the student types or files change (models of code files are watched). */
  function watchCode(go: () => void, test: (path: string) => boolean = (p) => CODE.test(p) || /\.css$/.test(p)) {
    const soon = debounce(go, 450);
    const offFs = fs.changed.on((e) => { if (test(e.path) || e.type !== 'write') soon(); });
    const listeners = new Map<monaco.editor.ITextModel, monaco.IDisposable>();
    const hook = () => { for (const m of monaco.editor.getModels()) if (m.uri.scheme === 'file' && test(m.uri.path) && !listeners.has(m)) listeners.set(m, m.onDidChangeContent(soon)); };
    hook();
    const offHook = monaco.editor.onDidCreateModel(hook);
    return () => { offFs(); offHook.dispose(); listeners.forEach((d) => d.dispose()); };
  }

  let emu: { reload: () => void } | null = null;
  const openEmulator = () => editors.openView('emulator', 'Phone Emulator', 'device-mobile', (el) => {
    let device = PHONES.find((d) => d.id === (localStorage.getItem('ide:phone') ?? 'iphone')) ?? PHONES[0];
    let landscape = false;
    const status = h('span', { class: 'ide-emu-status' });
    const screen = h('div', { class: 'ide-emu-screen' });
    const bezel = h('div', { class: 'ide-emu-device' }, screen);
    const box = h('div', { class: 'ide-emu-box' }, bezel);
    const stage = h('div', { class: 'ide-emu-stage' }, box);
    const select = h('select', { class: 'ide-select', 'aria-label': 'Device', onchange: () => { device = PHONES.find((d) => d.id === select.value)!; localStorage.setItem('ide:phone', device.id); fit(); } }, PHONES.map((d) => h('option', { value: d.id, selected: d === device }, d.label)));
    el.append(h('div', { class: 'ide-preview' },
      h('div', { class: 'ide-preview-bar' }, select, iconButton('refresh', 'Reload app', () => void go(true)), iconButton('device-mobile', 'Rotate', () => { landscape = !landscape; fit(); }), iconButton('output', 'Show app console (console.log)', () => output.show('Phone')), status),
      stage));
    const fit = () => {
      const w = landscape ? device.h : device.w; const hh = landscape ? device.w : device.h;
      const pad = 26;
      const k = Math.max(0.2, Math.min(1, (stage.clientWidth - 24) / (w + pad), (stage.clientHeight - 24) / (hh + pad)));
      bezel.style.width = `${w + pad}px`; bezel.style.height = `${hh + pad}px`;
      bezel.style.transform = `scale(${k})`;
      box.style.width = `${(w + pad) * k}px`; box.style.height = `${(hh + pad) * k}px`;
    };
    const ro = new ResizeObserver(fit); ro.observe(stage);
    const say = (text: string, bad = false) => { status.textContent = text; status.classList.toggle('bad', bad); };
    const preview = new LabPreview(screen, 'phone', {
      onLog: (level, text) => output.line('Phone', `${level === 'log' ? '' : `[${level}] `}${text}`),
      onError: (e) => { output.line('Phone', `[error] ${e.message}${e.file ? ` (${e.file}:${e.line})` : ''}`); say(e.message, true); },
    });
    let seq = 0;
    const go = async (manual = false) => {
      const mine = ++seq;
      const files = await codeFiles();
      const entry = rnEntry(files);
      if (!entry) { say('No app found: add App.tsx, or app/index.tsx for Expo Router.', true); return; }
      const compiled = compileAll(files);
      if (mine !== seq) return;
      if (!compiled.ok) { mark('emulator', compiled.errors); const e = compiled.errors[0]; say(`${e.file}:${e.line} — ${e.message}`, true); return; }
      mark('emulator', []);
      if (manual) output.clear('Phone');
      const r = await preview.run(compiled.files, entry, 'phone');
      if (mine !== seq) return;
      if (r.ok) say(`Running ${entry}`);
      else { const e = r.error!; if (e.file && e.line) mark('emulator', [{ file: e.file, message: e.message, line: e.line, column: e.column ?? 1, hint: e.hint }]); say(`${e.file ? `${e.file}:${e.line} — ` : ''}${e.message}`, true); output.line('Phone', `[error] ${e.message}${e.hint ? `\n        ${e.hint}` : ''}`); }
    };
    const unwatch = watchCode(() => void go());
    emu = { reload: () => void go(true) };
    // a timer, not requestAnimationFrame: a tab opened in the background must still start the app
    setTimeout(() => { fit(); void go(true); }, 0);
    return () => { ro.disconnect(); unwatch(); preview.destroy(); emu = null; mark('emulator', []); };
  }, true);

  /* ================================================================== browser previews (web page, React) */
  /** The browser frame shared by the page preview and the React preview: device sizes, reload, console. */
  function browserFrame(el: HTMLElement, title: string, onReload: () => void) {
    let device = DEVICES.find((d) => d.id === (localStorage.getItem('ide:device') ?? 'fill')) ?? DEVICES[0];
    const addr = h('span', { class: 'ide-preview-addr mono' }, title);
    const wrap = h('div', { class: 'ide-preview-wrap' });
    const stage = h('div', { class: 'ide-preview-stage' }, wrap);
    const size = h('select', { class: 'ide-select', 'aria-label': 'Screen size', onchange: () => { device = DEVICES.find((d) => d.id === size.value)!; localStorage.setItem('ide:device', device.id); fit(); } }, DEVICES.map((d) => h('option', { value: d.id, selected: d === device }, d.label)));
    const status = h('span', { class: 'ide-emu-status' });
    el.append(h('div', { class: 'ide-preview' },
      h('div', { class: 'ide-preview-bar' }, iconButton('refresh', 'Reload', onReload), addr, size, iconButton('output', 'Show page console (console.log)', () => output.show('Preview')), status),
      stage));
    const fit = () => {
      if (!device.w) { wrap.style.cssText = 'width:100%;height:100%;transform:none'; return; }
      const k = Math.min(1, (stage.clientWidth - 16) / device.w, (stage.clientHeight - 16) / device.h);
      wrap.style.cssText = `width:${device.w}px;height:${device.h}px;transform:scale(${k});box-shadow:0 0 0 1px var(--ide-border)`;
    };
    const ro = new ResizeObserver(fit); ro.observe(stage);
    fit();
    return { wrap, addr, say: (t: string, bad = false) => { status.textContent = t; status.classList.toggle('bad', bad); }, dispose: () => ro.disconnect() };
  }

  /** A web page with the project's own CSS, scripts and images put inside, so it runs without a server. */
  async function buildPage(path: string): Promise<string> {
    const dir = dirname(path);
    const doc = new DOMParser().parseFromString(await sourceOf(path), 'text/html');
    const local = (url: string | null) => Boolean(url) && !/^([a-z]+:|\/\/|#|data:)/i.test(url!);
    const resolve = (url: string) => join(url.startsWith('/') ? '/' : dir, url.split(/[?#]/)[0]);
    for (const link of [...doc.querySelectorAll('link[rel~="stylesheet"][href]')]) {
      const href = link.getAttribute('href');
      if (!local(href)) continue;
      const p = resolve(href!);
      const style = doc.createElement('style');
      style.textContent = (await fs.exists(p)) ? await sourceOf(p) : `/* ${href} was not found */`;
      link.replaceWith(style);
    }
    for (const script of [...doc.querySelectorAll('script[src]')]) {
      const src = script.getAttribute('src');
      if (!local(src)) continue;
      const p = resolve(src!);
      script.removeAttribute('src');
      script.textContent = (await fs.exists(p)) ? (await sourceOf(p)).replace(/<\/script/gi, '<\\/script') : `console.error(${JSON.stringify(`${src} was not found`)});`;
    }
    for (const media of [...doc.querySelectorAll('img[src], source[src], audio[src], video[src], link[rel~="icon"][href]')]) {
      const attr = media.hasAttribute('src') ? 'src' : 'href';
      const url = media.getAttribute(attr);
      if (!local(url)) continue;
      const p = resolve(url!);
      if (!(await fs.exists(p))) continue;
      const bytes = await fs.readBytes(p);
      if (bytes.length > 4_000_000) continue;
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      media.setAttribute(attr, `data:${MIME[extname(p)] ?? 'application/octet-stream'};base64,${btoa(bin)}`);
    }
    return `<!doctype html>${BRIDGE}${doc.documentElement.outerHTML}`;
  }

  let pagePath = '/index.html';
  let page: { reload: () => void } | null = null;
  const openPage = (path = pagePath) => {
    pagePath = path;
    if (page) { page.reload(); return editors.openView('preview', 'Preview', 'globe', renderPage, true); }
    return editors.openView('preview', 'Preview', 'globe', renderPage, true);
  };
  const renderPage = (el: HTMLElement) => {
    const frame = h('iframe', { class: 'ide-preview-frame', title: 'Page preview', sandbox: 'allow-scripts allow-modals allow-forms allow-popups' });
    const ui = browserFrame(el, pagePath.slice(1), () => void draw());
    ui.wrap.append(frame);
    let seq = 0;
    const draw = async () => {
      const mine = ++seq;
      if (!(await fs.exists(pagePath))) { ui.say(`${pagePath.slice(1)} was not found`, true); return; }
      const html = await buildPage(pagePath);
      if (mine !== seq) return;
      ui.addr.textContent = pagePath.slice(1);
      ui.say('');
      frame.srcdoc = html;
    };
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow || !e.data?.__idePreview || !e.data.navigate) return;
      const next = join(dirname(pagePath), String(e.data.navigate).split(/[?#]/)[0]);
      if (/\.html?$/.test(next)) { pagePath = next; void draw(); }
    };
    addEventListener('message', onMsg);
    const unwatch = watchCode(() => void draw(), (p) => /\.(html?|css|m?js|json|svg|png|jpe?g|gif|webp)$/i.test(p));
    page = { reload: () => void draw() };
    void draw();
    return () => { ui.dispose(); unwatch(); removeEventListener('message', onMsg); page = null; };
  };

  /** React (web): the project's components run in the lab engine's browser frame, with its CSS files added. */
  let react: { reload: () => void } | null = null;
  const openReact = () => editors.openView('react', 'React Preview', 'globe', (el) => {
    const ui = browserFrame(el, 'localhost:5173', () => void go(true));
    const preview = new LabPreview(ui.wrap, 'web', {
      onLog: (level, text) => output.line('Preview', `${level === 'log' ? '' : `[${level}] `}${text}`),
      onError: (e) => { output.line('Preview', `[error] ${e.message}${e.file ? ` (${e.file}:${e.line})` : ''}`); ui.say(e.message, true); },
    });
    let seq = 0;
    const go = async (manual = false) => {
      const mine = ++seq;
      const files = await codeFiles();
      const main = ['src/main.jsx', 'src/main.tsx', 'main.jsx', 'main.tsx', 'src/index.jsx', 'src/index.tsx'].find((p) => p in files);
      const app = ['src/App.jsx', 'src/App.tsx', 'App.jsx', 'App.tsx'].find((p) => p in files) ?? rnEntry(files);
      if (!main && !app) { ui.say('No app found: add src/App.jsx.', true); return; }
      // the CSS files of the project, added to the page before the app starts (the engine skips `import './x.css'`)
      const css: string[] = [];
      for (const p of await fs.walk('/')) if (/\.css$/.test(p)) css.push(await sourceOf(p));
      const withStyles: Record<string, string> = {
        ...files,
        '__ide_styles.js': `var s=document.getElementById('__ide_css')||document.head.appendChild(document.createElement('style'));s.id='__ide_css';s.textContent=${JSON.stringify(css.join('\n'))};`,
        '__ide_entry.js': `require('./__ide_styles.js');\n${main ? `require('./${main}');` : `module.exports = require('./${app}');`}`,
      };
      const compiled = compileAll(withStyles);
      if (mine !== seq) return;
      if (!compiled.ok) { mark('react', compiled.errors); const e = compiled.errors[0]; ui.say(`${e.file}:${e.line} — ${e.message}`, true); return; }
      mark('react', []);
      if (manual) output.clear('Preview');
      const r = await preview.run(compiled.files, '__ide_entry.js', 'web');
      if (mine !== seq) return;
      if (r.ok) ui.say('');
      else { const e = r.error!; if (e.file && e.line) mark('react', [{ file: e.file, message: e.message, line: e.line, column: e.column ?? 1, hint: e.hint }]); ui.say(`${e.file ? `${e.file}:${e.line} — ` : ''}${e.message}`, true); }
    };
    const unwatch = watchCode(() => void go());
    react = { reload: () => void go(true) };
    setTimeout(() => void go(true), 0);
    return () => { ui.dispose(); unwatch(); preview.destroy(); react = null; mark('react', []); };
  }, true);
  addEventListener('message', (e) => { const d = e.data; if (d && d.__idePreview === 1 && !d.navigate) output.line('Preview', `${d.level === 'log' ? '' : `[${d.level}] `}${d.text}`); });

  /* ================================================================== programs in the terminal */
  let runSession: Session | null = null;

  /** The course's C++ engine: cin reads what is typed in the terminal. */
  function runCpp(path: string, src: string) {
    const s = terminals.pseudo(`C++: ${basename(path)}`, 'cpp');
    runSession = s;
    const t = s.term;
    const model = monaco.editor.getModel(uriOf(path));
    const compiled = cppCompile(src);
    const diags = [...(compiled.ok ? [] : compiled.errors), ...compiled.warnings];
    if (model) monaco.editor.setModelMarkers(model, 'cpp', diags.map((d) => ({ severity: d.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning, message: d.hint ? `${d.message}\n${d.hint}` : d.message, startLineNumber: d.line, startColumn: d.col || 1, endLineNumber: d.line, endColumn: model.getLineMaxColumn(Math.min(Math.max(1, d.line), model.getLineCount())), source: 'C++' })));
    if (!compiled.ok) {
      for (const e of compiled.errors) t.writeln(`\x1b[31m${basename(path)}(${e.line}): error: ${e.message}\x1b[0m${e.hint ? `\r\n  \x1b[2m${e.hint}\x1b[0m` : ''}`);
      t.writeln(`\r\n\x1b[2mBuild failed: ${compiled.errors.length} error(s). Fix the lines underlined in red, then press Run again.\x1b[0m`);
      return;
    }
    for (const w of compiled.warnings) t.writeln(`\x1b[33m${basename(path)}(${w.line}): warning: ${w.message}\x1b[0m`);
    const m = new Machine(compiled.program, { interactive: true, maxSteps: 5_000_000 });
    let shown = 0;
    let line = '';
    const flush = () => { const out = m.segs.filter((x) => x.kind === 'out').map((x) => x.text).join(''); t.write(out.slice(shown)); shown = out.length; };
    const advance = () => {
      const st = m.run();
      flush();
      if (st === 'done') { t.writeln(`\r\n\x1b[2m[program exited with code ${m.exit}]\x1b[0m`); s.onInput = undefined; s.onKill = undefined; }
      else if (st === 'error') { t.writeln(`\r\n\x1b[31m${m.error?.message ?? 'Runtime error'}${m.error?.line ? ` (line ${m.error.line})` : ''}\x1b[0m${m.error?.hint ? `\r\n\x1b[2m${m.error.hint}\x1b[0m` : ''}`); s.onInput = undefined; s.onKill = undefined; }
    };
    s.onKill = () => { s.onInput = undefined; };
    s.onInput = (data) => {
      for (const ch of data) {
        if (ch === '\r') { t.write('\r\n'); m.feed(line, false); line = ''; advance(); }
        else if (ch === '\x7f') { if (line) { line = line.slice(0, -1); t.write('\b \b'); } }
        else if (ch === '\x03') { t.writeln('^C'); s.onInput = undefined; }
        else if (ch >= ' ') { line += ch; t.write(ch); }
      }
    };
    t.focus();
    advance();
  }

  /**
   * A worker program (Python or JavaScript/TypeScript) in a terminal: its output is written there, and when it
   * asks for input the typed line is handed to it through a shared buffer.
   */
  function workerProgram(name: string, key: string, worker: Worker, message: Record<string, unknown>, onDone?: (m: any) => void) {
    const s = terminals.pseudo(name, key);
    runSession = s;
    const t = s.term;
    const shared = new SharedArrayBuffer(8 + 65536);
    const ctl = new Int32Array(shared, 0, 2);
    const bytes = new Uint8Array(shared, 8);
    let waiting = false;
    let line = '';
    let statusShown = false;
    const give = (text: string | null) => {
      if (text === null) Atomics.store(ctl, 1, -1);
      else { const data = new TextEncoder().encode(text).slice(0, 65536); bytes.set(data); Atomics.store(ctl, 1, data.length); }
      waiting = false;
      Atomics.store(ctl, 0, 1); Atomics.notify(ctl, 0);
    };
    const end = (note: string) => { worker.terminate(); t.writeln(`\r\n\x1b[2m${note}\x1b[0m`); s.onInput = undefined; s.onKill = undefined; };
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'status') { if (statusShown) t.write('\x1b[2K\r'); statusShown = Boolean(m.text); if (m.text) t.write(`\x1b[2m${m.text}\x1b[0m`); }
      else if (m.type === 'out') t.write(m.text);
      else if (m.type === 'err') t.write(`${m.warn ? '\x1b[33m' : '\x1b[31m'}${m.text}\x1b[0m`);
      else if (m.type === 'input') { waiting = true; line = ''; t.focus(); }
      else if (m.type === 'done') { onDone?.(m); end(`[program exited with code ${m.exit}]`); }
    };
    worker.onerror = (e) => { t.writeln(`\x1b[31m${e.message}\x1b[0m`); end('[program stopped]'); };
    s.onKill = () => worker.terminate();
    s.onInput = (data) => {
      for (const ch of data) {
        if (ch === '\x03') { t.writeln('^C'); end('[stopped]'); return; }
        if (!waiting) continue;
        if (ch === '\r') { t.write('\r\n'); give(line + '\n'); }
        else if (ch === '\x7f') { if (line) { line = line.slice(0, -1); t.write('\b \b'); } }
        else if (ch === '\x04') give(null);
        else if (ch >= ' ') { line += ch; t.write(ch); }
      }
    };
    worker.postMessage({ ...message, shared });
    t.focus();
  }
  const needsIsolation = () => {
    if (typeof SharedArrayBuffer !== 'undefined') return false;
    notify('This needs a page that can share memory with workers. Reload the page in a current Chrome, Edge or Firefox.', 'error');
    return true;
  };

  async function runPython(path: string) {
    if (needsIsolation()) return;
    const files: Record<string, Uint8Array> = {};
    for (const f of await fs.walk('/')) { try { const b = await fs.readBytes(f); if (b.length < 8_000_000) files[f] = b; } catch { /* skip */ } }
    const worker = new Worker(new URL('./py.worker.ts', import.meta.url), { type: 'module' });
    workerProgram(`Python: ${basename(path)}`, 'python', worker, { type: 'run', path, files }, (m) => {
      // files the program wrote (open(…, 'w')) appear in the explorer
      void (async () => { for (const [f, data] of Object.entries(m.changed as Record<string, Uint8Array>)) await fs.write(f, data, 'runtime'); })();
    });
  }

  async function runScript(path: string) {
    if (needsIsolation()) return;
    const files: Record<string, string> = {};
    for (const f of await fs.walk('/')) if (/\.(m?[jt]sx?|cjs|json)$/.test(f)) { try { files[f] = await sourceOf(f); } catch { /* skip */ } }
    const worker = new Worker(new URL('./js.worker.ts', import.meta.url), { type: 'module' });
    workerProgram(`${/\.tsx?$/.test(path) ? 'TypeScript' : 'JavaScript'}: ${basename(path)}`, 'js', worker, { type: 'run', entry: path, files });
  }

  /** SQLite in WebAssembly: schema.sql (if there is one) runs first, then the file; each result is a table. */
  async function runSql(path: string) {
    const s = terminals.pseudo(`SQL: ${basename(path)}`, 'sql');
    runSession = s;
    const t = s.term;
    t.writeln('\x1b[2mLoading SQLite…\x1b[0m');
    const [{ default: initSqlJs }, { default: wasmUrl }] = await Promise.all([import('sql.js'), import('sql.js/dist/sql-wasm.wasm?url')]);
    const SQL = await initSqlJs({ locateFile: () => wasmUrl });
    const db = new SQL.Database();
    t.reset();
    const order: string[] = [];
    for (const pre of ['/schema.sql', '/setup.sql']) if (pre !== path && (await fs.exists(pre))) order.push(pre);
    order.push(path);
    let failed = false;
    for (const file of order) {
      const text = await sourceOf(file);
      t.writeln(`\x1b[36m── ${file.slice(1)} ──\x1b[0m`);
      try {
        for (const stmt of db.iterateStatements(text)) {
          // the statement without the comments written above it
          const sql = stmt.getSQL().replace(/^(\s*--[^\n]*\n)+/, '').trim();
          const cols = stmt.getColumnNames();
          const rows: unknown[][] = [];
          while (stmt.step()) rows.push(stmt.get());
          stmt.free();
          if (!cols.length) { if (file === path) t.writeln(`\x1b[2m✓ ${sql.split('\n')[0].slice(0, 70)}${db.getRowsModified() ? ` (${db.getRowsModified()} row${db.getRowsModified() === 1 ? '' : 's'})` : ''}\x1b[0m`); continue; }
          t.writeln(`\x1b[1m${sql.split('\n')[0].slice(0, 90)}\x1b[0m`);
          t.write(table(cols, rows));
          t.writeln(`\x1b[2m(${rows.length} row${rows.length === 1 ? '' : 's'})\x1b[0m\r\n`);
        }
      } catch (e) {
        t.writeln(`\x1b[31m${file.slice(1)}: ${e instanceof Error ? e.message : e}\x1b[0m`);
        failed = true;
        break;
      }
    }
    db.close();
    t.writeln(`\x1b[2m[${failed ? 'stopped at an error' : 'done'}]\x1b[0m`);
  }
  const table = (cols: string[], rows: unknown[][]) => {
    const cells = rows.map((r) => r.map((v) => (v === null ? 'NULL' : v instanceof Uint8Array ? `<${v.length} bytes>` : String(v))));
    const w = cols.map((c, i) => Math.min(40, Math.max(c.length, ...cells.map((r) => r[i].length))));
    const fmt = (r: string[]) => `│ ${r.map((x, i) => (x.length > w[i] ? x.slice(0, w[i] - 1) + '…' : x.padEnd(w[i]))).join(' │ ')} │\r\n`;
    return `┌${w.map((n) => '─'.repeat(n + 2)).join('┬')}┐\r\n${fmt(cols)}├${w.map((n) => '─'.repeat(n + 2)).join('┼')}┤\r\n${cells.map(fmt).join('')}└${w.map((n) => '─'.repeat(n + 2)).join('┴')}┘\r\n`;
  };

  /* ================================================================== ▶ Run */
  /** Runs one file by its type. */
  async function runFile(path: string) {
    const ext = extname(path);
    if (editors.isDirty(path)) await editors.save(path, true);
    if (ext === 'html' || ext === 'htm') return openPage(path);
    if (ext === 'cpp' || ext === 'cc' || ext === 'cxx') return runCpp(path, await sourceOf(path));
    if (ext === 'py') return runPython(path);
    if (ext === 'sql') return runSql(path);
    if (/^(tsx|jsx)$/.test(ext)) return (await isReactNative()) ? openEmulator() : openReact();
    if (/^(js|mjs|cjs|ts|mts)$/.test(ext)) {
      // a file of a React Native or React app runs the app, not the single file
      const k = await kindOf();
      if (k === 'react-native') return openEmulator();
      if (k === 'react') return openReact();
      if (k === 'web') return openPage();
      return runScript(path);
    }
    if (ext === 'css' || ext === 'json') {
      const k = await kindOf();
      if (k === 'react-native') return openEmulator();
      if (k === 'react') return openReact();
      if (k === 'web') return openPage();
    }
    notify(`.${ext || basename(path)} files cannot be run. Java, C#, Go, Rust, PHP, Ruby, Swift, Kotlin and Dart can be edited here, but running them needs a server.`, 'warning');
  }

  /** The Run button: the open file when it is a program, otherwise the project's app or main file. */
  async function start() {
    await editors.saveAll(true);
    const k = await kindOf();
    const active = editors.activePath;
    if (k === 'react-native') return openEmulator();
    if (k === 'react') return openReact();
    if (k === 'web') return openPage(active && /\.html?$/.test(active) ? active : (await fs.exists('/index.html')) ? '/index.html' : (await fs.walk('/')).find((f) => /\.html?$/.test(f)) ?? '/index.html');
    if (active && /\.(py|cpp|cc|cxx|sql|m?js|cjs|mts|ts)$/.test(active)) return runFile(active);
    const t = TEMPLATES.find((x) => x.id === k);
    const main = t && (await fs.exists(t.open)) ? t.open : (await fs.walk('/')).find((f) => /^\/(main|index|app)\.(py|cpp|m?js|ts|sql)$/i.test(f));
    if (main) return runFile(main);
    notify('Open the file you want to run, then press Run.');
  }

  const stop = () => {
    if (runSession && terminals.sessions.includes(runSession)) terminals.stopActive();
  };

  editors.tabActions = ((prev) => (g) => [iconButton('play', 'Run (F5)', () => run('run.start')), ...prev(g)])(editors.tabActions);
  editors.paintTabs();
  ide.explorer.extraMenu = ((prev) => (path, dir) => [...prev(path, dir), ...(!dir && /\.(html?|cpp|cc|py|m?js|ts|sql|tsx|jsx)$/.test(path) ? [{ label: 'Run File', run: () => runFile(path) }] : [])])(ide.explorer.extraMenu);

  register(
    { id: 'run.start', title: 'Run', category: 'Run', key: 'f5', run: start },
    { id: 'run.start2', title: 'Run (Ctrl+F5)', key: 'ctrl+f5', hidden: true, run: start },
    { id: 'run.file', title: 'Run Active File', category: 'Run', enabled: () => Boolean(editors.activePath), run: () => runFile(editors.activePath!) },
    { id: 'run.stop', title: 'Stop', category: 'Run', key: 'shift+f5', run: stop },
    { id: 'run.restart', title: 'Restart', category: 'Run', key: 'ctrl+shift+f5', run: () => { stop(); if (emu) emu.reload(); else if (react) react.reload(); else if (page) page.reload(); else void start(); } },
    { id: 'preview.open', title: 'Open Preview', category: 'View', run: start },
    { id: 'emulator.open', title: 'Open Phone Emulator (React Native)', category: 'Run', key: 'ctrl+alt+e', run: openEmulator },
    { id: 'emulator.reload', title: 'Reload Phone Emulator', category: 'Run', run: () => (emu ? emu.reload() : openEmulator()) },
  );
  return { openEmulator, openReact, openPage, runFile, isReactNative, kindOf, start };
}
