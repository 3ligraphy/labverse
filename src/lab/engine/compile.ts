/**
 * Compiles the student's TSX/JSX files to CommonJS for the preview runtimes (the lab workbench and the
 * builder-lab playground both use this file).
 *
 * 1. Babel reads the file first. Its syntax errors are precise ("Expected corresponding JSX closing tag for
 *    <View>"), and each one is turned into a sentence a beginner can act on, with the line it happened on.
 * 2. Every loop gets a guard call, so `while (true)` stops with a clear message instead of freezing the tab.
 *    The guard is inserted on the same line, so line numbers in errors still match the student's code.
 * 3. Sucrase then strips the types and turns JSX and imports into plain JavaScript.
 */
import { transform } from 'sucrase';
import { parse } from '@babel/parser';

export type CompileError = { file: string; message: string; line: number; column: number; hint?: string };
export type CompileResult = { ok: true; files: Record<string, string> } | { ok: false; errors: CompileError[] };

/** The name of the loop guard the runtimes pass to every compiled file. */
export const LOOP_GUARD = '__labLoop';

type Node = { type: string; start?: number | null; end?: number | null; loc?: { start: { line: number } } | null; body?: Node; [key: string]: unknown };

const LOOPS = new Set(['ForStatement', 'ForInStatement', 'ForOfStatement', 'WhileStatement', 'DoWhileStatement']);

function walk(node: unknown, visit: (n: Node) => void) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  const n = node as Node;
  if (typeof n.type !== 'string') return;
  visit(n);
  for (const key of Object.keys(n)) {
    if (key === 'loc' || key === 'extra' || key === 'leadingComments' || key === 'trailingComments' || key === 'innerComments') continue;
    walk(n[key], visit);
  }
}

/** The character at a 1-based line and 0-based column, for "Unexpected `}`" style messages. */
function charAt(code: string, line: number, column: number) {
  return code.split('\n')[line - 1]?.[column] ?? '';
}

/**
 * Finds the tag that is closed wrongly or never closed, for messages Babel can only phrase as "Unterminated
 * JSX contents". A rough scan (good enough to name the culprit), not a parser.
 */
export function unbalancedTag(code: string): { kind: 'mismatch'; open: string; openLine: number; close: string; line: number } | { kind: 'unclosed'; open: string; openLine: number } | null {
  const lineAt = (i: number) => code.slice(0, i).split('\n').length;
  const stack: { name: string; line: number }[] = [];
  const tag = /<(\/?)([A-Za-z][\w.]*)?((?:[^<>"'{}]|"[^"]*"|'[^']*'|\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})*?)(\/?)>/g;
  for (let m: RegExpExecArray | null; (m = tag.exec(code)); ) {
    const [, closing, name = '', , selfClosing] = m;
    if (selfClosing) continue;
    // a TypeScript generic such as useState<string>( is not a tag
    if (!closing && /^[(:=,]/.test(code.slice(m.index + m[0].length).trimStart())) continue;
    if (!closing) stack.push({ name, line: lineAt(m.index) });
    else {
      const open = stack.pop();
      if (!open) continue;
      if (open.name !== name) return { kind: 'mismatch', open: open.name || '>', openLine: open.line, close: name, line: lineAt(m.index) };
    }
  }
  const last = stack.pop();
  return last ? { kind: 'unclosed', open: last.name || '>', openLine: last.line } : null;
}

/** Babel's message → one sentence plus a hint, in the words a first-year student would use. */
export function explainSyntax(raw: string, code: string, line: number, column: number): { message: string; hint?: string; line?: number } {
  const message = raw.replace(/\s*\(\d+:\d+\)\s*$/, '').trim();
  let m: RegExpExecArray | null;
  if ((m = /Expected corresponding JSX closing tag for <([^>]+)>/.exec(message))) {
    return { message: `<${m[1]}> is closed with the wrong tag.`, hint: `Close it with </${m[1]}>, or make it self-closing: <${m[1]} />. Check that inner tags are closed before their parent.` };
  }
  if (/Unterminated JSX contents/.test(message)) {
    const bad = unbalancedTag(code);
    if (bad?.kind === 'mismatch') return { line: bad.line, message: `<${bad.open}> (line ${bad.openLine}) is closed with </${bad.close}>.`, hint: `Close it with </${bad.open}> first, then close the outer tag. Or write it self-closing: <${bad.open} />.` };
    if (bad?.kind === 'unclosed') return { line: bad.openLine, message: `<${bad.open}> on line ${bad.openLine} is never closed.`, hint: `Add </${bad.open}> where it should end, or write it self-closing: <${bad.open} />.` };
    return { message: 'A tag is opened but never closed.', hint: 'Count your opening and closing tags: every <Tag> needs a </Tag> (or write <Tag />).' };
  }
  if (/Adjacent JSX elements must be wrapped/.test(message)) return { message: 'A component can only return one parent element.', hint: 'Wrap the elements in a <View>…</View>, or a fragment <>…</>.' };
  if (/Unterminated string constant/.test(message)) return { message: 'A string is never closed.', hint: 'Close it with the same quote you opened it with: \'…\' or "…".' };
  if (/Unterminated template/.test(message)) return { message: 'A template string is never closed.', hint: 'Close it with a backtick: `…`.' };
  if (/Unterminated regular expression/.test(message)) return { message: 'Something here looks like an unfinished regular expression.', hint: 'Usually a stray / — or a closing tag written outside JSX.' };
  if (/'return' outside of function/.test(message)) return { message: '`return` is outside the function.', hint: 'A } above this line closes the component too early. Check that the { } braces pair up.' };
  if ((m = /Identifier '([^']+)' has already been declared/.exec(message))) return { message: `\`${m[1]}\` is declared twice.`, hint: 'Rename one of them, or remove the duplicate import or const.' };
  if (/Missing semicolon/.test(message)) return { message: 'Two statements run into each other here.', hint: 'Look for a misspelled keyword (e.g. `cosnt`), a missing comma or a missing operator.' };
  if ((m = /Unexpected token, expected "([^"]+)"/.exec(message))) {
    const want = m[1];
    const hint = want === ','
      ? 'A comma is missing between items, props or arguments — or a bracket opened earlier is not closed.'
      : want === ')' || want === '}' || want === ']'
        ? `A "${want}" is missing: something opened earlier is not closed.`
        : `JavaScript expected "${want}" here.`;
    return { message: `Expected "${want}" here.`, hint };
  }
  if (/Unexpected keyword/.test(message) || /Unexpected reserved word/.test(message)) return { message, hint: 'A keyword is in a place where it can\'t be used — often a missing } or ) on the line above.' };
  if (/Unexpected token/.test(message) || /Unexpected character/.test(message)) {
    const ch = charAt(code, line, column);
    if (!ch) return { message: 'The file ends too early.', hint: 'Something opened is never closed: a {, ( or <Tag>.' };
    if (ch === '}' || ch === ')' || ch === ']') return { message: `Unexpected "${ch}".`, hint: 'There is an extra closing bracket here, or the one that should pair with it is missing earlier.' };
    if (ch === '<') return { message: 'Unexpected "<".', hint: 'JSX must be inside return ( … ) or { … } — and a .ts file cannot hold JSX (use .tsx).' };
    return { message: `Unexpected "${ch}".`, hint: 'Check this line and the one above for a typo or a missing bracket.' };
  }
  return { message: message || 'Syntax error' };
}

/** Adds the loop guard to every loop body, on the same line (so errors still point at the right line). */
function guardLoops(code: string, ast: Node): string {
  const edits: { at: number; text: string }[] = [];
  walk(ast, (n) => {
    if (!LOOPS.has(n.type) || !n.body || n.body.start == null || n.body.end == null) return;
    const call = `${LOOP_GUARD}(${n.loc?.start.line ?? 0});`;
    if (n.body.type === 'BlockStatement') edits.push({ at: n.body.start + 1, text: call });
    else edits.push({ at: n.body.start, text: `{${call}` }, { at: n.body.end, text: '}' });
  });
  if (!edits.length) return code;
  edits.sort((a, b) => b.at - a.at);
  let out = code;
  for (const e of edits) out = out.slice(0, e.at) + e.text + out.slice(e.at);
  return out;
}

export function compileFile(path: string, code: string): { ok: true; code: string } | { ok: false; error: CompileError } {
  let ast: Node;
  try {
    // a .ts file can't hold JSX (and `<T>value` there is a type cast), so it is read without the JSX plugin
    const plugins: ('jsx' | 'typescript')[] = /\.tsx$/.test(path) ? ['jsx', 'typescript'] : /\.ts$/.test(path) ? ['typescript'] : ['jsx'];
    ast = parse(code, { sourceType: 'module', plugins, errorRecovery: false }) as unknown as Node;
  } catch (error) {
    const e = error as Error & { loc?: { line: number; column: number } };
    const line = e.loc?.line ?? 1;
    const column = e.loc?.column ?? 0;
    const explained = explainSyntax(e.message, code, line, column);
    const at = explained.line ?? line;
    return { ok: false, error: { file: path, message: explained.message, line: at, column: at === line ? column + 1 : 1, ...(explained.hint ? { hint: explained.hint } : null) } };
  }
  try {
    const out = transform(guardLoops(code, ast), {
      transforms: /\.ts$/.test(path) ? ['typescript', 'imports'] : ['typescript', 'jsx', 'imports'],
      jsxRuntime: 'automatic',
      production: true,
      filePath: path,
    });
    return { ok: true, code: out.code };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const m = /\((\d+):(\d+)\)/.exec(message);
    const line = m ? Number(m[1]) : 1;
    const column = m ? Number(m[2]) : 0;
    const explained = explainSyntax(message.replace(/^Error transforming [^:]+:\s*/, ''), code, line, column);
    return { ok: false, error: { file: path, column: column + 1, ...explained, line: explained.line ?? line } };
  }
}

export function compileAll(files: Record<string, string>): CompileResult {
  const out: Record<string, string> = {};
  const errors: CompileError[] = [];
  for (const [path, code] of Object.entries(files)) {
    if (!/\.(tsx?|jsx?)$/.test(path)) continue; // e.g. index.html shown for reading only
    const result = compileFile(path, code);
    if (result.ok) out[path] = result.code;
    else errors.push(result.error);
  }
  return errors.length ? { ok: false, errors } : { ok: true, files: out };
}

export { createLoopGuard, PREVIEW_ENV } from './guard.ts';
