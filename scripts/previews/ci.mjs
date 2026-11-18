#!/usr/bin/env node
/**
 * AUTOMATIC APP BUILDS — what the App builds workflow runs every hour (.github/workflows/app-builds.yml):
 *   1. signs in to the site with the OIDC token GitHub gives this run (no stored secret: src/lib/previews/builder-auth.ts)
 *   2. gets the build list of every item with hand-ins (GET /api/admin/previews?all=1)
 *   3. builds what needs it in Docker boxes (scripts/previews/build.mjs --ci)
 *   4. uploads each build ZIP to Blob and registers it, saves the repos it found, and reports builds that failed
 * The log shows counts only: this repo is public, so it never prints student IDs, repos or links.
 * Run: node --import ./tests/support/register-tsx.mjs scripts/previews/ci.mjs   (SITE=https://… to point elsewhere)
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { upload } from '@vercel/blob/client';

const SITE = (process.env.SITE || 'https://labverse-indol.vercel.app').replace(/\/$/, '');
const AUDIENCE = 'buenova-app-builds';
const TMP = process.env.RUNNER_TEMP || tmpdir();

/** A fresh OIDC token for this run (they last minutes; builds take longer). */
async function token() {
  const url = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const bearer = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!url || !bearer) throw new Error('No GitHub OIDC token: this runs in the App builds workflow (permissions: id-token: write).');
  const res = await fetch(`${url}&audience=${AUDIENCE}`, { headers: { authorization: `bearer ${bearer}` } });
  if (!res.ok) throw new Error(`Could not get the OIDC token (${res.status})`);
  return (await res.json()).value;
}

async function api(path, body) {
  const res = await fetch(SITE + path, {
    method: body ? 'PUT' : 'GET',
    headers: { authorization: `Bearer ${await token()}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  // the status only: a site error can name a student
  if (!res.ok) throw new Error(`${body ? `PUT ${body.action}` : 'GET'} answered ${res.status}`);
  return json;
}

function node(argv) {
  return new Promise((done, fail) => {
    const p = spawn(process.execPath, argv, { stdio: 'inherit' });
    p.on('close', (code) => (code === 0 ? done() : fail(new Error(`the builder stopped (${code})`))));
  });
}

const { lists = [], folder } = await api('/api/admin/previews?all=1');
if (!folder) throw new Error('The site did not say where builds are stored.');
const sum = { lists: lists.length, uploaded: 0, failed: 0, repos: 0, errors: 0 };
for (const [i, list] of lists.entries()) {
  const dir = join(TMP, `app-builds-${i}`);
  mkdirSync(dir, { recursive: true });
  const listFile = join(dir, 'list.json');
  const reportFile = join(dir, 'report.json');
  writeFileSync(listFile, JSON.stringify(list));
  console.log(`\nItem ${i + 1} of ${lists.length}: ${list.entries.length} hand-ins`);
  await node(['--import', './tests/support/register-tsx.mjs', 'scripts/previews/build.mjs', listFile, '--ci', '--out', join(dir, 'out'), '--report', reportFile, '--jobs', '3']);
  const { results } = JSON.parse(readFileSync(reportFile, 'utf8'));
  for (const r of results) {
    try {
      // the hand-in was searched: save what was found (or that nothing was), so it is not searched again
      if (r.found !== undefined) {
        await api('/api/admin/previews', { action: 'repo', item: list.item, entry: r.entry, repo: r.found ?? '', found: true });
        if (r.found) sum.repos++;
      }
      if (r.status === 'built') {
        const bytes = readFileSync(r.file);
        const blob = await upload(`${folder}/previews/${r.key}.zip`, new Blob([bytes], { type: 'application/zip' }), {
          access: 'public', contentType: 'application/zip', handleUploadUrl: `${SITE}/api/admin/previews/upload`,
          headers: { authorization: `Bearer ${await token()}` },
        });
        await api('/api/admin/previews', { action: 'build', item: list.item, url: blob.url, pathname: blob.pathname, size: bytes.length });
        sum.uploaded++;
      } else if (r.status === 'failed') {
        await api('/api/admin/previews', { action: 'failed', item: list.item, entry: r.entry, note: r.note });
        sum.failed++;
      }
    } catch (error) {
      sum.errors++;
      console.log(`! a hand-in could not be saved: ${error.message}`);
    }
  }
}
console.log(`\nDone: ${sum.lists} items, ${sum.uploaded} new builds uploaded, ${sum.repos} GitHub links found, ${sum.failed} builds failed (retried tomorrow), ${sum.errors} not saved.`);
if (sum.errors) process.exitCode = 1;
