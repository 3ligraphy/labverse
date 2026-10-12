// Updates only the two local lab flows; preserves other content and stores a rollback copy.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import pg from 'pg';
import { addPsychologyVisuals } from '../src/lib/platform/seeds/psychology-visuals.ts';
import { addPlaygroundRecovery } from '../src/lib/platform/playground.ts';
import { compileLab, sanitizeFlow } from '../src/lib/platform/core.ts';
let url = process.env.LOCAL_DATABASE_URL;
for (const file of ['.env.development.local', '.env.local']) {
  if (url) break;
  try { const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => /^\s*LOCAL_DATABASE_URL\s*=/.test(l));
    if (line) url = line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
  } catch {}
}
if (!url) throw new Error('LOCAL_DATABASE_URL is required.');
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) throw new Error('This helper only updates a database on this computer.');
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query('BEGIN');
  const { rows } = await client.query("select slug, flow from platform_dev_labs where module = $1 and slug in ('lab-01','lab-02') order by slug for update", ['technology-for-psychology']);
  if (rows.length !== 2) throw new Error('Expected the two existing psychology labs.');
  mkdirSync('output', { recursive: true });
  writeFileSync(`output/psychology-before-visuals-${Date.now()}.json`, JSON.stringify(rows, null, 2));
  for (const row of rows) {
    const before = compileLab(row.flow, `technology-for-psychology--${row.slug}`);
    const next = sanitizeFlow(process.argv.includes('--recovery') ? addPlaygroundRecovery(row.flow) : addPsychologyVisuals(row.flow), 'lab');
    if (!next.ok) throw new Error(next.error);
    const after = compileLab(next.value, `technology-for-psychology--${row.slug}`);
    if (after.warnings.length) throw new Error(after.warnings.join('\n'));
    const tasks = (c) => c.blocks.filter((b) => b.kind === 'task').map((b) => [b.n, b.title]);
    if (JSON.stringify(tasks(before)) !== JSON.stringify(tasks(after))) throw new Error('Task sequence changed.');
    await client.query('update platform_dev_labs set flow=$1::jsonb, updated_at=now() where module=$2 and slug=$3', [JSON.stringify(next.value), 'technology-for-psychology', row.slug]);
    console.log(`${row.slug}: added ${next.value.nodes.length - row.flow.nodes.length} visual/source nodes; task sequence unchanged`);
  }
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally { await client.end(); }
