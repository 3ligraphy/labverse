/** Lab 07 registry: every exercise in page order (ids must match meta.ts). */
import type { Exercise } from '../types.ts';
import { ex01, ex02, ex03, ex04 } from './intro.ts';
import { ex05, ex06, ex07, ex08 } from './build.ts';
import { ex09, ex10, ex11, ex12, ex13 } from './testing.ts';
import { ex14, ex15, ex16, exEasConfig } from './deploy.ts';
import { exComponentTests, exMaestroRun, exUnitTests } from './runners.ts';
import { ex17 } from './final.ts';

export { demos } from './demos.ts';
export { LAB_ID, EXERCISES, BLOCKS, FINAL_ID } from './meta.ts';

export const exercises: Exercise[] = [ex01, ex02, ex03, ex04, ex05, ex06, ex07, ex08, ex09, ex10, exUnitTests, ex11, ex12, exComponentTests, ex13, exMaestroRun, ex14, ex15, exEasConfig, ex16, ex17];

export const byId = (id: string) => exercises.find((e) => e.id === id);
