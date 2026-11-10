/**
 * The Terminal panel: one tab per program you run (▶ Run). It shows the program's output and sends what you type
 * to it (cin in C++, input() in Python, prompt() in JavaScript). There is no shell: nothing is installed and no
 * commands run here, so nothing can use up the browser's memory.
 */
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { clear, h, icon, uid } from '../core/dom';
import { register } from '../core/commands';
import type { IDE } from '../core/ide';
import { settings } from '../core/settings';
import { currentTheme, themeApplied } from '../core/themes';
import { iconButton } from '../ui/workbench';
import { pick } from '../ui/widgets';

export type Session = {
  id: string; name: string; key: string; term: Terminal; fit: FitAddon; el: HTMLElement;
  /** the running program reads what is typed */
  onInput?: (data: string) => void;
  /** stops the program (Stop, closing the tab, running again) */
  onKill?: () => void;
};

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const WELCOME = '\x1b[2mThis terminal shows the output of your program. Open a file and press \x1b[0m\x1b[1m▶ Run\x1b[0m\x1b[2m (F5).\r\nWhen the program asks for input, type here and press Enter. Nothing needs to be installed.\x1b[0m\r\n';

export class Terminals {
  readonly el = h('div', { class: 'ide-term' });
  private host = h('div', { class: 'ide-term-host' });
  private list = h('div', { class: 'ide-term-list' });
  sessions: Session[] = [];
  active: Session | null = null;

  constructor(private ide: IDE) {
    this.el.append(this.host, this.list);
    ide.wb.addPanelView({
      id: 'terminal', title: 'Terminal', el: this.el,
      onShow: () => { if (!this.sessions.length) this.welcome(); else this.fit(); this.active?.term.focus(); },
      actions: () => [
        iconButton('clear-all', 'Clear Terminal', () => this.active?.term.clear()),
        iconButton('trash', 'Close Terminal', () => this.active && this.kill(this.active)),
      ],
    });
    new ResizeObserver(() => this.fit()).observe(this.host);
    ide.wb.layoutChanged.on(() => this.fit());
    themeApplied.on(() => { for (const s of this.sessions) s.term.options.theme = this.theme(); });
    settings.changed.on((k) => { if (k.startsWith('terminal.')) for (const s of this.sessions) { s.term.options.fontSize = settings.get<number>('terminal.fontSize'); s.term.options.cursorBlink = settings.get<boolean>('terminal.cursorBlink'); this.fit(); } });

    register(
      { id: 'view.terminal', title: 'Toggle Terminal', category: 'View', key: 'ctrl+`', run: () => ide.wb.togglePanel('terminal') },
      { id: 'terminal.kill', title: 'Close Active Terminal', category: 'Terminal', enabled: () => Boolean(this.active), run: () => this.active && this.kill(this.active) },
      { id: 'terminal.clear', title: 'Clear Terminal', category: 'Terminal', enabled: () => Boolean(this.active), run: () => this.active?.term.clear() },
      { id: 'terminal.pick', title: 'Switch Terminal…', category: 'Terminal', enabled: () => this.sessions.length > 1, run: async () => { const s = await pick(this.sessions.map((x) => ({ label: x.name, value: x })), 'Switch terminal'); if (s) this.show(s); } },
    );
  }

  private theme() {
    const dark = currentTheme().type !== 'light';
    return {
      background: css('--ide-term-bg') || (dark ? '#181818' : '#f8f8f8'), foreground: css('--ide-term-fg') || (dark ? '#cccccc' : '#3b3b3b'),
      cursor: css('--ide-term-fg'), selectionBackground: dark ? '#264f78' : '#add6ff',
      ...(dark ? {} : { black: '#000000', red: '#cd3131', green: '#107c10', yellow: '#949800', blue: '#0451a5', magenta: '#bc05bc', cyan: '#0598bc', white: '#555555', brightBlack: '#666666', brightRed: '#cd3131', brightGreen: '#14ce14', brightYellow: '#b5ba00', brightBlue: '#0451a5', brightMagenta: '#bc05bc', brightCyan: '#0598bc', brightWhite: '#a5a5a5' }),
    };
  }
  private fit() {
    const s = this.active;
    if (!s || !this.host.offsetWidth || this.el.hidden) return;
    try { s.fit.fit(); s.term.refresh(0, s.term.rows - 1); } catch { /* not visible yet */ }
  }

  private make(name: string, key: string): Session {
    const term = new Terminal({
      fontFamily: "'Cascadia Code', 'JetBrains Mono', Consolas, 'Courier New', monospace", fontSize: settings.get<number>('terminal.fontSize'),
      cursorBlink: settings.get<boolean>('terminal.cursorBlink'), scrollback: settings.get<number>('terminal.scrollback'), convertEol: true, theme: this.theme(),
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    const el = h('div', { class: 'ide-term-pane' });
    this.host.append(el);
    term.open(el);
    const s: Session = { id: uid(), name, key, term, fit, el };
    term.onData((data) => s.onInput?.(data));
    this.sessions.push(s);
    this.show(s);
    return s;
  }
  private welcome() { const s = this.make('Terminal', 'welcome'); s.term.write(WELCOME); }

  /**
   * The terminal of one runner (C++, Python, JavaScript…): reused for every run of that kind, cleared first.
   * The previous program in it is stopped.
   */
  pseudo(name: string, key: string): Session {
    this.ide.wb.showPanel('terminal');
    for (const w of this.sessions.filter((x) => x.key === 'welcome')) this.kill(w, false);
    const old = this.sessions.find((x) => x.key === key);
    if (old) {
      old.onKill?.(); old.onKill = undefined; old.onInput = undefined;
      old.name = name;
      old.term.reset();
      this.show(old);
      return old;
    }
    return this.make(name, key);
  }

  show(s: Session) {
    this.active = s;
    for (const x of this.sessions) x.el.hidden = x !== s;
    this.paintList();
    requestAnimationFrame(() => { this.fit(); s.term.scrollToBottom(); });
  }
  kill(s: Session, hidePanel = true) {
    s.onKill?.();
    s.term.dispose(); s.el.remove();
    this.sessions = this.sessions.filter((x) => x !== s);
    if (this.active === s) { this.active = null; const next = this.sessions[this.sessions.length - 1]; if (next) this.show(next); }
    this.paintList();
    if (!this.sessions.length && hidePanel) this.ide.wb.togglePanel();
  }
  /** Stops whatever runs in the active terminal (the Stop button). */
  stopActive() { const s = this.active; if (s?.onKill) { s.onKill(); s.onKill = undefined; s.onInput = undefined; s.term.writeln('\r\n\x1b[2m[stopped]\x1b[0m'); } }
  private paintList() {
    clear(this.list);
    this.list.hidden = this.sessions.length < 2;
    for (const s of this.sessions) {
      const row = h('div', { class: `ide-row${s === this.active ? ' sel' : ''}`, title: s.name }, icon('play'), h('span', { class: 'ide-row-name' }, s.name),
        h('button', { class: 'ide-icon-btn', type: 'button', title: 'Close Terminal', onclick: (e: Event) => { e.stopPropagation(); this.kill(s); } }, icon('trash')));
      row.addEventListener('click', () => { this.show(s); s.term.focus(); });
      this.list.append(row);
    }
    this.fit();
  }
}

export function installTerminal(ide: IDE) {
  return new Terminals(ide);
}
