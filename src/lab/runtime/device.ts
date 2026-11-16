/**
 * The phone's storage in a lab preview. AsyncStorage, MMKV, SecureStore, SQLite, the expo-sqlite localStorage and the
 * practice Supabase project keep their data in here for as long as this preview lives. "Restart app" (a re-run) keeps
 * it, like closing and opening a real app; the student's React state is gone after a restart, this is not.
 * Every change is reported (debounced) so the lab page's Device storage panel can show what was saved, where.
 */

/** One saved value as the panel shows it. */
export type DeviceRow = { key: string; value: string; type?: string; note?: string };
export type DeviceTable = { name: string; columns: string[]; rows: unknown[][]; total: number };
export type DeviceFile = { path: string; size: number; type: string; public: boolean };
/** One storage place: AsyncStorage, an MMKV instance, SecureStore, a SQLite database, the cloud… */
export type DeviceSection = {
  id: string;
  title: string;
  /** where the data really lives, in plain words */
  where: string;
  /** 'phone' (on the device) or 'cloud' (a server) */
  place: 'phone' | 'cloud';
  /** encrypted at rest on the phone */
  encrypted?: boolean;
  rows?: DeviceRow[];
  tables?: DeviceTable[];
  files?: DeviceFile[];
  lines?: string[];
};
export type DeviceSnapshot = { online: boolean; sections: DeviceSection[] };

type Provider = { id: string; snapshot: () => DeviceSection[]; reset: () => void };
const providers = new Map<string, Provider>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

/** Called by each storage shim once (at load): how to show its data, and how to wipe it. */
export function registerStore(p: Provider) {
  providers.set(p.id, p);
}

/** A storage shim changed something: tell the panel (once per burst of changes). */
export function changed() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    for (const fn of listeners) fn();
  }, 60);
}

export function onDeviceChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ------------------------------------------------------------------ network */

/** The Wi-Fi switch of the preview phone (NetInfo, fetch and the practice Supabase all follow it). */
const net = { online: true };
const netListeners = new Set<(online: boolean) => void>();
export const isOnline = () => net.online;
export function setOnline(online: boolean) {
  if (net.online === online) return;
  net.online = online;
  for (const fn of netListeners) fn(online);
  changed();
}
export function onNetworkChange(fn: (online: boolean) => void): () => void {
  netListeners.add(fn);
  return () => netListeners.delete(fn);
}

/* ------------------------------------------------------------- app starts */

/** What lived only in the app's memory (open Realtime channels…) ends when the app starts again. Saved data stays. */
const startListeners = new Set<() => void>();
export function appStarted() {
  for (const fn of startListeners) fn();
}
export function onAppStart(fn: () => void): () => void {
  startListeners.add(fn);
  return () => startListeners.delete(fn);
}

/** The error a phone gets when a request cannot leave it (React Native's own message). */
export const networkError = () => new TypeError('Network request failed');

export function snapshot(): DeviceSnapshot {
  const sections: DeviceSection[] = [];
  for (const p of providers.values()) {
    try {
      sections.push(...p.snapshot());
    } catch (error) {
      sections.push({ id: p.id, title: p.id, where: 'could not read', place: 'phone', lines: [String((error as Error)?.message ?? error)] });
    }
  }
  return { online: net.online, sections };
}

/** "Erase this phone": every store goes back to empty (the practice cloud keeps its starting rows). */
export function resetDevice() {
  for (const p of providers.values()) p.reset();
  net.online = true;
  for (const fn of netListeners) fn(true);
  changed();
}

/** How a stored value looks to the panel: short, one line. */
export function preview(value: unknown, max = 160): string {
  const text = typeof value === 'string' ? value : value instanceof Uint8Array ? `<${value.byteLength} bytes>` : JSON.stringify(value);
  const one = String(text ?? '').replace(/\s+/g, ' ');
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
}

/**
 * What an encrypted value looks like on disk: unreadable bytes. Deterministic (same value → same look), so the panel
 * does not flicker, and never contains the value itself.
 */
export function cipherLook(value: string): string {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  let out = '';
  let x = h >>> 0;
  const n = Math.min(48, Math.max(16, value.length));
  for (let i = 0; i < n; i++) {
    x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0;
    out += (x & 0xff).toString(16).padStart(2, '0');
  }
  return out.slice(0, n);
}
