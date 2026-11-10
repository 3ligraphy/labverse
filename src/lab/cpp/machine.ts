/**
 * Runs a checked program one statement at a time (a generator), so the lab can show the "machine": the current
 * line, every variable as a labelled box, the console, and the keyboard buffer that cin reads from. Runtime
 * errors read like Visual Studio's (Run-Time Check Failure #3, string subscript out of range, …) plus a hint.
 */
import type { Expr, Program, Stmt } from './ast.ts';
import { arithType, charText, convert, isIntegral, isNumeric, isText, literal, NPOS, num, show, vtOf, type Value, type VT } from './values.ts';

export type Seg = { kind: 'out' | 'in' | 'note'; text: string };
export type RunError = { line: number; col: number; message: string; hint?: string; code?: string };
export type Cell = { name: string; vt: VT; decl: string; value: Value; init: boolean; isConst: boolean; line: number; depth: number; changed: number; order: number };
export type StrMark = { name: string; op: 'find' | 'rfind' | 'substr' | 'at' | 'index' | 'length'; from?: number; len?: number; hit?: number; query?: string };
export type ReadMark = { name: string; from: number; to: number; ok: boolean; how: 'cin' | 'getline' };
type Ev = { t: 'line'; line: number } | { t: 'input' };
type Flow = 'normal' | 'break' | 'continue' | 'return';
type Ref = { name: string; vt: VT; get(): Value; set(v: Value): void; cell?: Cell };

export class CppRuntimeError extends Error {
  line: number;
  col: number;
  hint?: string;
  code?: string;
  constructor(message: string, line: number, col: number, hint?: string, code?: string) {
    super(message);
    this.line = line;
    this.col = col;
    this.hint = hint;
    this.code = code;
  }
}

const isSpace = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\v' || c === '\f';

export class Machine {
  segs: Seg[] = [];
  input = '';
  pos = 0;
  /** cin is in the fail state (bad input or no more input) */
  failed = false;
  status: 'ready' | 'running' | 'input' | 'done' | 'error' = 'ready';
  error: RunError | null = null;
  exit = 0;
  line = 0;
  steps = 0;
  tick = 0;
  lastStr: StrMark | null = null;
  lastRead: ReadMark | null = null;
  private frames: Map<string, Cell>[] = [];
  private order = 0;
  private gen: Generator<Ev, void, void>;
  private interactive: boolean;
  private maxSteps: number;
  private cur: { line: number; col: number } = { line: 0, col: 0 };

  private prog: Program;

  constructor(prog: Program, opts: { interactive?: boolean; input?: string; maxSteps?: number } = {}) {
    this.prog = prog;
    this.interactive = opts.interactive ?? false;
    this.input = opts.input ?? '';
    this.maxSteps = opts.maxSteps ?? 200_000;
    this.gen = this.program();
  }

  get output() { return this.segs.map((s) => s.text).join(''); }
  /** only what the program printed (no typed input, no notes) */
  get printed() { return this.segs.filter((s) => s.kind === 'out').map((s) => s.text).join(''); }

  /** the user typed a line (interactive mode) */
  feed(text: string, echo = true) {
    this.input += `${text}\n`;
    if (echo) this.push('in', `${text}\n`);
    if (this.status === 'input') this.status = 'running';
  }

  /** run until the next statement starts (or input is needed, or the program ends) */
  step(): Machine['status'] {
    if (this.status === 'done' || this.status === 'error') return this.status;
    this.status = 'running';
    this.lastStr = null;
    this.lastRead = null;
    try {
      for (;;) {
        const r = this.gen.next();
        if (r.done) { this.status = 'done'; this.line = 0; return this.status; }
        if (r.value.t === 'input') { this.status = 'input'; return this.status; }
        if (r.value.t === 'line') { this.line = r.value.line; this.tick++; return this.status; }
      }
    } catch (e) {
      this.fail(e);
      return this.status;
    }
  }

  /** run until input is needed or the program ends */
  run(): Machine['status'] {
    while (this.step() === 'running') { /* keep going */ }
    return this.status;
  }

  /** every variable in scope right now, outer scopes first, in declaration order */
  vars(): Cell[] {
    const seen = new Map<string, Cell>();
    for (const f of this.frames) for (const c of f.values()) seen.set(c.name, c);
    return [...seen.values()].sort((a, b) => a.order - b.order);
  }

  private fail(e: unknown) {
    this.status = 'error';
    if (e instanceof CppRuntimeError) this.error = { line: e.line, col: e.col, message: e.message, hint: e.hint, code: e.code };
    else this.error = { line: this.cur.line, col: this.cur.col, message: e instanceof Error ? e.message : String(e) };
    this.push('note', `\n${this.error.message}\n`);
  }

  private push(kind: Seg['kind'], text: string) {
    if (!text) return;
    const last = this.segs[this.segs.length - 1];
    if (last && last.kind === kind) last.text += text;
    else this.segs.push({ kind, text });
  }

  private rt(at: { line: number; col: number }, message: string, hint?: string, code?: string): never {
    throw new CppRuntimeError(message, at.line, at.col, hint, code);
  }

  /* ------------------------------------------------------------------ program */

  private *program(): Generator<Ev, void, void> {
    this.frames.push(new Map());
    for (const g of this.prog.globals) yield* this.exec(g);
    if (!this.prog.main) return;
    // main's own scope stays after the program ends, so the memory view still shows the final values
    this.frames.push(new Map());
    for (const s of this.prog.main.body) {
      const flow = yield* this.exec(s);
      if (flow === 'return') return;
    }
    this.exit = 0;
  }

  private count(at: { line: number; col: number }) {
    if (++this.steps > this.maxSteps) this.rt(at, 'The program has run for too long — it seems to never stop.', 'Check that every loop can end.', 'TIMEOUT');
  }

  private *exec(s: Stmt): Generator<Ev, Flow, void> {
    this.cur = s;
    switch (s.k) {
      case 'block': {
        this.frames.push(new Map());
        try {
          for (const x of s.body) {
            const f = yield* this.exec(x);
            if (f !== 'normal') return f;
          }
        } finally {
          this.frames.pop();
        }
        return 'normal';
      }
      case 'empty': return 'normal';
      case 'decl': {
        yield { t: 'line', line: s.line };
        this.count(s);
        for (const d of s.vars) {
          let vt = vtOf(s.type.base);
          let value: Value = vt === 'string' ? { t: 'string', v: '' } : { t: vt, v: 0 };
          let init = vt === 'string';
          if (d.init) {
            const v = yield* this.ev(d.init);
            if (s.type.base === 'auto') vt = v.t === 'cstr' ? 'cstr' : v.t;
            value = this.store(v, vt);
            init = true;
          }
          const decl = `${s.type.isConst ? 'const ' : ''}${s.type.base === 'auto' ? vt : s.type.base}`;
          const cell: Cell = { name: d.name, vt, decl, value, init, isConst: s.type.isConst, line: d.line, depth: this.frames.length, changed: this.tick + 1, order: this.order++ };
          this.frames[this.frames.length - 1].set(d.name, cell);
        }
        return 'normal';
      }
      case 'expr': {
        yield { t: 'line', line: s.line };
        this.count(s);
        yield* this.ev(s.e);
        return 'normal';
      }
      case 'if': {
        yield { t: 'line', line: s.line };
        this.count(s);
        const c = yield* this.ev(s.cond);
        if (truthy(c)) return yield* this.scoped(s.then);
        if (s.else) return yield* this.scoped(s.else);
        return 'normal';
      }
      case 'while': {
        for (;;) {
          yield { t: 'line', line: s.line };
          this.count(s);
          if (!truthy(yield* this.ev(s.cond))) return 'normal';
          const f = yield* this.scoped(s.body);
          if (f === 'break') return 'normal';
          if (f === 'return') return f;
        }
      }
      case 'do': {
        for (;;) {
          const f = yield* this.scoped(s.body);
          if (f === 'break') return 'normal';
          if (f === 'return') return f;
          yield { t: 'line', line: s.cond.line };
          this.count(s);
          if (!truthy(yield* this.ev(s.cond))) return 'normal';
        }
      }
      case 'for': {
        this.frames.push(new Map());
        try {
          if (s.init) yield* this.exec(s.init);
          for (;;) {
            yield { t: 'line', line: s.line };
            this.count(s);
            if (s.cond && !truthy(yield* this.ev(s.cond))) return 'normal';
            const f = yield* this.scoped(s.body);
            if (f === 'break') return 'normal';
            if (f === 'return') return f;
            if (s.step) yield* this.ev(s.step);
          }
        } finally {
          this.frames.pop();
        }
      }
      case 'return': {
        yield { t: 'line', line: s.line };
        this.count(s);
        this.exit = s.e ? Number(num(yield* this.ev(s.e))) | 0 : 0;
        return 'return';
      }
      case 'break': yield { t: 'line', line: s.line }; return 'break';
      case 'continue': yield { t: 'line', line: s.line }; return 'continue';
    }
  }

  private *scoped(s: Stmt): Generator<Ev, Flow, void> {
    if (s.k === 'block') return yield* this.exec(s);
    this.frames.push(new Map());
    try {
      return yield* this.exec(s);
    } finally {
      this.frames.pop();
    }
  }

  /* --------------------------------------------------------------- variables */

  private cell(name: string): Cell | undefined {
    for (let i = this.frames.length - 1; i >= 0; i--) { const c = this.frames[i].get(name); if (c) return c; }
    return undefined;
  }

  private store(v: Value, vt: VT): Value {
    if (vt === 'cstr') return { t: 'cstr', v: String(v.v) };
    return convert(v, vt);
  }

  private read(c: Cell, at: { line: number; col: number }): Value {
    if (!c.init) this.rt(at, `Run-Time Check Failure #3 – The variable '${c.name}' is being used without being initialized.`, `${c.name} was declared but never given a value. Give it one first: ${c.vt === 'char' ? `${c.name} = 'a';` : `${c.name} = 0;`} or read it with cin >> ${c.name};`, 'RTC3');
    return c.value;
  }

  private *ref(e: Expr): Generator<Ev, Ref, void> {
    if (e.k === 'name') {
      const c = this.cell(e.name);
      if (!c) this.rt(e, `“${e.name}” was not declared.`, undefined, 'C2065');
      return {
        name: c.name, vt: c.vt, cell: c,
        get: () => this.read(c, e),
        set: (v: Value) => { c.value = this.store(v, c.vt); c.init = true; c.changed = this.tick + 1; },
      };
    }
    if (e.k === 'index' || (e.k === 'method' && e.name === 'at')) {
      const objE = e.k === 'index' ? e.obj : e.obj;
      const base = yield* this.ref(objE);
      const idxV = yield* this.ev(e.k === 'index' ? e.index : e.args[0]);
      const s = String(base.get().v);
      const i = idxV.t === 'size_t' ? num(idxV) : Number(idxV.v);
      if (e.k === 'index') {
        if (!(i >= 0 && i <= s.length)) this.rt(e, `string subscript out of range (position ${i < 0 || i > 1e15 ? show(idxV) : i}, but “${s}” has positions 0 to ${s.length - 1}).`, `The last character is at length() − 1 = ${s.length - 1}. Positions start at 0.`, 'ASSERT');
      } else if (!(i >= 0 && i < s.length)) {
        this.rt(e, `Unhandled exception: std::out_of_range — invalid string position (${i < 0 || i > 1e15 ? show(idxV) : i}).`, `.at(${i}) needs a position from 0 to ${s.length - 1}.`, 'out_of_range');
      }
      this.lastStr = { name: base.name, op: e.k === 'index' ? 'index' : 'at', from: i, len: 1 };
      return {
        name: `${base.name}[${i}]`, vt: 'char',
        get: () => ({ t: 'char', v: i < s.length ? String(base.get().v).charCodeAt(i) : 0 }),
        set: (v: Value) => {
          const cur = String(base.get().v);
          const ch = charText(Number(convert(v, 'char').v));
          base.set({ t: 'string', v: cur.slice(0, i) + ch + cur.slice(i + 1) });
        },
      };
    }
    this.rt(e, 'This can’t be changed: it isn’t a variable.', undefined, 'C2106');
  }

  /* ------------------------------------------------------------- expressions */

  private *ev(e: Expr): Generator<Ev, Value, void> {
    this.cur = e;
    switch (e.k) {
      case 'int': return { t: e.long ? 'long' : 'int', v: e.v };
      case 'float': return { t: e.single ? 'float' : 'double', v: e.single ? Math.fround(e.v) : e.v };
      case 'char': return { t: 'char', v: e.v };
      case 'str': return { t: 'cstr', v: e.v };
      case 'bool': return { t: 'bool', v: e.v ? 1 : 0 };
      case 'npos': return { t: 'size_t', v: NPOS };
      case 'name': {
        const c = this.cell(e.name);
        if (c) return this.read(c, e);
        if (e.name === 'cout' || e.name === 'cerr') return { t: 'ostream', v: 0 };
        if (e.name === 'cin') return { t: 'istream', v: 0 };
        if (e.name === 'endl') return { t: 'endl', v: '\n' };
        this.rt(e, `“${e.name}” was not declared.`, undefined, 'C2065');
      }
      // falls through (unreachable)
      case 'unary': return yield* this.unary(e);
      case 'binary': return yield* this.binary(e);
      case 'assign': return yield* this.assign(e);
      case 'ternary': return truthy(yield* this.ev(e.cond)) ? yield* this.ev(e.a) : yield* this.ev(e.b);
      case 'call': return yield* this.call(e);
      case 'method': return yield* this.method(e);
      case 'index': {
        const r = yield* this.ref(e);
        return r.get();
      }
      case 'cast': {
        const v = yield* this.ev(e.e);
        return convert(v, vtOf(e.to));
      }
    }
    return { t: 'void', v: 0 };
  }

  private *unary(e: Extract<Expr, { k: 'unary' }>): Generator<Ev, Value, void> {
    if (e.op === '!') return { t: 'bool', v: truthy(yield* this.ev(e.e)) ? 0 : 1 };
    if (e.op === '-' || e.op === '+') {
      const x = yield* this.ev(e.e);
      const t = arithType(x.t, 'int');
      return convert({ t: x.t === 'size_t' ? 'size_t' : 'double', v: e.op === '-' ? -(x.t === 'size_t' ? (x.v as number) : num(x)) : num(x) }, t);
    }
    const r = yield* this.ref(e.e);
    const old = r.get();
    const delta = e.op.includes('++') ? 1 : -1;
    const next = old.t === 'double' || old.t === 'float' ? { t: old.t, v: (old.v as number) + delta } : convert({ t: 'double', v: (old.v as number) + delta }, old.t);
    r.set(next);
    return e.op.startsWith('pre') ? r.get() : old;
  }

  private arith(op: string, a: Value, b: Value, at: { line: number; col: number }): Value {
    if (op === '+' && (a.t === 'string' || b.t === 'string')) {
      const text = (x: Value) => (x.t === 'char' ? charText(x.v as number) : String(x.v));
      return { t: 'string', v: text(a) + text(b) };
    }
    const t = arithType(a.t, b.t);
    if (t === 'double' || t === 'float') {
      const x = num(a), y = num(b);
      const r = op === '+' ? x + y : op === '-' ? x - y : op === '*' ? x * y : x / y;
      return { t, v: t === 'float' ? Math.fround(r) : r };
    }
    // size_t keeps its raw signed form (npos = -1), so npos + 1 wraps to 0 and 0 - 1 becomes npos, as in C++
    const raw = (v: Value) => (t === 'size_t' ? (convert(v, 'size_t').v as number) : num(v));
    const x = raw(a), y = raw(b);
    if ((op === '/' || op === '%') && y === 0) this.rt(at, op === '/' ? 'Integer division by zero.' : 'Integer division by zero (% by 0).', 'The program crashed because it divided a whole number by 0. Check the value first with an if.', 'DIV0');
    let r: number;
    switch (op) {
      case '+': r = x + y; break;
      case '-': r = x - y; break;
      case '*': r = t === 'int' ? Math.imul(x, y) : x * y; break;
      case '/': r = Math.trunc(x / y); break;
      default: r = x % y;
    }
    return convert({ t: 'double', v: r }, t);
  }

  private compare(op: string, a: Value, b: Value): boolean {
    let x: number | string, y: number | string;
    if (isText(a.t) || isText(b.t)) { x = String(a.v); y = String(b.v); }
    else if (a.t === 'size_t' || b.t === 'size_t') {
      const u = (v: Value) => (v.t === 'double' || v.t === 'float' ? num(v) : num(convert(v, 'size_t')));
      x = u(a); y = u(b);
    } else { x = num(a); y = num(b); }
    switch (op) {
      case '==': return x === y;
      case '!=': return x !== y;
      case '<': return x < y;
      case '>': return x > y;
      case '<=': return x <= y;
      default: return x >= y;
    }
  }

  private *binary(e: Extract<Expr, { k: 'binary' }>): Generator<Ev, Value, void> {
    if (e.op === '&&') return { t: 'bool', v: truthy(yield* this.ev(e.a)) && truthy(yield* this.ev(e.b)) ? 1 : 0 };
    if (e.op === '||') return { t: 'bool', v: truthy(yield* this.ev(e.a)) || truthy(yield* this.ev(e.b)) ? 1 : 0 };
    const a = yield* this.ev(e.a);
    if (e.op === '<<' && a.t === 'ostream') {
      const b = yield* this.ev(e.b);
      this.push('out', show(b));
      return a;
    }
    if (e.op === '>>' && a.t === 'istream') {
      const r = yield* this.ref(e.b);
      yield* this.cinInto(r);
      return a;
    }
    const b = yield* this.ev(e.b);
    if (['==', '!=', '<', '>', '<=', '>='].includes(e.op)) return { t: 'bool', v: this.compare(e.op, a, b) ? 1 : 0 };
    if (e.op === '<<' || e.op === '>>') {
      const x = Number(num(a)) | 0, y = Number(num(b)) | 0;
      return { t: 'int', v: e.op === '<<' ? x << y : x >> y };
    }
    return this.arith(e.op, a, b, e);
  }

  private *assign(e: Extract<Expr, { k: 'assign' }>): Generator<Ev, Value, void> {
    const r = yield* this.ref(e.target);
    const v = yield* this.ev(e.value);
    if (e.op === '=') {
      r.set(v);
      return r.get();
    }
    const cur = r.get();
    const op = e.op.slice(0, -1);
    if (r.vt === 'string') {
      r.set({ t: 'string', v: String(cur.v) + (v.t === 'char' ? charText(v.v as number) : String(v.v)) });
      return r.get();
    }
    r.set(this.arith(op, cur, v, e));
    return r.get();
  }

  /* ------------------------------------------------------------------- input */

  /** waits (interactive) or gives up (batch) when the keyboard buffer is empty */
  private *needMore(): Generator<Ev, boolean, void> {
    if (!this.interactive) return false;
    yield { t: 'input' };
    return true;
  }

  private *cinInto(r: Ref): Generator<Ev, void, void> {
    if (this.failed) return; // a failed cin reads nothing more (Lecture tip: check your input)
    for (;;) {
      while (this.pos < this.input.length && isSpace(this.input[this.pos])) this.pos++;
      if (this.pos < this.input.length) break;
      if (!(yield* this.needMore())) {
        this.failed = true;
        if (isNumeric(r.vt)) r.set({ t: 'int', v: 0 });
        this.push('note', '\n(no more input — cin stops reading)\n');
        return;
      }
    }
    const from = this.pos;
    const rest = this.input.slice(this.pos);
    let ok = true;
    if (r.vt === 'char') {
      r.set({ t: 'char', v: rest.charCodeAt(0) });
      this.pos += 1;
    } else if (r.vt === 'string' || r.vt === 'cstr') {
      const tok = rest.match(/^\S+/)![0];
      r.set({ t: 'string', v: tok });
      this.pos += tok.length;
    } else if (isIntegral(r.vt)) {
      const m = rest.match(/^[+-]?\d+/);
      if (!m) {
        ok = false;
        this.failed = true;
        r.set({ t: 'int', v: 0 });
        const word = rest.match(/^\S+/)?.[0] ?? '';
        this.push('note', `\n(cin expected a whole number but got “${word}” — ${r.name} becomes 0 and cin stops reading)\n`);
      } else {
        r.set({ t: 'double', v: Number(m[0]) });
        this.pos += m[0].length;
      }
    } else {
      const m = rest.match(/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/);
      if (!m) {
        ok = false;
        this.failed = true;
        r.set({ t: 'double', v: 0 });
        const word = rest.match(/^\S+/)?.[0] ?? '';
        this.push('note', `\n(cin expected a number but got “${word}” — ${r.name} becomes 0 and cin stops reading)\n`);
      } else {
        r.set({ t: 'double', v: Number(m[0]) });
        this.pos += m[0].length;
      }
    }
    this.lastRead = { name: r.name, from, to: this.pos, ok, how: 'cin' };
  }

  private *getlineInto(r: Ref): Generator<Ev, void, void> {
    if (this.failed) return;
    for (;;) {
      const nl = this.input.indexOf('\n', this.pos);
      if (nl >= 0) {
        const from = this.pos;
        r.set({ t: 'string', v: this.input.slice(this.pos, nl).replace(/\r$/, '') });
        this.pos = nl + 1;
        this.lastRead = { name: r.name, from, to: this.pos, ok: true, how: 'getline' };
        return;
      }
      if (!(yield* this.needMore())) {
        const from = this.pos;
        if (this.pos < this.input.length) {
          r.set({ t: 'string', v: this.input.slice(this.pos) });
          this.pos = this.input.length;
        } else {
          this.failed = true;
          r.set({ t: 'string', v: '' });
        }
        this.lastRead = { name: r.name, from, to: this.pos, ok: !this.failed, how: 'getline' };
        return;
      }
    }
  }

  /* --------------------------------------------------------------- functions */

  private *call(e: Extract<Expr, { k: 'call' }>): Generator<Ev, Value, void> {
    if (e.name === 'getline') {
      yield* this.ev(e.args[0]);
      const r = yield* this.ref(e.args[1]);
      yield* this.getlineInto(r);
      return { t: 'istream', v: 0 };
    }
    const vals: Value[] = [];
    for (const a of e.args) vals.push(yield* this.ev(a));
    const [a, b] = vals;
    const real = (x: Value) => num(x);
    const keep = (x: number) => ({ t: (a?.t === 'float' ? 'float' : 'double') as VT, v: a?.t === 'float' ? Math.fround(x) : x });
    switch (e.name) {
      case 'pow': return { t: 'double', v: Math.pow(real(a), real(b)) };
      case 'sqrt': return keep(Math.sqrt(real(a)));
      case 'floor': return keep(Math.floor(real(a)));
      case 'ceil': return keep(Math.ceil(real(a)));
      case 'trunc': return keep(Math.trunc(real(a)));
      case 'round': { const x = real(a); return keep(Math.sign(x) * Math.floor(Math.abs(x) + 0.5)); }
      case 'fabs': return keep(Math.abs(real(a)));
      case 'abs': return a.t === 'double' || a.t === 'float' ? keep(Math.abs(real(a))) : convert({ t: 'double', v: Math.abs(real(a)) }, 'int');
      case 'max': case 'min': {
        const less = isText(a.t) ? String(a.v) < String(b.v) : num(a) < num(b);
        const pick = e.name === 'max' ? (less ? b : a) : (less ? a : b);
        return convert(pick, a.t === 'cstr' ? 'string' : a.t);
      }
      case 'stoi': case 'stod': case 'stof': {
        const s = String(a.v);
        const m = e.name === 'stoi' ? s.match(/^\s*[+-]?\d+/) : s.match(/^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/);
        if (!m) this.rt(e, `Unhandled exception: std::invalid_argument — invalid ${e.name} argument (“${s}”).`, `${e.name}( ) needs text that starts with a number, like "42"${e.name === 'stoi' ? ' or "-23"' : ' or "3.5"'}.`, 'invalid_argument');
        const v = Number(m[0]);
        if (e.name === 'stoi') {
          if (v > 2147483647 || v < -2147483648) this.rt(e, `Unhandled exception: std::out_of_range — stoi argument out of range (“${s}”).`, 'An int holds about ±2 billion.', 'out_of_range');
          return { t: 'int', v };
        }
        return { t: e.name === 'stof' ? 'float' : 'double', v: e.name === 'stof' ? Math.fround(v) : v };
      }
      case 'to_string': {
        const t = a.t;
        if (t === 'double' || t === 'float') return { t: 'string', v: (a.v as number).toFixed(6) };
        if (t === 'size_t') return { t: 'string', v: show(a) };
        return { t: 'string', v: String(Number(num(a))) };
      }
      case 'toupper': { const c = Number(num(a)); return { t: 'int', v: c >= 97 && c <= 122 ? c - 32 : c }; }
      case 'tolower': { const c = Number(num(a)); return { t: 'int', v: c >= 65 && c <= 90 ? c + 32 : c }; }
      case 'isdigit': { const c = Number(num(a)); return { t: 'int', v: c >= 48 && c <= 57 ? 4 : 0 }; }
      case 'isalpha': { const c = Number(num(a)); return { t: 'int', v: (c >= 65 && c <= 90) || (c >= 97 && c <= 122) ? 2 : 0 }; }
      case 'isupper': { const c = Number(num(a)); return { t: 'int', v: c >= 65 && c <= 90 ? 1 : 0 }; }
      case 'islower': { const c = Number(num(a)); return { t: 'int', v: c >= 97 && c <= 122 ? 2 : 0 }; }
      case 'isspace': { const c = Number(num(a)); return { t: 'int', v: [32, 9, 10, 11, 12, 13].includes(c) ? 8 : 0 }; }
      case 'system':
        if (/pause/i.test(String(a?.v))) this.push('out', 'Press any key to continue . . .');
        return { t: 'int', v: 0 };
    }
    this.rt(e, `There is no function called ${e.name}( ).`, undefined, 'C3861');
  }

  private *method(e: Extract<Expr, { k: 'method' }>): Generator<Ev, Value, void> {
    if (e.name === 'at') return (yield* this.ref(e)).get();
    const target = e.obj.k === 'name' ? yield* this.ref(e.obj) : null;
    const objV = target ? target.get() : yield* this.ev(e.obj);
    const s = String(objV.v);
    const name = target?.name ?? '';
    const vals: Value[] = [];
    for (const a of e.args) vals.push(yield* this.ev(a));
    const sizeArg = (v: Value | undefined, dflt: number) => (v === undefined ? dflt : v.t === 'size_t' ? num(v) : Number(num(v)) < 0 ? 2 ** 64 + Number(num(v)) : Number(num(v)));
    switch (e.name) {
      case 'length': case 'size':
        if (name) this.lastStr = { name, op: 'length' };
        return { t: 'size_t', v: s.length };
      case 'empty': return { t: 'bool', v: s.length ? 0 : 1 };
      case 'front': case 'back':
        if (!s.length) this.rt(e, `${e.name}() called on an empty string.`, undefined, 'ASSERT');
        return { t: 'char', v: s.charCodeAt(e.name === 'front' ? 0 : s.length - 1) };
      case 'find': case 'rfind': {
        const q = vals[0];
        const query = q.t === 'char' ? charText(q.v as number) : String(q.v);
        const start = sizeArg(vals[1], e.name === 'find' ? 0 : s.length);
        let hit: number;
        if (e.name === 'find') hit = start > s.length ? -1 : s.indexOf(query, start);
        else hit = s.lastIndexOf(query, Math.min(start, s.length));
        if (name) this.lastStr = { name, op: e.name, hit, query, len: query.length, from: hit };
        return { t: 'size_t', v: hit < 0 ? NPOS : hit };
      }
      case 'substr': {
        const pos = sizeArg(vals[0], 0);
        const len = sizeArg(vals[1], Infinity);
        if (pos > s.length) this.rt(e, `Unhandled exception: std::out_of_range — invalid string position (substr(${pos > 1e15 ? 'npos' : pos}) on a string of length ${s.length}).`, `substr’s start must be between 0 and length() = ${s.length}. Did find( ) return npos (not found)?`, 'out_of_range');
        const out = s.substr(pos, Math.min(len, s.length - pos));
        if (name) this.lastStr = { name, op: 'substr', from: pos, len: out.length };
        return { t: 'string', v: out };
      }
      case 'append': {
        const add = vals[0].t === 'char' ? charText(vals[0].v as number) : String(vals[0].v);
        if (target) target.set({ t: 'string', v: s + add });
        return { t: 'string', v: s + add };
      }
    }
    this.rt(e, `A string has no .${e.name}( ).`, undefined, 'C2039');
  }
}

export const truthy = (v: Value) => (isText(v.t) ? true : num(v) !== 0 && !Number.isNaN(num(v)));
export { literal };
