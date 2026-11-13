/**
 * Modules that ship with the code. The platform store applies each seed once per database, the first time it is
 * used after a deploy (server.ts → applySeeds), and records it in <prefix>_seeds. So no one has to run a script
 * against the live database, and a module that staff later edit or delete is never overwritten or brought back.
 * To change a module that is already live, ship a new seed id with update: true — it rewrites the content of its
 * labs once, only if they still exist (it never creates a module or a lab).
 */
import { compileLab, compileModule, nodesOfKits, sanitizeFlow, type Flow, type LabNodeType } from '../core.ts';
import { introComputingModule, introComputingRevisionLab } from './intro-computing-revision.ts';
import { introComputingPracticeLab } from './intro-computing-practice.ts';
import { introComputingTypeDrawLab } from './intro-computing-type-draw.ts';
import { aiForCodingLab01, aiForCodingModule } from './ai-for-coding.ts';

export type Seed = {
  id: string;
  /** rewrite the labs' content (once) instead of creating the module */
  update?: boolean;
  /** add these labs to the module that already exists: create them, and append their nodes to its canvas */
  extend?: boolean;
  /** set these fields on the module node of the module that already exists (everything else is kept) */
  patch?: Record<string, string>;
  /** publish (true) or hide (false) these labs of the module, by slug — hidden labs are kept, not deleted */
  publish?: Record<string, boolean>;
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
    // a second lab: practice questions on everything (open any time, tracked)
    { ...seed('intro-to-computing@5', 'intro-to-computing', introComputingModule(), nodesOfKits(['cpp']),
      [{ slug: 'revision-practice', flow: introComputingPracticeLab() }]), extend: true },
    // no invitation lock: anyone with the link opens the module and its labs (they enter a name and ID in each lab)
    { ...seed('intro-to-computing@6', 'intro-to-computing', introComputingModule(), nodesOfKits(['cpp']), []), patch: { public: 'Yes' } },
    // the practice lab without the complex numbers and quaternions part, and with more questions
    { ...seed('intro-to-computing@7', 'intro-to-computing', introComputingModule(), nodesOfKits(['cpp']),
      [{ slug: 'revision-practice', flow: introComputingPracticeLab() }]), update: true },
    // hide the week 6 revision lab from students for now (kept, not deleted; staff still open it in the builder)
    { ...seed('intro-to-computing@8', 'intro-to-computing', introComputingModule(), nodesOfKits(['cpp']), []), publish: { 'revision-week-6': false } },
    // the practice lab with theory questions from the lectures at the start (every question kept)
    { ...seed('intro-to-computing@9', 'intro-to-computing', introComputingModule(), nodesOfKits(['cpp']),
      [{ slug: 'revision-practice', flow: introComputingPracticeLab() }]), update: true },
    // the module page shows its teaching team: the module leader and the other lecturer (from the lecture slides)
    { ...seed('intro-to-computing@10', 'intro-to-computing', introComputingModule(), nodesOfKits(['cpp']), []),
      patch: { leader: 'gerard.mckee@bue.edu.eg', leaderName: 'Prof. Gerard McKee', lecturers: 'Assoc. Prof. Wessam El-Behaidy' } },
    // Lab 3: the class test answers, then C++ code and flowcharts from zero to hero (flowcharts that run)
    { ...seed('intro-to-computing@11', 'intro-to-computing', introComputingModule(), nodesOfKits(['cpp']),
      [{ slug: 'type-and-draw', flow: introComputingTypeDrawLab() }]), extend: true },
    // the three labs are shown again: the week 6 revision lab is visible next to the practice lab and Lab 3
    { ...seed('intro-to-computing@12', 'intro-to-computing', introComputingModule(), nodesOfKits(['cpp']), []), publish: { 'revision-week-6': true } },
    // AI FOR CODING: a new module in the Neon design, with Lab 01 — prompt engineering and coding agents
    seed('ai-for-coding@1', 'ai-for-coding', aiForCodingModule(), nodesOfKits(['ai']),
      [{ slug: 'lab-01', flow: aiForCodingLab01() }]),
    // Lab 01 gains a part on preparing a PRD for the coding agent (rewrites the lab once if @1 already created it)
    { ...seed('ai-for-coding@2', 'ai-for-coding', aiForCodingModule(), nodesOfKits(['ai']),
      [{ slug: 'lab-01', flow: aiForCodingLab01() }]), update: true },
  ];
}
