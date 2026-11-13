/**
 * The flowchart widgets of a builder lab. Four modes:
 *   show  — watch a flowchart run (Run / Step), with the screen and the values after every shape
 *   trace — read the flowchart and type exactly what it prints for the given input
 *   fill  — choose the text of every empty box, then the chart is run on the tests
 *   draw  — draw the whole chart: add shapes, type their text, drag the dot under a shape to another shape to add
 *           an arrow (a decision gets Yes, then No); Run it, then Check it on the tests
 * Every chart runs like a program (./run.ts); the checks are ./check.ts.
 */
import { chartToText, isStartText, type Chart, type FNode, type Shape } from './chart.ts';
import { chartSvg, heightOf, W, type SvgOpts } from './svg.ts';
import { runChart, type RunResult, type TraceStep } from './run.ts';
import { checkChart, type FlowResult } from './check.ts';

export type FlowMode = 'show' | 'trace' | 'fill' | 'draw';
export type FlowCfg = { kind: 'flowchart'; id: string; mode: FlowMode; chart: Chart; input: string; bank: string[]; checks: string; solution?: Chart };
type Track = (passed: number, total: number, code: string) => void;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, string> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) if (k === 'class') e.className = v; else e.setAttribute(k, v);
  e.append(...kids);
  return e;
}
const button = (text: string, cls = 'btn btn-ghost btn-sm') => h('button', { type: 'button', class: cls }, text);
const flat = (s: string) => s.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim().replace(/\n/g, ' ');
const clone = (c: Chart): Chart => JSON.parse(JSON.stringify(c));
const saved = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* storage off */ } },
};
const pause = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 80 : 450);

/* ------------------------------------------------------------------ shared parts */
function stage(parent: HTMLElement, cls = 'fc-stage') {
  const box = h('div', { class: cls });
  parent.append(box);
  return { box, draw: (chart: Chart, o: SvgOpts = {}) => { box.innerHTML = chartSvg(chart, o); } };
}

function resultsList(list: FlowResult[]) {
  return h('ul', { class: 'fc-results' }, ...list.map((r) => h('li', { class: r.pass ? 'ok' : 'bad' }, h('b', {}, `${r.pass ? '✓' : '✗'} ${r.name}`), r.message ? h('span', {}, ` — ${r.message}`) : '')));
}

/** input box, Run and Step, the screen and the values; `draw` repaints the chart with the running shape */
function runPanel(parent: HTMLElement, getChart: () => Chart, draw: (c: Chart, o?: SvgOpts) => void, input0: string) {
  const inp = h('input', { class: 'fc-input mono', type: 'text', 'aria-label': 'What the user types', placeholder: 'what the user types, e.g. 25' });
  inp.value = input0;
  const runBtn = button('▶ Run', 'btn btn-primary btn-sm');
  const stepBtn = button('Step');
  const screen = h('pre', { class: 'fc-screen mono', 'aria-live': 'polite' });
  const vars = h('dl', { class: 'fc-vars mono' });
  const msg = h('p', { class: 'fc-msg', role: 'status' });
  parent.append(h('div', { class: 'fc-run' },
    h('div', { class: 'fc-run-row' }, h('label', { class: 'fc-input-label' }, h('span', {}, 'The user types'), inp), runBtn, stepBtn),
    h('div', { class: 'fc-run-out' },
      h('div', {}, h('p', { class: 'fc-k mono' }, 'Screen'), screen),
      h('div', {}, h('p', { class: 'fc-k mono' }, 'Values'), vars)),
    msg));
  let timer = 0, steps: TraceStep[] = [], at = -1, result: RunResult | null = null;
  const paintVars = (v: Record<string, string>) => {
    vars.replaceChildren(...Object.entries(v).flatMap(([k, x]) => [h('dt', {}, k), h('dd', {}, x)]));
    if (!Object.keys(v).length) vars.append(h('dd', { class: 'fc-dim' }, 'no values yet'));
  };
  const show = (i: number) => { const s = steps[i]; draw(getChart(), { active: s?.node }); screen.textContent = s?.output ?? ''; paintVars(s?.vars ?? {}); };
  const finish = () => {
    if (result && !result.ok) { draw(getChart(), { bad: result.error?.node }); msg.textContent = result.error!.message; msg.className = 'fc-msg bad'; }
    else { msg.textContent = 'Done: the flowchart reached End.'; msg.className = 'fc-msg ok'; }
  };
  const prepare = () => {
    window.clearTimeout(timer);
    result = runChart(getChart(), inp.value, { trace: true });
    steps = result.trace ?? [];
    at = -1;
    msg.textContent = ''; msg.className = 'fc-msg'; screen.textContent = ''; paintVars({});
  };
  const run = () => { prepare(); const tick = () => { at++; if (at >= steps.length) { finish(); return; } show(at); timer = window.setTimeout(tick, pause()); }; tick(); };
  runBtn.addEventListener('click', run);
  stepBtn.addEventListener('click', () => { if (at < 0 || at >= steps.length) prepare(); at++; if (at >= steps.length) { finish(); return; } show(at); });
  paintVars({});
  return { run };
}

/**
 * After the student's chart passes, or after 3 checks, a button shows the perfect flowchart: every variable
 * declared with its type and given a starting value, one Start, one End, Yes and No on every decision.
 */
function perfectReveal(host: HTMLElement, cfg: FlowCfg) {
  let fails = 0, shown = false;
  const btn = button('See the perfect flowchart');
  btn.hidden = true;
  const box = h('div', { class: 'fc-perfect' });
  box.hidden = true;
  host.append(btn, box);
  btn.addEventListener('click', () => {
    if (shown || !cfg.solution) return;
    shown = true; btn.hidden = true; box.hidden = false;
    box.append(h('p', { class: 'fc-k mono' }, 'The perfect flowchart'),
      h('p', { class: 'fc-q' }, 'Every variable is declared with its type and given a starting value first; one Start, one End; every decision has a Yes and a No arrow. Run it and compare it with yours.'));
    const st = stage(box);
    st.draw(cfg.solution);
    runPanel(box, () => cfg.solution!, st.draw, cfg.input);
  });
  return { offer(passed: boolean) { if (!cfg.solution || shown) return; if (!passed) fails++; if (passed || fails >= 3) btn.hidden = false; } };
}

/* ------------------------------------------------------------------ the four modes */
function showMode(host: HTMLElement, cfg: FlowCfg) {
  const st = stage(host);
  st.draw(cfg.chart);
  runPanel(host, () => cfg.chart, st.draw, cfg.input);
}

function traceMode(host: HTMLElement, cfg: FlowCfg, track: Track) {
  const st = stage(host);
  st.draw(cfg.chart);
  const want = runChart(cfg.chart, cfg.input).output;
  const ans = h('textarea', { class: 'fc-answer mono', rows: '2', 'aria-label': 'What the flowchart prints', placeholder: 'Type exactly what it prints (one line per Output)' });
  const check = button('Check my answer', 'btn btn-primary btn-sm');
  const fb = h('p', { class: 'fc-msg', role: 'status' });
  const after = h('div', { class: 'fc-after' });
  after.hidden = true;
  host.append(h('div', { class: 'fc-trace' },
    h('p', { class: 'fc-q' }, cfg.input.trim() ? 'The user types ' : 'Nobody types anything. ', cfg.input.trim() ? h('code', {}, cfg.input.trim()) : '', cfg.input.trim() ? '. ' : '', h('b', {}, 'What does the flowchart print?')),
    ans, h('div', { class: 'fc-run-row' }, check), fb), after);
  let tries = 0;
  check.addEventListener('click', () => {
    const ok = flat(ans.value) === flat(want) && flat(want) !== '';
    track(ok ? 1 : 0, 1, ans.value);
    if (ok) {
      fb.textContent = 'Right! Watch it run to see each step.'; fb.className = 'fc-msg ok';
      if (after.hidden) { after.hidden = false; runPanel(after, () => cfg.chart, st.draw, cfg.input).run(); }
      return;
    }
    tries++;
    fb.className = 'fc-msg bad';
    fb.textContent = tries < 2
      ? 'Not yet. Start at Start, follow one arrow at a time, and write the values down as they change.'
      : `Not yet. The first line it prints starts with “${want.split('\n')[0].slice(0, 2)}”.`;
  });
}

function fillMode(host: HTMLElement, cfg: FlowCfg, track: Track) {
  const blanks = cfg.chart.nodes.filter((n) => n.shape !== 'terminal' && (!n.text.trim() || n.text.trim() === '?'));
  const letter = (i: number) => String.fromCharCode(65 + i);
  const key = `flow:fill:${cfg.id}`;
  let choices: string[] = blanks.map(() => '');
  try { const s = JSON.parse(saved.get(key) ?? 'null'); if (Array.isArray(s) && s.length === blanks.length) choices = s.map(String); } catch { /* ignore */ }
  const filled = (): Chart => ({ ...cfg.chart, nodes: cfg.chart.nodes.map((n) => { const i = blanks.findIndex((b) => b.id === n.id); return i >= 0 && choices[i] ? { ...n, text: choices[i] } : n; }) });
  const st = stage(host);
  const draw = (c: Chart = filled(), o: SvgOpts = {}) => st.draw(c, { ...o, blanks: Object.fromEntries(blanks.flatMap((b, i) => (choices[i] ? [] : [[b.id, letter(i)]]))) });
  const kind: Record<Shape, string> = { terminal: 'oval', io: 'parallelogram', process: 'rectangle', decision: 'diamond' };
  const rows = blanks.map((b, i) => {
    const sel = h('select', { class: 'fc-select', 'aria-label': `Box ${letter(i)}` }, h('option', { value: '' }, '— choose —'), ...cfg.bank.map((t) => h('option', { value: t }, t)));
    sel.value = choices[i];
    sel.addEventListener('change', () => { choices[i] = sel.value; saved.set(key, JSON.stringify(choices)); draw(); });
    return h('label', { class: 'fc-fill-row' }, h('b', { class: 'fc-letter' }, letter(i)), h('span', { class: 'fc-dim' }, kind[b.shape]), sel);
  });
  const out = h('div', { class: 'fc-check-out' });
  const check = button('Check my flowchart', 'btn btn-primary btn-sm');
  host.append(h('div', { class: 'fc-fill' }, ...rows), h('div', { class: 'fc-run-row' }, check), out);
  check.addEventListener('click', () => {
    const missing = choices.flatMap((c, i) => (c ? [] : [letter(i)]));
    if (missing.length) { out.replaceChildren(h('p', { class: 'fc-msg bad' }, `Choose a text for every box first: ${missing.join(', ')}.`)); return; }
    const res = checkChart(filled(), cfg.checks);
    out.replaceChildren(resultsList(res));
    reveal.offer(res.every((r) => r.pass));
    track(res.filter((r) => r.pass).length, res.length, chartToText(filled()));
  });
  const reveal = perfectReveal(host, cfg);
  draw();
  runPanel(host, filled, (c, o) => draw(c, o), cfg.input);
}

const DEFAULT_TEXT: Record<Shape, string> = { terminal: 'End', io: 'Input x', process: 'x = 0', decision: 'x > 0?' };
const SHAPE_HINT: Record<Shape, string> = {
  terminal: 'Start or End',
  io: 'Input a, b   ·   Output "Total = ", total',
  process: 'total = a + b   ·   count = count + 1',
  decision: 'a > b?   ·   n mod 5 = 0?   ·   y = 0?',
};

function drawMode(host: HTMLElement, cfg: FlowCfg, track: Track) {
  const key = `flow:draw:${cfg.id}`;
  let chart: Chart = clone(cfg.chart);
  try { const s = JSON.parse(saved.get(key) ?? 'null'); if (s && Array.isArray(s.nodes) && Array.isArray(s.edges)) chart = s; } catch { /* ignore */ }
  let selNode: string | undefined, selEdge: number | undefined, extra: SvgOpts = {};
  const save = () => saved.set(key, JSON.stringify(chart));
  const msg = h('p', { class: 'fc-msg', role: 'status' });
  const say = (t: string, bad = true) => { msg.textContent = t; msg.className = `fc-msg ${t ? (bad ? 'bad' : 'ok') : ''}`; };

  // toolbar: add a shape, edit the text of the selected one, delete, swap Yes/No, start again
  const adds = (Object.keys(DEFAULT_TEXT) as Shape[]).map((s) => {
    const b = button(`+ ${{ terminal: 'Start / End', io: 'Input / Output', process: 'Process', decision: 'Decision' }[s]}`, `btn btn-ghost btn-sm fc-add fc-add-${s}`);
    b.addEventListener('click', () => addShape(s));
    return b;
  });
  const text = h('input', { class: 'fc-text-input mono', type: 'text', 'aria-label': 'Text in the selected shape', placeholder: 'select a shape to type in it' });
  const hint = h('p', { class: 'fc-hint mono' });
  const del = button('Delete');
  const swap = button('Yes ⇄ No');
  const reset = button('Start again');
  host.append(h('div', { class: 'fc-tools' }, ...adds), h('div', { class: 'fc-edit' }, h('label', { class: 'fc-text-label' }, h('span', {}, 'Text in the shape'), text), del, swap, reset), hint);
  const canvas = h('div', { class: 'fc-canvas', tabindex: '0', 'aria-label': 'Flowchart canvas: drag shapes to move them, drag the dot under a shape onto another shape to add an arrow' });
  host.append(canvas, msg);

  const node = (id?: string) => chart.nodes.find((n) => n.id === id);
  const size = () => ({ w: Math.max(760, ...chart.nodes.map((n) => n.x + W + 240)), h: Math.max(560, ...chart.nodes.map((n) => n.y + heightOf(n) + 180)) });
  let temp: { x1: number; y1: number; x2: number; y2: number } | null = null;
  function paint(o: SvgOpts = extra) {
    extra = o;
    canvas.innerHTML = chartSvg(chart, { ...o, editable: true, selected: selNode, selectedEdge: selEdge, size: size() });
    if (temp) {
      const svg = canvas.querySelector('svg')!;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      Object.entries({ x1: temp.x1, y1: temp.y1, x2: temp.x2, y2: temp.y2 }).forEach(([k, v]) => line.setAttribute(k, String(v)));
      line.setAttribute('class', 'fc-temp');
      svg.append(line);
    }
    const n = node(selNode);
    text.disabled = !n;
    if (document.activeElement !== text) text.value = n?.text ?? '';
    hint.textContent = n ? `For example: ${SHAPE_HINT[n.shape]}` : 'Click a shape to select it. Drag the dot under a shape onto another shape to draw an arrow.';
    del.disabled = !n && selEdge === undefined;
    const e = selEdge !== undefined ? chart.edges[selEdge] : undefined;
    swap.disabled = !(e && node(e.from)?.shape === 'decision');
  }
  function addShape(s: Shape) {
    const below = node(selNode) ?? chart.nodes.reduce<FNode | undefined>((a, n) => (!a || n.y > a.y ? n : a), undefined);
    const hasStart = chart.nodes.some((n) => n.shape === 'terminal' && isStartText(n.text));
    const id = `n${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`;
    chart.nodes.push({ id, shape: s, text: s === 'terminal' && !hasStart ? 'Start' : DEFAULT_TEXT[s], x: below ? below.x : 40, y: below ? below.y + heightOf(below) + 44 : 24 });
    selNode = id; selEdge = undefined;
    save(); paint({}); say('');
    text.focus(); text.select();
  }
  function connect(from: string, to: string) {
    const src = node(from)!;
    if (src.shape === 'terminal' && !isStartText(src.text)) return say('End is the last shape: no arrow leaves it.');
    const outs = chart.edges.filter((e) => e.from === from);
    if (src.shape === 'decision') {
      if (outs.length >= 2) return say('A decision has two arrows, Yes and No. Delete one first.');
      chart.edges.push({ from, to, label: outs.some((e) => e.label === 'yes') ? 'no' : 'yes' });
    } else {
      chart.edges = chart.edges.filter((e) => e.from !== from);
      chart.edges.push({ from, to });
    }
    selEdge = chart.edges.length - 1; selNode = undefined;
    save(); say('');
  }
  const point = (ev: PointerEvent) => {
    const svg = canvas.querySelector('svg')!;
    const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    return { x: ((ev.clientX - r.left) * vb.width) / r.width + vb.x, y: ((ev.clientY - r.top) * vb.height) / r.height + vb.y };
  };
  let drag: { id: string; dx: number; dy: number } | null = null, linking: string | null = null;
  canvas.addEventListener('pointerdown', (ev) => {
    const t = ev.target as Element;
    const handle = t.closest('[data-handle]'), g = t.closest('[data-node]'), edge = t.closest('[data-edge]');
    if (handle) {
      linking = handle.getAttribute('data-handle');
      const n = node(linking!)!;
      const p = point(ev);
      temp = { x1: n.x + W / 2, y1: n.y + heightOf(n), x2: p.x, y2: p.y };
    } else if (g) {
      selNode = g.getAttribute('data-node')!; selEdge = undefined;
      const n = node(selNode)!, p = point(ev);
      drag = { id: n.id, dx: p.x - n.x, dy: p.y - n.y };
    } else if (edge) { selEdge = Number(edge.getAttribute('data-edge')); selNode = undefined; }
    else { selNode = undefined; selEdge = undefined; }
    if (handle || g) { try { canvas.setPointerCapture(ev.pointerId); } catch { /* not a live pointer: moves still reach the canvas */ } ev.preventDefault(); }
    paint({});
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!drag && !linking) return;
    const p = point(ev);
    if (drag) { const n = node(drag.id)!; n.x = Math.max(0, Math.round((p.x - drag.dx) / 4) * 4); n.y = Math.max(0, Math.round((p.y - drag.dy) / 4) * 4); }
    if (linking && temp) { temp.x2 = p.x; temp.y2 = p.y; }
    paint();
  });
  canvas.addEventListener('pointerup', (ev) => {
    if (linking) {
      const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-node]')?.getAttribute('data-node');
      if (over && over !== linking) connect(linking, over);
      else if (!over) say('Drop the arrow on the shape it should go to.');
    }
    if (drag) save();
    drag = null; linking = null; temp = null;
    paint({});
  });
  canvas.addEventListener('keydown', (ev) => { if ((ev.key === 'Delete' || ev.key === 'Backspace') && document.activeElement === canvas) { ev.preventDefault(); remove(); } });
  text.addEventListener('input', () => { const n = node(selNode); if (!n) return; n.text = text.value; save(); paint(); });
  function remove() {
    if (selNode) { chart.nodes = chart.nodes.filter((n) => n.id !== selNode); chart.edges = chart.edges.filter((e) => e.from !== selNode && e.to !== selNode); selNode = undefined; }
    else if (selEdge !== undefined) { chart.edges.splice(selEdge, 1); selEdge = undefined; }
    save(); paint({});
  }
  del.addEventListener('click', remove);
  swap.addEventListener('click', () => {
    const e = selEdge !== undefined ? chart.edges[selEdge] : undefined;
    if (!e?.label) return;
    for (const x of chart.edges) if (x.from === e.from && x.label) x.label = x.label === 'yes' ? 'no' : 'yes';
    save(); paint();
  });
  reset.addEventListener('click', () => {
    if (!confirm('Start again? Your flowchart for this exercise is cleared.')) return;
    chart = clone(cfg.chart); selNode = undefined; selEdge = undefined; save(); paint({}); say('');
  });
  const out = h('div', { class: 'fc-check-out' });
  const check = button('Check my flowchart', 'btn btn-primary btn-sm');
  host.append(h('div', { class: 'fc-run-row' }, check), out);
  check.addEventListener('click', () => {
    const res = checkChart(chart, cfg.checks);
    out.replaceChildren(resultsList(res));
    reveal.offer(res.every((r) => r.pass));
    track(res.filter((r) => r.pass).length, res.length, chartToText(chart));
  });
  const reveal = perfectReveal(host, cfg);
  paint({});
  runPanel(host, () => chart, (_c, o) => paint(o ?? {}), cfg.input);
}

export function mountFlowchart(host: HTMLElement, cfg: FlowCfg, track: Track) {
  host.replaceChildren();
  host.classList.add('fc', `fc-mode-${cfg.mode}`);
  if (cfg.mode === 'show') showMode(host, cfg);
  else if (cfg.mode === 'trace') traceMode(host, cfg, track);
  else if (cfg.mode === 'fill') fillMode(host, cfg, track);
  else drawMode(host, cfg, track);
}
