/**
 * The editor area: Monaco, text models (one per file), editor groups (split view) with tabs, breadcrumbs, the diff
 * editor and custom views (welcome, settings, previews, extension pages).
 */
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker?worker';
import CssWorker from 'monaco-editor/language/css/css.worker?worker';
import HtmlWorker from 'monaco-editor/language/html/html.worker?worker';
import TsWorker from 'monaco-editor/language/typescript/ts.worker?worker';
import { Emitter, basename, clear, dirname, extname, h, icon, uid } from '../core/dom';
import { IMAGE, isBinaryPath, type WorkspaceFS } from '../core/fs';
import { memo, settings } from '../core/settings';
import { confirmBox, notify, showMenu, type MenuItem } from './widgets';

(self as any).MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    if (label === 'json') return new JsonWorker();
    if (label === 'css' || label === 'scss' || label === 'less') return new CssWorker();
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new HtmlWorker();
    if (label === 'typescript' || label === 'javascript') return new TsWorker();
    return new EditorWorker();
  },
};

const tsApi: any = (monaco as any).typescript ?? (monaco.languages as any).typescript;
if (tsApi) {
  const opts = {
    target: tsApi.ScriptTarget.ESNext, module: tsApi.ModuleKind.ESNext, moduleResolution: tsApi.ModuleResolutionKind.NodeJs,
    jsx: tsApi.JsxEmit.ReactJSX, allowJs: true, checkJs: false, allowNonTsExtensions: true, esModuleInterop: true, allowSyntheticDefaultImports: true, strict: false, noEmit: true, baseUrl: 'file:///', paths: { '@/*': ['*', 'src/*'] }, skipLibCheck: true,
  };
  tsApi.typescriptDefaults.setCompilerOptions(opts);
  tsApi.javascriptDefaults.setCompilerOptions(opts);
  tsApi.typescriptDefaults.setEagerModelSync(true);
  tsApi.javascriptDefaults.setEagerModelSync(true);
  // packages are installed inside the runtime, not in the editor: "cannot find module" would be noise
  const quiet = { noSemanticValidation: false, noSyntaxValidation: false, diagnosticCodesToIgnore: [2307, 2792, 7016, 2875, 1259, 2686, 1375, 1378, 7026, 2688] };
  tsApi.typescriptDefaults.setDiagnosticsOptions(quiet);
  tsApi.javascriptDefaults.setDiagnosticsOptions(quiet);
}

const LANG_BY_EXT: Record<string, string> = {
  vue: 'html', svelte: 'html', astro: 'html', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript', tsx: 'typescript', mts: 'typescript', cts: 'typescript',
  env: 'ini', toml: 'ini', gitignore: 'ignore', h: 'cpp', hpp: 'cpp', cc: 'cpp', cxx: 'cpp', ino: 'cpp', ps1: 'powershell', psm1: 'powershell', kt: 'kotlin', kts: 'kotlin',
  rs: 'rust', rb: 'ruby', pl: 'perl', pm: 'perl', r: 'r', cs: 'csharp', yml: 'yaml', sh: 'shell', bash: 'shell', zsh: 'shell', jsonc: 'json', webmanifest: 'json', svg: 'xml', txt: 'plaintext', log: 'plaintext', lock: 'plaintext',
};
const extraLanguages = new Map<string, string>();
/** Extensions can map more file extensions to a language. */
export const mapExtension = (ext: string, lang: string) => { extraLanguages.set(ext.replace(/^\./, '').toLowerCase(), lang); };
export function languageOf(path: string): string | undefined {
  const name = basename(path).toLowerCase();
  if (name === 'dockerfile' || name.startsWith('dockerfile.')) return 'dockerfile';
  if (name === 'makefile') return 'shell';
  if (name.startsWith('.env')) return 'ini';
  const ext = extname(path) || name.replace(/^\./, '');
  return extraLanguages.get(ext) ?? LANG_BY_EXT[ext];
}
export const uriOf = (path: string) => monaco.Uri.file(path);
export const pathOf = (uri: monaco.Uri) => uri.path;

/** File-type glyph for tabs and the explorer. */
const FILE_ICONS: Record<string, [string, string]> = {
  js: ['JS', '#e8d44d'], mjs: ['JS', '#e8d44d'], cjs: ['JS', '#e8d44d'], jsx: ['⚛', '#61dafb'], ts: ['TS', '#3178c6'], tsx: ['⚛', '#3178c6'], json: ['{}', '#cbcb41'], html: ['<>', '#e44d26'],
  css: ['#', '#42a5f5'], scss: ['#', '#cd6799'], md: ['M↓', '#519aba'], py: ['py', '#4b8bbe'], java: ['J', '#e76f00'], c: ['C', '#599eff'], cpp: ['C+', '#599eff'], h: ['h', '#a074c4'],
  cs: ['C#', '#68217a'], php: ['php', '#8892be'], go: ['go', '#00add8'], rs: ['rs', '#dea584'], rb: ['rb', '#cc342d'], swift: ['sw', '#f05138'], kt: ['kt', '#a97bff'], dart: ['dt', '#40c4ff'],
  sql: ['sql', '#dad8d8'], sh: ['$', '#89e051'], ps1: ['>_', '#5391fe'], yml: ['y', '#cb171e'], yaml: ['y', '#cb171e'], xml: ['<>', '#e37933'], lua: ['lua', '#51a0cf'], r: ['R', '#198ce7'],
  pl: ['pl', '#a074c4'], vue: ['V', '#41b883'], svelte: ['S', '#ff3e00'], astro: ['A', '#ff5d01'], svg: ['◇', '#ffb13b'], png: ['▣', '#a074c4'], jpg: ['▣', '#a074c4'], jpeg: ['▣', '#a074c4'],
  gif: ['▣', '#a074c4'], webp: ['▣', '#a074c4'], ico: ['▣', '#a074c4'], zip: ['zip', '#b8b8b8'], gitignore: ['git', '#f14e32'], env: ['⚙', '#ecd53f'], toml: ['⚙', '#9c4221'], lock: ['🔒', '#b8b8b8'],
};
export function fileIcon(path: string, dir = false, open = false): HTMLElement {
  if (dir) return icon(open ? 'folder-opened' : 'folder', 'ide-ficon-dir');
  const name = basename(path).toLowerCase();
  const hit = FILE_ICONS[extname(path) || name.replace(/^\./, '')] ?? (name === 'package.json' ? ['npm', '#cb3837'] : name === 'dockerfile' ? ['🐳', '#2496ed'] : null);
  if (!hit) return icon('file', 'ide-ficon-file');
  return h('span', { class: 'ide-ficon', style: { color: hit[1] }, 'aria-hidden': 'true' }, hit[0]);
}

export type Tab = {
  id: string;
  kind: 'file' | 'diff' | 'view';
  title: string;
  path?: string;
  preview?: boolean;
  iconName?: string;
  /** diff: left side text + label; right side is the file at `path` (live) or `modified` text */
  diff?: { original: string; modified?: string; language?: string };
  /** view: renders into the pane; may return a cleanup. `key` makes the view a singleton. */
  view?: { key: string; render: (el: HTMLElement) => void | (() => void) };
  state?: monaco.editor.ICodeEditorViewState | null;
};

type ModelRec = { model: monaco.editor.ITextModel; saved: number; timer: number };

class Group {
  el: HTMLElement; tabsEl: HTMLElement; crumbsEl: HTMLElement; body: HTMLElement; editorEl: HTMLElement; diffEl: HTMLElement; viewEl: HTMLElement; emptyEl: HTMLElement;
  tabs: Tab[] = [];
  active: Tab | null = null;
  editor: monaco.editor.IStandaloneCodeEditor | null = null;
  diffEditor: monaco.editor.IStandaloneDiffEditor | null = null;
  viewCleanup: (() => void) | void = undefined;
  constructor(readonly id: string) {
    this.tabsEl = h('div', { class: 'ide-tabs', role: 'tablist' });
    this.crumbsEl = h('div', { class: 'ide-crumbs' });
    this.editorEl = h('div', { class: 'ide-pane' });
    this.diffEl = h('div', { class: 'ide-pane', hidden: true });
    this.viewEl = h('div', { class: 'ide-pane ide-view', hidden: true });
    this.emptyEl = h('div', { class: 'ide-pane ide-empty', hidden: true });
    this.body = h('div', { class: 'ide-group-body' }, this.editorEl, this.diffEl, this.viewEl, this.emptyEl);
    this.el = h('div', { class: 'ide-group', dataset: { group: id } }, h('div', { class: 'ide-tabs-row' }, this.tabsEl, h('div', { class: 'ide-tabs-actions' })), this.crumbsEl, this.body);
  }
}

export class Editors {
  readonly el = h('div', { class: 'ide-editors' });
  groups: Group[] = [];
  activeGroup!: Group;
  private models = new Map<string, ModelRec>();
  readonly activeChanged = new Emitter();
  readonly dirtyChanged = new Emitter();
  readonly cursorChanged = new Emitter();
  readonly saved = new Emitter<string>();
  /** rendered inside an empty group (the workbench sets the watermark / welcome) */
  emptyContent: (el: HTMLElement) => void = () => {};
  /** extra buttons at the right of the active group's tab row */
  tabActions: (g: Group) => HTMLElement[] = () => [];
  onTabContext: (tab: Tab, items: MenuItem[]) => MenuItem[] = (_t, i) => i;
  onReveal: (path: string) => void = () => {};

  constructor(readonly fs: WorkspaceFS) {
    this.addGroup();
    fs.changed.on((e) => void this.onFsChange(e));
    settings.changed.on((k) => { if (k.startsWith('editor.') || k.startsWith('files.')) this.applyOptions(); });
    window.addEventListener('blur', () => { if (settings.get('files.autoSave') === 'onFocusChange') void this.saveAll(true); });
    window.addEventListener('beforeunload', (e) => { if (this.dirtyPaths().length) { e.preventDefault(); e.returnValue = ''; } });
  }

  /* ------------------------------------------------------------ models */
  editorOptions(): monaco.editor.IEditorOptions & monaco.editor.IGlobalEditorOptions {
    const s = <T>(k: string) => settings.get<T>(k);
    return {
      fontSize: s<number>('editor.fontSize'), fontFamily: s<string>('editor.fontFamily'), fontLigatures: s<boolean>('editor.fontLigatures'),
      tabSize: s<number>('editor.tabSize'), insertSpaces: s<boolean>('editor.insertSpaces'), wordWrap: s<any>('editor.wordWrap'),
      minimap: { enabled: s<boolean>('editor.minimap.enabled') }, lineNumbers: s<any>('editor.lineNumbers'), renderWhitespace: s<any>('editor.renderWhitespace'),
      cursorStyle: s<any>('editor.cursorStyle'), cursorBlinking: s<any>('editor.cursorBlinking'), bracketPairColorization: { enabled: s<boolean>('editor.bracketPairColorization') },
      autoClosingBrackets: s<boolean>('editor.autoClosingBrackets') ? 'languageDefined' : 'never', autoClosingQuotes: s<boolean>('editor.autoClosingBrackets') ? 'languageDefined' : 'never',
      stickyScroll: { enabled: s<boolean>('editor.stickyScroll') }, smoothScrolling: s<boolean>('editor.smoothScrolling'),
    };
  }
  private applyOptions() {
    const o = this.editorOptions();
    for (const g of this.groups) { g.editor?.updateOptions(o); g.diffEditor?.updateOptions(o); }
    for (const { model } of this.models.values()) model.updateOptions({ tabSize: o.tabSize, insertSpaces: o.insertSpaces });
  }

  hasModel(path: string) { return this.models.has(path); }
  getModelIfOpen(path: string) { return this.models.get(path)?.model ?? null; }
  async getModel(path: string): Promise<monaco.editor.ITextModel> {
    const hit = this.models.get(path);
    if (hit) return hit.model;
    const text = await this.fs.readText(path);
    const again = this.models.get(path);
    if (again) return again.model;
    const model = monaco.editor.createModel(text, languageOf(path), uriOf(path));
    model.updateOptions({ tabSize: settings.get<number>('editor.tabSize'), insertSpaces: settings.get<boolean>('editor.insertSpaces') });
    const rec: ModelRec = { model, saved: model.getAlternativeVersionId(), timer: 0 };
    this.models.set(path, rec);
    model.onDidChangeContent(() => {
      this.dirtyChanged.emit();
      this.paintTabs();
      // typing in a preview tab keeps it
      for (const g of this.groups) for (const t of g.tabs) if (t.path === path && t.preview) t.preview = false;
      if (settings.get('files.autoSave') === 'afterDelay') {
        clearTimeout(rec.timer);
        rec.timer = window.setTimeout(() => { if (this.isDirty(path)) void this.save(path, true); }, settings.get<number>('files.autoSaveDelay'));
      }
    });
    return model;
  }
  /** Loads source files as models so IntelliSense and Go to Definition work across the project. */
  async preload() {
    const files = (await this.fs.walk('/')).filter((p) => /\.(tsx?|jsx?|mjs|cjs|d\.ts)$/.test(p) && !/(^|\/)(dist|build|\.expo|\.next|coverage|vendor)\//.test(p)).slice(0, 80);
    for (const p of files) {
      try { if ((await this.fs.readBytes(p)).length < 200_000) await this.getModel(p); } catch { /* unreadable: skip */ }
    }
  }
  isDirty(path: string) { const r = this.models.get(path); return Boolean(r && !r.model.isDisposed() && r.model.getAlternativeVersionId() !== r.saved); }
  dirtyPaths() { return [...this.models.keys()].filter((p) => this.isDirty(p)); }

  async save(path: string, auto = false) {
    const rec = this.models.get(path);
    if (!rec) return;
    const ed = this.groups.find((g) => g.active?.kind === 'file' && g.active.path === path)?.editor;
    if (!auto && settings.get('editor.formatOnSave') && ed) { try { await ed.getAction('editor.action.formatDocument')?.run(); } catch { /* no formatter */ } }
    if (!auto && settings.get('files.trimTrailingWhitespace') && ed) await ed.getAction('editor.action.trimTrailingWhitespace')?.run();
    let text = rec.model.getValue();
    if (!auto && settings.get('files.insertFinalNewline') && text && !text.endsWith('\n')) { rec.model.pushEditOperations([], [{ range: rec.model.getFullModelRange().collapseToEnd(), text: rec.model.getEOL() }], () => null); text = rec.model.getValue(); }
    const version = rec.model.getAlternativeVersionId();
    this.selfWrite.add(path);
    try { await this.fs.write(path, text); } finally { this.selfWrite.delete(path); }
    rec.saved = version;
    clearTimeout(rec.timer);
    this.dirtyChanged.emit();
    this.paintTabs();
    this.saved.emit(path);
  }
  async saveAll(auto = false) { for (const p of this.dirtyPaths()) await this.save(p, auto); }
  private selfWrite = new Set<string>();

  private async onFsChange(e: { type: string; path: string; to?: string; dir?: boolean; source: string }) {
    if (e.type === 'write') {
      const rec = this.models.get(e.path);
      if (!rec || this.selfWrite.has(e.path)) return;
      // changed outside the editor (terminal, git, an extension): reload unless there are unsaved edits
      const text = await this.fs.readText(e.path).catch(() => null);
      if (text === null || text === rec.model.getValue()) return;
      if (this.isDirty(e.path)) return;
      rec.model.setValue(text);
      rec.saved = rec.model.getAlternativeVersionId();
      this.dirtyChanged.emit(); this.paintTabs();
    } else if (e.type === 'delete') {
      const gone = (p?: string) => Boolean(p && (p === e.path || p.startsWith(e.path + '/')));
      for (const g of [...this.groups]) for (const t of [...g.tabs]) if (t.kind !== 'view' && gone(t.path)) this.closeTab(g, t, true);
      for (const [p, rec] of [...this.models]) if (gone(p)) { rec.model.dispose(); this.models.delete(p); }
    } else if (e.type === 'rename' && e.to) {
      const moved = (p: string) => (p === e.path ? e.to! : p.startsWith(e.path + '/') ? e.to! + p.slice(e.path.length) : null);
      for (const [p, rec] of [...this.models]) {
        const np = moved(p);
        if (!np) continue;
        const dirty = this.isDirty(p);
        const text = rec.model.getValue();
        rec.model.dispose(); this.models.delete(p);
        const model = await this.getModel(np);
        if (dirty) model.setValue(text);
      }
      for (const g of this.groups) {
        for (const t of g.tabs) { const np = t.path && t.kind === 'file' ? moved(t.path) : null; if (np) { t.path = np; t.title = basename(np); } }
        if (g.active) await this.show(g, g.active);
      }
      this.paintTabs();
    }
  }

  /* ------------------------------------------------------------ groups */
  private addGroup(after?: Group): Group {
    const g = new Group(uid());
    const at = after ? this.groups.indexOf(after) + 1 : this.groups.length;
    this.groups.splice(at, 0, g);
    g.el.addEventListener('mousedown', () => this.focusGroup(g), true);
    g.el.addEventListener('focusin', () => this.focusGroup(g));
    this.wireDrop(g);
    this.layoutGroups();
    this.activeGroup ??= g;
    this.paintEmpty(g);
    return g;
  }
  private layoutGroups() {
    clear(this.el);
    this.groups.forEach((g, i) => {
      if (i) {
        const sash = h('div', { class: 'ide-sash v' });
        const left = this.groups[i - 1];
        sash.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          const startX = e.clientX; const lw = left.el.getBoundingClientRect().width; const rw = g.el.getBoundingClientRect().width;
          const move = (ev: PointerEvent) => {
            const d = Math.max(120 - lw, Math.min(rw - 120, ev.clientX - startX));
            left.el.style.flex = `${lw + d} 1 0`; g.el.style.flex = `${rw - d} 1 0`;
            this.layout();
          };
          const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); document.body.classList.remove('ide-dragging'); };
          addEventListener('pointermove', move); addEventListener('pointerup', up); document.body.classList.add('ide-dragging');
        });
        this.el.append(sash);
      }
      g.el.style.flex = '1 1 0';
      this.el.append(g.el);
    });
    this.layout();
  }
  focusGroup(g: Group) {
    if (this.activeGroup === g) return;
    this.activeGroup = g;
    this.groups.forEach((x) => x.el.classList.toggle('active', x === g));
    this.paintTabs();
    this.activeChanged.emit();
  }
  layout() { for (const g of this.groups) { g.editor?.layout(); g.diffEditor?.layout(); } }
  /** Split: the active tab is opened in a new group to the right. */
  async split() {
    if (this.groups.length >= 3) { notify('Up to three editor groups can be open side by side.'); return; }
    const from = this.activeGroup;
    const tab = from.active;
    const g = this.addGroup(from);
    this.focusGroup(g);
    if (tab) await this.openTab({ ...tab, id: uid(), state: from.editor?.saveViewState() ?? null, preview: false }, g);
  }
  private removeGroup(g: Group) {
    if (this.groups.length === 1) return;
    g.editor?.dispose(); g.diffEditor?.dispose(); if (typeof g.viewCleanup === 'function') g.viewCleanup();
    this.groups = this.groups.filter((x) => x !== g);
    if (this.activeGroup === g) { this.activeGroup = this.groups[0]; this.activeGroup.el.classList.add('active'); }
    this.layoutGroups();
    this.activeChanged.emit();
  }

  /* ------------------------------------------------------------ tabs */
  get activeTab() { return this.activeGroup.active; }
  get activeEditor(): monaco.editor.IStandaloneCodeEditor | null {
    const g = this.activeGroup;
    if (g.active?.kind === 'file') return g.editor;
    if (g.active?.kind === 'diff') return g.diffEditor?.getModifiedEditor() ?? null;
    return null;
  }
  get activePath() { const t = this.activeGroup.active; return t && t.kind !== 'view' ? t.path ?? null : null; }
  openPaths() { return [...new Set(this.groups.flatMap((g) => g.tabs.filter((t) => t.kind === 'file').map((t) => t.path!)))]; }

  async openFile(path: string, opts: { line?: number; column?: number; endLine?: number; endColumn?: number; side?: boolean; preview?: boolean; focus?: boolean } = {}) {
    if (!(await this.fs.exists(path))) { notify(`File not found: ${path}`, 'warning'); return; }
    if (!this.models.has(path) && !isBinaryPath(path) && !IMAGE.has(extname(path))) {
      const size = (await this.fs.readBytes(path)).length;
      if (size > 5_000_000 && !(await confirmBox(`${basename(path)} is ${(size / 1_048_576).toFixed(1)} MB.`, 'Opening very large files in the editor uses a lot of memory and can crash the tab.', ['Open Anyway']))) return;
    }
    let g = this.activeGroup;
    if (opts.side) { if (this.groups.length < 3) g = this.addGroup(g); else g = this.groups[(this.groups.indexOf(g) + 1) % this.groups.length]; this.focusGroup(g); }
    const ext = extname(path);
    let tab = g.tabs.find((t) => t.kind !== 'diff' && t.path === path);
    if (!tab) {
      if (IMAGE.has(ext) && ext !== 'svg' || isBinaryPath(path)) tab = { id: uid(), kind: 'view', title: basename(path), path, view: { key: `bin:${path}`, render: (el) => this.renderBinary(el, path) } };
      else tab = { id: uid(), kind: 'file', title: basename(path), path, preview: opts.preview };
    } else if (!opts.preview) tab.preview = false;
    await this.openTab(tab, g, opts.focus !== false);
    if (opts.line && g.editor && tab.kind === 'file') {
      const range = new monaco.Range(opts.line, opts.column ?? 1, opts.endLine ?? opts.line, opts.endColumn ?? opts.column ?? 1);
      g.editor.setSelection(range);
      g.editor.revealRangeInCenterIfOutsideViewport(range);
    }
  }
  private renderBinary(el: HTMLElement, path: string) {
    let url = '';
    void this.fs.readBytes(path).then((bytes) => {
      if (IMAGE.has(extname(path))) {
        url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: `image/${extname(path) === 'jpg' ? 'jpeg' : extname(path) === 'ico' ? 'x-icon' : extname(path)}` }));
        const img = h('img', { src: url, alt: basename(path) });
        const info = h('p', { class: 'ide-dim' }, `${(bytes.length / 1024).toFixed(1)} KB`);
        img.addEventListener('load', () => { info.textContent = `${img.naturalWidth} × ${img.naturalHeight} · ${(bytes.length / 1024).toFixed(1)} KB`; });
        el.append(h('div', { class: 'ide-image' }, img, info));
      } else el.append(h('div', { class: 'ide-center' }, icon('file-binary'), h('p', null, `${basename(path)} is a binary file (${(bytes.length / 1024).toFixed(1)} KB) and cannot be shown in the text editor.`)));
    });
    return () => { if (url) URL.revokeObjectURL(url); };
  }
  async openDiff(title: string, original: string, path: string | undefined, modified?: string, language?: string) {
    const g = this.activeGroup;
    const existing = g.tabs.find((t) => t.kind === 'diff' && t.title === title);
    const tab: Tab = existing ?? { id: uid(), kind: 'diff', title, path, iconName: 'diff' };
    tab.diff = { original, modified, language: language ?? (path ? languageOf(path) : undefined) };
    await this.openTab(tab, g);
  }
  /** The group next to the active one (made if there is only one): previews open there. */
  private sideGroup(): Group {
    if (this.groups.length === 1) return this.addGroup(this.activeGroup);
    return this.groups[(this.groups.indexOf(this.activeGroup) + 1) % this.groups.length];
  }
  async openView(key: string, title: string, iconName: string, render: (el: HTMLElement) => void | (() => void), side = false) {
    for (const g of this.groups) {
      const hit = g.tabs.find((t) => t.view?.key === key);
      if (hit) { hit.title = title; hit.view!.render = render; this.focusGroup(g); if (g.active === hit) { await this.show(g, hit); this.paintTabs(); return; } return this.openTab(hit, g); }
    }
    const from = this.activeGroup;
    await this.openTab({ id: uid(), kind: 'view', title, iconName, view: { key, render } }, side ? this.sideGroup() : from, !side);
    // a preview opened to the side leaves the keyboard in the code editor
    if (side && from.active) { this.focusGroup(from); from.editor?.focus(); }
  }
  closeView(key: string) { for (const g of [...this.groups]) { const t = g.tabs.find((x) => x.view?.key === key); if (t) this.closeTab(g, t, true); } }

  private async openTab(tab: Tab, g: Group, focus = true) {
    if (!g.tabs.includes(tab)) {
      // a preview tab is replaced by the next preview
      const prev = tab.preview ? g.tabs.find((t) => t.preview) : null;
      if (prev) g.tabs.splice(g.tabs.indexOf(prev), 1, tab);
      else g.tabs.splice(g.active ? g.tabs.indexOf(g.active) + 1 : g.tabs.length, 0, tab);
    }
    await this.show(g, tab);
    this.focusGroup(g);
    this.paintTabs();
    if (focus) (tab.kind === 'file' ? g.editor : tab.kind === 'diff' ? g.diffEditor?.getModifiedEditor() : null)?.focus();
    this.activeChanged.emit();
    this.persist();
  }
  private ensureEditor(g: Group) {
    if (g.editor) return g.editor;
    const ed = monaco.editor.create(g.editorEl, {
      model: null, automaticLayout: false, theme: 'ide-theme', scrollBeyondLastLine: true, fixedOverflowWidgets: true, glyphMargin: true,
      padding: { top: 6 }, inlineSuggest: { enabled: true }, quickSuggestions: true, suggestOnTriggerCharacters: true, linkedEditing: true, formatOnPaste: false,
      mouseWheelZoom: true, multiCursorModifier: 'alt', folding: true, showFoldingControls: 'mouseover', renderLineHighlight: 'all', ...this.editorOptions(),
    });
    ed.onDidChangeCursorPosition(() => this.cursorChanged.emit());
    ed.onDidChangeCursorSelection(() => this.cursorChanged.emit());
    ed.onDidFocusEditorText(() => this.focusGroup(g));
    this.editorCreated.emit(ed);
    g.editor = ed;
    return ed;
  }
  readonly editorCreated = new Emitter<monaco.editor.IStandaloneCodeEditor>();

  private async show(g: Group, tab: Tab) {
    // remember where the previous file was scrolled to
    if (g.active && g.active !== tab && g.active.kind === 'file' && g.editor) g.active.state = g.editor.saveViewState();
    if (typeof g.viewCleanup === 'function') g.viewCleanup();
    g.viewCleanup = undefined;
    g.active = tab;
    g.editorEl.hidden = tab.kind !== 'file'; g.diffEl.hidden = tab.kind !== 'diff'; g.viewEl.hidden = tab.kind !== 'view'; g.emptyEl.hidden = true;
    if (tab.kind === 'file') {
      const ed = this.ensureEditor(g);
      let model: monaco.editor.ITextModel;
      try { model = await this.getModel(tab.path!); } catch { notify(`Could not open ${tab.path}`, 'error'); this.closeTab(g, tab, true); return; }
      if (g.active !== tab) return;
      ed.setModel(model);
      if (tab.state) ed.restoreViewState(tab.state);
      ed.layout();
    } else if (tab.kind === 'diff') {
      g.diffEditor ??= monaco.editor.createDiffEditor(g.diffEl, { automaticLayout: false, theme: 'ide-theme', renderSideBySide: true, originalEditable: false, ...this.editorOptions() });
      const old = g.diffEditor.getModel();
      const original = monaco.editor.createModel(tab.diff!.original, tab.diff!.language);
      const live = tab.diff!.modified === undefined && tab.path && (await this.fs.exists(tab.path));
      const modified = live ? await this.getModel(tab.path!) : monaco.editor.createModel(tab.diff!.modified ?? '', tab.diff!.language);
      g.diffEditor.setModel({ original, modified });
      g.diffEditor.updateOptions({ readOnly: !live });
      old?.original.dispose();
      if (old && !this.isFileModel(old.modified)) old.modified.dispose();
      g.diffEditor.layout();
    } else {
      clear(g.viewEl);
      g.viewCleanup = tab.view!.render(g.viewEl);
    }
    this.paintCrumbs(g);
  }
  private isFileModel(m: monaco.editor.ITextModel) { return [...this.models.values()].some((r) => r.model === m); }

  async closeTab(g: Group, tab: Tab, force = false) {
    if (!g.tabs.includes(tab)) return;
    const lastOfFile = tab.kind === 'file' && this.groups.flatMap((x) => x.tabs).filter((t) => t.kind === 'file' && t.path === tab.path).length === 1;
    if (!force && lastOfFile && this.isDirty(tab.path!)) {
      const a = await confirmBox(`Do you want to save the changes you made to ${tab.title}?`, "Your changes will be lost if you don't save them.", ['Save', "Don't Save"]);
      if (a === null) return;
      if (a === 'Save') await this.save(tab.path!);
      else { const rec = this.models.get(tab.path!); if (rec) { rec.model.setValue(await this.fs.readText(tab.path!).catch(() => '')); rec.saved = rec.model.getAlternativeVersionId(); } }
    }
    const i = g.tabs.indexOf(tab);
    g.tabs.splice(i, 1);
    if (g.active === tab) {
      if (typeof g.viewCleanup === 'function') g.viewCleanup();
      g.viewCleanup = undefined;
      g.active = null;
      const next = g.tabs[Math.min(i, g.tabs.length - 1)];
      if (next) await this.show(g, next);
      else if (this.groups.length > 1) { this.removeGroup(g); this.paintTabs(); this.persist(); return; }
      else { g.editor?.setModel(null); this.paintEmpty(g); }
    }
    this.paintTabs();
    this.activeChanged.emit();
    this.persist();
  }
  private paintEmpty(g: Group) {
    g.editorEl.hidden = g.diffEl.hidden = g.viewEl.hidden = true;
    g.emptyEl.hidden = false;
    clear(g.emptyEl);
    this.emptyContent(g.emptyEl);
    clear(g.crumbsEl);
  }
  refreshEmpty() { for (const g of this.groups) if (!g.active) this.paintEmpty(g); }
  async closeActive() { const g = this.activeGroup; if (g.active) await this.closeTab(g, g.active); else if (this.groups.length > 1) this.removeGroup(g); }
  async closeAll() { for (const g of [...this.groups]) for (const t of [...g.tabs]) await this.closeTab(g, t); }
  async closeOthers(g: Group, keep: Tab) { for (const t of [...g.tabs]) if (t !== keep) await this.closeTab(g, t); }
  cycle(dir: 1 | -1) {
    const g = this.activeGroup;
    if (g.tabs.length < 2 || !g.active) return;
    const next = g.tabs[(g.tabs.indexOf(g.active) + dir + g.tabs.length) % g.tabs.length];
    void this.openTab(next, g);
  }
  focusGroupAt(i: number) { const g = this.groups[i]; if (g) { this.focusGroup(g); g.editor?.focus(); } }

  paintTabs() {
    for (const g of this.groups) {
      clear(g.tabsEl);
      for (const tab of g.tabs) {
        const dirty = tab.kind === 'file' && this.isDirty(tab.path!);
        const el = h('div', { class: `ide-tab${g.active === tab ? ' on' : ''}${tab.preview ? ' preview' : ''}${dirty ? ' dirty' : ''}`, role: 'tab', draggable: true, title: tab.path ?? tab.title, 'aria-selected': String(g.active === tab) },
          tab.iconName ? icon(tab.iconName) : tab.path ? fileIcon(tab.path) : icon('file'),
          h('span', { class: 'ide-tab-title' }, tab.title),
          h('button', { class: 'ide-tab-close', type: 'button', title: dirty ? 'Unsaved changes — close' : 'Close', onclick: (e: Event) => { e.stopPropagation(); void this.closeTab(g, tab); } }, icon(dirty ? 'circle-filled' : 'close')));
        el.addEventListener('mousedown', (e) => { if (e.button === 1) { e.preventDefault(); void this.closeTab(g, tab); } });
        el.addEventListener('click', () => void this.openTab(tab, g));
        el.addEventListener('dblclick', () => { tab.preview = false; this.paintTabs(); });
        el.addEventListener('dragstart', (e) => { e.dataTransfer!.setData('application/x-ide-tab', JSON.stringify({ g: g.id, t: tab.id })); e.dataTransfer!.effectAllowed = 'move'; });
        el.addEventListener('dragover', (e) => { if (e.dataTransfer!.types.includes('application/x-ide-tab')) { e.preventDefault(); el.classList.add('drop'); } });
        el.addEventListener('dragleave', () => el.classList.remove('drop'));
        el.addEventListener('drop', (e) => { el.classList.remove('drop'); const d = e.dataTransfer!.getData('application/x-ide-tab'); if (d) { e.preventDefault(); e.stopPropagation(); this.moveTab(JSON.parse(d), g, g.tabs.indexOf(tab)); } });
        el.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          const i = g.tabs.indexOf(tab);
          const items: MenuItem[] = [
            { label: 'Close', key: 'Alt+W', run: () => this.closeTab(g, tab) },
            { label: 'Close Others', run: () => this.closeOthers(g, tab), disabled: g.tabs.length < 2 },
            { label: 'Close to the Right', run: async () => { for (const t of g.tabs.slice(i + 1)) await this.closeTab(g, t); }, disabled: i === g.tabs.length - 1 },
            { label: 'Close All', run: () => this.closeAll() },
            'sep',
            { label: 'Split Right', run: async () => { await this.openTab(tab, g); await this.split(); } },
            ...(tab.path ? ['sep' as const, { label: 'Copy Path', run: () => navigator.clipboard.writeText(tab.path!) }, { label: 'Reveal in Explorer', run: () => this.onReveal(tab.path!) }] : []),
          ];
          showMenu(e.clientX, e.clientY, this.onTabContext(tab, items));
        });
        g.tabsEl.append(el);
        if (g.active === tab) queueMicrotask(() => el.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
      }
      const actions = g.el.querySelector('.ide-tabs-actions')!;
      clear(actions);
      if (g === this.activeGroup) actions.append(...this.tabActions(g));
    }
  }
  private moveTab(from: { g: string; t: string }, to: Group, index: number) {
    const src = this.groups.find((x) => x.id === from.g);
    const tab = src?.tabs.find((t) => t.id === from.t);
    if (!src || !tab) return;
    if (src === to) {
      src.tabs.splice(src.tabs.indexOf(tab), 1);
      src.tabs.splice(index < 0 ? src.tabs.length : index, 0, tab);
      this.paintTabs(); this.persist();
      return;
    }
    if (to.tabs.some((t) => t.kind === tab.kind && t.path === tab.path && t.view?.key === tab.view?.key)) { void this.closeTab(src, tab, true); return; }
    const state = src.active === tab ? src.editor?.saveViewState() : tab.state;
    void this.closeTab(src, tab, true).then(() => {
      if (!this.groups.includes(to)) return;
      const copy = { ...tab, state: state ?? null };
      to.tabs.splice(index < 0 ? to.tabs.length : index, 0, copy);
      void this.openTab(copy, to);
    });
  }
  private wireDrop(g: Group) {
    const row = g.el.querySelector<HTMLElement>('.ide-tabs-row')!;
    for (const zone of [row, g.body]) {
      zone.addEventListener('dragover', (e) => { if (e.dataTransfer!.types.includes('application/x-ide-tab') || e.dataTransfer!.types.includes('application/x-ide-path')) e.preventDefault(); });
      zone.addEventListener('drop', (e) => {
        const t = e.dataTransfer!.getData('application/x-ide-tab');
        const p = e.dataTransfer!.getData('application/x-ide-path');
        if (t) { e.preventDefault(); this.moveTab(JSON.parse(t), g, -1); }
        else if (p) { e.preventDefault(); this.focusGroup(g); void this.fs.isDir(p).then((d) => { if (!d) void this.openFile(p); }); }
      });
    }
  }

  private paintCrumbs(g: Group) {
    clear(g.crumbsEl);
    const tab = g.active;
    if (!tab?.path || tab.kind === 'view') { g.crumbsEl.hidden = true; return; }
    g.crumbsEl.hidden = false;
    const parts = tab.path.split('/').filter(Boolean);
    parts.forEach((name, i) => {
      const full = '/' + parts.slice(0, i + 1).join('/');
      const last = i === parts.length - 1;
      const b = h('button', { class: 'ide-crumb', type: 'button' }, last ? fileIcon(full) : null, name);
      b.addEventListener('click', async () => {
        // siblings of this segment: jump to another file or folder next to it
        const entries = await this.fs.list(dirname(full));
        const r = b.getBoundingClientRect();
        showMenu(r.left, r.bottom, entries.filter((e) => e.name !== '.git').slice(0, 60).map((e) => ({ label: e.dir ? `${e.name}/` : e.name, checked: e.path === full, run: () => (e.dir ? this.onReveal(e.path) : this.openFile(e.path)) })));
      });
      g.crumbsEl.append(b, last ? '' : icon('chevron-right', 'ide-crumb-sep'));
    });
  }

  /* ------------------------------------------------------------ restore */
  private persist = () => {
    memo.set(`tabs:${this.fs.id}`, this.groups.map((g) => ({ tabs: g.tabs.filter((t) => t.kind === 'file').map((t) => t.path), active: g.active?.kind === 'file' ? g.active.path : null })));
  };
  async restore() {
    const saved = memo.get<{ tabs: string[]; active: string | null }[]>(`tabs:${this.fs.id}`, []);
    let first = true;
    for (const s of saved.slice(0, 3)) {
      const paths: string[] = [];
      for (const p of s.tabs) if (await this.fs.exists(p)) paths.push(p);
      if (!paths.length) continue;
      const g = first ? this.groups[0] : this.addGroup();
      first = false;
      for (const p of paths) g.tabs.push({ id: uid(), kind: 'file', title: basename(p), path: p });
      const active = g.tabs.find((t) => t.path === s.active) ?? g.tabs[0];
      await this.show(g, active);
    }
    this.focusGroup(this.groups[0]);
    this.groups[0].el.classList.add('active');
    this.paintTabs();
    this.activeChanged.emit();
  }
}
