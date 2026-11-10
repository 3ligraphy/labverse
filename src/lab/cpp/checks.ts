/**
 * Checks for C++ exercises, written by staff in the lab builder, one per line:
 *   Product of 3 and 5 :: in 3 5; expect the product is: 15
 *   Says goodbye       :: in 1 1; expect Goodbye
 *   Uses cin           :: code /cin\s*>>/ Read the numbers with cin >>
 * Steps: in <keyboard input> (\n = Enter), expect <text>, exact <whole output>, not <text>,
 *        code /regex/ message, nocode /regex/ message.
 * A check passes when the program compiles, runs to the end and every step holds.
 */
export type CppStep =
  | { in: string }
  | { expect: string }
  | { exact: string }
  | { not: string }
  | { code: string; flags?: string; message: string; negate?: boolean };
export type CppCheck = { name: string; steps: CppStep[] };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const unescape = (s: string) => s.replace(/\\n/g, '\n').replace(/\\t/g, '\t');

export function parseCppChecks(text: string): Result<CppCheck[]> {
  const checks: CppCheck[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  for (const [i, line] of lines.entries()) {
    const at = line.indexOf('::');
    if (at < 1) return { ok: false, error: `Check line ${i + 1} needs “name :: steps”.` };
    const name = line.slice(0, at).trim();
    const steps: CppStep[] = [];
    // split on ; that are not inside /regex/
    const parts: string[] = [];
    let cur = '';
    let inRe = false;
    const body = line.slice(at + 2);
    for (let j = 0; j < body.length; j++) {
      const c = body[j];
      if (c === '/' && body[j - 1] !== '\\' && /(?:^|\s)(?:no)?code\s+$/.test(cur)) inRe = true;
      else if (c === '/' && inRe && body[j - 1] !== '\\') inRe = false;
      if (c === ';' && !inRe) { parts.push(cur); cur = ''; continue; }
      cur += c;
    }
    parts.push(cur);
    for (const raw of parts.map((p) => p.trim()).filter(Boolean)) {
      let m: RegExpMatchArray | null;
      if ((m = raw.match(/^in\s+(.*)$/i))) steps.push({ in: unescape(m[1]) });
      else if ((m = raw.match(/^expect\s+exact\s+(.+)$/i)) || (m = raw.match(/^exact\s+(.+)$/i))) steps.push({ exact: unescape(m[1]) });
      else if ((m = raw.match(/^expect\s+(.+)$/i))) steps.push({ expect: unescape(m[1]) });
      else if ((m = raw.match(/^not\s+(.+)$/i))) steps.push({ not: unescape(m[1]) });
      else if ((m = raw.match(/^(no)?code\s+\/(.+)\/([gimsuy]*)\s*(.*)$/i))) {
        try { new RegExp(m[2], m[3]); } catch { return { ok: false, error: `Check “${name}”: the regex /${m[2]}/ is not valid.` }; }
        steps.push({ code: m[2], flags: m[3] || undefined, message: m[4].trim() || (m[1] ? `Your code should not match /${m[2]}/` : `Your code should match /${m[2]}/`), negate: Boolean(m[1]) });
      } else return { ok: false, error: `Check “${name}”: don’t understand “${raw}”.` };
    }
    if (!steps.length) return { ok: false, error: `Check “${name}” has no steps.` };
    checks.push({ name, steps });
  }
  return { ok: true, value: checks };
}
