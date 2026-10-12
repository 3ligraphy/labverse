// The no-code web lab components: compiling their nodes, the URL / quiz helpers, and the web helpers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';
import { ensureSyntaxTree } from '@codemirror/language';
import { compileLab, parseQuizOptions, safeUrl, videoEmbed, type Block, type Flow } from '../src/lib/platform/core.ts';
import { assistantLink, hostOf, pageDoc, promptParts, stripFences, watchUrl } from '../src/lib/platform/web.ts';
import { htmlCss } from '../src/scripts/web-editor.ts';

const n = (id: string, type: string, data: Record<string, string>) => ({ id, type, x: 0, y: 0, data });
const chain = (...nodes: ReturnType<typeof n>[]): Flow => ({
  nodes: [n('root', 'start', { title: 'Clinic website' }), ...nodes],
  edges: nodes.map((x, i) => ({ from: i ? nodes[i - 1].id : 'root', to: x.id })),
});
type Of<K extends Block['kind']> = Extract<Block, { kind: K }>;

test('compileLab turns every web-lab node into its block, inside the current task', () => {
  const c = compileLab(chain(
    n('t', 'task', { title: 'Plan the homepage' }),
    n('im', 'image', { src: 'https://example.com/a.png', alt: 'The editor', caption: 'Editor' }),
    n('vi', 'video', { url: 'https://youtu.be/dQw4w9WgXcQ', title: 'Intro' }),
    n('li', 'link', { title: 'WordPress', url: 'https://wordpress.com', description: 'Sign up', cta: '' }),
    n('q', 'quiz', { question: 'Which?', options: '*Right\nWrong', explain: 'Because.' }),
    n('pr', 'prompt', { title: '', tool: 'ChatGPT', prompt: 'Write about [topic]', expect: 'A paragraph' }),
    n('br', 'browser', { title: 'Home', url: 'clinic.com', html: '<h1>Hi</h1>', height: 'Huge', caption: '' }),
    n('ws', 'websandbox', { title: '', goal: 'Run it', hint: '', starter: '<p>x</p>' }),
    n('cp', 'clickpath', { title: 'Open', steps: 'Dashboard\n\n Appearance \nEditor' }),
  ), 'psy--lab-01');
  assert.deepEqual(c.warnings, []);
  assert.deepEqual(c.blocks.map((b) => b.kind), ['part', 'task']);
  const kids = (c.blocks[1] as Of<'task'>).children;
  assert.deepEqual(kids.map((b) => b.kind), ['image', 'video', 'link', 'quiz', 'prompt', 'browser', 'websandbox', 'clickpath']);
  const [im, vi, li, q, pr, br, ws, cp] = kids as [Of<'image'>, Of<'video'>, Of<'link'>, Of<'quiz'>, Of<'prompt'>, Of<'browser'>, Of<'websandbox'>, Of<'clickpath'>];
  assert.equal(im.src, 'https://example.com/a.png');
  assert.equal(vi.embed, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  assert.equal(li.url, 'https://wordpress.com/');
  assert.equal(li.cta, 'Open', 'an empty button label falls back to Open');
  assert.equal(q.id, 'psy--lab-01--q');
  assert.deepEqual(q.options, [{ text: 'Right', correct: true }, { text: 'Wrong', correct: false }]);
  assert.equal(pr.title, 'Ask the AI');
  assert.equal(pr.tool, 'ChatGPT');
  assert.equal(br.height, 'Medium', 'an unknown height falls back to Medium');
  assert.equal(ws.title, 'Web sandbox');
  assert.equal(ws.id, 'psy--lab-01--ws');
  assert.deepEqual(cp.steps, ['Dashboard', 'Appearance', 'Editor']);
});

test('compileLab skips broken web-lab nodes with a warning the builder can show', () => {
  const c = compileLab(chain(
    n('im', 'image', { src: 'http://example.com/a.png', alt: '' }),
    n('im2', 'image', { src: 'https://example.com/b.png', alt: '' }),
    n('vi', 'video', { url: 'https://example.com/video.mp4', title: 'Clip' }),
    n('li', 'link', { title: 'Bad', url: 'javascript:alert(1)' }),
    n('q', 'quiz', { question: 'No answer marked', options: 'A\nB' }),
    n('q2', 'quiz', { question: 'One option', options: '*A' }),
    n('pr', 'prompt', { title: 'Empty', prompt: '   ' }),
    n('cp', 'clickpath', { steps: '\n\n' }),
  ), 'm--l');
  assert.deepEqual(c.blocks.map((b) => b.kind), ['image'], 'only the https image with missing alt text is kept');
  assert.equal(c.warnings.length, 7);
  assert.ok(c.warnings.some((w) => w.includes('no alt text')));
  assert.ok(c.warnings.some((w) => w.includes('YouTube or Vimeo')));
  assert.ok(c.warnings.some((w) => w.includes('Quick check “No answer marked”')));
});

test('safeUrl only lets https through', () => {
  assert.equal(safeUrl('https://wordpress.com/start'), 'https://wordpress.com/start');
  assert.equal(safeUrl('  https://a.com  '), 'https://a.com/');
  assert.equal(safeUrl('http://a.com'), null);
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('data:text/html,hi'), null);
  assert.equal(safeUrl('wordpress.com'), null);
  assert.equal(safeUrl('https://'), null);
  assert.equal(safeUrl(undefined), null);
});

test('videoEmbed understands YouTube and Vimeo links and rejects everything else', () => {
  const yt = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ';
  assert.equal(videoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s'), yt);
  assert.equal(videoEmbed('https://m.youtube.com/watch?v=dQw4w9WgXcQ'), yt);
  assert.equal(videoEmbed('https://youtu.be/dQw4w9WgXcQ?si=abc'), yt);
  assert.equal(videoEmbed('https://youtube.com/shorts/dQw4w9WgXcQ'), yt);
  assert.equal(videoEmbed('https://www.youtube.com/embed/dQw4w9WgXcQ'), yt);
  assert.equal(videoEmbed('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'), yt);
  assert.equal(videoEmbed('https://vimeo.com/76979871'), 'https://player.vimeo.com/video/76979871');
  assert.equal(videoEmbed('https://player.vimeo.com/video/76979871?h=x'), 'https://player.vimeo.com/video/76979871');
  assert.equal(videoEmbed('http://youtu.be/dQw4w9WgXcQ'), null, 'http is refused');
  assert.equal(videoEmbed('https://youtube.com/watch?v=bad"id<script>'), null);
  assert.equal(videoEmbed('https://evil.com/youtube.com/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(videoEmbed('https://vimeo.com/channels/staffpicks'), null);
  assert.equal(videoEmbed(''), null);
});

test('parseQuizOptions: one per line, * marks correct ones, blanks and empty options dropped, max 8', () => {
  assert.deepEqual(parseQuizOptions('*Yes\r\n\n  No  \n* Also yes'), [
    { text: 'Yes', correct: true }, { text: 'No', correct: false }, { text: 'Also yes', correct: true },
  ]);
  assert.deepEqual(parseQuizOptions('*\nA\n*  \nB'), [{ text: 'A', correct: false }, { text: 'B', correct: false }], 'a lone * is not an option');
  assert.equal(parseQuizOptions(Array.from({ length: 12 }, (_, i) => `o${i}`).join('\n')).length, 8);
  assert.deepEqual(parseQuizOptions(''), []);
});

test('web helpers: page documents, code fences, placeholders, assistant links', () => {
  assert.match(pageDoc('<h1>Hi</h1>'), /^<!doctype html>\n<meta charset="utf-8">[\s\S]*<h1>Hi<\/h1>$/);
  assert.equal(pageDoc('  <!DOCTYPE html><html></html>'), '<!DOCTYPE html><html></html>');

  assert.deepEqual(stripFences('```html\n<h1>Hi</h1>\n```'), { code: '<h1>Hi</h1>', stripped: true });
  assert.deepEqual(stripFences('Here is your code:\n\n```html\n<p>x</p>\n```\nEnjoy!'), { code: '<p>x</p>', stripped: true });
  assert.deepEqual(stripFences('<p>no fences</p>'), { code: '<p>no fences</p>', stripped: false });

  assert.deepEqual(promptParts('Write for [clinic name] in [city].'), [
    { text: 'Write for ', slot: false }, { text: '[clinic name]', slot: true }, { text: ' in ', slot: false },
    { text: '[city]', slot: true }, { text: '.', slot: false },
  ]);
  assert.deepEqual(promptParts('See [docs](https://x.com)'), [{ text: 'See [docs](https://x.com)', slot: false }], 'Markdown links are not placeholders');

  assert.equal(assistantLink('ChatGPT', 'Hi & bye?')?.href, 'https://chatgpt.com/?q=Hi%20%26%20bye%3F');
  assert.equal(assistantLink('Claude', 'Hi')?.href, 'https://claude.ai/new?q=Hi');
  assert.equal(assistantLink('Gemini', 'Hi'), null);
  assert.equal(assistantLink('Any AI assistant', 'Hi'), null);

  assert.equal(watchUrl('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(watchUrl('https://player.vimeo.com/video/76979871'), 'https://vimeo.com/76979871');
  assert.equal(hostOf('https://www.wordpress.com/start'), 'wordpress.com');
});

test('the sandbox highlighter tokenizes HTML, <style> CSS and <script> without getting stuck', () => {
  const doc = '<!doctype html>\n<style>\n  /* c */ .box, h1 { color: #0a7; margin: 2rem; }\n</style>\n<!-- note -->\n<div class="box">Hi &amp; bye</div>\n<script>const a = "x"; go(1)</script>\n<p>unclosed <b';
  const state = EditorState.create({ doc, extensions: [htmlCss] });
  const tree = ensureSyntaxTree(state, state.doc.length, 2000);
  assert.ok(tree && tree.length === doc.length, 'the whole document is parsed');
  const names = new Set<string>();
  tree!.iterate({ enter: (node) => { names.add(node.name); } });
  for (const kind of ['tagName', 'attributeName', 'string', 'comment', 'className', 'propertyName', 'number', 'meta', 'keyword']) assert.ok(names.has(kind), kind);
});
