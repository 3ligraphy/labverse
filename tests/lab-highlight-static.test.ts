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

test('JSON (app.json, eas.json): keys, text, numbers and true/false', () => {
  const [l] = highlightLines('    "buildType": "apk", "n": 1, "autoIncrement": true', 'json');
  assert.match(l, /<span class="tk-prop">"buildType"<\/span>/);
  assert.match(l, /<span class="tk-str">"apk"<\/span>/);
  assert.match(l, /<span class="tk-num">1<\/span>/);
  assert.match(l, /<span class="tk-num">true<\/span>/);
  assert.match(l, /<span class="tk-punc">:<\/span>/);
});

test('YAML (a Maestro flow): keys, list dashes, text, numbers, comments', () => {
  const lines = highlightLines('appId: host.exp.exponent\n---\n- tapOn: "Start scanning"  # tap it\n    timeout: 60000\n    optional: true\n- openLink: ${APP_URL}', 'yaml');
  assert.match(lines[0], /<span class="tk-prop">appId<\/span>/);
  assert.match(lines[1], /<span class="tk-punc">---<\/span>/);
  assert.match(lines[2], /<span class="tk-punc">- <\/span>/);
  assert.match(lines[2], /<span class="tk-fn">tapOn<\/span>/, 'a step’s command');
  assert.match(lines[2], /<span class="tk-str">"Start scanning"<\/span>/);
  assert.match(lines[2], /<span class="tk-com"># tap it<\/span>/);
  assert.match(lines[3], /<span class="tk-num">60000<\/span>/);
  assert.match(lines[4], /<span class="tk-num">true<\/span>/);
  assert.match(lines[5], /<span class="tk-var">\$\{APP_URL\}<\/span>/);
});

test('the text of every line is unchanged in every language', () => {
  const plain = (l: string) => l.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const json = '{\n  "cli": { "version": ">= 27.11.0" },\n  "submit": { "production": {} }\n}';
  const yaml = 'appId: host.exp.exponent\n---\n- tapOn:\n    text: "Allow camera" # the button\n    optional: true';
  assert.deepEqual(highlightLines(json, 'json').map(plain), json.split('\n'));
  assert.deepEqual(highlightLines(yaml, 'yaml').map(plain), yaml.split('\n'));
});

test('the text of every line is unchanged (only spans are added)', () => {
  const code = "export default function ScannerScreen({ onBack }: Props) {\n  const [permission, requestPermission] = useCameraPermissions();\n}";
  const plain = highlightLines(code).map((l) => l.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
  assert.deepEqual(plain, code.split('\n'));
});
