import { spawnSync } from 'node:child_process';

function run(args) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

run(['node_modules/astro/bin/astro.mjs', 'build']);
// Explicit one-time deployment opt-in; normal builds never mutate course data.
if (process.env.SEED_PSYCHOLOGY === '1') {
  if (process.env.VERCEL_ENV !== 'production') throw new Error('Seeding requires a production deployment.');
  run(['scripts/seed-psychology-technology.mjs', '--confirm-production', '--preserve-existing']);
}
