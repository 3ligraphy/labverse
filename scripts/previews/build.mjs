#!/usr/bin/env node
/**
 * APP PREVIEW BUILDER — makes a real web build of each student's Expo app so the marking page can show it running
 * (Admin → Marking → a group → App). Student code only runs inside the Docker box (scripts/previews/in-container.sh),
 * never on the computer itself.
 *
 * Every hour the App builds workflow (.github/workflows/app-builds.yml → scripts/previews/ci.mjs) runs this on GitHub
 * for every hand-in and uploads the builds. To build by hand on a computer with Docker:
 *   1. Admin → Marking → "App builds" → Download the build list (build-list.json)
 *   2. npm run previews -- build-list.json
 *   3. Admin → Marking → "App builds" → Upload builds → choose every .zip in the output folder
 *
 * For each hand-in it uses its GitHub repo (saved, or found now in its report / ZIP), else the app files inside its
 * ZIP. Builds that are still current are skipped: same repo commit, or the same hand-in (--pin: the same hand-in
 * only). A hand-in whose build failed is tried again a day later. Options:
 *   --out <folder>   where the build ZIPs go (default: ./app-builds next to the list)
 *   --only 12,15     only these group numbers        --force   build again even if current
 *   --jobs 2         builds at the same time         --image node:22-bookworm
 *   --pin            keep a build until the hand-in changes (not on new commits)
 *   --report <file>  write what happened to each hand-in as JSON (for scripts/previews/ci.mjs)
 *   --ci             the automatic run: --pin, no shared npm cache, and a log with counts only (this repo is public,
 *                    so the log never shows student IDs, repos or links)
 * Run with the TypeScript loader (npm run previews does): node --import ./tests/support/register-tsx.mjs …
 */
import { execFile, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { unzipSync, zipSync } from 'fflate';
import { needsBuild } from '../../src/lib/previews/core.ts';
import { repoInHandIn } from './handin.mjs';

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const VALUED = new Set(['out', 'only', 'jobs', 'image', 'report']);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const listPath = args.find((a, i) => a.endsWith('.json') && !(i > 0 && VALUED.has(args[i - 1].replace(/^--/, ''))));
if (!listPath) {
  console.log('Usage: npm run previews -- build-list.json [--out folder] [--only 3,12] [--force] [--jobs 2] [--pin] [--report r.json] [--ci]');
  process.exit(1);
}
const list = JSON.parse(readFileSync(listPath, 'utf8'));
const out = resolve(flag('out', join(dirname(resolve(listPath)), 'app-builds')));
const only = new Set(String(flag('only', '')).split(',').map(Number).filter(Boolean));
const force = args.includes('--force');
const ci = args.includes('--ci');
const pin = ci || args.includes('--pin');
const reportPath = flag('report', null);
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

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download the hand-in (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Unpacks the hand-in ZIP's files (no node_modules, nothing outside the folder) for a build from the ZIP. */
function zipSource(bytes, dir) {
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
  if (!apps) throw new Error('No app files (package.json) in the hand-in and no GitHub link found in it');
}

function docker(argv, logFile) {
  return new Promise((done) => {
    const p = spawn('docker', argv, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
    let log = '';
    p.stdout.on('data', (d) => (log += d));
    p.stderr.on('data', (d) => (log += d));
    p.on('error', () => done(-1));
    p.on('close', (code) => {
      if (logFile) try { writeFileSync(logFile, log); } catch { /* the log only */ }
      done(code);
    });
  });
}

/** The user the build runs as, so the box gives its files back to it (Linux / macOS; Docker Desktop on Windows maps them). */
const owner = typeof process.getuid === 'function' ? { uid: process.getuid(), gid: process.getgid() } : null;

/**
 * Removes a build's work folder. Never fails a build: a folder that cannot be removed (files the box made as root,
 * from an older box script) is removed from inside a box, and if even that fails it is left for the next run.
 */
async function cleanup(box) {
  try {
    rmSync(box, { recursive: true, force: true });
    return;
  } catch {
    /* root's files: below */
  }
  await docker(['run', '--rm', '-v', `${fwd(box)}:/w`, image, 'sh', '-c', 'rm -rf /w/* /w/.[!.]* 2>/dev/null; true'], null);
  try {
    rmSync(box, { recursive: true, force: true });
  } catch {
    /* left behind: the runner's disk is thrown away after the run anyway */
  }
}

const zipDir = (dir, extra) => {
  const files = { ...extra };
  const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else files[relative(dir, p).split('\\').join('/')] = readFileSync(p); } };
  walk(dir);
  return zipSync(files, { level: 6 });
};

/**
 * One hand-in: { status, … } where status is current | waiting (failed less than a day ago) | none (nothing to build:
 * no GitHub link and no app files) | built (file) | failed (note). `found` is set when its hand-in was searched for a repo.
 */
async function build(entry) {
  const base = { entry: entry.entry, handIn: entry.updatedAt, label: `Group ${entry.group ?? '?'} (${entry.studentId})` };
  if (only.size && !only.has(Number(entry.group))) return null;
  let repo = entry.repo && REPO_RE.test(entry.repo) ? entry.repo : null;
  const head = repo && !pin ? await headOf(repo) : null;
  const state = needsBuild({ updatedAt: entry.updatedAt, repo, built: entry.built, failed: entry.failed }, { now: Date.now(), pin, force, head });
  if (state === 'current') return { ...base, status: 'current', note: 'already built' };
  if (state === 'wait') return { ...base, status: 'waiting', note: 'failed less than a day ago' };
  // a hand-in not searched yet: look for its GitHub link (the marking page does the same when staff open it)
  let found;
  let bytes = null;
  if (!repo && entry.checked !== entry.updatedAt && entry.url) {
    try {
      bytes = await download(entry.url);
      found = await repoInHandIn(bytes);
    } catch {
      found = null;
    }
    repo = found ?? null;
  }
  const key = newKey();
  const box = join(work, key);
  const outDir = join(box, 'out');
  mkdirSync(outDir, { recursive: true });
  const argv = ['run', '--rm', '-e', `BASE=/preview/${key}`, '-v', `${fwd(script)}:/run.sh:ro`, '-v', `${fwd(outDir)}:/out`, '--workdir', '/work', '--memory', '4g'];
  if (owner) argv.push('-e', `HOST_UID=${owner.uid}`, '-e', `HOST_GID=${owner.gid}`);
  // a shared npm cache is faster on your own computer; the automatic run keeps every build apart
  if (!ci) argv.push('-v', 'buenova-npm-cache:/root/.npm');
  let source = 'repo';
  if (repo) argv.push('-e', `REPO=${repo}`);
  else {
    if (!/\.zip$/i.test(entry.url ?? '')) return { ...base, found, status: 'none', note: 'no GitHub link found and the hand-in is not a ZIP' };
    try {
      zipSource(bytes ?? (await download(entry.url)), join(box, 'src'));
    } catch (error) {
      await cleanup(box);
      return { ...base, found, status: 'failed', note: error.message };
    }
    argv.push('-v', `${fwd(join(box, 'src'))}:/src:ro`);
    source = 'zip';
  }
  argv.push(image, 'bash', '/run.sh');
  const started = Date.now();
  if (!ci) process.stdout.write(`… ${base.label}: building from ${repo ? `github.com/${repo}` : 'the hand-in ZIP'}\n`);
  await docker(argv, join(box, 'docker.log'));
  const result = existsSync(join(outDir, 'build.json')) ? JSON.parse(readFileSync(join(outDir, 'build.json'), 'utf8')) : { ok: false, error: 'The build box stopped early (see docker.log)' };
  const secs = Math.round((Date.now() - started) / 1000);
  if (!result.ok) {
    // the automatic run keeps nothing (its log is public anyway); by hand the logs stay for you to read
    if (ci) await cleanup(box);
    return { ...base, found, status: 'failed', note: ci ? String(result.error).replace(/\s*\(see [^)]*\)/g, '') : `${result.error} · logs in ${box}`, secs };
  }
  const manifest = { v: 1, key, entry: entry.entry, group: entry.group ?? null, studentId: entry.studentId, repo, sha: result.sha ?? head, source, handIn: entry.updatedAt, sdk: result.sdk, root: result.root, builtAt: new Date().toISOString() };
  const zip = zipDir(join(outDir, 'dist'), { 'preview.json': new TextEncoder().encode(JSON.stringify(manifest, null, 2)) });
  // the build's key is its file name too: the upload keeps it (Admin → App builds, or ci.mjs)
  const file = join(out, ci ? `${key}.zip` : `group-${entry.group ?? 'x'}-${entry.studentId}.zip`);
  writeFileSync(file, zip);
  // the build is done and saved: tidying up can no longer turn it into a failure
  await cleanup(box);
  return { ...base, found, status: 'built', file, key, note: `${(zip.length / 1024 / 1024).toFixed(1)} MB · expo ${result.sdk || '?'}`, secs };
}

const MARK = { built: '✓', current: '=', waiting: '…', none: '–', failed: '✗' };
const queue = [...(list.entries ?? [])];
const results = [];
let n = 0;
await Promise.all(Array.from({ length: jobs }, async () => {
  for (let e = queue.shift(); e; e = queue.shift()) {
    const i = ++n;
    const r = await build(e).catch((error) => ({ entry: e.entry, handIn: e.updatedAt, label: `Group ${e.group}`, status: 'failed', note: error.message }));
    if (!r) continue;
    results.push(r);
    // the automatic run's log is public: a running number and the outcome only
    console.log(ci ? `${MARK[r.status] ?? '?'} #${i}: ${r.status}${r.secs ? ` in ${r.secs}s` : ''}` : `${MARK[r.status] ?? '?'} ${r.label}: ${r.status}${r.secs ? ` in ${r.secs}s` : ''} · ${r.note}`);
  }
}));
const count = (s) => results.filter((r) => r.status === s).length;
console.log(`\n${count('built')} built, ${count('current')} already current, ${count('waiting')} waiting to retry, ${count('none')} with nothing to build, ${count('failed')} failed.`);
if (reportPath) writeFileSync(reportPath, JSON.stringify({ item: list.item, results: results.map(({ label, ...r }) => r) }, null, 2));
if (count('built') && !ci) console.log(`Upload the ZIPs in ${out} on Admin → Marking → App builds.`);
if (!KEY_RE.test(newKey())) process.exit(2);
