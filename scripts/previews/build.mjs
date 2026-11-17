#!/usr/bin/env node
/**
 * APP PREVIEW BUILDER — makes a real web build of each student's Expo app so the marking page can show it running
 * (Admin → Marking → a group → App). Run it on a computer with Docker; student code only runs inside the Docker
 * box (scripts/previews/in-container.sh), never on the computer itself.
 *
 *   1. Admin → Marking → "App builds" → Download the build list (build-list.json)
 *   2. node scripts/previews/build.mjs build-list.json            (or: npm run previews -- build-list.json)
 *   3. Admin → Marking → "App builds" → Upload builds → choose every .zip in the output folder
 *
 * For each hand-in it uses the GitHub repo found in it (cloned fresh), else the app files inside its ZIP. Builds that
 * are still current are skipped: same repo commit, or the same hand-in. Options:
 *   --out <folder>   where the build ZIPs go (default: ./app-builds next to the list)
 *   --only 12,15     only these group numbers        --force   build again even if current
 *   --jobs 2         builds at the same time         --image node:22-bookworm
 */
import { execFile, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { unzipSync, zipSync } from 'fflate';

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const listPath = args.find((a) => a.endsWith('.json'));
if (!listPath) {
  console.log('Usage: node scripts/previews/build.mjs build-list.json [--out folder] [--only 3,12] [--force] [--jobs 2]');
  process.exit(1);
}
const list = JSON.parse(readFileSync(listPath, 'utf8'));
const out = resolve(flag('out', join(dirname(resolve(listPath)), 'app-builds')));
const only = new Set(String(flag('only', '')).split(',').map(Number).filter(Boolean));
const force = args.includes('--force');
const jobs = Math.max(1, Math.min(4, Number(flag('jobs', 2)) || 2));
const image = flag('image', 'node:22-bookworm');
const work = join(out, '.work');
mkdirSync(work, { recursive: true });
/** Docker on Windows wants forward slashes in -v paths. */
const fwd = (p) => p.replace(/\\/g, '/');
// the box script with LF line ends whatever git did to it on checkout
const script = join(work, 'run.sh');
writeFileSync(script, readFileSync(join(here, 'in-container.sh'), 'utf8').replace(/\r\n/g, '\n'));

const KEY_RE = /^[a-z0-9]{20}$/;
const REPO_RE = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;
const newKey = () => [...randomBytes(20)].map((b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');

/** The repo's current commit (git on this computer only asks GitHub; it runs no student code). */
async function headOf(repo) {
  try {
    const { stdout } = await run('git', ['ls-remote', `https://github.com/${repo}.git`, 'HEAD'], { timeout: 30000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
    return stdout.split(/\s+/)[0] || null;
  } catch {
    return null;
  }
}

/** Unpacks the hand-in ZIP's files (no node_modules, nothing outside the folder) for a build from the ZIP. */
async function zipSource(entry, dir) {
  const res = await fetch(entry.url);
  if (!res.ok) throw new Error(`Could not download the hand-in (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const files = unzipSync(bytes, { filter: (f) => !/(^|\/)(node_modules|\.git|\.expo)\//.test(f.name) && !f.name.includes('..') });
  let apps = 0;
  for (const [name, data] of Object.entries(files)) {
    if (name.endsWith('/')) continue;
    // a ZIP inside the ZIP (some groups zip their repo): open it too
    if (/\.zip$/i.test(name) && data.length < 50 * 1024 * 1024) {
      const inner = unzipSync(data, { filter: (f) => !/(^|\/)(node_modules|\.git|\.expo)\//.test(f.name) && !f.name.includes('..') });
      for (const [n, d] of Object.entries(inner)) if (!n.endsWith('/')) { const p = join(dir, name.replace(/\.zip$/i, ''), n); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, d); if (n.endsWith('package.json')) apps++; }
      continue;
    }
    const p = join(dir, name);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, data);
    if (name.endsWith('package.json')) apps++;
  }
  if (!apps) throw new Error('No app files (package.json) in the hand-in and no GitHub repo found');
}

function docker(argv, logFile) {
  return new Promise((done) => {
    const p = spawn('docker', argv, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
    let log = '';
    p.stdout.on('data', (d) => (log += d));
    p.stderr.on('data', (d) => (log += d));
    p.on('close', (code) => { writeFileSync(logFile, log); done(code); });
  });
}

const zipDir = (dir, extra) => {
  const files = { ...extra };
  const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else files[relative(dir, p).split('\\').join('/')] = readFileSync(p); } };
  walk(dir);
  return zipSync(files, { level: 6 });
};

async function build(entry) {
  const label = `Group ${entry.group ?? '?'} (${entry.studentId})`;
  if (only.size && !only.has(Number(entry.group))) return null;
  const repo = entry.repo && REPO_RE.test(entry.repo) ? entry.repo : null;
  const sha = repo ? await headOf(repo) : null;
  const current = entry.built && !force && (repo ? entry.built.sha && entry.built.sha === sha : entry.built.source === 'zip' && entry.built.handIn === entry.updatedAt);
  if (current) return { label, status: 'current', note: 'already built' };
  const key = newKey();
  const box = join(work, key);
  const outDir = join(box, 'out');
  mkdirSync(outDir, { recursive: true });
  const argv = ['run', '--rm', '-e', `BASE=/preview/${key}`, '-v', `${fwd(script)}:/run.sh:ro`, '-v', `${fwd(outDir)}:/out`, '-v', 'buenova-npm-cache:/root/.npm', '--workdir', '/work', '--memory', '4g'];
  let source = 'repo';
  if (repo) argv.push('-e', `REPO=${repo}`);
  else {
    if (!/\.zip$/i.test(entry.url ?? '')) return { label, status: 'skipped', note: 'no GitHub repo found and the hand-in is not a ZIP' };
    try {
      await zipSource(entry, join(box, 'src'));
    } catch (error) {
      return { label, status: 'skipped', note: error.message };
    }
    argv.push('-v', `${fwd(join(box, 'src'))}:/src:ro`);
    source = 'zip';
  }
  argv.push(image, 'bash', '/run.sh');
  const started = Date.now();
  process.stdout.write(`… ${label}: building from ${repo ? `github.com/${repo}` : 'the hand-in ZIP'}\n`);
  await docker(argv, join(box, 'docker.log'));
  const result = existsSync(join(outDir, 'build.json')) ? JSON.parse(readFileSync(join(outDir, 'build.json'), 'utf8')) : { ok: false, error: 'The build box stopped early (see docker.log)' };
  const secs = Math.round((Date.now() - started) / 1000);
  if (!result.ok) return { label, status: 'failed', note: `${result.error} · logs in ${box}`, secs };
  const manifest = { v: 1, key, entry: entry.entry, group: entry.group ?? null, studentId: entry.studentId, repo, sha: result.sha ?? sha, source, handIn: entry.updatedAt, sdk: result.sdk, root: result.root, builtAt: new Date().toISOString() };
  const zip = zipDir(join(outDir, 'dist'), { 'preview.json': new TextEncoder().encode(JSON.stringify(manifest, null, 2)) });
  const file = join(out, `group-${entry.group ?? 'x'}-${entry.studentId}.zip`);
  writeFileSync(file, zip);
  rmSync(box, { recursive: true, force: true });
  return { label, status: 'built', note: `${(zip.length / 1024 / 1024).toFixed(1)} MB · expo ${result.sdk || '?'}`, secs };
}

const queue = [...(list.entries ?? [])];
const results = [];
await Promise.all(Array.from({ length: jobs }, async () => {
  for (let e = queue.shift(); e; e = queue.shift()) {
    const r = await build(e).catch((error) => ({ label: `Group ${e.group}`, status: 'failed', note: error.message }));
    if (r) { results.push(r); console.log(`${r.status === 'built' ? '✓' : r.status === 'current' ? '=' : '✗'} ${r.label}: ${r.status}${r.secs ? ` in ${r.secs}s` : ''} · ${r.note}`); }
  }
}));
const built = results.filter((r) => r.status === 'built').length;
console.log(`\n${built} built, ${results.filter((r) => r.status === 'current').length} already current, ${results.filter((r) => !['built', 'current'].includes(r.status)).length} not built.`);
if (built) console.log(`Upload the ZIPs in ${out} on Admin → Marking → App builds.`);
if (!KEY_RE.test(newKey())) process.exit(2);
