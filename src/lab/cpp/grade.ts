/** Grades a student's C++ against staff checks (see checks.ts for the check language). */
import { compile, Machine } from './index.ts';
import type { CppCheck, CppStep } from './checks.ts';
import { containsOutput, endsWarning, nearText, tidyOutput } from './near.ts';

/** warning: it passes, but only because the output is near enough (see near.ts) — says what to fix */
export type CheckResult = { name: string; pass: boolean; message?: string; input?: string; output?: string; warning?: string };
export type CppOutcome = {
  results: CheckResult[];
  /** the program did not compile: one message for everything */
  compileError?: { line: number; message: string; hint?: string };
};

const firstDiff = (want: string, got: string) => {
  const w = want.split('\n'), g = got.split('\n');
  for (let i = 0; i < Math.max(w.length, g.length); i++) if (w[i] !== g[i]) return { line: i + 1, want: w[i] ?? '(nothing)', got: g[i] ?? '(nothing)' };
  return null;
};
const show = (s: string) => JSON.stringify(s).slice(1, -1);

export function gradeCpp(code: string, checks: CppCheck[], maxSteps = 100_000): CppOutcome {
  const compiled = compile(code);
  if (!compiled.ok) {
    const e = compiled.errors[0];
    return { compileError: { line: e.line, message: e.message, hint: e.hint }, results: checks.map((c) => ({ name: c.name, pass: false })) };
  }
  const results = checks.map((c): CheckResult => {
    const input = c.steps.filter((s): s is { in: string } => 'in' in s).map((s) => s.in).join('\n');
    const codeSteps = c.steps.filter((s): s is Extract<CppStep, { code: string }> => 'code' in s);
    for (const s of codeSteps) {
      const hit = new RegExp(s.code, s.flags).test(code);
      if (hit === Boolean(s.negate)) return { name: c.name, pass: false, message: s.message };
    }
    const runs = c.steps.some((s) => 'expect' in s || 'exact' in s || 'not' in s);
    if (!runs) return { name: c.name, pass: true };
    const m = new Machine(compiled.program, { input: input ? `${input}\n` : '', maxSteps });
    m.run();
    const output = m.printed;
    if (m.status === 'error') return { name: c.name, pass: false, input, output, message: `The program stopped with an error: ${m.error?.message}` };
    // only the spacing differs (an extra space, an endl at the end): it passes, with a warning that says what to fix
    let warning: string | undefined;
    for (const s of c.steps) {
      if ('expect' in s && !containsOutput(output, s.expect)) {
        const near = nearText(s.expect);
        if (!near || !containsOutput(nearText(output), near)) {
          return { name: c.name, pass: false, input, output, message: `With the input “${show(input)}”, the output should contain “${show(s.expect)}”.` };
        }
        warning ??= `Accepted, but check the spaces: the output should contain “${show(s.expect)}”.`;
      }
      if ('not' in s && output.includes(s.not)) {
        return { name: c.name, pass: false, input, output, message: `With the input “${show(input)}”, the output should not contain “${show(s.not)}”.` };
      }
      if ('exact' in s && output !== s.exact) {
        if (tidyOutput(output) === tidyOutput(s.exact)) warning ??= endsWarning(s.exact, output);
        else if (nearText(output) === nearText(s.exact)) {
          const d = firstDiff(tidyOutput(s.exact), tidyOutput(output));
          warning ??= d ? `Accepted, but check the spaces: line ${d.line} should be “${show(d.want)}” and yours is “${show(d.got)}”.` : 'Accepted, but check the spaces.';
        } else {
          const d = firstDiff(s.exact, output);
          return { name: c.name, pass: false, input, output, message: d ? `Output line ${d.line} should be “${show(d.want)}” but is “${show(d.got)}”.` : 'The output is not exactly right.' };
        }
      }
    }
    return { name: c.name, pass: true, input, output, ...(warning ? { warning } : {}) };
  });
  return { results };
}
