/**
 * The course's C++ in the browser: compile (parse + check, like Visual Studio's build step), then run the
 * program on a Machine that can also be stepped line by line. Used by the lab widgets and by the tests.
 */
import type { Program } from './ast.ts';
import { check, type Diag } from './check.ts';
import { CppSyntaxError } from './lexer.ts';
import { Machine, type RunError } from './machine.ts';
import { parse } from './parser.ts';

export type { Diag } from './check.ts';
export type { Cell, ReadMark, RunError, Seg, StrMark } from './machine.ts';
export { Machine } from './machine.ts';
export { formatG, literal, show } from './values.ts';

export type Compiled = { ok: true; program: Program; warnings: Diag[] } | { ok: false; errors: Diag[]; warnings: Diag[] };

export function compile(src: string): Compiled {
  let program: Program;
  try {
    program = parse(src);
  } catch (e) {
    if (e instanceof CppSyntaxError) return { ok: false, errors: [{ line: e.line, col: e.col, message: e.message, hint: e.hint, code: e.code, severity: 'error' }], warnings: [] };
    throw e;
  }
  const diags = check(program);
  const errors = diags.filter((d) => d.severity === 'error');
  const warnings = diags.filter((d) => d.severity === 'warning');
  return errors.length ? { ok: false, errors, warnings } : { ok: true, program, warnings };
}

export type RunResult = {
  compiled: Compiled;
  /** everything the program printed */
  output: string;
  status: 'done' | 'error' | 'compile-error' | 'input';
  error: RunError | Diag | null;
  exit: number;
};

/** Compiles and runs with all the input given up front (what the checks do). */
export function run(src: string, input = '', maxSteps = 200_000): RunResult {
  const compiled = compile(src);
  if (!compiled.ok) return { compiled, output: '', status: 'compile-error', error: compiled.errors[0], exit: 1 };
  const m = new Machine(compiled.program, { input, maxSteps });
  const status = m.run();
  return { compiled, output: m.printed, status: status === 'done' ? 'done' : status === 'error' ? 'error' : 'input', error: m.error, exit: m.exit };
}
