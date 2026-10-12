import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionProgress } from '../src/lib/session-progress.ts';
import { moduleSectionHref, moduleSections } from '../src/lib/platform/module-sections.ts';

test('session progress counts only unique current tasks', () => {
  assert.deepEqual(sessionProgress(['1.1', '1.2', '1.3'], ['1.1', '1.1', 'old', 2]), { done: 1, total: 3, percent: 33 });
  assert.deepEqual(sessionProgress(['1.1'], ['1.1']), { done: 1, total: 1, percent: 100 });
});
test('empty and malformed progress cannot claim completion', () => {
  assert.deepEqual(sessionProgress([], ['old']), { done: 0, total: 0, percent: 0 });
  assert.deepEqual(sessionProgress(['1.1'], { '1.1': true }), { done: 0, total: 1, percent: 0 });
});
test('module section links preserve preview and stay scoped to their module', () => {
  assert.equal(moduleSectionHref('technology-for-psychology', 'Labs', true), '/m/technology-for-psychology?tab=labs&preview=');
  assert.equal(moduleSectionHref('another-module', 'Overview'), '/m/another-module');
  assert.ok(moduleSections('technology-for-psychology').includes('Project'));
  assert.ok(!moduleSections('another-module').includes('Project'));
});
