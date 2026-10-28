/**
 * Starts the C++ widgets of a builder lab ([data-cpp] placeholders rendered by CppBlock.astro) when they come
 * near the screen, and records every graded try for the TA (Lab progress, live class view). Staff previews and
 * readers outside a session are not recorded — the same rules as the other lab exercises.
 */
import { record } from '@/scripts/progress';
import type { CppCheck } from '../checks.ts';
import { CppRunner } from './runner.ts';
import { mountParsons, mountPredict } from './puzzles.ts';
import { mountVisual } from './visuals.ts';

type Cfg =
  | { kind: 'cpp'; id: string; starter: string; input: string; checks: CppCheck[]; hints: string[]; paste: boolean }
  | { kind: 'cpppredict'; id: string; code: string; input: string; options: { text: string; correct: boolean }[]; trace: boolean }
  | { kind: 'parsons'; id: string; code: string; input: string }
  | { kind: 'cppvisual'; id: string; visual: string; text: string };

function tracker(el: HTMLElement) {
  return (passed: number, total: number, code: string) => {
    const labEl = el.closest<HTMLElement>('[data-lab]');
    const lab = labEl?.dataset.lab;
    const solved = passed === total && total > 0;
    if (solved) el.dataset.solved = '';
    if (lab && labEl?.dataset.sessionAccess !== 'staff') record.attempt({ lab, exercise: el.dataset.cppId!, passed, total, files: { 'main.cpp': code } });
    if (!solved) return;
    // every graded item of this task solved → tick its Done box (ring, tracker and session plan update)
    const task = el.closest('.task');
    if (!task) return;
    const graded = [...task.querySelectorAll<HTMLElement>('[data-cpp][data-graded]')];
    const box = task.querySelector<HTMLInputElement>('[data-task-check]');
    if (box && !box.checked && graded.every((g) => g.hasAttribute('data-solved'))) {
      box.checked = true;
      box.dispatchEvent(new Event('change'));
    }
  };
}

function start(el: HTMLElement) {
  if (el.dataset.cppOn) return;
  el.dataset.cppOn = '1';
  const host = el.querySelector<HTMLElement>('[data-cpp-host]') ?? el;
  let cfg: Cfg;
  try { cfg = JSON.parse(el.querySelector('script[type="application/json"]')?.textContent ?? '{}'); } catch { return; }
  const track = tracker(el);
  try {
    if (cfg.kind === 'cpp') {
      new CppRunner(host, { id: cfg.id, starter: cfg.starter, input: cfg.input, checks: cfg.checks, hints: cfg.hints, paste: cfg.paste, onCheck: track });
    } else if (cfg.kind === 'cpppredict') {
      const q = el.querySelector<HTMLElement>('[data-cpp-q]');
      const x = el.querySelector<HTMLElement>('[data-cpp-x]');
      mountPredict(host, { id: cfg.id, questionHtml: q?.innerHTML ?? '', code: cfg.code, input: cfg.input, options: cfg.options, explainHtml: x?.innerHTML ?? '', trace: cfg.trace }, track);
    } else if (cfg.kind === 'parsons') {
      mountParsons(host, { id: cfg.id, code: cfg.code, input: cfg.input }, track);
    } else if (cfg.kind === 'cppvisual') {
      mountVisual(host, cfg.visual, cfg.text);
    }
  } catch (error) {
    console.error('[cpp] could not start this widget', error);
    host.textContent = 'This part could not load — refresh the page.';
  }
}

export function mountCpp() {
  const els = [...document.querySelectorAll<HTMLElement>('[data-cpp]')];
  if (!els.length) return;
  if (!('IntersectionObserver' in window)) { els.forEach(start); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { start(e.target as HTMLElement); io.unobserve(e.target); }
  }, { rootMargin: '600px 0px' });
  els.forEach((el) => io.observe(el));
}
