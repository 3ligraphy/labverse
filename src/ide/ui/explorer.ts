/** The file explorer: a tree of the workspace with create, rename, delete, copy/paste, drag and drop, upload and download. */
import { basename, clear, debounce, dirname, h, icon, join } from '../core/dom';
import type { Entry, WorkspaceFS } from '../core/fs';
import { memo } from '../core/settings';
import { fileIcon, type Editors } from './editors';
import { confirmBox, notify, showMenu, type MenuItem } from './widgets';

const BAD_NAME = /[\\/:*?"<>|]/;
/** Folders that are never useful to upload (they are rebuilt by tools) and files too large for browser storage. */
const SKIP_DIR = /(^|\/)(node_modules|\.git|\.expo|\.next|dist|build|android\/app\/build|ios\/Pods|\.gradle|__pycache__)(\/|$)/;
const MAX_UPLOAD = 50 * 1_048_576;
const tooBig = (name: string, size: number) => `${name} (${(size / 1_048_576).toFixed(0)} MB)`;

export class Explorer {
  readonly el = h('div', { class: 'ide-tree', role: 'tree', tabIndex: 0 });
  private open: Set<string>;
  selected = '/';
  private clip: { path: string; cut: boolean } | null = null;
  private editing: { dir: string; kind: 'file' | 'folder' | 'rename'; path?: string } | null = null;
  /** decorations (git status letters) per path */
  decorate: (path: string, dir: boolean) => { badge: string; cls: string } | null = () => null;
  extraMenu: (path: string, dir: boolean) => MenuItem[] = () => [];
  showHidden = memo.get('explorer.hidden', false);

  constructor(private fs: WorkspaceFS, private editors: Editors) {
    this.open = new Set(memo.get<string[]>(`open:${fs.id}`, []));
    const refresh = debounce(() => void this.render(), 60);
    fs.changed.on(refresh);
    editors.activeChanged.on(() => { const p = editors.activePath; if (p && p !== this.selected) { this.selected = p; this.paintSelection(); } });
    this.el.addEventListener('keydown', (e) => void this.onKey(e));
    this.el.addEventListener('contextmenu', (e) => { if (e.target === this.el) { e.preventDefault(); this.selected = '/'; this.paintSelection(); this.menu(e.clientX, e.clientY, '/', true); } });
    this.el.addEventListener('click', (e) => { if (e.target === this.el) { this.selected = '/'; this.paintSelection(); } });
    this.wireDrop(this.el, '/');
    void this.render();
  }
  refresh = () => this.render();

  private persistOpen() { memo.set(`open:${this.fs.id}`, [...this.open]); }
  private paintSelection() {
    this.el.querySelectorAll('.ide-row.sel').forEach((r) => r.classList.remove('sel'));
    this.el.querySelector(`.ide-row[data-path="${CSS.escape(this.selected)}"]`)?.classList.add('sel');
  }
  /** Opens every parent folder and selects the path. */
  async reveal(path: string) {
    let d = dirname(path);
    while (d !== '/') { this.open.add(d); d = dirname(d); }
    if (await this.fs.isDir(path)) this.open.add(path);
    this.selected = path;
    this.persistOpen();
    await this.render();
    this.el.querySelector(`.ide-row[data-path="${CSS.escape(path)}"]`)?.scrollIntoView({ block: 'nearest' });
  }
  collapseAll() { this.open.clear(); this.persistOpen(); void this.render(); }

  private seq = 0;
  private async render() {
    const mine = ++this.seq;
    const frag = document.createDocumentFragment();
    const visit = async (dir: string, depth: number) => {
      if (this.editing && this.editing.kind !== 'rename' && this.editing.dir === dir) frag.append(this.inputRow(depth, this.editing.kind === 'folder', ''));
      for (const e of await this.fs.list(dir)) {
        if (!this.showHidden && e.name === '.git') continue;
        if (this.editing?.kind === 'rename' && this.editing.path === e.path) frag.append(this.inputRow(depth, e.dir, e.name));
        else frag.append(this.row(e, depth));
        if (e.dir && this.open.has(e.path)) await visit(e.path, depth + 1);
      }
    };
    await visit('/', 0);
    if (mine !== this.seq) return;
    clear(this.el).append(frag);
    if (!this.el.childElementCount) this.el.append(h('p', { class: 'ide-tree-empty' }, 'This workspace is empty. Create a file, or drop files and folders here.'));
    this.el.querySelector<HTMLInputElement>('.ide-row-input input')?.focus();
  }

  private row(e: Entry, depth: number): HTMLElement {
    const open = this.open.has(e.path);
    const deco = this.decorate(e.path, e.dir);
    const row = h('div', { class: `ide-row${this.selected === e.path ? ' sel' : ''}${this.clip?.cut && this.clip.path === e.path ? ' cut' : ''}${deco ? ` ${deco.cls}` : ''}`, role: 'treeitem', draggable: true, dataset: { path: e.path, dir: e.dir ? '1' : '' }, style: { paddingLeft: `${8 + depth * 12}px` }, title: e.path, 'aria-expanded': e.dir ? String(open) : undefined },
      e.dir ? icon(open ? 'chevron-down' : 'chevron-right', 'ide-twist') : h('span', { class: 'ide-twist' }),
      fileIcon(e.path, e.dir, open),
      h('span', { class: 'ide-row-name' }, e.name),
      deco ? h('span', { class: 'ide-row-badge' }, deco.badge) : null);
    row.addEventListener('click', () => {
      this.selected = e.path;
      if (e.dir) { if (open) this.open.delete(e.path); else this.open.add(e.path); this.persistOpen(); void this.render(); }
      else { this.paintSelection(); void this.editors.openFile(e.path, { preview: true, focus: false }); }
    });
    row.addEventListener('dblclick', () => { if (!e.dir) void this.editors.openFile(e.path); });
    row.addEventListener('contextmenu', (ev) => { ev.preventDefault(); ev.stopPropagation(); this.selected = e.path; this.paintSelection(); this.menu(ev.clientX, ev.clientY, e.path, e.dir); });
    row.addEventListener('dragstart', (ev) => { ev.dataTransfer!.setData('application/x-ide-path', e.path); ev.dataTransfer!.effectAllowed = 'copyMove'; });
    this.wireDrop(row, e.dir ? e.path : dirname(e.path));
    return row;
  }

  private inputRow(depth: number, dir: boolean, value: string): HTMLElement {
    const input = h('input', { type: 'text', value, spellcheck: false, 'aria-label': value ? 'New name' : dir ? 'Folder name' : 'File name' });
    const err = h('span', { class: 'ide-row-err' });
    const ed = this.editing!;
    let finished = false;
    const finish = async (commit: boolean) => {
      if (finished) return;
      const name = input.value.trim();
      if (commit && name) {
        const bad = name.split('/').some((seg) => !seg || BAD_NAME.test(seg) || seg === '.' || seg === '..') ? 'That name is not valid.' : null;
        const target = ed.kind === 'rename' ? join(dirname(ed.path!), name) : join(ed.dir, name);
        const taken = !bad && target !== ed.path && (await this.fs.exists(target)) ? `"${name}" already exists here.` : null;
        if (bad || taken) { err.textContent = bad ?? taken; input.focus(); return; }
        finished = true;
        this.editing = null;
        try {
          if (ed.kind === 'rename') { if (target !== ed.path) await this.fs.rename(ed.path!, target); }
          else if (ed.kind === 'folder') { await this.fs.mkdirp(target); this.open.add(target); }
          else { await this.fs.write(target, ''); await this.editors.openFile(target); }
          this.selected = target;
          let d = dirname(target);
          while (d !== '/') { this.open.add(d); d = dirname(d); }
          this.persistOpen();
        } catch (e) { notify(e instanceof Error ? e.message : String(e), 'error'); }
      } else { finished = true; this.editing = null; }
      void this.render();
    };
    input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') void finish(true); else if (e.key === 'Escape') void finish(false); });
    input.addEventListener('blur', () => void finish(true));
    input.addEventListener('input', () => { err.textContent = ''; });
    if (value) queueMicrotask(() => { const dot = value.lastIndexOf('.'); input.setSelectionRange(0, dot > 0 && !dir ? dot : value.length); });
    return h('div', { class: 'ide-row ide-row-input', style: { paddingLeft: `${8 + depth * 12}px` } }, h('span', { class: 'ide-twist' }), fileIcon(value || 'x', dir), input, err);
  }

  /** The folder new items go into: the selected folder, or the selected file's folder. */
  private async targetDir() { return this.selected !== '/' && (await this.fs.isDir(this.selected)) ? this.selected : this.selected === '/' ? '/' : dirname(this.selected); }
  async newFile(dir?: string) { const d = dir ?? (await this.targetDir()); this.open.add(d); this.editing = { dir: d, kind: 'file' }; await this.render(); }
  async newFolder(dir?: string) { const d = dir ?? (await this.targetDir()); this.open.add(d); this.editing = { dir: d, kind: 'folder' }; await this.render(); }
  async rename(path = this.selected) { if (path === '/') return; this.editing = { dir: dirname(path), kind: 'rename', path }; await this.render(); }
  async remove(path = this.selected) {
    if (path === '/') return;
    const dir = await this.fs.isDir(path);
    const ok = await confirmBox(`Delete ${dir ? 'the folder' : 'the file'} "${basename(path)}"${dir ? ' and everything in it' : ''}?`, 'This cannot be undone.', ['Delete'], true);
    if (ok) { await this.fs.remove(path); this.selected = dirname(path); }
  }
  async paste(into?: string) {
    if (!this.clip) return;
    const dir = into ?? (await this.targetDir());
    const { path, cut } = this.clip;
    if (!(await this.fs.exists(path))) { this.clip = null; return; }
    try {
      if (cut) { const to = join(dir, basename(path)); if (to !== path) await this.fs.rename(path, to); this.clip = null; }
      else await this.fs.copy(path, await this.fs.freeName(join(dir, basename(path))));
      this.open.add(dir);
    } catch (e) { notify(e instanceof Error ? e.message : String(e), 'error'); }
  }
  async duplicate(path = this.selected) { if (path !== '/') await this.fs.copy(path, await this.fs.freeName(path)); }
  async download(path = this.selected) {
    if (path === '/' || (await this.fs.isDir(path))) { document.dispatchEvent(new CustomEvent('ide:export-zip', { detail: path })); return; }
    const url = URL.createObjectURL(new Blob([(await this.fs.readBytes(path)) as BlobPart]));
    h('a', { href: url, download: basename(path) }).click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  /** Upload through a file picker (files, or a whole folder). */
  upload(folder = false, into?: string) {
    const input = h('input', { type: 'file', multiple: true });
    if (folder) (input as any).webkitdirectory = true;
    input.addEventListener('change', async () => {
      const dir = into ?? (await this.targetDir());
      let n = 0;
      const big: string[] = [];
      for (const f of Array.from(input.files ?? [])) {
        const rel = (f as any).webkitRelativePath || f.name;
        if (SKIP_DIR.test(rel)) continue;
        if (f.size > MAX_UPLOAD) { big.push(tooBig(f.name, f.size)); continue; }
        await this.fs.write(join(dir, rel), new Uint8Array(await f.arrayBuffer()));
        n++;
      }
      this.open.add(dir);
      notify(`${n} file${n === 1 ? '' : 's'} added.`);
      if (big.length) notify(`Not added, larger than 50 MB: ${big.join(', ')}.\nVery large files do not fit in browser storage. Keep them on your computer or link to them online.`, 'warning', [], true);
    });
    input.click();
  }

  private menu(x: number, y: number, path: string, dir: boolean) {
    const root = path === '/';
    const into = dir ? path : dirname(path);
    const items: MenuItem[] = [
      { label: 'New File…', run: () => this.newFile(into) },
      { label: 'New Folder…', run: () => this.newFolder(into) },
      'sep',
      ...(!dir ? [{ label: 'Open to the Side', run: () => this.editors.openFile(path, { side: true }) } as MenuItem] : []),
      ...this.extraMenu(path, dir),
      { label: 'Upload Files…', run: () => this.upload(false, into) },
      { label: 'Upload Folder…', run: () => this.upload(true, into) },
      { label: dir ? 'Download as ZIP' : 'Download', run: () => this.download(path) },
      'sep',
      { label: 'Cut', key: 'Ctrl+X', disabled: root, run: () => { this.clip = { path, cut: true }; void this.render(); } },
      { label: 'Copy', key: 'Ctrl+C', disabled: root, run: () => { this.clip = { path, cut: false }; } },
      { label: 'Paste', key: 'Ctrl+V', disabled: !this.clip, run: () => this.paste(into) },
      { label: 'Duplicate', disabled: root, run: () => this.duplicate(path) },
      'sep',
      { label: 'Copy Path', disabled: root, run: () => navigator.clipboard.writeText(path) },
      { label: 'Copy Relative Path', disabled: root, run: () => navigator.clipboard.writeText(path.slice(1)) },
      'sep',
      { label: 'Rename…', key: 'F2', disabled: root, run: () => this.rename(path) },
      { label: 'Delete', key: 'Delete', disabled: root, run: () => this.remove(path) },
    ];
    showMenu(x, y, items);
  }

  private async onKey(e: KeyboardEvent) {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    const rows = [...this.el.querySelectorAll<HTMLElement>('.ide-row[data-path]')];
    const i = rows.findIndex((r) => r.dataset.path === this.selected);
    const go = (r?: HTMLElement) => { if (r) { this.selected = r.dataset.path!; this.paintSelection(); r.scrollIntoView({ block: 'nearest' }); } };
    const cur = rows[i];
    const isDir = cur?.dataset.dir === '1';
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'ArrowDown') { e.preventDefault(); go(rows[Math.min(rows.length - 1, i + 1)]); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); go(rows[Math.max(0, i - 1)]); }
    else if (e.key === 'ArrowRight' && cur && isDir) { e.preventDefault(); if (!this.open.has(this.selected)) { this.open.add(this.selected); this.persistOpen(); await this.render(); } else go(rows[i + 1]); }
    else if (e.key === 'ArrowLeft' && cur) { e.preventDefault(); if (isDir && this.open.has(this.selected)) { this.open.delete(this.selected); this.persistOpen(); await this.render(); } else if (dirname(this.selected) !== '/') go(rows.find((r) => r.dataset.path === dirname(this.selected))); }
    else if (e.key === 'Enter' && cur) { e.preventDefault(); if (isDir) cur.click(); else void this.editors.openFile(this.selected); }
    else if (e.key === 'F2') { e.preventDefault(); void this.rename(); }
    else if (e.key === 'Delete') { e.preventDefault(); void this.remove(); }
    else if (mod && e.key.toLowerCase() === 'c' && this.selected !== '/') { this.clip = { path: this.selected, cut: false }; }
    else if (mod && e.key.toLowerCase() === 'x' && this.selected !== '/') { this.clip = { path: this.selected, cut: true }; void this.render(); }
    else if (mod && e.key.toLowerCase() === 'v') { e.preventDefault(); void this.paste(); }
  }

  /** Drop target: move a tree item here, or upload files/folders dragged in from the computer. */
  private wireDrop(el: HTMLElement, dir: string) {
    el.addEventListener('dragover', (e) => {
      const t = e.dataTransfer!.types;
      if (!t.includes('application/x-ide-path') && !t.includes('Files')) return;
      e.preventDefault(); e.stopPropagation();
      el.classList.add('drop');
    });
    el.addEventListener('dragleave', () => el.classList.remove('drop'));
    el.addEventListener('drop', async (e) => {
      el.classList.remove('drop');
      const from = e.dataTransfer!.getData('application/x-ide-path');
      e.preventDefault(); e.stopPropagation();
      try {
        if (from) {
          const to = join(dir, basename(from));
          if (to === from || dirname(from) === dir) return;
          if (e.ctrlKey) await this.fs.copy(from, await this.fs.freeName(to)); else await this.fs.rename(from, to);
          this.open.add(dir); this.persistOpen();
          return;
        }
        const items = Array.from(e.dataTransfer!.items).map((i) => (i as any).webkitGetAsEntry?.()).filter(Boolean);
        let n = 0;
        const big: string[] = [];
        const take = async (entry: any, base: string): Promise<void> => {
          if (SKIP_DIR.test(`/${entry.name}/`)) return;
          if (entry.isFile) {
            const file: File = await new Promise((res, rej) => entry.file(res, rej));
            if (file.size > MAX_UPLOAD) { big.push(tooBig(file.name, file.size)); return; }
            await this.fs.write(join(base, entry.name), new Uint8Array(await file.arrayBuffer()));
            n++;
          } else if (entry.isDirectory) {
            const reader = entry.createReader();
            await this.fs.mkdirp(join(base, entry.name));
            for (;;) {
              const batch: any[] = await new Promise((res, rej) => reader.readEntries(res, rej));
              if (!batch.length) break;
              for (const child of batch) await take(child, join(base, entry.name));
            }
          }
        };
        for (const it of items) await take(it, dir);
        if (n) { this.open.add(dir); this.persistOpen(); notify(`${n} file${n === 1 ? '' : 's'} added.`); }
        if (big.length) notify(`Not added, larger than 50 MB: ${big.join(', ')}.\nVery large files do not fit in browser storage.`, 'warning', [], true);
      } catch (err) { notify(err instanceof Error ? err.message : String(err), 'error'); }
    });
  }
}
