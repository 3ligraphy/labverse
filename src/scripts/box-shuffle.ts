/**
 * The random-assignment show on /admin/project/[id]/groups: the selected groups and the students in no group
 * are thrown into an open cardboard box, the flaps fold shut and get taped, the box is shaken, then the tape
 * rips, the flaps pop open and each drawn student flies out to their new group.
 * Purely visual: the draw has already been made (and saved) by assignRandom() before this plays. "Skip", Esc
 * or reduced motion jump straight to the result.
 */

export type Draw = { group: string; students: { id: string; name: string }[] };
type Options = {
  /** Selected groups, in the order they were drawn. */
  draws: Draw[];
  /** Students who went into the box (unassigned before the draw). */
  pool: { id: string; name: string }[];
  /** Seats that could not be filled. */
  short: number;
  onSheet: () => void;
};

const MAX_TOKENS = 18;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/*
 * A 3/4 view of an open box (viewBox 240 × 220). The opening's front edge runs (40,82)–(180,82), its back edge
 * (70,56)–(210,56). Each flap is drawn open and closes by mirroring over its hinge (scale −1 about that edge).
 */
const BOX = `
  <svg class="bx-svg" viewBox="0 0 240 220" aria-hidden="true">
    <defs>
      <linearGradient id="bx-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9a466" /><stop offset="1" stop-color="#b9844a" /></linearGradient>
      <linearGradient id="bx-side" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a06c37" /><stop offset="1" stop-color="#8a5a2b" /></linearGradient>
      <linearGradient id="bx-in" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2410" /><stop offset="1" stop-color="#6b4522" /></linearGradient>
      <linearGradient id="bx-flap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6b77b" /><stop offset="1" stop-color="#cf9858" /></linearGradient>
      <linearGradient id="bx-flap-in" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c79157" /><stop offset="1" stop-color="#a87442" /></linearGradient>
      <pattern id="bx-flute" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 3 Q1.5 0 3 3 T6 3" fill="none" stroke="#8a5a2b" stroke-width=".8" /></pattern>
    </defs>
    <ellipse class="bx-shadow" cx="122" cy="206" rx="98" ry="9" />
    <g class="bx-body">
      <polygon class="bx-inside" points="40,82 180,82 210,56 70,56" fill="url(#bx-in)" />
      <polygon class="bx-inside-wall" points="70,56 210,56 210,66 70,66" />
      <polygon class="bx-flap bx-flap-back" points="70,56 210,56 200,14 80,14" fill="url(#bx-flap-in)" />
      <polygon class="bx-flap bx-flap-left" points="40,82 70,56 34,30 4,58" fill="url(#bx-flap)" />
      <polygon class="bx-face" points="180,82 210,56 210,176 180,202" fill="url(#bx-side)" />
      <polygon class="bx-flap bx-flap-right" points="180,82 210,56 238,74 208,104" fill="url(#bx-flap)" />
      <rect class="bx-face" x="40" y="82" width="140" height="120" fill="url(#bx-front)" />
      <rect x="40" y="82" width="140" height="4" fill="url(#bx-flute)" opacity=".7" />
      <path class="bx-crease" d="M40 82 H180 M180 82 V202" />
      <rect class="bx-tape-front" x="99" y="82" width="22" height="46" />
      <g class="bx-stamp">
        <rect x="52" y="140" width="76" height="40" rx="3" />
        <text x="90" y="157" text-anchor="middle">RANDOM</text>
        <text x="90" y="172" text-anchor="middle">DRAW</text>
      </g>
      <g class="bx-arrows"><path d="M148 172 v-18 m-5 6 l5 -6 l5 6 M162 172 v-18 m-5 6 l5 -6 l5 6" /><rect x="142" y="176" width="26" height="3" /></g>
      <polygon class="bx-flap bx-flap-front" points="40,82 180,82 186,104 34,104" fill="url(#bx-flap)" />
      <path class="bx-tape-top" d="M58 69 L196 69" pathLength="1" />
    </g>
  </svg>
  <span class="bx-dust l" aria-hidden="true"></span><span class="bx-dust r" aria-hidden="true"></span>`;

export function playBox({ draws, pool, short, onSheet }: Options): Promise<void> {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const groups = draws.map((d) => d.group);
  const shown = pool.slice(0, MAX_TOKENS);
  const extra = pool.length - shown.length;
  const added = draws.reduce((n, d) => n + d.students.length, 0);

  const dlg = document.createElement('dialog');
  dlg.className = 'bx';
  dlg.setAttribute('aria-label', 'Random assignment');
  dlg.innerHTML = `
    <div class="bx-wrap">
      <header class="bx-top">
        <div><p class="bx-k mono">Random assignment</p><h2 data-bx-title aria-live="polite">Into the box…</h2></div>
        <button class="btn btn-ghost btn-sm" type="button" data-bx-skip>Skip</button>
      </header>
      <div class="bx-stage">
        <div class="bx-tray">
          ${groups.map((g) => `<span class="bx-tok grp mono">${esc(g)}</span>`).join('')}
          ${shown.map((s) => `<span class="bx-tok">${esc(s.name)}</span>`).join('')}
          ${extra > 0 ? `<span class="bx-tok more mono">+${extra}</span>` : ''}
        </div>
        <div class="bx-box" data-bx-box>${BOX}</div>
      </div>
      <ol class="bx-results">
        ${draws.map((d) => `<li data-bx-for="${esc(d.group)}"><b class="mono">${esc(d.group)}</b><span class="bx-slots">${
          d.students.map((s) => `<span class="bx-slot" data-bx-slot="${esc(s.id)}">${esc(s.name)} <small class="mono">${esc(s.id)}</small></span>`).join('')
          || '<span class="bx-none">no student left</span>'}</span></li>`).join('')}
      </ol>
      <footer class="bx-foot" data-bx-foot hidden>
        <p class="small muted">${added ? `${plural(added, 'student')} added to ${plural(draws.filter((d) => d.students.length).length, 'group')}.` : 'No one was added.'}${short ? ` ${plural(short, 'seat')} could not be filled: no unassigned students left.` : ''}</p>
        <div class="bx-btns"><button class="btn btn-ghost btn-sm" type="button" data-bx-sheet>Download sheet</button><button class="btn btn-primary btn-sm" type="button" data-bx-done>Done</button></div>
      </footer>
    </div>`;
  document.body.append(dlg);
  dlg.showModal();

  const $ = (sel: string) => dlg.querySelector<HTMLElement>(sel)!;
  const title = $('[data-bx-title]');
  const box = $('[data-bx-box]');
  const body = dlg.querySelector<SVGGElement>('.bx-body')!;
  const flap = (side: string) => dlg.querySelector<SVGElement>(`.bx-flap-${side}`)!;
  const tape = dlg.querySelector<SVGPathElement>('.bx-tape-top')!;
  let skipped = reduced;
  let finished = false;
  const running = new Set<Animation>();
  const timers = new Set<() => void>();

  /** Plays an animation and waits for it, unless the show is skipped. */
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
    if (finished) return;
    finished = true;
    for (const a of body.getAnimations({ subtree: true })) a.cancel(); // back to the open box
    title.textContent = added ? 'The draw is done' : 'Nobody left in the box';
    dlg.querySelector('.bx-stage')!.classList.add('done');
    dlg.querySelectorAll('.bx-slot').forEach((s) => s.classList.add('in'));
    $('[data-bx-skip]').hidden = true;
    $('[data-bx-foot]').hidden = false;
    $('[data-bx-done]').focus();
  };

  /*
   * Flaps close by mirroring over their hinge: front and back flip vertically (front about its top edge, back
   * about its bottom edge), the side flaps flip horizontally about the edge they share with the box (and flatten, as the top is seen at an angle).
   */
  const FLAPS: [string, string, string][] = [
    ['left', '100% 100%', 'scale(-0.85, 0.5)'],
    ['right', '0% 0%', 'scale(-0.8, 0.54)'],
    ['back', '50% 100%', 'scaleY(-0.62)'],
    ['front', '50% 0%', 'scaleY(-1.15)'],
  ];
  for (const [side, origin] of FLAPS) Object.assign(flap(side).style, { transformBox: 'fill-box', transformOrigin: origin });
  const closeFlaps = () => Promise.all(FLAPS.map(([side, , shut], i) =>
    play(flap(side), [{ transform: 'none' }, { transform: shut }], { duration: 260, delay: i * 130, easing: 'cubic-bezier(.5,0,.4,1.3)' })));
  const openFlaps = () => Promise.all([...FLAPS].reverse().map(([side, , shut], i) =>
    play(flap(side), [{ transform: shut }, { transform: 'none' }], { duration: 300, delay: i * 70, easing: 'cubic-bezier(.3,1.5,.5,1)' })));

  /** Offset from an element to the middle of the box's opening. */
  const toOpening = (el: Element) => {
    const a = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    return { dx: b.left + b.width * 0.52 - (a.left + a.width / 2), dy: b.top + b.height * 0.3 - (a.top + a.height / 2) };
  };

  async function show() {
    // 1 · throw everything in, groups first, in an arc; the box hops a little as each one lands
    const tokens = [...dlg.querySelectorAll<HTMLElement>('.bx-tray .bx-tok')];
    const step = Math.max(35, Math.min(90, 1400 / tokens.length));
    await Promise.all(tokens.map((t, i) => {
      const { dx, dy } = toOpening(t);
      const spin = (i % 2 ? 1 : -1) * (160 + (i % 5) * 40);
      return play(t, [
        { transform: 'translate(0, 0) rotate(0) scale(1)', opacity: 1 },
        { transform: `translate(${dx * 0.55}px, ${Math.min(dy, 0) - 90}px) rotate(${spin / 2}deg) scale(.95)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${spin}deg) scale(.3)`, opacity: 0 },
      ], { duration: 620, delay: i * step, easing: 'cubic-bezier(.3,.1,.5,1)' });
    }).concat(play(body, [{ transform: 'none' }, { transform: 'translateY(3px) scaleY(.98)' }, { transform: 'none' }],
      { duration: 220, delay: 300, iterations: Math.max(1, Math.round(tokens.length * step / 220)) })));

    // 2 · fold the flaps shut, tape it, shake it
    title.textContent = 'Closing the box…';
    await closeFlaps();
    await play(tape, [{ strokeDashoffset: 1, opacity: 1 }, { strokeDashoffset: 0, opacity: 1 }], { duration: 380, easing: 'ease-out' });
    title.textContent = 'Shuffling…';
    const dust = [...dlg.querySelectorAll('.bx-dust')];
    await Promise.all([
      play(box, [0, -10, 9, -12, 8, -9, 11, -6, 5, 0].map((r, k) => ({
        transform: `translate(${k % 2 ? 6 : -6}px, ${k % 3 ? -14 : 0}px) rotate(${r}deg)`, offset: k / 9,
      })), { duration: 1800, easing: 'ease-in-out' }),
      ...dust.map((d, i) => play(d, [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: 1800, delay: i * 90 })),
    ]);
    await play(box, [{ transform: 'none' }, { transform: 'translateY(-10px)' }, { transform: 'none' }], { duration: 300, easing: 'ease-out' });

    // 3 · rip the tape, open up, and draw: each student flies out to their group
    title.textContent = added ? 'Drawing…' : 'Nobody left in the box';
    await play(tape, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-12px) rotate(-6deg)' }], { duration: 220 });
    await openFlaps();
    const each = Math.max(260, Math.min(700, 5000 / Math.max(1, added)));
    for (const d of draws) {
      const row = dlg.querySelector(`[data-bx-for="${CSS.escape(d.group)}"]`)!;
      row.classList.add('on');
      for (const s of d.students) {
        if (skipped) break;
        const slot = row.querySelector<HTMLElement>(`[data-bx-slot="${CSS.escape(s.id)}"]`)!;
        const fly = document.createElement('span');
        fly.className = 'bx-tok fly';
        fly.textContent = s.name;
        box.append(fly);
        const a = fly.getBoundingClientRect();
        const b = slot.getBoundingClientRect();
        void play(body, [{ transform: 'none' }, { transform: 'translateY(4px) scaleY(.97)' }, { transform: 'none' }], { duration: 200 });
        await play(fly, [
          { transform: 'translate(0, 24px) scale(.3)', opacity: 0 },
          { transform: 'translate(0, -78px) scale(1.15) rotate(-4deg)', opacity: 1, offset: 0.35 },
          { transform: `translate(${b.left + b.width / 2 - (a.left + a.width / 2)}px, ${b.top + b.height / 2 - (a.top + a.height / 2)}px) scale(1)`, opacity: 1 },
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
    $('[data-bx-skip]').addEventListener('click', () => { skip(); finish(); });
    $('[data-bx-done]').addEventListener('click', close);
    $('[data-bx-sheet]').addEventListener('click', onSheet);
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); if (!finished) { skip(); finish(); } else close(); });
    if (skipped) finish();
    else requestAnimationFrame(() => { void show(); });
  });
}
