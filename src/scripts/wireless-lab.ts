/**
 * Wireless Networks labs — the parts every lab page shares: "I can solve this" progress (this browser only),
 * numeric answer checks, concept choices, step-by-step solution reveal with guided playback and read-aloud,
 * and the question navigation highlight.
 */
export type LabOptions = {
  /** localStorage key for this lab's progress. */
  key: string;
  /** Confirmation shown before "Reset my progress". */
  resetPrompt: string;
};

const format = (n: number) => (Math.abs(n) >= 1e6 || (Math.abs(n) > 0 && Math.abs(n) < 0.001) ? n.toExponential(4) : Number(n.toPrecision(7)).toString());

export function initLab(root: HTMLElement, { key, resetPrompt }: LabOptions) {
  if (root.dataset.wired) return;
  root.dataset.wired = '1';
  let done = new Set<string>();
  try { done = new Set((JSON.parse(localStorage.getItem(key) ?? '[]') as unknown[]).map(String)); } catch {}
  const questions = [...root.querySelectorAll<HTMLElement>('[data-question]')];
  type PlaybackState = { index: number; playing: boolean; timer?: number };
  const playback = new Map<HTMLElement, PlaybackState>();
  let activePlayback: HTMLElement | undefined;

  const syncStepButton = (q: HTMLElement) => {
    const steps = [...q.querySelectorAll<HTMLElement>('[data-step]')];
    const next = q.querySelector<HTMLButtonElement>('[data-next-step]')!;
    const left = steps.filter((s) => !s.classList.contains('shown')).length;
    next.textContent = left ? `Reveal next step ↓ · ${left} left` : 'Full solution shown';
    next.disabled = left === 0;
  };
  const paintPlayback = (q: HTMLElement, completed = false) => {
    const state = playback.get(q)!;
    const steps = [...q.querySelectorAll<HTMLElement>('[data-step]')];
    const panel = q.querySelector<HTMLElement>('[data-playback]')!;
    steps.forEach((step, index) => step.classList.toggle('current', state.playing && index === state.index));
    panel.classList.toggle('playing', state.playing);
    panel.style.setProperty('--play-progress', `${((state.index + 1) / steps.length) * 100}%`);
    panel.querySelector<HTMLElement>('[data-play-count]')!.textContent = `${completed ? 'Complete' : `Step ${state.index + 1}`} of ${steps.length}`;
    panel.querySelector<HTMLElement>('[data-play-icon]')!.textContent = state.playing ? 'Ⅱ' : '▶';
    panel.querySelector<HTMLElement>('[data-play-label]')!.textContent = state.playing ? 'Pause' : completed ? 'Replay solution' : state.index ? 'Resume solution' : 'Play solution';
    syncStepButton(q);
  };
  const pausePlayback = (q: HTMLElement, completed = false) => {
    const state = playback.get(q)!;
    if (state.timer) window.clearTimeout(state.timer);
    state.timer = undefined; state.playing = false;
    if (activePlayback === q) activePlayback = undefined;
    window.speechSynthesis?.cancel();
    paintPlayback(q, completed);
  };
  const showPlaybackStep = (q: HTMLElement) => {
    const state = playback.get(q)!;
    const steps = [...q.querySelectorAll<HTMLElement>('[data-step]')];
    const step = steps[state.index];
    step.classList.add('shown');
    paintPlayback(q);
    if (q.querySelector<HTMLInputElement>('[data-narrate]')?.checked && 'speechSynthesis' in window) {
      const speech = new SpeechSynthesisUtterance(`Step ${state.index + 1}. ${step.innerText}`);
      speech.rate = Math.min(1.8, Number(q.querySelector<HTMLSelectElement>('[data-speed]')!.value));
      window.speechSynthesis.cancel(); window.speechSynthesis.speak(speech);
    }
    const words = step.innerText.trim().split(/\s+/).length;
    const speed = Number(q.querySelector<HTMLSelectElement>('[data-speed]')!.value);
    const delay = Math.max(1800, Math.min(6500, 1700 + words * 135)) / speed;
    state.timer = window.setTimeout(() => {
      if (!state.playing) return;
      if (state.index === steps.length - 1) { pausePlayback(q, true); return; }
      state.index += 1; showPlaybackStep(q);
    }, delay);
  };
  const startPlayback = (q: HTMLElement) => {
    const state = playback.get(q)!;
    const steps = [...q.querySelectorAll<HTMLElement>('[data-step]')];
    if (state.playing) { pausePlayback(q); return; }
    if (activePlayback && activePlayback !== q) pausePlayback(activePlayback);
    if (state.index >= steps.length - 1 && steps.every((step) => step.classList.contains('shown'))) {
      steps.forEach((step, index) => step.classList.toggle('shown', index === 0)); state.index = 0;
    }
    activePlayback = q; state.playing = true; showPlaybackStep(q);
  };
  const restartPlayback = (q: HTMLElement) => {
    pausePlayback(q);
    const steps = [...q.querySelectorAll<HTMLElement>('[data-step]')];
    steps.forEach((step, index) => step.classList.toggle('shown', index === 0));
    playback.get(q)!.index = 0; paintPlayback(q);
  };
  for (const q of questions) {
    playback.set(q, { index: 0, playing: false });
    if (!('speechSynthesis' in window)) q.querySelector<HTMLInputElement>('[data-narrate]')?.setAttribute('disabled', '');
    paintPlayback(q);
  }

  const update = () => {
    const pct = Math.round((done.size / questions.length) * 100);
    document.querySelectorAll<HTMLElement>('[data-progress]').forEach((el) => (el.textContent = `${pct}%`));
    document.querySelectorAll<HTMLElement>('.wn-dial').forEach((el) => el.style.setProperty('--p', `${pct}%`));
    for (const q of questions) {
      const checked = done.has(q.dataset.question!);
      q.querySelector<HTMLInputElement>('[data-done]')!.checked = checked;
      const status = q.querySelector<HTMLElement>('[data-q-status]')!;
      status.textContent = checked ? 'Complete' : 'Not started';
      status.classList.toggle('done', checked);
    }
  };
  const save = () => { try { localStorage.setItem(key, JSON.stringify([...done])); } catch {} update(); };
  root.addEventListener('change', (e) => {
    const box = (e.target as HTMLElement).closest<HTMLInputElement>('[data-done]'); if (!box) return;
    const id = box.closest<HTMLElement>('[data-question]')?.dataset.question; if (!id) return;
    if (box.checked) done.add(id); else done.delete(id);
    save();
  });
  document.querySelector('[data-reset]')?.addEventListener('click', () => { if (confirm(resetPrompt)) { done.clear(); save(); } });

  root.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const check = target.closest<HTMLButtonElement>('[data-check] button');
    if (check) {
      const wrap = check.closest<HTMLElement>('[data-check]')!, input = wrap.querySelector<HTMLInputElement>('input')!, feedback = wrap.querySelector<HTMLElement>('[data-feedback]')!;
      const actual = Number(input.value), expected = Number(wrap.dataset.answer), tolerance = Number(wrap.dataset.tolerance || 0.02);
      const ok = input.value !== '' && Number.isFinite(actual) && Math.abs(actual - expected) <= Math.max(Math.abs(expected) * tolerance, 1e-12);
      wrap.classList.toggle('ok', ok); wrap.classList.toggle('bad', !ok);
      const unit = wrap.dataset.unit ?? input.getAttribute('aria-label')?.split(' in ')[1] ?? '';
      feedback.textContent = ok ? `Correct — ${format(expected)}${unit ? ` ${unit}` : ''}.` : `Not yet. ${feedback.textContent?.startsWith('Not yet.') ? 'Check the revealed step and the unit.' : feedback.textContent}`;
      return;
    }
    const choice = target.closest<HTMLButtonElement>('[data-choice]');
    if (choice) {
      const box = choice.closest<HTMLElement>('[data-concept]')!;
      box.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === choice));
      const ok = choice.dataset.choice === box.dataset.answer;
      box.classList.toggle('ok', ok); box.classList.toggle('bad', !ok);
      box.querySelector('[data-concept-msg]')!.textContent = ok ? 'Correct — now reveal the explanation.' : (box.dataset.retry ?? 'Try again.');
      return;
    }
    const q = target.closest<HTMLElement>('[data-question]'); if (!q) return;
    const steps = [...q.querySelectorAll<HTMLElement>('[data-step]')];
    if (target.closest('[data-play]')) { startPlayback(q); return; }
    if (target.closest('[data-restart]')) { restartPlayback(q); return; }
    if (target.closest('[data-show-all]')) {
      pausePlayback(q, true); steps.forEach((s) => s.classList.add('shown'));
      playback.get(q)!.index = steps.length - 1; paintPlayback(q, true); return;
    }
    if (target.closest('[data-next-step]')) {
      pausePlayback(q);
      const nextIndex = steps.findIndex((s) => !s.classList.contains('shown'));
      if (nextIndex >= 0) { steps[nextIndex].classList.add('shown'); playback.get(q)!.index = nextIndex; }
      paintPlayback(q, nextIndex === steps.length - 1); return;
    }
  });
  update();

  const links = [...document.querySelectorAll<HTMLAnchorElement>('.wn-nav a')];
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) if (entry.isIntersecting) links.forEach((a) => a.classList.toggle('active', a.hash === `#${entry.target.id}`));
  }, { rootMargin: '-25% 0px -65%' });
  questions.forEach((q) => observer.observe(q));
}

export { format };
