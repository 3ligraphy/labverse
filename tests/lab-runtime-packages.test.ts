// The phone emulator's module system: a file that fails is not kept half-loaded (it hid the real error behind
// "… must export default a component"), and the packages student apps use: react-native-svg, @expo-google-fonts/*.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { createModuleSystem } = await import('../src/lab/runtime/modules.ts');
const { googleFontsModule } = await import('../src/lab/runtime/packages.tsx');
const { SvgModule } = await import('../src/lab/runtime/svg.tsx');

test('a file that failed shows the same error when it is loaded again, not an empty module', () => {
  const files = {
    'src/app/_layout.js': `var m = require('missing-package'); exports.default = function RootLayout() { return null; };`,
  };
  const sys = createModuleSystem({}, files);
  assert.throws(() => sys.load('src/app/_layout.js'), /missing-package/);
  // React renders again after an error: before the fix this returned {} (no default export)
  assert.throws(() => sys.load('src/app/_layout.js'), /missing-package/);
});

test('a file that loads is still loaded once', () => {
  let runs = 0;
  const sys = createModuleSystem({ counter: { hit: () => runs++ } }, { 'a.js': `require('counter').hit(); exports.default = 1;` });
  assert.equal(sys.load('a.js').default, 1);
  assert.equal(sys.load('a.js').default, 1);
  assert.equal(runs, 1);
});

test('@expo-google-fonts/<family>: fonts count as loaded, each font name is its own fontFamily', () => {
  const sys = createModuleSystem({}, { 'a.js': `var f = require('@expo-google-fonts/overpass'); exports.r = f.useFonts({ Overpass_400Regular: f.Overpass_400Regular }); exports.name = f.Overpass_700Bold;` });
  const m = sys.load('a.js');
  assert.deepEqual(m.r, [true, null]);
  assert.equal(m.name, 'Overpass_700Bold');
  assert.equal(typeof googleFontsModule().useFonts, 'function');
});

test('react-native-svg has the components apps use, drawn as SVG elements', () => {
  for (const name of ['Circle', 'Defs', 'Ellipse', 'G', 'LinearGradient', 'Path', 'Rect', 'Stop', 'Text', 'Line', 'Polygon']) assert.ok(SvgModule[name as keyof typeof SvgModule], name);
  assert.equal(SvgModule.default, SvgModule.Svg);
  const el = (SvgModule.Path as any).render({ d: 'M0 0L10 10', strokeWidth: 2, onPress: () => {} }, null);
  assert.equal(el.type, 'path');
  assert.equal(el.props.strokeWidth, 2);
  assert.equal(typeof el.props.onClick, 'function');
});
