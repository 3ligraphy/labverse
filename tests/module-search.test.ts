import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Window } from 'happy-dom';
import { moduleSearchItems } from '../src/lib/platform/search.ts';
import { compileLab } from '../src/lib/platform/core.ts';
import { psychologyTechnologyLab01 } from '../src/lib/platform/seeds/psychology-technology-lab-01.ts';

test('module search links every section, lab, task and setup step to the current module', () => {
  const slug = 'technology-for-psychology';
  const compiled = compileLab(psychologyTechnologyLab01(), `${slug}--lab-01`);
  const items = moduleSearchItems(slug, 'Technology for Psychology', [{ slug: 'lab-01', compiled }]);
  assert.ok(items.every((item) => item.u.startsWith(`/m/${slug}`)));
  assert.ok(items.some((item) => item.u.endsWith('#task-1-1')));
  assert.ok(items.some((item) => item.u.includes('?tab=setup#setup-')));
  assert.ok(items.some((item) => item.t === 'Project'));
  const other = moduleSearchItems('other-course', 'Other course', []);
  assert.ok(other.every((item) => item.u.startsWith('/m/other-course')));
  assert.ok(!other.some((item) => item.k === 'Setup'));
  assert.ok(moduleSearchItems(slug, 'Preview', [{ slug: 'lab-01', compiled }], true).every((item) => item.u.includes('preview')));
});

test('palette switches indexes on client navigation and ignores late results from the previous course', async () => {
  const result = await build({ entryPoints: ['src/scripts/search.ts'], bundle: true, write: false, format: 'iife', globalName: 'SearchClient' });
  const window = new Window();
  const pending = new Map<string, (response: unknown) => void>();
  Object.assign(window, {
    fetch: (url: string) => new Promise((resolve) => pending.set(url, resolve)),
    requestIdleCallback: () => 0,
  });
  const mount = (url: string) => {
    window.document.body.innerHTML = `<main></main><div data-search data-search-index="${url}" hidden><input data-search-input><div data-search-filters></div><div data-search-results></div></div>`;
  };
  const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  try {
    mount('/search-index.json');
    window.eval(`${result.outputFiles[0].text}\nwindow.SearchClient = SearchClient;`);
    const client = (window as unknown as { SearchClient: { initSearch(): void; openSearch(): void } }).SearchClient;
    client.initSearch();
    client.openSearch();
    mount('/api/search?module=psychology');
    window.document.dispatchEvent(new window.Event('astro:page-load'));
    client.openSearch();
    pending.get('/api/search?module=psychology')!({ ok: true, json: async () => [{ k: 'Page', t: 'Psychology setup', d: '', u: '/m/psychology?tab=setup' }] });
    await settle();
    pending.get('/search-index.json')!({ ok: true, json: async () => [{ k: 'Page', t: 'Mobile setup', d: '', u: '/setup' }] });
    await settle();
    assert.equal(window.document.querySelector('.sp-item')?.getAttribute('href'), '/m/psychology?tab=setup');
    assert.ok(!window.document.body.textContent.includes('Mobile setup'));
    mount('/api/search?module=another-course');
    window.document.dispatchEvent(new window.Event('astro:page-load'));
    client.openSearch();
    assert.equal(window.document.querySelector('.sp-item'), null, 'previous module results clear immediately');
    pending.get('/api/search?module=another-course')!({ ok: false });
    await settle();
    assert.match(window.document.querySelector('[data-search-results]')!.textContent, /unavailable/);
    assert.equal(window.document.querySelector('.sp-item'), null, 'failure never falls back to Mobile Development');
  } finally { await window.happyDOM.close(); }
});
