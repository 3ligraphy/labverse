/**
 * A practice Supabase project inside the lab preview, at https://practice.supabase.co. Same supabase-js API as a real
 * project (v2): from(table).select/insert/update/upsert/delete with filters and modifiers, auth (signUp,
 * signInWithPassword, getSession, getUser, signOut, onAuthStateChange), and storage (upload, getPublicUrl,
 * createSignedUrl, download, list, remove), and Realtime (channel().on('postgres_changes', …).subscribe(), removeChannel).
 * Same rules too: Row Level Security on every table and bucket, Postgres
 * error codes, and requests fail when the preview's Wi-Fi is off. Students practise here without an account; their
 * own project (any other URL) uses the real supabase-js.
 *
 * The project's tables are the ones Lab 06 asks students to create in their own project:
 *   tasks (id uuid, user_id uuid default auth.uid(), title text not null, done bool, created_at, updated_at)
 *   profiles (id uuid = the user, full_name, avatar_url, updated_at)
 *   notes (RLS on, no policy yet: shows what RLS does before you write one)
 * with "owner only" policies, and the buckets avatars (public) and documents (private), one folder per user.
 */
import { changed, isOnline, onAppStart, onNetworkChange, registerStore, type DeviceFile, type DeviceTable } from './device.ts';
import type { RemoteOp } from './protocol.ts';
import { randomUUID } from './storage.ts';

export const PRACTICE_URL = 'https://practice.supabase.co';
export const PRACTICE_KEY = 'sb_publishable_practice';
export const isPracticeUrl = (url: unknown) => {
  try {
    return new URL(String(url)).hostname === 'practice.supabase.co';
  } catch {
    return false;
  }
};

/* --------------------------------------------------------------- the data */

type Row = Record<string, unknown>;
type User = { id: string; email: string; password: string; created_at: string; user_metadata: Record<string, unknown> };
export const MONA = { id: 'c0ffee00-0000-4000-8000-000000000001', email: 'student@practice.dev', password: 'practice-123', name: 'Mona Adel' };
export const CLASSMATE = { id: 'c0ffee00-0000-4000-8000-000000000002', email: 'classmate@practice.dev', password: 'practice-456', name: 'Omar Khaled' };

type ColType = 'uuid' | 'text' | 'bool' | 'int8' | 'timestamptz';
type Column = { type: ColType; nullable?: boolean; default?: (uid: string | null) => unknown; check?: (v: unknown) => string | null };
type Policy = (row: Row, uid: string | null) => boolean;
type TableDef = { pk: string; columns: Record<string, Column>; policies: Partial<Record<'select' | 'insert' | 'update' | 'delete', Policy>> };

const now = () => new Date().toISOString();
let identity = 0;
const owner: Policy = (row, uid) => uid !== null && row.user_id === uid;
const self: Policy = (row, uid) => uid !== null && row.id === uid;

const SCHEMA: Record<string, TableDef> = {
  tasks: {
    pk: 'id',
    columns: {
      id: { type: 'uuid', default: () => randomUUID() },
      user_id: { type: 'uuid', default: (uid) => uid },
      title: { type: 'text', check: (v) => (typeof v === 'string' && v.trim().length > 0 ? null : 'tasks_title_check') },
      done: { type: 'bool', default: () => false },
      created_at: { type: 'timestamptz', default: now },
      updated_at: { type: 'timestamptz', default: now },
    },
    policies: { select: owner, insert: owner, update: owner, delete: owner },
  },
  profiles: {
    pk: 'id',
    columns: {
      id: { type: 'uuid', default: (uid) => uid },
      full_name: { type: 'text', nullable: true },
      avatar_url: { type: 'text', nullable: true },
      updated_at: { type: 'timestamptz', default: now },
    },
    policies: { select: self, insert: self, update: self },
  },
  notes: {
    pk: 'id',
    columns: {
      id: { type: 'int8', default: () => ++identity },
      user_id: { type: 'uuid', default: (uid) => uid },
      body: { type: 'text', nullable: true },
      created_at: { type: 'timestamptz', default: now },
    },
    policies: {}, // RLS is on and no policy exists yet: nothing can be read or written through the API
  },
};

type StoredFile = { bytes: Uint8Array; contentType: string; created_at: string; updated_at: string; owner: string | null; id: string; version: number };
const BUCKETS: Record<string, { public: boolean }> = { avatars: { public: true }, documents: { public: false } };

const db = new Map<string, Row[]>();
const users = new Map<string, User>();
const buckets = new Map<string, Map<string, StoredFile>>();
const signed = new Map<string, { bucket: string; path: string; expires: number }>();
const requests: string[] = [];

/** The panel shows the practice cloud only once this phone's app has made a Supabase client (not in the AsyncStorage or SQLite parts). */
let used = false;
/** Open Realtime channels of this phone's app (they live in the app's memory). */
const channels = new Set<PracticeChannel>();

function seed() {
  used = false;
  closeAllChannels();
  db.clear();
  users.clear();
  buckets.clear();
  signed.clear();
  requests.length = 0;
  identity = 0;
  const t = '2026-11-01T09:00:00.000Z';
  for (const u of [MONA, CLASSMATE]) users.set(u.id, { id: u.id, email: u.email, password: u.password, created_at: t, user_metadata: { full_name: u.name } });
  db.set('tasks', [
    { id: 'a1111111-1111-4111-8111-111111111111', user_id: MONA.id, title: 'Read Part 5 of the lab', done: false, created_at: t, updated_at: t },
    { id: 'b2222222-2222-4222-8222-222222222222', user_id: CLASSMATE.id, title: 'Omar’s private task', done: false, created_at: t, updated_at: t },
  ]);
  db.set('profiles', [
    { id: MONA.id, full_name: MONA.name, avatar_url: null, updated_at: t },
    { id: CLASSMATE.id, full_name: CLASSMATE.name, avatar_url: null, updated_at: t },
  ]);
  db.set('notes', []);
  for (const b of Object.keys(BUCKETS)) buckets.set(b, new Map());
}
seed();

const short = (id: unknown) => (typeof id === 'string' && id.length > 12 ? `${id.slice(0, 8)}…` : id);
function logRequest(line: string) {
  requests.unshift(`${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}  ${line}`);
  requests.length = Math.min(requests.length, 8);
  changed();
}

let currentUser: string | null = null; // the user signed in on this phone (shown in the panel)

registerStore({
  id: 'supabase',
  snapshot: () => {
    if (!used) return [];
    const tables: DeviceTable[] = [...db].map(([name, rows]) => {
      const columns = Object.keys(SCHEMA[name].columns);
      return { name: `public.${name}`, columns, rows: rows.slice(0, 40).map((r) => columns.map((c) => (/(^id$|_id$)/.test(c) ? short(r[c]) : r[c] ?? null))), total: rows.length };
    });
    const files: DeviceFile[] = [];
    for (const [bucket, map] of buckets) for (const [path, f] of map) files.push({ path: `${bucket}/${path}`, size: f.bytes.byteLength, type: f.contentType, public: BUCKETS[bucket].public });
    const who = currentUser ? users.get(currentUser)?.email : null;
    return [
      { id: 'supabase-db', title: 'Supabase · Database (practice project)', where: 'Postgres in the cloud, shared by every user. Row Level Security decides which rows each user may see.', place: 'cloud' as const, tables, lines: [`Signed in on this phone: ${who ?? 'nobody (anon)'}`, ...realtimeLines(), ...requests.map((r) => `↕ ${r}`)] },
      ...(files.length ? [{ id: 'supabase-storage', title: 'Supabase · Storage (practice project)', where: 'Files in buckets in the cloud. avatars is public (anyone with the URL), documents is private (signed URLs).', place: 'cloud' as const, files }] : []),
    ];
  },
  reset: seed,
});

/* ----------------------------------------------------------------- errors */

export type PostgrestError = { message: string; details: string | null; hint: string | null; code: string };
const pgError = (code: string, message: string, details: string | null = null, hint: string | null = null): PostgrestError => ({ code, message, details, hint });
const networkFailure = () => ({ data: null, error: pgError('', 'TypeError: Network request failed', 'Network request failed', ''), count: null, status: 0, statusText: '' });

const wait = () => new Promise((r) => setTimeout(r, 90 + Math.round(Math.random() * 110)));

/* -------------------------------------------------------- values & checks */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function coerce(table: string, col: string, def: Column, v: unknown): { ok: true; value: unknown } | { ok: false; error: PostgrestError } {
  if (v === null || v === undefined) return { ok: true, value: null };
  switch (def.type) {
    case 'uuid':
      return typeof v === 'string' && UUID.test(v) ? { ok: true, value: v.toLowerCase() } : { ok: false, error: pgError('22P02', `invalid input syntax for type uuid: "${String(v)}"`) };
    case 'bool':
      if (typeof v === 'boolean') return { ok: true, value: v };
      if (v === 'true' || v === 'false') return { ok: true, value: v === 'true' };
      return { ok: false, error: pgError('22P02', `invalid input syntax for type boolean: "${String(v)}"`) };
    case 'int8':
      return Number.isInteger(Number(v)) ? { ok: true, value: Number(v) } : { ok: false, error: pgError('22P02', `invalid input syntax for type bigint: "${String(v)}"`) };
    case 'timestamptz':
      return !Number.isNaN(Date.parse(String(v))) ? { ok: true, value: new Date(String(v)).toISOString() } : { ok: false, error: pgError('22007', `invalid input syntax for type timestamp with time zone: "${String(v)}"`) };
    default:
      return typeof v === 'object' ? { ok: false, error: pgError('22P02', `invalid input syntax for type text in column "${col}" of "${table}"`) } : { ok: true, value: String(v) };
  }
}

/**
 * Builds a complete row from what the app sent: unknown columns and wrong types fail at once (PostgREST reads the
 * request first); NOT NULL and CHECK come back in `constraint`, because Postgres checks them after Row Level Security.
 */
function buildRow(table: string, input: Row, uid: string | null): { row?: Row; error?: PostgrestError; constraint?: PostgrestError } {
  const def = SCHEMA[table];
  for (const k of Object.keys(input)) if (!(k in def.columns)) return { error: pgError('PGRST204', `Could not find the '${k}' column of '${table}' in the schema cache`) };
  const row: Row = {};
  let constraint: PostgrestError | undefined;
  for (const [col, c] of Object.entries(def.columns)) {
    const given = Object.prototype.hasOwnProperty.call(input, col);
    const raw = given ? input[col] : c.default ? c.default(uid) : null;
    const v = coerce(table, col, c, raw);
    if (!v.ok) return { error: v.error };
    if (v.value === null && !c.nullable) constraint ??= pgError('23502', `null value in column "${col}" of relation "${table}" violates not-null constraint`);
    const bad = v.value !== null ? c.check?.(v.value) : null;
    if (bad) constraint ??= pgError('23514', `new row for relation "${table}" violates check constraint "${bad}"`);
    row[col] = v.value;
  }
  return { row, constraint };
}

/* ---------------------------------------------------------- query builder */

type Result = { data: unknown; error: PostgrestError | null; count: number | null; status: number; statusText: string };
type Filter = { col: string; test: (v: unknown) => boolean; text: string };

const STATUS_TEXT: Record<number, string> = { 200: 'OK', 201: 'Created', 204: 'No Content', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 406: 'Not Acceptable', 409: 'Conflict' };
const result = (status: number, data: unknown, count: number | null = null): Result => ({ data, error: null, count, status, statusText: STATUS_TEXT[status] ?? '' });
const failed = (status: number, error: PostgrestError): Result => ({ data: null, error, count: null, status, statusText: STATUS_TEXT[status] ?? '' });

function likeToRegExp(pattern: string, flags: string) {
  const re = String(pattern).replace(/[.+^${}()|[\]\\?]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${re}$`, flags);
}
const cmp = (a: unknown, b: unknown) => (a === b ? 0 : a === null || a === undefined ? 1 : b === null || b === undefined ? -1 : (a as never) < (b as never) ? -1 : 1);

class QueryBuilder implements PromiseLike<Result> {
  private action: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private columns = '*';
  private returning = false;
  private head = false;
  private countMode: string | null = null;
  private payload: unknown;
  private onConflict: string | undefined;
  private ignoreDuplicates = false;
  private filters: Filter[] = [];
  private orders: { col: string; asc: boolean; nullsFirst?: boolean }[] = [];
  private limitN: number | undefined;
  private rangeAt: [number, number] | undefined;
  private one: 'single' | 'maybe' | null = null;
  private problem: PostgrestError | null = null;
  private table: string;
  private uid: () => string | null;

  constructor(table: string, uid: () => string | null) {
    this.table = table;
    this.uid = uid;
  }

  private col(name: string) {
    const def = SCHEMA[this.table];
    if (def && !(name in def.columns) && !this.problem) this.problem = pgError('42703', `column ${this.table}.${name} does not exist`);
    return name;
  }

  select(columns = '*', opts: { head?: boolean; count?: string } = {}) {
    if (this.action === 'select') this.columns = columns;
    else {
      this.returning = true;
      this.columns = columns;
    }
    this.head = Boolean(opts.head);
    this.countMode = opts.count ?? null;
    return this;
  }
  insert(values: unknown, opts: { count?: string } = {}) {
    this.action = 'insert';
    this.payload = values;
    this.countMode = opts.count ?? null;
    return this;
  }
  update(values: unknown, opts: { count?: string } = {}) {
    this.action = 'update';
    this.payload = values;
    this.countMode = opts.count ?? null;
    return this;
  }
  upsert(values: unknown, opts: { onConflict?: string; ignoreDuplicates?: boolean; count?: string } = {}) {
    this.action = 'upsert';
    this.payload = values;
    this.onConflict = opts.onConflict;
    this.ignoreDuplicates = Boolean(opts.ignoreDuplicates);
    this.countMode = opts.count ?? null;
    return this;
  }
  delete(opts: { count?: string } = {}) {
    this.action = 'delete';
    this.countMode = opts.count ?? null;
    return this;
  }

  private filter(col: string, text: string, test: (v: unknown) => boolean) {
    this.filters.push({ col: this.col(col), text, test });
    return this;
  }
  eq(col: string, v: unknown) {
    return this.filter(col, `${col}=eq.${v}`, (x) => x === v || (x !== null && v !== null && String(x) === String(v) && typeof v !== 'boolean'));
  }
  neq(col: string, v: unknown) {
    return this.filter(col, `${col}=neq.${v}`, (x) => x !== v && String(x) !== String(v));
  }
  gt(col: string, v: unknown) {
    return this.filter(col, `${col}=gt.${v}`, (x) => x !== null && cmp(x, v) > 0);
  }
  gte(col: string, v: unknown) {
    return this.filter(col, `${col}=gte.${v}`, (x) => x !== null && cmp(x, v) >= 0);
  }
  lt(col: string, v: unknown) {
    return this.filter(col, `${col}=lt.${v}`, (x) => x !== null && cmp(x, v) < 0);
  }
  lte(col: string, v: unknown) {
    return this.filter(col, `${col}=lte.${v}`, (x) => x !== null && cmp(x, v) <= 0);
  }
  like(col: string, p: string) {
    return this.filter(col, `${col}=like.${p}`, (x) => typeof x === 'string' && likeToRegExp(p, '').test(x));
  }
  ilike(col: string, p: string) {
    return this.filter(col, `${col}=ilike.${p}`, (x) => typeof x === 'string' && likeToRegExp(p, 'i').test(x));
  }
  is(col: string, v: null | boolean) {
    return this.filter(col, `${col}=is.${v}`, (x) => (v === null ? x === null || x === undefined : x === v));
  }
  in(col: string, list: unknown[]) {
    return this.filter(col, `${col}=in.(${list.join(',')})`, (x) => list.some((v) => String(v) === String(x)));
  }
  match(obj: Record<string, unknown>) {
    for (const [k, v] of Object.entries(obj)) this.eq(k, v);
    return this;
  }
  not(col: string, op: string, v: unknown) {
    const probe = new QueryBuilder(this.table, this.uid);
    (probe as unknown as Record<string, (c: string, v: unknown) => QueryBuilder>)[op]?.(col, v);
    const inner = probe.filters[0];
    return inner ? this.filter(col, `${col}=not.${op}.${v}`, (x) => !inner.test(x)) : this;
  }
  order(col: string, opts: { ascending?: boolean; nullsFirst?: boolean } = {}) {
    this.orders.push({ col: this.col(col), asc: opts.ascending ?? true, nullsFirst: opts.nullsFirst });
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  range(from: number, to: number) {
    this.rangeAt = [from, to];
    return this;
  }
  single() {
    this.one = 'single';
    return this;
  }
  maybeSingle() {
    this.one = 'maybe';
    return this;
  }
  abortSignal() {
    return this;
  }
  returns() {
    return this;
  }

  then<A = Result, B = never>(ok?: ((r: Result) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null): Promise<A | B> {
    return this.execute().then(ok, bad);
  }
  catch<B = never>(bad?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return this.execute().catch(bad);
  }

  private matches(row: Row) {
    return this.filters.every((f) => f.test(row[f.col]));
  }
  private project(rows: Row[]): Row[] {
    const cols = this.columns.replace(/\s+/g, '');
    if (!cols || cols === '*') return rows.map((r) => ({ ...r }));
    const list = cols.split(',');
    for (const c of list) if (!(c in SCHEMA[this.table].columns)) this.problem ??= pgError('42703', `column ${this.table}.${c} does not exist`);
    return rows.map((r) => Object.fromEntries(list.map((c) => [c, r[c] ?? null])));
  }
  private shape(rows: Row[], status: number): Result {
    if (this.problem) return failed(400, this.problem);
    const count = this.countMode ? rows.length : null;
    let out = rows;
    for (const o of [...this.orders].reverse()) out = [...out].sort((a, b) => (o.asc ? 1 : -1) * cmp(a[o.col], b[o.col]));
    if (this.rangeAt) out = out.slice(this.rangeAt[0], this.rangeAt[1] + 1);
    if (this.limitN !== undefined) out = out.slice(0, this.limitN);
    const data = this.project(out);
    if (this.problem) return failed(400, this.problem);
    if (this.one) {
      if (data.length === 1) return result(status, data[0], count);
      if (data.length === 0 && this.one === 'maybe') return result(status, null, count);
      return failed(406, pgError('PGRST116', 'JSON object requested, multiple (or no) rows returned', `The result contains ${data.length} rows`));
    }
    return result(status, this.head ? null : data, count);
  }

  private async execute(): Promise<Result> {
    await wait();
    const verb = { select: 'GET', insert: 'POST', upsert: 'POST', update: 'PATCH', delete: 'DELETE' }[this.action];
    const path = `/rest/v1/${this.table}${this.filters.length ? `?${this.filters.map((f) => f.text).join('&')}` : ''}`;
    if (!isOnline()) {
      logRequest(`${verb} ${path} → no network`);
      return networkFailure();
    }
    const r = this.run();
    logRequest(`${verb} ${path} → ${r.status}${r.error ? ` ${r.error.code}` : ''}${Array.isArray(r.data) ? ` (${r.data.length} row${r.data.length === 1 ? '' : 's'})` : ''}`);
    return r;
  }

  private run(): Result {
    const def = SCHEMA[this.table];
    if (!def) {
      const near = Object.keys(SCHEMA).find((t) => t[0] === this.table[0] || this.table.includes(t.slice(0, 3)));
      return failed(404, pgError('PGRST205', `Could not find the table 'public.${this.table}' in the schema cache`, null, near ? `Perhaps you meant the table 'public.${near}'` : null));
    }
    if (this.problem) return failed(400, this.problem);
    const uid = this.uid();
    const rows = db.get(this.table)!;
    const rls = (op: keyof TableDef['policies'], row: Row) => def.policies[op]?.(row, uid) ?? false;
    const denied = () => failed(uid ? 403 : 401, pgError('42501', `new row violates row-level security policy for table "${this.table}"`));

    if (this.action === 'select') return this.shape(rows.filter((r) => rls('select', r) && this.matches(r)), 200);

    if (this.action === 'insert' || this.action === 'upsert') {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload];
      if (!list.length || list.some((v) => v === null || typeof v !== 'object')) return failed(400, pgError('PGRST102', 'Empty or invalid json'));
      const key = this.onConflict ?? def.pk;
      if (!(key in def.columns)) return failed(400, pgError('42P10', 'there is no unique or exclusion constraint matching the ON CONFLICT specification'));
      const staged = rows.map((r) => ({ ...r }));
      const touched: Row[] = [];
      const events: [ChangeEvent, Row, Row][] = [];
      for (const input of list as Row[]) {
        const existing = this.action === 'upsert' && input[key] !== undefined ? staged.find((r) => String(r[key]) === String(input[key])) : undefined;
        if (existing) {
          if (this.ignoreDuplicates) continue;
          if (!rls('select', existing) || !rls('update', existing)) return failed(uid ? 403 : 401, pgError('42501', `new row violates row-level security policy (USING expression) for table "${this.table}"`));
          const next = { ...existing };
          for (const [k, v] of Object.entries(input)) {
            if (!(k in def.columns)) return failed(400, pgError('PGRST204', `Could not find the '${k}' column of '${this.table}' in the schema cache`));
            const c = coerce(this.table, k, def.columns[k], v);
            if (!c.ok) return failed(400, c.error);
            next[k] = c.value;
          }
          if (!rls('update', next)) return denied();
          const before = { ...existing };
          Object.assign(existing, next);
          touched.push(existing);
          events.push(['UPDATE', existing, before]);
          continue;
        }
        const built = buildRow(this.table, input, uid);
        if (built.error) return failed(400, built.error);
        const row = built.row!;
        if (!rls('insert', row)) return denied();
        if (built.constraint) return failed(400, built.constraint);
        if (staged.some((r) => String(r[def.pk]) === String(row[def.pk]))) {
          return failed(409, pgError('23505', `duplicate key value violates unique constraint "${this.table}_pkey"`, `Key (${def.pk})=(${row[def.pk]}) already exists.`));
        }
        staged.push(row);
        touched.push(row);
        events.push(['INSERT', row, row]);
      }
      db.set(this.table, staged);
      for (const [event, row, before] of events) emitChange(this.table, event, row, before);
      return this.returning ? this.shape(touched, 201) : result(201, null, this.countMode ? touched.length : null);
    }

    if (!this.filters.length) return failed(400, pgError('21000', `${this.action.toUpperCase()} requires a WHERE clause`, null, 'Add a filter, e.g. .eq(\'id\', task.id), so only the rows you mean change.'));

    if (this.action === 'update') {
      const values = this.payload as Row;
      if (!values || typeof values !== 'object') return failed(400, pgError('PGRST102', 'Empty or invalid json'));
      const targets = rows.filter((r) => rls('select', r) && rls('update', r) && this.matches(r));
      const updated: Row[] = [];
      for (const r of targets) {
        const next = { ...r };
        for (const [k, v] of Object.entries(values)) {
          if (!(k in def.columns)) return failed(400, pgError('PGRST204', `Could not find the '${k}' column of '${this.table}' in the schema cache`));
          const c = coerce(this.table, k, def.columns[k], v);
          if (!c.ok) return failed(400, c.error);
          if (c.value === null && !def.columns[k].nullable) return failed(400, pgError('23502', `null value in column "${k}" of relation "${this.table}" violates not-null constraint`));
          const bad = c.value !== null ? def.columns[k].check?.(c.value) : null;
          if (bad) return failed(400, pgError('23514', `new row for relation "${this.table}" violates check constraint "${bad}"`));
          next[k] = c.value;
        }
        if (!rls('update', next)) return denied();
        updated.push(next);
      }
      for (const n of updated) {
        const row = rows.find((r) => r[def.pk] === n[def.pk])!;
        const before = { ...row };
        Object.assign(row, n);
        emitChange(this.table, 'UPDATE', row, before);
      }
      return this.returning ? this.shape(updated, 200) : result(204, null, this.countMode ? updated.length : null);
    }

    // delete
    const gone = rows.filter((r) => rls('select', r) && rls('delete', r) && this.matches(r));
    db.set(this.table, rows.filter((r) => !gone.includes(r)));
    for (const g of gone) emitChange(this.table, 'DELETE', g, g);
    return this.returning ? this.shape(gone, 200) : result(204, null, this.countMode ? gone.length : null);
  }
}

/* ------------------------------------------------------------------- auth */

type Session = { access_token: string; refresh_token: string; expires_in: number; expires_at: number; token_type: 'bearer'; user: ReturnType<typeof publicUser> };
type AuthErr = { name: string; message: string; status: number; code: string };
const authError = (name: string, message: string, status: number, code: string): AuthErr => ({ name, message, status, code });

function publicUser(u: User) {
  return {
    id: u.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: u.email,
    email_confirmed_at: u.created_at,
    phone: '',
    created_at: u.created_at,
    updated_at: now(),
    last_sign_in_at: now(),
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { ...u.user_metadata },
    identities: [],
    is_anonymous: false,
  };
}
const b64url = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
function makeSession(u: User): Session {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;
  const payload = { iss: `${PRACTICE_URL}/auth/v1`, sub: u.id, aud: 'authenticated', exp, iat, email: u.email, role: 'authenticated', session_id: randomUUID() };
  const token = `${b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64url(JSON.stringify(payload))}.${b64url(randomUUID()).slice(0, 43)}`;
  return { access_token: token, refresh_token: randomUUID().replace(/-/g, '').slice(0, 12), expires_in: 3600, expires_at: exp, token_type: 'bearer', user: publicUser(u) };
}

type AuthStorage = { getItem(k: string): unknown; setItem(k: string, v: string): unknown; removeItem(k: string): unknown };
type AuthOptions = { storage?: AuthStorage; persistSession?: boolean; autoRefreshToken?: boolean; detectSessionInUrl?: boolean; storageKey?: string };
type Listener = (event: string, session: Session | null) => void;

function createAuth(opts: AuthOptions = {}, onUser: (id: string | null) => void) {
  const persist = opts.persistSession !== false;
  const storage = opts.storage;
  const key = opts.storageKey ?? 'sb-practice-auth-token';
  let session: Session | null = null;
  const listeners = new Set<Listener>();

  const set = async (next: Session | null, event: string) => {
    session = next;
    onUser(next?.user.id ?? null);
    if (persist && storage) {
      if (next) await storage.setItem(key, JSON.stringify(next));
      else await storage.removeItem(key);
    }
    for (const fn of listeners) setTimeout(() => fn(event, next), 0);
  };

  const ready = (async () => {
    if (!persist || !storage) return;
    try {
      const raw = await storage.getItem(key);
      const saved = typeof raw === 'string' ? (JSON.parse(raw) as Session) : null;
      if (saved?.user?.id && users.has(saved.user.id) && saved.expires_at * 1000 > Date.now()) {
        session = saved;
        onUser(saved.user.id);
      }
    } catch {
      /* a broken saved session is ignored, like supabase-js */
    }
  })();

  const offline = () => ({ data: { user: null, session: null }, error: authError('AuthRetryableFetchError', 'Network request failed', 0, 'network_error') });
  const validEmail = (e: unknown) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  const auth = {
    async signUp(creds: { email?: string; password?: string; options?: { data?: Record<string, unknown> } }) {
      await ready;
      await wait();
      if (!isOnline()) return offline();
      logRequest('POST /auth/v1/signup');
      if (!validEmail(creds?.email)) return { data: { user: null, session: null }, error: authError('AuthApiError', 'Unable to validate email address: invalid format', 400, 'validation_failed') };
      if (typeof creds.password !== 'string' || creds.password.length < 6) return { data: { user: null, session: null }, error: authError('AuthWeakPasswordError', 'Password should be at least 6 characters.', 422, 'weak_password') };
      const email = creds.email!.trim().toLowerCase();
      if ([...users.values()].some((u) => u.email === email)) return { data: { user: null, session: null }, error: authError('AuthApiError', 'User already registered', 422, 'user_already_exists') };
      const u: User = { id: randomUUID(), email, password: creds.password, created_at: now(), user_metadata: { ...(creds.options?.data ?? {}) } };
      users.set(u.id, u);
      db.get('profiles')!.push({ id: u.id, full_name: (u.user_metadata.full_name as string) ?? null, avatar_url: null, updated_at: now() });
      const s = makeSession(u);
      await set(s, 'SIGNED_IN');
      changed();
      return { data: { user: s.user, session: s }, error: null };
    },
    async signInWithPassword(creds: { email?: string; password?: string; phone?: string }) {
      await ready;
      await wait();
      if (!isOnline()) return offline();
      logRequest('POST /auth/v1/token?grant_type=password');
      const email = String(creds?.email ?? '').trim().toLowerCase();
      const u = [...users.values()].find((x) => x.email === email);
      if (!u || u.password !== creds?.password) return { data: { user: null, session: null }, error: authError('AuthApiError', 'Invalid login credentials', 400, 'invalid_credentials') };
      const s = makeSession(u);
      await set(s, 'SIGNED_IN');
      return { data: { user: s.user, session: s }, error: null };
    },
    async signOut() {
      await ready;
      if (isOnline()) logRequest('POST /auth/v1/logout');
      await set(null, 'SIGNED_OUT');
      return { error: null };
    },
    async getSession() {
      await ready;
      return { data: { session }, error: null };
    },
    async getUser() {
      await ready;
      if (!session) return { data: { user: null }, error: authError('AuthSessionMissingError', 'Auth session missing!', 400, 'session_not_found') };
      await wait();
      if (!isOnline()) return { data: { user: null }, error: authError('AuthRetryableFetchError', 'Network request failed', 0, 'network_error') };
      logRequest('GET /auth/v1/user');
      return { data: { user: session.user }, error: null };
    },
    async refreshSession() {
      await ready;
      if (!session) return { data: { user: null, session: null }, error: authError('AuthSessionMissingError', 'Auth session missing!', 400, 'session_not_found') };
      const u = users.get(session.user.id)!;
      const s = makeSession(u);
      await set(s, 'TOKEN_REFRESHED');
      return { data: { user: s.user, session: s }, error: null };
    },
    async updateUser(attrs: { data?: Record<string, unknown> }) {
      await ready;
      if (!session) return { data: { user: null }, error: authError('AuthSessionMissingError', 'Auth session missing!', 400, 'session_not_found') };
      const u = users.get(session.user.id)!;
      Object.assign(u.user_metadata, attrs?.data ?? {});
      const s = { ...session, user: publicUser(u) };
      await set(s, 'USER_UPDATED');
      return { data: { user: s.user }, error: null };
    },
    onAuthStateChange(callback: Listener) {
      listeners.add(callback);
      void ready.then(() => listeners.has(callback) && callback('INITIAL_SESSION', session));
      const subscription = { id: randomUUID(), callback, unsubscribe: () => void listeners.delete(callback) };
      return { data: { subscription } };
    },
    startAutoRefresh: async () => {},
    stopAutoRefresh: async () => {},
  };
  return { auth, uid: () => session?.user.id ?? null, ready };
}

/* ---------------------------------------------------------------- storage */

type StorageErr = { name: string; message: string; status: number; statusCode: string; error: string };
const storageError = (status: number, error: string, message: string): StorageErr => ({ name: 'StorageApiError', message, status, statusCode: String(status), error });

async function toBytes(body: unknown): Promise<Uint8Array> {
  if (body instanceof Uint8Array) return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (ArrayBuffer.isView(body)) return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  if (typeof Blob !== 'undefined' && body instanceof Blob) return new Uint8Array(await body.arrayBuffer());
  if (typeof body === 'string') return new TextEncoder().encode(body);
  throw new TypeError('upload() needs the file\'s bytes: an ArrayBuffer (e.g. decode(base64) from base64-arraybuffer), a Uint8Array or a Blob.');
}
const cleanPath = (p: string) => String(p ?? '').replace(/^\/+/, '');
const blobUrls = new Map<string, string>();

function bucketApi(bucket: string, uid: () => string | null) {
  const files = () => buckets.get(bucket);
  const missing = () => ({ data: null, error: storageError(404, 'Bucket not found', 'Bucket not found') });
  // the policies of both buckets: a signed-in user may write and read their own folder: <user id>/…
  const mayWrite = (path: string) => {
    const id = uid();
    return id !== null && path.split('/')[0] === id;
  };
  const deny = () => ({ data: null, error: storageError(403, 'Unauthorized', 'new row violates row-level security policy') });
  const offline = () => ({ data: null, error: storageError(0, 'FetchError', 'Network request failed') });

  async function write(path: string, body: unknown, options: { contentType?: string; upsert?: boolean; cacheControl?: string } = {}, replace = false) {
    await wait();
    if (!files()) return missing();
    if (!isOnline()) {
      logRequest(`POST /storage/v1/object/${bucket}/${path} → no network`);
      return offline();
    }
    const p = cleanPath(path);
    if (!p || p.endsWith('/')) return { data: null, error: storageError(400, 'InvalidKey', `Invalid key: ${path}`) };
    if (!mayWrite(p)) {
      logRequest(`POST /storage/v1/object/${bucket}/${p} → 403`);
      return deny();
    }
    const old = files()!.get(p);
    if (old && !options.upsert && !replace) {
      logRequest(`POST /storage/v1/object/${bucket}/${p} → 409`);
      return { data: null, error: storageError(409, 'Duplicate', 'The resource already exists') };
    }
    let bytes: Uint8Array;
    try {
      bytes = await toBytes(body);
    } catch (error) {
      return { data: null, error: storageError(400, 'InvalidRequest', (error as Error).message) };
    }
    const type = options.contentType ?? (typeof Blob !== 'undefined' && body instanceof Blob && body.type ? body.type : 'text/plain;charset=UTF-8');
    const file: StoredFile = { bytes, contentType: type, created_at: old?.created_at ?? now(), updated_at: now(), owner: uid(), id: old?.id ?? randomUUID(), version: (old?.version ?? 0) + 1 };
    files()!.set(p, file);
    logRequest(`POST /storage/v1/object/${bucket}/${p} → 200 (${bytes.byteLength} bytes)`);
    return { data: { id: file.id, path: p, fullPath: `${bucket}/${p}` }, error: null };
  }

  return {
    upload: (path: string, body: unknown, options?: { contentType?: string; upsert?: boolean }) => write(path, body, options),
    update: (path: string, body: unknown, options?: { contentType?: string }) => write(path, body, { ...options, upsert: true }, true),
    getPublicUrl(path: string) {
      return { data: { publicUrl: `${PRACTICE_URL}/storage/v1/object/public/${bucket}/${cleanPath(path)}` } };
    },
    async createSignedUrl(path: string, expiresIn: number) {
      await wait();
      if (!files()) return missing();
      if (!isOnline()) return offline();
      const p = cleanPath(path);
      if (!files()!.has(p) || !mayWrite(p)) return { data: null, error: storageError(404, 'not_found', 'Object not found') };
      const token = randomUUID().replace(/-/g, '');
      signed.set(token, { bucket, path: p, expires: Date.now() + Math.max(1, Number(expiresIn) || 60) * 1000 });
      logRequest(`POST /storage/v1/object/sign/${bucket}/${p} → 200`);
      return { data: { signedUrl: `${PRACTICE_URL}/storage/v1/object/sign/${bucket}/${p}?token=${token}` }, error: null };
    },
    async download(path: string) {
      await wait();
      if (!files()) return missing();
      if (!isOnline()) return offline();
      const p = cleanPath(path);
      const f = files()!.get(p);
      if (!f || (!BUCKETS[bucket].public && !mayWrite(p))) return { data: null, error: storageError(404, 'not_found', 'Object not found') };
      return { data: new Blob([f.bytes as BlobPart], { type: f.contentType }), error: null };
    },
    async list(prefix = '', options: { limit?: number; offset?: number } = {}) {
      await wait();
      if (!files()) return missing();
      if (!isOnline()) return offline();
      const base = cleanPath(prefix).replace(/\/?$/, prefix ? '/' : '');
      const seen = new Map<string, unknown>();
      for (const [p, f] of files()!) {
        if (!p.startsWith(base) || !mayWrite(p)) continue;
        const rest = p.slice(base.length);
        const [head, ...more] = rest.split('/');
        if (more.length) seen.set(head, { name: head, id: null, updated_at: null, created_at: null, last_accessed_at: null, metadata: null });
        else seen.set(head, { name: head, id: f.id, updated_at: f.updated_at, created_at: f.created_at, last_accessed_at: f.updated_at, metadata: { size: f.bytes.byteLength, mimetype: f.contentType } });
      }
      const all = [...seen.values()];
      return { data: all.slice(options.offset ?? 0, (options.offset ?? 0) + (options.limit ?? 100)), error: null };
    },
    async remove(paths: string[]) {
      await wait();
      if (!files()) return missing();
      if (!isOnline()) return offline();
      const removed: unknown[] = [];
      for (const raw of paths ?? []) {
        const p = cleanPath(raw);
        const f = files()!.get(p);
        if (!f || !mayWrite(p)) continue; // RLS: other users' files are simply not deleted
        files()!.delete(p);
        removed.push({ name: p, id: f.id, bucket_id: bucket, metadata: { size: f.bytes.byteLength, mimetype: f.contentType } });
      }
      logRequest(`DELETE /storage/v1/object/${bucket} → 200 (${removed.length} removed)`);
      return { data: removed, error: null };
    },
  };
}

/**
 * An address of a practice file → something an <Image> can show: public files of a public bucket, and private files
 * through an unexpired signed URL. Anything else stays as it is (and fails to load, as on a phone).
 */
export function resolvePracticeUri(uri: string): string {
  if (typeof uri !== 'string' || !uri.startsWith(`${PRACTICE_URL}/storage/v1/object/`)) return uri;
  const u = new URL(uri);
  const m = /^\/storage\/v1\/object\/(public|sign)\/([^/]+)\/(.+)$/.exec(u.pathname);
  if (!m) return uri;
  const [, kind, bucket, path] = m;
  const f = buckets.get(bucket)?.get(decodeURIComponent(path));
  if (!f) return uri;
  if (kind === 'public' && !BUCKETS[bucket]?.public) return uri;
  if (kind === 'sign') {
    const t = signed.get(u.searchParams.get('token') ?? '');
    if (!t || t.bucket !== bucket || t.path !== decodeURIComponent(path) || t.expires < Date.now()) return uri;
  }
  const key = `${bucket}/${path}@${f.version}`;
  let url = blobUrls.get(key);
  if (!url) {
    try {
      url = URL.createObjectURL(new Blob([f.bytes as BlobPart], { type: f.contentType }));
    } catch {
      url = uri;
    }
    blobUrls.set(key, url);
  }
  return url;
}


/* --------------------------------------------------------------- realtime */

/** Tables in the `supabase_realtime` publication (Database → Publications, or "Enable Realtime" on the table). */
const REALTIME_TABLES = new Set(['tasks']);
type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE';
type ChangeFilter = { event: ChangeEvent | '*'; schema?: string; table?: string; filter?: string };
export type ChangePayload = { schema: string; table: string; commit_timestamp: string; eventType: ChangeEvent; new: Row; old: Row; errors: null };
type Status = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'CLOSED';

/** `column=eq.value` (also neq, lt, lte, gt, gte, in.(a,b)): the filters postgres_changes accepts. */
function passesFilter(filter: string, row: Row): boolean {
  const m = /^(\w+)=(eq|neq|lt|lte|gt|gte|in)\.(.*)$/.exec(filter.trim());
  if (!m) return false;
  const [, col, op, raw] = m;
  const v = row[col];
  if (op === 'in') return raw.replace(/^\(|\)$/g, '').split(',').map((x) => x.trim()).includes(String(v));
  const c = cmp(String(v ?? ''), raw);
  return op === 'eq' ? String(v) === raw : op === 'neq' ? String(v) !== raw : op === 'lt' ? c < 0 : op === 'lte' ? c <= 0 : op === 'gt' ? c > 0 : c >= 0;
}

class PracticeChannel {
  topic: string;
  owner: object;
  state: 'joining' | 'joined' | 'errored' | 'closed' = 'closed';
  private listeners: { filter: ChangeFilter; cb: (p: ChangePayload) => void }[] = [];
  private onStatus: ((status: Status, error?: Error) => void) | null = null;
  private uid: () => string | null;
  constructor(name: string, uid: () => string | null, owner: object) {
    this.topic = `realtime:${name}`;
    this.uid = uid;
    this.owner = owner;
  }
  on(type: string, filter: ChangeFilter, cb: (p: ChangePayload) => void) {
    if (type !== 'postgres_changes') throw new Error(`The practice project supports channel.on('postgres_changes', …) only (not '${type}').`);
    if (!filter || typeof cb !== 'function') throw new Error("channel.on('postgres_changes', { event, schema, table }, callback) needs a filter object and a callback.");
    this.listeners.push({ filter, cb });
    return this;
  }
  subscribe(onStatus?: (status: Status, error?: Error) => void) {
    this.onStatus = typeof onStatus === 'function' ? onStatus : null;
    channels.add(this);
    this.join();
    return this;
  }
  join() {
    this.state = 'joining';
    changed();
    setTimeout(() => {
      if (!channels.has(this)) return;
      if (!isOnline()) {
        this.state = 'errored';
        this.onStatus?.('CHANNEL_ERROR', new TypeError('Network request failed'));
        return;
      }
      this.state = 'joined';
      logRequest(`WS  ${this.topic}  SUBSCRIBED`);
      this.onStatus?.('SUBSCRIBED');
    }, 60);
  }
  async unsubscribe(): Promise<'ok'> {
    this.close();
    return 'ok';
  }
  close() {
    if (!channels.delete(this)) return;
    this.state = 'closed';
    this.onStatus?.('CLOSED');
    changed();
  }
  deliver(table: string, event: ChangeEvent, row: Row, before: Row) {
    if (this.state !== 'joined') return;
    const def = SCHEMA[table];
    const subject = event === 'DELETE' ? before : row;
    // Row Level Security applies to Realtime too: only rows this user may select are sent
    if (!(def.policies.select?.(subject, this.uid()) ?? false)) return;
    for (const { filter, cb } of this.listeners) {
      if (filter.event !== '*' && filter.event !== event) continue;
      if (filter.schema && filter.schema !== '*' && filter.schema !== 'public') continue;
      if (filter.table && filter.table !== '*' && filter.table !== table) continue;
      if (filter.filter && !passesFilter(filter.filter, subject)) continue;
      // like a real project with RLS: `old` holds only the primary key
      const payload: ChangePayload = { schema: 'public', table, commit_timestamp: now(), eventType: event, new: event === 'DELETE' ? {} : { ...row }, old: event === 'INSERT' ? {} : { [def.pk]: before[def.pk] }, errors: null };
      try {
        cb(payload);
      } catch (error) {
        console.error(error);
      }
    }
  }
}

/** A row changed in the database: Realtime sends it to every open channel that listens, a moment later. */
function emitChange(table: string, event: ChangeEvent, row: Row, before: Row) {
  if (!REALTIME_TABLES.has(table) || !channels.size) return;
  const after = { ...row }, old = { ...before };
  setTimeout(() => {
    if (!isOnline()) return; // this phone is offline: the event is lost, and Realtime never sends it again
    for (const c of [...channels]) c.deliver(table, event, after, old);
  }, 70 + Math.round(Math.random() * 60));
}

function closeAllChannels() {
  if (!channels.size) return;
  for (const c of channels) c.state = 'closed';
  channels.clear();
  changed();
}

function realtimeLines(): string[] {
  const n = channels.size;
  if (!n) return [];
  const live = [...channels].filter((c) => c.state === 'joined').length;
  return [`Realtime: ${n} channel${n === 1 ? '' : 's'} open${live < n ? ` (${n - live} waiting for the network)` : ''}${n > 1 ? ' — more than one? Remove the old one in the useEffect cleanup.' : ''}`];
}

// the app started again: its channels are gone (they lived in its memory)
onAppStart(closeAllChannels);
// Wi-Fi off: the socket drops (CHANNEL_ERROR); Wi-Fi on: channels join again. Nothing missed is sent again.
onNetworkChange((online) => {
  for (const c of channels) {
    if (!online && c.state !== 'closed') {
      c.state = 'errored';
      changed();
    } else if (online && c.state === 'errored') c.join();
  }
});

/** For the panel's "Add a task from your tablet" and the checks: the same user writes from another device. */
export function practiceRemote(op: RemoteOp, as: string = currentUser ?? MONA.id) {
  const rows = db.get(op.table) ?? [];
  if (op.kind === 'insert') {
    const built = buildRow(op.table, { title: op.title }, as);
    if (!built.row) return;
    rows.push(built.row);
    db.set(op.table, rows);
    logRequest(`(your tablet)  POST /rest/v1/${op.table}  201`);
    emitChange(op.table, 'INSERT', built.row, built.row);
  } else {
    const row = rows.find((r) => r.id === op.id && r.user_id === as);
    if (!row) return;
    db.set(op.table, rows.filter((r) => r !== row));
    logRequest(`(your tablet)  DELETE /rest/v1/${op.table}  204`);
    emitChange(op.table, 'DELETE', row, row);
  }
  changed();
}

/** Channels open on this phone (for the checks). */
export const activeChannels = () => channels.size;

/* ----------------------------------------------------------------- client */

export function createPracticeClient(url: string, key: string, options: { auth?: AuthOptions } = {}) {
  if (typeof key !== 'string' || !key) throw new Error('supabaseKey is required.');
  if (/^sb_secret_/.test(key) || /service_role/.test(key)) {
    throw new Error('Never put a secret (service_role) key in an app: anyone can read the app’s code. Use the publishable key (sb_publishable_…) and protect your data with Row Level Security.');
  }
  used = true;
  const owner = {}; // this client: getChannels / removeAllChannels only see its own channels
  const { auth, uid } = createAuth(options.auth, (id) => {
    currentUser = id;
    changed();
  });
  return {
    supabaseUrl: url,
    supabaseKey: key,
    auth,
    from: (table: string) => new QueryBuilder(table, uid),
    storage: {
      from: (bucket: string) => bucketApi(bucket, uid),
      async listBuckets() {
        return { data: Object.entries(BUCKETS).map(([name, b]) => ({ id: name, name, public: b.public })), error: null };
      },
    },
    rpc: async (fn: string) => failed(404, pgError('PGRST202', `Could not find the function public.${fn} without parameters in the schema cache`)),
    channel: (name: string) => new PracticeChannel(String(name ?? 'realtime'), uid, owner),
    getChannels: () => [...channels].filter((c) => c.owner === owner),
    async removeChannel(channel: PracticeChannel): Promise<'ok'> {
      channel?.close?.();
      return 'ok';
    },
    async removeAllChannels(): Promise<'ok'[]> {
      const mine = [...channels].filter((c) => c.owner === owner);
      for (const c of mine) c.close();
      return mine.map(() => 'ok' as const);
    },
  };
}

/** For tests and the panel: every row of a practice table, ignoring RLS (what the database really holds). */
export const practiceRows = (table: string) => (db.get(table) ?? []).map((r) => ({ ...r }));
export const practiceFiles = (bucket: string) => [...(buckets.get(bucket)?.keys() ?? [])];
export const resetPractice = seed;
