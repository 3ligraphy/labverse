/**
 * Phone storage for the lab previews (Lab 06), with the same API as the real packages, so code copied from the
 * official docs runs here unchanged:
 *   @react-native-async-storage/async-storage (v2) · react-native-mmkv (v4: createMMKV) · expo-secure-store ·
 *   @react-native-community/netinfo · expo-sqlite/kv-store + expo-sqlite/localStorage/install ·
 *   expo-image-picker · expo-crypto · base64-arraybuffer · react-native-url-polyfill · react-native-get-random-values
 * Data lives in this preview (device.ts): "Restart app" keeps it; it is shown in the Device storage panel.
 */
import { createElement, useEffect, useState } from 'react';
import { changed, cipherLook, isOnline, onNetworkChange, preview, registerStore, type DeviceRow } from './device.ts';

const later = <T,>(value: T, ms = 0) => new Promise<T>((r) => setTimeout(() => r(value), ms));

/* ------------------------------------------------------------ AsyncStorage */

const asyncMap = new Map<string, string>();
registerStore({
  id: 'async-storage',
  snapshot: () => (asyncMap.size ? [{ id: 'async-storage', title: 'AsyncStorage', where: 'A plain file on the phone. Not encrypted: anyone who can open the file can read it.', place: 'phone' as const, rows: [...asyncMap].map(([key, value]) => ({ key, value: preview(value), type: 'string' })) }] : []),
  reset: () => asyncMap.clear(),
});

function storeString(key: unknown, value: unknown): [string, string] {
  if (typeof key !== 'string') console.warn(`[AsyncStorage] Using ${typeof key} type for key is not supported. This can lead to unexpected behavior/errors. Use string instead.\nKey passed: ${String(key)}`);
  if (typeof value !== 'string') console.warn(`[AsyncStorage] The value for key "${String(key)}" is not a string. This can lead to unexpected behavior/errors. Consider stringifying it.\nPassed value: ${String(value)}`);
  return [String(key), String(value)];
}
const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
function deepMerge(a: unknown, b: unknown): unknown {
  if (!isPlainObject(a) || !isPlainObject(b)) return b;
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = k in a ? deepMerge(a[k], v) : v;
  return out;
}

export const AsyncStorage = {
  getItem: async (key: string) => later(asyncMap.get(String(key)) ?? null),
  setItem: async (key: string, value: string) => {
    const [k, v] = storeString(key, value);
    asyncMap.set(k, v);
    changed();
    await later(undefined);
  },
  removeItem: async (key: string) => {
    asyncMap.delete(String(key));
    changed();
    await later(undefined);
  },
  mergeItem: async (key: string, value: string) => {
    const old = asyncMap.get(String(key));
    const merged = old ? deepMerge(JSON.parse(old), JSON.parse(value)) : JSON.parse(value);
    asyncMap.set(String(key), JSON.stringify(merged));
    changed();
    await later(undefined);
  },
  clear: async () => {
    asyncMap.clear();
    changed();
    await later(undefined);
  },
  getAllKeys: async () => later([...asyncMap.keys()]),
  multiGet: async (keys: string[]) => later(keys.map((k) => [k, asyncMap.get(k) ?? null] as [string, string | null])),
  multiSet: async (pairs: [string, string][]) => {
    for (const [k, v] of pairs) asyncMap.set(...storeString(k, v));
    changed();
    await later(undefined);
  },
  multiRemove: async (keys: string[]) => {
    for (const k of keys) asyncMap.delete(k);
    changed();
    await later(undefined);
  },
  multiMerge: async (pairs: [string, string][]) => {
    for (const [k, v] of pairs) await AsyncStorage.mergeItem(k, v);
  },
};

/* ------------------------------------------------------------------- MMKV */

type MMKVValue = string | number | boolean | ArrayBuffer;
type MMKVBox = { values: Map<string, MMKVValue>; encrypted: boolean; listeners: Set<(key: string) => void> };
const mmkvBoxes = new Map<string, MMKVBox>();
const DEFAULT_MMKV = 'mmkv.default';
const typeOf = (v: MMKVValue) => (v instanceof ArrayBuffer ? 'buffer' : typeof v);
registerStore({
  id: 'mmkv',
  snapshot: () =>
    [...mmkvBoxes]
      .filter(([, b]) => b.values.size)
      .map(([id, b]) => ({
        id: `mmkv:${id}`,
        title: `MMKV · ${id}`,
        where: b.encrypted ? 'A file on the phone, encrypted with your encryptionKey.' : 'A file on the phone, read and written at once (synchronous). Plain text unless you give it an encryptionKey.',
        place: 'phone' as const,
        encrypted: b.encrypted,
        rows: [...b.values].map(([key, v]): DeviceRow => ({ key, value: b.encrypted ? cipherLook(String(v)) : v instanceof ArrayBuffer ? `<${v.byteLength} bytes>` : preview(v), type: typeOf(v) })),
      })),
  reset: () => mmkvBoxes.clear(),
});

function box(id: string, encrypted = false): MMKVBox {
  let b = mmkvBoxes.get(id);
  if (!b) mmkvBoxes.set(id, (b = { values: new Map(), encrypted, listeners: new Set() }));
  if (encrypted) b.encrypted = true;
  return b;
}

export type MMKVConfig = { id?: string; path?: string; encryptionKey?: string; encryptionType?: string; mode?: string; readOnly?: boolean };

function makeMMKV(config: MMKVConfig = {}) {
  if ((config.path || config.encryptionKey) && !config.id) throw new Error('MMKV: an `id` is required when you pass `path` or `encryptionKey`.');
  const id = config.id ?? DEFAULT_MMKV;
  const b = box(id, Boolean(config.encryptionKey));
  const emit = (key: string) => {
    changed();
    for (const fn of b.listeners) fn(key);
  };
  const get = <T extends MMKVValue>(key: string, type: string): T | undefined => {
    const v = b.values.get(key);
    return v !== undefined && typeOf(v) === type ? (v as T) : undefined;
  };
  return {
    id,
    set(key: string, value: MMKVValue) {
      if (config.readOnly) throw new Error(`MMKV "${id}" is read-only.`);
      if (value === undefined || value === null) throw new TypeError(`MMKV: set("${key}", ${value}) is not allowed. Call remove("${key}") to delete a key.`);
      if (typeof value === 'object' && !(value instanceof ArrayBuffer)) {
        throw new TypeError(`MMKV: set("${key}", …) got an object. MMKV stores strings, numbers, booleans and ArrayBuffers: use JSON.stringify(value).`);
      }
      b.values.set(key, value);
      emit(key);
    },
    getString: (key: string) => get<string>(key, 'string'),
    getNumber: (key: string) => get<number>(key, 'number'),
    getBoolean: (key: string) => get<boolean>(key, 'boolean'),
    getBuffer: (key: string) => get<ArrayBuffer>(key, 'buffer'),
    contains: (key: string) => b.values.has(key),
    remove(key: string) {
      const had = b.values.delete(key);
      if (had) emit(key);
      return had;
    },
    getAllKeys: () => [...b.values.keys()],
    clearAll() {
      const keys = [...b.values.keys()];
      b.values.clear();
      keys.forEach(emit);
    },
    encrypt(_key: string) {
      b.encrypted = true;
      changed();
    },
    decrypt() {
      b.encrypted = false;
      changed();
    },
    get byteSize() {
      let n = 0;
      for (const [k, v] of b.values) n += k.length + (v instanceof ArrayBuffer ? v.byteLength : String(v).length);
      return n;
    },
    get size() {
      return b.values.size;
    },
    trim() {},
    addOnValueChangedListener(fn: (key: string) => void) {
      b.listeners.add(fn);
      return { remove: () => b.listeners.delete(fn) };
    },
  };
}
type MMKVInstance = ReturnType<typeof makeMMKV>;
let defaultMMKV: MMKVInstance | null = null;
const instanceOf = (i?: MMKVInstance) => i ?? (defaultMMKV ??= makeMMKV());

function useMMKVValue<T>(key: string, read: (i: MMKVInstance) => T | undefined, instance?: MMKVInstance): [T | undefined, (v: T | undefined | ((old: T | undefined) => T | undefined)) => void] {
  const i = instanceOf(instance);
  const [value, setValue] = useState<T | undefined>(() => read(i));
  useEffect(() => {
    setValue(read(i));
    const sub = i.addOnValueChangedListener((k) => k === key && setValue(read(i)));
    return () => void sub.remove();
  }, [key, i]);
  const set = (next: T | undefined | ((old: T | undefined) => T | undefined)) => {
    const v = typeof next === 'function' ? (next as (old: T | undefined) => T | undefined)(read(i)) : next;
    if (v === undefined) i.remove(key);
    else i.set(key, v as unknown as MMKVValue);
  };
  return [value, set];
}

export const MMKVModule = {
  createMMKV: (config?: MMKVConfig) => makeMMKV(config),
  existsMMKV: (id: string) => mmkvBoxes.has(id),
  deleteMMKV: (id: string) => {
    const had = mmkvBoxes.delete(id);
    changed();
    return had;
  },
  useMMKV: (config?: MMKVConfig) => (config ? makeMMKV(config) : instanceOf()),
  useMMKVString: (key: string, instance?: MMKVInstance) => useMMKVValue<string>(key, (i) => i.getString(key), instance),
  useMMKVNumber: (key: string, instance?: MMKVInstance) => useMMKVValue<number>(key, (i) => i.getNumber(key), instance),
  useMMKVBoolean: (key: string, instance?: MMKVInstance) => useMMKVValue<boolean>(key, (i) => i.getBoolean(key), instance),
  useMMKVBuffer: (key: string, instance?: MMKVInstance) => useMMKVValue<ArrayBuffer>(key, (i) => i.getBuffer(key), instance),
  useMMKVObject: <T,>(key: string, instance?: MMKVInstance) => {
    const [text, setText] = useMMKVValue<string>(key, (i) => i.getString(key), instance);
    const value = text === undefined ? undefined : (JSON.parse(text) as T);
    return [value, (v: T | undefined) => setText(v === undefined ? undefined : JSON.stringify(v))] as const;
  },
  useMMKVListener: (fn: (key: string) => void, instance?: MMKVInstance) => {
    const i = instanceOf(instance);
    useEffect(() => {
      const sub = i.addOnValueChangedListener(fn);
      return () => void sub.remove();
    }, [i]);
  },
  useMMKVKeys: (instance?: MMKVInstance) => {
    const i = instanceOf(instance);
    const [keys, setKeys] = useState(() => i.getAllKeys());
    useEffect(() => {
      const sub = i.addOnValueChangedListener(() => setKeys(i.getAllKeys()));
      return () => void sub.remove();
    }, [i]);
    return keys;
  },
};

/* ------------------------------------------------------------ SecureStore */

const secureMap = new Map<string, string>();
registerStore({
  id: 'secure-store',
  snapshot: () =>
    secureMap.size
      ? [{
          id: 'secure-store',
          title: 'SecureStore',
          where: 'iOS Keychain / Android Keystore. Encrypted on the phone: the file shows unreadable bytes, only your app can read the value.',
          place: 'phone' as const,
          encrypted: true,
          rows: [...secureMap].map(([k, v]) => {
            const [service, key] = k.includes('\u0000') ? k.split('\u0000') : ['', k];
            return { key: service ? `${service} › ${key}` : key, value: cipherLook(v), type: 'encrypted', note: `${v.length} characters, encrypted` };
          }),
        }]
      : [],
  reset: () => secureMap.clear(),
});

type SecureOptions = { keychainService?: string; keychainAccessible?: number; requireAuthentication?: boolean; authenticationPrompt?: string };
const secureKey = (key: string, o?: SecureOptions) => (o?.keychainService ? `${o.keychainService}\u0000${key}` : key);
function validKey(key: unknown) {
  if (typeof key !== 'string' || !/^[\w.-]+$/.test(key)) {
    throw new Error('Invalid key provided to SecureStore. Keys must not be empty and contain only alphanumeric characters, ".", "-", and "_".');
  }
}
function validValue(value: unknown) {
  if (typeof value !== 'string') throw new Error('Invalid value provided to SecureStore. Values must be strings; consider JSON-encoding your values if they are serializable.');
  if (value.length > 2048) console.warn(`[SecureStore] This value is ${value.length} characters long. Some iOS versions refused values above about 2048 bytes: keep secrets small (store a key here and the big data, encrypted, elsewhere).`);
}

export const SecureStore = {
  setItemAsync: async (key: string, value: string, options?: SecureOptions) => {
    validKey(key);
    validValue(value);
    secureMap.set(secureKey(key, options), value);
    changed();
    await later(undefined, 5);
  },
  getItemAsync: async (key: string, options?: SecureOptions) => {
    validKey(key);
    return later(secureMap.get(secureKey(key, options)) ?? null, 5);
  },
  deleteItemAsync: async (key: string, options?: SecureOptions) => {
    validKey(key);
    secureMap.delete(secureKey(key, options));
    changed();
    await later(undefined, 5);
  },
  setItem: (key: string, value: string, options?: SecureOptions) => {
    validKey(key);
    validValue(value);
    secureMap.set(secureKey(key, options), value);
    changed();
  },
  getItem: (key: string, options?: SecureOptions) => {
    validKey(key);
    return secureMap.get(secureKey(key, options)) ?? null;
  },
  isAvailableAsync: async () => true,
  canUseBiometricAuthentication: () => false,
  AFTER_FIRST_UNLOCK: 0,
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
  ALWAYS: 2,
  WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 3,
  ALWAYS_THIS_DEVICE_ONLY: 4,
  WHEN_UNLOCKED: 5,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
};

/* ---------------------------------------------------------------- NetInfo */

export type NetInfoState = {
  type: 'wifi' | 'none' | 'unknown';
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  isWifiEnabled?: boolean;
  details: Record<string, unknown> | null;
};
const netState = (): NetInfoState =>
  isOnline()
    ? { type: 'wifi', isConnected: true, isInternetReachable: true, isWifiEnabled: true, details: { isConnectionExpensive: false, ssid: null, bssid: null, strength: 99, ipAddress: '192.168.1.24', subnet: '255.255.255.0' } }
    : { type: 'none', isConnected: false, isInternetReachable: false, isWifiEnabled: false, details: null };

function addEventListener(listener: (s: NetInfoState) => void) {
  let live = true;
  setTimeout(() => live && listener(netState()), 0); // called soon after subscribing, then on every change
  const off = onNetworkChange(() => live && listener(netState()));
  return () => {
    live = false;
    off();
  };
}
function useNetInfo(): NetInfoState {
  const [state, setState] = useState<NetInfoState>(netState);
  useEffect(() => addEventListener(setState), []);
  return state;
}
const NetInfo = {
  fetch: async (_iface?: string) => later(netState(), 5),
  refresh: async () => later(netState(), 5),
  addEventListener,
  useNetInfo,
  configure: () => {},
};
export const NetInfoModule = {
  default: NetInfo,
  ...NetInfo,
  useNetInfoInstance: () => ({ netInfo: useNetInfo(), refresh: NetInfo.refresh }),
  NetInfoStateType: { unknown: 'unknown', none: 'none', cellular: 'cellular', wifi: 'wifi', bluetooth: 'bluetooth', ethernet: 'ethernet', wimax: 'wimax', vpn: 'vpn', other: 'other' },
};

/* ------------------------------------------ expo-sqlite kv-store / localStorage */

const kvMap = new Map<string, string>();
registerStore({
  id: 'sqlite-kv',
  snapshot: () => (kvMap.size ? [{ id: 'sqlite-kv', title: 'expo-sqlite localStorage', where: 'A small table inside a SQLite file on the phone. Not encrypted.', place: 'phone' as const, rows: [...kvMap].map(([key, value]) => ({ key, value: preview(value), type: 'string' })) }] : []),
  reset: () => kvMap.clear(),
});
const kvSet = (k: string, v: string) => {
  kvMap.set(String(k), String(v));
  changed();
};
const kvDel = (k: string) => {
  kvMap.delete(String(k));
  changed();
};
export const KvStore = {
  getItem: async (k: string) => later(kvMap.get(k) ?? null),
  setItem: async (k: string, v: string) => kvSet(k, v),
  removeItem: async (k: string) => kvDel(k),
  clear: async () => {
    kvMap.clear();
    changed();
  },
  getAllKeys: async () => later([...kvMap.keys()]),
  getItemSync: (k: string) => kvMap.get(k) ?? null,
  setItemSync: (k: string, v: string) => kvSet(k, v),
  removeItemSync: (k: string) => kvDel(k),
  clearSync: () => {
    kvMap.clear();
    changed();
  },
  getAllKeysSync: () => [...kvMap.keys()],
};
/** `import 'expo-sqlite/localStorage/install'` makes the web localStorage API exist on the phone. */
export const localStoragePolyfill = {
  getItem: (k: string) => kvMap.get(String(k)) ?? null,
  setItem: (k: string, v: string) => kvSet(k, v),
  removeItem: (k: string) => kvDel(k),
  clear: () => {
    kvMap.clear();
    changed();
  },
  key: (i: number) => [...kvMap.keys()][i] ?? null,
  get length() {
    return kvMap.size;
  },
};

/* ------------------------------------------------------- expo-image-picker */

/** A small photo to "pick" (drawn on a canvas in the browser; a 1×1 PNG where there is no canvas, e.g. tests). */
let sample: { base64: string; width: number; height: number } | null = null;
function samplePhoto() {
  if (sample) return sample;
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const g = c.getContext('2d');
    if (!g) throw new Error('no canvas');
    const grad = g.createLinearGradient(0, 0, 96, 96);
    grad.addColorStop(0, '#6366f1');
    grad.addColorStop(1, '#22c55e');
    g.fillStyle = grad;
    g.fillRect(0, 0, 96, 96);
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(48, 38, 17, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(48, 92, 32, Math.PI, 0);
    g.fill();
    const url = c.toDataURL('image/png');
    if (!url.startsWith('data:image/png;base64,') || url.length < 100) throw new Error('no png');
    sample = { base64: url.slice('data:image/png;base64,'.length), width: 96, height: 96 };
  } catch {
    sample = { base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', width: 1, height: 1 };
  }
  return sample;
}
const granted = { status: 'granted', granted: true, canAskAgain: true, expires: 'never' };
async function launch(options: { base64?: boolean; allowsEditing?: boolean; quality?: number } = {}) {
  await later(undefined, 120);
  const p = samplePhoto();
  const size = Math.floor((p.base64.length * 3) / 4);
  return {
    canceled: false,
    assets: [{
      uri: `data:image/png;base64,${p.base64}`,
      width: p.width,
      height: p.height,
      type: 'image',
      mimeType: 'image/png',
      fileName: 'avatar.png',
      fileSize: size,
      base64: options.base64 ? p.base64 : null,
      exif: null,
      assetId: null,
      duration: null,
    }],
  };
}
export const ImagePicker = {
  launchImageLibraryAsync: launch,
  launchCameraAsync: launch,
  requestMediaLibraryPermissionsAsync: async () => granted,
  getMediaLibraryPermissionsAsync: async () => granted,
  requestCameraPermissionsAsync: async () => granted,
  getCameraPermissionsAsync: async () => granted,
  useMediaLibraryPermissions: () => [granted, async () => granted],
  useCameraPermissions: () => [granted, async () => granted],
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
};

/* --------------------------------------------------- bytes, base64, crypto */

export function decode(base64: string): ArrayBuffer {
  const bin = atob(String(base64).replace(/\s+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
export function encode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

const randomBytes = (n: number) => {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
};
export function randomUUID(): string {
  const c = globalThis.crypto as Crypto & { randomUUID?: () => string };
  if (typeof c?.randomUUID === 'function') {
    try {
      return c.randomUUID();
    } catch {
      /* not a secure context: build one below */
    }
  }
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export const ExpoCrypto = {
  randomUUID,
  getRandomBytes: (n: number) => randomBytes(n),
  getRandomBytesAsync: async (n: number) => randomBytes(n),
  getRandomValues: <T extends ArrayBufferView>(a: T) => globalThis.crypto.getRandomValues(a as never) as T,
  CryptoDigestAlgorithm: { SHA1: 'SHA-1', SHA256: 'SHA-256', SHA384: 'SHA-384', SHA512: 'SHA-512' },
  CryptoEncoding: { HEX: 'hex', BASE64: 'base64' },
  digestStringAsync: async (algorithm: string, data: string, options?: { encoding?: string }) => {
    const hash = new Uint8Array(await globalThis.crypto.subtle.digest(algorithm, new TextEncoder().encode(data)));
    return options?.encoding === 'base64' ? encode(hash) : [...hash].map((x) => x.toString(16).padStart(2, '0')).join('');
  },
};

/** Small helper for the panel and the checks: a component that shows nothing (used by no-op modules). */
export const Nothing = () => createElement('span', { hidden: true });
