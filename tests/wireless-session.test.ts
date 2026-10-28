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

test('lecture 1 helpers match the slides', async () => {
  const { bandOf, formatLength, formatSeconds, multihopPowerRatio, period, shannonCapacity, snrDb } = await import('../src/lib/wireless/core.ts');
  assert.ok(closeEnough(snrDb(1, 0.001), 30));
  assert.ok(closeEnough(shannonCapacity(20e6, 30), 199.3e6, 0.01)); // slide 6: ≈ 200 Mbps
  assert.ok(closeEnough(dopplerHz(100 / 3.6, 2e9), 185.2, 0.01)); // slides 11 and 24
  assert.equal(formatLength(wavelength(2.4e9)), '12.5 cm'); // slide 20
  assert.equal(formatSeconds(period(2.4e9)), '0.417 ns'); // slide 18
  assert.ok(closeEnough(multihopPowerRatio(2, 2), 0.5)); // slide 14: two hops of d/2
  assert.equal(bandOf(2.4e9)?.id, 'UHF');
  assert.equal(bandOf(5e9)?.id, 'SHF');
});

test('lecture 1 covers every PDF page exactly once, and the module lists it', async () => {
  const { sections, PDF_PAGES, glossary, quickCheck } = await import('../src/lib/wireless/lecture1.ts');
  const { lectures, labs } = await import('../src/lib/wireless/module.ts');
  const pages = sections.flatMap((s) => s.pages).sort((a, b) => a - b);
  assert.deepEqual(pages, Array.from({ length: PDF_PAGES }, (_, i) => i + 1));
  assert.equal(new Set(sections.map((s) => s.id)).size, sections.length);
  assert.ok(glossary.length >= 38);
  assert.equal(quickCheck.length, 5);
  assert.deepEqual(lectures.map((l) => [l.week, l.href]), [[1, '/wireless/lectures/lecture-01']]);
  assert.deepEqual(labs.map((l) => [l.week, l.href]), [[6, '/wireless/labs/sheet-3']]);
});
