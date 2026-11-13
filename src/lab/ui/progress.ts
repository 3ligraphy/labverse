/**
 * Keeps every progress indicator in sync with solved exercises: the sticky bar (block, exercise n/17,
 * %, one square per exercise), the header ring, the session-plan bar and the completion banner.
 */
import type { ExerciseMeta } from '../exercises/lab-02/meta.ts';
import { loadAll } from './store.ts';

type Block = { n: number; part: number; title: string };

export function initProgress(lab: string, meta: ExerciseMeta[], blocks: readonly Block[]) {
  const bar = document.querySelector<HTMLElement>('[data-lab-progress]');
  const ids = meta.map((m) => m.id);
  let states = loadAll(lab, ids);

  const paint = () => {
    states = loadAll(lab, ids);
    const solved = ids.filter((id) => states[id].status === 'solved').length;
    const p = ids.length ? solved / ids.length : 0;

    document.querySelectorAll<HTMLElement>('[data-sq]').forEach((sq) => (sq.dataset.state = states[sq.dataset.sq!]?.status ?? 'new'));
    document.querySelectorAll('[data-lp-pct], [data-pct]').forEach((el) => (el.textContent = String(Math.round(p * 100))));
    document.querySelectorAll('[data-done]').forEach((el) => (el.textContent = String(solved)));
    document.querySelector<HTMLElement>('[data-lp-fill]')?.style.setProperty('--p', String(p));
    const ring = document.querySelector<SVGCircleElement>('[data-ring]');
    if (ring) ring.style.strokeDashoffset = String(100 - p * 100);
    document.querySelectorAll<HTMLAnchorElement>('[data-plan-part]').forEach((a) => {
      const inBlock = meta.filter((m) => String(m.block) === a.dataset.planPart);
      const done = inBlock.filter((m) => states[m.id].status === 'solved').length;
      a.style.setProperty('--p', String(inBlock.length ? done / inBlock.length : 0));
    });
    const banner = document.querySelector<HTMLElement>('[data-lab-complete]');
    if (banner) banner.hidden = solved !== ids.length;
  };

  // Where the student is: the Part on screen (every Part, also the reading ones without exercises), and the exercise
  // on screen when that Part has exercises; anywhere else, the next exercise still to solve (a link to it).
  const where = () => {
    if (!bar) return;
    const mid = window.innerHeight * 0.35;
    const parts = [...document.querySelectorAll<HTMLElement>('section.part[id^="part-"]')];
    let part = parts[0];
    for (const p of parts) if (p.getBoundingClientRect().top < mid) part = p;
    const n = part ? part.id.slice('part-'.length) : String(blocks[0]?.part ?? '');
    const title = (part?.querySelector('.part-title')?.textContent ?? blocks[0]?.title ?? '').replace(/^\s*Part \d+:\s*/, '').trim();
    bar.querySelector('[data-lp-where]')!.textContent = parts.length ? `Part ${n} of ${parts.length}` : `Part ${n}`;
    bar.querySelector('[data-lp-title]')!.textContent = title;
    const inPart = meta.filter((m) => String(m.block) === n);
    let ex: ExerciseMeta | null = null;
    for (const m of inPart) {
      const el = document.getElementById(`ex-${m.id}`);
      if (el && el.getBoundingClientRect().top < mid) ex = m;
    }
    if (inPart.length && !ex) ex = inPart[0];
    const link = bar.querySelector<HTMLAnchorElement>('[data-lp-ex]')!;
    const next = ex ? null : meta.find((m) => states[m.id]?.status !== 'solved');
    const target = ex ?? next;
    link.textContent = ex ? `Ex ${ex.n}/${meta.length}` : next ? `Next: Ex ${next.n}` : `All ${meta.length} solved`;
    if (target) link.href = `#ex-${target.id}`;
    else link.removeAttribute('href');
    document.querySelectorAll<HTMLElement>('[data-sq]').forEach((sq) => sq.classList.toggle('is-here', Boolean(ex) && sq.dataset.sq === ex!.id));
  };

  // show the sticky bar once the lab header has scrolled away
  const head = document.querySelector('.lab-head');
  let io: IntersectionObserver | null = null;
  if (bar && head) {
    io = new IntersectionObserver(([entry]) => bar.classList.toggle('is-on', !entry.isIntersecting), { rootMargin: '-80px 0px 0px 0px' });
    io.observe(head);
  }

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      where();
    });
  };

  window.addEventListener('lab:progress', paint);
  window.addEventListener('scroll', onScroll, { passive: true });
  paint();
  where();

  return () => {
    io?.disconnect();
    window.removeEventListener('lab:progress', paint);
    window.removeEventListener('scroll', onScroll);
  };
}
