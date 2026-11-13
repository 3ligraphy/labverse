/**
 * Draws a flowchart as an SVG string (no DOM needed: the server renders it so the chart shows without
 * JavaScript, and the browser re-draws it while it runs or while the student edits it).
 * Start/End ovals, Input/Output parallelograms, process rectangles, decision diamonds; arrows go down the page,
 * Yes/No branches leave a diamond from its side, and arrows that go back up (loops) run along the left.
 */
import type { Chart, FNode } from './chart.ts';

export const W = 184;
export const heightOf = (n: Pick<FNode, 'shape'>) => (n.shape === 'decision' ? 76 : 56);
export type SvgOpts = {
  /** the shape running now, and the one with a mistake */
  active?: string;
  bad?: string;
  /** editor: the selected shape / arrow, and handles to drag new arrows from */
  selected?: string;
  selectedEdge?: number;
  editable?: boolean;
  /** fill-the-boxes: an empty shape shows its letter until a text is chosen */
  blanks?: Record<string, string>;
  /** fixed canvas size (the editor); otherwise the picture fits the chart */
  size?: { w: number; h: number };
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** wraps the text to the width of a shape (about 22 characters a line, at most 4 lines) */
export function wrap(text: string, width = 22): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let cur = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if (cur && (cur + ' ' + word).length > width) { lines.push(cur); cur = word; } else cur = cur ? `${cur} ${word}` : word;
    }
    lines.push(cur);
  }
  return lines.slice(0, 4).map((l, i, a) => (i === 3 && a.length < lines.length ? `${l}…` : l));
}

function shape(n: FNode): string {
  const { x, y } = n, h = heightOf(n), w = W;
  if (n.shape === 'terminal') return `<rect class="fc-shape" x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" />`;
  if (n.shape === 'process') return `<rect class="fc-shape" x="${x}" y="${y}" width="${w}" height="${h}" rx="4" />`;
  if (n.shape === 'io') return `<polygon class="fc-shape" points="${x + 16},${y} ${x + w},${y} ${x + w - 16},${y + h} ${x},${y + h}" />`;
  return `<polygon class="fc-shape" points="${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}" />`;
}

function label(n: FNode, blank?: string): string {
  const lines = blank !== undefined ? [blank] : wrap(n.text || ' ', n.shape === 'decision' ? 16 : 22);
  const cx = n.x + W / 2, cy = n.y + heightOf(n) / 2, lh = 16;
  const top = cy - ((lines.length - 1) * lh) / 2;
  return `<text class="fc-text" x="${cx}" y="${top}" text-anchor="middle" dominant-baseline="central">${lines.map((l, i) => `<tspan x="${cx}" y="${top + i * lh}">${esc(l)}</tspan>`).join('')}</text>`;
}

type Box = { x: number; y: number; w: number; h: number };
const box = (n: FNode): Box => ({ x: n.x, y: n.y, w: W, h: heightOf(n) });

/** the path of one arrow, and where its Yes/No label goes */
export function route(a: Box, b: Box, fromDecision: boolean, labelText?: string): { d: string; lx: number; ly: number } {
  const acx = a.x + a.w / 2, bcx = b.x + b.w / 2, acy = a.y + a.h / 2, bcy = b.y + b.h / 2;
  const below = b.y >= a.y + a.h - 1;
  const right = bcx > acx + 8, left = bcx < acx - 8;
  if (below) {
    // a decision branch to another column leaves from the diamond's side; everything else from the bottom
    if (fromDecision && (right || left)) {
      const sx = right ? a.x + a.w : a.x;
      return { d: `M${sx},${acy} H${bcx} V${b.y}`, lx: sx + (right ? 10 : -10), ly: acy - 8 };
    }
    const mid = (a.y + a.h + b.y) / 2;
    return { d: `M${acx},${a.y + a.h} V${mid} H${bcx} V${b.y}`, lx: acx + 10, ly: a.y + a.h + 12 };
  }
  if (Math.abs(acy - bcy) < 4 && (right || left)) {
    const sx = right ? a.x + a.w : a.x, ex = right ? b.x : b.x + b.w;
    return { d: `M${sx},${acy} H${ex}`, lx: sx + (right ? 10 : -10), ly: acy - 8 };
  }
  // back up the page (a loop): out of the left side, along the left, into the target's left side
  const lane = Math.min(a.x, b.x) - 26 - (labelText === 'no' ? 10 : 0);
  return { d: `M${a.x},${acy} H${lane} V${bcy} H${b.x}`, lx: a.x - 12, ly: acy - 8 };
}

export function chartSvg(chart: Chart, o: SvgOpts = {}): string {
  const byId = new Map(chart.nodes.map((n) => [n.id, n]));
  const xs = chart.nodes.flatMap((n) => [n.x, n.x + W]), ys = chart.nodes.flatMap((n) => [n.y, n.y + heightOf(n)]);
  const minX = Math.min(0, ...xs) - 50, minY = Math.min(0, ...ys) - 16;
  const w = o.size?.w ?? Math.max(300, Math.max(...xs, 0) - minX + 50), h = o.size?.h ?? Math.max(120, Math.max(...ys, 0) - minY + 24);
  const vx = o.size ? 0 : minX, vy = o.size ? 0 : minY;
  const edges = chart.edges.map((e, i) => {
    const a = byId.get(e.from), b = byId.get(e.to);
    if (!a || !b) return '';
    const r = route(box(a), box(b), a.shape === 'decision', e.label);
    const lab = e.label ? `<text class="fc-label fc-${e.label}" x="${r.lx}" y="${r.ly}" text-anchor="middle">${e.label === 'yes' ? 'Yes' : 'No'}</text>` : '';
    const sel = o.selectedEdge === i ? ' is-selected' : '';
    return `<g class="fc-edge${sel}" data-edge="${i}"><path class="fc-hit" d="${r.d}" /><path class="fc-line" d="${r.d}" marker-end="url(#fc-arrow)" />${lab}</g>`;
  }).join('');
  const nodes = chart.nodes.map((n) => {
    const cls = ['fc-node', `fc-${n.shape}`, o.active === n.id && 'is-active', o.bad === n.id && 'is-bad', o.selected === n.id && 'is-selected', o.blanks && n.id in o.blanks && 'is-blank'].filter(Boolean).join(' ');
    const handle = o.editable && !(n.shape === 'terminal' && !/^\s*(start|begin)\b/i.test(n.text) && n.text.trim())
      ? `<circle class="fc-handle" data-handle="${esc(n.id)}" cx="${n.x + W / 2}" cy="${n.y + heightOf(n) + 1}" r="7"><title>Drag to another shape to add an arrow</title></circle>` : '';
    return `<g class="${cls}" data-node="${esc(n.id)}">${shape(n)}${label(n, o.blanks?.[n.id])}${handle}</g>`;
  }).join('');
  return `<svg class="fc-svg" xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Flowchart"><defs><marker id="fc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="fc-head" /></marker></defs>${edges}${nodes}</svg>`;
}
