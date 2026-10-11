// In-browser file preview helpers (src/scripts/file-preview.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register({ url: 'http://localhost/', width: 1280, height: 800 });
const { documentView, downloadUrl, extOf, fileNameOf, kindOf } = await import('../src/scripts/file-preview.ts');

test('every hand-in type maps to a viewer; anything else falls back to download', () => {
  assert.equal(kindOf('Proposal.PDF'), 'pdf');
  assert.equal(kindOf('screen.jpeg'), 'image');
  assert.equal(kindOf('report.docx'), 'docx');
  assert.equal(kindOf('deck.pptx'), 'pptx');
  assert.equal(kindOf('team-7.zip'), 'zip');
  assert.equal(kindOf('app.apk'), 'other');
  assert.equal(extOf('https://x.public.blob.vercel-storage.com/submissions/a/b.pdf?v=2'), 'pdf');
});

test('the file name comes from the item, else the URL path', () => {
  assert.equal(fileNameOf({ fileName: 'Mine.docx', url: 'https://x/y.pdf' }), 'Mine.docx');
  assert.equal(fileNameOf({ url: 'https://abc.public.blob.vercel-storage.com/submissions/p1/Team%207%20proposal.pdf' }), 'Team 7 proposal.pdf');
});

test('Vercel Blob files download as attachments; other links are left alone', () => {
  assert.equal(downloadUrl('https://abc.public.blob.vercel-storage.com/a/b.pdf'), 'https://abc.public.blob.vercel-storage.com/a/b.pdf?download=1');
  assert.equal(downloadUrl('https://example.com/brief.pdf'), 'https://example.com/brief.pdf');
});

test('Word and PowerPoint text shows slides as headings, rows as tables and bullets as lists', () => {
  const doc = documentView(['§ Slide 1', 'App idea', '• Track habits', '• Remind daily', 'Name | ID | Role', 'Mariam | 236541 | Lead'], 'pptx');
  assert.equal(doc.querySelector('h3')?.textContent, 'Slide 1');
  assert.equal(doc.querySelectorAll('li').length, 2);
  assert.equal(doc.querySelectorAll('tr').length, 2, 'consecutive rows share one table');
  assert.equal(doc.querySelectorAll('td')[4]?.textContent, '236541');
  assert.match(doc.querySelector('.fp-note')?.textContent ?? '', /PowerPoint/);
  const empty = documentView([], 'docx');
  assert.match(empty.textContent ?? '', /no readable text/);
});
