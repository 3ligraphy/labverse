/**
 * Step-through animations ("How it works" in the labs): Back / Play / Next, clickable dots and arrow keys.
 * The figure's `data-step` (1…n) drives each animation's CSS; one caption per step is shown. Play starts once when
 * the figure is half on screen — never for people who asked for less motion — and pauses off screen or in a hidden
 * tab. Markup: Stepper.astro.
 */

/** default time each step stays on screen while playing (a step can set its own with `ms`) */
export const STEP_MS = 3600;

/** the step after `i` of `n`: one forward, and from the last step back to the first */
export function next(i: number, n: number): number {
  return n <= 1 ? 0 : (i + 1) % n;
}

/** the step before `i`, never below the first */
export function prev(i: number): number {
  return Math.max(0, i - 1);
}

/** Play may start by itself only for people who did not ask for less motion */
export function autoplayAllowed(reducedMotion: boolean): boolean {
  return !reducedMotion;
}

/** a playing animation moves only while it is on screen and the tab is visible */
export function shouldRun(visible: boolean, pageHidden: boolean, playing: boolean): boolean {
  return playing && visible && !pageHidden;
}

/**
 * The state of one part of an animation at a step (1-based), from its `data-at` spec: space-separated
 * `steps:state` tokens, where steps is `4`, a range `3-5` or a list `7,9`. A later token wins; no match → ''.
 * `data-at="2:match 3-6:skip"` → the element gets `data-now="match"` at step 2 and `"skip"` at steps 3 to 6.
 */
export function stateAt(spec: string, step: number): string {
  let state = '';
  for (const token of spec.trim().split(/\s+/)) {
    const [steps, value = ''] = token.split(':');
    if (!steps || !value) continue;
    const hit = steps.split(',').some((part) => {
      const [a, b = a] = part.split('-').map(Number);
      return step >= a && step <= b;
    });
    if (hit) state = value;
  }
  return state;
}

function wireOne(fig: HTMLElement) {
  fig.dataset.wired = '1';
  const items = [...fig.querySelectorAll<HTMLLIElement>('[data-stp-say] > li')];
  const dots = [...fig.querySelectorAll<HTMLButtonElement>('[data-stp-dot]')];
  const prevBtn = fig.querySelector<HTMLButtonElement>('[data-stp-prev]');
  const nextBtn = fig.querySelector<HTMLButtonElement>('[data-stp-next]');
  const playBtn = fig.querySelector<HTMLButtonElement>('[data-stp-play]');
  const parts = [...fig.querySelectorAll<HTMLElement>('[data-at]')];
  const n = items.length;
  if (!n) return;
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let i = 0;
  let playing = false;
  let visible = typeof IntersectionObserver === 'undefined';
  let started = false;
  let timer = 0;

  const ms = (k: number) => Number(items[k]?.dataset.ms) || STEP_MS;

  const show = (k: number) => {
    i = k;
    fig.dataset.step = String(k + 1);
    parts.forEach((el) => (el.dataset.now = stateAt(el.dataset.at ?? '', k + 1)));
    items.forEach((li, j) => (li.hidden = j !== k));
    dots.forEach((d, j) => (j === k ? d.setAttribute('aria-current', 'step') : d.removeAttribute('aria-current')));
    if (prevBtn) prevBtn.disabled = k === 0;
    if (nextBtn) nextBtn.textContent = k === n - 1 ? '↺ Start again' : 'Next →';
  };

  const schedule = () => {
    window.clearTimeout(timer);
    if (!shouldRun(visible, document.hidden, playing)) return;
    timer = window.setTimeout(() => {
      show(next(i, n));
      if (i === n - 1) setPlaying(false);
      else schedule();
    }, ms(i));
  };

  const setPlaying = (on: boolean) => {
    playing = on;
    fig.dataset.playing = on ? '1' : '';
    if (playBtn) {
      playBtn.textContent = on ? '❚❚ Pause' : '▶ Play';
      playBtn.setAttribute('aria-pressed', String(on));
    }
    if (on && i === n - 1) show(0);
    schedule();
  };

  const go = (k: number) => {
    setPlaying(false);
    show(k);
  };

  prevBtn?.addEventListener('click', () => go(prev(i)));
  nextBtn?.addEventListener('click', () => go(next(i, n)));
  playBtn?.addEventListener('click', () => setPlaying(!playing));
  dots.forEach((d, j) => d.addEventListener('click', () => go(j)));
  fig.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(next(i, n)); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(prev(i)); }
  });
  document.addEventListener('visibilitychange', schedule);

  if (typeof IntersectionObserver !== 'undefined') {
    new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting && entry.intersectionRatio >= 0.5;
        if (visible && !started) {
          started = true;
          if (autoplayAllowed(reduced)) return setPlaying(true);
        }
        schedule();
      },
      { threshold: [0, 0.5, 1] },
    ).observe(fig);
  }
  show(0);
}

/** wire every step-through figure that is not wired yet (safe to call again after a client-side navigation) */
export function wireSteppers(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-stepper]:not([data-wired])').forEach(wireOne);
}
