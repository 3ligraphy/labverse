// Lab 07 "explain → solve": every exercise of Part 4 has a full explanation above it — real pictures of the lab
// phone, a recording, a step-through animation and a CodeTour (coloured code with the phone beside it) — and the
// code shown is exactly the code of that exercise's solution, with the student's lines marked +.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';

const mdx = readFileSync(new URL('../src/content/labs/lab-07.mdx', import.meta.url), 'utf8');
const P = (await import('../src/lab/exercises/lab-07/project.ts')) as unknown as Record<string, string>;
const { exercises } = await import('../src/lab/exercises/lab-07/index.ts');

const part = (n: number) => mdx.slice(mdx.indexOf(`<Part n="${n}"`), mdx.indexOf(`<Part n="${n + 1}"`));
const part4 = part(4);
/** the text between the previous exercise (or the start of the part) and each exercise */
function blocks(text: string) {
  const out: { id: string; before: string }[] = [];
  let from = 0;
  for (const m of text.matchAll(/<Exercise id="([^"]+)" \/>/g)) {
    out.push({ id: m[1], before: text.slice(from, m.index) });
    from = m.index! + m[0].length;
  }
  return out;
}
/** words of the prose only: no components, no code */
const proseWords = (s: string) =>
  s.replace(/<([A-Z]\w*)[\s\S]*?\/>/g, ' ').replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]*`/g, ' x ').split(/\s+/).filter((w) => /[a-z]/i.test(w)).length;

const STEPS = [
  { id: 'lab-07--step-a-permission', animation: 'ReturnGates', code: 'SCANNER_B', starter: 'SCANNER_A' },
  { id: 'lab-07--step-b-scan-once', animation: 'LockTimeline', code: 'SCANNER_D', starter: 'SCANNER_B' },
  { id: 'lab-07--step-c-feedback', animation: 'HapticTiming', code: 'FEEDBACK', starter: 'FEEDBACK_STARTER' },
  { id: 'lab-07--step-d-flip', animation: 'FlipState', code: 'SCANNER', starter: 'SCANNER_D' },
] as const;

test('every Part 4 exercise has a full explanation above it: pictures, a recording, an animation, the code with the phone', () => {
  const found = blocks(part4);
  assert.deepEqual(found.map((b) => b.id), STEPS.map((s) => s.id));
  for (const [i, b] of found.entries()) {
    const s = STEPS[i];
    assert.match(b.before, /<Shot frame="device"/, `${s.id}: real pictures of the lab phone`);
    assert.match(b.before, /<Clip /, `${s.id}: a recording`);
    assert.match(b.before, new RegExp(`<${s.animation} />`), `${s.id}: the animation`);
    assert.match(b.before, new RegExp(`<CodeTour [^>]*code=\\{P\\.${s.code}\\}`), `${s.id}: the code of its solution`);
    for (const beat of ['① What you will build', '② How it works', '③ The code, line by line', '④ Your turn']) assert.ok(b.before.includes(beat), `${s.id}: “${beat}”`);
    assert.ok(proseWords(b.before) >= 120, `${s.id}: ${proseWords(b.before)} words of explanation`);
  }
});

test('the code above each step is the solution of its exercise', () => {
  for (const s of STEPS) {
    const ex = exercises.find((e) => e.id === s.id) as unknown as { solution: { files: Record<string, string> } };
    assert.ok(ex, s.id);
    assert.ok(Object.values(ex.solution.files).includes(P[s.code]), `${s.id}: P.${s.code} is its solution`);
  }
});

/** the lines of `after` that are new or changed compared with `before` (a line diff), blank lines left out */
function changedLines(before: string, after: string) {
  const a = before.replace(/\n$/, '').split('\n');
  const b = after.replace(/\n$/, '').split('\n');
  const L = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) for (let j = b.length - 1; j >= 0; j -= 1) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const kept = new Set<number>();
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (a[i] === b[j]) { kept.add(j); i += 1; j += 1; } else if (L[i + 1][j] >= L[i][j + 1]) i += 1; else j += 1;
  }
  return { lines: b, changed: b.map((_, j) => j).filter((j) => !kept.has(j) && b[j].trim() !== '').map((j) => j + 1) };
}
const isComment = (line: string) => /^\s*(\/\/|\/\*|\*)/.test(line);

test('the + marks are the lines the student writes: every changed code line, and nothing that did not change', () => {
  for (const s of STEPS) {
    const tour = new RegExp(`<CodeTour [^>]*code=\\{P\\.${s.code}\\}[^>]*added=\\{\\[([\\d, ]+)\\]\\}`).exec(part4);
    assert.ok(tour, `a CodeTour of P.${s.code} with + lines`);
    const marked = tour![1].split(',').map(Number);
    const { lines, changed } = changedLines(P[s.starter], P[s.code]);
    const code = changed.filter((n) => !isComment(lines[n - 1]));
    assert.deepEqual(code.filter((n) => !marked.includes(n)), [], `P.${s.code}: changed code lines without +`);
    assert.deepEqual(marked.filter((n) => !changed.includes(n)), [], `P.${s.code}: + on lines that did not change`);
  }
});

test('every recording is a small MP4 with a poster and steps in words', () => {
  const clips = [...mdx.matchAll(/<Clip ([\s\S]*?)\/>/g)].map((m) => m[1]);
  assert.ok(clips.length >= 4, `${clips.length} recordings`);
  for (const c of clips) {
    const src = /src="([^"]+)"/.exec(c)![1];
    const poster = /poster="([^"]+)"/.exec(c)![1];
    assert.match(src, /^\/labs\/lab-07\/clips\/[\w-]+\.mp4$/);
    for (const f of [src, poster]) assert.ok(existsSync(new URL(`../public${f}`, import.meta.url)), `${f} exists`);
    assert.ok(statSync(new URL(`../public${src}`, import.meta.url)).size <= 600 * 1024, `${src} is at most 600 KB`);
    assert.match(c, /steps=\{\[\s*'/, `${src}: the steps say what happens`);
    assert.match(c, /alt="[^"]{20,}"/, `${src}: a real alt text`);
  }
});

test('every phone picture of a CodeTour exists and is a small webp', () => {
  const shots = [...mdx.matchAll(/shot: '([^']+)'/g)].map((m) => m[1]);
  assert.ok(shots.length >= 20, `${shots.length} phone pictures in the walk-throughs`);
  for (const src of new Set(shots)) {
    assert.match(src, /^\/labs\/lab-07\/[\w/-]+\.webp$/);
    const file = new URL(`../public${src}`, import.meta.url);
    assert.ok(existsSync(file), `${src} exists`);
    assert.ok(statSync(file).size <= 160 * 1024, `${src} is small`);
  }
});
