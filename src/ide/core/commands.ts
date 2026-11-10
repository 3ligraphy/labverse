/** Command registry + keyboard shortcuts. Menus, the Command Palette, buttons and extensions all run commands. */
import { Emitter } from './dom';
import { memo } from './settings';

export type Command = {
  id: string;
  title: string;
  category?: string;
  /** default shortcut, e.g. "ctrl+shift+p" or a chord "ctrl+k ctrl+s" */
  key?: string;
  run: (...args: any[]) => unknown;
  /** hidden from the palette (internal commands) */
  hidden?: boolean;
  enabled?: () => boolean;
};

const registry = new Map<string, Command>();
export const commandsChanged = new Emitter();
let userKeys: Record<string, string> = memo.get('keybindings', {});

export function register(...cmds: Command[]) {
  for (const c of cmds) registry.set(c.id, c);
  commandsChanged.emit();
  return () => { for (const c of cmds) registry.delete(c.id); commandsChanged.emit(); };
}
export const allCommands = () => [...registry.values()];
export const getCommand = (id: string) => registry.get(id);
export async function run(id: string, ...args: unknown[]) {
  const c = registry.get(id);
  if (!c) { console.warn('[ide] unknown command', id); return; }
  if (c.enabled && !c.enabled()) return;
  try { return await c.run(...args); } catch (e) { console.error(`[ide] command ${id} failed`, e); errorSink(e instanceof Error ? e.message : String(e)); }
}
let errorSink: (msg: string) => void = () => {};
export const onCommandError = (fn: (msg: string) => void) => { errorSink = fn; };

/** The shortcut in effect for a command ('' = none). */
export const keyOf = (id: string) => (id in userKeys ? userKeys[id] : registry.get(id)?.key ?? '');
export function setKey(id: string, key: string | null) {
  if (key === null) delete userKeys[id]; else userKeys[id] = key;
  memo.set('keybindings', userKeys);
  commandsChanged.emit();
}
export const userKeybindings = () => ({ ...userKeys });
export function replaceKeybindings(all: Record<string, string>) { userKeys = { ...all }; memo.set('keybindings', userKeys); commandsChanged.emit(); }

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export function comboOf(e: KeyboardEvent): string {
  const k = e.key;
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(k)) return '';
  const parts: string[] = [];
  if (e.ctrlKey || (isMac && e.metaKey)) parts.push('ctrl');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  let name = k.length === 1 ? k.toLowerCase() : k.toLowerCase();
  if (e.code.startsWith('Key')) name = e.code.slice(3).toLowerCase();
  else if (e.code.startsWith('Digit')) name = e.code.slice(5);
  else if (e.code === 'Backquote') name = '`';
  else if (e.code === 'Backslash') name = '\\';
  else if (e.code === 'Slash') name = '/';
  else if (e.code === 'Comma') name = ',';
  else if (e.code === 'Period') name = '.';
  else if (e.code === 'Equal') name = '=';
  else if (e.code === 'Minus') name = '-';
  else if (k === ' ') name = 'space';
  parts.push(name);
  return parts.join('+');
}
/** "ctrl+shift+p" → "Ctrl+Shift+P" */
export const prettyKey = (key: string) => key.split(' ').map((c) => c.split('+').map((p) => (p.length === 1 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1))).join('+')).join(' ');

let suspended = false;
/** Pauses shortcuts (while a new shortcut is being recorded). */
export const suspendKeys = (v: boolean) => { suspended = v; };
let chord = '';
let chordTimer = 0;
export function installKeyboard(root: Window = window) {
  root.addEventListener('keydown', (e) => {
    if (suspended) return;
    const combo = comboOf(e);
    if (!combo) return;
    const full = chord ? `${chord} ${combo}` : combo;
    let hit: Command | undefined;
    let prefix = false;
    for (const c of registry.values()) {
      const key = keyOf(c.id);
      if (!key) continue;
      if (key === full) { hit = c; break; }
      if (!chord && key.startsWith(combo + ' ')) prefix = true;
    }
    if (hit) {
      chord = '';
      // plain typing keys never fire commands from inside text fields
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (typing && !/ctrl|alt|^f\d+$|escape/.test(full)) return;
      e.preventDefault();
      e.stopPropagation();
      void run(hit.id);
    } else if (prefix) {
      chord = combo;
      clearTimeout(chordTimer);
      chordTimer = window.setTimeout(() => { chord = ''; }, 2500);
      e.preventDefault();
      e.stopPropagation();
    } else chord = '';
  }, true);
}
