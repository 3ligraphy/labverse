// App previews: finding the student's GitHub repo, matching an uploaded build to its hand-in, and serving a build in a
// sandbox. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { findRepo, cleanRepo, cleanPreviews, entryFor, buildList, buildFile, previewHeaders, withShim, typeOf, KEY_RE } = await import('../src/lib/previews/core.ts');

test('the student repo in a report: the most mentioned one, never a library or a funding page', () => {
  const report = 'Our repo: https://github.com/student1/My-App\nfunding https://github.com/sponsors/someone https://github.com/sponsors/someone\nsee github.com/student1/My-App.git and https://github.com/expo/expo';
  assert.equal(findRepo(report), 'student1/My-App');
  assert.equal(findRepo('git@github.com:team7/study-planner.git'), 'team7/study-planner');
  assert.equal(findRepo('https://github.com/YW-B/Smart-Food-Expiry-\nTracker ... https://github.com/YW-B/Smart-Food-Expiry-Tracker'), 'YW-B/Smart-Food-Expiry-Tracker', 'a link cut at a line end');
  assert.equal(findRepo('first https://github.com/a1/first-app then https://github.com/a1/other'), 'a1/first-app', 'a tie: the one named first');
  assert.equal(findRepo('no links here'), null);
});

test('a repo staff type: a URL, a clone URL or owner/name', () => {
  assert.equal(cleanRepo('https://github.com/student1/My-App/tree/main'), 'student1/My-App');
  assert.equal(cleanRepo('git+https://github.com/student1/My-App.git'), 'student1/My-App');
  assert.equal(cleanRepo('student1/My-App'), 'student1/My-App');
  assert.equal(cleanRepo('https://gitlab.com/x/y'), null);
  assert.equal(cleanRepo('not a repo'), null);
});

test('saved previews are cleaned, and a build belongs to its hand-in by id or by student ID', () => {
  const p = cleanPreviews({ e1: { repo: 'https://github.com/a/b', repoBy: 'found', checked: 't', build: { key: 'abcdefghij0123456789', url: 'u', pathname: 'p', source: 'zip', sha: 'x', size: 10 } }, 'bad id!': {}, e2: { build: { key: 'short' } } });
  assert.deepEqual(Object.keys(p), ['e1', 'e2']);
  assert.equal(p.e1.repo, 'a/b');
  assert.equal(p.e1.build?.source, 'zip');
  assert.equal(p.e1.build?.sha, null, 'not a commit id');
  assert.equal(p.e2.build, null, 'a bad key is dropped');
  const entries = [{ id: 'e1', student_id: '240001' }, { id: 'e2', student_id: '23cs0002' }];
  assert.equal(entryFor({ entry: 'e1' }, entries), 'e1');
  assert.equal(entryFor({ entry: 'gone', studentId: '23CS0002' }, entries), 'e2', 'by student ID, any case');
  assert.equal(entryFor({ studentId: '999' }, entries), null);
});

test('the build list carries each hand-in, its group number, its repo and what is already built', () => {
  const list = buildList('item1', [{ id: 'e1', student_id: '240001', url: 'https://x/h.zip', updated_at: 't1', group: 'G12' }], cleanPreviews({ e1: { repo: 'a/b', build: { key: 'abcdefghij0123456789', url: 'u', sha: 'f'.repeat(40) } } }));
  assert.equal(list.entries[0].group, 12);
  assert.equal(list.entries[0].repo, 'a/b');
  assert.equal(list.entries[0].built?.sha, 'f'.repeat(40));
});

test('serving a build: the page for folders and app routes, nothing outside the build, the right types', () => {
  const has = (p: string) => ['index.html', '_expo/static/js/web/entry-1.js', 'assets/logo.png'].includes(p);
  assert.equal(buildFile('', has), 'index.html');
  assert.equal(buildFile('tabs/settings', has), 'index.html', 'an app route');
  assert.equal(buildFile('_expo/static/js/web/entry-1.js', has), '_expo/static/js/web/entry-1.js');
  assert.equal(buildFile('missing.js', has), null);
  assert.equal(buildFile('../secret', has), null);
  assert.equal(buildFile('%2e%2e/x', has), null);
  assert.equal(typeOf('a/b.woff2'), 'font/woff2');
  const page = previewHeaders('index.html');
  assert.match(page['content-security-policy'], /^sandbox allow-scripts/);
  assert.doesNotMatch(page['content-security-policy'], /allow-same-origin/, 'never the site’s origin');
  assert.match(previewHeaders('_expo/static/js/web/entry-1.js')['cache-control'], /max-age=31536000.*immutable/);
  assert.ok(withShim('<html><head><title>x</title>').startsWith('<html><head><script>'), 'storage shim first');
  assert.ok(KEY_RE.test('abcdefghij0123456789'));
});
