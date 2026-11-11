// Lets `node --test` import .tsx files (the preview runtimes): Sucrase strips the types and compiles JSX.
// Also mirrors Vite's `?raw` imports (a file's text as the default export), used for bundled text such as rubrics.
// The code editor (src/ide) is written for Vite: its imports have no extension ('./fs') and it uses TypeScript that
// Node cannot strip (constructor parameter properties), so those files resolve like Vite and go through Sucrase too.
import { readFile } from 'node:fs/promises';
import { transform } from 'sucrase';

const IDE = '/src/ide/';

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const relative = specifier.startsWith('./') || specifier.startsWith('../');
    if (error?.code !== 'ERR_MODULE_NOT_FOUND' || !relative || /\.[a-z]+$/i.test(specifier) || !context.parentURL?.includes(IDE)) throw error;
    for (const ext of ['.ts', '.tsx', '/index.ts']) {
      try { return await nextResolve(specifier + ext, context); } catch { /* try the next one */ }
    }
    throw error;
  }
}

export async function load(url, context, nextLoad) {
  if (new URL(url).searchParams.has('raw')) {
    const u = new URL(url);
    u.search = '';
    return { format: 'module', source: `export default ${JSON.stringify(await readFile(u, 'utf8'))};`, shortCircuit: true };
  }
  const ideTs = url.includes(IDE) && url.endsWith('.ts');
  if (!url.endsWith('.tsx') && !ideTs) return nextLoad(url, context);
  const source = await readFile(new URL(url), 'utf8');
  const { code } = transform(source, { transforms: ideTs ? ['typescript'] : ['typescript', 'jsx'], jsxRuntime: 'automatic', production: true, filePath: url });
  return { format: 'module', source: code, shortCircuit: true };
}
