/**
 * Builds a tidy flowchart (the text format of ./chart.ts) from a short list of steps, so lab authors write the
 * perfect solution once and the layout is always the same:
 *   'int a = 0, b = 0'                         a rectangle (declarations or calculations)
 *   'Input a, b' / 'Output "Sum = ", sum'      a parallelogram
 *   { if: 'a > b', yes: [...], no: [...] }     a diamond; Yes goes to the right, No continues down
 *   { while: 'k <= n', body: [...] }           a diamond with the body under it and an arrow back up; the shapes
 *                                              after the loop continue in the next column, from its No arrow
 * Start is added at the top and End at the bottom.
 */
export type FStep = string | { if: string; yes: FStep[]; no?: FStep[] } | { while: string; body: FStep[] };
type Exit = { id: string; label?: 'yes' | 'no' };
type Block = { entry: string; exits: Exit[]; width: number; next: { col: number; row: number } };

const kindOf = (t: string) => (/^\s*(input|read|get|enter|getline)\b/i.test(t) ? 'input' : /^\s*(output|print|display|write|show)\b/i.test(t) ? 'output' : 'process');
const ask = (t: string) => (t.trim().endsWith('?') ? t.trim() : `${t.trim()}?`);

export function buildChart(steps: FStep[]): string {
  let count = 0;
  const nodes: string[] = [];
  const edges: string[] = [];
  const id = () => `n${++count}`;
  const link = (x: Exit, to: string) => edges.push(`${x.id} ${x.label ? `-${x.label}->` : '->'} ${to}`);

  function seq(list: FStep[], col: number, row: number): Block | null {
    let first: string | null = null;
    let exits: Exit[] = [];
    let width = 1;
    let at = { col, row };
    for (const step of list) {
      const b = one(step, at.col, at.row);
      if (!first) first = b.entry;
      for (const x of exits) link(x, b.entry);
      exits = b.exits;
      width = Math.max(width, at.col - col + b.width);
      at = b.next;
    }
    return first ? { entry: first, exits, width, next: at } : null;
  }

  function one(step: FStep, col: number, row: number): Block {
    if (typeof step === 'string') {
      const n = id();
      nodes.push(`${n} ${kindOf(step)} ${col},${row} ${step.trim()}`);
      return { entry: n, exits: [{ id: n }], width: 1, next: { col, row: row + 1 } };
    }
    const d = id();
    if ('while' in step) {
      nodes.push(`${d} decision ${col},${row} ${ask(step.while)}`);
      const body = seq(step.body, col, row + 1);
      if (body) {
        edges.push(`${d} -yes-> ${body.entry}`);
        for (const x of body.exits) link(x, d);
      }
      const w = body?.width ?? 1;
      return { entry: d, exits: [{ id: d, label: 'no' }], width: w + 1, next: { col: col + w, row: row + 1 } };
    }
    nodes.push(`${d} decision ${col},${row} ${ask(step.if)}`);
    const no = step.no?.length ? seq(step.no, col, row + 1) : null;
    const yesCol = col + (no?.width ?? 1);
    const yes = step.yes.length ? seq(step.yes, yesCol, row + 1) : null;
    if (yes) edges.push(`${d} -yes-> ${yes.entry}`);
    if (no) edges.push(`${d} -no-> ${no.entry}`);
    const exits = [...(yes ? yes.exits : [{ id: d, label: 'yes' as const }]), ...(no ? no.exits : [{ id: d, label: 'no' as const }])];
    const bottom = Math.max(yes?.next.row ?? row + 1, no?.next.row ?? row + 1);
    return { entry: d, exits, width: (no?.width ?? 1) + (yes?.width ?? 1), next: { col, row: bottom } };
  }

  nodes.push('s start 0,0 Start');
  const main = seq(steps, 0, 1);
  const endAt = main?.next ?? { col: 0, row: 1 };
  nodes.push(`e end ${endAt.col},${endAt.row} End`);
  if (main) { edges.push(`s -> ${main.entry}`); for (const x of main.exits) link(x, 'e'); } else edges.push('s -> e');
  return [...nodes, ...edges].join('\n');
}
