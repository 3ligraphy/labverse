/**
 * Runs a flowchart like a C++ program. The text in the shapes:
 *   int a = 0, b = 0        declarations (int, float, double, char, string, bool, const …), in a rectangle:
 *                           a perfect flowchart declares every variable and gives it a starting value first
 *   Input a, b              (also Read / Get / Enter) — reads like cin >> (by the declared type)
 *   Input line s            reads the whole line, like getline(cin, s)
 *   Output "Sum = ", sum    (also Print / Display / Write) — one line; values side by side get a space
 *   x = expr; y = y + 1     (also ←, <-, :=, +=, -=, *=, /=, %=, x++, x--)
 *   n mod 5 = 0?            a decision: = means "equals" there; ≠ <> != ≤ <= ≥ >= and or not && || ! mod %
 * Numbers work like C++: int / int keeps the whole part (7 / 2 is 3), % is the remainder, and values print like
 * cout (98.6, 77, 3.5). sqrt, pow, floor, ceil, round, max, min, abs; characters are numbers: char(c - 32), int(c);
 * strings: s.length(), s.find(x), s.substr(i, n), s.at(i), s[i], npos, stoi, stod, to_string. "\n" and "\t" work.
 */
import { isStartText, type Chart, type FNode } from './chart.ts';

type Num = { t: 'int' | 'float'; v: number };
type Val = Num | { t: 'str'; v: string } | { t: 'char'; v: string } | { t: 'bool'; v: boolean };
type Type = 'int' | 'float' | 'char' | 'string' | 'bool';
export type RunError = { message: string; node?: string };
export type TraceStep = { node: string; vars: Record<string, string>; output: string };
export type RunResult = { ok: boolean; output: string; path: string[]; vars: Record<string, string>; error?: RunError; trace?: TraceStep[] };
class FlowError extends Error {}

/* ------------------------------------------------------------------ values */
export function show(x: Val): string {
  if (x.t === 'str' || x.t === 'char') return x.v;
  if (x.t === 'bool') return x.v ? 'true' : 'false';
  if (x.t === 'int' || Number.isInteger(x.v)) return String(x.v);
  if (Math.abs(x.v) >= 1e6) return x.v.toExponential(5).replace(/\.?0+e/, 'e').replace(/e([+-])(\d)$/, 'e$10$2');
  return String(parseFloat(x.v.toPrecision(6)));
}
const isNum = (x: Val): x is Num => x.t === 'int' || x.t === 'float';
/** a character takes part in sums and comparisons as its code, like C++ */
const asNum = (x: Val): Num | null => (isNum(x) ? x : x.t === 'char' ? { t: 'int', v: x.v.charCodeAt(0) } : x.t === 'bool' ? { t: 'int', v: x.v ? 1 : 0 } : null);
const truthy = (x: Val) => (x.t === 'bool' ? x.v : x.t === 'str' ? x.v !== '' : x.t === 'char' ? x.v !== '\0' : x.v !== 0);
const n = (v: number, int: boolean): Val => (int ? { t: 'int', v: Math.trunc(v) } : { t: 'float', v });
const NPOS = -1;

function convert(x: Val, to: Type, name: string): Val {
  const num = asNum(x);
  if (to === 'int') { if (!num) throw new FlowError(`“${name}” is an int: it holds whole numbers, not text.`); return { t: 'int', v: Math.trunc(num.v) }; }
  if (to === 'float') { if (!num) throw new FlowError(`“${name}” is a float: it holds numbers, not text.`); return { t: 'float', v: num.v }; }
  if (to === 'char') {
    if (x.t === 'char') return x;
    if (x.t === 'str' && x.v.length === 1) return { t: 'char', v: x.v };
    if (num && x.t !== 'bool') return { t: 'char', v: String.fromCharCode(num.v) };
    throw new FlowError(`“${name}” is a char: it holds one character, in single quotes like 'a'.`);
  }
  if (to === 'string') { if (x.t === 'str' || x.t === 'char') return { t: 'str', v: x.v }; throw new FlowError(`“${name}” is a string: give it text in double quotes, or use to_string(…).`); }
  return { t: 'bool', v: truthy(x) };
}

/* ------------------------------------------------------------------ expressions */
type Tok = { k: 'num' | 'str' | 'chr' | 'id' | 'op'; s: string };
const ESC: Record<string, string> = { n: '\n', t: '\t', '\\': '\\', '"': '"', "'": "'", '0': '\0' };
const unescape = (s: string) => s.replace(/\\(.)/g, (_, c: string) => ESC[c] ?? c);
function tokens(src: string): Tok[] {
  const out: Tok[] = [];
  const re = /\s*(?:(\d+\.\d*|\.\d+|\d+)|"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([A-Za-z_]\w*)|(==|!=|<>|<=|>=|&&|\|\||::|≠|≤|≥|←|[-+*/%()<>=!,.[\]]))/y;
  let i = 0;
  for (;;) {
    re.lastIndex = i;
    if (/^\s*$/.test(src.slice(i))) return out;
    const m = re.exec(src);
    if (!m) throw new FlowError(`I don't understand “${src.trim()}” (look at “${src.slice(i).trim().slice(0, 12)}”).`);
    i = re.lastIndex;
    if (m[1] !== undefined) out.push({ k: 'num', s: m[1] });
    else if (m[2] !== undefined) out.push({ k: 'str', s: unescape(m[2]) });
    else if (m[3] !== undefined) { const v = unescape(m[3]); out.push(v.length === 1 ? { k: 'chr', s: v } : { k: 'str', s: v }); }
    else if (m[4] !== undefined) {
      const w = m[4].toLowerCase();
      if (w === 'and' || w === 'or' || w === 'not' || w === 'mod') out.push({ k: 'op', s: w === 'and' ? '&&' : w === 'or' ? '||' : w === 'not' ? '!' : '%' });
      else out.push({ k: 'id', s: m[4] });
    } else out.push({ k: 'op', s: ({ '≠': '!=', '<>': '!=', '≤': '<=', '≥': '>=' } as Record<string, string>)[m[5]] ?? m[5] });
  }
}

const numOf = (x: Val, what = 'This'): number => { const v = asNum(x); if (!v) throw new FlowError(`${what} needs a number.`); return v.v; };
const one = (a: Val[], f: string) => { if (a.length !== 1) throw new FlowError(`${f} needs one value: ${f}(x).`); return a[0]; };
const strOf = (x: Val, f: string) => { if (x.t !== 'str' && x.t !== 'char') throw new FlowError(`${f} needs text.`); return x.v; };
function pick(a: Val[], f: string, better: (x: number, y: number) => boolean): Val {
  if (a.length !== 2) throw new FlowError(`${f} needs two numbers: ${f}(x, y).`);
  const x = asNum(a[0]), y = asNum(a[1]);
  if (!x || !y) throw new FlowError(`${f} needs two numbers: ${f}(x, y).`);
  return n(better(y.v, x.v) ? y.v : x.v, x.t === 'int' && y.t === 'int');
}
function parseNumber(s: string, f: string, int: boolean): Val {
  const m = (int ? /^\s*[-+]?\d+/ : /^\s*[-+]?(\d+\.?\d*|\.\d+)/).exec(s);
  if (!m) throw new FlowError(`${f}("${s}"): the text does not start with a number.`);
  return int ? { t: 'int', v: parseInt(m[0], 10) } : { t: 'float', v: parseFloat(m[0]) };
}
const FUNCS: Record<string, (a: Val[]) => Val> = {
  sqrt: (a) => ({ t: 'float', v: Math.sqrt(numOf(one(a, 'sqrt'))) }),
  pow: (a) => { if (a.length !== 2) throw new FlowError('pow needs two values: pow(x, y).'); return { t: 'float', v: Math.pow(numOf(a[0]), numOf(a[1])) }; },
  floor: (a) => ({ t: 'float', v: Math.floor(numOf(one(a, 'floor'))) }),
  ceil: (a) => ({ t: 'float', v: Math.ceil(numOf(one(a, 'ceil'))) }),
  round: (a) => { const x = numOf(one(a, 'round')); return { t: 'float', v: Math.sign(x) * Math.round(Math.abs(x)) }; },
  abs: (a) => { const x = asNum(one(a, 'abs')); if (!x) throw new FlowError('abs needs a number.'); return n(Math.abs(x.v), x.t === 'int'); },
  max: (a) => pick(a, 'max', (x, y) => x > y),
  min: (a) => pick(a, 'min', (x, y) => x < y),
  char: (a) => convert(one(a, 'char'), 'char', 'char(…)'),
  int: (a) => convert(one(a, 'int'), 'int', 'int(…)'),
  float: (a) => convert(one(a, 'float'), 'float', 'float(…)'),
  stoi: (a) => parseNumber(strOf(one(a, 'stoi'), 'stoi'), 'stoi', true),
  stod: (a) => parseNumber(strOf(one(a, 'stod'), 'stod'), 'stod', false),
  to_string: (a) => ({ t: 'str', v: show(one(a, 'to_string')) }),
};
function method(target: Val, name: string, args: Val[]): Val {
  if (target.t !== 'str') throw new FlowError(`.${name}(…) works on a string.`);
  const s = target.v;
  const index = (v: Val) => { const i = numOf(v, `.${name}`); return Math.trunc(i); };
  switch (name) {
    case 'length': case 'size': return { t: 'int', v: s.length };
    case 'find': {
      if (!args.length) throw new FlowError('find needs what to look for: s.find(\'@\').');
      const what = strOf(args[0], 'find');
      const from = args[1] ? index(args[1]) : 0;
      const at = s.indexOf(what, from);
      return { t: 'int', v: at < 0 ? NPOS : at };
    }
    case 'substr': {
      const from = args[0] ? index(args[0]) : 0;
      if (from < 0 || from > s.length) throw new FlowError(`substr(${from}, …): ${from} is outside the string (its length is ${s.length}).`);
      return { t: 'str', v: args[1] ? s.substr(from, Math.max(0, index(args[1]))) : s.slice(from) };
    }
    case 'at': {
      const i = index(args[0] ?? { t: 'int', v: 0 });
      if (i < 0 || i >= s.length) throw new FlowError(`at(${i}) is outside the string (its length is ${s.length}).`);
      return { t: 'char', v: s[i] };
    }
    default: throw new FlowError(`A string has no “.${name}(…)” here (use length, find, substr or at).`);
  }
}

function arith(op: string, a: Val, b: Val): Val {
  if (op === '+' && (a.t === 'str' || b.t === 'str')) return { t: 'str', v: show(a) + show(b) };
  const x = asNum(a), y = asNum(b);
  if (!x || !y) throw new FlowError(`“${op}” needs numbers.`);
  const int = x.t === 'int' && y.t === 'int';
  if ((op === '/' || op === '%') && y.v === 0) throw new FlowError('Division by zero: check the divisor first (with a decision).');
  switch (op) {
    case '+': return n(x.v + y.v, int);
    case '-': return n(x.v - y.v, int);
    case '*': return n(x.v * y.v, int);
    case '/': return n(x.v / y.v, int);
    default: return n(x.v % y.v, int);
  }
}
function compare(op: string, a: Val, b: Val): Val {
  let x: number | string | boolean, y: number | string | boolean;
  const na = asNum(a), nb = asNum(b);
  if ((a.t === 'str' || b.t === 'str')) {
    if (!((a.t === 'str' || a.t === 'char') && (b.t === 'str' || b.t === 'char'))) throw new FlowError('Compare a number with a number, or text with text.');
    x = a.v as string; y = b.v as string;
  } else if (na && nb) { x = na.v; y = nb.v; }
  else throw new FlowError('Compare a number with a number, or text with text.');
  const r = op === '==' ? x === y : op === '!=' ? x !== y : op === '<' ? x < y : op === '>' ? x > y : op === '<=' ? x <= y : x >= y;
  return { t: 'bool', v: r };
}

function indexOf(v: Val, k: Val): Val {
  if (v.t !== 'str') throw new FlowError('[ ] works on a string.');
  const at = Math.trunc(numOf(k, '[ ]'));
  if (at < 0 || at >= v.v.length) throw new FlowError(`[${at}] is outside the string (its length is ${v.v.length}).`);
  return { t: 'char', v: v.v[at] };
}

/**
 * Parses and evaluates one expression; `=` alone means "equals" here. It is parsed first and evaluated after,
 * so `and` / `or` stop early like C++: `p + 1 < s.length() and s[p + 1] == 'x'` never reads past the end.
 */
export function evaluate(src: string, vars: Map<string, Val>): Val {
  type Th = () => Val;
  const t = tokens(src.replace(/\?\s*$/, ''));
  let i = 0;
  const peek = () => t[i];
  const eat = (s: string) => (t[i]?.k === 'op' && t[i].s === s ? (i++, true) : false);
  const fail = (): never => { throw new FlowError(`I don't understand “${src.trim()}”.`); };
  const val = (v: Val): Th => () => v;
  const args = (): Th[] => { const out: Th[] = []; if (!eat(')')) { do out.push(or()); while (eat(',')); if (!eat(')')) fail(); } return out; };
  const or = (): Th => { let a = and(); while (eat('||')) { const l = a, r = and(); a = () => ({ t: 'bool', v: truthy(l()) || truthy(r()) }); } return a; };
  const and = (): Th => { let a = not(); while (eat('&&')) { const l = a, r = not(); a = () => ({ t: 'bool', v: truthy(l()) && truthy(r()) }); } return a; };
  const not = (): Th => { if (eat('!')) { const x = not(); return () => ({ t: 'bool', v: !truthy(x()) }); } return cmp(); };
  const cmp = (): Th => {
    let a = add();
    for (;;) {
      const op = peek()?.k === 'op' ? peek()!.s : '';
      if (!['==', '=', '!=', '<', '>', '<=', '>='].includes(op)) return a;
      i++;
      const l = a, r = add(), o = op === '=' ? '==' : op;
      a = () => compare(o, l(), r());
    }
  };
  const add = (): Th => { let a = mul(); for (;;) { const op = eat('+') ? '+' : eat('-') ? '-' : ''; if (!op) return a; const l = a, r = mul(); a = () => arith(op, l(), r()); } };
  const mul = (): Th => { let a = unary(); for (;;) { const op = peek()?.k === 'op' && ['*', '/', '%'].includes(peek()!.s) ? t[i++].s : ''; if (!op) return a; const l = a, r = unary(); a = () => arith(op, l(), r()); } };
  const unary = (): Th => {
    if (eat('-')) { const x = unary(); return () => { const v = asNum(x()); if (!v) throw new FlowError(`I don't understand “${src.trim()}”: “-” needs a number.`); return n(-v.v, v.t === 'int'); }; }
    if (eat('+')) return unary();
    return postfix();
  };
  const postfix = (): Th => {
    let v = primary();
    for (;;) {
      if (eat('.')) {
        const name = t[i++];
        if (name?.k !== 'id' || !eat('(')) fail();
        const target = v, as = args(), m = name!.s;
        v = () => method(target(), m, as.map((f) => f()));
      } else if (eat('[')) {
        const target = v, k = or();
        if (!eat(']')) fail();
        v = () => indexOf(target(), k());
      } else return v;
    }
  };
  const primary = (): Th => {
    const tok = t[i++];
    if (!tok) return fail();
    if (tok.k === 'num') return val(tok.s.includes('.') ? { t: 'float', v: Number(tok.s) } : { t: 'int', v: Number(tok.s) });
    if (tok.k === 'str') return val({ t: 'str', v: tok.s });
    if (tok.k === 'chr') return val({ t: 'char', v: tok.s });
    if (tok.k === 'op' && tok.s === '(') { const x = or(); if (!eat(')')) fail(); return x; }
    if (tok.k === 'id') {
      // std::string::npos, string::npos and npos all mean "not found"
      if (tok.s === 'std' || tok.s === 'string') { if (eat('::')) return primary(); }
      if (eat('(')) {
        const f = FUNCS[tok.s.toLowerCase()];
        if (!f) throw new FlowError(`“${tok.s}” is not something I can calculate (use sqrt, pow, floor, ceil, round, max, min, abs, char, int, stoi, stod, to_string).`);
        const as = args();
        return () => f(as.map((g) => g()));
      }
      const lower = tok.s.toLowerCase();
      if (lower === 'true' || lower === 'false') return val({ t: 'bool', v: lower === 'true' });
      if (lower === 'npos') return val({ t: 'int', v: NPOS });
      const name = tok.s;
      return () => {
        const v = vars.get(name);
        if (!v) throw new FlowError(`“${name}” has no value yet: declare it and give it a starting value (or read it with Input) before this shape.`);
        return v;
      };
    }
    return fail();
  };
  const expr = or();
  if (i < t.length) fail();
  return expr();
}

/** split on the commas that are not inside quotes or brackets */
function items(src: string): string[] {
  const out: string[] = [];
  let depth = 0, quote = '', cur = '';
  for (let k = 0; k < src.length; k++) {
    const c = src[k];
    if (quote) { cur += c; if (c === '\\') { cur += src[++k] ?? ''; continue; } if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (c === '(' || c === '[') depth++;
    if (c === ')' || c === ']') depth--;
    if (c === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

const OUT = /^\s*(output|print|display|write|show)\b\s*:?\s*(.*)$/is;
const IN = /^\s*(input|read|get|enter|getline)\b\s*:?\s*(line\b)?\s*(.*)$/is;
const DECL = /^\s*(const\s+)?(int|float|double|char|string|bool)\s+(.+)$/s;
const ASSIGN = /^\s*([A-Za-z_]\w*)\s*(\+\+|--|\+=|-=|\*=|\/=|%=|:=|←|<-|=)\s*(.*)$/s;

type Scope = { vars: Map<string, Val>; types: Map<string, { type: Type; konst: boolean }> };
function assign(scope: Scope, name: string, value: Val) {
  const decl = scope.types.get(name);
  if (decl?.konst && scope.vars.has(name)) throw new FlowError(`“${name}” is a constant: its value cannot be changed.`);
  scope.vars.set(name, decl ? convert(value, decl.type, name) : value);
}

function statement(text: string, scope: Scope) {
  for (const part of text.split(/;|\n/).map((s) => s.trim()).filter(Boolean)) {
    const d = DECL.exec(part);
    if (d) {
      const type: Type = d[2] === 'double' ? 'float' : (d[2] as Type);
      for (const one of items(d[3])) {
        const m = /^([A-Za-z_]\w*)\s*(?:=\s*(.+))?$/s.exec(one);
        if (!m) throw new FlowError(`I don't understand the declaration “${part}”: write it like “int total = 0”.`);
        if (d[1] && m[2] === undefined) throw new FlowError(`The constant “${m[1]}” needs its value: const float pi = 3.14159.`);
        scope.types.set(m[1], { type, konst: Boolean(d[1]) });
        scope.vars.delete(m[1]);
        if (m[2] !== undefined) scope.vars.set(m[1], convert(evaluate(m[2], scope.vars), type, m[1]));
      }
      continue;
    }
    const m = ASSIGN.exec(part);
    if (!m) throw new FlowError(`I don't understand “${part}”: a rectangle holds a declaration like “int total = 0” or a calculation like “total = a + b”.`);
    const [, name, op, rest] = m;
    const cur = scope.vars.get(name);
    if (op === '++' || op === '--') {
      if (rest.trim()) throw new FlowError(`I don't understand “${part}”.`);
      if (!cur) throw new FlowError(`“${name}” has no value yet: give it a starting value before “${part}”.`);
      assign(scope, name, arith(op === '++' ? '+' : '-', cur, { t: 'int', v: 1 }));
      continue;
    }
    if (!rest.trim()) throw new FlowError(`“${part}” needs a value after “${op}”.`);
    const value = evaluate(rest, scope.vars);
    if (op.length === 2 && op !== ':=' && op !== '<-') {
      if (!cur) throw new FlowError(`“${name}” has no value yet: give it a starting value before “${part}”.`);
      assign(scope, name, arith(op[0], cur, value));
    } else assign(scope, name, value);
  }
}

/** loop = a cycle reachable from the start (an arrow that goes back to repeat shapes) */
export function hasLoop(c: Chart): boolean {
  const start = c.nodes.find((x) => x.shape === 'terminal' && isStartText(x.text));
  if (!start) return false;
  const state = new Map<string, 1 | 2>();
  const visit = (id: string): boolean => {
    state.set(id, 1);
    for (const e of c.edges.filter((x) => x.from === id)) {
      const s = state.get(e.to);
      if (s === 1 || (!s && visit(e.to))) return true;
    }
    state.set(id, 2);
    return false;
  };
  return visit(start.id);
}

/** what the user types, read like cin: >> skips spaces and reads a word / a number / one char; a line reads to the Enter */
function reader(src: string) {
  let pos = 0;
  const skip = () => { while (pos < src.length && /\s/.test(src[pos])) pos++; };
  const out = () => new FlowError('The flowchart asks for more input than the test gives: read only what the problem gives you.');
  return {
    word(): string { skip(); if (pos >= src.length) throw out(); const start = pos; while (pos < src.length && !/\s/.test(src[pos])) pos++; return src.slice(start, pos); },
    char(): string { skip(); if (pos >= src.length) throw out(); return src[pos++]; },
    line(): string {
      if (pos >= src.length) throw out();
      const end = src.indexOf('\n', pos);
      const s = src.slice(pos, end < 0 ? src.length : end);
      pos = end < 0 ? src.length : end + 1;
      return s.replace(/\r$/, '');
    },
  };
}

export function runChart(chart: Chart, input: string, opts: { maxSteps?: number; trace?: boolean } = {}): RunResult {
  const max = opts.maxSteps ?? 5000;
  const scope: Scope = { vars: new Map(), types: new Map() };
  const path: string[] = [];
  let output = '';
  const read = reader(input);
  const trace: TraceStep[] | undefined = opts.trace ? [] : undefined;
  const snap = () => Object.fromEntries([...scope.vars].map(([k, v]) => [k, show(v)]));
  const done = (error?: RunError): RunResult => ({ ok: !error, output, path, vars: snap(), error, ...(trace ? { trace } : {}) });
  const starts = chart.nodes.filter((x) => x.shape === 'terminal' && isStartText(x.text));
  if (!starts.length) return done({ message: 'Your flowchart needs a Start shape: an oval with the word Start.' });
  if (starts.length > 1) return done({ message: `There are ${starts.length} Start shapes: keep only one.` });
  const byId = new Map(chart.nodes.map((x) => [x.id, x]));
  const label = (x: FNode) => `“${x.text.replace(/\n/g, ' ') || x.shape}”`;
  let node = starts[0];
  try {
    for (let steps = 1; ; steps++) {
      path.push(node.id);
      if (steps > max) throw Object.assign(new FlowError(`Your flowchart ran ${max} steps and never ends: does every loop have a way out?`), { node: node.id });
      try {
        const outs = chart.edges.filter((e) => e.from === node.id);
        if (node.shape === 'terminal' && !isStartText(node.text)) { trace?.push({ node: node.id, vars: snap(), output }); return done(); }
        if (node.shape === 'decision') {
          const yes = outs.find((e) => e.label === 'yes'), no = outs.find((e) => e.label === 'no');
          if (!yes || !no) throw new FlowError(`A decision needs a Yes and a No arrow: ${label(node)}.`);
          const go = truthy(evaluate(node.text, scope.vars)) ? yes : no;
          trace?.push({ node: node.id, vars: snap(), output });
          node = byId.get(go.to)!;
          continue;
        }
        if (node.shape === 'io') {
          const o = OUT.exec(node.text), i = IN.exec(node.text);
          if (o) {
            const vals = items(o[2]).map((src) => ({ src, v: evaluate(src, scope.vars) }));
            const literal = (s: string) => /^["']/.test(s);
            output += vals.map((x, k) => (k > 0 && !literal(x.src) && !literal(vals[k - 1].src) ? ' ' : '') + show(x.v)).join('') + '\n';
          } else if (i) {
            const whole = Boolean(i[2]) || i[1].toLowerCase() === 'getline';
            const names = i[3].replace(/^\(|\)$/g, '').split(/[\s,]+/).filter(Boolean);
            if (!names.length || names.some((x) => !/^[A-Za-z_]\w*$/.test(x))) throw new FlowError(`Write the names to read after Input, e.g. “Input a, b” or “Input line name”: ${label(node)}.`);
            for (const name of names) {
              const decl = scope.types.get(name);
              if (whole) { assign(scope, name, { t: 'str', v: read.line() }); continue; }
              if (decl?.type === 'char') { assign(scope, name, { t: 'char', v: read.char() }); continue; }
              const w = read.word();
              if (decl?.type === 'int' || decl?.type === 'float') {
                if (!/^[-+]?(\d+\.?\d*|\.\d+)/.test(w)) throw new FlowError(`“${name}” is a number, but the input is “${w}”.`);
                assign(scope, name, { t: 'float', v: parseFloat(w) });
              } else if (decl) assign(scope, name, { t: 'str', v: w });
              else scope.vars.set(name, /^-?\d+$/.test(w) ? { t: 'int', v: Number(w) } : /^-?(\d+\.\d*|\.\d+)$/.test(w) ? { t: 'float', v: Number(w) } : w.length === 1 ? { t: 'char', v: w } : { t: 'str', v: w });
            }
          } else throw new FlowError(`An input/output shape starts with Input (or Read) or Output (or Print): ${label(node)}.`);
        } else if (node.shape === 'process') statement(node.text, scope);
        if (outs.length === 0) throw new FlowError(`${label(node)} has no arrow out: connect it to the next shape.`);
        if (outs.length > 1) throw new FlowError(`${label(node)} has more than one arrow out: only a decision (diamond) can split the path.`);
        trace?.push({ node: node.id, vars: snap(), output });
        node = byId.get(outs[0].to)!;
      } catch (e) {
        if (e instanceof FlowError) throw Object.assign(e, { node: (e as FlowError & { node?: string }).node ?? node.id });
        throw e;
      }
    }
  } catch (e) {
    if (e instanceof FlowError) return done({ message: e.message, node: (e as FlowError & { node?: string }).node });
    throw e;
  }
}
