// Seeds "Introduction to Computing" (26CSCI01P, ICS prep year) and its Week 6 revision lab, with the C++ component kit.
//   node scripts/seed-intro-computing.mjs                       dry run: prints a summary, writes nothing
//   node scripts/seed-intro-computing.mjs --dev                 writes platform_dev_* (LOCAL_DATABASE_URL, pg)
//   node scripts/seed-intro-computing.mjs --confirm-production  writes platform_* (DATABASE_URL_PRODUCTION or DATABASE_URL, Neon)
// Re-running updates the lab content. On production an existing module canvas is kept (staff may have edited it);
// pass --replace-module to overwrite it too.
// The site also creates this module by itself, once, the first time it runs after a deploy (src/lib/platform/seeds),
// so this script is only needed to push changed lab content into a database that already has the module.
import { readFileSync } from 'node:fs';
import { compileLab, compileModule, nodesOfKits, sanitizeFlow } from '../src/lib/platform/core.ts';
import { introComputingModule, introComputingRevisionLab } from '../src/lib/platform/seeds/intro-computing-revision.ts';

const dev = process.argv.includes('--dev');
const production = process.argv.includes('--confirm-production');
const replaceModule = process.argv.includes('--replace-module') || dev;
if (dev && production) throw new Error('Choose either --dev or --confirm-production.');

const moduleSlug = 'intro-to-computing';
const labSlug = 'revision-week-6';
const labNodes = nodesOfKits(['cpp']);

const cleanModule = sanitizeFlow(introComputingModule(), 'module');
if (!cleanModule.ok) throw new Error(cleanModule.error);
const compiledModule = compileModule(cleanModule.value);
const cleanLab = sanitizeFlow(introComputingRevisionLab(), 'lab');
if (!cleanLab.ok) throw new Error(cleanLab.error);
const compiledLab = compileLab(cleanLab.value, `${moduleSlug}--${labSlug}`);
if (compiledLab.warnings.length) throw new Error(compiledLab.warnings.join('\n'));
if (!compiledModule.items.some((i) => i.kind === 'lab' && i.slug === labSlug)) throw new Error('The lab is not on the module canvas.');

const count = (kind) => compiledLab.blocks.flatMap((b) => (b.kind === 'task' ? [b, ...b.children] : [b])).filter((b) => b.kind === kind).length;
const summary = {
  module: moduleSlug, code: compiledModule.meta.code, title: compiledModule.meta.title, faculty: compiledModule.meta.faculty, years: compiledModule.meta.years,
  lab: labSlug, labTitle: compiledLab.meta.title,
  parts: count('part'), tasks: count('task'), exercises: count('cpp'), predictions: count('cpppredict'), puzzles: count('parsons'), visuals: count('cppvisual'),
  graded: Object.keys(compiledLab.exercises).length, nodes: cleanLab.value.nodes.length, labNodes,
};

if (!dev && !production) {
  console.log(JSON.stringify({ dryRun: true, ...summary }, null, 2));
  console.log('Re-run with --dev (local tables) or --confirm-production (live tables) to write.');
  process.exit(0);
}

function localUrl() {
  if (process.env.LOCAL_DATABASE_URL) return process.env.LOCAL_DATABASE_URL;
  for (const file of ['.env.development.local', '.env.local', '.env']) {
    try {
      const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => /^\s*LOCAL_DATABASE_URL\s*=/.test(l));
      if (line) return line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
    } catch { /* file missing */ }
  }
  return undefined;
}

let query;
let close = async () => {};
if (dev) {
  const url = localUrl();
  if (!url) throw new Error('Set LOCAL_DATABASE_URL (see compose.yaml) for --dev.');
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: url });
  query = async (text, params = []) => (await pool.query(text, params)).rows;
  close = () => pool.end();
} else {
  const url = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;
  if (!url) throw new Error('Set DATABASE_URL_PRODUCTION or DATABASE_URL.');
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(url);
  query = async (text, params = []) => sql.query(text, params);
}
const platform = dev ? 'platform_dev' : 'platform';

try {
  await query(`alter table ${platform}_modules add column if not exists lab_nodes jsonb`);
  await query(`insert into ${platform}_modules (slug, title, published, flow, lab_nodes) values ($1, $2, true, $3::jsonb, $4::jsonb)
    on conflict (slug) ${replaceModule ? 'do update set title = excluded.title, published = true, flow = excluded.flow, lab_nodes = excluded.lab_nodes, updated_at = now()' : 'do update set lab_nodes = excluded.lab_nodes, updated_at = now()'}`,
  [moduleSlug, compiledModule.meta.title, JSON.stringify(cleanModule.value), JSON.stringify(labNodes)]);
  await query(`insert into ${platform}_labs (module, slug, title, published, flow) values ($1, $2, $3, true, $4::jsonb)
    on conflict (module, slug) do update set title = excluded.title, published = true, flow = excluded.flow, updated_at = now()`,
  [moduleSlug, labSlug, compiledLab.meta.title, JSON.stringify(cleanLab.value)]);
  const saved = await query(`select slug, title, published, jsonb_array_length(flow->'nodes')::int as nodes from ${platform}_labs where module = $1 order by slug`, [moduleSlug]);
  console.log(JSON.stringify({ seeded: true, target: dev ? 'dev' : 'production', ...summary, stored: saved }, null, 2));
} catch (e) {
  if (e?.code === '42P01') console.error(`${platform}_* tables do not exist yet: open the app once (it creates them on first use), then re-run.`);
  throw e;
} finally {
  await close();
}
