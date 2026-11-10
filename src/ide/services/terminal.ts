/** Integrated terminal: xterm.js sessions connected to real shells (jsh) inside the WebContainer runtime. */
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import type { WebContainerProcess } from '@webcontainer/api';
import { clear, h, icon, uid } from '../core/dom';
import { register } from '../core/commands';
import type { IDE } from '../core/ide';
import { settings } from '../core/settings';
import { currentTheme, themeApplied } from '../core/themes';
import { iconButton } from '../ui/workbench';
import { notify, pick, showMenu } from '../ui/widgets';
import type { Runtime } from './runtime';

export type Session = {
  id: string; name: string; key?: string; term: Terminal; fit: FitAddon; el: HTMLElement;
  proc: WebContainerProcess | null; writer: WritableStreamDefaultWriter<string> | null;
  /** pseudo terminals (built-in runners) take the typed input themselves */
  onInput?: (data: string) => void;
  onKill?: () => void;
  busy: boolean;
};

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export class Terminals {
  readonly el = h('div', { class: 'ide-term' });
  private host = h('div', { class: 'ide-term-host' });
  private list = h('div', { class: 'ide-term-list' });
  sessions: Session[] = [];
  active: Session | null = null;

  constructor(private ide: IDE, private runtime: Runtime) {
    this.el.append(this.host, this.list);
    ide.wb.addPanelView({
      id: 'terminal', title: 'Terminal', el: this.el,
      onShow: () => { if (!this.sessions.length) void this.create(); else this.fit(); this.active?.term.focus(); },
      actions: () => [
        iconButton('add', 'New Terminal (Ctrl+Shift+`)', () => this.create()),
        iconButton('chevron-down', 'Launch Profile…', (e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          showMenu(r.left, r.bottom, [
            { label: 'jsh (shell)', run: () => this.create() },
            { label: 'Node.js REPL', run: () => this.create({ name: 'node', command: 'node', args: [] }) },
            'sep', { label: 'Run npm Script…', run: () => import('../core/commands').then((c) => c.run('run.script')) },
          ]);
        }),
        iconButton('clear-all', 'Clear Terminal', () => this.active?.term.clear()),
        iconButton('trash', 'Kill Terminal', () => this.active && this.kill(this.active)),
      ],
    });
    new ResizeObserver(() => this.fit()).observe(this.host);
    ide.wb.layoutChanged.on(() => this.fit());
    themeApplied.on(() => { for (const s of this.sessions) s.term.options.theme = this.theme(); });
    settings.changed.on((k) => { if (k.startsWith('terminal.')) for (const s of this.sessions) { s.term.options.fontSize = settings.get<number>('terminal.fontSize'); s.term.options.cursorBlink = settings.get<boolean>('terminal.cursorBlink'); this.fit(); } });

    register(
      { id: 'terminal.new', title: 'New Terminal', category: 'Terminal', key: 'ctrl+shift+`', run: () => { ide.wb.showPanel('terminal'); return this.create(); } },
      { id: 'terminal.split', title: 'New Node.js REPL', category: 'Terminal', run: () => { ide.wb.showPanel('terminal'); return this.create({ name: 'node', command: 'node', args: [] }); } },
      { id: 'view.terminal', title: 'Toggle Terminal', category: 'View', key: 'ctrl+`', run: () => ide.wb.togglePanel('terminal') },
      { id: 'terminal.kill', title: 'Kill Active Terminal', category: 'Terminal', enabled: () => Boolean(this.active), run: () => this.active && this.kill(this.active) },
      { id: 'terminal.clear', title: 'Clear Terminal', category: 'Terminal', enabled: () => Boolean(this.active), run: () => this.active?.term.clear() },
      { id: 'terminal.runSelection', title: 'Run Selected Text in Terminal', category: 'Terminal', enabled: () => Boolean(ide.editors.activeEditor), run: async () => {
        const ed = ide.editors.activeEditor!;
        const sel = ed.getSelection();
        const text = sel && !sel.isEmpty() ? ed.getModel()!.getValueInRange(sel) : ed.getModel()!.getLineContent(ed.getPosition()!.lineNumber);
        await this.send(text.trim());
      } },
      { id: 'terminal.rename', title: 'Rename Terminal…', category: 'Terminal', enabled: () => Boolean(this.active), run: async () => {
        const { ask } = await import('../ui/widgets');
        const name = this.active && (await ask('Terminal name', this.active.name));
        if (name && this.active) { this.active.name = name; this.paintList(); }
      } },
      { id: 'terminal.focus', title: 'Focus Terminal', category: 'Terminal', run: () => { ide.wb.showPanel('terminal'); this.active?.term.focus(); } },
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
    try { s.fit.fit(); s.proc?.resize({ cols: s.term.cols, rows: s.term.rows }); } catch { /* not visible yet */ }
  }

  private make(name: string, key?: string): Session {
    const term = new Terminal({
      fontFamily: "'Cascadia Code', 'JetBrains Mono', Consolas, 'Courier New', monospace", fontSize: settings.get<number>('terminal.fontSize'),
      cursorBlink: settings.get<boolean>('terminal.cursorBlink'), scrollback: settings.get<number>('terminal.scrollback'), convertEol: true, theme: this.theme(), allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    const el = h('div', { class: 'ide-term-pane' });
    this.host.append(el);
    term.open(el);
    const s: Session = { id: uid(), name, key, term, fit, el, proc: null, writer: null, busy: false };
    term.onData((data) => { if (s.onInput) s.onInput(data); else void s.writer?.write(data); });
    this.sessions.push(s);
    this.show(s);
    return s;
  }

  /** A terminal running a real process in the runtime (default: the jsh shell). */
  async create(opts: { name?: string; command?: string; args?: string[]; key?: string; env?: Record<string, string> } = {}): Promise<Session | null> {
    const n = this.sessions.filter((x) => x.name.startsWith(opts.name ?? 'jsh')).length;
    const s = this.make(`${opts.name ?? 'jsh'}${n ? ` ${n + 1}` : ''}`, opts.key);
    if (this.runtime.state !== 'ready') s.term.writeln('\x1b[2mStarting the runtime (Node.js in your browser)…\x1b[0m');
    try {
      this.fit();
      const proc = await this.runtime.spawn(opts.command ?? 'jsh', opts.args ?? [], { cols: s.term.cols, rows: s.term.rows, env: opts.env });
      s.proc = proc;
      s.writer = proc.input.getWriter();
      void proc.output.pipeTo(new WritableStream({ write: (data) => s.term.write(data) })).catch(() => {});
      void proc.exit.then((code) => {
        if (!this.sessions.includes(s)) return;
        s.proc = null; s.writer = null;
        s.term.writeln(`\r\n\x1b[2m[process exited with code ${code}] Press any key to close.\x1b[0m`);
        s.onInput = () => this.kill(s);
      });
      this.fit();
      return s;
    } catch (e) {
      s.term.writeln(`\x1b[31m${e instanceof Error ? e.message : String(e)}\x1b[0m`);
      s.term.writeln('\x1b[2mThe editor, the phone emulator, the C++ runner and Git still work without the runtime.\x1b[0m');
      return null;
    }
  }
  /** A terminal without a process: a built-in runner writes to it and reads what is typed. */
  pseudo(name: string, key: string): Session {
    const old = this.sessions.find((x) => x.key === key);
    if (old) { old.onKill?.(); old.onKill = undefined; old.onInput = undefined; old.term.reset(); this.show(old); return old; }
    return this.make(name, key);
  }

  /** Types a command into a shell terminal (the active one, or a new one) and runs it. */
  async send(command: string, opts: { key?: string; name?: string; fresh?: boolean } = {}): Promise<Session | null> {
    this.ide.wb.showPanel('terminal');
    let s = opts.key ? this.sessions.find((x) => x.key === opts.key && x.writer) ?? null : this.active?.writer && !this.active.key ? this.active : this.sessions.find((x) => x.writer && !x.key) ?? null;
    if (s && opts.fresh) { this.kill(s); s = null; }
    if (!s) {
      s = await this.create({ name: opts.name, key: opts.key });
      if (!s) return null;
      await new Promise((r) => setTimeout(r, 400)); // let the shell print its prompt
    }
    this.show(s);
    await s.writer?.write(`${command}\r`);
    s.term.focus();
    return s;
  }
  interrupt(s: Session) { void s.writer?.write('\x03'); }

  show(s: Session) {
    this.active = s;
    for (const x of this.sessions) x.el.hidden = x !== s;
    this.paintList();
    requestAnimationFrame(() => { this.fit(); });
  }
  kill(s: Session) {
    s.onKill?.();
    try { s.proc?.kill(); } catch { /* already gone */ }
    s.term.dispose(); s.el.remove();
    this.sessions = this.sessions.filter((x) => x !== s);
    if (this.active === s) { this.active = null; const next = this.sessions[this.sessions.length - 1]; if (next) this.show(next); }
    this.paintList();
    if (!this.sessions.length) this.ide.wb.togglePanel();
  }
  private paintList() {
    clear(this.list);
    this.list.hidden = this.sessions.length < 2;
    for (const s of this.sessions) {
      const row = h('div', { class: `ide-row${s === this.active ? ' sel' : ''}`, title: s.name }, icon(s.proc || !s.key ? 'terminal' : 'play'), h('span', { class: 'ide-row-name' }, s.name),
        h('button', { class: 'ide-icon-btn', type: 'button', title: 'Kill Terminal', onclick: (e: Event) => { e.stopPropagation(); this.kill(s); } }, icon('trash')));
      row.addEventListener('click', () => { this.show(s); s.term.focus(); });
      this.list.append(row);
    }
    this.fit();
  }
}

export function installTerminal(ide: IDE, runtime: Runtime) {
  const terminals = new Terminals(ide, runtime);
  void notify;
  return terminals;
}
