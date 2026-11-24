// Coloured code for the lab's explanations (CodeTour, the step-through animations): built on the server, one HTML
// string per line, with the same colours as the editor (tk-* classes read the --cm-* colours of the theme).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { highlightLines } from '../src/lab/ui/highlight-static.ts';

test('keywords, strings, comments, functions and JSX tags get their colour class', () => {
  const [line] = highlightLines("const a = useCameraPermissions('x'); // hi");
  assert.match(line, /<span class="tk-kw">const<\/span>/);
  assert.match(line, /<span class="tk-str">'x'<\/span>/);
  assert.match(line, /<span class="tk-com">\/\/ hi<\/span>/);
  assert.match(line, /<span class="tk-fn">useCameraPermissions<\/span>/);
  const [jsx] = highlightLines('return <Text style={styles.text}>Hi</Text>;');
  assert.match(jsx, /<span class="tk-tag">Text<\/span>/);
  assert.match(jsx, /<span class="tk-attr">style<\/span>/);
});

test('one HTML string per line, blank lines kept, text escaped', () => {
  const lines = highlightLines("if (a < b) {\n\n  return '<b>';\n}");
  assert.equal(lines.length, 4);
  assert.equal(lines[1], '');
  assert.ok(!/<b>/.test(lines[2]), 'no raw HTML from the code');
  assert.match(lines[2], /&lt;b&gt;/);
  assert.match(lines[0], /&lt;/);
});

test('the text of every line is unchanged (only spans are added)', () => {
  const code = "export default function ScannerScreen({ onBack }: Props) {\n  const [permission, requestPermission] = useCameraPermissions();\n}";
  const plain = highlightLines(code).map((l) => l.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
  assert.deepEqual(plain, code.split('\n'));
});
