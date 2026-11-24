// The step-through animations of the labs (Lab 07: "How it works"): Back / Next / Play, which step comes next, and
// when Play may run — never for people who asked for less motion, never off screen or in a hidden tab.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoplayAllowed, next, prev, shouldRun, stateAt } from '../src/lab/ui/stepper.ts';

test('a part of an animation knows its state at each step from data-at="steps:state …"', () => {
  const spec = '2:match 3-5:skip 7,9:show';
  assert.equal(stateAt(spec, 1), '', 'no state at step 1');
  assert.equal(stateAt(spec, 2), 'match');
  assert.equal(stateAt(spec, 3), 'skip');
  assert.equal(stateAt(spec, 5), 'skip', 'a range includes its last step');
  assert.equal(stateAt(spec, 6), '');
  assert.equal(stateAt(spec, 7), 'show');
  assert.equal(stateAt(spec, 8), '');
  assert.equal(stateAt(spec, 9), 'show');
  assert.equal(stateAt('  ', 1), '', 'an empty spec gives no state');
  assert.equal(stateAt('1-3:run 2:match', 2), 'match', 'a later token wins');
});

test('Next goes one step forward, and from the last step back to the first', () => {
  assert.equal(next(0, 3), 1);
  assert.equal(next(1, 3), 2);
  assert.equal(next(2, 3), 0, 'after the last step: start again');
  assert.equal(next(0, 1), 0, 'one step only: stay');
});

test('Back goes one step back and never below the first step', () => {
  assert.equal(prev(2), 1);
  assert.equal(prev(1), 0);
  assert.equal(prev(0), 0);
});

test('Play never starts by itself for people who asked for less motion', () => {
  assert.equal(autoplayAllowed(true), false);
  assert.equal(autoplayAllowed(false), true);
});

test('a playing animation runs only while it is on screen and the tab is visible', () => {
  assert.equal(shouldRun(true, false, true), true);
  assert.equal(shouldRun(false, false, true), false, 'scrolled off screen: pause');
  assert.equal(shouldRun(true, true, true), false, 'tab hidden: pause');
  assert.equal(shouldRun(true, false, false), false, 'paused by the student: stay paused');
});
