/**
 * A tiny CommonJS module system for student code: each file is compiled with the lab compiler
 * (src/lab/engine/compile.ts: plain-English syntax errors, loop guard, TypeScript + JSX → plain JS)
 * and evaluated on demand. A fresh system per run.
 */
import { compileFile } from '../lab/engine/compile.ts';
import { createLoopGuard, PREVIEW_ENV } from '../lab/engine/guard.ts';
import type { Files } from './protocol.ts';

const EXT = ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.js'];

/** TSX → CommonJS. Throws an error that names the file and line, with a hint when there is one. */
export function compile(code: string, filePath: string): string {
  const result = compileFile(filePath, code);
  if (result.ok) return result.code;
  const { message, line, hint } = result.error;
  throw new Error(`${filePath} (line ${line}): ${message}${hint ? `\n${hint}` : ''}`);
}

function normalize(path: string): string {
  const out: string[] = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

/** './x', '../x' and '@/x' (project root, like the Expo template) → a file in `files`. */
export function resolve(from: string, spec: string, files: Files): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = normalize(spec.slice(2));
  else if (spec.startsWith('./') || spec.startsWith('../')) base = normalize([...from.split('/').slice(0, -1), spec].join('/'));
  else return null;
  // '@/x' is the project root in the Expo template and src/ with "paths": { "@/*": ["src/*"] }: try both
  for (const b of spec.startsWith('@/') ? [base, `src/${base}`] : [base]) for (const ext of EXT) if (files[b + ext] != null) return b + ext;
  return null;
}

export type ModuleSystem = { require: (spec: string, from?: string) => any };

export function createModuleSystem(files: Files, builtins: Record<string, unknown>, packageNames: string[] = ['react', 'react-native', 'expo-router']): ModuleSystem {
  const cache = new Map<string, { exports: any }>();
  const loopGuard = createLoopGuard((line) => new Error(`The loop on line ${line} never stopped, so it was halted. Check its condition: something inside the loop must change so it becomes false.`));
  const process = { env: { ...PREVIEW_ENV } };
  const load = (path: string) => {
    const hit = cache.get(path);
    if (hit) return hit.exports;
    const code = compile(files[path], path);
    const module = { exports: {} as any };
    cache.set(path, module);
    const fn = new Function('require', 'module', 'exports', '__labLoop', 'process', `${code}\n//# sourceURL=${path}`);
    fn((spec: string) => requireFrom(spec, path), module, module.exports, loopGuard, process);
    return module.exports;
  };
  const requireFrom = (spec: string, from: string): any => {
    if (Object.prototype.hasOwnProperty.call(builtins, spec)) return builtins[spec];
    if (files[spec] != null) return load(spec);
    const path = resolve(from, spec, files);
    if (path) return load(path);
    if (/^(\.|@\/)/.test(spec)) throw new Error(`Can't find file "${spec}" imported from "${from}".`);
    throw new Error(`The package "${spec}" isn't available in the browser runner. You can import: ${packageNames.join(', ')}.`);
  };
  return { require: (spec, from = '') => requireFrom(spec, from) };
}
