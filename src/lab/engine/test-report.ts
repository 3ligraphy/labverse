/**
 * Lab 07: prints a test run (src/lab/runtime/testing.ts) the way `npm test` prints it in a terminal — PASS / FAIL per
 * file, ✓ / ✕ per test, then each failure with its message and the lines of the test around it, then the summary.
 * Lines carry a tone so the page can colour them like a terminal.
 */
import type { TestFileResult, TestRun, TestWhere } from '../runtime/protocol.ts';

export type Tone = 'pass' | 'fail' | 'dim' | 'head' | 'warn' | '';
export type Line = { text: string; tone: Tone };

const MAX_LOGS = 4;

/** The lines of a file around `where`, Jest style: "  28 |" and "> 29 |", a caret under the column. */
export function codeFrame(source: string | undefined, where: TestWhere): string[] {
  if (!source) return [];
  const lines = source.split('\n');
  const width = String(Math.min(lines.length, where.line + 1)).length;
  const out: string[] = [];
  for (let n = Math.max(1, where.line - 2); n <= Math.min(lines.length, where.line + 1); n++) {
    out.push(`${n === where.line ? '>' : ' '} ${String(n).padStart(width)} | ${lines[n - 1]}`);
    if (n === where.line && where.column > 0) out.push(`  ${' '.repeat(width)} | ${' '.repeat(Math.max(0, where.column - 1))}^`);
  }
  return out;
}

const counts = (r: TestRun) => {
  const tests = r.files.flatMap((f) => f.tests);
  return {
    failedFiles: r.files.filter((f) => f.error || f.tests.some((t) => t.status === 'failed')).length,
    files: r.files.length,
    passed: tests.filter((t) => t.status === 'passed').length,
    failed: tests.filter((t) => t.status === 'failed').length,
    skipped: tests.filter((t) => t.status === 'skipped').length,
    todo: tests.filter((t) => t.status === 'todo').length,
    total: tests.length,
  };
};

export const runPassed = (r: TestRun) => r.files.length > 0 && counts(r).failedFiles === 0;

function fileLines(f: TestFileResult, sources: Record<string, string>): Line[] {
  const failedHere = !!f.error || f.tests.some((t) => t.status === 'failed');
  const out: Line[] = [{ text: `${failedHere ? 'FAIL' : 'PASS'} ${f.file}`, tone: failedHere ? 'fail' : 'pass' }];
  if (f.error) {
    out.push({ text: '  ● Test suite failed to run', tone: 'fail' }, { text: '', tone: '' });
    for (const l of f.error.message.split('\n')) out.push({ text: `    ${l}`, tone: '' });
    if (f.error.where) for (const l of codeFrame(sources[f.error.where.file], f.error.where)) out.push({ text: `      ${l}`, tone: 'dim' });
    return out;
  }
  // the tests, grouped by describe block (as `jest --verbose` shows them)
  let shown: string[] = [];
  for (const t of f.tests) {
    let same = 0;
    while (same < shown.length && same < t.path.length && shown[same] === t.path[same]) same++;
    for (let i = same; i < t.path.length; i++) out.push({ text: `${'  '.repeat(i + 1)}${t.path[i]}`, tone: 'head' });
    shown = t.path;
    const pad = '  '.repeat(t.path.length + 1);
    const ms = t.ms >= 1 ? ` (${t.ms} ms)` : '';
    if (t.status === 'passed') out.push({ text: `${pad}✓ ${t.name}${ms}`, tone: 'pass' });
    else if (t.status === 'failed') out.push({ text: `${pad}✕ ${t.name}${ms}`, tone: 'fail' });
    else if (t.status === 'todo') out.push({ text: `${pad}✎ todo ${t.name}`, tone: 'warn' });
    else out.push({ text: `${pad}○ skipped ${t.name}`, tone: 'dim' });
  }
  for (const t of f.tests.filter((x) => x.status === 'failed' && x.error)) {
    out.push({ text: '', tone: '' }, { text: `  ● ${[...t.path, t.name].join(' › ')}`, tone: 'fail' }, { text: '', tone: '' });
    for (const l of t.error!.message.split('\n')) out.push({ text: `    ${l}`, tone: l.startsWith('- ') ? 'pass' : l.startsWith('+ ') ? 'fail' : '' });
    const where = t.error!.where;
    if (where) {
      const frame = codeFrame(sources[where.file], where);
      if (frame.length) out.push({ text: '', tone: '' }, ...frame.map((l) => ({ text: `      ${l}`, tone: 'dim' as Tone })));
      out.push({ text: '', tone: '' }, { text: `      at ${where.file}:${where.line}:${where.column}`, tone: 'dim' });
    }
  }
  const logs = f.logs;
  if (logs.length) {
    out.push({ text: '', tone: '' });
    for (const l of logs.slice(0, MAX_LOGS)) {
      out.push({ text: `  console.${l.level}`, tone: 'dim' }, ...l.text.split('\n').map((x) => ({ text: `    ${x}`, tone: '' as Tone })));
      if (l.where) out.push({ text: `      at ${l.where.file}:${l.where.line}`, tone: 'dim' });
    }
    if (logs.length > MAX_LOGS) out.push({ text: `  … and ${logs.length - MAX_LOGS} more console lines`, tone: 'dim' });
  }
  return out;
}

/** The whole run as terminal lines, ending with Jest's summary (Test Suites, Tests, Time). */
export function formatRun(r: TestRun, sources: Record<string, string>): Line[] {
  if (!r.files.length) return [{ text: 'No tests found. Test files are in __tests__/ or end in -test.ts / .test.tsx.', tone: 'warn' }];
  const out: Line[] = [];
  for (const f of r.files) out.push(...fileLines(f, sources), { text: '', tone: '' });
  const c = counts(r);
  const part = (n: number, word: string, tone: Tone) => (n ? [{ n, word, tone }] : []);
  const suites = [...part(c.failedFiles, 'failed', 'fail'), ...part(c.files - c.failedFiles, 'passed', 'pass')];
  const tests = [...part(c.failed, 'failed', 'fail'), ...part(c.skipped, 'skipped', 'dim'), ...part(c.todo, 'todo', 'warn'), ...part(c.passed, 'passed', 'pass')];
  out.push(
    { text: `Test Suites: ${suites.map((s) => `${s.n} ${s.word}`).join(', ')}, ${c.files} total`, tone: c.failedFiles ? 'fail' : 'pass' },
    { text: `Tests:       ${tests.map((s) => `${s.n} ${s.word}`).join(', ')}${tests.length ? ', ' : ''}${c.total} total`, tone: c.failed ? 'fail' : 'pass' },
    { text: `Time:        ${(Math.max(r.ms, 1) / 1000).toFixed(3)} s`, tone: 'dim' },
  );
  return out;
}

/** The summary line alone ("Tests: 1 failed, 11 passed, 12 total"), for check messages. */
export function summaryLine(r: TestRun): string {
  const c = counts(r);
  return `${c.failed ? `${c.failed} failed, ` : ''}${c.passed} passed, ${c.total} total`;
}
