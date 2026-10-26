import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { downloadZip } from 'client-zip';
import { readDocText } from '../src/scripts/doc-text.ts';
import { cleanPlan, extractIdeas } from '../src/lib/project-files/groups.ts';

GlobalRegistrator.register({ url: 'http://localhost/' });

test('ZIP scanning reads every document and preserves more than twelve ideas when saved', async () => {
  const files = await Promise.all(Array.from({ length: 14 }, async (_, i) => ({
    name: `proposal-${i}.docx`,
    input: await downloadZip([{ name: 'word/document.xml', input: `<w:document xmlns:w="urn:word"><w:body><w:p><w:r><w:t>Idea 1: Campus Tool ${i}</w:t></w:r></w:p></w:body></w:document>` }]).arrayBuffer(),
  })));
  const bytes = await downloadZip(files).arrayBuffer();
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(bytes);
  try {
    const result = await readDocText('http://localhost/proposals.zip');
    assert.ok('lines' in result);
    const ideas = extractIdeas(result.lines);
    assert.equal(ideas.length, 14);
    assert.equal(cleanPlan({ scans: { entry: { updatedAt: 'today', ids: [], ideas } } }).scans.entry.ideas.length, 14);
  } finally { globalThis.fetch = original; }
});

test('unreadable files inside ZIP submissions are reported instead of silently skipped', async () => {
  const bytes = await downloadZip([{ name: 'broken.docx', input: 'not a Word file' }]).arrayBuffer();
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(bytes);
  try {
    const result = await readDocText('http://localhost/proposals.zip');
    assert.ok('error' in result);
  } finally { globalThis.fetch = original; }
});
