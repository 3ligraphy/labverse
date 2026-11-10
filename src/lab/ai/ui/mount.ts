/**
 * Starts the AI-for-coding widgets of a builder lab ([data-ai] placeholders rendered by AiBlock.astro) when they
 * come near the screen, and records every graded try for the TA (Lab progress, live class view) — the same rules
 * as the C++ widgets: staff previews and readers outside a session are not recorded.
 */
import { record } from '@/scripts/progress';
import type { AgentStep, DiffLine, RubricItem } from '../core.ts';
import { mountPrompt } from './prompt.ts';
import { mountAgent } from './agent.ts';
import { mountReview } from './review.ts';
import { mountAiVisual } from './visuals.ts';

type Cfg =
  | { kind: 'aiprompt'; id: string; starter: string; rubric: RubricItem[]; minWords: number; example: string }
  | { kind: 'agentsim'; id: string; steps: AgentStep[] }
  | { kind: 'aidiff'; id: string; file: string; lines: DiffLine[] }
  | { kind: 'aivisual'; id: string; visual: string };

export type Track = (passed: number, total: number, work: string) => void;

function tracker(el: HTMLElement, file: string): Track {
  return (passed, total, work) => {
    const labEl = el.closest<HTMLElement>('[data-lab]');
    const lab = labEl?.dataset.lab;
    const solved = passed === total && total > 0;
    if (solved) el.dataset.solved = '';
    if (lab && labEl?.dataset.sessionAccess !== 'staff') record.attempt({ lab, exercise: el.dataset.aiId!, passed, total, files: { [file]: work } });
    if (!solved) return;
    // every graded item of this task solved → tick its Done box
    const task = el.closest('.task');
    const box = task?.querySelector<HTMLInputElement>('[data-task-check]');
    if (task && box && !box.checked && [...task.querySelectorAll<HTMLElement>('[data-graded]')].every((g) => g.hasAttribute('data-solved'))) {
      box.checked = true;
      box.dispatchEvent(new Event('change'));
    }
  };
}

function start(el: HTMLElement) {
  if (el.dataset.aiOn) return;
  el.dataset.aiOn = '1';
  const host = el.querySelector<HTMLElement>('[data-ai-host]') ?? el;
  let cfg: Cfg;
  try { cfg = JSON.parse(el.querySelector('script[type="application/json"]')?.textContent ?? '{}'); } catch { return; }
  try {
    if (cfg.kind === 'aiprompt') mountPrompt(host, cfg, tracker(el, 'prompt.md'));
    else if (cfg.kind === 'agentsim') mountAgent(host, cfg, tracker(el, 'decisions.txt'));
    else if (cfg.kind === 'aidiff') mountReview(host, cfg, tracker(el, 'review.txt'));
    else if (cfg.kind === 'aivisual') mountAiVisual(host, cfg.visual);
  } catch (error) {
    console.error('[ai] could not start this widget', error);
    host.textContent = 'This part could not load — refresh the page.';
  }
}

export function mountAi() {
  const els = [...document.querySelectorAll<HTMLElement>('[data-ai]')];
  if (!els.length) return;
  if (!('IntersectionObserver' in window)) { els.forEach(start); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { start(e.target as HTMLElement); io.unobserve(e.target); }
  }, { rootMargin: '600px 0px' });
  els.forEach((el) => io.observe(el));
}

