/**
 * "Type the answer" questions: no options, the student types the answer and it is checked exactly.
 *   output — what the code prints: compared with the real output of the code (run here, never stored in the page)
 *   value  — a value such as 6 or eg: compared with the accepted answers, which reach the page only as hashes
 *   input  — what the user types: the code runs with it and must print the expected output
 */
import { run } from './index.ts';
import { wrapProgram } from './wrap.ts';

/** a value as typed: trimmed, outer quotes removed ('v' and v are the same answer), spaces collapsed */
export const normalizeValue = (s: string) => s.trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim().replace(/\s+/g, ' ');

/** program output as typed or printed: Windows line ends, spaces at line ends and blank lines at the end don't count */
export const normalizeOutput = (s: string) => s.replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/^\n+|\n+$/g, '');

/** FNV-1a (32-bit), salted with the question id: enough to keep accepted values out of the page source */
export function answerHash(id: string, value: string, ignoreCase = false): string {
  let h = 0x811c9dc5;
  const v = normalizeValue(value);
  const text = `${id}|${ignoreCase ? v.toLowerCase() : v}`;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** ignoreCase: for word answers (ASCII and ascii are the same answer); C++ values keep their case ('A' is not 'a') */
export type AnswerCfg = { id: string; mode: 'output' | 'value' | 'input'; code: string; input: string; hashes: string[]; expected: string; ignoreCase?: boolean };
export type AnswerResult = { pass: boolean; message: string };

/** what the code prints for the given keyboard input (or the build error) */
export function outputOf(code: string, input: string): { ok: true; output: string } | { ok: false; message: string } {
  const r = run(wrapProgram(code).src, input ? `${input.replace(/\s+$/, '')}\n` : '', 200_000);
  if (!r.compiled.ok) return { ok: false, message: r.compiled.errors[0].message };
  if (r.status === 'error') return { ok: false, message: r.error?.message ?? 'The program stopped with an error.' };
  return { ok: true, output: r.output };
}

export function checkAnswer(cfg: AnswerCfg, answer: string): AnswerResult {
  if (!answer.trim()) return { pass: false, message: 'Type your answer first.' };
  if (cfg.mode === 'value') {
    const pass = cfg.hashes.includes(answerHash(cfg.id, answer, cfg.ignoreCase));
    return { pass, message: pass ? 'Correct.' : cfg.code.trim() ? 'Not correct. Read the code again, line by line.' : 'Not correct. Try again.' };
  }
  if (cfg.mode === 'input') {
    const r = outputOf(cfg.code, answer);
    if (!r.ok) return { pass: false, message: `With that input the program stops: ${r.message}` };
    const pass = normalizeOutput(r.output) === normalizeOutput(cfg.expected);
    return { pass, message: pass ? 'Correct.' : `Not correct: with that input the program prints “${normalizeOutput(r.output)}”.` };
  }
  const r = outputOf(cfg.code, cfg.input);
  if (!r.ok) return { pass: false, message: 'This question cannot run. Tell your TA.' };
  const want = normalizeOutput(r.output).split('\n');
  const got = normalizeOutput(answer).split('\n');
  if (want.join('\n') === got.join('\n')) return { pass: true, message: 'Correct.' };
  if (want.length !== got.length) return { pass: false, message: `Not correct. The output has ${want.length} line${want.length === 1 ? '' : 's'}; you typed ${got.length}.` };
  const line = want.findIndex((w, i) => w !== got[i]) + 1;
  return { pass: false, message: want.length > 1 ? `Not correct. Check line ${line}.` : 'Not correct. Check every character: spaces count.' };
}
