/** BUENOVA Code — composition root: builds the workbench, registers commands and menus, starts the services. */
import * as monaco from 'monaco-editor';
import { basename, h, icon } from './core/dom';
import { allCommands, installKeyboard, keyOf, onCommandError, prettyKey, register, run } from './core/commands';
import { WorkspaceFS } from './core/fs';
import type { IDE, IdeUser } from './core/ide';
import { TEMPLATES, applyTemplate, downloadBytes, exportZip, importZip } from './core/project';
import { memo, settings, workspaces, type Workspace } from './core/settings';
import { allThemes, applyTheme, themesChanged } from './core/themes';
import { Editors, languageOf } from './ui/editors';
import { Explorer } from './ui/explorer';
import { aboutPage, keybindingsPage, settingsJsonPage, settingsPage, watermark, welcomePage } from './ui/pages';
import { Output, Problems } from './ui/panels';
import { SearchView } from './ui/search';
import { ask, confirmBox, fuzzyFilter, notify, pick, quickInput, type QuickItem } from './ui/widgets';
import { Workbench, iconButton, type MenuDef } from './ui/workbench';
import { installTerminal } from './services/terminal';
import { installRun } from './services/run';
import { installIntellisense } from './services/intellisense';
import { renderStart } from './ui/start';
import { installGuide } from './ui/guide';

export const go = (ws: string) => { location.href = `/ide?ws=${encodeURIComponent(ws)}`; };

/** The project in the address (/ide?ws=…), or null: then the start screen lets the student choose or make one. */
function currentWorkspace(): Workspace | null {
  const asked = new URLSearchParams(location.search).get('ws');
  const hit = asked ? workspaces.get(asked) : null;
  if (hit) workspaces.touch(hit.id);
  return hit;
}

export async function boot(mount: HTMLElement, user: IdeUser | null) {
  const ws = currentWorkspace();
  if (!ws) { renderStart(mount, user); return null; }
  const fs = new WorkspaceFS(ws.id);
  document.title = `${ws.name} — BUENOVA Code`;

  applyTheme();
  const editors = new Editors(fs);
  const wb = new Workbench(mount, editors);
  const explorer = new Explorer(fs, editors);
  const search = new SearchView(fs, editors);
  const output = new Output(wb);
  const problems = new Problems(wb, editors);
  const ide: IDE = { ws, fs, editors, explorer, wb, output, problems, search, user };
  (window as any).__ide = ide;
  addEventListener('pagehide', () => { void fs.flush(); }); (window as any).__ideRun = run; (window as any).__monaco = monaco;

  onCommandError((m) => notify(m, 'error'));
  settings.changed.on((k) => { if (k === 'workbench.colorTheme') applyTheme(); });
  themesChanged.on(() => applyTheme());

  /* ---------------------------------------------------------------- side views */
  wb.addSideView({
    id: 'explorer', title: `Explorer: ${ws.name}`, iconName: 'files', el: explorer.el, order: 1,
    actions: () => [
      iconButton('new-file', 'New File…', () => explorer.newFile()), iconButton('new-folder', 'New Folder…', () => explorer.newFolder()),
      iconButton('cloud-upload', 'Upload Files…', () => explorer.upload()), iconButton('refresh', 'Refresh Explorer', () => explorer.refresh()),
      iconButton('collapse-all', 'Collapse Folders', () => explorer.collapseAll()),
    ],
  });
  wb.addSideView({ id: 'search', title: 'Search', iconName: 'search', el: search.el, order: 2, onShow: () => search.focus() });
  installGuide(ide);
  editors.onReveal = (p) => { wb.showSide('explorer', false); void explorer.reveal(p); };
  editors.emptyContent = (el) => watermark(el);
  editors.refreshEmpty();
  editors.tabActions = () => [
    iconButton('split-horizontal', 'Split Editor Right (Ctrl+\\)', () => editors.split()),
    iconButton('ellipsis', 'More Actions…', (e) => {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      void import('./ui/widgets').then(({ showMenu }) => showMenu(r.left, r.bottom, [
        { label: 'Close All Editors', run: () => editors.closeAll() }, { label: 'Close Saved Editors', run: async () => { for (const g of editors.groups) for (const t of [...g.tabs]) if (!(t.kind === 'file' && editors.isDirty(t.path!))) await editors.closeTab(g, t); } },
        'sep', { label: 'Toggle Word Wrap', run: () => run('view.wordWrap') }, { label: 'Toggle Minimap', run: () => run('view.minimap') },
      ]));
    }),
  ];

  /* ---------------------------------------------------------------- status bar */
  const paintStatus = () => {
    const ed = editors.activeEditor;
    const model = ed?.getModel();
    const pos = ed?.getPosition();
    const sel = ed?.getSelection();
    const chars = sel && model && !sel.isEmpty() ? model.getValueInRange(sel).length : 0;
    const many = ed?.getSelections()?.length ?? 0;
    wb.status('cursor', 'right', 10, model && pos ? { text: `Ln ${pos.lineNumber}, Col ${pos.column}${many > 1 ? ` (${many} selections)` : chars ? ` (${chars} selected)` : ''}`, title: 'Go to Line/Column', command: 'go.line' } : {});
    const o = model?.getOptions();
    wb.status('indent', 'right', 20, o ? { text: `${o.insertSpaces ? 'Spaces' : 'Tab Size'}: ${o.tabSize}`, title: 'Select Indentation', command: 'editor.indentation' } : {});
    wb.status('encoding', 'right', 30, model ? { text: 'UTF-8', title: 'File encoding' } : {});
    wb.status('eol', 'right', 40, model ? { text: model.getEOL() === '\n' ? 'LF' : 'CRLF', title: 'Select End of Line Sequence', command: 'editor.eol' } : {});
    wb.status('lang', 'right', 50, model ? { text: monaco.languages.getLanguages().find((l) => l.id === model.getLanguageId())?.aliases?.[0] ?? model.getLanguageId(), title: 'Select Language Mode', command: 'editor.language' } : {});
  };
  editors.activeChanged.on(paintStatus);
  editors.cursorChanged.on(paintStatus);
  editors.activeChanged.on(() => { const p = editors.activePath; document.title = `${p ? `${basename(p)} — ` : ''}${ws.name} — BUENOVA Code`; });
  wb.titleCenter.append(icon('search'), h('span', null, ws.name));
  wb.titleCenter.addEventListener('click', () => void run('palette.files'));
  wb.titleRight.append(
    iconButton('layout-sidebar-left', 'Toggle Side Bar (Ctrl+B)', () => wb.toggleSide()),
    iconButton('layout-panel', 'Toggle Panel (Ctrl+J)', () => wb.togglePanel()),
    user ? h('a', { class: 'ide-account', href: '/account', title: `Signed in as ${user.name}` }, icon('account'), h('span', null, user.name.split(' ')[0]))
      : h('a', { class: 'ide-account', href: `/login?next=${encodeURIComponent('/ide')}`, title: 'Sign in to sync your projects and settings' }, icon('account'), h('span', null, 'Sign in')));
  wb.addActivityButton(h('button', { class: 'ide-activity-btn', type: 'button', title: 'Manage', 'aria-label': 'Manage', onclick: (e: MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    void import('./ui/widgets').then(({ showMenu }) => showMenu(r.right, r.top - 180, [
      { label: 'Command Palette…', key: prettyKey(keyOf('palette.commands')), run: () => run('palette.commands') }, 'sep',
      { label: 'Settings', key: prettyKey(keyOf('prefs.settings')), run: () => run('prefs.settings') }, { label: 'Keyboard Shortcuts', run: () => run('prefs.keys') },
      { label: 'Color Theme', run: () => run('prefs.theme') }, 'sep',
      { label: 'Workspaces…', run: () => run('workspace.open') },
    ]));
  } }, icon('settings-gear')));

  /* ---------------------------------------------------------------- palette */
  const recent = () => memo.get<string[]>(`recent:${ws.id}`, []);
  editors.activeChanged.on(() => { const p = editors.activePath; if (p) memo.set(`recent:${ws.id}`, [p, ...recent().filter((x) => x !== p)].slice(0, 30)); });
  let fileCache: { at: number; files: string[] } = { at: 0, files: [] };
  fs.changed.on(() => { fileCache.at = 0; });
  const files = async () => { if (Date.now() - fileCache.at > 3000) fileCache = { at: Date.now(), files: await fs.walk('/') }; return fileCache.files; };
  const palette = async (prefix: string) => {
    const r = await quickInput<{ kind: string; id: string }>({
      placeholder: 'Search files by name (type > for commands, : for a line, @ for symbols, ? for help)', value: prefix,
      items: async (q) => {
        if (q.startsWith('>')) {
          const mine: QuickItem<{ kind: string; id: string }>[] = allCommands().filter((c) => !c.hidden && (!c.enabled || c.enabled())).map((c) => ({ label: `${c.category ? `${c.category}: ` : ''}${c.title}`, key: keyOf(c.id) ? prettyKey(keyOf(c.id)) : '', value: { kind: 'cmd', id: c.id } }));
          const acts = (editors.activeEditor?.getSupportedActions() ?? []).filter((a) => a.label).map((a) => ({ label: `Editor: ${a.label}`, value: { kind: 'act', id: a.id } }));
          return fuzzyFilter([...mine.sort((a, b) => a.label.localeCompare(b.label)), ...acts], q.slice(1).trim());
        }
        if (q.startsWith(':')) return [{ label: `Go to line ${q.slice(1) || '…'}`, description: 'Type a line number, optionally :column', value: { kind: 'line', id: q.slice(1) } }];
        if (q.startsWith('@')) return [{ label: 'Go to Symbol in Editor…', value: { kind: 'cmd', id: 'go.symbol' } }];
        if (q.startsWith('?')) return [['>', 'Show and run commands'], [':', 'Go to line'], ['@', 'Go to symbol in the editor'], ['', 'Go to file']].map(([p, d]) => ({ label: p || 'name', description: d, value: { kind: 'help', id: p } }));
        const all = await files();
        const rec = recent().filter((p) => all.includes(p));
        const order = [...rec, ...all.filter((p) => !rec.includes(p))];
        const items = order.map((p) => ({ label: basename(p), description: p.slice(1), iconName: 'file', value: { kind: 'file', id: p } }));
        return q.trim() ? fuzzyFilter(items, q.trim()) : items.map((it, i) => (i === 0 && rec.length ? { ...it, separator: 'recently opened' } : i === rec.length && rec.length ? { ...it, separator: 'files' } : it));
      },
    });
    if (!r?.item) return;
    const v = r.item.value;
    if (v.kind === 'cmd') void run(v.id);
    else if (v.kind === 'act') { const ed = editors.activeEditor; ed?.focus(); void ed?.getAction(v.id)?.run(); }
    else if (v.kind === 'file') void editors.openFile(v.id);
    else if (v.kind === 'help') void palette(v.id);
    else if (v.kind === 'line') {
      const [line, col] = v.id.split(/[:,]/).map((n) => parseInt(n, 10));
      const ed = editors.activeEditor;
      if (ed && Number.isFinite(line)) { ed.setPosition({ lineNumber: line, column: Number.isFinite(col) ? col : 1 }); ed.revealLineInCenter(line); ed.focus(); }
    }
  };

  /* ---------------------------------------------------------------- commands */
  const act = (id: string) => () => { const ed = editors.activeEditor; if (!ed) return; ed.focus(); const a = ed.getAction(id); if (a) void a.run(); else ed.trigger('ide', id, null); };
  const hasEd = () => Boolean(editors.activeEditor);
  const toggleSetting = (key: string, a: unknown = true, b: unknown = false) => () => settings.set(key, settings.get(key) === a ? b : a);
  const pickZip = (): Promise<Uint8Array | null> => new Promise((res) => {
    const input = h('input', { type: 'file', accept: '.zip,application/zip' });
    input.addEventListener('change', async () => { const f = input.files?.[0]; res(f ? new Uint8Array(await f.arrayBuffer()) : null); });
    input.addEventListener('cancel', () => res(null));
    input.click();
  });
  const exportWs = async (dir = '/') => { downloadBytes(await exportZip(fs, dir), `${dir === '/' ? ws.name : basename(dir)}.zip`, 'application/zip'); };
  document.addEventListener('ide:export-zip', (e) => void exportWs((e as CustomEvent<string>).detail));

  register(
    // File
    { id: 'file.new', title: 'New File…', category: 'File', key: 'alt+n', run: () => { wb.showSide('explorer', false); return explorer.newFile(); } },
    { id: 'file.newFolder', title: 'New Folder…', category: 'File', run: () => { wb.showSide('explorer', false); return explorer.newFolder(); } },
    { id: 'file.upload', title: 'Upload Files…', category: 'File', run: () => explorer.upload() },
    { id: 'file.uploadFolder', title: 'Upload Folder…', category: 'File', run: () => explorer.upload(true, '/') },
    { id: 'file.save', title: 'Save', category: 'File', key: 'ctrl+s', run: () => { const p = editors.activePath; if (p) return editors.save(p); } },
    { id: 'file.saveAll', title: 'Save All', category: 'File', key: 'ctrl+k s', run: () => editors.saveAll() },
    { id: 'file.autoSave', title: 'Toggle Auto Save', category: 'File', run: toggleSetting('files.autoSave', 'afterDelay', 'off') },
    { id: 'file.download', title: 'Download Active File', category: 'File', enabled: () => Boolean(editors.activePath), run: () => explorer.download(editors.activePath!) },
    { id: 'file.rename', title: 'Rename Active File…', category: 'File', enabled: () => Boolean(editors.activePath), run: () => { wb.showSide('explorer', false); return explorer.rename(editors.activePath!); } },
    { id: 'file.delete', title: 'Delete Active File', category: 'File', enabled: () => Boolean(editors.activePath), run: () => explorer.remove(editors.activePath!) },
    { id: 'file.reveal', title: 'Reveal Active File in Explorer', category: 'File', enabled: () => Boolean(editors.activePath), run: () => editors.onReveal(editors.activePath!) },
    { id: 'file.compare', title: 'Compare Active File With…', category: 'File', enabled: () => Boolean(editors.activePath), run: async () => {
      const a = editors.activePath!;
      const other = await pick((await files()).filter((p) => p !== a).map((p) => ({ label: basename(p), description: p.slice(1), value: p })), `Compare ${basename(a)} with…`);
      if (other) await editors.openDiff(`${basename(other)} ↔ ${basename(a)}`, await fs.readText(other), a);
    } },
    { id: 'file.close', title: 'Close Editor', category: 'View', key: 'alt+w', run: () => editors.closeActive() },
    { id: 'file.closeAll', title: 'Close All Editors', category: 'View', key: 'ctrl+k w', run: () => editors.closeAll() },
    // Workspace
    { id: 'workspace.new', title: 'New Project…', category: 'File', run: () => { location.href = '/ide'; } },
    { id: 'workspace.open', title: 'Open Recent Project…', category: 'File', run: async () => {
      const id = await pick(workspaces.all().map((w) => ({ label: w.name, description: `${w.id === ws.id ? 'current · ' : ''}last opened ${new Date(w.opened).toLocaleString()}`, iconName: 'folder', value: w.id })), 'Open a workspace');
      if (id && id !== ws.id) go(id);
    } },
    { id: 'workspace.rename', title: 'Rename Workspace…', category: 'Workspace', run: async () => {
      const name = await ask('Workspace name', ws.name, (v) => (v.trim() ? null : 'Type a name.'));
      if (name) { workspaces.patch(ws.id, { name: name.trim() }); location.reload(); }
    } },
    { id: 'workspace.delete', title: 'Delete Workspace…', category: 'Workspace', run: async () => {
      const id = await pick(workspaces.all().map((w) => ({ label: w.name, description: w.id === ws.id ? 'current' : '', iconName: 'trash', value: w.id })), 'Delete which workspace?');
      const w = id && workspaces.get(id);
      if (!w || !(await confirmBox(`Delete the workspace "${w.name}" and all its files from this browser?`, 'This cannot be undone. Export a ZIP first if you need a copy.', ['Delete'], true))) return;
      workspaces.remove(w.id);
      if (w.id === ws.id) { location.href = '/ide'; setTimeout(() => void WorkspaceFS.destroy(w.id), 50); } else await WorkspaceFS.destroy(w.id);
    } },
    { id: 'workspace.importZip', title: 'Import ZIP into This Workspace…', category: 'Workspace', run: async () => {
      const bytes = await pickZip();
      if (bytes) { const n = await importZip(fs, bytes); notify(`Imported ${n} file${n === 1 ? '' : 's'}.`); }
    } },
    { id: 'workspace.importZipNew', title: 'Import ZIP as a New Workspace…', category: 'Workspace', run: async () => {
      const bytes = await pickZip();
      if (!bytes) return;
      const name = await ask('Workspace name', 'Imported project', (v) => (v.trim() ? null : 'Type a name.'));
      if (!name) return;
      const nw = workspaces.create(name);
      const nfs = new WorkspaceFS(nw.id);
      await importZip(nfs, bytes);
      await nfs.flush();
      go(nw.id);
    } },
    { id: 'workspace.exportZip', title: 'Export Workspace as ZIP', category: 'Workspace', run: () => exportWs('/') },
    // Edit
    { id: 'edit.undo', title: 'Undo', category: 'Edit', enabled: hasEd, run: act('undo') },
    { id: 'edit.redo', title: 'Redo', category: 'Edit', enabled: hasEd, run: act('redo') },
    { id: 'edit.cut', title: 'Cut', category: 'Edit', enabled: hasEd, run: act('editor.action.clipboardCutAction') },
    { id: 'edit.copy', title: 'Copy', category: 'Edit', enabled: hasEd, run: act('editor.action.clipboardCopyAction') },
    { id: 'edit.paste', title: 'Paste', category: 'Edit', enabled: hasEd, run: async () => { const ed = editors.activeEditor; if (!ed) return; ed.focus(); try { const text = await navigator.clipboard.readText(); ed.executeEdits('paste', ed.getSelections()!.map((s) => ({ range: s, text, forceMoveMarkers: true }))); } catch { notify('The browser blocked clipboard access. Use Ctrl+V.', 'warning'); } } },
    { id: 'edit.find', title: 'Find', category: 'Edit', enabled: hasEd, run: act('actions.find') },
    { id: 'edit.replace', title: 'Replace', category: 'Edit', enabled: hasEd, run: act('editor.action.startFindReplaceAction') },
    { id: 'edit.comment', title: 'Toggle Line Comment', category: 'Edit', enabled: hasEd, run: act('editor.action.commentLine') },
    { id: 'edit.blockComment', title: 'Toggle Block Comment', category: 'Edit', enabled: hasEd, run: act('editor.action.blockComment') },
    { id: 'edit.format', title: 'Format Document', category: 'Edit', enabled: hasEd, run: act('editor.action.formatDocument') },
    { id: 'edit.formatSelection', title: 'Format Selection', category: 'Edit', enabled: hasEd, run: act('editor.action.formatSelection') },
    { id: 'edit.rename', title: 'Rename Symbol', category: 'Edit', enabled: hasEd, run: act('editor.action.rename') },
    { id: 'edit.quickFix', title: 'Quick Fix…', category: 'Edit', enabled: hasEd, run: act('editor.action.quickFix') },
    // Selection
    { id: 'sel.all', title: 'Select All', category: 'Selection', enabled: hasEd, run: act('editor.action.selectAll') },
    { id: 'sel.expand', title: 'Expand Selection', category: 'Selection', enabled: hasEd, run: act('editor.action.smartSelect.expand') },
    { id: 'sel.shrink', title: 'Shrink Selection', category: 'Selection', enabled: hasEd, run: act('editor.action.smartSelect.shrink') },
    { id: 'sel.copyUp', title: 'Copy Line Up', category: 'Selection', enabled: hasEd, run: act('editor.action.copyLinesUpAction') },
    { id: 'sel.copyDown', title: 'Copy Line Down', category: 'Selection', enabled: hasEd, run: act('editor.action.copyLinesDownAction') },
    { id: 'sel.moveUp', title: 'Move Line Up', category: 'Selection', enabled: hasEd, run: act('editor.action.moveLinesUpAction') },
    { id: 'sel.moveDown', title: 'Move Line Down', category: 'Selection', enabled: hasEd, run: act('editor.action.moveLinesDownAction') },
    { id: 'sel.cursorAbove', title: 'Add Cursor Above', category: 'Selection', enabled: hasEd, run: act('editor.action.insertCursorAbove') },
    { id: 'sel.cursorBelow', title: 'Add Cursor Below', category: 'Selection', enabled: hasEd, run: act('editor.action.insertCursorBelow') },
    { id: 'sel.cursorsLineEnds', title: 'Add Cursors to Line Ends', category: 'Selection', enabled: hasEd, run: act('editor.action.insertCursorAtEndOfEachLineSelected') },
    { id: 'sel.nextMatch', title: 'Add Next Occurrence', category: 'Selection', enabled: hasEd, run: act('editor.action.addSelectionToNextFindMatch') },
    { id: 'sel.allMatches', title: 'Select All Occurrences', category: 'Selection', enabled: hasEd, run: act('editor.action.selectHighlights') },
    // View
    { id: 'palette.commands', title: 'Command Palette…', category: 'View', key: 'ctrl+shift+p', run: () => palette('>') },
    { id: 'palette.commands2', title: 'Command Palette (F1)', key: 'f1', hidden: true, run: () => palette('>') },
    { id: 'palette.files', title: 'Go to File…', category: 'Go', key: 'ctrl+p', run: () => palette('') },
    { id: 'view.explorer', title: 'Show Explorer', category: 'View', key: 'ctrl+shift+e', run: () => { wb.showSide('explorer', false); explorer.el.focus(); } },
    { id: 'view.search', title: 'Find in Files', category: 'Search', key: 'ctrl+shift+f', run: () => { wb.showSide('search', false); const ed = editors.activeEditor; const sel = ed?.getSelection(); search.focus(sel && !sel.isEmpty() ? ed!.getModel()!.getValueInRange(sel).split('\n')[0] : undefined); } },
    { id: 'view.problems', title: 'Show Problems', category: 'View', key: 'ctrl+shift+m', run: () => wb.togglePanel('problems') },
    { id: 'view.output', title: 'Show Output', category: 'View', key: 'ctrl+shift+u', run: () => wb.togglePanel('output') },
    { id: 'view.side', title: 'Toggle Side Bar', category: 'View', key: 'ctrl+b', run: () => wb.toggleSide() },
    { id: 'view.panel', title: 'Toggle Panel', category: 'View', key: 'ctrl+j', run: () => wb.togglePanel() },
    { id: 'view.panelMax', title: 'Toggle Maximized Panel', category: 'View', run: () => wb.togglePanelMax() },
    { id: 'view.sideRight', title: 'Move Side Bar Left/Right', category: 'View', run: toggleSetting('workbench.sideBar.location', 'right', 'left') },
    { id: 'view.split', title: 'Split Editor Right', category: 'View', key: 'ctrl+\\', run: () => editors.split() },
    { id: 'view.group1', title: 'Focus First Editor Group', category: 'View', key: 'ctrl+1', run: () => editors.focusGroupAt(0) },
    { id: 'view.group2', title: 'Focus Second Editor Group', category: 'View', key: 'ctrl+2', run: () => editors.focusGroupAt(1) },
    { id: 'view.group3', title: 'Focus Third Editor Group', category: 'View', key: 'ctrl+3', run: () => editors.focusGroupAt(2) },
    { id: 'view.nextTab', title: 'Open Next Editor', category: 'View', key: 'ctrl+pagedown', run: () => editors.cycle(1) },
    { id: 'view.prevTab', title: 'Open Previous Editor', category: 'View', key: 'ctrl+pageup', run: () => editors.cycle(-1) },
    { id: 'view.nextTab2', title: 'Open Next Editor (Alt)', key: 'alt+.', hidden: true, run: () => editors.cycle(1) },
    { id: 'view.prevTab2', title: 'Open Previous Editor (Alt)', key: 'alt+,', hidden: true, run: () => editors.cycle(-1) },
    { id: 'view.wordWrap', title: 'Toggle Word Wrap', category: 'View', key: 'alt+z', run: toggleSetting('editor.wordWrap', 'on', 'off') },
    { id: 'view.minimap', title: 'Toggle Minimap', category: 'View', run: toggleSetting('editor.minimap.enabled') },
    { id: 'view.whitespace', title: 'Toggle Render Whitespace', category: 'View', run: toggleSetting('editor.renderWhitespace', 'all', 'selection') },
    { id: 'view.zoomIn', title: 'Zoom In (Editor Font)', category: 'View', key: 'ctrl+=', run: () => settings.set('editor.fontSize', Math.min(40, settings.get<number>('editor.fontSize') + 1)) },
    { id: 'view.zoomOut', title: 'Zoom Out (Editor Font)', category: 'View', key: 'ctrl+-', run: () => settings.set('editor.fontSize', Math.max(8, settings.get<number>('editor.fontSize') - 1)) },
    { id: 'view.zoomReset', title: 'Reset Zoom', category: 'View', run: () => settings.set('editor.fontSize', 14) },
    { id: 'view.fullscreen', title: 'Toggle Full Screen', category: 'View', key: 'f11', run: () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()) },
    { id: 'view.foldAll', title: 'Fold All', category: 'View', enabled: hasEd, run: act('editor.foldAll') },
    { id: 'view.unfoldAll', title: 'Unfold All', category: 'View', enabled: hasEd, run: act('editor.unfoldAll') },
    { id: 'view.welcome', title: 'Welcome', category: 'Help', run: () => editors.openView('welcome', 'Welcome', 'home', (el) => welcomePage(el, ide)) },
    { id: 'help.about', title: 'What Works in This IDE', category: 'Help', run: () => editors.openView('about', 'About', 'info', (el) => aboutPage(el)) },
    // Go
    { id: 'go.line', title: 'Go to Line/Column…', category: 'Go', key: 'ctrl+g', enabled: hasEd, run: () => palette(':') },
    { id: 'go.symbol', title: 'Go to Symbol in Editor…', category: 'Go', key: 'ctrl+shift+o', enabled: hasEd, run: act('editor.action.quickOutline') },
    { id: 'go.definition', title: 'Go to Definition', category: 'Go', enabled: hasEd, run: act('editor.action.revealDefinition') },
    { id: 'go.peek', title: 'Peek Definition', category: 'Go', enabled: hasEd, run: act('editor.action.peekDefinition') },
    { id: 'go.references', title: 'Go to References', category: 'Go', enabled: hasEd, run: act('editor.action.goToReferences') },
    { id: 'go.bracket', title: 'Go to Bracket', category: 'Go', enabled: hasEd, run: act('editor.action.jumpToBracket') },
    { id: 'go.nextProblem', title: 'Next Problem', category: 'Go', enabled: hasEd, run: act('editor.action.marker.nextInFiles') },
    { id: 'go.prevProblem', title: 'Previous Problem', category: 'Go', enabled: hasEd, run: act('editor.action.marker.prevInFiles') },
    // Editor modes
    { id: 'editor.language', title: 'Change Language Mode', category: 'Editor', enabled: hasEd, run: async () => {
      const model = editors.activeEditor?.getModel();
      if (!model) return;
      const id = await pick(monaco.languages.getLanguages().map((l) => ({ label: l.aliases?.[0] ?? l.id, description: l.id, value: l.id })).sort((a, b) => a.label.localeCompare(b.label)), 'Select Language Mode');
      if (id) { monaco.editor.setModelLanguage(model, id); paintStatus(); }
    } },
    { id: 'editor.indentation', title: 'Select Indentation', category: 'Editor', enabled: hasEd, run: async () => {
      const model = editors.activeEditor?.getModel();
      if (!model) return;
      const v = await pick([2, 4, 8].flatMap((n) => [{ label: `Indent using ${n} spaces`, value: { n, s: true } }, { label: `Indent using tabs (width ${n})`, value: { n, s: false } }]), 'Select Indentation');
      if (v) { model.updateOptions({ tabSize: v.n, insertSpaces: v.s }); paintStatus(); }
    } },
    { id: 'editor.eol', title: 'Change End of Line Sequence', category: 'Editor', enabled: hasEd, run: async () => {
      const model = editors.activeEditor?.getModel();
      const v = model && (await pick([{ label: 'LF', value: monaco.editor.EndOfLineSequence.LF }, { label: 'CRLF', value: monaco.editor.EndOfLineSequence.CRLF }], 'Select End of Line Sequence'));
      if (model && v !== null && v !== undefined) { model.pushEOL(v); paintStatus(); }
    } },
    // Preferences
    { id: 'prefs.settings', title: 'Open Settings', category: 'Preferences', key: 'ctrl+,', run: () => editors.openView('settings', 'Settings', 'settings-gear', (el) => settingsPage(el, ide)) },
    { id: 'prefs.settingsJson', title: 'Open Settings (JSON)', category: 'Preferences', run: () => editors.openView('settings-json', 'settings.json', 'json', (el) => settingsJsonPage(el)) },
    { id: 'prefs.keys', title: 'Open Keyboard Shortcuts', category: 'Preferences', key: 'ctrl+k ctrl+s', run: () => editors.openView('keys', 'Keyboard Shortcuts', 'keyboard', (el) => keybindingsPage(el)) },
    { id: 'prefs.theme', title: 'Color Theme', category: 'Preferences', key: 'ctrl+k ctrl+t', run: async () => {
      const before = settings.get<string>('workbench.colorTheme');
      const name = await pick(allThemes().map((t) => ({ label: t.name, description: `${t.type === 'light' ? 'light' : t.type === 'hc' ? 'high contrast' : 'dark'}${t.source ? ` · ${t.source}` : ''}`, value: t.name })), 'Select Color Theme (Up/Down to preview)', (n) => applyTheme(n ?? before));
      if (name) settings.set('workbench.colorTheme', name); else applyTheme(before);
    } },
    { id: 'file.newUntitledLang', title: 'New File from Language…', category: 'File', run: async () => {
      const ext = await pick(['js', 'ts', 'html', 'css', 'json', 'py', 'cpp', 'java', 'md', 'sql', 'sh', 'go', 'rs', 'php', 'rb'].map((e) => ({ label: `.${e}`, description: monaco.languages.getLanguages().find((l) => l.id === (languageOf(`x.${e}`) ?? l.id) && l.extensions?.includes(`.${e}`))?.aliases?.[0] ?? '', value: e })), 'File type');
      if (!ext) return;
      const path = await fs.freeName(`/untitled.${ext}`);
      await fs.write(path, '');
      await editors.openFile(path);
    } },
  );

  /* ---------------------------------------------------------------- menus */
  const menus: { label: string; items: () => MenuDef[] }[] = [
    { label: 'File', items: () => ['workspace.new', 'workspace.open', 'sep', 'file.new', 'file.newFolder', 'file.newUntitledLang', 'sep', 'file.upload', 'file.uploadFolder', 'workspace.importZip', 'sep', 'file.save', 'file.saveAll', { label: 'Auto Save', checked: () => settings.get('files.autoSave') !== 'off', run: () => run('file.autoSave') }, 'sep', 'file.download', 'workspace.exportZip', 'sep', { label: 'Preferences', submenu: ['prefs.settings', 'prefs.keys', 'prefs.theme'] }, 'sep', 'workspace.rename', 'workspace.delete', 'sep', 'file.close', 'file.closeAll'] },
    { label: 'Edit', items: () => ['edit.undo', 'edit.redo', 'sep', 'edit.cut', 'edit.copy', 'edit.paste', 'sep', 'edit.find', 'edit.replace', 'view.search', 'sep', 'edit.comment', 'edit.blockComment', 'edit.format', 'edit.formatSelection', 'edit.rename', 'edit.quickFix', 'markdown.preview', 'types.refresh'] },
    { label: 'Selection', items: () => ['sel.all', 'sel.expand', 'sel.shrink', 'sep', 'sel.copyUp', 'sel.copyDown', 'sel.moveUp', 'sel.moveDown', 'sep', 'sel.cursorAbove', 'sel.cursorBelow', 'sel.cursorsLineEnds', 'sel.nextMatch', 'sel.allMatches'] },
    { label: 'View', items: () => ['palette.commands', 'sep', 'view.explorer', 'view.search', 'sep', 'view.problems', 'view.output', 'view.terminal', 'preview.open', 'sep', 'view.side', 'view.panel', 'view.panelMax', 'view.sideRight', 'view.split', 'sep', 'view.wordWrap', 'view.minimap', 'view.whitespace', 'view.foldAll', 'view.unfoldAll', 'sep', 'view.zoomIn', 'view.zoomOut', 'view.zoomReset', 'view.fullscreen'] },
    { label: 'Go', items: () => ['palette.files', 'go.symbol', 'go.line', 'sep', 'go.definition', 'go.peek', 'go.references', 'go.bracket', 'sep', 'go.nextProblem', 'go.prevProblem', 'sep', 'view.nextTab', 'view.prevTab', 'view.group1', 'view.group2', 'view.group3'] },
    { label: 'Run', items: () => ['run.start', 'run.file', 'run.stop', 'run.restart', 'sep', 'emulator.open', 'emulator.reload'] },
    { label: 'Terminal', items: () => ['view.terminal', 'terminal.clear', 'terminal.kill'] },
    { label: 'Help', items: () => ['view.welcome', 'palette.commands', 'prefs.keys', 'sep', 'help.about', { label: 'Back to BUENOVA', run: () => { location.href = '/'; } }] },
  ];
  const terminals = installTerminal(ide);
  (window as any).__ideTerms = terminals;
  const runner = installRun(ide, terminals);
  installIntellisense(ide);
  wb.setMenus(menus);

  installKeyboard();
  await editors.restore();
  // a React Native project always comes up with its phone emulator next to the code
  // the app of a mobile or web project opens next to the code: Run is one click away for the others
  const kind = await runner.kindOf();
  if (kind === 'react-native') await runner.openEmulator();
  else if (kind === 'react') await runner.openReact();
  else if (kind === 'web') await runner.openPage();
  // a project with a GUIDE.md (the lab projects) starts on its Guide, not on the Welcome page
  if (!(await fs.exists('/GUIDE.md'))) {
    if (!memo.get('welcome.seen', false) && settings.get('workbench.startupEditor') === 'welcome') await run('view.welcome');
    memo.set('welcome.seen', true);
  }
  paintStatus();
  void editors.preload();
  return ide;
}
