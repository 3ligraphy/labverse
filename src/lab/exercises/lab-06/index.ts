/** Lab 06 registry: every exercise in page order (ids must match meta.ts). */
import type { Exercise } from '../types.ts';
import { ex01 } from './part1.ts';
import { ex02, ex03, ex04 } from './part2.ts';
import { ex05, ex06 } from './part3.ts';
import { ex07, ex08 } from './part4.ts';
import { ex09, ex10, ex11, ex12 } from './part5.ts';
import { ex11Auth, ex13Policies, ex15Realtime, ex16Errors } from './part5b.ts';
import { ex13, ex14 } from './part6.ts';

export { demos } from './demos.ts';
export { LAB_ID, EXERCISES, BLOCKS, FINAL_ID } from './meta.ts';

export const exercises: Exercise[] = [ex01, ex02, ex03, ex04, ex05, ex06, ex07, ex08, ex09, ex10, ex11Auth, ex11, ex13Policies, ex12, ex15Realtime, ex16Errors, ex13, ex14];

export const byId = (id: string) => exercises.find((e) => e.id === id);
