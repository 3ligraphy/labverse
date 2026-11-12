/**
 * The modules that ship with the code (seeds/index.ts), exactly as the database holds them after
 * PlatformStore.applySeeds: the seeds are replayed in order (create, update, extend, patch, publish).
 * Used when the database cannot be read (for example a hosting quota), so these modules still open:
 * answers are checked in the browser as usual, but nothing is saved until the database is back.
 */
import { orderFlow, type Flow, type LabNodeType } from './core.ts';
import { shippedSeeds, type Seed } from './seeds/index.ts';

export type ModuleRow = { slug: string; title: string; published: boolean; flow: Flow; labNodes: LabNodeType[] | null; created_at: string; updated_at: string };
export type LabRow = { module: string; slug: string; title: string; published: boolean; flow: Flow; created_at: string; updated_at: string };
export type ShippedModule = { module: ModuleRow; labs: LabRow[] };

const AT = '2026-10-28T00:00:00.000Z';
const labRow = (module: string, l: Seed['labs'][number]): LabRow => ({ module, slug: l.slug, title: l.title, published: true, flow: l.flow, created_at: AT, updated_at: AT });

export function shippedState(seeds: Seed[] = shippedSeeds()): Map<string, ShippedModule> {
  const out = new Map<string, ShippedModule>();
  for (const seed of seeds) {
    const m = seed.module;
    const cur = out.get(m.slug);
    const lab = (slug: string) => cur?.labs.find((l) => l.slug === slug);
    if (seed.publish) {
      for (const [slug, on] of Object.entries(seed.publish)) { const l = lab(slug); if (l) l.published = on; }
      continue;
    }
    if (seed.patch) {
      const root = cur && orderFlow(cur.module.flow, 'module')[0];
      if (cur && root) cur.module.flow = { ...cur.module.flow, nodes: cur.module.flow.nodes.map((n) => (n.id === root.id ? { ...n, data: { ...n.data, ...seed.patch } } : n)) };
      continue;
    }
    if (seed.extend) {
      if (!cur) continue;
      for (const l of seed.labs) if (!lab(l.slug)) cur.labs.push(labRow(m.slug, l));
      const flow = cur.module.flow;
      const have = new Set(flow.nodes.map((n) => n.id));
      const add = m.flow.nodes.filter((n) => !have.has(n.id));
      const last = orderFlow(flow, 'module').at(-1);
      if (add.length && last) {
        cur.module.flow = {
          nodes: [...flow.nodes, ...add.map((n, i) => ({ ...n, x: last.x, y: last.y + 150 * (i + 1) }))],
          edges: [...flow.edges, { from: last.id, to: add[0].id }, ...add.slice(1).map((n, i) => ({ from: add[i].id, to: n.id }))],
        };
      }
      continue;
    }
    if (seed.update) {
      for (const l of seed.labs) { const row = lab(l.slug); if (row) { row.title = l.title; row.flow = l.flow; } }
      continue;
    }
    // create: the module is inserted once (never overwritten); its labs are inserted when they do not exist yet
    if (!cur) out.set(m.slug, { module: { slug: m.slug, title: m.title, published: true, flow: m.flow, labNodes: m.labNodes, created_at: AT, updated_at: AT }, labs: seed.labs.map((l) => labRow(m.slug, l)) });
    else for (const l of seed.labs) if (!lab(l.slug)) cur.labs.push(labRow(m.slug, l));
  }
  return out;
}

let cache: Map<string, ShippedModule> | undefined;
/** shippedState() computed once per server instance (read-only: never change what it returns) */
export const shippedModules = () => (cache ??= shippedState());
