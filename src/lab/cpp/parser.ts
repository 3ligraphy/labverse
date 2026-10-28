/**
 * Parser for the course's C++ subset: #include, using namespace std, global constants, int main() { … } with
 * declarations, expressions (C++ precedence: + before <<, << before <, …), if / else if / else and loops.
 * Syntax errors read like a TA wrote them: "Line 7 is missing a ; at the end".
 */
import { CppSyntaxError, lex, type Token } from './lexer.ts';
import type { Declarator, Expr, Program, Stmt, TypeName, VarType } from './ast.ts';

const TYPE_WORDS = new Set(['int', 'float', 'double', 'char', 'bool', 'void', 'long', 'short', 'unsigned', 'signed', 'auto']);

const shown = (t: Token) => (t.k === 'eof' ? 'the end of the program' : t.k === 'str' ? `"${t.v}"` : t.k === 'char' ? `'${t.v}'` : `“${t.v}”`);

export function parse(src: string): Program {
  const toks = lex(src);
  let p = 0;
  const peek = (o = 0) => toks[Math.min(p + o, toks.length - 1)];
  const next = () => toks[p++];
  const is = (v: string, o = 0) => { const t = peek(o); return (t.k === 'op' || t.k === 'kw' || t.k === 'id') && t.v === v; };
  const fail = (t: Token, msg: string, hint?: string, code?: string): never => { throw new CppSyntaxError(msg, t.line, t.col, hint, code); };
  const eat = (v: string) => { if (is(v)) { p++; return true; } return false; };
  const prevTok = () => toks[Math.max(0, p - 1)];

  function expect(v: string, what?: string): Token {
    if (is(v)) return next();
    const t = peek();
    if (v === ';') {
      const prev = prevTok();
      throw new CppSyntaxError(`Line ${prev.line} is missing a ; at the end.`, prev.line, prev.end, 'Every C++ statement ends with a semicolon ;', 'C2143');
    }
    if (v === ')') return fail(t, `A ( is missing its closing ) before ${shown(t)}.`, 'Count the brackets: every ( needs a ).', 'C2143');
    if (v === '}') return fail(t, `A { is missing its closing } (reached ${shown(t)}).`, 'Every { needs a matching }. Check the end of main and of each if / else block.', 'C1075');
    if (v === ']') return fail(t, `A [ is missing its closing ].`, undefined, 'C2143');
    return fail(t, `Expected ${what ?? `“${v}”`} but found ${shown(t)}.`, undefined, 'C2059');
  }

  let usingStd = false;

  /** int / std::string / const char / unsigned int … at the current token (does not consume) */
  function typeLength(o = 0): number {
    let i = o;
    let saw = false;
    if (is('const', i)) i++;
    for (;;) {
      const t = peek(i);
      if (t.k === 'kw' && TYPE_WORDS.has(t.v)) { i++; saw = true; continue; }
      if (!saw && t.k === 'id' && (t.v === 'string' || t.v === 'size_t')) { i++; saw = true; break; }
      if (!saw && t.k === 'id' && t.v === 'std' && is('::', i + 1) && peek(i + 2).k === 'id' && (peek(i + 2).v === 'string' || peek(i + 2).v === 'size_t')) { i += 3; saw = true; break; }
      break;
    }
    if (!saw) return 0;
    if (is('const', i)) i++;
    return i - o;
  }

  function parseType(): VarType {
    const start = peek();
    let isConst = false;
    const words: string[] = [];
    if (eat('const')) isConst = true;
    for (;;) {
      const t = peek();
      if (t.k === 'kw' && TYPE_WORDS.has(t.v)) { words.push(next().v); continue; }
      if (!words.length && t.k === 'id' && (t.v === 'string' || t.v === 'size_t')) { words.push(next().v); break; }
      if (!words.length && t.k === 'id' && t.v === 'std' && is('::', 1)) { next(); next(); words.push(next().v); break; }
      break;
    }
    if (eat('const')) isConst = true;
    if (!words.length) return fail(start, `Expected a type (int, float, char, string…) but found ${shown(start)}.`, undefined, 'C4430');
    let base: TypeName;
    const w = words.filter((x) => x !== 'signed');
    if (w.includes('double')) base = 'double';
    else if (w.includes('float')) base = 'float';
    else if (w.includes('char')) base = 'char';
    else if (w.includes('bool')) base = 'bool';
    else if (w.includes('void')) base = 'void';
    else if (w.includes('string')) base = 'string';
    else if (w.includes('size_t')) base = 'size_t';
    else if (w.includes('auto')) base = 'auto';
    else if (w.includes('long')) base = 'long';
    else if (w.includes('unsigned')) base = 'unsigned';
    else if (w.includes('short')) base = 'short';
    else base = 'int';
    if (is('*') || is('&')) fail(peek(), 'Pointers and references come later in the module.', 'Use a plain variable here, like int x;', 'C2059');
    return { base, isConst };
  }

  /* ------------------------------------------------------------ expressions */

  function primary(): Expr {
    const t = peek();
    const pos = { line: t.line, col: t.col };
    if (t.k === 'num') {
      next();
      if (t.float) return { ...pos, k: 'float', v: t.num!, single: t.suffix?.includes('f'), text: t.v };
      return { ...pos, k: 'int', v: t.num!, long: t.suffix?.includes('l') || t.num! > 2147483647, text: t.v };
    }
    if (t.k === 'char') {
      next();
      if (t.v.length > 1) fail(t, `'${t.v}' has ${t.v.length} characters, but a char holds exactly one.`, `For text use double quotes: "${t.v}". For one character: '${t.v[0]}'.`, 'C2015');
      return { ...pos, k: 'char', v: t.v.charCodeAt(0), text: t.v };
    }
    if (t.k === 'str') { next(); return { ...pos, k: 'str', v: t.v }; }
    if (t.k === 'kw' && (t.v === 'true' || t.v === 'false')) { next(); return { ...pos, k: 'bool', v: t.v === 'true' }; }
    if (t.k === 'kw' && t.v === 'static_cast') {
      next();
      expect('<');
      const ty = parseType();
      expect('>');
      expect('(');
      const e = expr();
      expect(')');
      return { ...pos, k: 'cast', to: ty.base, e, style: 'static' };
    }
    // functional casts: int(x), char(65), string("hi")
    if (t.k === 'kw' && TYPE_WORDS.has(t.v) && is('(', 1)) {
      next();
      next();
      const e = expr();
      expect(')');
      return { ...pos, k: 'cast', to: t.v as TypeName, e, style: 'func' };
    }
    if (t.k === 'op' && t.v === '(') {
      // (int) x — a C-style cast
      const len = typeLength(1);
      if (len && is(')', 1 + len)) {
        next();
        const ty = parseType();
        expect(')');
        const e = unary();
        return { ...pos, k: 'cast', to: ty.base, e, style: 'c' };
      }
      next();
      const e = expr();
      expect(')');
      return e;
    }
    if (t.k === 'id') {
      next();
      let name = t.v;
      let qualified: string | undefined;
      // std::cout, string::npos, std::string::npos, std::max
      if (is('::')) {
        const parts = [name];
        while (eat('::')) {
          const part = next();
          if (part.k !== 'id' && part.k !== 'kw') fail(part, `Expected a name after :: but found ${shown(part)}.`, undefined, 'C2059');
          parts.push(part.v);
        }
        if (parts[parts.length - 1] === 'npos' && parts[parts.length - 2] === 'string') return { ...pos, k: 'npos' };
        name = parts[parts.length - 1];
        qualified = parts.slice(0, -1).join('::');
      }
      if (is('(')) {
        next();
        const args: Expr[] = [];
        if (!is(')')) {
          do args.push(assignment()); while (eat(','));
        }
        expect(')');
        return { ...pos, k: 'call', name, args, qualified };
      }
      return { ...pos, k: 'name', name, qualified };
    }
    if (t.k === 'eof') return fail(t, 'The program ends in the middle of a statement.', 'Something is missing at the end: a ; or a }.', 'C1004');
    return fail(t, `Unexpected ${shown(t)} here.`, t.v === '=' ? 'Is a value missing before the = ?' : undefined, 'C2059');
  }

  function postfix(): Expr {
    let e = primary();
    for (;;) {
      const t = peek();
      if (is('.')) {
        next();
        const m = next();
        if (m.k !== 'id') fail(m, `Expected a method name after the dot but found ${shown(m)}.`, undefined, 'C2059');
        if (is('(')) {
          next();
          const args: Expr[] = [];
          if (!is(')')) {
            do args.push(assignment()); while (eat(','));
          }
          expect(')');
          e = { line: m.line, col: m.col, k: 'method', obj: e, name: m.v, args };
        } else {
          fail(m, `.${m.v} needs brackets: .${m.v}()`, `Methods are called with (), e.g. s.${m.v}().`, 'C3867');
        }
        continue;
      }
      if (is('[')) {
        next();
        const index = expr();
        expect(']');
        e = { line: t.line, col: t.col, k: 'index', obj: e, index };
        continue;
      }
      if (is('++') || is('--')) {
        next();
        e = { line: t.line, col: t.col, k: 'unary', op: t.v === '++' ? 'post++' : 'post--', e };
        continue;
      }
      return e;
    }
  }

  function unary(): Expr {
    const t = peek();
    const pos = { line: t.line, col: t.col };
    if (is('-') || is('+')) { next(); return { ...pos, k: 'unary', op: t.v as '-' | '+', e: unary() }; }
    if (is('!') || is('not')) { next(); return { ...pos, k: 'unary', op: '!', e: unary() }; }
    if (is('++') || is('--')) { next(); return { ...pos, k: 'unary', op: t.v === '++' ? 'pre++' : 'pre--', e: unary() }; }
    if (is('&') || is('*')) fail(t, 'Pointers come later in the module.', undefined, 'C2059');
    return postfix();
  }

  function binary(level: number): Expr {
    const LEVELS: string[][] = [['||', 'or'], ['&&', 'and'], ['==', '!=', 'not_eq'], ['<', '>', '<=', '>='], ['<<', '>>'], ['+', '-'], ['*', '/', '%']];
    if (level >= LEVELS.length) return unary();
    let a = binary(level + 1);
    for (;;) {
      const t = peek();
      const op = LEVELS[level].find((o) => is(o));
      if (!op) return a;
      next();
      const b = binary(level + 1);
      const norm = op === 'or' ? '||' : op === 'and' ? '&&' : op === 'not_eq' ? '!=' : op;
      a = { line: t.line, col: t.col, k: 'binary', op: norm, a, b };
    }
  }

  function ternary(): Expr {
    const cond = binary(0);
    if (is('?')) {
      const t = next();
      const a = assignment();
      expect(':');
      const b = assignment();
      return { line: t.line, col: t.col, k: 'ternary', cond, a, b };
    }
    return cond;
  }

  function assignment(): Expr {
    const target = ternary();
    const t = peek();
    if (t.k === 'op' && ['=', '+=', '-=', '*=', '/=', '%='].includes(t.v)) {
      next();
      const value = assignment();
      return { line: t.line, col: t.col, k: 'assign', op: t.v, target, value };
    }
    return target;
  }

  function expr(): Expr {
    const e = assignment();
    if (is(',')) fail(peek(), 'A comma can’t join two expressions here.', 'Write them as two separate statements, each ending with ;', 'C2059');
    return e;
  }

  /* ------------------------------------------------------------- statements */

  function declaration(type: VarType, first?: Token): Stmt {
    const start = first ?? peek();
    const vars: Declarator[] = [];
    do {
      const nameTok = next();
      if (nameTok.k !== 'id') {
        if (nameTok.k === 'kw') fail(nameTok, `“${nameTok.v}” is a C++ keyword, so it can’t be a variable name.`, 'Pick another name, e.g. num1, total, letter.', 'C2059');
        fail(nameTok, `Expected a variable name but found ${shown(nameTok)}.`, undefined, 'C2059');
      }
      if (['cout', 'cin', 'endl'].includes(nameTok.v)) fail(nameTok, `“${nameTok.v}” is already taken by C++.`, 'Pick another variable name.', 'C2371');
      if (is('(') && typeLength(1) > 0) {
        // int f(int x) { … } inside main — functions come later
        fail(nameTok, 'Functions other than main come later in the module.', 'Write this part of the program inside main().', 'C2601');
      }
      if (is('[')) fail(peek(), 'Arrays come later in the module.', 'Use separate variables for now, e.g. num1, num2, num3.', 'C2059');
      let init: Expr | null = null;
      if (eat('=')) init = assignment();
      else if (is('(')) {
        next();
        if (is(')')) fail(peek(), `“${type.base} ${nameTok.v}();” declares a function, not a variable.`, `Remove the brackets: ${type.base} ${nameTok.v};`, 'C4930');
        init = assignment();
        expect(')');
      } else if (is('{')) {
        next();
        init = is('}') ? null : assignment();
        expect('}');
        if (!init) init = { line: nameTok.line, col: nameTok.col, k: 'int', v: 0, text: '0' };
      }
      vars.push({ line: nameTok.line, col: nameTok.col, name: nameTok.v, init });
    } while (eat(','));
    expect(';');
    return { line: start.line, col: start.col, k: 'decl', type, vars };
  }

  function block(): Extract<Stmt, { k: 'block' }> {
    const open = expect('{');
    const body: Stmt[] = [];
    while (!is('}')) {
      if (peek().k === 'eof') fail(open, 'This { has no matching } .', 'Add a } where the block ends (often at the very end of main).', 'C1075');
      body.push(statement());
    }
    const close = next();
    return { line: open.line, col: open.col, k: 'block', body, endLine: close.line };
  }

  function statement(): Stmt {
    const t = peek();
    const pos = { line: t.line, col: t.col };
    if (t.k === 'pp') fail(t, `${t.v} must be at the very top, before int main().`, undefined, 'C1021');
    if (is('{')) return block();
    if (is(';')) { next(); return { ...pos, k: 'empty' }; }
    if (is('if')) {
      next();
      expect('(');
      if (is(')')) fail(peek(), 'The if has no condition inside ( ).', 'Write a test, e.g. if (num1 < num2)', 'C2059');
      const cond = expr();
      expect(')');
      if (is(';')) {
        const semi = peek();
        throw new CppSyntaxError('There is a ; right after if ( … ).', semi.line, semi.col, 'That ; is an empty statement: the if controls nothing, and the next line always runs. Remove it.', 'C4390');
      }
      const then = statement();
      let other: Stmt | null = null;
      if (eat('else')) other = statement();
      return { ...pos, k: 'if', cond, then, else: other };
    }
    if (is('else')) fail(t, 'This else has no if before it.', 'An else must follow the if’s statement or } directly. Check for a stray ; or a missing { }.', 'C2181');
    if (is('while')) {
      next();
      expect('(');
      const cond = expr();
      expect(')');
      return { ...pos, k: 'while', cond, body: statement() };
    }
    if (is('do')) {
      next();
      const body = statement();
      if (!eat('while')) fail(peek(), 'A do { } needs while ( … ); after it.', undefined, 'C2061');
      expect('(');
      const cond = expr();
      expect(')');
      expect(';');
      return { ...pos, k: 'do', body, cond };
    }
    if (is('for')) {
      next();
      expect('(');
      let init: Stmt | null = null;
      if (eat(';')) init = null;
      else if (typeLength()) init = declaration(parseType());
      else { const e = expr(); expect(';'); init = { ...pos, k: 'expr', e }; }
      const cond = is(';') ? null : expr();
      expect(';');
      const step = is(')') ? null : expr();
      expect(')');
      return { ...pos, k: 'for', init, cond, step, body: statement() };
    }
    if (is('return')) {
      next();
      const e = is(';') ? null : expr();
      expect(';');
      return { ...pos, k: 'return', e };
    }
    if (is('break')) { next(); expect(';'); return { ...pos, k: 'break' }; }
    if (is('continue')) { next(); expect(';'); return { ...pos, k: 'continue' }; }
    if (is('switch')) fail(t, 'switch isn’t part of this course yet.', 'Use if / else if / else (Lecture 3).', 'C2059');
    if (is('using')) fail(t, 'using namespace std; belongs at the top, before int main().', undefined, 'C2059');
    if (typeLength()) return declaration(parseType(), t);
    // a type-looking name that isn't known: "String s;" or "Int x;"
    if (t.k === 'id' && peek(1).k === 'id' && !is('(', 1)) {
      const lower = t.v.toLowerCase();
      if (['int', 'float', 'double', 'char', 'string', 'bool'].includes(lower)) {
        fail(t, `“${t.v}” isn’t a type: C++ is case-sensitive.`, `Write it in lower case: ${lower}`, 'C2065');
      }
      fail(t, `“${t.v}” isn’t a type C++ knows.`, t.v === 'string' ? 'Add using namespace std; at the top (or write std::string).' : 'Types in this course: int, float, double, char, string, bool.', 'C2065');
    }
    const e = expr();
    expect(';');
    return { ...pos, k: 'expr', e };
  }

  /* --------------------------------------------------------------- program */

  const includes: Program['includes'] = [];
  const globals: Stmt[] = [];
  let main: Program['main'] = null;
  let mainLine = 0;
  let voidMain = false;
  while (peek().k !== 'eof') {
    const t = peek();
    if (t.k === 'pp') {
      next();
      const m = t.v.match(/^#\s*include\s*[<"]\s*([\w.]+)\s*[>"]/);
      if (m) includes.push({ name: m[1], line: t.line });
      else if (/^#\s*include/.test(t.v)) fail(t, `This #include is not written correctly.`, 'Write it like this: #include <iostream>', 'C1083');
      else if (/^#\s*(pragma|define)/.test(t.v)) continue;
      else fail(t, `Unknown line “${t.v}”.`, undefined, 'C1021');
      continue;
    }
    if (is('using')) {
      next();
      if (!eat('namespace')) fail(peek(), 'Write: using namespace std;', undefined, 'C2873');
      const ns = next();
      if (ns.v !== 'std') fail(ns, `Unknown namespace “${ns.v}”.`, 'Write: using namespace std;', 'C2871');
      expect(';');
      usingStd = true;
      continue;
    }
    if (is('int') && is('main', 1) || (is('void') && is('main', 1))) {
      voidMain = is('void');
      next();
      const nm = next();
      mainLine = nm.line;
      expect('(');
      while (!is(')')) {
        if (peek().k === 'eof') expect(')');
        next();
      }
      next();
      if (main) fail(nm, 'There are two main functions.', 'A program has exactly one int main().', 'C2084');
      if (is(';')) fail(peek(), 'Remove the ; after int main() — the { must come next.', undefined, 'C2447');
      main = block();
      continue;
    }
    if (is('main')) fail(t, 'main needs a return type: int main()', undefined, 'C4430');
    if (typeLength()) {
      const save = p;
      parseType();
      const nameTok = peek();
      if (nameTok.k === 'id' && is('(', 1)) fail(nameTok, `Functions other than main come later in the module (found “${nameTok.v}”).`, 'Write your code inside int main() { … }.', 'C2601');
      p = save;
      globals.push(declaration(parseType()));
      continue;
    }
    fail(t, `${shown(t)} must be inside int main() { … }.`, 'After the #include lines and using namespace std; comes int main() { … } — all statements go between its braces.', 'C2059');
  }
  return { includes, usingStd, globals, main, mainLine, voidMain };
}
