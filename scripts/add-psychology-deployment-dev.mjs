import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import pg from 'pg';
import { compileLab, compileModule, sanitizeFlow } from '../src/lib/platform/core.ts';
import { psychologyTechnologyLab03 } from '../src/lib/platform/seeds/psychology-technology-lab-03.ts';
let url = process.env.LOCAL_DATABASE_URL;
for (const file of ['.env.development.local', '.env.local']) {
  if (url) break;
  try { const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => /^\s*LOCAL_DATABASE_URL\s*=/.test(l));
    if (line) url = line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
  } catch {}
}
if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) throw new Error('A local database is required.');
const db = new pg.Client({ connectionString: url });
await db.connect();
const slug = 'technology-for-psychology';
try {
  await db.query('BEGIN');
  const { rows: modules } = await db.query('select * from platform_dev_modules where slug=$1 for update', [slug]);
  const { rows: labs } = await db.query('select * from platform_dev_labs where module=$1 for update', [slug]);
  if (modules.length !== 1) throw new Error('Module missing.');
  mkdirSync('output', { recursive: true });
  writeFileSync(`output/psychology-before-deployment-${Date.now()}.json`, JSON.stringify({ modules, labs }, null, 2));
  const flow = structuredClone(modules[0].flow);
  if (!flow.nodes.some((n) => n.type === 'lab' && n.data.slug === 'lab-03')) {
    const previous = flow.nodes.find((n) => n.type === 'lab' && n.data.slug === 'lab-02');
    if (!previous) throw new Error('Lab 02 missing from module flow.');
    const exits = flow.edges.filter((e) => e.from === previous.id);
    if (exits.length > 1 || flow.nodes.some((n) => ['week-03', 'lab-03'].includes(n.id))) throw new Error('Module needs manual reconciliation.');
    flow.edges = flow.edges.filter((e) => e.from !== previous.id);
    flow.nodes.push({ id: 'week-03', type: 'divider', x: previous.x, y: previous.y + 160, data: { title: 'Week 3' } }, { id: 'lab-03', type: 'lab', x: previous.x, y: previous.y + 320, data: { slug: 'lab-03' } });
    flow.edges.push({ from: previous.id, to: 'week-03' }, { from: 'week-03', to: 'lab-03' });
    if (exits.length) flow.edges.push({ from: 'lab-03', to: exits[0].to });
  }
  const clean = sanitizeFlow(flow, 'module');
  if (!clean.ok || !compileModule(flow).items.some((i) => i.kind === 'lab' && i.slug === 'lab-03')) throw new Error('Invalid module flow.');
  const lab = psychologyTechnologyLab03();
  const compiled = compileLab(lab, `${slug}--lab-03`);
  if (compiled.warnings.length) throw new Error(compiled.warnings.join('\n'));
  await db.query('update platform_dev_modules set flow=$1::jsonb, updated_at=now() where slug=$2', [JSON.stringify(clean.value), slug]);
  await db.query('insert into platform_dev_labs (module,slug,title,published,flow) values ($1,$2,$3,true,$4::jsonb) on conflict (module,slug) do nothing', [slug, 'lab-03', compiled.meta.title, JSON.stringify(lab)]);
  for (const row of labs.filter((l) => ['lab-01', 'lab-02'].includes(l.slug))) {
    const root = row.flow.nodes.find((n) => n.type === 'start');
    if (!root) continue;
    root.data.description = (root.data.description ?? '').replace('first of two sessions', 'first session');
    if (row.slug === 'lab-02') root.data.title = root.data.title.replace('Animation and Publish', 'Animation and Export');
    await db.query('update platform_dev_labs set flow=$1::jsonb,title=$2,updated_at=now() where module=$3 and slug=$4', [JSON.stringify(row.flow), root.data.title, slug, row.slug]);
  }
  await db.query('COMMIT');
  console.log('Local Session 3 published and linked under Week 3. Existing lab tasks and module settings preserved.');
} catch (error) { await db.query('ROLLBACK'); throw error; }
finally { await db.end(); }
