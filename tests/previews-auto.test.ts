// Automatic app builds: who may act as the builder (the App builds workflow, proven by GitHub's signed OIDC token),
// which hand-ins it builds, and what it keeps about failures. Synthetic data and a test key pair only.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { builderClaimsOk, verifiedClaims, OIDC_ISSUER, BUILDER_AUDIENCE } = await import('../src/lib/previews/builder-auth.ts');
const { needsBuild, cleanPreviews, buildList, RETRY_MS } = await import('../src/lib/previews/core.ts');

const NOW = 1_800_000_000;
const good = {
  iss: OIDC_ISSUER, aud: BUILDER_AUDIENCE, repository: '3ligraphy/labverse', ref: 'refs/heads/main',
  workflow_ref: '3ligraphy/labverse/.github/workflows/app-builds.yml@refs/heads/main', event_name: 'schedule',
  iat: NOW - 10, nbf: NOW - 10, exp: NOW + 300,
};

test('only the App builds workflow of this repo on main, run on schedule or by hand, is the builder', () => {
  assert.equal(builderClaimsOk(good, NOW), true);
  assert.equal(builderClaimsOk({ ...good, event_name: 'workflow_dispatch' }, NOW), true);
  assert.equal(builderClaimsOk({ ...good, aud: ['x', BUILDER_AUDIENCE] }, NOW), true, 'an audience list');
  assert.equal(builderClaimsOk({ ...good, repository: 'someone/labverse' }, NOW), false, 'a fork');
  assert.equal(builderClaimsOk({ ...good, ref: 'refs/heads/feature' }, NOW), false, 'another branch');
  assert.equal(builderClaimsOk({ ...good, workflow_ref: '3ligraphy/labverse/.github/workflows/ci.yml@refs/heads/main' }, NOW), false, 'another workflow');
  assert.equal(builderClaimsOk({ ...good, event_name: 'pull_request' }, NOW), false, 'a pull request');
  assert.equal(builderClaimsOk({ ...good, aud: 'sts.amazonaws.com' }, NOW), false, 'a token meant for someone else');
  assert.equal(builderClaimsOk({ ...good, iss: 'https://evil.example' }, NOW), false);
  assert.equal(builderClaimsOk({ ...good, exp: NOW - 1 }, NOW), false, 'expired');
  assert.equal(builderClaimsOk({ ...good, nbf: NOW + 600 }, NOW), false, 'not valid yet');
  const { exp, ...noExp } = good;
  assert.ok(exp);
  assert.equal(builderClaimsOk(noExp, NOW), false, 'no expiry');
});

const b64url = (b: Uint8Array | string) => Buffer.from(typeof b === 'string' ? new TextEncoder().encode(b) : b).toString('base64url');

test('a token counts only when GitHub’s key signed it, unchanged', async () => {
  const pair = (await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const jwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'k1' };
  const sign = async (header: object, payload: object) => {
    const head = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
    const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(head)));
    return `${head}.${b64url(sig)}`;
  };
  const token = await sign({ alg: 'RS256', kid: 'k1' }, good);
  assert.deepEqual(await verifiedClaims(token, [jwk]), good);
  const [h, , s] = token.split('.');
  assert.equal(await verifiedClaims(`${h}.${b64url(JSON.stringify({ ...good, repository: 'someone/x' }))}.${s}`, [jwk]), null, 'a changed payload');
  assert.equal(await verifiedClaims(await sign({ alg: 'RS256', kid: 'other' }, good), [jwk]), null, 'an unknown key');
  assert.equal(await verifiedClaims(`${b64url(JSON.stringify({ alg: 'none', kid: 'k1' }))}.${b64url(JSON.stringify(good))}.`, [jwk]), null, 'no signature');
  assert.equal(await verifiedClaims('not a token', [jwk]), null);
});

test('what the builder does with a hand-in', () => {
  const now = Date.parse('2026-11-18T12:00:00Z');
  const base = { updatedAt: 'h1', repo: 'a/b', built: null, failed: null };
  assert.equal(needsBuild(base, { now, pin: true }), 'build', 'never built');
  const built = { ...base, built: { sha: 'c'.repeat(40), source: 'repo', handIn: 'h1' } };
  assert.equal(needsBuild(built, { now, pin: true }), 'current', 'pinned: the same hand-in stays built');
  assert.equal(needsBuild({ ...built, updatedAt: 'h2' }, { now, pin: true }), 'build', 'a new hand-in is built again');
  assert.equal(needsBuild(built, { now, pin: false, head: 'c'.repeat(40) }), 'current', 'by hand: same commit');
  assert.equal(needsBuild(built, { now, pin: false, head: 'd'.repeat(40) }), 'build', 'by hand: a new commit');
  assert.equal(needsBuild(built, { now, pin: true, force: true }), 'build', '--force');
  const failed = { ...base, failed: { handIn: 'h1', at: new Date(now - 60_000).toISOString() } };
  assert.equal(needsBuild(failed, { now, pin: true }), 'wait', 'failed a minute ago');
  assert.equal(needsBuild(failed, { now: now + RETRY_MS, pin: true }), 'build', 'tried again a day later');
  assert.equal(needsBuild({ ...failed, updatedAt: 'h2' }, { now, pin: true }), 'build', 'a new hand-in is tried at once');
});

test('failures are kept per hand-in version, and the build list carries them with what was searched', () => {
  const p = cleanPreviews({ e1: { repo: 'a/b', checked: 'h1', build: null, fail: { handIn: 'h1', at: '2026-11-18T10:00:00Z', note: 'npm install failed' } }, e2: { fail: { note: 'no version' } } });
  assert.deepEqual(p.e1.fail, { handIn: 'h1', at: '2026-11-18T10:00:00Z', note: 'npm install failed' });
  assert.equal(p.e2.fail, undefined, 'a failure with no hand-in version is dropped');
  const list = buildList('item1', [{ id: 'e1', student_id: '240001', url: 'https://x/h.pdf', updated_at: 'h1', group: 'G3' }, { id: 'e3', student_id: '240003', url: 'https://x/z.zip', updated_at: 'h9' }], p);
  assert.equal(list.entries[0].checked, 'h1');
  // with its note: the builder retries at once when the build computer, not the app, failed (builderFault)
  assert.deepEqual(list.entries[0].failed, { handIn: 'h1', at: '2026-11-18T10:00:00Z', note: 'npm install failed' });
  assert.equal(list.entries[1].checked, '', 'a hand-in nobody searched yet');
  assert.equal(list.entries[1].failed, null);
});
