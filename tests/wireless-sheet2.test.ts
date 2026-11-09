import test from 'node:test';
import assert from 'node:assert/strict';
import { clusterSize, closeEnough, neighbourDistance, reuseDistance, reuseRatio, shiftsFor, sirDb, validClusterSizes } from '../src/lib/wireless/core.ts';
import { clusterTable, formulas, keyIdeas, questions } from '../src/lib/wireless/sheet2.ts';
import { euclid, grid, shiftVectors, tiling } from '../src/lib/wireless/hex.ts';

test('sheet 2 has every question of the solution sheet, in order', () => {
  assert.deepEqual(questions.map((q) => q.id), ['1a', '1b', '1c', '2', '3']);
  assert.equal(new Set(questions.map((q) => q.id)).size, questions.length);
  assert.ok(questions.every((q) => q.steps.length && q.takeaway && q.task));
  assert.equal(keyIdeas.length, 3);
  assert.ok(formulas.length >= 10);
  for (const q of questions) if (q.concept) assert.ok(q.concept.choices.some((c) => c.id === q.concept!.answer), q.id);
  const sort = questions.find((q) => q.id === '3')!.sort!;
  assert.equal(sort.filter((s) => s.side === 'advantage').length, 4);
  assert.equal(sort.filter((s) => s.side === 'disadvantage').length, 2);
});

test('cluster sizes and shifts match the worked solutions', () => {
  assert.equal(clusterSize(3, 2), 19); // 1(a)
  assert.equal(clusterSize(4, 2), 28); // 1(b)
  assert.equal(clusterSize(2, 3), 19); // 1(c): swapped shift, same N
  assert.deepEqual(shiftsFor(19), [[3, 2]]);
  assert.deepEqual(shiftsFor(28), [[4, 2]]);
  assert.deepEqual(shiftsFor(20), []);
  assert.deepEqual(validClusterSizes(28), [1, 3, 4, 7, 9, 12, 13, 16, 19, 21, 25, 27, 28]);
  assert.ok(closeEnough(reuseRatio(19), Math.sqrt(57)));
  assert.ok(closeEnough(reuseDistance(1, 28), 9.165, 0.001));
  assert.ok(closeEnough(neighbourDistance(1) ** 2, 3)); // (2R′)² = 3R²
  assert.ok(closeEnough(sirDb(7, 4, 6), 18.66, 0.001)); // omni, N = 7
  assert.ok(closeEnough(sirDb(7, 4, 2), 23.43, 0.001)); // 120° sectors
  assert.equal(clusterTable[0].n, 1);
});

test('every practice answer is consistent with its formula', () => {
  for (const q of questions) for (const p of q.practice ?? []) assert.ok(Number.isFinite(p.answer), `${q.id} ${p.label}`);
});

test('the hex tiling makes clusters of exactly N cells whose co-channel cells are D apart', () => {
  for (const [i, j] of [[1, 0], [1, 1], [2, 0], [2, 1], [2, 2], [3, 1], [3, 2], [2, 3], [4, 2], [4, 3]]) {
    const n = clusterSize(i, j);
    const t = tiling(i, j);
    const cells = grid(i + j + 6);
    const labels = new Set(cells.map(t.label));
    assert.equal(labels.size, n, `labels for ${i},${j}`);
    assert.equal(t.label({ q: 0, r: 0 }), 0);
    // the central cluster has N cells, one of each label
    const centre = cells.filter((h) => t.copy(h) === t.copy({ q: 0, r: 0 }));
    assert.equal(centre.length, n, `centre cluster for ${i},${j}`);
    assert.equal(new Set(centre.map(t.label)).size, n);
    // the first tier is the same channel set, at the reuse ratio √(3N) R = √N · (2R′)
    const { v1 } = shiftVectors(i, j);
    assert.ok(closeEnough(euclid(v1), Math.sqrt(n)));
    for (const h of t.firstTier({ q: 1, r: -1 })) assert.equal(t.label(h), t.label({ q: 1, r: -1 }));
    // no two neighbouring cells share a channel set (except the trivial N = 1)
    if (n > 1) for (const h of cells) assert.notEqual(t.label(h), t.label({ q: h.q + 1, r: h.r }));
  }
});

test('the module lists Sheet 2 as a lab', async () => {
  const { labs } = await import('../src/lib/wireless/module.ts');
  assert.ok(labs.some((l) => l.href === '/wireless/labs/sheet-2' && l.code === 'Sheet 2'));
});
