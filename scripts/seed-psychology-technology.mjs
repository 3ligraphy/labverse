// Seeds the "Technology for Psychology" module (Arts & Humanities) and its WordPress bootcamp: Lab 01 (Session 1) and Lab 02 (Session 2).
//   node scripts/seed-psychology-technology.mjs                       dry run: prints a summary, writes nothing
//   node scripts/seed-psychology-technology.mjs --dev                 writes platform_dev_* / accounts_dev_* (LOCAL_DATABASE_URL, pg)
//   node scripts/seed-psychology-technology.mjs --confirm-production  writes platform_* / accounts_* (DATABASE_URL_PRODUCTION or DATABASE_URL, Neon)
import { readFileSync } from 'node:fs';
import { compileLab, compileModule, nodesOfKits, sanitizeFlow } from '../src/lib/platform/core.ts';
import { DEFAULT_FACULTIES, upgradeFaculties } from '../src/lib/accounts/core.ts';
import { BONUS, psychologyTechnologyLab01, psychologyTechnologyLab02, psychologyTechnologyModule } from '../src/lib/platform/seeds/psychology-technology-lab-01.ts';
import { psychologyTechnologyLab03 } from '../src/lib/platform/seeds/psychology-technology-lab-03.ts';

const dev = process.argv.includes('--dev');
const production = process.argv.includes('--confirm-production');
const preserveExisting = production || process.argv.includes('--preserve-existing');
if (dev && production) throw new Error('Choose either --dev or --confirm-production.');

const moduleSlug = 'technology-for-psychology';
const facultySlug = 'arts-humanities';
const labNodes = nodesOfKits(['web']);

const cleanModule = sanitizeFlow(psychologyTechnologyModule(), 'module');
if (!cleanModule.ok) throw new Error(cleanModule.error);
const compiledModule = compileModule(cleanModule.value);

const labs = [['lab-01', psychologyTechnologyLab01()], ['lab-02', psychologyTechnologyLab02()], ['lab-03', psychologyTechnologyLab03()]].map(([slug, flow]) => {
  const compiled = compileLab(flow, `${moduleSlug}--${slug}`);
  if (compiled.warnings.length) throw new Error(`${slug}: ${compiled.warnings.join('\n')}`);
  if (!compiledModule.items.some((item) => item.kind === 'lab' && item.slug === slug)) throw new Error(`${slug} is not connected to the module canvas.`);
  const tasks = compiled.blocks.filter((b) => b.kind === 'task');
  const minutes = (bonus) => tasks.filter((t) => t.title.startsWith(BONUS) === bonus).reduce((a, t) => a + Number(t.time.match(/(\d+)/)?.[1] ?? 0), 0);
  const count = (kind) => compiled.blocks.flatMap((b) => (b.kind === 'task' ? [b, ...b.children] : [b])).filter((b) => b.kind === kind).length;
  return {
    slug, flow, compiled,
    summary: { lab: slug, title: compiled.meta.title, tasks: tasks.length, coreMinutes: minutes(false), bonusMinutes: minutes(true),
      prompts: count('prompt'), previews: count('browser'), sandboxes: count('websandbox'), quizzes: count('quiz'), clickpaths: count('clickpath'), nodes: flow.nodes.length },
  };
});
const summary = {
  module: moduleSlug, moduleTitle: compiledModule.meta.title, faculty: compiledModule.meta.faculty, specializations: compiledModule.meta.specializations,
  labs: labs.map((l) => l.summary), labNodes, published: true,
};

if (!dev && !production) {
  console.log(JSON.stringify({ dryRun: true, ...summary }, null, 2));
  console.log('Re-run with --dev (local tables) or --confirm-production (live tables) to write.');
  process.exit(0);
}

/** LOCAL_DATABASE_URL from the environment or .env.development.local / .env.local (the Astro dev files). */
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
const accounts = dev ? 'accounts_dev' : 'accounts';
const missingTable = (e) => e?.code === '42P01';

try {
  // Preflight before any writes: do not silently replace a customized live canvas.
  if (preserveExisting) {
    const existing = await query(`select flow from ${platform}_modules where slug = $1`, [moduleSlug]);
    if (existing.length) {
      const compiled = compileModule(existing[0].flow);
      if (labs.some((lab) => !compiled.items.some((item) => item.kind === 'lab' && item.slug === lab.slug))) {
        throw new Error('Existing psychology module needs its missing lab links reconciled before seeding; no records were changed.');
      }
    }
  }
  // 1. the faculty must exist in the catalogue, or no student can see the module
  let faculty = 'unchanged';
  try {
    const rows = await query(`select key, value from ${accounts}_settings where key in ('faculties', 'specializations')`);
    const get = (key) => { const v = rows.find((r) => r.key === key)?.value; return typeof v === 'string' ? JSON.parse(v) : v; };
    const faculties = upgradeFaculties(get('faculties'), get('specializations'));
    const storedHas = Array.isArray(get('faculties')) && get('faculties').some((f) => f.slug === facultySlug);
    if (storedHas && !faculties.find((f) => f.slug === facultySlug)?.specializations.includes('Psychology')) {
      throw new Error('Existing Arts & Humanities faculty needs Psychology added before seeding.');
    }
    if (!storedHas) {
      const wanted = DEFAULT_FACULTIES.find((f) => f.slug === facultySlug);
      const next = faculties.some((f) => f.slug === facultySlug) ? faculties
        : [...faculties, { ...wanted, specializations: wanted.specializations.filter((s) => !faculties.some((f) => f.specializations.includes(s))) }];
      if (!next.find((f) => f.slug === facultySlug).specializations.length) throw new Error('Psychology already belongs to another faculty; fix the catalogue in Admin first.');
      await query(`insert into ${accounts}_settings (key, value) values ('faculties', $1::jsonb)
        on conflict (key) do update set value = excluded.value, updated_at = now()`, [JSON.stringify(next)]);
      faculty = `added (${next.map((f) => f.slug).join(', ')})`;
    }
  } catch (e) {
    if (!missingTable(e)) throw e;
    faculty = `skipped: ${accounts}_settings does not exist yet (the app creates it on first use; the defaults already include Arts & Humanities)`;
  }

  // 2. module (+ its allowed canvas components) and lab
  await query(`alter table ${platform}_modules add column if not exists lab_nodes jsonb`);
  await query(`insert into ${platform}_modules (slug, title, published, flow, lab_nodes) values ($1, $2, true, $3::jsonb, $4::jsonb)
    on conflict (slug) ${preserveExisting ? 'do nothing' : 'do update set title = excluded.title, published = true, flow = excluded.flow, lab_nodes = excluded.lab_nodes, updated_at = now()'}`,
  [moduleSlug, compiledModule.meta.title, JSON.stringify(cleanModule.value), JSON.stringify(labNodes)]);
  for (const lab of labs) {
    await query(`insert into ${platform}_labs (module, slug, title, published, flow) values ($1, $2, $3, true, $4::jsonb)
      on conflict (module, slug) ${preserveExisting ? 'do nothing' : 'do update set title = excluded.title, published = true, flow = excluded.flow, updated_at = now()'}`,
    [moduleSlug, lab.slug, lab.compiled.meta.title, JSON.stringify(lab.flow)]);
  }
  const saved = await query(`select slug, title, published, jsonb_array_length(flow->'nodes')::int as nodes from ${platform}_labs where module = $1 order by slug`, [moduleSlug]);
  console.log(JSON.stringify({ seeded: true, target: dev ? "dev" : "production", ...summary, facultySetting: faculty, stored: saved }, null, 2));
} catch (e) {
  if (missingTable(e)) console.error(`${platform}_* tables do not exist yet: open the app once (it creates them on first use), then re-run.`);
  throw e;
} finally {
  await close();
}
