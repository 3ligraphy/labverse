/** Small helpers shared by the C++ visuals: buttons, highlighted inline code, waits and flying chips. */
import { h, prefersReducedMotion } from '../../ui/dom.ts';
import { highlightCpp } from './syntax.ts';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, prefersReducedMotion() ? 0 : ms));
export const code = (src: string, cls = '') => h('code', { class: `cx-inline ${cls}`, html: highlightCpp(src) });
export const btn = (label: string, on: () => void, cls = '') => h('button', { type: 'button', class: `cx-btn ${cls}`, onclick: on }, label) as HTMLButtonElement;
export const kb = (c: string) => (c === '\n' ? '⏎' : c === ' ' ? '·' : c);

/** flies a copy of `text` from one element to another (Web Animations) */
export async function fly(stage: HTMLElement, from: Element, to: Element, text: string, cls = '') {
  const s = stage.getBoundingClientRect();
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const chip = h('span', { class: `cx-fly mono ${cls}` }, text);
  stage.append(chip);
  const x0 = a.left - s.left + a.width / 2, y0 = a.top - s.top + a.height / 2;
  const x1 = b.left - s.left + b.width / 2, y1 = b.top - s.top + b.height / 2;
  chip.style.left = `${x0}px`;
  chip.style.top = `${y0}px`;
  if (!prefersReducedMotion() && chip.animate) {
    await chip.animate([
      { transform: 'translate(-50%, -50%) scale(.9)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.15 },
      { transform: `translate(calc(-50% + ${x1 - x0}px), calc(-50% + ${y1 - y0}px)) scale(1)`, opacity: 1, offset: 0.85 },
      { transform: `translate(calc(-50% + ${x1 - x0}px), calc(-50% + ${y1 - y0}px)) scale(.9)`, opacity: 0 },
    ], { duration: 900, easing: 'cubic-bezier(.22,1,.36,1)' }).finished.catch(() => {});
  }
  chip.remove();
}
