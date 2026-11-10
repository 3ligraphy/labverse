/**
 * Suggestions beyond what Monaco ships with:
 *  1. Type acquisition — the real type definitions of the packages a project uses (react, react-native, expo-router,
 *     nativewind, express, node…) are downloaded from the npm CDN and given to the TypeScript service, so
 *     completions, hovers, parameter hints and go-to-definition work for library code too.
 *  2. Tailwind / NativeWind class names inside className="…" and class="…".
 *  3. Keywords and snippets for languages that have no language service in the browser (Python, C++, Java, …).
 */
import * as monaco from 'monaco-editor';
import { debounce } from '../core/dom';
import { register } from '../core/commands';
import type { IDE } from '../core/ide';

const CDN = 'https://cdn.jsdelivr.net/npm/';
const tsApi: any = (monaco as any).typescript ?? (monaco.languages as any).typescript;

/* ================================================================== 1. type acquisition */
type Pkg = { name: string; version: string; files: Set<string>; json: any };
const NODE_BUILTINS = new Set(['fs', 'path', 'http', 'https', 'os', 'url', 'util', 'events', 'stream', 'crypto', 'child_process', 'buffer', 'zlib', 'net', 'readline', 'assert', 'process', 'worker_threads', 'querystring', 'timers', 'dns', 'tls']);
const IMPORT_RE = /(?:from\s+|import\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"\n]+)['"]|\/\/\/\s*<reference\s+(?:path|types)\s*=\s*["']([^"']+)["']/g;
const pkgNameOf = (spec: string) => (spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]);

class TypeAcquisition {
  private pkgs = new Map<string, Promise<Pkg | null>>();
  private added = new Set<string>();
  private queue: (() => Promise<void>)[] = [];
  private active = 0;
  private files = 0;
  private pending = 0;
  constructor(private ide: IDE) {}

  private status() {
    this.ide.wb.status('types', 'left', 50, this.pending > 0 ? { iconName: 'sync', text: `Types: ${this.files}`, title: 'Downloading type definitions for IntelliSense…' } : {});
  }
  private task<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const go = async () => { this.active++; try { resolve(await fn()); } catch (e) { reject(e); } finally { this.active--; this.queue.shift()?.(); } };
      if (this.active < 12) void go(); else this.queue.push(go);
    });
  }
  private async get(url: string): Promise<Response | null> {
    try { const r = await this.task(() => fetch(url)); return r.ok ? r : null; } catch { return null; }
  }

  private pkg(name: string, range = 'latest'): Promise<Pkg | null> {
    const hit = this.pkgs.get(name);
    if (hit) return hit;
    const p = (async (): Promise<Pkg | null> => {
      const clean = range.replace(/^(workspace:|npm:)/, '') || 'latest';
      const res = await this.get(`${CDN}${name}@${encodeURIComponent(/^[\w.~^<>=*| -]+$/.test(clean) ? clean : 'latest')}/package.json`) ?? await this.get(`${CDN}${name}/package.json`);
      if (!res) return null;
      const json = await res.json().catch(() => null);
      if (!json?.version) return null;
      const flat = await this.get(`https://data.jsdelivr.com/v1/packages/npm/${name}@${json.version}?structure=flat`);
      const listing = flat ? await flat.json().catch(() => null) : null;
      const files = new Set<string>(((listing?.files ?? []) as { name: string }[]).map((f) => f.name).filter((n) => /\.d\.(ts|mts|cts)$|package\.json$/.test(n)));
      return { name, version: json.version, files, json };
    })();
    this.pkgs.set(name, p);
    return p;
  }

  /** The .d.ts a package's `spec` (subpath '' = the root) points at. */
  private entryOf(p: Pkg, sub: string): string | null {
    const has = (f: string) => p.files.has(f);
    const tryPath = (base: string): string | null => {
      const b = '/' + base.replace(/^\.?\//, '').replace(/\.(js|mjs|cjs|jsx)$/, '');
      for (const c of [b, `${b}.d.ts`, `${b}.d.mts`, `${b}/index.d.ts`, b.replace(/\.ts$/, '.d.ts')]) if (/\.d\.(ts|mts|cts)$/.test(c) && has(c)) return c;
      return null;
    };
    if (!sub) {
      const exp = p.json.exports?.['.'];
      const fromExports = typeof exp === 'object' && exp ? exp.types ?? exp.import?.types ?? exp.require?.types ?? exp.default?.types : null;
      for (const cand of [fromExports, p.json.types, p.json.typings, p.json.main, 'index']) { if (typeof cand === 'string') { const r = tryPath(cand); if (r) return r; } }
      return null;
    }
    const exp = p.json.exports?.[`./${sub}`];
    const t = typeof exp === 'object' && exp ? exp.types ?? exp.import?.types ?? exp.require?.types ?? exp.default?.types : typeof exp === 'string' ? exp : null;
    return (typeof t === 'string' && tryPath(t)) || tryPath(sub);
  }

  private async addFile(p: Pkg, path: string, depth: number): Promise<void> {
    const virt = `file:///node_modules/${p.name}${path}`;
    if (this.added.has(virt) || this.files > 700) return;
    this.added.add(virt);
    this.pending++; this.status();
    try {
      const res = await this.get(`${CDN}${p.name}@${p.version}${path}`);
      if (!res) return;
      const text = await res.text();
      tsApi.typescriptDefaults.addExtraLib(text, virt);
      tsApi.javascriptDefaults.addExtraLib(text, virt);
      this.files++;
      const dir = path.slice(0, path.lastIndexOf('/'));
      const jobs: Promise<void>[] = [];
      for (const m of text.matchAll(IMPORT_RE)) {
        const spec = m[1] ?? m[2];
        const isRefTypes = Boolean(m[2]) && /reference\s+types/.test(m[0]);
        if (!spec) continue;
        if (!isRefTypes && (spec.startsWith('.') || (m[2] && !spec.startsWith('@') && spec.includes('.d.ts')))) {
          const parts = (dir + '/' + spec).split('/');
          const out: string[] = [];
          for (const s of parts) { if (!s || s === '.') continue; if (s === '..') out.pop(); else out.push(s); }
          const base = '/' + out.join('/').replace(/\.(js|mjs|cjs|jsx)$/, '');
          const hit = [base, `${base}.d.ts`, `${base}.d.mts`, `${base}/index.d.ts`].find((c) => /\.d\.(ts|mts|cts)$/.test(c) && p.files.has(c));
          if (hit) jobs.push(this.addFile(p, hit, depth));
        } else if (depth < 1 && !/^(metro|@expo\/metro|postcss|tailwindcss|@babel\/|@types\/(node|ws|connect|yargs|babel))/.test(spec) && !spec.startsWith('node:') && !NODE_BUILTINS.has(pkgNameOf(spec))) {
          const dep = pkgNameOf(spec);
          const range = p.json.dependencies?.[dep] ?? p.json.peerDependencies?.[dep] ?? 'latest';
          jobs.push(this.acquire(spec, range, depth + 1));
        }
      }
      await Promise.all(jobs);
    } finally { this.pending--; this.status(); }
  }

  private wanted = new Set<string>();
  /** Makes `import … from spec` resolve to real types (the package's own, or @types/…). */
  async acquire(spec: string, range = 'latest', depth = 0): Promise<void> {
    if (!/^(@[\w.-]+\/)?[\w.-]+(\/[\w./-]+)?$/.test(spec)) return;
    if (this.wanted.has(spec)) return;
    this.wanted.add(spec);
    const name = pkgNameOf(spec);
    const sub = spec.slice(name.length + 1);
    this.pending++; this.status();
    try {
      let p = await this.pkg(name, range);
      let entry = p ? this.entryOf(p, sub) : null;
      if (!entry && !name.startsWith('@types/')) {
        // no types of its own: DefinitelyTyped (@types/react, @types/scope__name)
        const typed = `@types/${name.startsWith('@') ? name.slice(1).replace('/', '__') : name}`;
        const tp = await this.pkg(typed);
        const te = tp ? this.entryOf(tp, sub) : null;
        if (tp && te) { p = tp; entry = te; }
      }
      if (!p || !entry) return;
      const pj = `file:///node_modules/${p.name}/package.json`;
      if (!this.added.has(pj)) {
        this.added.add(pj);
        const text = JSON.stringify({ name: p.name, version: p.version, types: p.json.types ?? p.json.typings, typings: p.json.typings, main: p.json.main, exports: p.json.exports, typesVersions: p.json.typesVersions });
        tsApi.typescriptDefaults.addExtraLib(text, pj); tsApi.javascriptDefaults.addExtraLib(text, pj);
      }
      await this.addFile(p, entry, depth);
    } finally { this.pending--; this.status(); }
  }

  /** Looks at package.json and at the imports in the source files, and fetches what is missing. */
  async scan() {
    const { fs, editors } = this.ide;
    let deps: Record<string, string> = {};
    try { const j = JSON.parse(await fs.readText('/package.json')); deps = { ...j.devDependencies, ...j.dependencies }; } catch { /* no package.json */ }
    const specs = new Map<string, string>();
    let node = false;
    for (const path of (await fs.walk('/')).filter((p) => /\.(tsx?|jsx?|mjs|cjs|mts)$/.test(p)).slice(0, 300)) {
      let text: string;
      try { text = editors.getModelIfOpen(path)?.getValue() ?? (await fs.readText(path)); } catch { continue; }
      if (text.length > 400_000) continue;
      for (const m of text.matchAll(IMPORT_RE)) {
        const spec = m[1] ?? m[2];
        if (!spec || spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('@/') || spec.startsWith('~')) continue;
        if (spec.startsWith('node:') || NODE_BUILTINS.has(pkgNameOf(spec))) { node = true; continue; }
        if (/\.(css|scss|png|jpe?g|svg|json)$/.test(spec)) continue;
        specs.set(spec, deps[pkgNameOf(spec)] ?? 'latest');
      }
    }
    const rn = Boolean(deps['react-native'] || deps.expo || specs.has('react-native'));
    if (specs.has('react') || deps.react || rn) { specs.set('react', deps.react ?? 'latest'); specs.set('react/jsx-runtime', deps.react ?? 'latest'); }
    if (rn) specs.set('react-native', deps['react-native'] ?? 'latest');
    if (deps.nativewind || specs.has('nativewind')) {
      specs.set('nativewind/types', deps.nativewind ?? 'latest');
      // className on React Native components, even when the project has no nativewind-env.d.ts
      if (!this.added.has('nw-env')) { this.added.add('nw-env'); tsApi.typescriptDefaults.addExtraLib('/// <reference types="nativewind/types" />\n', 'file:///__ide/nativewind-env.d.ts'); }
    }
    if (node || (deps && Object.keys(deps).length && !rn)) specs.set('@types/node', deps['@types/node'] ?? 'latest');
    await Promise.all([...specs].map(([spec, range]) => this.acquire(spec, range).catch(() => {})));
  }
}

/* ================================================================== 2. Tailwind / NativeWind classes */
function tailwindClasses(): string[] {
  const out: string[] = [];
  const scale = ['0', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '5', '6', '7', '8', '9', '10', '11', '12', '14', '16', '20', '24', '28', '32', '36', '40', '44', '48', '52', '56', '60', '64', '72', '80', '96', 'px'];
  for (const p of ['p', 'px', 'py', 'pt', 'pr', 'pb', 'pl', 'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml', 'gap', 'gap-x', 'gap-y', 'w', 'h', 'min-w', 'min-h', 'max-w', 'max-h', 'top', 'right', 'bottom', 'left', 'inset', 'size', 'space-x', 'space-y']) for (const s of scale) out.push(`${p}-${s}`);
  for (const p of ['m', 'mx', 'my', 'mt', 'mr', 'mb', 'ml']) { out.push(`${p}-auto`); for (const s of ['1', '2', '3', '4', '6', '8']) out.push(`-${p}-${s}`); }
  for (const p of ['w', 'h']) out.push(`${p}-full`, `${p}-screen`, `${p}-auto`, `${p}-1/2`, `${p}-1/3`, `${p}-2/3`, `${p}-1/4`, `${p}-3/4`, `${p}-fit`);
  out.push('max-w-xs', 'max-w-sm', 'max-w-md', 'max-w-lg', 'max-w-xl', 'max-w-2xl', 'max-w-full', 'min-h-screen', 'min-w-0', 'min-h-0');
  const colors = ['slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'];
  const shades = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
  for (const p of ['bg', 'text', 'border', 'shadow', 'ring', 'divide', 'placeholder']) { out.push(`${p}-white`, `${p}-black`, `${p}-transparent`); for (const c of colors) for (const s of shades) out.push(`${p}-${c}-${s}`); }
  out.push(
    'flex', 'flex-1', 'flex-row', 'flex-col', 'flex-row-reverse', 'flex-col-reverse', 'flex-wrap', 'flex-nowrap', 'flex-none', 'flex-auto', 'flex-grow', 'flex-shrink', 'grow', 'grow-0', 'shrink', 'shrink-0', 'hidden', 'block', 'inline', 'inline-flex', 'grid',
    'items-start', 'items-center', 'items-end', 'items-stretch', 'items-baseline', 'justify-start', 'justify-center', 'justify-end', 'justify-between', 'justify-around', 'justify-evenly', 'self-start', 'self-center', 'self-end', 'self-stretch', 'self-auto', 'content-center', 'content-start', 'content-end',
    'absolute', 'relative', 'fixed', 'sticky', 'z-0', 'z-10', 'z-20', 'z-30', 'z-40', 'z-50', 'overflow-hidden', 'overflow-visible', 'overflow-scroll',
    'text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl', 'text-6xl', 'text-left', 'text-center', 'text-right', 'text-justify',
    'font-thin', 'font-light', 'font-normal', 'font-medium', 'font-semibold', 'font-bold', 'font-extrabold', 'font-black', 'italic', 'not-italic', 'uppercase', 'lowercase', 'capitalize', 'normal-case', 'underline', 'line-through', 'no-underline',
    'leading-none', 'leading-tight', 'leading-snug', 'leading-normal', 'leading-relaxed', 'leading-loose', 'tracking-tighter', 'tracking-tight', 'tracking-normal', 'tracking-wide', 'tracking-wider', 'tracking-widest',
    'rounded', 'rounded-none', 'rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-3xl', 'rounded-full', 'rounded-t-lg', 'rounded-b-lg', 'rounded-l-lg', 'rounded-r-lg', 'rounded-t-xl', 'rounded-b-xl', 'rounded-t-2xl', 'rounded-b-2xl',
    'border', 'border-0', 'border-2', 'border-4', 'border-8', 'border-t', 'border-b', 'border-l', 'border-r', 'border-t-2', 'border-b-2', 'border-solid', 'border-dashed', 'border-dotted',
    'shadow', 'shadow-sm', 'shadow-md', 'shadow-lg', 'shadow-xl', 'shadow-2xl', 'shadow-none', 'opacity-0', 'opacity-25', 'opacity-50', 'opacity-75', 'opacity-100',
    'aspect-square', 'aspect-video', 'object-cover', 'object-contain', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4', 'col-span-1', 'col-span-2', 'col-span-3',
    'transition', 'duration-150', 'duration-300', 'ease-in', 'ease-out', 'ease-in-out', 'scale-95', 'scale-100', 'scale-105', 'rotate-45', 'rotate-90', 'rotate-180',
  );
  return out;
}
const VARIANTS = ['dark:', 'active:', 'focus:', 'disabled:', 'hover:', 'sm:', 'md:', 'lg:', 'ios:', 'android:', 'web:'];

function installTailwind() {
  const all = tailwindClasses();
  const provider: monaco.languages.CompletionItemProvider = {
    triggerCharacters: ['"', "'", ' ', '-', ':', '`'],
    provideCompletionItems(model, position) {
      const before = model.getValueInRange({ startLineNumber: Math.max(1, position.lineNumber - 6), startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column });
      // inside className="…", class="…", className={`…`} or cn('…') / clsx('…')
      if (!/(?:class(?:Name)?\s*=\s*(?:\{\s*)?|\b(?:cn|clsx|tw|twMerge|cva)\(\s*(?:[^)]*,\s*)?)["'`][^"'`]*$/.test(before)) return { suggestions: [] };
      const word = /[\w\-:./]*$/.exec(model.getLineContent(position.lineNumber).slice(0, position.column - 1))![0];
      const range = new monaco.Range(position.lineNumber, position.column - word.length, position.lineNumber, position.column);
      const variant = /^(?:[\w-]+:)+/.exec(word)?.[0] ?? '';
      const items = [...all.map((c) => variant + c), ...(variant ? [] : VARIANTS)];
      return {
        suggestions: items.map((label, i) => {
          const color = /-(?:[a-z]+)-(\d{2,3})$|-(white|black)$/.test(label);
          return { label, kind: label.endsWith(':') ? monaco.languages.CompletionItemKind.Keyword : color ? monaco.languages.CompletionItemKind.Color : monaco.languages.CompletionItemKind.Constant, insertText: label, range, sortText: String(i).padStart(5, '0'), detail: 'Tailwind / NativeWind' };
        }),
      };
    },
  };
  for (const lang of ['typescript', 'javascript', 'html']) monaco.languages.registerCompletionItemProvider(lang, provider);
}

/* ================================================================== 3. keywords + snippets */
const S = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
const SNIPPETS: Record<string, [string, string, string][]> = {
  python: [
    ['def', 'def ${1:name}(${2:args}):\n    ${0:pass}', 'function'], ['class', 'class ${1:Name}:\n    def __init__(self${2:, args}):\n        ${0:pass}', 'class'],
    ['for', 'for ${1:item} in ${2:items}:\n    ${0:pass}', 'for loop'], ['forr', 'for ${1:i} in range(${2:n}):\n    ${0:pass}', 'for range loop'], ['while', 'while ${1:condition}:\n    ${0:pass}', 'while loop'],
    ['if', 'if ${1:condition}:\n    ${0:pass}', 'if'], ['ifelse', 'if ${1:condition}:\n    ${2:pass}\nelse:\n    ${0:pass}', 'if / else'], ['try', 'try:\n    ${1:pass}\nexcept ${2:Exception} as ${3:e}:\n    ${0:print(e)}', 'try / except'],
    ['main', "if __name__ == '__main__':\n    ${0:main()}", 'main guard'], ['with', "with open(${1:'file.txt'}) as ${2:f}:\n    ${0:data = f.read()}", 'with open'], ['print', 'print(${0})', 'print'], ['input', "${1:name} = input('${2:prompt}: ')", 'input'],
    ['lambda', 'lambda ${1:x}: ${0:x}', 'lambda'], ['listcomp', '[${1:x} for ${1:x} in ${2:items}${3: if ${4:condition}}]', 'list comprehension'],
  ],
  cpp: [
    ['main', '#include <iostream>\nusing namespace std;\n\nint main() {\n    ${0}\n    return 0;\n}', 'main program'], ['cout', 'cout << ${1:value} << endl;', 'print'], ['cin', 'cin >> ${1:variable};', 'read input'],
    ['for', 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${0}\n}', 'for loop'], ['while', 'while (${1:condition}) {\n    ${0}\n}', 'while loop'], ['dowhile', 'do {\n    ${0}\n} while (${1:condition});', 'do while loop'],
    ['if', 'if (${1:condition}) {\n    ${0}\n}', 'if'], ['ifelse', 'if (${1:condition}) {\n    ${2}\n} else {\n    ${0}\n}', 'if / else'], ['switch', 'switch (${1:value}) {\n    case ${2:1}:\n        ${3}\n        break;\n    default:\n        ${0}\n}', 'switch'],
    ['func', '${1:int} ${2:name}(${3}) {\n    ${0}\n}', 'function'], ['class', 'class ${1:Name} {\npublic:\n    ${1:Name}() {}\n    ${0}\nprivate:\n};', 'class'], ['struct', 'struct ${1:Name} {\n    ${0}\n};', 'struct'], ['include', '#include <${1:iostream}>', 'include'],
  ],
  java: [
    ['main', 'public static void main(String[] args) {\n    ${0}\n}', 'main method'], ['class', 'public class ${1:Name} {\n    ${0}\n}', 'class'], ['sout', 'System.out.println(${0});', 'print line'],
    ['for', 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${0}\n}', 'for loop'], ['foreach', 'for (${1:Type} ${2:item} : ${3:items}) {\n    ${0}\n}', 'for each'], ['if', 'if (${1:condition}) {\n    ${0}\n}', 'if'], ['try', 'try {\n    ${1}\n} catch (${2:Exception} e) {\n    ${0}\n}', 'try / catch'],
  ],
  csharp: [['main', 'static void Main(string[] args)\n{\n    ${0}\n}', 'Main'], ['cw', 'Console.WriteLine(${0});', 'print line'], ['class', 'public class ${1:Name}\n{\n    ${0}\n}', 'class'], ['for', 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++)\n{\n    ${0}\n}', 'for loop'], ['foreach', 'foreach (var ${1:item} in ${2:items})\n{\n    ${0}\n}', 'foreach']],
  go: [['main', 'package main\n\nimport "fmt"\n\nfunc main() {\n\t${0}\n}', 'main program'], ['func', 'func ${1:name}(${2}) ${3:error} {\n\t${0}\n}', 'function'], ['for', 'for ${1:i} := 0; ${1:i} < ${2:n}; ${1:i}++ {\n\t${0}\n}', 'for loop'], ['iferr', 'if err != nil {\n\t${0:return err}\n}', 'if err'], ['println', 'fmt.Println(${0})', 'print line']],
  rust: [['main', 'fn main() {\n    ${0}\n}', 'main'], ['fn', 'fn ${1:name}(${2}) -> ${3:()} {\n    ${0}\n}', 'function'], ['println', 'println!("${1:{}}", ${0});', 'print line'], ['struct', 'struct ${1:Name} {\n    ${0}\n}', 'struct'], ['match', 'match ${1:value} {\n    ${2:pattern} => ${3:expr},\n    _ => ${0:()},\n}', 'match'], ['for', 'for ${1:item} in ${2:items} {\n    ${0}\n}', 'for loop']],
  php: [['php', '<?php\n\n${0}', 'php tag'], ['function', 'function ${1:name}(${2}) {\n    ${0}\n}', 'function'], ['foreach', 'foreach (${1:\\$items} as ${2:\\$item}) {\n    ${0}\n}', 'foreach'], ['echo', 'echo ${0};', 'echo']],
  sql: [['select', 'SELECT ${1:*}\nFROM ${2:table}\nWHERE ${0:condition};', 'select'], ['insert', 'INSERT INTO ${1:table} (${2:columns})\nVALUES (${0:values});', 'insert'], ['update', 'UPDATE ${1:table}\nSET ${2:column} = ${3:value}\nWHERE ${0:condition};', 'update'], ['create', 'CREATE TABLE ${1:name} (\n  id INTEGER PRIMARY KEY,\n  ${0}\n);', 'create table'], ['join', 'JOIN ${1:table} ON ${2:a.id} = ${0:b.a_id}', 'join']],
  typescript: [
    ['rnf', "import { Text, View } from 'react-native';\n\nexport default function ${1:Screen}() {\n  return (\n    <View className=\"flex-1 items-center justify-center\">\n      <Text>${0:Hello}</Text>\n    </View>\n  );\n}", 'React Native screen (NativeWind)'],
    ['rfc', 'export default function ${1:Component}() {\n  return (\n    ${0:<div />}\n  );\n}', 'React function component'],
    ['useState', 'const [${1:value}, set${1/(.*)/${1:/capitalize}/}] = useState(${0});', 'useState'], ['useEffect', 'useEffect(() => {\n  ${0}\n}, [${1}]);', 'useEffect'],
    ['flatlist', '<FlatList\n  data={${1:items}}\n  keyExtractor={(item) => item.id}\n  renderItem={({ item }) => ${0:<Text>{item.title}</Text>}}\n/>', 'FlatList'],
    ['pressable', '<Pressable className="${1:rounded-xl bg-indigo-600 px-4 py-3}" onPress={${2:() => {}}}>\n  <Text className="${3:font-semibold text-white}">${0:Press me}</Text>\n</Pressable>', 'Pressable button'],
    ['stylesheet', 'const styles = StyleSheet.create({\n  ${1:container}: {\n    ${0}\n  },\n});', 'StyleSheet.create'],
    ['clg', 'console.log(${0});', 'console.log'], ['afn', 'const ${1:name} = async (${2}) => {\n  ${0}\n};', 'async arrow function'], ['fetch', "const response = await fetch('${1:url}');\nconst ${2:data} = await response.json();", 'fetch JSON'],
  ],
};
SNIPPETS.javascript = SNIPPETS.typescript;
SNIPPETS.c = SNIPPETS.cpp.filter(([l]) => !['cout', 'cin', 'class', 'main'].includes(l)).concat([['main', '#include <stdio.h>\n\nint main(void) {\n    ${0}\n    return 0;\n}', 'main program'], ['printf', 'printf("${1:%d}\\n", ${0});', 'printf']]);

function installKeywords() {
  const SERVICE = new Set(['typescript', 'javascript', 'json', 'css', 'scss', 'less', 'html', 'handlebars', 'razor', 'plaintext']);
  const cache = new Map<string, Promise<string[]>>();
  const keywordsOf = (id: string): Promise<string[]> => {
    let hit = cache.get(id);
    if (!hit) {
      hit = (async () => {
        const lang = monaco.languages.getLanguages().find((l) => l.id === id) as any;
        const def = await lang?.loader?.().catch(() => null);
        const l = def?.language ?? {};
        const list = [l.keywords, l.typeKeywords, l.builtins, l.builtinFunctions, l.builtinVariables, l.constants, l.storageSpecifiers].filter(Array.isArray).flat() as unknown[];
        return [...new Set(list.filter((k): k is string => typeof k === 'string' && /^[A-Za-z_#][\w#]*$/.test(k)))];
      })();
      cache.set(id, hit);
    }
    return hit;
  };
  for (const lang of monaco.languages.getLanguages()) {
    const id = lang.id;
    const snippets = SNIPPETS[id] ?? [];
    if (SERVICE.has(id) && !snippets.length) continue;
    monaco.languages.registerCompletionItemProvider(id, {
      async provideCompletionItems(model, position) {
        const w = model.getWordUntilPosition(position);
        const range = new monaco.Range(position.lineNumber, w.startColumn, position.lineNumber, w.endColumn);
        const kw = SERVICE.has(id) ? [] : await keywordsOf(id);
        return {
          suggestions: [
            ...snippets.map(([label, insertText, detail]) => ({ label, kind: monaco.languages.CompletionItemKind.Snippet, insertText, insertTextRules: S, detail, documentation: { value: '```\n' + insertText.replace(/\$\{\d+:?([^}]*)\}|\$\d+/g, '$1') + '\n```' }, range, sortText: `0${label}` })),
            ...kw.map((k) => ({ label: k, kind: monaco.languages.CompletionItemKind.Keyword, insertText: k, range, sortText: `1${k}` })),
          ],
        };
      },
    });
  }
}

export function installIntellisense(ide: IDE) {
  installTailwind();
  installKeywords();
  if (!tsApi) return;
  const ata = new TypeAcquisition(ide);
  const scan = debounce(() => void ata.scan().catch((e) => console.warn('[ide] type acquisition', e)), 1500);
  ide.editors.saved.on((p) => { if (/\.(tsx?|jsx?|mjs|cjs)$|package\.json$/.test(p)) scan(); });
  ide.fs.changed.on((e) => { if (e.source !== 'ide' && /package\.json$/.test(e.path)) scan(); });
  register({ id: 'types.refresh', title: 'Download Type Definitions for IntelliSense', category: 'Editor', run: () => ata.scan() });
  scan();
}
