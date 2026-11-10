/** User settings (kept in this browser; synced to the account when signed in) and the workspace list. */
import { Emitter, uid } from './dom';

export type SettingDef = { key: string; title: string; description: string; group: string } & (
  | { type: 'number'; default: number; min?: number; max?: number }
  | { type: 'boolean'; default: boolean }
  | { type: 'string'; default: string }
  | { type: 'enum'; default: string; options: string[] }
);

export const SETTINGS: SettingDef[] = [
  { key: 'workbench.colorTheme', group: 'Workbench', title: 'Color Theme', description: 'The color theme of the IDE. Installed theme extensions are listed in the Command Palette: "Preferences: Color Theme".', type: 'string', default: 'Dark Modern' },
  { key: 'workbench.sideBar.location', group: 'Workbench', title: 'Side Bar Location', description: 'Which side the side bar and activity bar are on.', type: 'enum', default: 'left', options: ['left', 'right'] },
  { key: 'workbench.startupEditor', group: 'Workbench', title: 'Startup Editor', description: 'What opens when no file is open.', type: 'enum', default: 'welcome', options: ['welcome', 'none'] },
  { key: 'editor.fontSize', group: 'Editor', title: 'Font Size', description: 'Font size in pixels.', type: 'number', default: 14, min: 8, max: 40 },
  { key: 'editor.fontFamily', group: 'Editor', title: 'Font Family', description: 'The editor font.', type: 'string', default: "'JetBrains Mono', 'Cascadia Code', Consolas, 'Courier New', monospace" },
  { key: 'editor.fontLigatures', group: 'Editor', title: 'Font Ligatures', description: 'Turn on font ligatures.', type: 'boolean', default: false },
  { key: 'editor.tabSize', group: 'Editor', title: 'Tab Size', description: 'Spaces per tab.', type: 'number', default: 2, min: 1, max: 8 },
  { key: 'editor.insertSpaces', group: 'Editor', title: 'Insert Spaces', description: 'Insert spaces when pressing Tab.', type: 'boolean', default: true },
  { key: 'editor.wordWrap', group: 'Editor', title: 'Word Wrap', description: 'How lines wrap.', type: 'enum', default: 'off', options: ['off', 'on', 'wordWrapColumn', 'bounded'] },
  { key: 'editor.minimap.enabled', group: 'Editor', title: 'Minimap', description: 'Show the minimap.', type: 'boolean', default: true },
  { key: 'editor.lineNumbers', group: 'Editor', title: 'Line Numbers', description: 'How line numbers are shown.', type: 'enum', default: 'on', options: ['on', 'off', 'relative'] },
  { key: 'editor.renderWhitespace', group: 'Editor', title: 'Render Whitespace', description: 'Show whitespace characters.', type: 'enum', default: 'selection', options: ['none', 'boundary', 'selection', 'trailing', 'all'] },
  { key: 'editor.cursorStyle', group: 'Editor', title: 'Cursor Style', description: 'The cursor shape.', type: 'enum', default: 'line', options: ['line', 'block', 'underline', 'line-thin'] },
  { key: 'editor.cursorBlinking', group: 'Editor', title: 'Cursor Blinking', description: 'The cursor animation.', type: 'enum', default: 'blink', options: ['blink', 'smooth', 'phase', 'expand', 'solid'] },
  { key: 'editor.bracketPairColorization', group: 'Editor', title: 'Bracket Pair Colorization', description: 'Color matching brackets.', type: 'boolean', default: true },
  { key: 'editor.autoClosingBrackets', group: 'Editor', title: 'Auto Closing Brackets', description: 'Close brackets and quotes automatically.', type: 'boolean', default: true },
  { key: 'editor.formatOnSave', group: 'Editor', title: 'Format On Save', description: 'Format a file when it is saved (languages with a formatter).', type: 'boolean', default: false },
  { key: 'editor.stickyScroll', group: 'Editor', title: 'Sticky Scroll', description: 'Keep the current scope at the top of the editor.', type: 'boolean', default: true },
  { key: 'editor.smoothScrolling', group: 'Editor', title: 'Smooth Scrolling', description: 'Animate scrolling.', type: 'boolean', default: true },
  { key: 'files.autoSave', group: 'Files', title: 'Auto Save', description: 'Save files automatically.', type: 'enum', default: 'afterDelay', options: ['off', 'afterDelay', 'onFocusChange'] },
  { key: 'files.autoSaveDelay', group: 'Files', title: 'Auto Save Delay', description: 'Milliseconds after typing stops before a file is saved.', type: 'number', default: 800, min: 100, max: 60000 },
  { key: 'files.trimTrailingWhitespace', group: 'Files', title: 'Trim Trailing Whitespace', description: 'Remove trailing spaces when saving.', type: 'boolean', default: false },
  { key: 'files.insertFinalNewline', group: 'Files', title: 'Insert Final Newline', description: 'End files with a newline when saving.', type: 'boolean', default: false },
  { key: 'terminal.fontSize', group: 'Terminal', title: 'Terminal Font Size', description: 'Font size in pixels.', type: 'number', default: 13, min: 8, max: 30 },
  { key: 'terminal.cursorBlink', group: 'Terminal', title: 'Terminal Cursor Blink', description: 'Blink the terminal cursor.', type: 'boolean', default: true },
  { key: 'terminal.scrollback', group: 'Terminal', title: 'Scrollback', description: 'Lines kept in the terminal buffer.', type: 'number', default: 5000, min: 100, max: 100000 },
  { key: 'git.authorName', group: 'Git', title: 'Author Name', description: 'Your name on commits.', type: 'string', default: '' },
  { key: 'git.authorEmail', group: 'Git', title: 'Author Email', description: 'Your email on commits.', type: 'string', default: '' },
  { key: 'preview.autoRefresh', group: 'Preview', title: 'Auto Refresh', description: 'Reload the static preview when a file is saved.', type: 'boolean', default: true },
];

const KEY = 'ide:settings';
const read = <T>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) ?? '') as T; } catch { return fallback; } };
const write = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage off */ } };

class Settings {
  private user: Record<string, unknown> = read(KEY, {});
  readonly changed = new Emitter<string>();
  get<T = unknown>(key: string): T {
    if (key in this.user) return this.user[key] as T;
    return SETTINGS.find((s) => s.key === key)?.default as T;
  }
  set(key: string, value: unknown) {
    const def = SETTINGS.find((s) => s.key === key);
    if (def && value === def.default) delete this.user[key]; else this.user[key] = value;
    write(KEY, this.user);
    this.changed.emit(key);
  }
  /** Only what differs from the defaults (what settings.json shows). */
  json() { return { ...this.user }; }
  replace(all: Record<string, unknown>) {
    const keys = new Set([...Object.keys(this.user), ...Object.keys(all)]);
    this.user = { ...all };
    write(KEY, this.user);
    keys.forEach((k) => this.changed.emit(k));
  }
}
export const settings = new Settings();

/* ------------------------------------------------------------------ small persisted UI state */
export const memo = {
  get: <T>(key: string, fallback: T): T => read(`ide:${key}`, fallback),
  set: (key: string, value: unknown) => write(`ide:${key}`, value),
};

/* ------------------------------------------------------------------ workspaces */
export type Workspace = { id: string; name: string; created: number; opened: number; cloudId?: string };

export const workspaces = {
  all: (): Workspace[] => read<Workspace[]>('ide:workspaces', []).sort((a, b) => b.opened - a.opened),
  save(list: Workspace[]) { write('ide:workspaces', list); },
  get(id: string) { return this.all().find((w) => w.id === id) ?? null; },
  create(name: string): Workspace {
    const ws = { id: uid(), name: name.trim() || 'Untitled', created: Date.now(), opened: Date.now() };
    this.save([...this.all(), ws]);
    return ws;
  },
  touch(id: string) { this.save(this.all().map((w) => (w.id === id ? { ...w, opened: Date.now() } : w))); },
  patch(id: string, patch: Partial<Workspace>) { this.save(this.all().map((w) => (w.id === id ? { ...w, ...patch } : w))); },
  remove(id: string) { this.save(this.all().filter((w) => w.id !== id)); },
};
