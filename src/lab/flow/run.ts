/**
 * Runs a flowchart like a program. The text in the shapes:
 *   Input a, b              (also Read / Get / Enter)  — reads numbers or words, like cin >>
 *   Output "Sum = ", sum    (also Print / Display / Write) — one line; values side by side get a space
 *   x = expr; y = y + 1     (also ←, <-, :=, +=, -=, *=, /=, %=, x++, x--) — in a rectangle
 *   n mod 5 = 0?            a decision: = means "equals" there; ≠ <> != ≤ <= ≥ >= and or not && || ! mod %
 * Numbers work like C++: a whole number divided by a whole number gives a whole number (7 / 2 is 3), % is the
 * remainder, and results print like cout (98.6, 77, 3.5). sqrt, pow, floor, ceil, round, max, min, abs work too.
 */
import { isInputText, isStartText, type Chart, type FNode } from './chart.ts';

type Val = { t: 'int' | 'float'; v: number } | { t: 'str'; v: string } | { t: 'bool'; v: boolean };
export type RunError = { message: string; node?: string };
export type RunResult = { ok: boolean; output: string; path: string[]; vars: Record<string, string>; error?: RunError };
class FlowError extends Error {}

/* ------------------------------------------------------------------ values */
export function show(x: Val): string {
  if (x.t === 'str') return x.v;
  if (x.t === 'bool') return x.v ? 'true' : 'false';
  if (x.t === 'int' || Number.isInteger(x.v)) return String(x.v);
  if (Math.abs(x.v) >= 1e6) return x.v.toExponential(5).replace(/\.?0+e/, 'e').replace(/e([+-])(\d)$/, 'e$10$2');
  return String(parseFloat(x.v.toPrecision(6)));
}
const isNum = (x: Val): x is { t: 'int' | 'float'; v: number } => x.t === 'int' || x.t === 'float';
const truthy = (x: Val) => (x.t === 'bool' ? x.v : x.t === 'str' ? x.v !== '' : x.v !== 0);
const n = (v: number, int: boolean): Val => (int ? { t: 'int', v: Math.trunc(v) } : { t: 'float', v });

/* ------------------------------------------------------------------ expressions */
type Tok = { k: 'num' | 'str' | 'id' | 'op'; s: string };
function tokens(src: string): Tok[] {
  const out: Tok[] = [];
  const re = /\s*(?:(\d+\.\d*|\.\d+|\d+)|"([^"]*)"|'([^']*)'|([A-Za-z_]\w*)|(==|!=|<>|<=|>=|&&|\|\||≠|≤|≥|←|[-+*/%()<>=!,]))/y;
  let i = 0;
  for (;;) {
    re.lastIndex = i;
    if (/^\s*$/.test(src.slice(i))) return out;
    const m = re.exec(src);
    if (!m) throw new FlowError(`I don't understand “${src.trim()}” (look at “${src.slice(i).trim().slice(0, 12)}”).`);
    i = re.lastIndex;
    if (m[1] !== undefined) out.push({ k: 'num', s: m[1] });
    else if (m[2] !== undefined || m[3] !== undefined) out.push({ k: 'str', s: m[2] ?? m[3] });
    else if (m[4] !== undefined) {
      const w = m[4].toLowerCase();
      if (w === 'and' || w === 'or' || w === 'not' || w === 'mod') out.push({ k: 'op', s: w === 'and' ? '&&' : w === 'or' ? '||' : w === 'not' ? '!' : '%' });
      else out.push({ k: 'id', s: m[4] });
    } else out.push({ k: 'op', s: ({ '≠': '!=', '<>': '!=', '≤': '<=', '≥': '>=' } as Record<string, string>)[m[5]] ?? m[5] });
  }
}

const FUNCS: Record<string, (a: Val[]) => Val> = {
  sqrt: (a) => ({ t: 'float', v: Math.sqrt(num1(a, 'sqrt')) }),
  pow: (a) => { if (a.length !== 2) throw new FlowError('pow needs two values: pow(x, y).'); return { t: 'float', v: Math.pow(numOf(a[0]), numOf(a[1])) }; },
  floor: (a) => ({ t: 'float', v: Math.floor(num1(a, 'floor')) }),
  ceil: (a) => ({ t: 'float', v: Math.ceil(num1(a, 'ceil')) }),
  round: (a) => { const x = num1(a, 'round'); return { t: 'float', v: Math.sign(x) * Math.round(Math.abs(x)) }; },
  abs: (a) => { const x = a[0]; if (a.length !== 1 || !isNum(x)) throw new FlowError('abs needs one number.'); return n(Math.abs(x.v), x.t === 'int'); },
  max: (a) => pick(a, 'max', (x, y) => x > y),
  min: (a) => pick(a, 'min', (x, y) => x < y),
};
function numOf(x: Val): number { if (!isNum(x)) throw new FlowError('This needs a number.'); return x.v; }
function num1(a: Val[], f: string): number { if (a.length !== 1) throw new FlowError(`${f} needs one value: ${f}(x).`); return numOf(a[0]); }
function pick(a: Val[], f: string, better: (x: number, y: number) => boolean): Val {
  if (a.length !== 2 || !isNum(a[0]) || !isNum(a[1])) throw new FlowError(`${f} needs two numbers: ${f}(x, y).`);
  const [x, y] = a as { t: 'int' | 'float'; v: number }[];
  return n(better(y.v, x.v) ? y.v : x.v, x.t === 'int' && y.t === 'int');
}

function arith(op: string, a: Val, b: Val): Val {
  if (op === '+' && (a.t === 'str' || b.t === 'str')) return { t: 'str', v: show(a) + show(b) };
  if (!isNum(a) || !isNum(b)) throw new FlowError(`“${op}” needs numbers.`);
  const int = a.t === 'int' && b.t === 'int';
  if ((op === '/' || op === '%') && b.v === 0) throw new FlowError('Division by zero: check the divisor first (with a decision).');
  switch (op) {
    case '+': return n(a.v + b.v, int);
    case '-': return n(a.v - b.v, int);
    case '*': return n(a.v * b.v, int);
    case '/': return n(a.v / b.v, int);
    default: return n(a.v % b.v, int);
  }
}
function compare(op: string, a: Val, b: Val): Val {
  const both = isNum(a) && isNum(b);
  if (!both && (a.t !== b.t)) throw new FlowError('Compare a number with a number, or a word with a word.');
  const x = a.v as number | string | boolean, y = b.v as number | string | boolean;
  const r = op === '==' ? x === y : op === '!=' ? x !== y : op === '<' ? x < y : op === '>' ? x > y : op === '<=' ? x <= y : x >= y;
  return { t: 'bool', v: r };
}

/** parses and evaluates one expression; `=` alone means "equals" here */
export function evaluate(src: string, vars: Map<string, Val>): Val {
  const t = tokens(src.replace(/\?\s*$/, ''));
  let i = 0;
  const peek = () => t[i];
  const eat = (s: string) => (t[i]?.k === 'op' && t[i].s === s ? (i++, true) : false);
  const fail = (): never => { throw new FlowError(`I don't understand “${src.trim()}”.`); };
  const or = (): Val => { let a = and(); while (eat('||')) { const b = and(); a = { t: 'bool', v: truthy(a) || truthy(b) }; } return a; };
  const and = (): Val => { let a = not(); while (eat('&&')) { const b = not(); a = { t: 'bool', v: truthy(a) && truthy(b) }; } return a; };
  const not = (): Val => (eat('!') ? { t: 'bool', v: !truthy(not()) } : cmp());
  const cmp = (): Val => {
    let a = add();
    for (;;) {
      const op = peek()?.k === 'op' ? peek()!.s : '';
      if (!['==', '=', '!=', '<', '>', '<=', '>='].includes(op)) return a;
      i++;
      a = compare(op === '=' ? '==' : op, a, add());
    }
  };
  const add = (): Val => { let a = mul(); for (;;) { if (eat('+')) a = arith('+', a, mul()); else if (eat('-')) a = arith('-', a, mul()); else return a; } };
  const mul = (): Val => { let a = unary(); for (;;) { const op = peek()?.k === 'op' && ['*', '/', '%'].includes(peek()!.s) ? t[i++].s : ''; if (!op) return a; a = arith(op, a, unary()); } };
  const unary = (): Val => { if (eat('-')) { const x = unary(); if (!isNum(x)) fail(); return n(-(x as { v: number }).v, x.t === 'int'); } if (eat('+')) return unary(); return primary(); };
  const primary = (): Val => {
    const tok = t[i++];
    if (!tok) return fail();
    if (tok.k === 'num') return tok.s.includes('.') ? { t: 'float', v: Number(tok.s) } : { t: 'int', v: Number(tok.s) };
    if (tok.k === 'str') return { t: 'str', v: tok.s };
    if (tok.k === 'op' && tok.s === '(') { const x = or(); if (!eat(')')) fail(); return x; }
    if (tok.k === 'id') {
      if (eat('(')) {
        const f = FUNCS[tok.s.toLowerCase()];
        if (!f) throw new FlowError(`“${tok.s}” is not something I can calculate (use sqrt, pow, floor, ceil, round, max, min, abs).`);
        const args: Val[] = [];
        if (!eat(')')) { do args.push(or()); while (eat(',')); if (!eat(')')) fail(); }
        return f(args);
      }
      const lower = tok.s.toLowerCase();
      if (lower === 'true' || lower === 'false') return { t: 'bool', v: lower === 'true' };
      const v = vars.get(tok.s);
      if (!v) throw new FlowError(`“${tok.s}” has no value yet: give it a value (or read it with Input) before this shape.`);
      return v;
    }
    return fail();
  };
  const v = or();
  if (i < t.length) fail();
  return v;
}

/** the items of an Output, split on the commas that are not inside quotes or brackets */
function items(src: string): string[] {
  const out: string[] = [];
  let depth = 0, quote = '', cur = '';
  for (const c of src) {
    if (quote) { cur += c; if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

const OUT = /^\s*(output|print|display|write|show)\b\s*:?\s*(.*)$/is;
const IN = /^\s*(input|read|get|enter)\b\s*:?\s*(.*)$/is;
const ASSIGN = /^\s*([A-Za-z_]\w*)\s*(\+\+|--|\+=|-=|\*=|\/=|%=|:=|←|<-|=)\s*(.*)$/s;

function statement(text: string, vars: Map<string, Val>) {
  for (const part of text.split(/;|\n/).map((s) => s.trim()).filter(Boolean)) {
    const m = ASSIGN.exec(part);
    if (!m) throw new FlowError(`I don't understand “${part}”: a rectangle holds a calculation like “total = a + b”.`);
    const [, name, op, rest] = m;
    if (op === '++' || op === '--') {
      if (rest.trim()) throw new FlowError(`I don't understand “${part}”.`);
      const cur = vars.get(name);
      if (!cur) throw new FlowError(`“${name}” has no value yet: give it a value before “${part}”.`);
      vars.set(name, arith(op === '++' ? '+' : '-', cur, { t: 'int', v: 1 }));
      continue;
    }
    if (!rest.trim()) throw new FlowError(`“${part}” needs a value after “${op}”.`);
    const value = evaluate(rest, vars);
    if (op.length === 2 && op !== ':=' && op !== '<-') {
      const cur = vars.get(name);
      if (!cur) throw new FlowError(`“${name}” has no value yet: give it a value before “${part}”.`);
      vars.set(name, arith(op[0], cur, value));
    } else vars.set(name, value);
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

export function runChart(chart: Chart, input: string, opts: { maxSteps?: number } = {}): RunResult {
  const max = opts.maxSteps ?? 5000;
  const vars = new Map<string, Val>();
  const path: string[] = [];
  let output = '';
  const words = input.split(/\s+/).filter(Boolean);
  const done = (error?: RunError): RunResult => ({ ok: !error, output, path, vars: Object.fromEntries([...vars].map(([k, v]) => [k, show(v)])), error });
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
        if (node.shape === 'terminal' && !isStartText(node.text)) return done();
        if (node.shape === 'decision') {
          const yes = outs.find((e) => e.label === 'yes'), no = outs.find((e) => e.label === 'no');
          if (!yes || !no) throw new FlowError(`A decision needs a Yes and a No arrow: ${label(node)}.`);
          const go = truthy(evaluate(node.text, vars)) ? yes : no;
          node = byId.get(go.to)!;
          continue;
        }
        if (node.shape === 'io') {
          const o = OUT.exec(node.text), i = IN.exec(node.text);
          if (o) {
            const vals = items(o[2]).map((src) => ({ src, v: evaluate(src, vars) }));
            output += vals.map((x, k) => (k > 0 && !/^["']/.test(x.src) && !/^["']/.test(vals[k - 1].src) ? ' ' : '') + show(x.v)).join('') + '\n';
          } else if (i) {
            const names = i[2].split(/[\s,]+/).filter(Boolean);
            if (!names.length || names.some((x) => !/^[A-Za-z_]\w*$/.test(x))) throw new FlowError(`Write the names to read after Input, e.g. “Input a, b”: ${label(node)}.`);
            for (const name of names) {
              const w = words.shift();
              if (w === undefined) throw new FlowError('The flowchart asks for more input than the test gives: read only what the problem gives you.');
              vars.set(name, /^-?\d+$/.test(w) ? { t: 'int', v: Number(w) } : /^-?(\d+\.\d*|\.\d+)$/.test(w) ? { t: 'float', v: Number(w) } : { t: 'str', v: w });
            }
          } else throw new FlowError(`An input/output shape starts with Input (or Read) or Output (or Print): ${label(node)}.`);
        } else if (node.shape === 'process') statement(node.text, vars);
        if (outs.length === 0) throw new FlowError(`${label(node)} has no arrow out: connect it to the next shape.`);
        if (outs.length > 1) throw new FlowError(`${label(node)} has more than one arrow out: only a decision (diamond) can split the path.`);
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
