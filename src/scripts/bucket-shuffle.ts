/**
 * The random-assignment show on /admin/project/[id]/groups: the selected groups and the students in no group
 * are thrown into a bucket, the bucket is shaken, then each drawn student pops out and lands on their new group.
 * Purely visual: the draw has already been made (and saved) by assignRandom() before this plays. "Skip" or
 * reduced motion jumps straight to the result.
 */

export type Draw = { group: string; students: { id: string; name: string }[] };
type Options = {
  /** Selected groups, in the order they were drawn. */
  draws: Draw[];
  /** Students who were in the bucket (unassigned before the draw). */
  pool: { id: string; name: string }[];
  /** Seats that could not be filled. */
  short: number;
  onSheet: () => void;
};

const MAX_TOKENS = 18;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

const BUCKET = `
  <svg class="bk-back" viewBox="0 0 220 190" aria-hidden="true">
    <path class="bk-handle" d="M30 46 C 40 -28, 180 -28, 190 46" />
    <ellipse class="bk-mouth" cx="110" cy="46" rx="86" ry="20" />
  </svg>
  <div class="bk-inside" data-bk-inside></div>
  <svg class="bk-front" viewBox="0 0 220 190" aria-hidden="true">
    <defs><linearGradient id="bk-g" x1="0" x2="1"><stop offset="0" stop-color="var(--bk-a)" /><stop offset=".55" stop-color="var(--bk-b)" /><stop offset="1" stop-color="var(--bk-a)" /></linearGradient></defs>
    <path class="bk-body" d="M24 46 A 86 20 0 0 0 196 46 L 172 172 Q 110 192 48 172 Z" fill="url(#bk-g)" />
    <path class="bk-rim" d="M24 46 A 86 20 0 0 0 196 46" />
    <path class="bk-band" d="M36 104 Q 110 124 184 104" />
    <text x="110" y="150" text-anchor="middle" class="bk-label">RANDOM</text>
  </svg>`;

export function playBucket({ draws, pool, short, onSheet }: Options): Promise<void> {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const groups = draws.map((d) => d.group);
  const shown = pool.slice(0, MAX_TOKENS);
  const extra = pool.length - shown.length;
  const added = draws.reduce((n, d) => n + d.students.length, 0);

  const dlg = document.createElement('dialog');
  dlg.className = 'bk';
  dlg.setAttribute('aria-label', 'Random assignment');
  dlg.innerHTML = `
    <div class="bk-box">
      <header class="bk-top">
        <div><p class="bk-k mono">Random assignment</p><h2 data-bk-title aria-live="polite">Throwing the groups into the bucket…</h2></div>
        <button class="btn btn-ghost btn-sm" type="button" data-bk-skip>Skip</button>
      </header>
      <div class="bk-stage">
        <div class="bk-tray" data-bk-tray>
          ${groups.map((g) => `<span class="bk-tok grp mono">${esc(g)}</span>`).join('')}
          ${shown.map((s) => `<span class="bk-tok">${esc(s.name)}</span>`).join('')}
          ${extra > 0 ? `<span class="bk-tok more mono">+${extra}</span>` : ''}
        </div>
        <div class="bk-bucket" data-bk-bucket>${BUCKET}</div>
      </div>
      <ol class="bk-results" data-bk-results>
        ${draws.map((d) => `<li data-bk-for="${esc(d.group)}"><b class="mono">${esc(d.group)}</b><span class="bk-slots">${
          d.students.map((s) => `<span class="bk-slot" data-bk-slot="${esc(s.id)}">${esc(s.name)} <small class="mono">${esc(s.id)}</small></span>`).join('')
          || '<span class="bk-none">no student left</span>'}</span></li>`).join('')}
      </ol>
      <footer class="bk-foot" data-bk-foot hidden>
        <p class="small muted">${added ? `${plural(added, 'student')} added to ${plural(draws.filter((d) => d.students.length).length, 'group')}.` : 'No one was added.'}${short ? ` ${plural(short, 'seat')} could not be filled: no unassigned students left.` : ''}</p>
        <div class="bk-btns"><button class="btn btn-ghost btn-sm" type="button" data-bk-sheet>Download groups sheet</button><button class="btn btn-primary btn-sm" type="button" data-bk-done>Done</button></div>
      </footer>
    </div>`;
  document.body.append(dlg);
  dlg.showModal();

  const $ = (sel: string) => dlg.querySelector<HTMLElement>(sel)!;
  const title = $('[data-bk-title]');
  const bucket = $('[data-bk-bucket]');
  const inside = $('[data-bk-inside]');
  let skipped = reduced;
  const running = new Set<Animation>();
  const timers = new Set<() => void>();

  /** Waits for an animation unless the show is skipped. */
  const play = (el: Element, frames: Keyframe[], opts: KeyframeAnimationOptions) => {
    if (skipped) return Promise.resolve();
    const a = el.animate(frames, { fill: 'forwards', ...opts });
    running.add(a);
    return a.finished.catch(() => {}).finally(() => running.delete(a));
  };
  const wait = (ms: number) => new Promise<void>((resolve) => {
    if (skipped) return resolve();
    const t = setTimeout(done, ms);
    function done() { clearTimeout(t); timers.delete(done); resolve(); }
    timers.add(done);
  });
  const skip = () => {
    if (skipped) return;
    skipped = true;
    for (const a of running) a.finish();
    for (const t of [...timers]) t();
  };
  const finish = () => {
    title.textContent = added ? 'The draw is done' : 'Nobody left in the bucket';
    dlg.querySelector('.bk-stage')!.classList.add('done');
    dlg.querySelectorAll('.bk-tok').forEach((t) => ((t as HTMLElement).style.visibility = 'hidden'));
    dlg.querySelectorAll('.bk-slot').forEach((s) => s.classList.add('in'));
    inside.innerHTML = '';
    $('[data-bk-skip]').hidden = true;
    $('[data-bk-foot]').hidden = false;
    $('[data-bk-done]').focus();
  };

  /** Where the middle of the bucket's mouth is, relative to an element's own position. */
  const toMouth = (el: Element) => {
    const a = el.getBoundingClientRect();
    const b = bucket.getBoundingClientRect();
    return { dx: b.left + b.width / 2 - (a.left + a.width / 2), dy: b.top + b.height * 0.24 - (a.top + a.height / 2) };
  };

  async function show() {
    // 1 · throw everything in, groups first, in an arc
    const tokens = [...dlg.querySelectorAll<HTMLElement>('.bk-tok')];
    const step = Math.max(35, Math.min(90, 1400 / tokens.length));
    await Promise.all(tokens.map((t, i) => {
      const { dx, dy } = toMouth(t);
      const spin = (i % 2 ? 1 : -1) * (160 + (i % 5) * 40);
      return play(t, [
        { transform: 'translate(0, 0) rotate(0) scale(1)', opacity: 1 },
        { transform: `translate(${dx * 0.55}px, ${Math.min(dy, 0) - 90}px) rotate(${spin / 2}deg) scale(.95)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${spin}deg) scale(.35)`, opacity: 0 },
      ], { duration: 620, delay: i * step, easing: 'cubic-bezier(.3,.1,.5,1)' });
    }));

    // 2 · shake the bucket while the balls tumble about inside
    title.textContent = 'Shuffling…';
    const colors = ['var(--accent)', '#7cb1ff', '#ffb86b', '#ff7aa8', '#9be8c7', '#c6a3ff'];
    const balls = Array.from({ length: Math.min(22, groups.length + shown.length + 4) }, (_, i) => {
      const b = document.createElement('i');
      b.className = 'bk-ball';
      b.style.background = colors[i % colors.length];
      b.style.left = `${12 + ((i * 37) % 76)}%`;
      inside.append(b);
      return b;
    });
    const tumble = balls.map((b, i) => play(b, Array.from({ length: 7 }, (_, k) => ({
      // the last frame leaves them in a small heap rather than in a line
      transform: `translate(${Math.round(Math.sin(i * 3 + k * 1.7) * 26)}px, ${k % 2 ? -18 - ((i * 13 + k * 7) % 46) : k === 6 ? -((i * 5) % 14) : 0}px) rotate(${k * 90}deg)`,
    })), { duration: 1700, easing: 'ease-in-out' }));
    await Promise.all([
      play(bucket, [0, -9, 8, -7, 9, -6, 7, -4, 3, 0].map((r, k) => ({ transform: `rotate(${r}deg) translateY(${k % 2 ? -6 : 0}px)` })), { duration: 1700, easing: 'ease-in-out' }),
      ...tumble,
    ]);

    // 3 · draw: each student pops out of the bucket and lands on their group
    title.textContent = added ? 'Drawing…' : 'Nobody left in the bucket';
    const each = Math.max(260, Math.min(700, 5000 / Math.max(1, added)));
    for (const d of draws) {
      const row = dlg.querySelector(`[data-bk-for="${CSS.escape(d.group)}"]`)!;
      row.classList.add('on');
      for (const s of d.students) {
        if (skipped) break;
        const slot = row.querySelector<HTMLElement>(`[data-bk-slot="${CSS.escape(s.id)}"]`)!;
        const fly = document.createElement('span');
        fly.className = 'bk-tok fly';
        fly.textContent = s.name;
        bucket.append(fly);
        const a = fly.getBoundingClientRect();
        const b = slot.getBoundingClientRect();
        const dx = b.left + b.width / 2 - (a.left + a.width / 2);
        const dy = b.top + b.height / 2 - (a.top + a.height / 2);
        await play(fly, [
          { transform: 'translate(0, 30px) scale(.3)', opacity: 0 },
          { transform: 'translate(0, -70px) scale(1.15)', opacity: 1, offset: 0.35 },
          { transform: `translate(${dx}px, ${dy}px) scale(1)`, opacity: 1 },
        ], { duration: each * 1.6, easing: 'cubic-bezier(.2,.7,.3,1)' });
        fly.remove();
        slot.classList.add('in');
        await wait(each * 0.25);
      }
      row.classList.remove('on');
      if (skipped) break;
    }
    finish();
  }

  return new Promise((resolve) => {
    const close = () => { skip(); dlg.close(); dlg.remove(); resolve(); };
    $('[data-bk-skip]').addEventListener('click', () => { skip(); finish(); });
    $('[data-bk-done]').addEventListener('click', close);
    $('[data-bk-sheet]').addEventListener('click', onSheet);
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); if ($('[data-bk-foot]').hidden) { skip(); finish(); } else close(); });
    if (skipped) finish();
    else requestAnimationFrame(() => { void show(); });
  });
}
