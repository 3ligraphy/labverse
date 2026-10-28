/**
 * Runtime values and C++ conversions for the course subset: 32-bit int arithmetic, float rounding, signed char,
 * bool as 1/0, std::string, size_t with npos (stored as -1 = 2^64 - 1), and cout's default number format
 * (6 significant digits: sqrt(8) prints 2.82843, 1000000.0 prints 1e+06).
 */
export type VT = 'int' | 'long' | 'float' | 'double' | 'char' | 'bool' | 'string' | 'cstr' | 'size_t' | 'ostream' | 'istream' | 'endl' | 'void';
export type Value = { t: VT; v: number | string };

export const NUMERIC: ReadonlySet<VT> = new Set(['int', 'long', 'float', 'double', 'char', 'bool', 'size_t']);
export const INTEGRAL: ReadonlySet<VT> = new Set(['int', 'long', 'char', 'bool', 'size_t']);
export const isNumeric = (t: VT) => NUMERIC.has(t);
export const isIntegral = (t: VT) => INTEGRAL.has(t);
export const isText = (t: VT) => t === 'string' || t === 'cstr';

/** npos is size_t(-1): we keep -1 and print 2^64 - 1 */
export const NPOS = -1;
const TWO64 = 2n ** 64n;

/** the declared type names of the course → runtime types */
export function vtOf(base: string): VT {
  switch (base) {
    case 'int': case 'short': return 'int';
    case 'long': return 'long';
    case 'unsigned': case 'size_t': return 'size_t';
    case 'float': return 'float';
    case 'double': return 'double';
    case 'char': return 'char';
    case 'bool': return 'bool';
    case 'string': return 'string';
    default: return 'void';
  }
}

/** Usual arithmetic conversions of C++ for + - * / % (char and bool become int). */
export function arithType(a: VT, b: VT): VT {
  if (a === 'double' || b === 'double') return 'double';
  if (a === 'float' || b === 'float') return 'float';
  if (a === 'size_t' || b === 'size_t') return 'size_t';
  if (a === 'long' || b === 'long') return 'long';
  return 'int';
}

/** value as a plain JS number (size_t npos → a huge number, enough for comparisons) */
export function num(x: Value): number {
  if (typeof x.v === 'string') return NaN;
  if (x.t === 'size_t' && x.v < 0) return 2 ** 64 + x.v;
  return x.v;
}

const wrap32 = (n: number) => {
  if (!Number.isFinite(n)) return -2147483648;
  return Number(BigInt.asIntN(32, BigInt(Math.trunc(n))));
};
const wrapChar = (n: number) => {
  if (!Number.isFinite(n)) return 0;
  const m = ((Math.trunc(n) % 256) + 256) % 256;
  return m > 127 ? m - 256 : m;
};
const wrapSize = (n: number) => {
  if (!Number.isFinite(n)) return 0;
  const t = Math.trunc(n);
  if (t < 0 && t > -(2 ** 53)) return t; // negative = 2^64 + t (npos is -1)
  if (t >= 2 ** 63) return t - 2 ** 64;
  return t;
};

/** converts a value to another type the way C++ does on assignment / initialisation / casts */
export function convert(x: Value, to: VT): Value {
  if (to === x.t) return to === 'float' ? { t: to, v: Math.fround(x.v as number) } : x;
  if (to === 'string') {
    if (x.t === 'cstr' || x.t === 'string') return { t: 'string', v: x.v as string };
    if (x.t === 'char') return { t: 'string', v: charText(x.v as number) };
    return { t: 'string', v: charText(wrapChar(num(x))) };
  }
  if (to === 'cstr') return { t: 'cstr', v: String(x.v) };
  const n = x.t === 'size_t' ? (x.v as number) : num(x);
  switch (to) {
    case 'int': return { t: 'int', v: x.t === 'size_t' ? wrap32(n) : wrap32(n) };
    case 'long': return { t: 'long', v: Math.trunc(Number.isFinite(n) ? n : 0) };
    case 'char': return { t: 'char', v: wrapChar(n) };
    case 'bool': return { t: 'bool', v: n !== 0 && !Number.isNaN(n) ? 1 : 0 };
    case 'float': return { t: 'float', v: Math.fround(num(x)) };
    case 'double': return { t: 'double', v: num(x) };
    case 'size_t': return { t: 'size_t', v: wrapSize(n) };
    default: return x;
  }
}

export const charText = (code: number) => String.fromCharCode(((code % 256) + 256) % 256);

/** %g with 6 significant digits, as cout prints float and double by default */
export function formatG(x: number, precision = 6): string {
  if (Number.isNaN(x)) return x < 0 ? '-nan(ind)' : 'nan';
  if (!Number.isFinite(x)) return x > 0 ? 'inf' : '-inf';
  if (x === 0) return Object.is(x, -0) ? '-0' : '0';
  const [mant, expStr] = x.toExponential(precision - 1).split('e');
  const exp = Number(expStr);
  const strip = (s: string) => (s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s);
  if (exp < -4 || exp >= precision) {
    const e = Math.abs(exp);
    return `${strip(mant)}e${exp < 0 ? '-' : '+'}${e < 10 ? `0${e}` : e}`;
  }
  return strip(x.toFixed(Math.max(0, precision - 1 - exp)));
}

/** what `cout << x` prints */
export function show(x: Value): string {
  switch (x.t) {
    case 'string': case 'cstr': return x.v as string;
    case 'char': return charText(x.v as number);
    case 'bool': return x.v ? '1' : '0';
    case 'float': case 'double': return formatG(x.v as number);
    case 'size_t': return (x.v as number) < 0 ? String(TWO64 + BigInt(x.v as number)) : String(x.v);
    case 'endl': return '\n';
    default: return String(x.v);
  }
}

/** how a value looks in the memory view and in error messages */
export function literal(x: Value): string {
  switch (x.t) {
    case 'string': case 'cstr': return JSON.stringify(x.v);
    case 'char': {
      const c = charText(x.v as number);
      const esc = c === '\n' ? '\\n' : c === '\t' ? '\\t' : c === '\0' ? '\\0' : c === "'" ? "\\'" : c === '\\' ? '\\\\' : c;
      return `'${esc}'`;
    }
    case 'bool': return x.v ? 'true' : 'false';
    case 'size_t': return (x.v as number) < 0 ? 'npos' : String(x.v);
    default: return show(x);
  }
}

export const typeLabel = (t: VT) => (t === 'cstr' ? 'text "…"' : t === 'size_t' ? 'size_t' : t);
