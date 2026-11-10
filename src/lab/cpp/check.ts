/**
 * The "compiler" step: types every expression and reports what Visual Studio would refuse (or warn about), each
 * with the MSVC code and a sentence a first-year student understands. Nothing runs if there is an error.
 */
import type { Expr, Program, Stmt, VarType } from './ast.ts';
import { arithType, isIntegral, isNumeric, isText, vtOf, type VT } from './values.ts';

export type Diag = { line: number; col: number; message: string; hint?: string; code?: string; severity: 'error' | 'warning' };

/** functions the course uses → the header that provides them */
export const FUNCTIONS: Record<string, string> = {
  pow: 'cmath', sqrt: 'cmath', floor: 'cmath', ceil: 'cmath', round: 'cmath', abs: 'cmath', fabs: 'cmath', trunc: 'cmath',
  max: 'algorithm', min: 'algorithm',
  stoi: 'string', stod: 'string', stof: 'string', to_string: 'string', getline: 'string',
  toupper: 'cctype', tolower: 'cctype', isdigit: 'cctype', isalpha: 'cctype', isupper: 'cctype', islower: 'cctype', isspace: 'cctype',
  system: 'cstdlib',
};
export const STRING_METHODS = ['length', 'size', 'find', 'rfind', 'substr', 'at', 'empty', 'append', 'front', 'back'];
const STRING_ONLY = new Set(['find', 'substr', 'at', 'length', 'size', 'rfind', 'empty']);

/** Levenshtein distance, for "did you mean …?" */
export function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}
const closest = (word: string, list: Iterable<string>) => {
  let best = '';
  let bestD = Infinity;
  for (const w of list) {
    const dd = distance(word.toLowerCase(), w.toLowerCase());
    if (dd < bestD) { bestD = dd; best = w; }
  }
  return bestD <= Math.max(1, Math.floor(word.length / 3)) ? best : '';
};

type Sym = { type: VarType; vt: VT; line: number };

export function check(prog: Program): Diag[] {
  const diags: Diag[] = [];
  const err = (n: { line: number; col: number }, message: string, hint?: string, code?: string) => diags.push({ line: n.line, col: n.col, message, hint, code, severity: 'error' });
  const warn = (n: { line: number; col: number }, message: string, hint?: string, code?: string) => diags.push({ line: n.line, col: n.col, message, hint, code, severity: 'warning' });
  const has = (h: string) => prog.includes.some((i) => i.name === h);
  const warnedHeader = new Set<string>();
  const needHeader = (n: { line: number; col: number }, h: string, what: string) => {
    if (has(h) || warnedHeader.has(h)) return;
    warnedHeader.add(h);
    if (h === 'iostream') err(n, `${what} needs #include <iostream> at the top.`, 'Add #include <iostream> as the first line.', 'C2065');
    else warn(n, `${what} comes from <${h}>: add #include <${h}> at the top.`, `Visual Studio may let it pass, but other compilers won’t (Lecture 3: include it if you use it).`, 'C3861');
  };

  const scopes: Map<string, Sym>[] = [new Map()];
  const lookup = (name: string) => {
    for (let i = scopes.length - 1; i >= 0; i--) { const s = scopes[i].get(name); if (s) return s; }
    return undefined;
  };
  const allNames = () => scopes.flatMap((s) => [...s.keys()]);

  const stdName = (e: { qualified?: string; line: number; col: number }, name: string) => {
    if (!e.qualified && !prog.usingStd) err(e, `“${name}” is not known here.`, `Add using namespace std; after the #include lines — or write std::${name}.`, 'C2065');
  };

  /** the static type of an expression (errors are reported along the way) */
  function typeOf(e: Expr): VT {
    switch (e.k) {
      case 'int': return e.long ? 'long' : 'int';
      case 'float': return e.single ? 'float' : 'double';
      case 'char': return 'char';
      case 'str': return 'cstr';
      case 'bool': return 'bool';
      case 'npos': return 'size_t';
      case 'name': {
        if (e.name === 'cout' || e.name === 'cin' || e.name === 'endl' || e.name === 'cerr') {
          if (!lookup(e.name)) {
            stdName(e, e.name);
            needHeader(e, 'iostream', e.name);
            return e.name === 'cin' ? 'istream' : e.name === 'endl' ? 'endl' : 'ostream';
          }
        }
        const s = lookup(e.name);
        if (s) return s.vt;
        const near = closest(e.name, [...allNames(), 'cout', 'cin', 'endl']);
        const sameCase = allNames().find((n) => n.toLowerCase() === e.name.toLowerCase());
        if (FUNCTIONS[e.name] || STRING_ONLY.has(e.name)) err(e, `${e.name} is a function: it needs brackets, like ${e.name}(…).`, undefined, 'C3867');
        else err(e, `“${e.name}” was not declared.`, sameCase ? `C++ is case-sensitive: did you mean ${sameCase}?` : near ? `Did you mean ${near}? Otherwise declare it first, e.g. int ${e.name};` : `Declare it before using it, e.g. int ${e.name};`, 'C2065');
        return 'void';
      }
      case 'unary': {
        const t = typeOf(e.e);
        if (e.op === '!') return 'bool';
        if (e.op.endsWith('++') || e.op.endsWith('--')) {
          lvalue(e.e, e.op.includes('++') ? '++' : '--');
          if (!isNumeric(t)) err(e, `${e.op.replace(/pre|post/, '')} works on numbers only.`, undefined, 'C2105');
          return t;
        }
        if (!isNumeric(t)) { err(e, `You can’t put ${e.op} in front of a ${t}.`, undefined, 'C2675'); return 'void'; }
        return arithType(t, 'int');
      }
      case 'binary': return binaryType(e);
      case 'assign': return assignType(e);
      case 'ternary': {
        typeOf(e.cond);
        const a = typeOf(e.a);
        const b = typeOf(e.b);
        if (isNumeric(a) && isNumeric(b)) return arithType(a, b);
        if (isText(a) && isText(b)) return a === 'string' || b === 'string' ? 'string' : 'cstr';
        return a;
      }
      case 'call': return callType(e);
      case 'method': return methodType(e);
      case 'index': {
        const t = typeOf(e.obj);
        const i = typeOf(e.index);
        if (!isText(t)) { err(e, 'Only strings can be indexed with [ ] here.', 'Arrays come later in the module.', 'C2109'); return 'void'; }
        if (!isIntegral(i)) err(e.index, 'The position inside [ ] must be a whole number.', 'Indexes are 0, 1, 2, …', 'C2108');
        return 'char';
      }
      case 'cast': {
        const t = typeOf(e.e);
        const to = vtOf(e.to);
        if (isText(t) && isNumeric(to)) err(e, `You can’t cast text to ${e.to}.`, 'To turn text into a number use stoi(…) (whole number) or stod(…) (decimal).', 'C2440');
        if (to === 'string' && isNumeric(t)) err(e, `You can’t cast a number to string.`, 'Use to_string(…).', 'C2440');
        return to;
      }
    }
  }

  function lvalue(target: Expr, what: string): Sym | null {
    if (target.k === 'name') {
      const s = lookup(target.name);
      if (s && s.type.isConst) err(target, `${target.name} is a const, so it can’t be changed.`, `It was declared const on line ${s.line}. Remove const if it must change.`, 'C3892');
      return s ?? null;
    }
    if (target.k === 'index' || (target.k === 'method' && target.name === 'at')) {
      const obj = target.k === 'index' ? target.obj : target.obj;
      if (obj.k === 'name') {
        const s = lookup(obj.name);
        if (s && s.type.isConst) err(target, `${obj.name} is a const string, so its characters can’t be changed.`, undefined, 'C3892');
      }
      if (obj.k === 'str') err(target, 'A text literal "…" can’t be changed.', undefined, 'C3892');
      return null;
    }
    if (target.k === 'npos') { err(target, 'npos is a constant; it can’t be changed.', undefined, 'C2106'); return null; }
    err(target, `The left side of ${what} must be a variable.`, target.k === 'int' || target.k === 'float' ? `Write the variable on the left: x ${what} ${target.k === 'int' ? target.v : '…'};` : undefined, 'C2106');
    return null;
  }

  /** can a `from` value be stored in a `to` variable? */
  function storable(at: { line: number; col: number }, to: VT, from: VT, fromExpr: Expr | null, init: boolean, name: string) {
    if (from === 'void' || to === 'void') return;
    if (to === 'char' && from === 'cstr') {
      const text = fromExpr?.k === 'str' ? fromExpr.v : '…';
      err(at, `"${text}" is text (a string), but ${name} is a char.`, `A char takes ONE character in single quotes: '${text.slice(0, 1) || 'a'}'. Double quotes "…" make a string.`, 'C2440');
      return;
    }
    if (to === 'string' && from === 'char' && init) {
      err(at, `A string can’t start from a single char like ${fromExpr?.k === 'char' ? `'${fromExpr.text}'` : 'that'}.`, 'Use double quotes for text: "a".', 'C2440');
      return;
    }
    if (to === 'string' && isText(from)) return;
    if (to === 'string' && from === 'char') return; // s = 'a' is allowed
    if (to === 'string' && isNumeric(from)) {
      if (init) err(at, `A number can’t be stored in the string ${name}.`, 'Use to_string(…) to turn a number into text.', 'C2440');
      else warn(at, `This stores the character with that code in ${name}, not the digits.`, 'Use to_string(…) to turn a number into text.', 'C4244');
      return;
    }
    if (to === 'bool' && from === 'cstr') {
      warn(at, `Any text counts as true, so ${name} becomes true (1).`, 'A bool holds true or false: write bool ' + name + ' = true;', 'C4800');
      return;
    }
    if (isNumeric(to) && isText(from)) {
      const text = fromExpr?.k === 'str' ? fromExpr.v : '';
      err(at, `Text can’t be stored in the ${to} ${name}.`, /^-?\d+(\.\d+)?$/.test(text) ? `Remove the quotes: ${text}. To convert text to a number, use stoi(…) or stod(…).` : 'Use stoi(…) or stod(…) to turn text into a number.', 'C2440');
      return;
    }
    if (isNumeric(to) && isNumeric(from)) {
      const narrowing = (from === 'double' || from === 'float') && isIntegral(to) && to !== 'bool';
      if (to === 'int' && fromExpr?.k === 'int' && fromExpr.v > 2147483647) {
        warn(at, `${fromExpr.text} is too big for an int (the largest is 2147483647), so ${name} wraps around to a different number.`, 'Use double for very big numbers, or long long.', 'C4305');
      }
      if (narrowing) warn(at, `The decimal part is cut off when it is stored in the ${to} ${name}.`, `${to} keeps whole numbers only (3.9 becomes 3). Use float or double to keep decimals.`, 'C4244');
      return;
    }
    if (from === 'ostream' || from === 'istream' || from === 'endl') err(at, `cout / cin can’t be stored in a variable.`, undefined, 'C2440');
  }

  function binaryType(e: Extract<Expr, { k: 'binary' }>): VT {
    const a = typeOf(e.a);
    if (e.op === '<<' && a === 'istream') { err(e, 'cin uses >> , not <<.', 'Think of the arrows as the direction data moves: cin >> x moves data from the keyboard INTO x.', 'C2678'); typeOf(e.b); return 'istream'; }
    if (e.op === '>>' && a === 'ostream') { err(e, 'cout uses << , not >>.', 'Think of the arrows as the direction data moves: cout << x sends x OUT to the screen.', 'C2678'); typeOf(e.b); return 'ostream'; }
    if (e.op === '<<' && a === 'ostream') {
      const b = typeOf(e.b);
      if (b === 'istream' || b === 'ostream') err(e.b, 'cout << cin does not make sense.', undefined, 'C2679');
      return 'ostream';
    }
    if (e.op === '>>' && a === 'istream') {
      const b = typeOf(e.b);
      if (e.b.k === 'name' && e.b.name === 'endl') err(e.b, 'endl is only for cout.', 'Remove >> endl from the cin line.', 'C2679');
      else if (e.b.k !== 'name' && e.b.k !== 'index') err(e.b, 'cin >> needs a variable to store what the user types.', 'Write cin >> x; where x is a declared variable.', 'C2679');
      else lvalue(e.b, '>>');
      if (b === 'bool') warn(e.b, 'Reading into a bool expects the user to type 0 or 1.', undefined, 'C4800');
      return 'istream';
    }
    const b = typeOf(e.b);
    if (a === 'void' || b === 'void') return 'void';
    if (a === 'ostream' || a === 'istream' || b === 'ostream' || b === 'istream') {
      err(e, `${a === 'ostream' || b === 'ostream' ? 'cout' : 'cin'} can’t be used with ${e.op} here.`, e.op === '==' || e.op === '<' || e.op === '>' ? 'Put the comparison in brackets: cout << (a < b);' : undefined, 'C2678');
      return 'void';
    }
    switch (e.op) {
      case '&&': case '||': return 'bool';
      case '==': case '!=': case '<': case '>': case '<=': case '>=':
        if (isNumeric(a) && isNumeric(b)) return 'bool';
        if ((a === 'string' && isText(b)) || (b === 'string' && isText(a))) return 'bool';
        if ((a === 'string' && b === 'char') || (a === 'char' && b === 'string')) {
          err(e, 'A string can’t be compared with a char.', `Compare a character of the string, like s[0] == 'a', or compare with text in double quotes: s == "a".`, 'C2678');
          return 'bool';
        }
        if (a === 'cstr' && b === 'cstr') { warn(e, 'Two "text" literals are compared as memory addresses, not as text.', 'Store one of them in a string variable first.', 'C4130'); return 'bool'; }
        err(e, `A ${a} can’t be compared with a ${b}.`, undefined, 'C2678');
        return 'bool';
      case '+':
        if (a === 'string' && (isText(b) || b === 'char')) return 'string';
        if (b === 'string' && (isText(a) || a === 'char')) return 'string';
        if (a === 'cstr' && b === 'cstr') { err(e, 'Two "text" literals can’t be added with +.', 'Make one of them a string first: string(“…”) + "…", or store it in a string variable.', 'C2110'); return 'void'; }
        if ((a === 'cstr' && isNumeric(b)) || (b === 'cstr' && isNumeric(a))) { err(e, '"text" + a number does not join them.', 'Use to_string(number) to turn the number into text, and a string variable to join.', 'C2110'); return 'void'; }
        if ((a === 'string' && isNumeric(b)) || (b === 'string' && isNumeric(a))) { err(e, 'A string and a number can’t be added.', 'Use to_string(number) to make text first.', 'C2676'); return 'void'; }
        break;
      case '%':
        if (isNumeric(a) && isNumeric(b) && (!isIntegral(a) || !isIntegral(b))) { err(e, '% (remainder) needs two whole numbers (int).', 'For decimals, % is not allowed — convert to int first, e.g. (int)x % 2.', 'C2296'); return 'void'; }
        break;
    }
    if (isNumeric(a) && isNumeric(b)) return arithType(a, b);
    err(e, `${e.op} can’t be used between a ${a === 'cstr' ? 'text "…"' : a} and a ${b === 'cstr' ? 'text "…"' : b}.`, undefined, 'C2676');
    return 'void';
  }

  function assignType(e: Extract<Expr, { k: 'assign' }>): VT {
    const t = typeOf(e.target);
    const v = typeOf(e.value);
    const sym = lvalue(e.target, e.op);
    const name = e.target.k === 'name' ? e.target.name : 'this';
    if (e.op === '=') storable(e, t, v, e.value, false, name);
    else if (t === 'string') {
      if (e.op !== '+=') err(e, `${e.op} doesn’t work on strings.`, 'Only += joins text onto a string.', 'C2676');
      else if (!isText(v) && v !== 'char') err(e, 'Only text or a char can be added to a string with +=.', 'Use to_string(…) for numbers.', 'C2676');
    } else if (isNumeric(t)) {
      if (!isNumeric(v)) err(e, `${e.op} needs a number on the right.`, undefined, 'C2676');
      if (e.op === '%=' && (!isIntegral(t) || !isIntegral(v))) err(e, '%= needs whole numbers (int).', undefined, 'C2296');
    }
    void sym;
    return t;
  }

  function args(e: Extract<Expr, { k: 'call' }>, min: number, max = min) {
    if (e.args.length < min || e.args.length > max) {
      err(e, `${e.name}( ) takes ${min === max ? min : `${min} or ${max}`} value${max === 1 ? '' : 's'} but got ${e.args.length}.`, undefined, 'C2660');
      return false;
    }
    return true;
  }

  function callType(e: Extract<Expr, { k: 'call' }>): VT {
    const types = e.args.map(typeOf);
    const header = FUNCTIONS[e.name];
    if (STRING_ONLY.has(e.name) && !header) {
      err(e, `${e.name}( ) is a string method: it must be called on a string.`, `Write the string’s name and a dot first, e.g. s.${e.name}(${e.args.length ? '…' : ''}).`, 'C3861');
      return e.name === 'substr' ? 'string' : e.name === 'at' ? 'char' : e.name === 'empty' ? 'bool' : 'size_t';
    }
    if (!header) {
      if (e.name === 'main') { err(e, 'main can’t be called.', undefined, 'C2556'); return 'int'; }
      const near = closest(e.name, [...Object.keys(FUNCTIONS), ...STRING_METHODS]);
      err(e, `There is no function called ${e.name}( ).`, near ? `Did you mean ${near}( )?` : undefined, 'C3861');
      return 'void';
    }
    if (!e.qualified && !prog.usingStd && !['system', 'toupper', 'tolower', 'isdigit', 'isalpha', 'isupper', 'islower', 'isspace', 'pow', 'sqrt', 'floor', 'ceil', 'round', 'abs', 'fabs', 'trunc'].includes(e.name)) stdName(e, e.name);
    needHeader(e, header, `${e.name}( )`);
    const [a, b] = types;
    switch (e.name) {
      case 'pow': if (!args(e, 2)) return 'double'; if (!isNumeric(a) || !isNumeric(b)) err(e, 'pow(x, y) needs two numbers.', undefined, 'C2665'); return 'double';
      case 'sqrt': case 'floor': case 'ceil': case 'round': case 'fabs': case 'trunc':
        if (!args(e, 1)) return 'double';
        if (!isNumeric(a)) err(e, `${e.name}( ) needs a number.`, isText(a) ? 'Convert text to a number first with stod(…).' : undefined, 'C2665');
        return a === 'float' ? 'float' : 'double';
      case 'abs': if (!args(e, 1)) return 'int'; if (!isNumeric(a)) err(e, 'abs( ) needs a number.', undefined, 'C2665'); return a === 'double' || a === 'float' ? a : 'int';
      case 'max': case 'min': {
        if (!args(e, 2)) return 'int';
        const norm = (t: VT) => (t === 'cstr' ? 'cstr' : t);
        if (norm(a) !== norm(b)) err(e, `${e.name}(…) needs both values to be the same type, but got ${a === 'cstr' ? 'text' : a} and ${b === 'cstr' ? 'text' : b}.`, a === 'int' && b === 'double' || a === 'double' && b === 'int' ? `Write both as decimals, e.g. ${e.name}(2.0, 3.5).` : undefined, 'C2672');
        return a;
      }
      case 'stoi': case 'stod': case 'stof':
        if (!args(e, 1)) return 'int';
        if (!isText(a)) err(e, `${e.name}( ) turns text into a number, so it needs a string.`, isNumeric(a) ? 'This is already a number.' : undefined, 'C2665');
        return e.name === 'stoi' ? 'int' : e.name === 'stof' ? 'float' : 'double';
      case 'to_string':
        if (!args(e, 1)) return 'string';
        if (!isNumeric(a)) err(e, 'to_string( ) turns a number into text, so it needs a number.', isText(a) ? 'This is already text.' : undefined, 'C2665');
        return 'string';
      case 'getline':
        if (!args(e, 2)) return 'istream';
        if (a !== 'istream') err(e, 'getline’s first value must be cin: getline(cin, line);', undefined, 'C2780');
        if (b !== 'string') err(e.args[1], 'getline reads a whole line into a string variable.', 'Declare it as string line; and write getline(cin, line);', 'C2780');
        else lvalue(e.args[1], 'getline');
        return 'istream';
      case 'toupper': case 'tolower': case 'isdigit': case 'isalpha': case 'isupper': case 'islower': case 'isspace':
        args(e, 1);
        return 'int';
      case 'system': args(e, 1); return 'int';
    }
    return 'void';
  }

  function methodType(e: Extract<Expr, { k: 'method' }>): VT {
    const t = typeOf(e.obj);
    const types = e.args.map(typeOf);
    if (t !== 'string' && t !== 'void') {
      if (t === 'cstr') err(e, `A "text" literal has no .${e.name}( ).`, 'Store it in a string variable first: string s = "…";', 'C2228');
      else err(e, `.${e.name}( ) works on strings, but this is a ${t}.`, t === 'char' ? 'A char is a single character: it has no length, find or substr.' : undefined, 'C2228');
      return 'void';
    }
    if (t === 'void') return 'void';
    const n = e.args.length;
    const bad = (min: number, max: number) => {
      if (n < min || n > max) { err(e, `.${e.name}( ) takes ${min === max ? min : `${min} to ${max}`} value${max === 1 ? '' : 's'} but got ${n}.`, undefined, 'C2660'); return true; }
      return false;
    };
    switch (e.name) {
      case 'length': case 'size': bad(0, 0); return 'size_t';
      case 'empty': bad(0, 0); return 'bool';
      case 'find': case 'rfind':
        if (bad(1, 2)) return 'size_t';
        if (!isText(types[0]) && types[0] !== 'char') err(e.args[0], `.${e.name}( ) looks for a char ('a') or text ("ab").`, undefined, 'C2664');
        if (n === 2 && !isIntegral(types[1])) err(e.args[1], 'The start position must be a whole number.', undefined, 'C2664');
        return 'size_t';
      case 'substr':
        if (bad(0, 2)) return 'string';
        types.forEach((ty, i) => { if (!isIntegral(ty)) err(e.args[i], 'substr takes whole numbers: substr(start, length).', undefined, 'C2664'); });
        return 'string';
      case 'at': if (!bad(1, 1) && !isIntegral(types[0])) err(e.args[0], '.at( ) takes a position (a whole number).', undefined, 'C2664'); return 'char';
      case 'front': case 'back': bad(0, 0); return 'char';
      case 'append': if (!bad(1, 1) && !isText(types[0]) && types[0] !== 'char') err(e.args[0], '.append( ) takes text.', undefined, 'C2664'); return 'string';
    }
    const near = closest(e.name, STRING_METHODS);
    err(e, `A string has no .${e.name}( ).`, near ? `Did you mean .${near}( )?` : `String methods in this course: ${['length', 'find', 'substr', 'at'].map((m) => `.${m}()`).join(', ')}.`, 'C2039');
    return 'void';
  }

  /* -------------------------------------------------------------- statements */

  function declare(st: Extract<Stmt, { k: 'decl' }>) {
    const scope = scopes[scopes.length - 1];
    for (const d of st.vars) {
      let vt = vtOf(st.type.base);
      if (st.type.base === 'string' && !prog.usingStd) stdName(d, 'string');
      if (st.type.base === 'void') err(d, `A variable can’t be void.`, 'Use int, float, char, string or bool.', 'C2182');
      const prev = scope.get(d.name);
      if (prev) err(d, `${d.name} is declared twice.`, `It was already declared on line ${prev.line}. Declare each variable once, then just assign: ${d.name} = …;`, 'C2086');
      if (d.init) {
        const it = typeOf(d.init);
        if (st.type.base === 'auto') vt = it === 'cstr' ? 'cstr' : it;
        else storable(d, vt, it, d.init, true, d.name);
      } else if (st.type.isConst) err(d, `The const ${d.name} needs a value right away.`, `Write: const ${st.type.base} ${d.name} = …;`, 'C2734');
      else if (st.type.base === 'auto') err(d, `auto needs a starting value to know the type.`, undefined, 'C3531');
      scope.set(d.name, { type: st.type, vt, line: d.line });
    }
  }

  function condition(c: Expr) {
    if (c.k === 'assign' && c.op === '=') warn(c, 'This = stores a value; it doesn’t compare.', 'To compare, use == (two equals signs).', 'C4706');
    const t = typeOf(c);
    if (t === 'string' || t === 'cstr') err(c, 'A condition must be true or false, not text.', 'Compare the text, e.g. s == "yes", or test s.length() > 0.', 'C2451');
  }

  function stmt(s: Stmt, inLoop = false) {
    switch (s.k) {
      case 'block':
        scopes.push(new Map());
        s.body.forEach((x) => stmt(x, inLoop));
        scopes.pop();
        break;
      case 'decl': declare(s); break;
      case 'expr': {
        const t = typeOf(s.e);
        if (s.e.k === 'binary' && ['==', '<', '>', '<=', '>=', '!='].includes(s.e.op)) warn(s, 'This comparison is calculated and then thrown away.', s.e.op === '==' ? 'To store a value use = (one equals sign).' : undefined, 'C4552');
        else if (s.e.k === 'name' || s.e.k === 'int' || s.e.k === 'str') warn(s, 'This line does nothing.', s.e.k === 'str' ? 'To print text write cout << "…";' : undefined, 'C4555');
        void t;
        break;
      }
      case 'if':
        condition(s.cond);
        scopes.push(new Map()); stmt(s.then, inLoop); scopes.pop();
        if (s.else) { scopes.push(new Map()); stmt(s.else, inLoop); scopes.pop(); }
        break;
      case 'while': condition(s.cond); scopes.push(new Map()); stmt(s.body, true); scopes.pop(); break;
      case 'do': scopes.push(new Map()); stmt(s.body, true); scopes.pop(); condition(s.cond); break;
      case 'for':
        scopes.push(new Map());
        if (s.init) stmt(s.init, inLoop);
        if (s.cond) condition(s.cond);
        if (s.step) typeOf(s.step);
        stmt(s.body, true);
        scopes.pop();
        break;
      case 'return':
        if (s.e) { const t = typeOf(s.e); if (!isNumeric(t)) err(s, 'main must return a whole number: return 0;', undefined, 'C2440'); }
        break;
      case 'break': case 'continue':
        if (!inLoop) err(s, `${s.k} can only be used inside a loop.`, undefined, 'C2043');
        break;
      case 'empty': break;
    }
  }

  for (const g of prog.globals) stmt(g);
  if (!prog.main) {
    diags.push({ line: 1, col: 1, message: 'The program has no int main().', hint: 'Every C++ program starts in main: int main() { … return 0; }', code: 'LNK2019', severity: 'error' });
  } else {
    if (prog.voidMain) warn({ line: prog.mainLine, col: 1 }, 'Use int main(), not void main().', 'Standard C++ needs main to return int (and end with return 0;).', 'C4326');
    scopes.push(new Map());
    stmt(prog.main);
    scopes.pop();
  }
  return diags;
}
