/**
 * The runtime: a WebContainer (a real Node.js environment with a shell and npm) running inside this browser tab.
 * Commands really execute — isolated in the tab's sandbox, never on the BUENOVA server. The workspace files are
 * mirrored into it and changes made by commands (npm install, generators, builds) are mirrored back.
 */
import { WebContainer, type FileSystemTree, type WebContainerProcess } from '@webcontainer/api';
import { Emitter, debounce, dirname } from '../core/dom';
import type { IDE } from '../core/ide';

export type Port = { port: number; url: string };
const SKIP = /(^|\/)(node_modules|\.git)(\/|$)/;
const rel = (p: string) => p.replace(/^\//, '');

export class Runtime {
  wc: WebContainer | null = null;
  state: 'idle' | 'booting' | 'ready' | 'failed' = 'idle';
  error = '';
  readonly ports = new Map<number, string>();
  readonly portsChanged = new Emitter<Port | null>();
  readonly stateChanged = new Emitter();
  private booting: Promise<WebContainer> | null = null;
  /** paths we just wrote into the container (so the watcher does not echo them back) */
  private echo = new Map<string, number>();

  constructor(private ide: IDE) {
    ide.fs.changed.on((e) => { if (e.source !== 'runtime') void this.push(e); });
    this.paint();
  }
  get supported() { return typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined'; }

  private paint() {
    const label = { idle: 'Runtime: not started', booting: 'Runtime: starting…', ready: 'Runtime: Node.js ready', failed: 'Runtime: unavailable' }[this.state];
    this.ide.wb.status('runtime', 'left', 30, { iconName: this.state === 'booting' ? 'loading' : this.state === 'ready' ? 'vm-running' : this.state === 'failed' ? 'warning' : 'vm', text: label.replace('Runtime: ', ''), title: this.error || `${label} (WebContainer: Node.js, npm and a shell running in this tab)`, command: 'terminal.new' });
    this.stateChanged.emit();
  }

  /** Boots once; every caller gets the same container. */
  boot(): Promise<WebContainer> {
    if (this.wc) return Promise.resolve(this.wc);
    return (this.booting ??= this.start());
  }
  private async start(): Promise<WebContainer> {
    this.state = 'booting'; this.paint();
    try {
      if (!this.supported) throw new Error('This browser tab is not cross-origin isolated, so the in-browser runtime cannot start. Use a current Chrome, Edge or Firefox and reload the page.');
      const wc = await WebContainer.boot({ workdirName: 'project', coep: 'credentialless', forwardPreviewErrors: true });
      await wc.mount(await this.tree());
      wc.on('server-ready', (port, url) => { this.ports.set(port, url); this.portsChanged.emit({ port, url }); });
      wc.on('port', (port, type, url) => {
        if (type === 'close') { this.ports.delete(port); this.portsChanged.emit(null); }
        else if (!this.ports.has(port)) { this.ports.set(port, url); this.portsChanged.emit(null); }
      });
      wc.on('error', (e) => this.ide.output.line('Runtime', `error: ${e.message}`));
      wc.on('preview-message', (m: any) => this.ide.output.line('Preview', `${m.type ?? 'message'}: ${m.message ?? m.args?.join(' ') ?? ''}${m.stack ? `\n${m.stack}` : ''}`));
      this.wc = wc;
      this.watch(wc);
      this.state = 'ready'; this.paint();
      return wc;
    } catch (e) {
      this.state = 'failed';
      this.error = e instanceof Error ? e.message : String(e);
      this.booting = null;
      this.paint();
      throw e;
    }
  }

  private async tree(): Promise<FileSystemTree> {
    const root: FileSystemTree = {};
    for (const path of await this.ide.fs.walk('/')) {
      const parts = rel(path).split('/');
      let node = root;
      for (const dir of parts.slice(0, -1)) node = ((node[dir] ??= { directory: {} }) as { directory: FileSystemTree }).directory;
      node[parts[parts.length - 1]] = { file: { contents: await this.ide.fs.readBytes(path) } };
    }
    return root;
  }

  /** IDE → container */
  private async push(e: { type: string; path: string; to?: string }) {
    const wc = this.wc;
    if (!wc || SKIP.test(e.path)) return;
    try {
      this.echo.set(e.path, Date.now());
      if (e.type === 'write') {
        if (dirname(e.path) !== '/') await wc.fs.mkdir(rel(dirname(e.path)), { recursive: true });
        await wc.fs.writeFile(rel(e.path), await this.ide.fs.readBytes(e.path));
      } else if (e.type === 'mkdir') await wc.fs.mkdir(rel(e.path), { recursive: true });
      else if (e.type === 'delete') await wc.fs.rm(rel(e.path), { recursive: true, force: true });
      else if (e.type === 'rename' && e.to) {
        this.echo.set(e.to, Date.now());
        if (dirname(e.to) !== '/') await wc.fs.mkdir(rel(dirname(e.to)), { recursive: true });
        await wc.fs.rename(rel(e.path), rel(e.to));
      }
    } catch (err) { console.warn('[ide] runtime sync', e, err); }
  }

  /** container → IDE (files created or changed by commands) */
  private watch(wc: WebContainer) {
    const pending = new Set<string>();
    const flush = debounce(async () => {
      const batch = [...pending]; pending.clear();
      for (const path of batch) await this.pull(wc, path);
    }, 200);
    try {
      wc.fs.watch('.', { recursive: true }, (_event, filename) => {
        const name = typeof filename === 'string' ? filename : filename ? new TextDecoder().decode(filename as Uint8Array) : '';
        const path = '/' + name.replace(/\\/g, '/').replace(/^\.?\//, '');
        if (!name || SKIP.test(path)) return;
        pending.add(path);
        flush();
      });
    } catch (e) { console.warn('[ide] runtime watch unavailable', e); }
  }
  private async pull(wc: WebContainer, path: string) {
    const fs = this.ide.fs;
    const at = this.echo.get(path);
    if (at && Date.now() - at < 1500) return;
    let bytes: Uint8Array | null = null;
    try { bytes = await wc.fs.readFile(rel(path)); } catch { /* a folder, or gone */ }
    if (bytes) {
      if (await fs.exists(path)) {
        if (await fs.isDir(path)) return;
        const cur = await fs.readBytes(path);
        if (cur.length === bytes.length && cur.every((b, i) => b === bytes![i])) return;
      }
      await fs.write(path, bytes, 'runtime');
      return;
    }
    try {
      const names = await wc.fs.readdir(rel(path));
      await fs.mkdirp(path, 'runtime');
      // a folder that appeared at once (a scaffold, an unzip): take its files too
      for (const n of names) if (!SKIP.test(`/${n}`)) await this.pull(wc, `${path}/${n}`);
    } catch { await fs.remove(path, 'runtime'); }
  }

  async spawn(command: string, args: string[], opts: { cols?: number; rows?: number; env?: Record<string, string>; cwd?: string } = {}): Promise<WebContainerProcess> {
    const wc = await this.boot();
    return wc.spawn(command, args, { terminal: opts.cols ? { cols: opts.cols, rows: opts.rows ?? 24 } : undefined, env: opts.env, cwd: opts.cwd });
  }
  /** Runs a command to the end and returns what it printed. */
  async exec(command: string, args: string[]): Promise<{ code: number; output: string }> {
    const p = await this.spawn(command, args);
    let output = '';
    void p.output.pipeTo(new WritableStream({ write: (chunk) => { output += chunk; } })).catch(() => {});
    return { code: await p.exit, output };
  }
}
