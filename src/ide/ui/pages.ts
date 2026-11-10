/** Editor-area pages: Welcome, Settings, Keyboard Shortcuts. */
import * as monaco from 'monaco-editor';
import { clear, h, icon } from '../core/dom';
import { allCommands, comboOf, getCommand, commandsChanged, keyOf, prettyKey, run, setKey, suspendKeys, userKeybindings } from '../core/commands';
import type { IDE } from '../core/ide';
import { SETTINGS, settings, workspaces } from '../core/settings';
import { allThemes } from '../core/themes';
import { notify } from './widgets';

const link = (iconName: string, label: string, command: string, ...args: unknown[]) =>
  !getCommand(command) ? null : h('button', { class: 'ide-welcome-link', type: 'button', onclick: () => void run(command, ...args) }, icon(iconName), label);

export function welcomePage(el: HTMLElement, ide: IDE) {
  const recent = workspaces.all().filter((w) => w.id !== ide.ws.id).slice(0, 6);
  el.append(h('div', { class: 'ide-welcome' },
    h('h1', null, 'BUENOVA Code'),
    h('p', { class: 'ide-dim' }, `Workspace: ${ide.ws.name}. Everything is saved in this browser${ide.user ? ' and can be synced to your account' : ''}.`),
    h('div', { class: 'ide-welcome-cols' },
      h('section', null, h('h2', null, 'Start'),
        link('new-file', 'New File…', 'file.new'),
        link('folder-opened', 'Upload Folder…', 'file.uploadFolder'),
        link('file-zip', 'Import ZIP…', 'workspace.importZip'),
        link('source-control', 'Clone Git Repository…', 'git.clone'),
        link('add', 'New Workspace from Template…', 'workspace.new'),
        link('device-mobile', 'Open Phone Emulator (React Native)', 'emulator.open'),
        link('terminal', 'Open Terminal', 'terminal.new')),
      h('section', null, h('h2', null, 'Recent workspaces'),
        recent.length ? recent.map((w) => h('a', { class: 'ide-welcome-link', href: `/ide?ws=${w.id}` }, icon('folder'), w.name, h('span', { class: 'ide-dim' }, ` · ${new Date(w.opened).toLocaleDateString()}`)))
          : h('p', { class: 'ide-dim' }, 'No other workspaces yet.'),
        h('h2', null, 'Help'),
        link('symbol-keyword', 'Show All Commands', 'palette.commands'),
        link('keyboard', 'Keyboard Shortcuts', 'prefs.keys'),
        link('extensions', 'Browse Extensions', 'view.extensions'),
        link('info', 'What works in this IDE', 'help.about')))));
}

export function watermark(el: HTMLElement) {
  const row = (label: string, id: string) => { const k = keyOf(id); return k ? h('div', { class: 'ide-wm-row' }, h('span', null, label), h('kbd', null, prettyKey(k))) : null; };
  el.append(h('div', { class: 'ide-watermark' }, h('div', { class: 'ide-wm-logo' }, 'B'),
    row('Show All Commands', 'palette.commands'), row('Go to File', 'palette.files'), row('Find in Files', 'view.search'), row('Toggle Terminal', 'view.terminal'), row('Run File', 'run.start')));
}

/* ------------------------------------------------------------------ settings */
export function settingsPage(el: HTMLElement, ide: IDE) {
  const search = h('input', { class: 'ide-input', type: 'search', placeholder: 'Search settings', 'aria-label': 'Search settings' });
  const list = h('div', { class: 'ide-settings-list' });
  const paint = () => {
    clear(list);
    const q = search.value.trim().toLowerCase();
    let group = '';
    for (const s of SETTINGS) {
      if (q && !`${s.key} ${s.title} ${s.description}`.toLowerCase().includes(q)) continue;
      if (s.group !== group) { group = s.group; list.append(h('h2', null, group)); }
      const value = settings.get(s.key);
      const changed = value !== s.default;
      let control: HTMLElement;
      if (s.key === 'workbench.colorTheme') {
        control = h('select', { class: 'ide-select', onchange: (e: Event) => settings.set(s.key, (e.target as HTMLSelectElement).value) }, allThemes().map((t) => h('option', { value: t.name, selected: t.name === value }, t.name)));
      } else if (s.type === 'boolean') {
        control = h('label', { class: 'ide-check' }, h('input', { type: 'checkbox', checked: Boolean(value), onchange: (e: Event) => settings.set(s.key, (e.target as HTMLInputElement).checked) }), s.description);
      } else if (s.type === 'enum') {
        control = h('select', { class: 'ide-select', onchange: (e: Event) => settings.set(s.key, (e.target as HTMLSelectElement).value) }, s.options.map((o) => h('option', { value: o, selected: o === value }, o)));
      } else if (s.type === 'number') {
        control = h('input', { class: 'ide-input', type: 'number', value: String(value), min: s.min, max: s.max, onchange: (e: Event) => {
          const n = Number((e.target as HTMLInputElement).value);
          if (Number.isFinite(n)) settings.set(s.key, Math.max(s.min ?? -Infinity, Math.min(s.max ?? Infinity, n)));
        } });
      } else {
        control = h('input', { class: 'ide-input', type: 'text', value: String(value ?? ''), spellcheck: false, onchange: (e: Event) => settings.set(s.key, (e.target as HTMLInputElement).value) });
      }
      list.append(h('div', { class: `ide-setting${changed ? ' changed' : ''}` },
        h('div', { class: 'ide-setting-head' }, h('b', null, `${s.group}: ${s.title}`), h('code', null, s.key),
          changed ? h('button', { class: 'ide-link', type: 'button', onclick: () => { settings.set(s.key, s.default); paint(); } }, 'Reset') : null),
        s.type === 'boolean' ? null : h('p', { class: 'ide-dim' }, s.description), control));
    }
    if (!list.childElementCount) list.append(h('p', { class: 'ide-dim' }, 'No settings match.'));
  };
  search.addEventListener('input', paint);
  const off = settings.changed.on(() => { if (!el.contains(document.activeElement) || (document.activeElement as HTMLElement).tagName === 'SELECT' || (document.activeElement as HTMLInputElement).type === 'checkbox') paint(); });
  el.append(h('div', { class: 'ide-page' }, h('div', { class: 'ide-page-head' }, h('h1', null, 'Settings'), search,
    h('button', { class: 'ide-btn', type: 'button', onclick: () => void run('prefs.settingsJson') }, 'Open settings.json')), list));
  paint();
  void ide;
  return off;
}

/** settings.json as text: only the values that differ from the defaults. */
export function settingsJsonPage(el: HTMLElement) {
  const host = h('div', { class: 'ide-json-host' });
  const msg = h('span', { class: 'ide-dim' }, 'Only settings that differ from the defaults are listed. Ctrl+S applies.');
  const apply = () => {
    try {
      const parsed = JSON.parse(model.getValue() || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('settings.json must be an object.');
      settings.replace(parsed);
      msg.textContent = 'Applied.';
    } catch (e) { notify(`settings.json: ${e instanceof Error ? e.message : e}`, 'error'); }
  };
  el.append(h('div', { class: 'ide-page ide-page-fill' }, h('div', { class: 'ide-page-head' }, h('h1', null, 'settings.json'), msg, h('button', { class: 'ide-btn primary', type: 'button', onclick: apply }, 'Apply')), host));
  const model = monaco.editor.createModel(JSON.stringify(settings.json(), null, 2), 'json');
  const ed = monaco.editor.create(host, { model, automaticLayout: true, minimap: { enabled: false }, fontSize: settings.get<number>('editor.fontSize'), theme: 'ide-theme', tabSize: 2 });
  ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, apply);
  return () => { ed.dispose(); model.dispose(); };
}

/* ------------------------------------------------------------------ keyboard shortcuts */
export function keybindingsPage(el: HTMLElement) {
  const search = h('input', { class: 'ide-input', type: 'search', placeholder: 'Search commands or keys', 'aria-label': 'Search shortcuts' });
  const body = h('tbody');
  let recording: string | null = null;
  const paint = () => {
    clear(body);
    const q = search.value.trim().toLowerCase();
    const user = userKeybindings();
    for (const c of allCommands().filter((c) => !c.hidden).sort((a, b) => `${a.category}${a.title}`.localeCompare(`${b.category}${b.title}`))) {
      const key = keyOf(c.id);
      const label = `${c.category ? `${c.category}: ` : ''}${c.title}`;
      if (q && !`${label} ${key} ${c.id}`.toLowerCase().includes(q)) continue;
      const cell = recording === c.id ? h('td', { class: 'ide-key-rec' }, 'Press the keys… (Esc cancels, Backspace removes)') : h('td', null, key ? h('kbd', null, prettyKey(key)) : h('span', { class: 'ide-dim' }, '—'));
      const tr = h('tr', { class: c.id in user ? 'changed' : '', title: 'Double-click to change' }, h('td', null, label), cell, h('td', { class: 'ide-dim' }, c.id),
        h('td', null, c.id in user ? h('button', { class: 'ide-link', type: 'button', onclick: () => setKey(c.id, null) }, 'Reset') : null));
      tr.addEventListener('dblclick', () => { recording = c.id; suspendKeys(true); paint(); });
      body.append(tr);
    }
  };
  const onKey = (e: KeyboardEvent) => {
    if (!recording) return;
    e.preventDefault(); e.stopPropagation();
    if (e.key === 'Escape') recording = null;
    else if (e.key === 'Backspace') { setKey(recording, ''); recording = null; }
    else { const combo = comboOf(e); if (!combo) return; setKey(recording, combo); recording = null; }
    suspendKeys(false);
    paint();
  };
  window.addEventListener('keydown', onKey, true);
  const off = commandsChanged.on(paint);
  search.addEventListener('input', paint);
  el.append(h('div', { class: 'ide-page' }, h('div', { class: 'ide-page-head' }, h('h1', null, 'Keyboard Shortcuts'), search),
    h('p', { class: 'ide-dim' }, 'Double-click a row to record a new shortcut. The browser keeps a few for itself (Ctrl+N, Ctrl+T, Ctrl+W): those cannot be used here.'),
    h('table', { class: 'ide-table' }, h('thead', null, h('tr', null, h('th', null, 'Command'), h('th', null, 'Keybinding'), h('th', null, 'Id'), h('th', null, ''))), body)));
  paint();
  return () => { window.removeEventListener('keydown', onKey, true); suspendKeys(false); off(); };
}

/* ------------------------------------------------------------------ what works */
export function aboutPage(el: HTMLElement) {
  const list = (items: string[]) => h('ul', null, items.map((i) => h('li', null, i)));
  el.append(h('div', { class: 'ide-page ide-about' }, h('h1', null, 'What works in BUENOVA Code'),
    h('p', { class: 'ide-dim' }, 'Everything runs inside this browser tab. Nothing is executed on the BUENOVA server.'),
    h('h2', null, 'Works now'),
    list([
      'Editor: syntax highlighting for 80+ languages, IntelliSense for JavaScript, TypeScript, JSON, CSS and HTML, multi-cursor, folding, minimap, find and replace, diff view, split editors, auto save.',
      'Phone emulator: React Native, Expo Router and NativeWind apps run in a phone frame and reload as you type. It uses react-native-web, the same engine as the Mobile Development labs.',
      'Terminal: a real shell with Node.js and npm (WebContainers). npm install, npm run dev, node, npx all really run.',
      'Web preview: dev servers (Vite, Express, …) and static sites, with desktop, tablet and mobile sizes.',
      'C++: the course subset of C++ runs on the built-in C++ engine, with typed input.',
      'Files: explorer, drag and drop, upload, download, ZIP import and export, search across files, several workspaces.',
      'Settings, keyboard shortcuts and color themes.',
    ]),
    h('h2', null, 'Limits of running in the browser'),
    list([
      'The phone emulator is not an Android or iOS system image. Native modules (camera, sensors, push notifications) do not run in it. To test on a real phone or the Android emulator: export the ZIP, then run npx expo start on your computer.',
      'Java, C#, Go, Rust, PHP, Ruby, Swift, Kotlin and Dart can be edited with highlighting, but not run: they need a server-side runtime.',
      'Packages with native binaries do not install in the browser runtime. node_modules is installed again after the page is reloaded.',
      'Extensions written for VS Code that run code cannot run here.',
    ]),
    h('p', { class: 'ide-dim' }, 'Editor: Monaco (MIT). Icons: Codicons (CC BY 4.0). Terminal: xterm.js (MIT). Runtime: WebContainer API by StackBlitz.')));
}
