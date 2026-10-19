// Lets `node --test` import .tsx files (the preview runtimes): Sucrase strips the types and compiles JSX.
import { readFile } from 'node:fs/promises';
import { transform } from 'sucrase';

export async function load(url, context, nextLoad) {
  if (!url.endsWith('.tsx')) return nextLoad(url, context);
  const source = await readFile(new URL(url), 'utf8');
  const { code } = transform(source, { transforms: ['typescript', 'jsx'], jsxRuntime: 'automatic', production: true, filePath: url });
  return { format: 'module', source: code, shortCircuit: true };
}
