/**
 * The workspace file system: every project lives in the browser's IndexedDB (LightningFS), one database per
 * workspace. isomorphic-git works on the same files (/.git). The WebContainer runtime gets a mirror of it.
 */
import LightningFS from '@isomorphic-git/lightning-fs';
import { Emitter, dirname, extname, join } from './dom';

export type FsSource = 'ide' | 'runtime' | 'git';
export type FsEvent = { type: 'write' | 'delete' | 'rename' | 'mkdir'; path: string; to?: string; dir?: boolean; source: FsSource };
export type Entry = { name: string; path: string; dir: boolean };

const BINARY = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'avif', 'pdf', 'zip', 'gz', 'tar', 'woff', 'woff2', 'ttf', 'otf', 'eot', 'mp3', 'mp4', 'wav', 'ogg', 'webm', 'wasm', 'exe', 'dll', 'bin', 'class', 'jar', 'vsix']);
export const isBinaryPath = (p: string) => BINARY.has(extname(p));
export const IMAGE = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'avif', 'svg']);
const enc = new TextEncoder();
const dec = new TextDecoder();

export class WorkspaceFS {
  readonly raw: LightningFS;
  private p: LightningFS.PromisifiedFS;
  readonly changed = new Emitter<FsEvent>();

  constructor(readonly id: string) {
    this.raw = new LightningFS(`ide-ws-${id}`);
    this.p = this.raw.promises;
  }
  static async destroy(id: string) {
    await new Promise<void>((res) => { const r = indexedDB.deleteDatabase(`ide-ws-${id}`); r.onsuccess = r.onerror = r.onblocked = () => res(); });
  }

  /** Waits until every write is stored in IndexedDB (call it before leaving the page). */
  flush() { return this.p.flush(); }

  async exists(path: string) { try { await this.p.stat(path); return true; } catch { return false; } }
  async isDir(path: string) { try { return (await this.p.stat(path)).isDirectory(); } catch { return false; } }
  async readBytes(path: string): Promise<Uint8Array> { return (await this.p.readFile(path)) as Uint8Array; }
  async readText(path: string): Promise<string> { return dec.decode(await this.readBytes(path)); }

  async mkdirp(path: string, source: FsSource = 'ide') {
    if (path === '/' || (await this.exists(path))) return;
    await this.mkdirp(dirname(path), source);
    try { await this.p.mkdir(path); this.changed.emit({ type: 'mkdir', path, dir: true, source }); } catch (e: any) { if (e?.code !== 'EEXIST') throw e; }
  }
  async write(path: string, data: string | Uint8Array, source: FsSource = 'ide') {
    await this.mkdirp(dirname(path), source);
    await this.p.writeFile(path, typeof data === 'string' ? enc.encode(data) : data);
    this.changed.emit({ type: 'write', path, source });
  }
  async remove(path: string, source: FsSource = 'ide') {
    if (!(await this.exists(path))) return;
    const dir = await this.isDir(path);
    await this.rmrf(path);
    this.changed.emit({ type: 'delete', path, dir, source });
  }
  private async rmrf(path: string) {
    if (await this.isDir(path)) {
      for (const name of await this.p.readdir(path)) await this.rmrf(join(path, name));
      await this.p.rmdir(path);
    } else await this.p.unlink(path);
  }
  async rename(from: string, to: string, source: FsSource = 'ide') {
    if (from === to) return;
    if (to.startsWith(from + '/')) throw new Error('A folder cannot be moved into itself.');
    if (await this.exists(to)) throw new Error(`"${to}" already exists.`);
    await this.mkdirp(dirname(to), source);
    const dir = await this.isDir(from);
    await this.p.rename(from, to);
    this.changed.emit({ type: 'rename', path: from, to, dir, source });
  }
  async copy(from: string, to: string) {
    if (await this.isDir(from)) {
      await this.mkdirp(to);
      for (const e of await this.list(from)) await this.copy(e.path, join(to, e.name));
    } else await this.write(to, await this.readBytes(from));
  }
  /** Folders first, then files, by name. */
  async list(dir: string): Promise<Entry[]> {
    const names = await this.p.readdir(dir).catch(() => [] as string[]);
    const out: Entry[] = [];
    for (const name of names) {
      const path = join(dir, name);
      out.push({ name, path, dir: await this.isDir(path) });
    }
    return out.sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name, undefined, { numeric: true }));
  }
  /** Every file under `dir` (skips .git and node_modules unless asked). */
  async walk(dir = '/', opts: { all?: boolean } = {}): Promise<string[]> {
    const out: string[] = [];
    const go = async (d: string) => {
      for (const e of await this.list(d)) {
        if (!opts.all && (e.name === '.git' || e.name === 'node_modules')) continue;
        if (e.dir) await go(e.path); else out.push(e.path);
      }
    };
    await go(dir);
    return out;
  }
  /** A free name next to `path` ("a copy.txt", "a copy 2.txt"). */
  async freeName(path: string) {
    if (!(await this.exists(path))) return path;
    const ext = /\.[^./]+$/.exec(path)?.[0] ?? '';
    const stem = path.slice(0, path.length - ext.length);
    for (let i = 1; ; i++) {
      const p = `${stem} copy${i > 1 ? ` ${i}` : ''}${ext}`;
      if (!(await this.exists(p))) return p;
    }
  }
}
