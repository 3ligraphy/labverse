/**
 * Review the AI diff: a change a coding agent made. The student clicks the lines that are wrong (a 🚩 flag),
 * then submits the review: each problem found is one check, and "no false alarms" is the last one.
 * After the second try (or a perfect review) the missed problems can be revealed, each with its explanation.
 */
import { h, md } from '../../ui/dom.ts';
import { gradeReview, type DiffLine } from '../core.ts';
import { store } from './store.ts';
import type { Track } from './mount.ts';

type Cfg = { id: string; file: string; lines: DiffLine[] };

export function mountReview(host: HTMLElement, cfg: Cfg, track: Track) {
  const saved = store.get<{ flagged: number[]; solved: boolean }>(cfg.id);
  const flagged = new Set<number>(saved.flagged ?? []);
  const bugs = cfg.lines.filter((l) => l.bug).length;
  let tries = 0;
  let locked = false;
  let oldNo = 0;
  let newNo = 0;

  const rows = cfg.lines.map((l, i) => {
    if (l.sign !== '+') oldNo++;
    if (l.sign !== '-') newNo++;
    const why = h('div', { class: 'rv-why', html: md(l.why) });
    why.hidden = true;
    const btn = h('button', {
      type: 'button', class: `rv-line rv-${l.sign === '+' ? 'add' : l.sign === '-' ? 'del' : 'ctx'}`, 'aria-pressed': String(flagged.has(i)),
      'aria-label': `Line ${i + 1}: ${l.sign === '+' ? 'added' : l.sign === '-' ? 'removed' : 'unchanged'}: ${l.code.trim() || 'blank'}`,
    },
    h('span', { class: 'rv-no mono', 'aria-hidden': 'true' }, l.sign === '+' ? '' : String(oldNo)),
    h('span', { class: 'rv-no mono', 'aria-hidden': 'true' }, l.sign === '-' ? '' : String(newNo)),
    h('span', { class: 'rv-sign mono', 'aria-hidden': 'true' }, l.sign),
    h('code', { class: 'rv-code mono' }, l.code || ' '),
    h('span', { class: 'rv-flag', 'aria-hidden': 'true' }, '⚑')) as HTMLButtonElement;
    btn.addEventListener('click', () => {
      if (locked) return;
      flagged.has(i) ? flagged.delete(i) : flagged.add(i);
      btn.setAttribute('aria-pressed', String(flagged.has(i)));
      store.set(cfg.id, { flagged: [...flagged] });
      count.textContent = `${flagged.size} flagged`;
    });
    return { btn, why, l };
  });

  const count = h('span', { class: 'rv-count mono' }, `${flagged.size} flagged`);
  const status = h('p', { class: 'ax-status', role: 'status' });
  const submit = h('button', { type: 'button', class: 'ax-btn ax-btn-primary' }, '⚑ Submit review') as HTMLButtonElement;
  const reveal = h('button', { type: 'button', class: 'ax-btn' }, '👁 Show what I missed') as HTMLButtonElement;
  reveal.hidden = true;
  const clear = h('button', { type: 'button', class: 'ax-btn' }, '↺ Clear flags') as HTMLButtonElement;

  const paint = (showAll: boolean) => rows.forEach(({ btn, why, l }, i) => {
    const on = flagged.has(i);
    btn.classList.toggle('is-hit', on && l.bug);
    btn.classList.toggle('is-false', on && !l.bug);
    btn.classList.toggle('is-miss', showAll && !on && l.bug);
    why.hidden = !(l.why && ((on && l.bug) || (showAll && l.bug)));
  });

  submit.addEventListener('click', () => {
    tries++;
    const r = gradeReview(cfg.lines, [...flagged]);
    paint(false);
    track(r.passed, r.total, [...flagged].sort((a, b) => a - b).map((i) => `${i + 1}: ${cfg.lines[i]?.code.trim()}`).join('\n'));
    if (r.solved) {
      locked = true;
      status.className = 'ax-status is-ok';
      status.textContent = `✓ Approved with changes: you caught all ${bugs} problem${bugs === 1 ? '' : 's'} and raised no false alarms.`;
      store.set(cfg.id, { solved: true });
    } else {
      status.className = 'ax-status is-bad';
      status.textContent = `Found ${r.hits}/${bugs}.${r.falseAlarms ? ` ${r.falseAlarms} flag${r.falseAlarms === 1 ? ' is a' : 's are'} false alarm${r.falseAlarms === 1 ? '' : 's'} (red) — unflag ${r.falseAlarms === 1 ? 'it' : 'them'}.` : ''}${r.misses ? ' Keep reading: something is still wrong.' : ''}`;
    }
    reveal.hidden = !(tries >= 2 && !r.solved);
  });
  reveal.addEventListener('click', () => { locked = true; paint(true); reveal.hidden = true; status.textContent = 'The amber lines are the problems you missed. Read why, then explain it to your neighbour.'; });
  clear.addEventListener('click', () => { if (locked) return; flagged.clear(); store.set(cfg.id, { flagged: [] }); rows.forEach(({ btn }) => btn.setAttribute('aria-pressed', 'false')); paint(false); count.textContent = '0 flagged'; status.textContent = ''; });

  host.replaceChildren(
    h('div', { class: 'rv' },
      h('div', { class: 'ax-win-bar' }, h('span', { class: 'ax-dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), h('span', { class: 'mono' }, cfg.file || 'changes.diff'), h('span', { class: 'rv-meta mono' }, h('span', { class: 'rv-plus' }, `+${cfg.lines.filter((l) => l.sign === '+').length}`), ' ', h('span', { class: 'rv-minus' }, `−${cfg.lines.filter((l) => l.sign === '-').length}`))),
      h('p', { class: 'rv-help mono' }, `Click every line that should not be merged · ${bugs} problem${bugs === 1 ? '' : 's'} hidden`),
      h('div', { class: 'rv-body' }, ...rows.flatMap(({ btn, why }) => [btn, why])),
      h('div', { class: 'ax-actions' }, submit, clear, reveal, count)),
    status,
  );
  paint(false);
  if (saved.solved) { status.className = 'ax-status is-ok'; status.textContent = '✓ You reviewed this change before. Submit again to re-record it.'; }
}
