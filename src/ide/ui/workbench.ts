/** The workbench shell: title/menu bar, activity bar, side bar, editor area, bottom panel, status bar, sashes. */
import { Emitter, clear, h, icon } from '../core/dom';
import { getCommand, keyOf, prettyKey, run } from '../core/commands';
import { memo, settings } from '../core/settings';
import type { Editors } from './editors';
import { closeMenus, showMenu, type MenuItem } from './widgets';

export type SideView = { id: string; title: string; iconName: string; el: HTMLElement; actions?: () => HTMLElement[]; onShow?: () => void; order?: number };
export type PanelView = { id: string; title: string; el: HTMLElement; actions?: () => HTMLElement[]; onShow?: () => void };
export type StatusItem = { id: string; side: 'left' | 'right'; order: number; el: HTMLButtonElement };
/** A menu entry: a command id, a separator, or a submenu / custom item. */
export type MenuDef = string | 'sep' | { label: string; submenu?: MenuDef[]; run?: () => unknown; checked?: () => boolean };

export const iconButton = (name: string, title: string, onclick: (e: MouseEvent) => unknown) => h('button', { class: 'ide-icon-btn', type: 'button', title, 'aria-label': title, onclick }, icon(name));

export class Workbench {
  readonly root: HTMLElement;
  private activity = h('div', { class: 'ide-activity', role: 'tablist', 'aria-orientation': 'vertical' });
  private activityBottom = h('div', { class: 'ide-activity-bottom' });
  private sideTitle = h('span', { class: 'ide-side-title' });
  private sideActions = h('div', { class: 'ide-side-actions' });
  private sideBody = h('div', { class: 'ide-side-body' });
  private side = h('aside', { class: 'ide-side' }, h('header', { class: 'ide-side-head' }, this.sideTitle, this.sideActions), this.sideBody);
  private panelTabs = h('div', { class: 'ide-panel-tabs', role: 'tablist' });
  private panelActions = h('div', { class: 'ide-panel-actions' });
  private panelBody = h('div', { class: 'ide-panel-body' });
  private panel = h('section', { class: 'ide-panel' }, h('header', { class: 'ide-panel-head' }, this.panelTabs, this.panelActions), this.panelBody);
  private statusL = h('div', { class: 'ide-status-side' });
  private statusR = h('div', { class: 'ide-status-side right' });
  private menubar = h('nav', { class: 'ide-menubar', role: 'menubar' });
  readonly titleCenter = h('button', { class: 'ide-title-center', type: 'button', title: 'Search files and commands (Ctrl+P)' });
  readonly titleRight = h('div', { class: 'ide-title-right' });
  private main = h('div', { class: 'ide-main' });
  private sideViews: SideView[] = [];
  private panelViews: PanelView[] = [];
  private statusItems: StatusItem[] = [];
  private badges = new Map<string, string>();
  activeSide = memo.get('side.view', 'explorer');
  activePanel = memo.get('panel.view', 'terminal');
  sideVisible = memo.get('side.visible', true);
  panelVisible = memo.get('panel.visible', false);
  panelMax = false;
  readonly layoutChanged = new Emitter();

  constructor(mount: HTMLElement, readonly editors: Editors) {
    const sideSash = h('div', { class: 'ide-sash v' });
    const panelSash = h('div', { class: 'ide-sash h' });
    this.main.append(editors.el, panelSash, this.panel);
    const body = h('div', { class: 'ide-body' }, h('div', { class: 'ide-activity-wrap' }, this.activity, this.activityBottom), this.side, sideSash, this.main);
    const title = h('header', { class: 'ide-title' },
      h('a', { class: 'ide-logo', href: '/', title: 'Back to BUENOVA', 'aria-label': 'Back to BUENOVA' }, h('span', { class: 'ide-logo-mark' }, 'B')),
      this.menubar, this.titleCenter, this.titleRight);
    this.root = h('div', { class: 'ide-root' }, title, body, h('footer', { class: 'ide-status', role: 'status' }, this.statusL, this.statusR));
    mount.append(this.root);

    this.side.style.width = `${memo.get('side.width', 260)}px`;
    this.panel.style.height = `${memo.get('panel.height', 260)}px`;
    this.drag(sideSash, (dx) => {
      const right = settings.get('workbench.sideBar.location') === 'right';
      const w = Math.max(170, Math.min(innerWidth * 0.6, this.dragStart + (right ? -dx : dx)));
      this.side.style.width = `${w}px`;
      memo.set('side.width', w);
    }, () => this.side.getBoundingClientRect().width);
    this.drag(panelSash, (_dx, dy) => {
      const hgt = Math.max(90, Math.min(this.main.getBoundingClientRect().height - 80, this.dragStart - dy));
      this.panel.style.height = `${hgt}px`;
      memo.set('panel.height', hgt);
    }, () => this.panel.getBoundingClientRect().height);
    new ResizeObserver(() => this.relayout()).observe(this.main);
    settings.changed.on((k) => { if (k === 'workbench.sideBar.location') this.apply(); });
    this.apply();
  }

  private dragStart = 0;
  private drag(sash: HTMLElement, move: (dx: number, dy: number) => void, start: () => number) {
    sash.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.dragStart = start();
      const x = e.clientX, y = e.clientY;
      const onMove = (ev: PointerEvent) => { move(ev.clientX - x, ev.clientY - y); this.relayout(); };
      const up = () => { removeEventListener('pointermove', onMove); removeEventListener('pointerup', up); document.body.classList.remove('ide-dragging'); };
      addEventListener('pointermove', onMove); addEventListener('pointerup', up);
      document.body.classList.add('ide-dragging');
    });
    sash.addEventListener('dblclick', () => { if (sash.classList.contains('h')) this.togglePanelMax(); });
  }
  relayout() { this.editors.layout(); this.layoutChanged.emit(); }

  private apply() {
    this.root.classList.toggle('side-right', settings.get('workbench.sideBar.location') === 'right');
    this.root.classList.toggle('no-side', !this.sideVisible);
    this.root.classList.toggle('no-panel', !this.panelVisible);
    this.root.classList.toggle('panel-max', this.panelMax && this.panelVisible);
    memo.set('side.visible', this.sideVisible); memo.set('panel.visible', this.panelVisible);
    this.paintActivity();
    requestAnimationFrame(() => this.relayout());
  }

  /* ------------------------------------------------------------ side bar */
  addSideView(v: SideView) {
    this.sideViews.push(v);
    this.sideViews.sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
    v.el.hidden = true;
    this.sideBody.append(v.el);
    if (v.id === this.activeSide && this.sideVisible) this.showSide(v.id, false);
    else this.paintActivity();
  }
  removeSideView(id: string) {
    const v = this.sideViews.find((x) => x.id === id);
    if (!v) return;
    v.el.remove();
    this.sideViews = this.sideViews.filter((x) => x !== v);
    if (this.activeSide === id) this.showSide('explorer', false); else this.paintActivity();
  }
  setBadge(id: string, text: string) { if (text) this.badges.set(id, text); else this.badges.delete(id); this.paintActivity(); }
  showSide(id: string, toggle = true) {
    if (toggle && this.sideVisible && this.activeSide === id) { this.sideVisible = false; this.apply(); return; }
    const v = this.sideViews.find((x) => x.id === id);
    if (!v) return;
    this.activeSide = id;
    this.sideVisible = true;
    memo.set('side.view', id);
    for (const x of this.sideViews) x.el.hidden = x !== v;
    this.sideTitle.textContent = v.title.toUpperCase();
    this.refreshSideActions();
    this.apply();
    v.onShow?.();
  }
  refreshSideActions() {
    const v = this.sideViews.find((x) => x.id === this.activeSide);
    clear(this.sideActions).append(...(v?.actions?.() ?? []));
  }
  toggleSide() { this.sideVisible = !this.sideVisible; if (this.sideVisible) this.showSide(this.activeSide, false); else this.apply(); }
  addActivityButton(el: HTMLElement) { this.activityBottom.append(el); }
  private paintActivity() {
    clear(this.activity);
    for (const v of this.sideViews) {
      const on = this.sideVisible && this.activeSide === v.id;
      const badge = this.badges.get(v.id);
      this.activity.append(h('button', { class: `ide-activity-btn${on ? ' on' : ''}`, type: 'button', role: 'tab', title: v.title, 'aria-label': v.title, 'aria-selected': String(on), onclick: () => this.showSide(v.id) },
        icon(v.iconName), badge ? h('span', { class: 'ide-badge' }, badge) : null));
    }
  }

  /* ------------------------------------------------------------ bottom panel */
  addPanelView(v: PanelView) {
    this.panelViews.push(v);
    v.el.hidden = true;
    this.panelBody.append(v.el);
    if (v.id === this.activePanel) this.showPanel(v.id, this.panelVisible);
    this.paintPanelTabs();
  }
  showPanel(id: string, reveal = true) {
    const v = this.panelViews.find((x) => x.id === id);
    if (!v) return;
    this.activePanel = id;
    memo.set('panel.view', id);
    for (const x of this.panelViews) x.el.hidden = x !== v;
    if (reveal) this.panelVisible = true;
    this.paintPanelTabs();
    this.apply();
    if (this.panelVisible) requestAnimationFrame(() => v.onShow?.());
  }
  togglePanel(id?: string) {
    if (id && (!this.panelVisible || this.activePanel !== id)) return this.showPanel(id);
    this.panelVisible = !this.panelVisible;
    if (this.panelVisible) this.showPanel(this.activePanel); else this.apply();
  }
  togglePanelMax() { this.panelMax = !this.panelMax; this.apply(); requestAnimationFrame(() => this.panelViews.find((x) => x.id === this.activePanel)?.onShow?.()); }
  refreshPanelActions() { this.paintPanelTabs(); }
  private panelBadges = new Map<string, string>();
  setPanelBadge(id: string, text: string) { if (text) this.panelBadges.set(id, text); else this.panelBadges.delete(id); this.paintPanelTabs(); }
  private paintPanelTabs() {
    clear(this.panelTabs);
    for (const v of this.panelViews) {
      const badge = this.panelBadges.get(v.id);
      this.panelTabs.append(h('button', { class: `ide-panel-tab${v.id === this.activePanel ? ' on' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(v.id === this.activePanel), onclick: () => this.showPanel(v.id) },
        v.title.toUpperCase(), badge ? h('span', { class: 'ide-count' }, badge) : null));
    }
    const v = this.panelViews.find((x) => x.id === this.activePanel);
    clear(this.panelActions).append(...(v?.actions?.() ?? []),
      iconButton(this.panelMax ? 'chevron-down' : 'chevron-up', this.panelMax ? 'Restore Panel Size' : 'Maximize Panel Size', () => this.togglePanelMax()),
      iconButton('close', 'Hide Panel (Ctrl+J)', () => this.togglePanel()));
  }

  /* ------------------------------------------------------------ status bar */
  status(id: string, side: 'left' | 'right', order: number, opts: { text?: string; iconName?: string; title?: string; command?: string; onclick?: () => unknown } = {}) {
    let item = this.statusItems.find((s) => s.id === id);
    if (!item) {
      item = { id, side, order, el: h('button', { class: 'ide-status-item', type: 'button' }) };
      this.statusItems.push(item);
      const host = side === 'left' ? this.statusL : this.statusR;
      const sorted = this.statusItems.filter((s) => s.side === side).sort((a, b) => a.order - b.order);
      clear(host).append(...sorted.map((s) => s.el));
    }
    const el = item.el;
    clear(el);
    if (opts.iconName) el.append(icon(opts.iconName));
    if (opts.text) el.append(h('span', null, opts.text));
    el.title = opts.title ?? '';
    el.hidden = !opts.text && !opts.iconName;
    el.onclick = opts.command ? () => void run(opts.command!) : opts.onclick ? () => void opts.onclick!() : null;
    el.classList.toggle('static', !opts.command && !opts.onclick);
    return el;
  }
  removeStatus(id: string) { const s = this.statusItems.find((x) => x.id === id); if (s) { s.el.remove(); this.statusItems = this.statusItems.filter((x) => x !== s); } }

  /* ------------------------------------------------------------ menu bar */
  private toItems(defs: MenuDef[]): MenuItem[] {
    const out: MenuItem[] = [];
    for (const d of defs) {
      if (d === 'sep') { out.push('sep'); continue; }
      if (typeof d === 'string') {
        const c = getCommand(d);
        if (!c) continue;
        const key = keyOf(d);
        out.push({ label: c.title, key: key ? prettyKey(key) : '', disabled: c.enabled ? !c.enabled() : false, run: () => run(d) });
      } else out.push({ label: d.label, submenu: d.submenu ? this.toItems(d.submenu) : undefined, run: d.run, checked: d.checked?.() });
    }
    return out;
  }
  setMenus(menus: { label: string; items: () => MenuDef[] }[]) {
    clear(this.menubar);
    let open: HTMLElement | null = null;
    const show = (btn: HTMLElement, m: (typeof menus)[number]) => {
      const r = btn.getBoundingClientRect();
      open = btn;
      this.menubar.querySelectorAll('.on').forEach((x) => x.classList.remove('on'));
      btn.classList.add('on');
      showMenu(r.left, r.bottom, this.toItems(m.items()), { onClose: () => { btn.classList.remove('on'); if (open === btn) open = null; } });
    };
    for (const m of menus) {
      const btn = h('button', { class: 'ide-menubar-btn', type: 'button', role: 'menuitem', 'aria-haspopup': 'true' }, m.label);
      btn.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); if (open === btn) { closeMenus(); btn.classList.remove('on'); open = null; } else show(btn, m); });
      btn.addEventListener('mouseenter', () => { if (open && open !== btn) show(btn, m); });
      btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); show(btn, m); } });
      this.menubar.append(btn);
    }
  }
}
