/**
 * Messages between the lab page (parent) and the sandboxed preview iframe (runtime).
 * Every message carries `__lab: 1` so both sides can ignore unrelated postMessage traffic.
 */
export type Frame = 'phone' | 'web';

import type { DeviceSnapshot } from './device.ts';
export type { DeviceSnapshot, DeviceSection, DeviceRow, DeviceTable, DeviceFile } from './device.ts';

export type RunRequest = { type: 'run'; id: number; files: Record<string, string>; entry: string; frame: Frame };
export type RpcRequest = { type: 'rpc'; id: number; method: string; args: unknown[] };
/** the page's answer to an `asset` request: a file the preview cannot fetch itself (it has no origin), e.g. SQLite's .wasm */
export type AssetResult = { type: 'asset-result'; id: number; ok: boolean; value?: ArrayBuffer; error?: string };
export type ToRuntime = (RunRequest | RpcRequest | AssetResult) & { __lab: 1 };

export type LabErrorInfo = {
  message: string;
  hint?: string;
  file?: string;
  line?: number;
  column?: number;
};

export type LogLevel = 'log' | 'info' | 'warn' | 'error';

export type FromRuntime = (
  | { type: 'ready' }
  | { type: 'rendered'; id: number }
  | { type: 'error'; id?: number; error: LabErrorInfo }
  | { type: 'log'; level: LogLevel; text: string }
  | { type: 'rpc-result'; id: number; ok: boolean; value?: unknown; error?: string }
  /** the phone's storage changed (Lab 06's Device storage panel) */
  | { type: 'device'; snapshot: DeviceSnapshot }
  /** please send this file from /lab-runtime/ (answered with asset-result) */
  | { type: 'asset'; id: number; name: string }
) & { __lab: 1 };

/** How checks address something on the preview screen. */
export type Query = {
  /** React Native component name, e.g. 'Text', 'Pressable', 'TextInput' */
  rn?: string;
  /** HTML tag for the web (React) part, e.g. 'button', 'h1', 'input' */
  tag?: string;
  /** text shown inside the element (case-insensitive substring) or a RegExp */
  text?: string | RegExp;
  testID?: string;
  placeholder?: string | RegExp;
  /** pick the n-th match (0-based) */
  index?: number;
};

/** A plain, serialisable description of an element on the preview screen. */
export type Found = {
  rn: string | null;
  tag: string;
  text: string;
  value?: string;
  placeholder?: string;
  testID?: string;
  /** the resolved React Native style (style prop + className merged) */
  style: Record<string, unknown>;
  className?: string;
  /** number of direct list rows (FlatList / ScrollView content) */
  items?: number;
};

/** What checks can do with the running app. Same API in the browser (via postMessage) and in Node tests. */
export interface PreviewDriver {
  text(): Promise<string>;
  find(q?: Query): Promise<Found[]>;
  count(q?: Query): Promise<number>;
  press(q?: Query): Promise<boolean>;
  type(q: Query, value: string): Promise<boolean>;
  logs(): Promise<string[]>;
  /** render the app again from scratch (fresh state) */
  rerun(): Promise<void>;
  wait(ms: number): Promise<void>;
  /** Lab 06: what the phone has stored (AsyncStorage, MMKV, SecureStore, SQLite, the practice Supabase project) */
  storage?(): Promise<DeviceSnapshot>;
  /** Lab 06: switch the phone's Wi-Fi on or off (NetInfo, fetch and Supabase follow it) */
  network?(online: boolean): Promise<void>;
  /** Lab 06: erase what the phone stored (the practice Supabase project goes back to its first rows) */
  resetDevice?(): Promise<void>;
}
