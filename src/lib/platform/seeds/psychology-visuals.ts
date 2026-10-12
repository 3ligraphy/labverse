import type { Flow } from '../core.ts';
import { psychologyVisuals, type PsychologyVisual } from '../psychology-guide.ts';

/** Insert visual guides alongside existing tasks without changing task IDs or progress numbering. */
const guides: Record<string, PsychologyVisual[]> = {
  'task-orientation': ['workspace'],
  'task-plan': ['sitemap', 'prompt'],
  'task-launch': ['playground'],
  'task-identity': ['dashboard'],
  'task-pages-posts': ['content'],
  'task-about-together': ['editor'],
  'task-save1': ['save', 'export', 'backup'],
  'task-restore': ['restore'],
  'task-conditions': ['content'],
  'task-spot': ['prompt'],
  'task-media': ['alt'],
  'task-edit-code': ['code'],
  'task-hero-code': ['editor'],
  'task-final': ['export', 'backup'],
};

export function addPsychologyVisuals(input: Flow): Flow {
  const flow: Flow = structuredClone(input);
  for (const task of [...flow.nodes]) {
    const keys = guides[task.id];
    if (!keys || flow.nodes.some((n) => n.id === `visual-${task.id}-0`)) continue;
    const outgoing = flow.edges.filter((e) => e.from === task.id);
    if (outgoing.length !== 1) throw new Error(`Cannot add visual guide to branching task ${task.id}.`);
    const inserted: Flow['nodes'] = [];
    keys.forEach((key, i) => {
      const visual = psychologyVisuals[key];
      inserted.push({ id: `visual-${task.id}-${i}`, type: 'image', x: task.x + 360, y: task.y + i * 150,
        data: { src: visual.src, alt: visual.alt, caption: `${visual.caption}${visual.source ? ' Official reference screenshot; your version may look slightly different.' : ''}` } });
      if (visual.source) inserted.push({ id: `visual-source-${task.id}-${i}`, type: 'text', x: task.x + 360, y: task.y + i * 150 + 70,
        data: { body: `[Screenshot source: WordPress documentation](${visual.source}). Select the image to enlarge it.` } });
    });
    flow.edges = flow.edges.filter((e) => e !== outgoing[0]);
    flow.edges.push({ from: task.id, to: inserted[0].id }, ...inserted.slice(1).map((n, i) => ({ from: inserted[i].id, to: n.id })), { from: inserted.at(-1)!.id, to: outgoing[0].to });
    flow.nodes.push(...inserted);
  }
  return flow;
}
