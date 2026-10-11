/**
 * Global client behaviour. Runs once; per-page setup re-runs on `astro:page-load`
 * (fires on first load and after every client-side navigation).
 */
import { initSearch } from './search';

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => Array.from(r.querySelectorAll<T>(s));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/* ---------- theme ---------- */
function toggleTheme() {
  const root = document.documentElement;
  const next = root.dataset.theme === 'light' ? 'dark' : 'light';
  const swap = () => {
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch {}
  };
  const d = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (d.startViewTransition && !reduced()) d.startViewTransition(swap);
  else swap();
}

/* ---------- mobile menu ---------- */
let lastFocus: HTMLElement | null = null;
function openMenu() {
  const m = $('[data-menu]');
  if (!m) return;
  lastFocus = document.activeElement as HTMLElement;
  m.hidden = false;
  m.classList.add('open');
  document.body.style.overflow = 'hidden';
  $$('[data-menu-open]').forEach((b) => b.setAttribute('aria-expanded', 'true'));
  $<HTMLElement>('[data-menu-close]', m)?.focus();
}
/** the opener the user can see (the header ☰ on tablets, "More" in the phone tab bar) */
const visibleOpener = () => $$('[data-menu-open]').find((b) => b.offsetParent !== null);
function closeMenu() {
  const m = $('[data-menu]');
  if (!m || m.hidden) return;
  m.hidden = true;
  m.classList.remove('open');
  document.body.style.overflow = '';
  $$('[data-menu-open]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  // back to where the user was; if that was inside the menu or nowhere, to the button that opens it
  const back = lastFocus && lastFocus !== document.body && !m.contains(lastFocus) ? lastFocus : visibleOpener();
  back?.focus();
}
/** Tab and Shift+Tab stay inside the open menu (it is a modal dialog). */
function trapMenuFocus(e: KeyboardEvent) {
  const m = $('[data-menu]');
  if (e.key !== 'Tab' || !m || m.hidden) return;
  const items = $$<HTMLElement>('a[href], button:not([disabled])', m).filter((el) => el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && (document.activeElement === first || !m.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (document.activeElement === last || !m.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
}

/* ---------- copy ---------- */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
const COPY_HTML =
  '<span class="idle" style="display:inline-flex;gap:6px;align-items:center"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg><span class="lbl">Copy</span></span><span class="ok" style="gap:6px;align-items:center"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>Copied</span>';

function onCopyClick(btn: HTMLElement) {
  let text = btn.dataset.copyText;
  if (text == null) {
    const code = btn.closest('.code-frame')?.querySelector('code');
    text = code ? Array.from(code.querySelectorAll('.line')).map((l) => (l as HTMLElement).innerText).join('\n').trimEnd() : '';
  }
  copyText(text).then((ok) => {
    if (!ok) return;
    btn.classList.add('copied');
    const live = $('#copy-live');
    if (live) live.textContent = 'Copied to clipboard';
    window.setTimeout(() => btn.classList.remove('copied'), 1600);
  });
}

/* ---------- code frames ---------- */
const SHELL = new Set(['bash', 'sh', 'shell', 'zsh', 'console', 'powershell', 'ps1', 'pwsh', 'cmd', 'bat', 'shellscript', 'shellsession']);
function enhanceCode(root: ParentNode = document) {
  $$<HTMLPreElement>('pre.astro-code', root).forEach((pre) => {
    if (pre.closest('.code-frame')) return;
    const lang = (pre.dataset.language || 'text').toLowerCase();
    const title = pre.getAttribute('data-title');
    const frame = document.createElement('div');
    frame.className = 'code-frame';
    const lines = pre.querySelectorAll('.line');
    const shell = SHELL.has(lang);
    if (shell) frame.classList.add('is-shell');
    if (!shell && lines.length > 3) frame.classList.add('numbered');
    if (shell) lines.forEach((l) => { if (/^\s*#/.test((l as HTMLElement).textContent || '')) l.classList.add('comment-line'); });
    const label = shell ? (lang === 'powershell' || lang === 'ps1' || lang === 'pwsh' ? 'powershell' : 'terminal') : lang;
    frame.innerHTML = `<div class="code-head"><span class="lang">${title ?? label}</span><button class="copy-btn" data-copy aria-label="Copy code">${COPY_HTML}</button></div>`;
    pre.parentNode!.insertBefore(frame, pre);
    frame.appendChild(pre);
    pre.setAttribute('tabindex', '0');
  });
  $$('.prose table').forEach((t) => {
    if (t.parentElement?.classList.contains('table-wrap')) return;
    const w = document.createElement('div');
    w.className = 'table-wrap';
    t.replaceWith(w);
    w.appendChild(t);
  });
}

/* ---------- OS tabs from "### Windows / ### macOS / ### Linux" ---------- */
const OS = ['windows', 'macos', 'linux'] as const;
type OSName = (typeof OS)[number];
const detectOS = (): OSName => (/Mac|iPhone|iPad/i.test(navigator.userAgent) ? 'macos' : /Linux|X11/i.test(navigator.userAgent) && !/Android/i.test(navigator.userAgent) ? 'linux' : 'windows');
const osKey = (h: Element) => {
  const t = (h.textContent || '').trim().toLowerCase().replace(/\s+/g, '');
  return (OS as readonly string[]).includes(t) ? (t as OSName) : null;
};
function preferredOS(): OSName {
  try { return (localStorage.getItem('os') as OSName) || detectOS(); } catch { return detectOS(); }
}
function selectOS(os: OSName) {
  try { localStorage.setItem('os', os); } catch {}
  $$('.os-tabs').forEach((g) => {
    const has = $(`[data-os="${os}"]`, g);
    if (!has) return;
    $$('.os-tab', g).forEach((t) => t.setAttribute('aria-selected', String(t.dataset.os === os)));
    $$('.os-panel', g).forEach((p) => (p.hidden = p.dataset.os !== os));
  });
}
function buildOSTabs() {
  let n = 0;
  $$('.prose').forEach((prose) => {
    const kids = Array.from(prose.children);
    for (let i = 0; i < kids.length; i++) {
      if (kids[i].tagName !== 'H3' || !osKey(kids[i])) continue;
      const group: { os: OSName; label: string; nodes: Element[] }[] = [];
      let j = i;
      while (j < kids.length && kids[j].tagName === 'H3' && osKey(kids[j])) {
        const entry = { os: osKey(kids[j])!, label: kids[j].textContent!.trim(), nodes: [] as Element[] };
        j++;
        while (j < kids.length && !/^H[1-3]$/.test(kids[j].tagName)) entry.nodes.push(kids[j++]);
        group.push(entry);
      }
      const wrap = document.createElement('div');
      wrap.className = 'os-tabs';
      const list = document.createElement('div');
      list.className = 'os-tablist';
      list.setAttribute('role', 'tablist');
      list.setAttribute('aria-label', 'Operating system');
      wrap.appendChild(list);
      const detected = detectOS();
      group.forEach((g) => {
        const id = `os-${n}-${g.os}`;
        const tab = document.createElement('button');
        tab.className = 'os-tab';
        tab.type = 'button';
        tab.setAttribute('role', 'tab');
        tab.dataset.os = g.os;
        tab.id = `${id}-tab`;
        tab.setAttribute('aria-controls', id);
        tab.innerHTML = `${g.label}${g.os === detected ? ' <span class="detected">· your OS</span>' : ''}`;
        list.appendChild(tab);
        const panel = document.createElement('div');
        panel.className = 'os-panel prose';
        panel.id = id;
        panel.dataset.os = g.os;
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tab.id);
        g.nodes.forEach((node) => panel.appendChild(node));
        wrap.appendChild(panel);
      });
      kids[i].replaceWith(wrap);
      // remaining OS headings were consumed into tabs
      kids.slice(i + 1, j).forEach((el) => { if (el.tagName === 'H3') el.remove(); });
      n++;
      i = j - 1;
    }
  });
  const pref = preferredOS();
  $$('.os-tabs').forEach((g) => {
    const first = $$('.os-tab', g)[0]?.dataset.os as OSName;
    const os = $(`[data-os="${pref}"]`, g) ? pref : first;
    $$('.os-tab', g).forEach((t) => t.setAttribute('aria-selected', String(t.dataset.os === os)));
    $$('.os-panel', g).forEach((p) => (p.hidden = p.dataset.os !== os));
  });
}

/* ---------- reveal on scroll ---------- */
let io: IntersectionObserver | null = null;
function initReveal() {
  io?.disconnect();
  document.documentElement.classList.add('reveal-ready'); // switches off the CSS fallback (global.css)
  const els = $$('[data-reveal]');
  if (reduced() || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
  io = new IntersectionObserver(
    (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io!.unobserve(e.target); } }),
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  // Blocks already on screen are revealed now: observer callbacks can wait seconds while a heavy page (a lab's
  // exercise engine) keeps the main thread busy, and the CSS fallback is already switched off by then.
  const vh = innerHeight;
  els.forEach((e) => { const r = e.getBoundingClientRect(); if (r.top < vh && r.bottom > 0) e.classList.add('in'); else io!.observe(e); });
}

/* ---------- count-up numbers: <b data-count="60">60</b> ---------- */
/** only elements whose data-count is a number (a bare data-count is someone else's hook, not a target) */
const countable = () => $$('[data-count]').filter((el) => el.dataset.count !== '' && Number.isFinite(Number(el.dataset.count)));
let countIO: IntersectionObserver | null = null;
function initCount() {
  countIO?.disconnect();
  const els = countable();
  if (!els.length || reduced() || !('IntersectionObserver' in window)) return;
  els.forEach((el) => (el.textContent = '0'));
  countIO = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        countIO!.unobserve(e.target);
        const el = e.target as HTMLElement;
        const to = Number(el.dataset.count) || 0;
        const delay = Number(el.dataset.countDelay) || 150;
        const dur = 1300;
        setTimeout(() => {
          const t0 = performance.now();
          const tick = (t: number) => {
            const p = Math.min(1, (t - t0) / dur);
            el.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3))));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }, delay);
      }),
    { threshold: 0.3 },
  );
  els.forEach((el) => countIO!.observe(el));
}

/* ---------- toc scrollspy ---------- */
let tocIO: IntersectionObserver | null = null;
function initToc() {
  tocIO?.disconnect();
  const links = $$<HTMLAnchorElement>('.toc a');
  if (!links.length) return;
  const map = new Map<string, HTMLAnchorElement>();
  links.forEach((a) => map.set(decodeURIComponent(a.hash.slice(1)), a));
  const targets = [...map.keys()].map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
  const visible = new Set<string>();
  tocIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => (e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id)));
      const first = targets.find((t) => visible.has(t.id));
      if (!first) return;
      links.forEach((a) => a.classList.toggle('active', a === map.get(first.id)));
    },
    { rootMargin: '-80px 0px -65% 0px' },
  );
  targets.forEach((t) => tocIO!.observe(t));
}

/* ---------- nav scroll state ---------- */
function onScroll() {
  const nav = $('[data-nav]');
  if (nav) nav.toggleAttribute('data-scrolled', window.scrollY > 12);
  const top = $('[data-top]');
  if (top) top.hidden = window.scrollY < innerHeight * 2;
}

/* ---------- back to top: very long pages (a lab is ~50 screens on a phone) ---------- */
function initTop() {
  $('[data-top]')?.remove();
  if (document.documentElement.scrollHeight < innerHeight * 5) return;
  const b = Object.assign(document.createElement('button'), { type: 'button', className: 'to-top', textContent: '↑', hidden: true });
  b.dataset.top = '';
  b.setAttribute('aria-label', 'Back to top');
  b.addEventListener('click', () => {
    scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
    $<HTMLElement>('#main')?.focus({ preventScroll: true });
  });
  document.body.append(b);
}

/* ---------- one-time global listeners ---------- */
document.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  if (t.closest('[data-theme-toggle]')) return toggleTheme();
  if (t.closest('[data-menu-open]')) return openMenu();
  if (t.closest('[data-menu-close]')) return closeMenu();
  const copy = t.closest<HTMLElement>('[data-copy]');
  if (copy) return onCopyClick(copy);
  const tab = t.closest<HTMLElement>('.os-tab');
  if (tab) return selectOS(tab.dataset.os as OSName);
  if (t.closest('.mobile-menu a')) closeMenu();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeMenu();
  trapMenuFocus(e);
  const tab = (e.target as HTMLElement).closest?.('.os-tab');
  if (tab && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
    const tabs = $$('.os-tab', tab.parentElement!);
    const i = tabs.indexOf(tab as HTMLElement);
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    next.focus();
    selectOS(next.dataset.os as OSName);
  }
});
window.addEventListener('scroll', onScroll, { passive: true });
// printing or saving as PDF: blocks never scrolled to would print blank, so reveal everything first
window.addEventListener('beforeprint', () => {
  $$('[data-reveal]').forEach((el) => el.classList.add('in'));
  countIO?.disconnect();
  countable().forEach((el) => (el.textContent = el.dataset.count!)); // numbers still waiting to count up
});

const live = Object.assign(document.createElement('div'), { id: 'copy-live', className: 'sr-only' });
live.setAttribute('aria-live', 'polite');
document.body.appendChild(live);

initSearch();

document.addEventListener('astro:page-load', () => {
  onScroll();
  enhanceCode();
  buildOSTabs();
  initReveal();
  initCount();
  initTop();
  onScroll();
  initToc();
  if (isMac) $$('[data-mod-key]').forEach((k) => (k.textContent = '⌘'));
  document.body.style.overflow = '';
});
document.addEventListener('astro:after-swap', () => {
  if (!document.body.contains(live)) document.body.appendChild(live);
});
