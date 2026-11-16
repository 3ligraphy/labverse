/**
 * expo-sqlite for the lab previews, on top of sql.js (the real SQLite engine compiled to WebAssembly), so the SQL
 * students write runs exactly as on a phone. Same API as expo-sqlite (SDK 58): openDatabaseAsync / openDatabaseSync,
 * execAsync, runAsync (variadic, array or { $name } parameters) → { lastInsertRowId, changes }, getFirstAsync,
 * getAllAsync, getEachAsync, prepareAsync, withTransactionAsync, withExclusiveTransactionAsync, the *Sync variants,
 * deleteDatabaseAsync, and <SQLiteProvider> + useSQLiteContext().
 * Every database lives as long as the preview: "Restart app" keeps it (like a file on the phone).
 */
import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';
import initSqlJs from 'sql.js/dist/sql-wasm-browser.js';
import { changed, registerStore, type DeviceTable } from './device.ts';

/* ------------------------------------------------------------- the engine */

type SqlValue = string | number | null | Uint8Array;
type SqlStatement = {
  bind(values?: unknown): boolean;
  step(): boolean;
  getAsObject(): Record<string, SqlValue>;
  get(): SqlValue[];
  getColumnNames(): string[];
  free(): boolean;
};
type SqlDatabase = {
  exec(sql: string, params?: unknown): { columns: string[]; values: SqlValue[][] }[];
  prepare(sql: string): SqlStatement;
  getRowsModified(): number;
  close(): void;
};
type SqlJs = { Database: new () => SqlDatabase };

/** How the WebAssembly file reaches the preview (set by the host: the lab page in the browser, the disk in tests). */
let assetLoader: ((name: string) => Promise<ArrayBuffer>) | null = null;
export function setAssetLoader(fn: (name: string) => Promise<ArrayBuffer>) {
  assetLoader = fn;
}

let engine: SqlJs | null = null;
let loading: Promise<SqlJs> | null = null;
export const WASM = 'sql-wasm-browser.wasm';
/** Starts SQLite (once). The lab runtime calls this before running code that imports expo-sqlite. */
export function loadSqlite(): Promise<SqlJs> {
  if (engine) return Promise.resolve(engine);
  loading ??= (async () => {
    const wasmBinary = assetLoader ? await assetLoader(WASM) : undefined;
    const SQL = (await (initSqlJs as unknown as (cfg: object) => Promise<SqlJs>)(wasmBinary ? { wasmBinary } : { locateFile: (f: string) => `/lab-runtime/${f}` })) as SqlJs;
    engine = SQL;
    return SQL;
  })().catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}
export const sqliteReady = () => engine !== null;

/* -------------------------------------------------------- the phone's files */

const files = new Map<string, SqlDatabase>();
const fileName = (name: string, directory?: string) => (directory ? `${directory.replace(/\/$/, '')}/${name}` : name);

function tablesOf(db: SqlDatabase): DeviceTable[] {
  const out: DeviceTable[] = [];
  const names = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  for (const [name] of names[0]?.values ?? []) {
    const quoted = `"${String(name).replace(/"/g, '""')}"`;
    const total = Number(db.exec(`SELECT COUNT(*) FROM ${quoted}`)[0]?.values[0][0] ?? 0);
    const res = db.exec(`SELECT * FROM ${quoted} LIMIT 60`)[0];
    const columns = res?.columns ?? (db.exec(`PRAGMA table_info(${quoted})`)[0]?.values.map((r) => String(r[1])) ?? []);
    out.push({ name: String(name), columns, rows: (res?.values ?? []).map((row) => row.map((v) => (v instanceof Uint8Array ? `<${v.byteLength} bytes>` : v))), total });
  }
  return out;
}

registerStore({
  id: 'sqlite',
  snapshot: () =>
    [...files].map(([name, db]) => ({
      id: `sqlite:${name}`,
      title: `SQLite · ${name}`,
      where: 'A database file on the phone. Tables, rows and columns; read with SQL. Not encrypted.',
      place: 'phone' as const,
      tables: tablesOf(db),
    })),
  // "Erase phone": forget every file. They are not closed: an app that is still running may hold one for a moment
  // (its next query then works on a database nobody shows), and the next run opens new, empty files.
  reset: () => files.clear(),
});

/* ------------------------------------------------------------ parameters */

type Params = unknown[] | Record<string, unknown>;
function value(v: unknown): SqlValue {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number' || typeof v === 'string') return v;
  if (typeof v === 'bigint') return Number(v);
  if (v instanceof Uint8Array) return v;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (v instanceof Date) return v.toISOString();
  throw new TypeError(`SQLite cannot store this value: ${Object.prototype.toString.call(v)}. Store text (JSON.stringify), a number or null.`);
}
/** runAsync(sql, 'a', 1) · runAsync(sql, ['a', 1]) · runAsync(sql, { $a: 'a' }) */
function bindings(args: unknown[]): Params | undefined {
  if (args.length === 0) return undefined;
  if (args.length === 1 && Array.isArray(args[0])) return (args[0] as unknown[]).map(value);
  if (args.length === 1 && args[0] !== null && typeof args[0] === 'object' && !(args[0] instanceof Uint8Array) && !(args[0] instanceof Date)) {
    return Object.fromEntries(Object.entries(args[0] as Record<string, unknown>).map(([k, v]) => [k, value(v)]));
  }
  return args.map(value);
}

/** sql.js error → the kind of error expo-sqlite gives (the SQLite message stays the same). */
function sqlError(error: unknown, source: string): Error {
  const message = error instanceof Error ? error.message : String(error);
  const e = new Error(`SQLite error: ${message}`);
  (e as Error & { hint?: string }).hint = /no such table/.test(message)
    ? 'Create the table first (CREATE TABLE IF NOT EXISTS …), and check the spelling of its name.'
    : /no such column|has no column/.test(message)
      ? 'Check the column names against your CREATE TABLE statement.'
      : /NOT NULL constraint/.test(message)
        ? 'A column marked NOT NULL needs a value in every INSERT.'
        : /UNIQUE constraint/.test(message)
          ? 'A row with this value already exists in a UNIQUE (or PRIMARY KEY) column.'
          : /syntax error/.test(message)
            ? `Check the SQL near the word in quotes: ${source.trim().split('\n')[0].slice(0, 80)}`
            : /bind|parameter|column index out of range/i.test(message)
              ? 'Give one value for every ? in the SQL, in the same order.'
              : undefined;
  return e;
}

/* --------------------------------------------------------------- database */

export class SQLiteDatabase {
  private closed = false;
  databaseName: string;
  private db: SqlDatabase;
  constructor(databaseName: string, db: SqlDatabase) {
    this.databaseName = databaseName;
    this.db = db;
  }

  private use() {
    if (this.closed) throw new Error(`The database "${this.databaseName}" is closed.`);
    return this.db;
  }

  execSync(source: string): void {
    try {
      this.use().exec(source);
    } catch (error) {
      throw sqlError(error, source);
    } finally {
      changed();
    }
  }
  async execAsync(source: string): Promise<void> {
    await Promise.resolve();
    this.execSync(source);
  }

  runSync(source: string, ...args: unknown[]): { lastInsertRowId: number; changes: number } {
    const db = this.use();
    let stmt: SqlStatement | null = null;
    try {
      stmt = db.prepare(source);
      const b = bindings(args);
      if (b !== undefined) stmt.bind(b);
      while (stmt.step()) {
        /* run to the end */
      }
      const changes = db.getRowsModified();
      const lastInsertRowId = Number(db.exec('SELECT last_insert_rowid()')[0]?.values[0][0] ?? 0);
      return { lastInsertRowId, changes };
    } catch (error) {
      throw sqlError(error, source);
    } finally {
      stmt?.free();
      changed();
    }
  }
  async runAsync(source: string, ...args: unknown[]) {
    await Promise.resolve();
    return this.runSync(source, ...args);
  }

  getAllSync<T = Record<string, SqlValue>>(source: string, ...args: unknown[]): T[] {
    const db = this.use();
    let stmt: SqlStatement | null = null;
    try {
      stmt = db.prepare(source);
      const b = bindings(args);
      if (b !== undefined) stmt.bind(b);
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
      return rows;
    } catch (error) {
      throw sqlError(error, source);
    } finally {
      stmt?.free();
    }
  }
  async getAllAsync<T = Record<string, SqlValue>>(source: string, ...args: unknown[]): Promise<T[]> {
    await Promise.resolve();
    return this.getAllSync<T>(source, ...args);
  }
  getFirstSync<T = Record<string, SqlValue>>(source: string, ...args: unknown[]): T | null {
    return this.getAllSync<T>(source, ...args)[0] ?? null;
  }
  async getFirstAsync<T = Record<string, SqlValue>>(source: string, ...args: unknown[]): Promise<T | null> {
    await Promise.resolve();
    return this.getFirstSync<T>(source, ...args);
  }
  *getEachSync<T = Record<string, SqlValue>>(source: string, ...args: unknown[]): IterableIterator<T> {
    yield* this.getAllSync<T>(source, ...args);
  }
  async *getEachAsync<T = Record<string, SqlValue>>(source: string, ...args: unknown[]): AsyncIterableIterator<T> {
    for (const row of this.getAllSync<T>(source, ...args)) yield row;
  }

  /** prepareAsync(sql) → statement.executeAsync(params) → result.getAllAsync() / getFirstAsync(); then finalizeAsync(). */
  prepareSync(source: string) {
    const self = this;
    let done = false;
    const execute = (...args: unknown[]) => {
      if (done) throw new Error('This statement was finalized.');
      const rows = /^\s*(SELECT|PRAGMA|WITH)\b/i.test(source) ? self.getAllSync(source, ...args) : [];
      const run = rows.length || /^\s*(SELECT|PRAGMA|WITH)\b/i.test(source) ? { lastInsertRowId: 0, changes: 0 } : self.runSync(source, ...args);
      return {
        ...run,
        getAllSync: () => rows,
        getFirstSync: () => rows[0] ?? null,
        getAllAsync: async () => rows,
        getFirstAsync: async () => rows[0] ?? null,
        resetSync: () => {},
        resetAsync: async () => {},
        async *[Symbol.asyncIterator]() {
          yield* rows;
        },
        *[Symbol.iterator]() {
          yield* rows;
        },
      };
    };
    return {
      executeSync: execute,
      executeAsync: async (...args: unknown[]) => execute(...args),
      finalizeSync: () => void (done = true),
      finalizeAsync: async () => void (done = true),
    };
  }
  async prepareAsync(source: string) {
    await Promise.resolve();
    return this.prepareSync(source);
  }

  /** Runs `task` in a transaction: everything is saved together (COMMIT), or nothing is (ROLLBACK on an error). */
  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.execSync('BEGIN');
    try {
      await task();
      this.execSync('COMMIT');
    } catch (error) {
      try {
        this.execSync('ROLLBACK');
      } catch {
        /* already rolled back */
      }
      throw error;
    }
  }
  async withExclusiveTransactionAsync(task: (txn: SQLiteDatabase) => Promise<void>): Promise<void> {
    await this.withTransactionAsync(() => task(this));
  }
  withTransactionSync(task: () => void): void {
    this.execSync('BEGIN');
    try {
      task();
      this.execSync('COMMIT');
    } catch (error) {
      try {
        this.execSync('ROLLBACK');
      } catch {
        /* already rolled back */
      }
      throw error;
    }
  }

  closeSync() {
    this.closed = true;
  }
  async closeAsync() {
    this.closed = true;
  }
  isInTransactionSync() {
    return false;
  }
}

function open(databaseName: string, directory?: string): SQLiteDatabase {
  if (!engine) throw new Error('SQLite is still starting. Use openDatabaseAsync (await it), or wait a moment and try again.');
  if (typeof databaseName !== 'string' || !databaseName.trim()) throw new TypeError('openDatabaseAsync needs a database name, e.g. openDatabaseAsync(\'tasks.db\')');
  const name = fileName(databaseName, directory);
  let db = files.get(name);
  if (!db) {
    files.set(name, (db = new engine.Database()));
    changed();
  }
  return new SQLiteDatabase(databaseName, db);
}

export async function openDatabaseAsync(databaseName: string, _options?: object, directory?: string) {
  await loadSqlite();
  return open(databaseName, directory);
}
export const openDatabaseSync = (databaseName: string, _options?: object, directory?: string) => open(databaseName, directory);
export async function deleteDatabaseAsync(databaseName: string, directory?: string) {
  const name = fileName(databaseName, directory);
  files.get(name)?.close();
  files.delete(name);
  changed();
}
export const deleteDatabaseSync = (databaseName: string, directory?: string) => void deleteDatabaseAsync(databaseName, directory);

/* --------------------------------------------- <SQLiteProvider> + context */

const Ctx = createContext<SQLiteDatabase | null>(null);

type ProviderProps = {
  databaseName: string;
  directory?: string;
  onInit?: (db: SQLiteDatabase) => Promise<void>;
  onError?: (error: Error) => void;
  useSuspense?: boolean;
  options?: object;
  children?: ReactNode;
};

/** Opens the database, runs onInit (e.g. CREATE TABLE / migrations) and only then shows its children. */
export function SQLiteProvider({ databaseName, directory, onInit, onError, children }: ProviderProps) {
  const [db, setDb] = useState<SQLiteDatabase | null>(null);
  const [failed, setFailed] = useState<Error | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const opened = await openDatabaseAsync(databaseName, undefined, directory);
      if (onInit) await onInit(opened);
      if (live) setDb(opened);
    })().catch((error: Error) => {
      if (!live) return;
      if (onError) onError(error);
      else setFailed(error);
    });
    return () => {
      live = false;
    };
  }, [databaseName, directory]);
  if (failed) throw failed;
  if (!db) return null;
  return createElement(Ctx.Provider, { value: db }, children);
}

export function useSQLiteContext(): SQLiteDatabase {
  const db = useContext(Ctx);
  if (!db) throw new Error('useSQLiteContext must be used within a <SQLiteProvider>');
  return db;
}

export const defaultDatabaseDirectory = 'SQLite';
