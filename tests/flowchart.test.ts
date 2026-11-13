// Flowcharts that run: the text format, the runner (sequence, selection, loops, like C++ numbers) and the checks
// (the same lines as the C++ checks: in …; expect …; not …; plus "uses decision" / "uses loop").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChart, chartToText } from '../src/lab/flow/chart.ts';
import { runChart } from '../src/lab/flow/run.ts';
import { checkChart } from '../src/lab/flow/check.ts';

const chart = (src: string) => {
  const r = parseChart(src);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

const C_TO_F = `
s start 0,0 Start
i input 0,1 Input C
p process 0,2 F = 1.8 * C + 32
o output 0,3 Output F
e end 0,4 End
s -> i -> p -> o -> e
`;

const DIVIDE = `
s start 0,0 Start
i input 0,1 Input a, b
d decision 0,2 b = 0?
u output 1,3 Output "unknown"
q output 0,3 Output a / b
e end 0,4 End
s -> i -> d
d -yes-> u
d -no-> q
u -> e
q -> e
`;

const FIVES = `
s start 0,0 Start
p process 0,1 n = 1
d decision 0,2 n <= 99
k decision 0,3 n mod 5 = 0
o output 1,4 Output n
a process 0,5 n = n + 1
e end 1,2 End
s -> p -> d
d -yes-> k
d -no-> e
k -yes-> o
k -no-> a
o -> a
a -> d
`;

test('the text format: shapes on a grid, arrows, Yes/No labels, and back to text', () => {
  const c = chart(DIVIDE);
  assert.equal(c.nodes.length, 6);
  assert.equal(c.edges.length, 6, 'plain arrows (->) and labelled arrows are all read');
  assert.equal(parseChart('s start 0,0 Start\ns -> ').ok, false, 'an arrow line with a missing end is an error');
  assert.deepEqual(c.nodes.find((n) => n.id === 'd'), { id: 'd', shape: 'decision', text: 'b = 0?', x: c.nodes[0].x, y: c.nodes.find((n) => n.id === 'd')!.y });
  assert.equal(c.nodes.find((n) => n.id === 'u')!.shape, 'io');
  assert.equal(c.nodes.find((n) => n.id === 's')!.shape, 'terminal');
  assert.deepEqual(c.edges.filter((e) => e.from === 'd'), [{ from: 'd', to: 'u', label: 'yes' }, { from: 'd', to: 'q', label: 'no' }]);
  assert.ok(c.nodes.find((n) => n.id === 'u')!.x > c.nodes.find((n) => n.id === 'q')!.x, 'column 1 is right of column 0');
  const again = chart(chartToText(c));
  assert.deepEqual(again, c);
  assert.equal(parseChart('x blob 0,0 Hi').ok, false);
});

test('sequence: Celsius to Fahrenheit prints like cout', () => {
  assert.equal(runChart(chart(C_TO_F), '25').output.trim(), '77');
  assert.equal(runChart(chart(C_TO_F), '37').output.trim(), '98.6');
  assert.equal(runChart(chart(C_TO_F), '-40').output.trim(), '-40');
});

test('numbers behave like C++: int / int is a whole number, % is the remainder', () => {
  const c = chart(`
s start 0,0 Start
i input 0,1 Input t
p process 0,2 h = t / 3600; t = t % 3600; m = t / 60; t %= 60
o output 0,3 Output h, " h ", m, " min ", t, " s"
e end 0,4 End
s -> i -> p -> o -> e`);
  assert.equal(runChart(c, '3725').output.trim(), '1 h 2 min 5 s');
  const f = chart('s start 0,0 Start\np process 0,1 x = 7 / 2; y = 7.0 / 2; z = sqrt(16) + pow(2, 3) + max(3, 9)\no output 0,2 Output x, " ", y, " ", z\ne end 0,3 End\ns -> p -> o -> e');
  assert.equal(runChart(f, '').output.trim(), '3 3.5 21');
});

test('selection: the Yes or No arrow is followed', () => {
  assert.equal(runChart(chart(DIVIDE), '7 0').output.trim(), 'unknown');
  assert.equal(runChart(chart(DIVIDE), '8 2').output.trim(), '4');
  const r = runChart(chart(DIVIDE), '8 2');
  assert.deepEqual(r.path, ['s', 'i', 'd', 'q', 'e']);
});

test('loops: an arrow back up repeats the shapes', () => {
  const out = runChart(chart(FIVES), '').output.trim().split('\n');
  assert.equal(out.length, 19);
  assert.equal(out[0], '5');
  assert.equal(out.at(-1), '95');
});

test('decisions understand flowchart writing: = ≠ <> ≤ ≥ and or not mod', () => {
  const run = (cond: string, input: string) => runChart(chart(`s start 0,0 Start\ni input 0,1 Input x, y\nd decision 0,2 ${cond}\na output 1,3 Output "yes"\nb output 0,3 Output "no"\ne end 0,4 End\ns -> i -> d\nd -yes-> a\nd -no-> b\na -> e\nb -> e`), input).output.trim();
  assert.equal(run('x ≠ y', '1 2'), 'yes');
  assert.equal(run('x <> y', '2 2'), 'no');
  assert.equal(run('x ≥ 0 and y ≤ 5?', '0 5'), 'yes');
  assert.equal(run('x < 0 or y = 0', '3 1'), 'no');
  assert.equal(run('not (x mod 2 = 0)', '3 0'), 'yes');
  assert.equal(run('x >= 10 && y != 0', '10 1'), 'yes');
});

test('mistakes get a plain message that names the shape', () => {
  const err = (src: string, input = '') => runChart(chart(src), input).error?.message ?? '';
  assert.match(err('o output 0,0 Output 1\ne end 0,1 End\no -> e'), /Start/);
  assert.match(err('s start 0,0 Start\nd decision 0,1 x > 1\ne end 0,2 End\ns -> d\nd -> e'), /Yes and a No arrow/);
  assert.match(err('s start 0,0 Start\np process 0,1 x = y + 1\ne end 0,2 End\ns -> p -> e'), /y.*no value yet|has no value/);
  assert.match(err('s start 0,0 Start\ni input 0,1 Input a, b\ne end 0,2 End\ns -> i -> e', '5'), /more input/);
  assert.match(err('s start 0,0 Start\np process 0,1 x = 1\ne end 0,2 End\ns -> p'), /no arrow out/);
  assert.match(err('s start 0,0 Start\np process 0,1 x = 1\nd decision 0,2 x > 0\ne end 0,3 End\ns -> p -> d\nd -yes-> p\nd -no-> e'), /never ends|5000/);
  assert.match(err('s start 0,0 Start\np process 0,1 x = (1 + \ne end 0,2 End\ns -> p -> e'), /understand/);
  const r = runChart(chart('s start 0,0 Start\np process 0,1 x = y\ne end 0,2 End\ns -> p -> e'), '');
  assert.equal(r.ok, false);
  assert.equal(r.error?.node, 'p');
});

test('checks: the same lines as C++ checks, plus uses decision / uses loop', () => {
  const checks = 'Freezing :: in 0; expect 32\nBody heat :: in 37; expect 98.6\nNo words :: in 100; not unknown';
  const good = checkChart(chart(C_TO_F), checks);
  assert.deepEqual(good.map((r) => r.pass), [true, true, true]);
  const bad = checkChart(chart(C_TO_F.replace('1.8 * C + 32', '1.8 * C')), checks);
  assert.deepEqual(bad.map((r) => r.pass), [false, false, true]);
  assert.match(bad[0].message ?? '', /32/);
  assert.equal(checkChart(chart(FIVES), 'Has a loop :: uses loop; uses decision')[0].pass, true);
  assert.equal(checkChart(chart(C_TO_F), 'Has a loop :: uses loop')[0].pass, false);
  assert.match(checkChart(chart(C_TO_F), 'Has a loop :: uses loop')[0].message ?? '', /loop/);
});

test('a trace records the variables and the screen after every shape (for the step-by-step visual)', () => {
  const r = runChart(chart(C_TO_F), '25', { trace: true });
  assert.deepEqual(r.trace?.map((t) => t.node), ['s', 'i', 'p', 'o', 'e']);
  assert.deepEqual(r.trace?.[1].vars, { C: '25' });
  assert.equal(r.trace?.[2].vars.F, '77');
  assert.equal(r.trace?.[2].output, '', 'nothing printed before the Output shape');
  assert.equal(r.trace?.[3].output, '77\n');
  assert.equal(runChart(chart(C_TO_F), '25').trace, undefined, 'no trace unless asked');
});

test('the picture: one shape per node, arrows with heads, Yes/No labels, safe text, the running shape marked', async () => {
  const { chartSvg } = await import('../src/lab/flow/svg.ts');
  const svg = chartSvg(chart(DIVIDE), { active: 'd' });
  assert.equal((svg.match(/data-node="/g) ?? []).length, 6);
  assert.equal((svg.match(/data-edge="/g) ?? []).length, 6);
  assert.match(svg, /marker-end="url\(#fc-arrow/);
  assert.match(svg, />Yes</);
  assert.match(svg, />No</);
  assert.match(svg, /class="fc-node fc-decision is-active" data-node="d"/);
  assert.match(svg, /<polygon/);
  const evil = chartSvg(chart('s start 0,0 Start\no output 0,1 Output "<b>hi</b>"\ne end 0,2 End\ns -> o -> e'));
  assert.doesNotMatch(evil, /<b>/);
  assert.match(evil, /&lt;b&gt;/);
  const blank = chartSvg(chart('s start 0,0 Start\np process 0,1 ?\ne end 0,2 End\ns -> p -> e'), { blanks: { p: 'A' } });
  assert.match(blank, /is-blank/);
});

test('the builder node: a lab with flowcharts compiles to blocks and graded exercises, broken charts warn', async () => {
  const { compileLab, sanitizeFlow } = await import('../src/lib/platform/core.ts');
  const fc = (id: string, data: Record<string, string>) => ({ id, type: 'flowchart', data: { title: id, goal: 'Make it.', input: '', bank: '', checks: '', ...data } });
  const nodes = [
    { id: 'root', type: 'start', data: { title: 'Flowcharts' } },
    { id: 'p1', type: 'part', data: { title: 'Charts', time: '10 min' } },
    fc('f-show', { mode: 'Show it running', chart: C_TO_F, input: '25' }),
    fc('f-trace', { mode: 'Read it and type the output', chart: DIVIDE, input: '7 0' }),
    fc('f-fill', { mode: 'Fill the empty boxes', chart: C_TO_F.replace('F = 1.8 * C + 32', '?'), bank: 'F = 1.8 * C + 32\nF = C + 32', checks: 'Body heat :: in 37; expect 98.6' }),
    fc('f-draw', { mode: 'Draw it yourself', chart: 's start 0,0 Start\ne end 0,4 End', checks: 'Freezing :: in 0; expect 32' }),
    fc('f-bad', { mode: 'Show it running', chart: 'x blob 0,0 Hi' }),
  ];
  const flow = sanitizeFlow({ nodes: nodes.map((n, i) => ({ ...n, x: 0, y: i * 100 })), edges: nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id })) }, 'lab');
  assert.ok(flow.ok, flow.ok ? '' : flow.error);
  const lab = compileLab(flow.value, 'm--l');
  const blocks = lab.blocks.filter((b) => b.kind === 'flowchart') as Extract<(typeof lab.blocks)[number], { kind: 'flowchart' }>[];
  assert.deepEqual(blocks.map((b) => b.mode), ['show', 'trace', 'fill', 'draw']);
  assert.equal(blocks[0].chart.nodes.length, 5);
  assert.deepEqual(blocks[2].bank, ['F = 1.8 * C + 32', 'F = C + 32']);
  assert.deepEqual(Object.keys(lab.exercises).sort(), ['m--l--f-draw', 'm--l--f-fill', 'm--l--f-trace']);
  assert.ok(lab.warnings.some((w) => /f-bad|blob/.test(w)), lab.warnings.join(' | '));
});
