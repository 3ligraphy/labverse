/**
 * Drag a one-person group onto another group, with a mouse, a pen or a finger. A drag starts on a handle
 * `[data-solo-drag="<group key>"]`; groups that can be dropped on carry `[data-drop-key="<group key>"]`.
 * While dragging, the group under the pointer is marked `drop-ok` or `drop-no` (with the reason in the ghost), the
 * page scrolls near the top and bottom edges, and Escape cancels. Used by the Feedback and Groups & ideas pages.
 */
type Options = {
  /** The name shown on the ghost, e.g. the student's name. */
  label: (from: string) => string;
  /** null when `from` may be dropped on `to`, otherwise why not. */
  check: (from: string, to: string) => string | null;
  drop: (from: string, to: string) => void;
};

export function soloDrag(container: HTMLElement, opts: Options) {
  let from = '', over: HTMLElement | null = null, ghost: HTMLElement | null = null, source: HTMLElement | null = null;
  let startX = 0, startY = 0, lastY = 0, dragging = false, raf = 0;

  const mark = (el: HTMLElement | null, why: string | null) => {
    if (over && over !== el) over.classList.remove('drop-ok', 'drop-no');
    over = el;
    if (!el) return;
    el.classList.toggle('drop-ok', !why);
    el.classList.toggle('drop-no', Boolean(why));
  };
  const hint = (text: string, bad = false) => {
    if (!ghost) return;
    ghost.querySelector('small')!.textContent = text;
    ghost.classList.toggle('no', bad);
  };
  // the page follows the finger near the edges, so a long list of groups can be crossed in one drag
  const scroll = () => {
    if (!dragging) return;
    const edge = 70, h = innerHeight;
    if (lastY < edge) scrollBy(0, -Math.ceil((edge - lastY) / 4));
    else if (lastY > h - edge) scrollBy(0, Math.ceil((lastY - (h - edge)) / 4));
    raf = requestAnimationFrame(scroll);
  };
  const end = (drop: boolean) => {
    cancelAnimationFrame(raf);
    const target = over?.dataset.dropKey;
    const ok = drop && dragging && target && !opts.check(from, target);
    mark(null, null);
    ghost?.remove(); ghost = null;
    source?.classList.remove('dragging'); source = null;
    document.body.classList.remove('solo-dragging');
    dragging = false;
    if (ok) opts.drop(from, target!);
    from = '';
  };

  container.addEventListener('pointerdown', (e) => {
    const handle = (e.target as HTMLElement).closest<HTMLElement>('[data-solo-drag]');
    if (!handle || e.button > 0) return;
    e.preventDefault();
    from = handle.dataset.soloDrag!;
    source = handle.closest<HTMLElement>('[data-drop-key]');
    startX = e.clientX; startY = e.clientY; lastY = e.clientY;
    handle.setPointerCapture(e.pointerId);
  });
  container.addEventListener('pointermove', (e) => {
    if (!from) return;
    lastY = e.clientY;
    if (!dragging) {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) < 6) return;
      dragging = true;
      ghost = document.createElement('div');
      ghost.className = 'solo-ghost';
      ghost.setAttribute('aria-hidden', 'true');
      ghost.innerHTML = '<b></b><small></small>';
      ghost.querySelector('b')!.textContent = opts.label(from);
      document.body.append(ghost);
      source?.classList.add('dragging');
      document.body.classList.add('solo-dragging');
      raf = requestAnimationFrame(scroll);
    }
    ghost!.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 14}px)`;
    // the ghost ignores the pointer (CSS), so this finds the group underneath
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-drop-key]') ?? null;
    const to = el && container.contains(el) && el.dataset.dropKey !== from ? el : null;
    const why = to ? opts.check(from, to.dataset.dropKey!) : null;
    mark(to, why);
    hint(to ? why ?? 'Drop to move here' : 'Drag onto a group', Boolean(to && why));
  });
  container.addEventListener('pointerup', () => end(true));
  container.addEventListener('pointercancel', () => end(false));
  container.addEventListener('lostpointercapture', () => { if (from) end(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && from) end(false); });
}
