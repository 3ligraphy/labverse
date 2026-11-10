/**
 * Run, preview and the phone emulator.
 *  - Phone emulator: React Native / Expo Router / NativeWind projects run in a phone frame, in this tab, on the
 *    same engine as the Mobile Development labs (react-native-web). It reloads as you type.
 *  - Web preview: dev servers started in the terminal (Vite, Express…) and static sites, in a browser frame.
 *  - Run File: Node.js / TypeScript in the terminal, C++ on the built-in C++ engine, HTML in the preview.
 */
import * as monaco from 'monaco-editor';
import { basename, clear, debounce, extname, h, icon } from '../core/dom';
import { register, run } from '../core/commands';
import type { IDE } from '../core/ide';
import { settings } from '../core/settings';
import { compileAll } from '../../lab/engine/compile';
import { LabPreview } from '../../lab/engine/preview';
import { compile as cppCompile, Machine } from '../../lab/cpp/index';
import { uriOf } from '../ui/editors';
import { iconButton } from '../ui/workbench';
import { notify, pick } from '../ui/widgets';
import type { Runtime } from './runtime';
import type { Session, Terminals } from './terminal';

const STATIC_PORT = 4173;
/** A tiny static file server run with `node -e` inside the runtime. HTML pages get a console bridge. */
const STATIC_SERVER = `
const http=require('http'),fs=require('fs'),path=require('path');
const T={html:'text/html',js:'text/javascript',mjs:'text/javascript',css:'text/css',json:'application/json',svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',ico:'image/x-icon',woff2:'font/woff2',woff:'font/woff',txt:'text/plain',wasm:'application/wasm',mp4:'video/mp4',mp3:'audio/mpeg',xml:'application/xml',md:'text/plain'};
const B='<script>(function(){var s=function(l,a){try{parent.postMessage({__idePreview:1,level:l,text:[].map.call(a,function(x){try{return typeof x==="string"?x:JSON.stringify(x)}catch(e){return String(x)}}).join(" ")},"*")}catch(e){}};["log","info","warn","error","debug"].forEach(function(l){var o=console[l];console[l]=function(){s(l,arguments);o.apply(console,arguments)}});addEventListener("error",function(e){s("error",[e.message+" ("+(e.filename||"").split("/").pop()+":"+e.lineno+")"])});addEventListener("unhandledrejection",function(e){s("error",["Unhandled promise rejection: "+(e.reason&&e.reason.message||e.reason)])})})()</'+'script>';
const root=process.cwd();
http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);let f=path.join(root,p);if(!f.startsWith(root)){res.writeHead(403);return res.end()}
try{if(fs.statSync(f).isDirectory())f=path.join(f,'index.html');let b=fs.readFileSync(f);const e=path.extname(f).slice(1).toLowerCase();
if(e==='html'){let s=b.toString();s=/<head[^>]*>/i.test(s)?s.replace(/<head[^>]*>/i,m=>m+B):B+s;b=Buffer.from(s)}
res.writeHead(200,{'content-type':(T[e]||'application/octet-stream')+(/^(html|js|mjs|css|json|txt|svg|xml|md)$/.test(e)?'; charset=utf-8':''),'cache-control':'no-store','cross-origin-resource-policy':'cross-origin'});res.end(b)}
catch(err){res.writeHead(404,{'content-type':'text/html'});res.end(B+'<body style="font:15px system-ui;padding:24px"><h2>404</h2><p>'+p.replace(/</g,'&lt;')+' was not found in the workspace.</p></body>')}
}).listen(${STATIC_PORT},()=>console.log('Static preview: http://localhost:${STATIC_PORT}'));`;

const DEVICES = [
  { id: 'fill', label: 'Responsive', w: 0, h: 0 }, { id: 'desktop', label: 'Desktop 1280×800', w: 1280, h: 800 },
  { id: 'tablet', label: 'Tablet 768×1024', w: 768, h: 1024 }, { id: 'mobile', label: 'Mobile 390×844', w: 390, h: 844 },
];
const PHONES = [
  { id: 'iphone', label: 'iPhone 15 · 393×852', w: 393, h: 852 }, { id: 'pixel', label: 'Pixel 8 · 412×915', w: 412, h: 915 },
  { id: 'small', label: 'Small Android · 360×740', w: 360, h: 740 }, { id: 'tablet', label: 'Tablet · 820×1180', w: 820, h: 1180 },
];

export function installRun(ide: IDE, runtime: Runtime, terminals: Terminals) {
  const { fs, editors, wb, output } = ide;

  /* ================================================================== phone emulator */
  const RN_FILE = /\.(tsx?|jsx?)$/;
  const NOT_APP = /(^|\/)(babel|metro|tailwind|postcss|vite|webpack|jest|eslint|prettier|next|astro|app)\.config\.[cm]?[jt]s$|\.d\.ts$|(^|\/)(node_modules|dist|build|\.expo|android|ios|scripts|__tests__)\//;
  const sourceOf = async (path: string) => editors.getModelIfOpen(path)?.getValue() ?? (await fs.readText(path));
  async function rnFiles(): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const p of await fs.walk('/')) if (RN_FILE.test(p) && !NOT_APP.test(p.slice(1))) out[p.slice(1)] = await sourceOf(p);
    return out;
  }
  /** Is this a React Native / Expo project? (package.json, or any file importing react-native) */
  async function isReactNative(): Promise<boolean> {
    try { const pkg = JSON.parse(await fs.readText('/package.json')); const d = { ...pkg.dependencies, ...pkg.devDependencies }; if (d['react-native'] || d.expo) return true; } catch { /* no package.json */ }
    for (const p of (await fs.walk('/')).filter((x) => RN_FILE.test(x)).slice(0, 80)) if (/from\s+['"](react-native|expo-router|nativewind)['"]/.test(await sourceOf(p))) return true;
    return false;
  }
  function rnEntry(files: Record<string, string>): string | null {
    const has = (p: string) => p in files;
    for (const base of ['app', 'src/app']) for (const f of ['_layout', 'index']) for (const e of ['tsx', 'jsx', 'ts', 'js']) if (has(`${base}/${f}.${e}`)) return `${base}/${f}.${e}`;
    for (const f of ['App', 'src/App', 'index', 'src/index', 'main', 'src/main']) for (const e of ['tsx', 'jsx', 'ts', 'js']) if (has(`${f}.${e}`)) return `${f}.${e}`;
    const active = editors.activePath?.slice(1);
    return active && has(active) ? active : null;
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
    const consoleBtn = iconButton('output', 'Show app console (console.log)', () => output.show('Phone'));
    el.append(h('div', { class: 'ide-preview' },
      h('div', { class: 'ide-preview-bar' }, select, iconButton('refresh', 'Reload app', () => void go(true)), iconButton('device-mobile', 'Rotate', () => { landscape = !landscape; fit(); }), consoleBtn, status),
      stage));
    const fit = () => {
      const w = landscape ? device.h : device.w; const hh = landscape ? device.w : device.h;
      const pad = 26;
      const scale = Math.min(1, (stage.clientWidth - 24) / (w + pad), (stage.clientHeight - 24) / (hh + pad));
      const k = Math.max(0.2, scale);
      bezel.style.width = `${w + pad}px`; bezel.style.height = `${hh + pad}px`;
      bezel.style.transform = `scale(${k})`;
      box.style.width = `${(w + pad) * k}px`; box.style.height = `${(hh + pad) * k}px`;
    };
    const ro = new ResizeObserver(fit); ro.observe(stage);
    const preview = new LabPreview(screen, 'phone', {
      onLog: (level, text) => output.line('Phone', `${level === 'log' ? '' : `[${level}] `}${text}`),
      onError: (e) => { output.line('Phone', `[error] ${e.message}${e.file ? ` (${e.file}:${e.line})` : ''}`); say(e.message, true); },
    });
    const say = (text: string, bad = false) => { status.textContent = text; status.classList.toggle('bad', bad); };
    const mark = (errors: { file: string; message: string; line: number; column: number; hint?: string }[]) => {
      for (const m of monaco.editor.getModels()) monaco.editor.setModelMarkers(m, 'emulator', []);
      for (const e of errors) {
        const model = monaco.editor.getModel(uriOf(`/${e.file}`));
        if (model) monaco.editor.setModelMarkers(model, 'emulator', [{ severity: monaco.MarkerSeverity.Error, message: e.hint ? `${e.message}\n${e.hint}` : e.message, startLineNumber: e.line, startColumn: e.column, endLineNumber: e.line, endColumn: model.getLineMaxColumn(Math.min(e.line, model.getLineCount())), source: 'emulator' }]);
      }
    };
    let seq = 0;
    const go = async (manual = false) => {
      const mine = ++seq;
      const files = await rnFiles();
      const entry = rnEntry(files);
      if (!entry) { say('No app found: add App.tsx, or app/index.tsx for Expo Router.', true); return; }
      const compiled = compileAll(files);
      if (mine !== seq) return;
      if (!compiled.ok) { mark(compiled.errors); const e = compiled.errors[0]; say(`${e.file}:${e.line} — ${e.message}`, true); return; }
      mark([]);
      if (manual) output.clear('Phone');
      const r = await preview.run(compiled.files, entry, 'phone');
      if (mine !== seq) return;
      if (r.ok) say(`Running ${entry}`);
      else { const e = r.error!; if (e.file && e.line) mark([{ file: e.file, message: e.message, line: e.line, column: e.column ?? 1, hint: e.hint }]); say(`${e.file ? `${e.file}:${e.line} — ` : ''}${e.message}`, true); output.line('Phone', `[error] ${e.message}${e.hint ? `\n        ${e.hint}` : ''}`); }
    };
    const soon = debounce(() => void go(), 450);
    const offFs = fs.changed.on((e) => { if (RN_FILE.test(e.path) || e.type !== 'write') soon(); });
    const offModel = monaco.editor.onDidCreateModel(() => soon());
    const listeners = new Map<monaco.editor.ITextModel, monaco.IDisposable>();
    const hook = () => { for (const m of monaco.editor.getModels()) if (m.uri.scheme === 'file' && RN_FILE.test(m.uri.path) && !listeners.has(m)) listeners.set(m, m.onDidChangeContent(soon)); };
    hook();
    const offHook = monaco.editor.onDidCreateModel(hook);
    emu = { reload: () => void go(true) };
    requestAnimationFrame(() => { fit(); void go(true); });
    return () => { ro.disconnect(); offFs(); offModel.dispose(); offHook.dispose(); listeners.forEach((d) => d.dispose()); preview.destroy(); emu = null; for (const m of monaco.editor.getModels()) monaco.editor.setModelMarkers(m, 'emulator', []); };
  }, true);

  /* ================================================================== web preview */
  let preview: { show: (url: string) => void; reload: () => void; url: string } | null = null;
  let lastUrl = '';
  let staticProc: { kill: () => void } | null = null;
  const openPreview = (url?: string) => {
    if (url) lastUrl = url;
    if (preview) { if (url) preview.show(url); void editors.openView('preview', 'Preview', 'globe', renderPreview, true); return; }
    return editors.openView('preview', 'Preview', 'globe', renderPreview, true);
  };
  const renderPreview = (el: HTMLElement) => {
    let device = DEVICES[0];
    const frame = h('iframe', { class: 'ide-preview-frame', title: 'Preview', allow: 'cross-origin-isolated; clipboard-read; clipboard-write' });
    const wrap = h('div', { class: 'ide-preview-wrap' }, frame);
    const stage = h('div', { class: 'ide-preview-stage' }, wrap);
    const addr = h('input', { class: 'ide-input', type: 'text', spellcheck: false, 'aria-label': 'Address', placeholder: 'Start a dev server in the terminal, or press Run on an HTML file' });
    const ports = h('select', { class: 'ide-select', 'aria-label': 'Port', title: 'Servers running in the runtime' });
    const size = h('select', { class: 'ide-select', 'aria-label': 'Device size', onchange: () => { device = DEVICES.find((d) => d.id === size.value)!; fit(); } }, DEVICES.map((d) => h('option', { value: d.id }, d.label)));
    const fit = () => {
      if (!device.w) { wrap.style.cssText = 'width:100%;height:100%;transform:none'; return; }
      const scale = Math.min(1, (stage.clientWidth - 16) / device.w, (stage.clientHeight - 16) / device.h);
      wrap.style.cssText = `width:${device.w}px;height:${device.h}px;transform:scale(${scale});box-shadow:0 0 0 1px var(--ide-border)`;
    };
    const show = (url: string) => { lastUrl = url; addr.value = url; frame.src = url; api.url = url; };
    const paintPorts = () => {
      clear(ports).append(h('option', { value: '' }, runtime.ports.size ? 'Ports' : 'No servers'), ...[...runtime.ports].map(([p, u]) => h('option', { value: u }, `Port ${p}`)));
      ports.disabled = !runtime.ports.size;
    };
    ports.addEventListener('change', () => { if (ports.value) show(ports.value); });
    addr.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      let v = addr.value.trim();
      // a path keeps the current server; "localhost:3000/x" is mapped to that port's preview address
      const m = /^(?:https?:\/\/)?localhost:(\d+)(\/.*)?$/.exec(v);
      if (m && runtime.ports.has(Number(m[1]))) v = runtime.ports.get(Number(m[1]))!.replace(/\/$/, '') + (m[2] ?? '');
      else if (v.startsWith('/') && lastUrl) v = new URL(v, lastUrl).href;
      if (v) show(v);
    });
    const api = { show, reload: () => { if (frame.src) frame.src = frame.src; }, url: '' };
    el.append(h('div', { class: 'ide-preview' },
      h('div', { class: 'ide-preview-bar' }, iconButton('refresh', 'Reload', () => api.reload()), addr, ports, size,
        iconButton('output', 'Show page console', () => output.show('Preview')),
        iconButton('link-external', 'Open in a new browser tab', () => { if (api.url) window.open(api.url, '_blank', 'noopener'); })),
      stage));
    const ro = new ResizeObserver(fit); ro.observe(stage);
    const off = runtime.portsChanged.on(paintPorts);
    paintPorts(); fit();
    preview = api;
    if (lastUrl) show(lastUrl);
    return () => { ro.disconnect(); off(); preview = null; };
  };
  window.addEventListener('message', (e) => { const d = e.data; if (d && d.__idePreview === 1) output.line('Preview', `${d.level === 'log' ? '' : `[${d.level}] `}${d.text}`); });
  runtime.portsChanged.on((p) => {
    if (!p) return;
    output.line('Runtime', `Server ready on port ${p.port}: ${p.url}`);
    wb.status('ports', 'left', 40, { iconName: 'radio-tower', text: [...runtime.ports.keys()].join(', '), title: 'Servers running in the runtime — click to open the preview', command: 'preview.open' });
    void openPreview(p.url);
  });
  // a static site reloads when a file is saved (dev servers have their own hot reload)
  const reloadStatic = debounce(() => { if (preview && settings.get('preview.autoRefresh') && preview.url.includes(`${STATIC_PORT}`) || preview && [...runtime.ports].some(([port, u]) => port === STATIC_PORT && preview!.url.startsWith(u))) preview!.reload(); }, 300);
  editors.saved.on(reloadStatic);

  async function staticPreview(path = '/index.html') {
    const page = path.replace(/^\//, '');
    const known = runtime.ports.get(STATIC_PORT);
    if (known) { await openPreview(`${known.replace(/\/$/, '')}/${page === 'index.html' ? '' : page}`); return; }
    wb.showPanel('terminal');
    const s = await terminals.create({ name: 'static preview', command: 'node', args: ['-e', STATIC_SERVER], key: 'static' });
    if (!s) return;
    staticProc = { kill: () => terminals.kill(s) };
    const off = runtime.portsChanged.on((p) => { if (p?.port === STATIC_PORT) { off(); if (page !== 'index.html') void openPreview(`${p.url.replace(/\/$/, '')}/${page}`); } });
  }

  /* ================================================================== run */
  let runSession: Session | null = null;
  let last: (() => unknown) | null = null;
  const scripts = async (): Promise<Record<string, string>> => { try { return JSON.parse(await fs.readText('/package.json')).scripts ?? {}; } catch { return {}; } };
  const needsInstall = async () => (await fs.exists('/package.json')) && runtime.wc !== null && !(await runtime.wc.fs.readdir('node_modules').then(() => true, () => false));

  /** The built-in C++ engine (the course's C++ subset), in a terminal: cin reads what you type. */
  function runCpp(path: string, src: string) {
    wb.showPanel('terminal');
    const s = terminals.pseudo(`C++: ${basename(path)}`, 'cpp');
    runSession = s;
    const t = s.term;
    const model = monaco.editor.getModel(uriOf(path));
    const compiled = cppCompile(src);
    const diags = [...(compiled.ok ? [] : compiled.errors), ...compiled.warnings];
    if (model) monaco.editor.setModelMarkers(model, 'cpp', diags.map((d) => ({ severity: d.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning, message: d.hint ? `${d.message}\n${d.hint}` : d.message, startLineNumber: d.line, startColumn: d.col || 1, endLineNumber: d.line, endColumn: model.getLineMaxColumn(Math.min(Math.max(1, d.line), model.getLineCount())), source: 'C++' })));
    if (!compiled.ok) {
      for (const e of compiled.errors) t.writeln(`\x1b[31m${basename(path)}(${e.line}): error: ${e.message}\x1b[0m${e.hint ? `\r\n  \x1b[2m${e.hint}\x1b[0m` : ''}`);
      t.writeln(`\r\n\x1b[2mBuild failed: ${compiled.errors.length} error(s).\x1b[0m`);
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
      if (st === 'done') { t.writeln(`\r\n\x1b[2m[program exited with code ${m.exit}]\x1b[0m`); s.onInput = undefined; }
      else if (st === 'error') { t.writeln(`\r\n\x1b[31m${m.error?.message ?? 'Runtime error'}${m.error?.line ? ` (line ${m.error.line})` : ''}\x1b[0m${m.error?.hint ? `\r\n\x1b[2m${m.error.hint}\x1b[0m` : ''}`); s.onInput = undefined; }
    };
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

  async function runFile(path: string) {
    const ext = extname(path);
    const file = path.slice(1);
    const q = JSON.stringify(file);
    if (editors.isDirty(path)) await editors.save(path);
    if (ext === 'html' || ext === 'htm') return staticPreview(path);
    if (ext === 'cpp' || ext === 'cc' || ext === 'cxx') return runCpp(path, await fs.readText(path));
    if (/^(tsx|jsx)$/.test(ext) && (await isReactNative())) return openEmulator();
    const cmd = /^(js|mjs|cjs)$/.test(ext) ? `node ${q}` : /^(ts|mts|tsx|jsx)$/.test(ext) ? `npx -y tsx ${q}` : ext === 'py' ? `python3 ${q}` : ext === 'sh' ? `source ${q}` : null;
    if (!cmd) { notify(`There is no runner for .${ext} files in the browser runtime. Java, C#, Go, Rust, PHP, Ruby, Swift, Kotlin and Dart need a server-side runtime, which this IDE does not have.`, 'warning'); return; }
    runSession = await terminals.send(cmd, { key: 'run', name: 'run' });
  }

  async function start() {
    const path = editors.activePath;
    const all = await scripts();
    // a React Native / Expo project runs in the phone emulator
    if (await isReactNative()) { last = openEmulator; return openEmulator(); }
    if (path && /\.(html?|cpp|cc|cxx|py|sh|js|mjs|cjs|ts|mts)$/.test(path) && !(all.dev || all.start) ) { last = () => runFile(path); return runFile(path); }
    const script = all.dev ? 'dev' : all.start ? 'start' : null;
    if (script) { last = () => npm(script); return npm(script); }
    if (path) { last = () => runFile(path); return runFile(path); }
    if (await fs.exists('/index.html')) { last = () => staticPreview(); return staticPreview(); }
    notify('Open a file to run it, or add a "dev" or "start" script to package.json.');
  }
  async function npm(script: string) {
    wb.showPanel('terminal');
    await runtime.boot();
    const install = (await needsInstall()) ? 'npm install && ' : '';
    runSession = await terminals.send(`${install}npm run ${script}`, { key: 'run', name: `npm: ${script}` });
  }
  const stop = () => {
    if (runSession && terminals.sessions.includes(runSession)) { if (runSession.proc) terminals.interrupt(runSession); else terminals.kill(runSession); }
    staticProc?.kill(); staticProc = null;
  };

  editors.tabActions = ((prev) => (g) => [iconButton('play', 'Run (F5 debugs, Ctrl+F5 runs)', () => run('run.start')), iconButton('device-mobile', 'Phone Emulator (React Native)', () => run('emulator.open')), ...prev(g)])(editors.tabActions);
  editors.paintTabs();
  ide.explorer.extraMenu = ((prev) => (path, dir) => [...prev(path, dir), ...(!dir && /\.(html?|cpp|cc|py|js|mjs|ts|sh|tsx|jsx)$/.test(path) ? [{ label: 'Run File', run: () => runFile(path) }] : []), ...(!dir && /\.html?$/.test(path) ? [{ label: 'Open in Preview', run: () => staticPreview(path) }] : [])])(ide.explorer.extraMenu);

  register(
    { id: 'run.start', title: 'Run Without Debugging', category: 'Run', key: 'ctrl+f5', run: start },
    { id: 'run.file', title: 'Run Active File', category: 'Run', enabled: () => Boolean(editors.activePath), run: () => runFile(editors.activePath!) },
    { id: 'terminal.runFile', title: 'Run Active File in Terminal', category: 'Terminal', enabled: () => Boolean(editors.activePath), run: () => runFile(editors.activePath!) },
    { id: 'run.stop', title: 'Stop', category: 'Run', key: 'shift+f5', run: stop },
    { id: 'run.restart', title: 'Restart', category: 'Run', key: 'ctrl+shift+f5', run: async () => { stop(); await new Promise((r) => setTimeout(r, 500)); if (emu) emu.reload(); else await (last ?? start)(); } },
    { id: 'run.script', title: 'Run npm Script…', category: 'Run', run: async () => {
      const all = await scripts();
      if (!Object.keys(all).length) { notify('package.json has no scripts.'); return; }
      const s = await pick(Object.entries(all).map(([k, v]) => ({ label: k, description: v, value: k })), 'Run which script?');
      if (s) { last = () => npm(s); await npm(s); }
    } },
    { id: 'run.install', title: 'Install Dependencies (npm install)', category: 'Run', run: () => terminals.send('npm install') },
    { id: 'preview.open', title: 'Open Preview', category: 'View', run: async () => {
      if (runtime.ports.size) return openPreview(lastUrl || [...runtime.ports.values()][0]);
      if (await isReactNative()) return openEmulator();
      const active = editors.activePath;
      return staticPreview(active && /\.html?$/.test(active) ? active : '/index.html');
    } },
    { id: 'preview.static', title: 'Preview Static Site', category: 'View', run: () => staticPreview() },
    { id: 'emulator.open', title: 'Open Phone Emulator (React Native)', category: 'Run', key: 'ctrl+alt+e', run: openEmulator },
    { id: 'emulator.reload', title: 'Reload Phone Emulator', category: 'Run', run: () => (emu ? emu.reload() : openEmulator()) },
  );
  void icon;
  return { openEmulator, openPreview, runFile, isReactNative };
}
