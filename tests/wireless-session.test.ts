import test from 'node:test';
import assert from 'node:assert/strict';
import { closeEnough, convert, dbToLinear, dbmToWatts, dopplerHz, farFieldDistance, freeSpacePathLossDb, friisWatts, wavelength, wattsToDbm } from '../src/lib/wireless/core.ts';
import { conversions, formulas, questions } from '../src/lib/wireless/sheet3.ts';

test('wireless session contains every Sheet 3 question, formula and conversion family', () => {
  assert.equal(questions.length, 10);
  assert.equal(formulas.length, 21);
  assert.ok(conversions.length >= 8);
  assert.deepEqual(questions.map((q) => q.id), [1,2,3,4,5,6,7,8,9,10]);
  assert.ok(questions.every((q) => q.steps.length && q.takeaway));
});

test('core wireless calculations match the worked sheet', () => {
  assert.ok(closeEnough(wavelength(20e9), .015));
  assert.ok(closeEnough(dbToLinear(30), 1000));
  assert.ok(closeEnough(wattsToDbm(40), 46.0206));
  assert.ok(closeEnough(dbmToWatts(-90), 1e-12));
  assert.ok(closeEnough(freeSpacePathLossDb(1000, 900e6), 91.5266));
  assert.ok(closeEnough(friisWatts(40, 1, 1, 900e6, 1000), 2.814e-8));
  assert.ok(closeEnough(dopplerHz(50 * .44704, 900e6), 67.056));
  assert.ok(closeEnough(farFieldDistance(1, 900e6), 6));
});

test('interactive converter uses the correct reference scales', () => {
  assert.ok(closeEnough(convert(1, 'w-dbm').value, 30));
  assert.ok(closeEnough(convert(0, 'dbm-mw').value, 1));
  assert.ok(closeEnough(convert(120, 'kmh-ms').value, 33.3333));
  assert.ok(closeEnough(convert(50, 'mph-ms').value, 22.352));
  assert.ok(closeEnough(convert(30, 'db-linear').value, 1000));
});
