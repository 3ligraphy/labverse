// Builder lab text is plain Markdown: no raw HTML, no script links (src/plugins/remark-safe-builder.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdown } from '../src/lib/platform/render.ts';
import { unsafeUrl } from '../src/plugins/remark-safe-builder.mjs';

test('raw HTML in builder text is removed', async () => {
  const html = await markdown('Hello <img src=x onerror="alert(1)"> world\n\n<script>alert(2)</script>\n\n<div onclick="x()">block</div>');
  assert.doesNotMatch(html, /<script|onerror|onclick|<img|<div/i);
  assert.match(html, /Hello/);
  assert.match(html, /world/);
});

test('script and data links point nowhere; normal links are kept', async () => {
  const html = await markdown('[a](javascript:alert(1)) [b]( JaVa\tScRiPt:alert(1)) ![c](data:text/html,x) [d][ref]\n\n[ref]: vbscript:msgbox\n\n[ok](https://reactnative.dev) [mail](mailto:ta@bue.edu.eg) [rel](/m/web/lab-02) [anchor](#part-1)');
  assert.doesNotMatch(html, /javascript:|vbscript:|data:text/i);
  for (const href of ['https://reactnative.dev', 'mailto:ta@bue.edu.eg', '/m/web/lab-02', '#part-1']) assert.match(html, new RegExp(`href="${href}"`));
  assert.equal(unsafeUrl('java\nscript:alert(1)'), true);
  assert.equal(unsafeUrl('lab-02'), false, 'relative links have no scheme');
});

test('code blocks and callouts still render', async () => {
  const code = await markdown('```tsx title="App.tsx"\nconst a = <View />;\n```');
  assert.match(code, /data-title="App.tsx"/);
  assert.match(code, /&#x3C;/, 'the < of JSX inside code is kept as text');
  assert.match(code, />View</);
  const callout = await markdown('> [!tip]\n> Save first.');
  assert.match(callout, /Save first/);
});
