/**
 * C++ tokenizer for the course subset (Introduction to Computing, Part 1). It keeps line/column for every token,
 * so errors point at the exact place, and it explains the classic copy-from-slides problem: curly quotes.
 */
export type TokKind = 'id' | 'kw' | 'num' | 'char' | 'str' | 'op' | 'pp' | 'eof';
export type Token = { k: TokKind; v: string; line: number; col: number; end: number; num?: number; float?: boolean; suffix?: string };

export class CppSyntaxError extends Error {
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

export const KEYWORDS = new Set([
  'int', 'float', 'double', 'char', 'bool', 'void', 'long', 'short', 'unsigned', 'signed', 'auto', 'const',
  'if', 'else', 'while', 'for', 'do', 'return', 'break', 'continue', 'switch', 'case', 'default',
  'true', 'false', 'using', 'namespace', 'and', 'or', 'not', 'not_eq', 'static_cast', 'struct', 'class', 'new', 'delete',
]);

const OPS = ['<<=', '>>=', '::', '++', '--', '+=', '-=', '*=', '/=', '%=', '==', '!=', '<=', '>=', '&&', '||', '<<', '>>', '->',
  '+', '-', '*', '/', '%', '=', '<', '>', '!', '(', ')', '{', '}', '[', ']', ';', ',', '.', '?', ':', '&', '|', '^', '~'];

const ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r', '0': '\0', '\\': '\\', "'": "'", '"': '"', a: '\x07', b: '\b', f: '\f', v: '\v', '?': '?' };

export function lex(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  let line = 1;
  let col = 1;
  const n = src.length;
  const adv = (k = 1) => {
    for (let j = 0; j < k; j++) {
      if (src[i] === '\n') { line++; col = 1; } else col++;
      i++;
    }
  };
  const fail = (msg: string, hint?: string, code?: string): never => { throw new CppSyntaxError(msg, line, col, hint, code); };

  while (i < n) {
    const c = src[i];
    // whitespace
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '\f' || c === '\v' || c === ' ') { adv(); continue; }
    // comments
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') adv(); continue; }
    if (c === '/' && src[i + 1] === '*') {
      const sl = line, sc = col;
      adv(2);
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) adv();
      if (i >= n) throw new CppSyntaxError('This /* comment never ends.', sl, sc, 'Close it with */.', 'C1071');
      adv(2);
      continue;
    }
    // preprocessor: the whole line
    if (c === '#') {
      const sl = line, sc = col, start = i;
      while (i < n && src[i] !== '\n') adv();
      out.push({ k: 'pp', v: src.slice(start, i).trim(), line: sl, col: sc, end: sc + (i - start) });
      continue;
    }
    // curly quotes pasted from slides / Word
    if (c === '“' || c === '”' || c === '‘' || c === '’' || c === '«' || c === '»') {
      fail(`“Curly” quotes ${c} are not C++ quotes.`, 'Type straight quotes: " for text and \' for one character. Curly quotes appear when code is copied from slides or Word.', 'C2018');
    }
    const sl = line, sc = col, start = i;
    // identifiers / keywords
    if (/[A-Za-z_]/.test(c)) {
      while (i < n && /[A-Za-z0-9_]/.test(src[i])) adv();
      const v = src.slice(start, i);
      out.push({ k: KEYWORDS.has(v) ? 'kw' : 'id', v, line: sl, col: sc, end: col });
      continue;
    }
    // numbers: 12, 3.5, .5, 1e6, 2.5f, 10L
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      let isFloat = false;
      if (c === '0' && /[xX]/.test(src[i + 1] ?? '')) {
        adv(2);
        while (i < n && /[0-9a-fA-F]/.test(src[i])) adv();
      } else {
        while (i < n && /[0-9]/.test(src[i])) adv();
        if (src[i] === '.') { isFloat = true; adv(); while (i < n && /[0-9]/.test(src[i])) adv(); }
        if (/[eE]/.test(src[i] ?? '') && /[0-9+-]/.test(src[i + 1] ?? '')) {
          isFloat = true;
          adv();
          if (src[i] === '+' || src[i] === '-') adv();
          while (i < n && /[0-9]/.test(src[i])) adv();
        }
      }
      const body = src.slice(start, i);
      let suffix = '';
      while (i < n && /[fFlLuU]/.test(src[i])) { suffix += src[i]; adv(); }
      if (/[A-Za-z_]/.test(src[i] ?? '')) fail(`“${src.slice(start, i + 1)}…” is not a valid number.`, 'A name can’t start with a digit.', 'C2059');
      const num = /^0[xX]/.test(body) ? parseInt(body, 16) : Number(body);
      out.push({ k: 'num', v: body + suffix, num, float: isFloat || /f/i.test(suffix), suffix: suffix.toLowerCase(), line: sl, col: sc, end: col });
      continue;
    }
    // character literal
    if (c === "'") {
      adv();
      let text = '';
      while (i < n && src[i] !== "'") {
        if (src[i] === '\n') throw new CppSyntaxError('A character literal is missing its closing \'.', sl, sc, "Write one character between single quotes, like 'a'.", 'C2001');
        if (src[i] === '\\') { adv(); const e = src[i]; text += ESCAPES[e] ?? e; adv(); continue; }
        text += src[i];
        adv();
      }
      if (i >= n) throw new CppSyntaxError('A character literal is missing its closing \'.', sl, sc, undefined, 'C2001');
      adv();
      if (text.length === 0) throw new CppSyntaxError("'' is empty: a char holds exactly one character.", sl, sc, "Put one character inside, like 'a' or ' '.", 'C2137');
      out.push({ k: 'char', v: text, line: sl, col: sc, end: col });
      continue;
    }
    // string literal
    if (c === '"') {
      adv();
      let text = '';
      while (i < n && src[i] !== '"') {
        if (src[i] === '\n') throw new CppSyntaxError('This text is missing its closing ".', sl, sc, 'Close the text on the same line: "like this".', 'C2001');
        if (src[i] === '\\') { adv(); const e = src[i]; if (e === undefined) break; text += ESCAPES[e] ?? e; adv(); continue; }
        text += src[i];
        adv();
      }
      if (i >= n) throw new CppSyntaxError('This text is missing its closing ".', sl, sc, undefined, 'C2001');
      adv();
      // "a" "b" next to each other are one string in C++
      const prev = out[out.length - 1];
      if (prev && prev.k === 'str' && prev.line === sl) { prev.v += text; prev.end = col; continue; }
      out.push({ k: 'str', v: text, line: sl, col: sc, end: col });
      continue;
    }
    // operators
    const op = OPS.find((o) => src.startsWith(o, i));
    if (op) {
      adv(op.length);
      out.push({ k: 'op', v: op, line: sl, col: sc, end: col });
      continue;
    }
    fail(`Unexpected character “${c}”.`, c === '@' ? 'An @ can only appear inside text, like "name@bue.edu.eg".' : 'Check for a typo; C++ code uses only English letters, digits and symbols.', 'C2018');
  }
  out.push({ k: 'eof', v: '', line, col, end: col });
  return out;
}
