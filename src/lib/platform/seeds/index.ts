/**
 * Modules that ship with the code. The platform store applies each seed once per database, the first time it is
 * used after a deploy (server.ts → applySeeds), and records it in <prefix>_seeds. So no one has to run a script
 * against the live database, and a module that staff later edit or delete is never overwritten or brought back.
 * To change a module that is already live, ship a new seed id with update: true — it rewrites the content of its
 * labs once, only if they still exist (it never creates a module or a lab).
 */
import { compileLab, compileModule, nodesOfKits, sanitizeFlow, type Flow, type LabNodeType } from '../core.ts';
import { introComputingModule, introComputingRevisionLab } from './intro-computing-revision.ts';

export type Seed = {
  id: string;
  /** rewrite the labs' content (once) instead of creating the module */
  update?: boolean;
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
    // adds Part 1 "Start here: the words of C++" to the lab that @1 already created
    { ...seed('intro-to-computing@2', 'intro-to-computing', introComputingModule(), nodesOfKits(['cpp']),
      [{ slug: 'revision-week-6', flow: introComputingRevisionLab() }]), update: true },
    // a first program explained line by line, the learning order and plain English
    { ...seed('intro-to-computing@3', 'intro-to-computing', introComputingModule(), nodesOfKits(['cpp']),
      [{ slug: 'revision-week-6', flow: introComputingRevisionLab() }]), update: true },
    // the café comparison is replaced by a plain line-by-line explanation
    { ...seed('intro-to-computing@4', 'intro-to-computing', introComputingModule(), nodesOfKits(['cpp']),
      [{ slug: 'revision-week-6', flow: introComputingRevisionLab() }]), update: true },
  ];
}
