// Run with: node --test tests/
// The reading tracker records which tasks a student has seen. Builder C++ and AI blocks carry an empty
// data-exercise attribute (a gate marker, not an id): recording "" made the server refuse the whole batch (400).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readingId } from '../src/lib/progress/reading.ts';

test('a task is seen by its number; a legacy exercise by its id', () => {
  assert.equal(readingId({ task: '1.2' }), '1.2');
  assert.equal(readingId({ exercise: 'lab-03-ex-1' }), 'lab-03-ex-1');
  assert.equal(readingId({ task: '12.1', exercise: '' }), '12.1');
});

test('a block with an empty data-exercise (a builder C++ or AI block) is not recorded', () => {
  assert.equal(readingId({ exercise: '' }), null);
  assert.equal(readingId({}), null);
});
