/**
 * Modules that ship with the code. The platform store applies each seed once per database, the first time it is
 * used after a deploy (server.ts → applySeeds), and records it in <prefix>_seeds. So no one has to run a script
 * against the live database, and a module that staff later edit or delete is never overwritten or brought back.
 * A changed seed needs a new id (e.g. "…@2") to run again.
 */
import { compileLab, compileModule, nodesOfKits, sanitizeFlow, type Flow, type LabNodeType } from '../core.ts';
import { introComputingModule, introComputingRevisionLab } from './intro-computing-revision.ts';

export type Seed = {
  id: string;
  module: { slug: string; title: string; flow: Flow; labNodes: LabNodeType[] };
  labs: { slug: string; title: string; flow: Flow }[];
};

function seed(id: string, slug: string, moduleFlow: Flow, labNodes: LabNodeType[], labs: { slug: string; flow: Flow }[]): Seed {
  const m = sanitizeFlow(moduleFlow, 'module');
  if (!m.ok) throw new Error(`seed ${id}: ${m.error}`);
  return {
    id,
    module: { slug, title: compileModule(m.value).meta.title || slug, flow: m.value, labNodes },
    labs: labs.map((l) => {
      const r = sanitizeFlow(l.flow, 'lab');
      if (!r.ok) throw new Error(`seed ${id}, lab ${l.slug}: ${r.error}`);
      return { slug: l.slug, title: compileLab(r.value, `${slug}--${l.slug}`).meta.title, flow: r.value };
    }),
  };
}

export function shippedSeeds(): Seed[] {
  return [
    seed('intro-to-computing@1', 'intro-to-computing', introComputingModule(), nodesOfKits(['cpp']),
      [{ slug: 'revision-week-6', flow: introComputingRevisionLab() }]),
  ];
}
