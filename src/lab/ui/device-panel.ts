/**
 * Lab 06's "Device storage" panel under a workbench: what the preview phone has saved, where it lives (on the phone or
 * in the cloud, plain or encrypted), and what just changed (new or changed rows flash). Buttons: Restart app (React
 * state is lost, saved data stays), the Wi-Fi switch (NetInfo, fetch and Supabase follow it) and Erase phone.
 */
import type { DeviceSection, DeviceSnapshot } from '../runtime/protocol.ts';
import { h } from './dom.ts';

const ICON = {
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18.5h10.2a4.3 4.3 0 0 0 .5-8.6A6 6 0 0 0 6.2 9.4 4.6 4.6 0 0 0 7 18.5Z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/></svg>',
  restart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/></svg>',
  wifi: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 9a14 14 0 0 1 19 0"/><path d="M5.8 12.5a9.2 9.2 0 0 1 12.4 0"/><path d="M9.2 16a4.4 4.4 0 0 1 5.6 0"/><path d="M12 19.5h.01"/></svg>',
  erase: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/></svg>',
};

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const cell = (v: unknown) => (v === null || v === undefined ? '<i class="dp-null">NULL</i>' : esc(typeof v === 'object' ? JSON.stringify(v) : v));
const kb = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);

export type DevicePanelOptions = {
  restart: () => Promise<void> | void;
  network?: (online: boolean) => Promise<void> | void;
  erase: () => Promise<void> | void;
};

export class DevicePanel {
  root: HTMLElement;
  private body: HTMLElement;
  private wifi: HTMLButtonElement | null = null;
  private seen = new Map<string, string>();
  private first = true;
  private opts: DevicePanelOptions;

  constructor(opts: DevicePanelOptions) {
    this.opts = opts;
    const btn = (icon: string, label: string, title: string, onclick: () => void) =>
      h('button', { type: 'button', class: 'dp-btn', title, onclick, html: `${icon}<span>${label}</span>` });
    this.body = h('div', { class: 'dp-body', 'aria-live': 'polite' }, h('p', { class: 'dp-empty' }, 'Nothing is saved on this phone yet.'));
    if (opts.network) {
      this.wifi = btn(ICON.wifi, 'Wi-Fi on', 'Switch the phone’s Wi-Fi off and on (NetInfo, fetch and Supabase follow it)', () => {
        const next = this.wifi!.getAttribute('aria-pressed') !== 'true';
        this.setWifi(next);
        void opts.network!(next);
      });
      this.wifi.setAttribute('aria-pressed', 'true');
      this.wifi.classList.add('dp-wifi');
    }
    this.root = h(
      'section',
      { class: 'dp', 'aria-label': 'Device storage' },
      h(
        'div',
        { class: 'dp-bar' },
        h('b', { class: 'dp-title' }, 'Device storage'),
        h('span', { class: 'dp-sub' }, 'what this phone saved, and where'),
        h('span', { class: 'dp-spacer' }),
        btn(ICON.restart, 'Restart app', 'Close the app and open it again: React state is lost, saved data stays', () => void opts.restart()),
        this.wifi,
        btn(ICON.erase, 'Erase phone', 'Delete everything this phone saved (the practice cloud goes back to its first rows)', () => void opts.erase()),
      ),
      this.body,
      h('p', { class: 'dp-foot' }, 'Saved data stays when you restart the app or change the code. It is erased when you reload the page.'),
    );
  }

  private setWifi(online: boolean) {
    if (!this.wifi) return;
    this.wifi.setAttribute('aria-pressed', String(online));
    this.wifi.querySelector('span')!.textContent = online ? 'Wi-Fi on' : 'Wi-Fi off';
    this.wifi.classList.toggle('is-off', !online);
  }

  /** Marks what is new or changed since the last snapshot (not on the first one). */
  private fresh(key: string, value: string) {
    const old = this.seen.get(key);
    this.seen.set(key, value);
    return !this.first && old !== value;
  }

  render(snap: DeviceSnapshot) {
    this.setWifi(snap.online);
    const sections = snap.sections;
    this.body.replaceChildren(...(sections.length ? sections.map((s) => this.section(s)) : [h('p', { class: 'dp-empty' }, 'Nothing is saved on this phone yet.')]));
    this.first = false;
  }

  private section(s: DeviceSection): HTMLElement {
    const head = `<header class="dp-sh"><span class="dp-ic">${s.place === 'cloud' ? ICON.cloud : ICON.phone}</span><b>${esc(s.title)}</b><span class="dp-place">${s.place === 'cloud' ? 'In the cloud' : 'On the phone'}</span>${s.encrypted ? `<span class="dp-lock">${ICON.lock}Encrypted</span>` : ''}</header><p class="dp-where">${esc(s.where)}</p>`;
    let html = head;
    if (s.rows?.length) {
      html += `<table class="dp-kv"><thead><tr><th>key</th><th>value${s.encrypted ? ' (as stored on disk)' : ''}</th><th>type</th></tr></thead><tbody>${s.rows
        .map((r) => `<tr class="${this.fresh(`${s.id}|${r.key}`, r.value) ? 'is-new' : ''}"><td class="mono">${esc(r.key)}</td><td class="mono dp-v">${esc(r.value)}${r.note ? `<small>${esc(r.note)}</small>` : ''}</td><td class="dp-t">${esc(r.type ?? '')}</td></tr>`)
        .join('')}</tbody></table>`;
    }
    for (const t of s.tables ?? []) {
      html += `<div class="dp-table"><p class="dp-tn"><b class="mono">${esc(t.name)}</b><span>${t.total} row${t.total === 1 ? '' : 's'}</span></p><div class="dp-scroll"><table><thead><tr>${t.columns.map((c) => `<th class="mono">${esc(c)}</th>`).join('')}</tr></thead><tbody>${
        t.rows.length
          ? t.rows.map((row) => {
              const key = `${s.id}|${t.name}|${JSON.stringify(row)}`;
              return `<tr class="${this.fresh(key, '1') ? 'is-new' : ''}">${row.map((v) => `<td class="mono">${cell(v)}</td>`).join('')}</tr>`;
            }).join('')
          : `<tr><td class="dp-none" colspan="${Math.max(1, t.columns.length)}">no rows</td></tr>`
      }</tbody></table></div></div>`;
    }
    if (s.files?.length) {
      html += `<ul class="dp-files">${s.files.map((f) => `<li class="${this.fresh(`${s.id}|${f.path}`, String(f.size)) ? 'is-new' : ''}"><span class="mono">${esc(f.path)}</span><span>${kb(f.size)} · ${esc(f.type)} · ${f.public ? 'public' : 'private'}</span></li>`).join('')}</ul>`;
    }
    if (s.lines?.length) {
      html += `<ol class="dp-log">${s.lines.map((l, i) => `<li class="mono ${i === 1 && this.fresh(`${s.id}|log`, l) ? 'is-new' : ''}">${esc(l)}</li>`).join('')}</ol>`;
    }
    return h('article', { class: 'dp-sec', 'data-place': s.place, html });
  }
}

/** Code that uses phone storage gets the panel (other labs' workbenches stay as they were). */
export const STORAGE_IMPORT = /['"](@react-native-async-storage\/async-storage|react-native-mmkv|expo-secure-store|expo-sqlite(\/[\w/]+)?|@supabase\/supabase-js|@react-native-community\/netinfo)['"]/;
export const NETWORK_IMPORT = /['"](@supabase\/supabase-js|@react-native-community\/netinfo)['"]/;
