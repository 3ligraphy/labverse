/**
 * A flowchart as data, and its text format for lab authors (one shape, or one chain of arrows, per line):
 *   s start 0,0 Start                 id, kind, column,row on the grid, the text inside the shape
 *   i input 0,1 Input C               kinds: start, end, input, output, process, decision
 *   d decision 0,2 C > 30?
 *   s -> i -> d                       arrows; a decision has two: d -yes-> a  and  d -no-> b
 * Lines starting with # are comments. Shapes: start/end are ovals, input/output parallelograms,
 * process rectangles, decision diamonds.
 */
export type Shape = 'terminal' | 'io' | 'process' | 'decision';
export type FNode = { id: string; shape: Shape; text: string; x: number; y: number };
export type FEdge = { from: string; to: string; label?: 'yes' | 'no' };
export type Chart = { nodes: FNode[]; edges: FEdge[] };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** grid cell → pixels (the top-left corner of the shape's box) */
export const GRID = { x0: 40, y0: 24, dx: 220, dy: 100 } as const;

const KINDS: Record<string, Shape> = { start: 'terminal', end: 'terminal', terminal: 'terminal', input: 'io', output: 'io', io: 'io', process: 'process', decision: 'decision' };
export const isStartText = (t: string) => /^\s*(start|begin)\b/i.test(t);
export const isInputText = (t: string) => /^\s*(input|read|get|enter)\b/i.test(t);
const NODE = /^(\S+)\s+([a-z]+)\s+(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(?:\s+(.*))?$/i;
const ID = /^[A-Za-z_][\w-]*$/;

export function parseChart(src: string): Result<Chart> {
  const nodes: FNode[] = [];
  const chains: { line: number; parts: string[] }[] = [];
  const lines = src.split(/\r?\n/);
  for (const [i, raw] of lines.entries()) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = NODE.exec(line);
    if (m && !line.includes('->')) {
      const shape = KINDS[m[2].toLowerCase()];
      if (!shape) return { ok: false, error: `Line ${i + 1}: “${m[2]}” is not a shape (use start, end, input, output, process or decision).` };
      if (!ID.test(m[1])) return { ok: false, error: `Line ${i + 1}: “${m[1]}” is not a good id (letters, digits, _ and -).` };
      if (nodes.some((n) => n.id === m[1])) return { ok: false, error: `Line ${i + 1}: the id “${m[1]}” is used twice.` };
      nodes.push({ id: m[1], shape, text: (m[5] ?? '').replace(/\\n/g, '\n').trim(), x: GRID.x0 + Number(m[3]) * GRID.dx, y: GRID.y0 + Number(m[4]) * GRID.dy });
      continue;
    }
    if (line.includes('->')) {
      const parts = line.split(/\s*(-(?:yes|no)->|->)\s*/i);
      if (parts.length < 3 || parts.some((p, k) => k % 2 === 0 && !p)) return { ok: false, error: `Line ${i + 1}: write arrows like “a -> b” or “d -yes-> c”.` };
      chains.push({ line: i + 1, parts });
      continue;
    }
    return { ok: false, error: `Line ${i + 1}: I don't understand “${line}”.` };
  }
  const ids = new Set(nodes.map((n) => n.id));
  const edges: FEdge[] = [];
  for (const { line, parts } of chains) {
    for (let k = 0; k + 2 < parts.length; k += 2) {
      const [from, arrow, to] = [parts[k], parts[k + 1].toLowerCase(), parts[k + 2]];
      for (const id of [from, to]) if (!ids.has(id)) return { ok: false, error: `Line ${line}: there is no shape “${id}”.` };
      const label = arrow === '-yes->' ? 'yes' : arrow === '-no->' ? 'no' : undefined;
      edges.push(label ? { from, to, label } : { from, to });
    }
  }
  return { ok: true, value: { nodes, edges } };
}

const num = (v: number) => String(Math.round(v * 100) / 100);
export function chartToText(c: Chart): string {
  const kind = (n: FNode) => n.shape === 'terminal' ? (isStartText(n.text) ? 'start' : 'end') : n.shape === 'io' ? (isInputText(n.text) ? 'input' : 'output') : n.shape;
  const nodes = c.nodes.map((n) => `${n.id} ${kind(n)} ${num((n.x - GRID.x0) / GRID.dx)},${num((n.y - GRID.y0) / GRID.dy)} ${n.text.replace(/\n/g, '\\n')}`);
  const edges = c.edges.map((e) => `${e.from} ${e.label ? `-${e.label}->` : '->'} ${e.to}`);
  return [...nodes, ...edges].join('\n');
}
