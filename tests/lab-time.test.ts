import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMinutes, minutes } from '../src/lib/lab.ts';

test('minutes() reads hours and minutes, not only the first number', () => {
  assert.equal(minutes('45 min'), 45);
  assert.equal(minutes('1 hour 15 min'), 75);
  assert.equal(minutes('1 h 40 min'), 100);
  assert.equal(minutes('2 hours'), 120);
  assert.equal(minutes('1 h'), 60);
  assert.equal(minutes('1.5 h'), 90);
  assert.equal(minutes('90 minutes'), 90);
  assert.equal(minutes('10'), 10);
  assert.equal(minutes(''), 0);
  assert.equal(minutes(undefined), 0);
});

test('Lab 05 parts add up to 6 h 15 min (the "1 hour 15 min" part counts as 75, not 1)', () => {
  const parts = ['45 min', '20 min', '30 min', '35 min', '35 min', '40 min', '35 min', '45 min', '15 min', '1 hour 15 min'];
  assert.equal(parts.reduce((a, t) => a + minutes(t), 0), 375);
});

test('formatMinutes() writes a total the way the parts write theirs', () => {
  assert.equal(formatMinutes(45), '45 min');
  assert.equal(formatMinutes(60), '1 h');
  assert.equal(formatMinutes(375), '6 h 15 min');
  assert.equal(formatMinutes(0), '');
});
