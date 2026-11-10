// AI FOR CODING — the module rubric is a tab of its own, found by the site search section by section.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { AI_FOR_CODING_MODULE, moduleSectionHref, moduleSections } from '../src/lib/platform/module-sections.ts';
import { moduleSearchItems } from '../src/lib/platform/search.ts';

const rubric = readFileSync(new URL('../src/content/data/ai-for-coding-rubric.md', import.meta.url), 'utf8');

test('AI FOR CODING has a Rubric tab; other modules do not', () => {
  assert.deepEqual(moduleSections(AI_FOR_CODING_MODULE), ['Overview', 'Labs', 'Rubric']);
  assert.ok(!moduleSections('intro-to-computing').includes('Rubric'));
  assert.equal(moduleSectionHref(AI_FOR_CODING_MODULE, 'Rubric'), '/ai-for-coding?tab=rubric');
});

test('the rubric text has every section, weights adding up to 100, the diagram marker, and a PDF copy', () => {
  const headings = [...rubric.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(headings, ['Module at a glance', 'Learning outcomes', 'The capstone system', 'How the agents work together',
    'Day-by-day plan', 'Marking rubric', 'Deliverables and checkpoints', 'AI use and integrity rules']);
  assert.equal(rubric.split('{{diagram}}').length, 2, 'one diagram marker');
  const table = rubric.slice(rubric.indexOf('## Marking rubric'), rubric.indexOf('## Deliverables'));
  const weights = [...table.matchAll(/^\| \d \| [^|]+ \| (\d+) \|/gm)].map((m) => Number(m[1]));
  assert.equal(weights.length, 9);
  assert.equal(weights.reduce((a, b) => a + b, 0), 100);
  assert.ok(existsSync(new URL('../public/downloads/ai-for-coding-rubric.pdf', import.meta.url)));
});

test('search finds each rubric section on the Rubric tab', () => {
  const items = moduleSearchItems(AI_FOR_CODING_MODULE, 'AI FOR CODING', []);
  assert.ok(items.some((i) => i.k === 'Page' && i.t === 'Rubric' && i.u === '/ai-for-coding?tab=rubric'));
  const viva = items.find((i) => i.k === 'Rubric' && i.t === 'Marking rubric');
  assert.ok(viva && /viva/i.test(viva.s ?? ''));
  assert.equal(viva.u, '/ai-for-coding?tab=rubric#marking-rubric');
  assert.equal(items.filter((i) => i.k === 'Rubric').length, 8);
  assert.ok(!moduleSearchItems('intro-to-computing', 'Intro', []).some((i) => i.k === 'Rubric'));
});
