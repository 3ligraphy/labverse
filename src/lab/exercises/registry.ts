/**
 * Every interactive lab's exercise list (plain data), by the lab's content id (src/content/labs/<id>.mdx).
 * LAB_ID is the key progress is stored under (usually the same as the content id).
 */
import * as lab02 from './lab-02/meta.ts';
import * as lab03 from './lab-03/meta.ts';
import type { ExerciseMeta } from './lab-02/meta.ts';

type LabMeta = { LAB_ID: string; EXERCISES: ExerciseMeta[]; BLOCKS: readonly { n: number; part: number; time: string; title: string }[]; FINAL_ID: string };

export const INTERACTIVE_LABS: Record<string, LabMeta> = { 'lab-02': lab02, 'lab-03': lab03 };

/** An exercise's metadata, whichever lab it belongs to (ids are unique across labs). */
export function exerciseMeta(id: string): ExerciseMeta | undefined {
  for (const lab of Object.values(INTERACTIVE_LABS)) {
    const hit = lab.EXERCISES.find((e) => e.id === id);
    if (hit) return hit;
  }
  return undefined;
}

/** The interactive lab stored under this progress key, if any. */
export const labByKey = (key: string) => Object.values(INTERACTIVE_LABS).find((l) => l.LAB_ID === key);
