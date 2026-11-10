/** Tiny DOM helpers for the IDE (no framework: Monaco and xterm are imperative anyway). */
type Child = Node | string | number | null | undefined | false | Child[];
type Props = Record<string, unknown> | null;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset' && typeof v === 'object') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k in el && k !== 'list') (el as any)[k] = v;
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}
export function append(el: Node, children: Child[]) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
}
/** A codicon (the icon font ships with Monaco). */
export const icon = (name: string, extra = '') => h('span', { class: `codicon codicon-${name} ${extra}`, 'aria-hidden': 'true' });
export const clear = <T extends Element>(el: T) => { el.replaceChildren(); return el; };

export class Emitter<T = void> {
  private fns = new Set<(v: T) => void>();
  on = (fn: (v: T) => void) => { this.fns.add(fn); return () => { this.fns.delete(fn); }; };
  emit(v: T) { for (const fn of [...this.fns]) { try { fn(v); } catch (e) { console.error(e); } } }
}

export const debounce = <A extends unknown[]>(fn: (...a: A) => void, ms: number) => {
  let t = 0;
  return (...a: A) => { clearTimeout(t); t = window.setTimeout(() => fn(...a), ms); };
};
export const basename = (p: string) => p.slice(p.lastIndexOf('/') + 1);
export const dirname = (p: string) => p.slice(0, p.lastIndexOf('/')) || '/';
export const join = (...parts: string[]) => {
  const out: string[] = [];
  for (const seg of parts.join('/').split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') out.pop(); else out.push(seg);
  }
  return '/' + out.join('/');
};
export const extname = (p: string) => { const b = basename(p); const i = b.lastIndexOf('.'); return i > 0 ? b.slice(i + 1).toLowerCase() : ''; };
export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
