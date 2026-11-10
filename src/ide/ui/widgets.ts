/** Shared widgets: context menus, notifications, the quick input (palette, pickers, prompts) and confirm dialogs. */
import { clear, h, icon } from '../core/dom';

/* ------------------------------------------------------------------ context menu */
export type MenuItem = { label: string; key?: string; run?: () => unknown; disabled?: boolean; checked?: boolean; submenu?: MenuItem[] } | 'sep';
let openMenus: HTMLElement[] = [];
export function closeMenus() { openMenus.forEach((m) => m.remove()); openMenus = []; }

export function showMenu(x: number, y: number, items: MenuItem[], opts: { parent?: HTMLElement; onClose?: () => void } = {}) {
  if (!opts.parent) closeMenus();
  const menu = h('div', { class: 'ide-menu', role: 'menu', tabIndex: -1 });
  let sub: HTMLElement | null = null;
  for (const it of items) {
    if (it === 'sep') { menu.append(h('div', { class: 'ide-menu-sep' })); continue; }
    const row = h('button', { class: 'ide-menu-item', role: 'menuitem', type: 'button', disabled: it.disabled },
      h('span', { class: 'ide-menu-check' }, it.checked ? icon('check') : null),
      h('span', { class: 'ide-menu-label' }, it.label),
      it.submenu ? icon('chevron-right') : h('span', { class: 'ide-menu-key' }, it.key ?? ''));
    row.addEventListener('mouseenter', () => {
      sub?.remove(); sub = null;
      if (it.submenu && !it.disabled) {
        const r = row.getBoundingClientRect();
        sub = showMenu(r.right - 2, r.top - 4, it.submenu, { parent: menu });
      }
    });
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      if (it.submenu) return;
      closeMenus();
      opts.onClose?.();
      void it.run?.();
    });
    menu.append(row);
  }
  document.body.append(menu);
  openMenus.push(menu);
  const r = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(4, Math.min(x, innerWidth - r.width - 4))}px`;
  menu.style.top = `${Math.max(4, Math.min(y, innerHeight - r.height - 4))}px`;
  menu.addEventListener('keydown', (e) => {
    const rows = [...menu.querySelectorAll<HTMLButtonElement>('.ide-menu-item:not(:disabled)')];
    const i = rows.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); rows[(i + 1) % rows.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); rows[(i - 1 + rows.length) % rows.length]?.focus(); }
    else if (e.key === 'Escape') { closeMenus(); opts.onClose?.(); }
  });
  if (!opts.parent) {
    menu.focus();
    const off = (e: Event) => {
      if (openMenus.some((m) => m.contains(e.target as Node))) return;
      closeMenus(); opts.onClose?.();
      window.removeEventListener('mousedown', off, true);
    };
    setTimeout(() => window.addEventListener('mousedown', off, true));
    window.addEventListener('blur', () => closeMenus(), { once: true });
  }
  return menu;
}

/* ------------------------------------------------------------------ notifications */
let toasts: HTMLElement | null = null;
export type ToastAction = { label: string; run: () => unknown };
export function notify(message: string, kind: 'info' | 'warning' | 'error' = 'info', actions: ToastAction[] = [], sticky = false) {
  toasts ??= document.body.appendChild(h('div', { class: 'ide-toasts', role: 'status', 'aria-live': 'polite' }));
  const close = () => el.remove();
  const el = h('div', { class: `ide-toast ${kind}` },
    icon(kind === 'error' ? 'error' : kind === 'warning' ? 'warning' : 'info', 'ide-toast-icon'),
    h('div', { class: 'ide-toast-body' }, h('p', null, message),
      actions.length ? h('div', { class: 'ide-toast-actions' }, actions.map((a) => h('button', { class: 'ide-btn', type: 'button', onclick: () => { close(); void a.run(); } }, a.label))) : null),
    h('button', { class: 'ide-icon-btn', type: 'button', title: 'Close', onclick: close }, icon('close')));
  toasts.append(el);
  if (!sticky && !actions.length) setTimeout(close, kind === 'error' ? 9000 : 5000);
  return close;
}

/* ------------------------------------------------------------------ quick input */
export type QuickItem<T = unknown> = { label: string; description?: string; detail?: string; iconName?: string; key?: string; value: T; separator?: string };
type QuickOpts<T> = {
  placeholder?: string;
  value?: string;
  /** items for the text typed so far (called on every keystroke) */
  items?: (query: string) => QuickItem<T>[] | Promise<QuickItem<T>[]>;
  /** free text input: no list, Enter accepts the text; return an error sentence to refuse it */
  validate?: (text: string) => string | null | undefined;
  password?: boolean;
  /** keep our own order instead of fuzzy sorting */
  noFilter?: boolean;
  onHighlight?: (item: QuickItem<T> | null) => void;
};

/** Fuzzy score: every query char in order; consecutive and word-start matches score higher. -1 = no match. */
export function fuzzy(query: string, text: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let score = 0, ti = 0, streak = 0;
  for (const ch of q) {
    if (ch === ' ') continue;
    const at = t.indexOf(ch, ti);
    if (at < 0) return -1;
    streak = at === ti ? streak + 1 : 0;
    score += 1 + streak * 2 + (at === 0 || /[\s/._\-:]/.test(t[at - 1]) ? 3 : 0) - Math.min(3, (at - ti) * 0.1);
    ti = at + 1;
  }
  return score - t.length * 0.01;
}

let quickOpen: { close: () => void } | null = null;
export function quickInput<T = string>(opts: QuickOpts<T>): Promise<{ item?: QuickItem<T>; text: string } | null> {
  quickOpen?.close();
  return new Promise((resolve) => {
    const input = h('input', { class: 'ide-quick-input', type: opts.password ? 'password' : 'text', placeholder: opts.placeholder ?? '', value: opts.value ?? '', spellcheck: false, autocomplete: 'off' });
    const list = h('div', { class: 'ide-quick-list', role: 'listbox' });
    const msg = h('div', { class: 'ide-quick-msg' });
    const box = h('div', { class: 'ide-quick', role: 'dialog', 'aria-label': opts.placeholder ?? 'Quick input' }, input, msg, list);
    const veil = h('div', { class: 'ide-quick-veil' }, box);
    let shown: QuickItem<T>[] = [];
    let active = 0;
    let seq = 0;
    const prevFocus = document.activeElement as HTMLElement | null;
    const done = (v: { item?: QuickItem<T>; text: string } | null) => {
      veil.remove();
      quickOpen = null;
      if (v === null) prevFocus?.focus?.();
      resolve(v);
    };
    quickOpen = { close: () => done(null) };
    const paint = () => {
      clear(list);
      shown.forEach((it, i) => {
        if (it.separator) list.append(h('div', { class: 'ide-quick-sep' }, it.separator));
        const row = h('div', { class: `ide-quick-row${i === active ? ' on' : ''}`, role: 'option', 'aria-selected': String(i === active) },
          it.iconName ? icon(it.iconName) : null,
          h('span', { class: 'ide-quick-label' }, it.label),
          it.description ? h('span', { class: 'ide-quick-desc' }, it.description) : null,
          it.key ? h('span', { class: 'ide-quick-key' }, it.key) : null);
        row.addEventListener('mousedown', (e) => { e.preventDefault(); done({ item: it, text: input.value }); });
        list.append(row);
        if (i === active) queueMicrotask(() => row.scrollIntoView({ block: 'nearest' }));
      });
      opts.onHighlight?.(shown[active] ?? null);
    };
    const refresh = async () => {
      if (opts.validate) { const bad = opts.validate(input.value); msg.textContent = bad ?? ''; msg.classList.toggle('bad', Boolean(bad)); }
      if (!opts.items) return;
      const mine = ++seq;
      const all = await opts.items(input.value);
      if (mine !== seq) return;
      shown = all.slice(0, 300);
      active = 0;
      if (!shown.length) msg.textContent = 'No matching results'; else if (!opts.validate) msg.textContent = '';
      paint();
    };
    input.addEventListener('input', () => void refresh());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); done(null); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(shown.length - 1, active + 1); paint(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); paint(); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (opts.validate && opts.validate(input.value)) return;
        if (opts.items) { if (shown[active]) done({ item: shown[active], text: input.value }); }
        else done({ text: input.value });
      }
      e.stopPropagation();
    });
    veil.addEventListener('mousedown', (e) => { if (e.target === veil) done(null); });
    document.body.append(veil);
    input.focus();
    input.select();
    void refresh();
  });
}

/** Filter + sort items by fuzzy score on label (and description). */
export function fuzzyFilter<T>(items: QuickItem<T>[], query: string): QuickItem<T>[] {
  if (!query.trim()) return items;
  return items.map((it) => ({ it, s: Math.max(fuzzy(query, it.label), fuzzy(query, `${it.label} ${it.description ?? ''}`) - 1) }))
    .filter((x) => x.s >= 0).sort((a, b) => b.s - a.s).map((x) => ({ ...x.it, separator: undefined }));
}

export async function pick<T>(items: QuickItem<T>[], placeholder: string, onHighlight?: (v: T | null) => void): Promise<T | null> {
  const r = await quickInput<T>({ placeholder, items: (q) => fuzzyFilter(items, q), onHighlight: onHighlight ? (i) => onHighlight(i ? i.value : null) : undefined });
  return r?.item ? r.item.value : null;
}
export async function ask(placeholder: string, value = '', validate?: (t: string) => string | null | undefined, password = false): Promise<string | null> {
  const r = await quickInput({ placeholder, value, validate: validate ?? (() => null), password });
  return r ? r.text : null;
}

/* ------------------------------------------------------------------ confirm */
export function confirmBox(message: string, detail = '', buttons: string[] = ['OK'], danger = false): Promise<string | null> {
  return new Promise((resolve) => {
    const done = (v: string | null) => { veil.remove(); resolve(v); };
    const btns = buttons.map((b, i) => h('button', { class: `ide-btn${i === 0 ? (danger ? ' danger' : ' primary') : ''}`, type: 'button', onclick: () => done(b) }, b));
    const box = h('div', { class: 'ide-dialog', role: 'alertdialog', 'aria-modal': 'true' },
      h('p', { class: 'ide-dialog-msg' }, message), detail ? h('p', { class: 'ide-dialog-detail' }, detail) : null,
      h('div', { class: 'ide-dialog-btns' }, btns, h('button', { class: 'ide-btn', type: 'button', onclick: () => done(null) }, 'Cancel')));
    const veil = h('div', { class: 'ide-veil' }, box);
    veil.addEventListener('keydown', (e) => { if (e.key === 'Escape') done(null); e.stopPropagation(); });
    document.body.append(veil);
    btns[0].focus();
  });
}
