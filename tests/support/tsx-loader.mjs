// Lets `node --test` import .tsx files (the preview runtimes): Sucrase strips the types and compiles JSX.
// Also mirrors Vite's `?raw` imports (a file's text as the default export), used for bundled text such as rubrics.
import { readFile } from 'node:fs/promises';
import { transform } from 'sucrase';

export async function load(url, context, nextLoad) {
  if (new URL(url).searchParams.has('raw')) {
    const u = new URL(url);
    u.search = '';
    return { format: 'module', source: `export default ${JSON.stringify(await readFile(u, 'utf8'))};`, shortCircuit: true };
  }
  if (!url.endsWith('.tsx')) return nextLoad(url, context);
  const source = await readFile(new URL(url), 'utf8');
  const { code } = transform(source, { transforms: ['typescript', 'jsx'], jsxRuntime: 'automatic', production: true, filePath: url });
  return { format: 'module', source: code, shortCircuit: true };
}
