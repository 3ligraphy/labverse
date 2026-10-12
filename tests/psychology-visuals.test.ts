import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { compileLab, type Flow } from '../src/lib/platform/core.ts';
import { psychologyTechnologyLab01, psychologyTechnologyLab02 } from '../src/lib/platform/seeds/psychology-technology-lab-01.ts';
import { addPsychologyVisuals } from '../src/lib/platform/seeds/psychology-visuals.ts';
import { psychologyVisuals } from '../src/lib/platform/psychology-guide.ts';

test('both sessions include valid local visuals without duplicate inserts', () => {
  for (const flow of [psychologyTechnologyLab01(), psychologyTechnologyLab02()]) {
    const compiled = compileLab(flow, 'test');
    assert.deepEqual(compiled.warnings, []);
    const images = compiled.blocks.flatMap((b) => b.kind === 'task' ? b.children : [b]).filter((b) => b.kind === 'image');
    assert.ok(images.length >= 8);
    assert.deepEqual(addPsychologyVisuals(flow), flow);
  }
  for (const visual of Object.values(psychologyVisuals)) {
    assert.ok(existsSync(new URL(`../public${visual.src}`, import.meta.url)), visual.src);
    assert.ok(visual.alt.length > 20);
  }
});
test('bundled images cannot escape the guides directory or use unsafe schemes', () => {
  for (const src of ['/guides/../secret.svg', '//evil.example/image.svg', '/guides/%2e%2e/image.png', 'data:image/svg+xml,hi', '/guides/a\\b.svg']) {
    const flow: Flow = { nodes: [{ id: 'start', type: 'start', x: 0, y: 0, data: { title: 'Test' } }, { id: 'img', type: 'image', x: 0, y: 1, data: { src, alt: 'Invalid test path' } }], edges: [{ from: 'start', to: 'img' }] };
    assert.ok(!compileLab(flow, 'test').blocks.some((b) => b.kind === 'image'), src);
  }
});
