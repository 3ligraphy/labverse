// "Near enough" output passes with a warning: only the spacing may differ (an extra space, spaces next to punctuation
// or at a line end, an endl too many or too few at the end). A wrong value, word, letter case, tab or line still fails.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCppChecks } from '../src/lab/cpp/checks.ts';
import { gradeCpp } from '../src/lab/cpp/grade.ts';
import { checkAnswer } from '../src/lab/cpp/answer.ts';
import { nearLine } from '../src/lab/cpp/near.ts';

const program = (body: string) => `#include <iostream>\nusing namespace std;\nint main() {\n${body}\n    return 0;\n}\n`;
const prints = (text: string) => program(`    cout << ${JSON.stringify(text)};`);
const grade = (checks: string, code: string) => {
  const parsed = parseCppChecks(checks);
  assert.ok(parsed.ok);
  return gradeCpp(code, parsed.value).results[0];
};

test('nearLine: spacing only — words, numbers and tabs stay apart', () => {
  assert.equal(nearLine('the sum is:  8 '), nearLine('the sum is:8'));
  assert.notEqual(nearLine('1 2 3'), nearLine('123'));
  assert.notEqual(nearLine('Hello World'), nearLine('HelloWorld'));
  assert.notEqual(nearLine('Name\tAge'), nearLine('Name Age'));
  assert.equal(nearLine('Name \tAge'), nearLine('Name\tAge'));
});

test('expect: an extra or missing space next to punctuation passes with a warning', () => {
  const check = 'Sum :: expect the sum is: 8';
  const exact = grade(check, prints('the sum is: 8\n'));
  assert.equal(exact.pass, true);
  assert.equal(exact.warning, undefined);
  for (const near of ['the sum is:  8\n', 'the sum is:8\n', 'the  sum is : 8\n']) {
    const r = grade(check, prints(near));
    assert.equal(r.pass, true, near);
    assert.match(r.warning ?? '', /check the spaces/);
  }
});

test('expect: a wrong value, word, letter case or missing punctuation still fails', () => {
  const check = 'Sum :: expect the sum is: 8';
  for (const wrong of ['the sum is: 9\n', 'the sum is 8\n', 'The sum is: 8\n', 'the sum: 8\n', 'thesum is: 8\n', 'the sum is: 88\n']) {
    const r = grade(check, prints(wrong));
    assert.equal(r.pass, false, wrong);
  }
});

test('expect: a number is matched whole, so a wrong value that starts or ends with the right digits fails', () => {
  for (const [check, wrong] of [['N :: expect 8', '88\n'], ['N :: expect 8', '-8\n'], ['N :: expect 8', '8.5\n'], ['N :: expect 2.5', '12.5\n'], ['N :: expect is: 8', 'is: 81\n']]) {
    assert.equal(grade(check, prints(wrong)).pass, false, `${check} / ${JSON.stringify(wrong)}`);
  }
  for (const [check, right] of [['N :: expect 8', 'x = 8\n'], ['N :: expect 8', 'Total: 8.\n'], ['N :: expect 2.5', 'avg 2.5\n']]) {
    assert.equal(grade(check, prints(right)).pass, true, `${check} / ${JSON.stringify(right)}`);
  }
});

test('exact: an endl too many or too few at the end, or spaces at a line end, pass with a warning', () => {
  const check = 'Two lines :: exact Hello\\nWorld\\n';
  assert.equal(grade(check, prints('Hello\nWorld\n')).warning, undefined);
  const missing = grade(check, prints('Hello\nWorld'));
  assert.equal(missing.pass, true);
  assert.match(missing.warning ?? '', /should end with a new line/);
  const extra = grade(check, prints('Hello\nWorld\n\n'));
  assert.equal(extra.pass, true);
  assert.match(extra.warning ?? '', /extra empty line/);
  const spaces = grade(check, prints('Hello \nWorld\n'));
  assert.equal(spaces.pass, true);
  assert.match(spaces.warning ?? '', /spaces at the end of a line/);
  const inside = grade(check, prints('Hello\n World\n'));
  assert.equal(inside.pass, true);
  assert.match(inside.warning ?? '', /line 2/);
});

test('exact: a missing or extra line break in the middle, or other text, still fails', () => {
  const check = 'Two lines :: exact Hello\\nWorld\\n';
  for (const wrong of ['HelloWorld\n', 'Hello World\n', 'Hello\n\nWorld\n', 'Hello\nworld\n', '\nHello\nWorld\n']) {
    assert.equal(grade(check, prints(wrong)).pass, false, JSON.stringify(wrong));
  }
});

test('a tab is not a space, and syntax errors and wrong logic still fail', () => {
  assert.equal(grade('Tab :: expect Name\\tAge', prints('Name Age\n')).pass, false);
  assert.equal(grade('Tab :: expect Name\\tAge', prints('Name\t Age\n')).pass, true);
  // a build error is never near enough
  assert.equal(gradeCpp(program('    cout << "the sum is: 8"'), (parseCppChecks('Sum :: expect the sum is: 8') as any).value).compileError !== undefined, true);
  // the input decides: printing the same text for every input fails the check that expects something else
  const evenOdd = 'Even :: in 4; expect even\nOdd :: in 3; expect odd';
  const always = program('    int n; cin >> n;\n    cout << "even\\n";');
  const parsed = parseCppChecks(evenOdd);
  assert.ok(parsed.ok);
  assert.deepEqual(gradeCpp(always, parsed.value).results.map((r) => r.pass), [true, false]);
});

test('typed "what does it print": spacing passes with a warning that shows the real output', () => {
  const cfg = (code: string) => ({ id: 'q', mode: 'output' as const, code, input: '', hashes: [], expected: '' });
  const total = cfg('int x = 8;\ncout << "Total: " << x;');
  const near = checkAnswer(total, 'Total:8');
  assert.equal(near.pass, true);
  assert.match(near.warning ?? '', /“Total: 8”/);
  assert.equal(checkAnswer(total, 'Total: 8').warning, undefined);
  assert.equal(checkAnswer(total, 'Total: 9').pass, false);
  assert.equal(checkAnswer(total, 'total: 8').pass, false);
  const lines = cfg('cout << "Hello" << endl;\ncout << "World";');
  assert.equal(checkAnswer(lines, 'HelloWorld').pass, false);
  assert.equal(checkAnswer(lines, 'Hello World').pass, false);
  const two = checkAnswer(lines, 'Hello\n World ');
  assert.equal(two.pass, true);
  assert.match(two.warning ?? '', /line 2/);
});
