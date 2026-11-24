/**
 * Lab 07: Jest and React Native Testing Library in the lab preview, with nothing to install. A test file is written
 * exactly as in a real Expo project — describe / test / expect, jest.fn / jest.mock / jest.mocked, and render / screen /
 * userEvent from '@testing-library/react-native' — and runs here, on the runtime that draws the preview phone
 * (react-native-web). Results are shaped like Jest's (src/lab/engine/test-report.ts prints them like `npm test`).
 * Only what the labs use is here; anything else fails with a message that says so.
 */
import type { ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { createBuiltins } from './builtins.ts';
import { createModuleSystem, locate } from './modules.ts';
import { normalise, textOf } from './driver-dom.ts';
import type { LogLevel, TestCaseResult, TestError, TestFileResult, TestLog, TestRun } from './protocol.ts';

type Fn = (...args: unknown[]) => unknown;
const TEST_TIMEOUT = 5000;
const FIND_TIMEOUT = 1000;
const isTestPath = (p: string) => /(^|\/)__tests__\//.test(p) || /[.-]test\.[jt]sx?$/.test(p);
const settle = (ms = 0) => new Promise<void>((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ jest.fn */

export type MockFn = Fn & {
  _isMockFunction: true;
  mock: { calls: unknown[][]; results: { type: 'return' | 'throw'; value: unknown }[]; lastCall?: unknown[] };
  mockImplementation(fn: Fn): MockFn;
  mockImplementationOnce(fn: Fn): MockFn;
  mockReturnValue(v: unknown): MockFn;
  mockReturnValueOnce(v: unknown): MockFn;
  mockResolvedValue(v: unknown): MockFn;
  mockResolvedValueOnce(v: unknown): MockFn;
  mockRejectedValue(v: unknown): MockFn;
  mockClear(): MockFn;
  mockReset(): MockFn;
  mockName(name: string): MockFn;
  getMockName(): string;
};
const isMock = (v: unknown): v is MockFn => typeof v === 'function' && (v as MockFn)._isMockFunction === true;

function createJest() {
  const all = new Set<MockFn>();
  const mocks = new Map<string, { factory: (() => unknown) | null; made: boolean; value?: unknown }>();
  function fn(impl?: Fn): MockFn {
    let base = impl;
    const once: Fn[] = [];
    let name = 'jest.fn()';
    const f = function (this: unknown, ...args: unknown[]) {
      f.mock.calls.push(args);
      f.mock.lastCall = args;
      const use = once.shift() ?? base;
      try {
        const value = use ? use.apply(this, args) : undefined;
        f.mock.results.push({ type: 'return', value });
        return value;
      } catch (error) {
        f.mock.results.push({ type: 'throw', value: error });
        throw error;
      }
    } as MockFn;
    f._isMockFunction = true;
    f.mock = { calls: [], results: [] };
    f.mockImplementation = (i) => ((base = i), f);
    f.mockImplementationOnce = (i) => (once.push(i), f);
    f.mockReturnValue = (v) => f.mockImplementation(() => v);
    f.mockReturnValueOnce = (v) => f.mockImplementationOnce(() => v);
    f.mockResolvedValue = (v) => f.mockImplementation(() => Promise.resolve(v));
    f.mockResolvedValueOnce = (v) => f.mockImplementationOnce(() => Promise.resolve(v));
    f.mockRejectedValue = (v) => f.mockImplementation(() => Promise.reject(v));
    f.mockClear = () => {
      f.mock.calls = [];
      f.mock.results = [];
      f.mock.lastCall = undefined;
      return f;
    };
    f.mockReset = () => {
      f.mockClear();
      base = undefined;
      once.length = 0;
      return f;
    };
    f.mockName = (n) => ((name = n), f);
    f.getMockName = () => name;
    all.add(f);
    return f;
  }
  /** jest.mock('pkg') with no factory: every function of the package becomes a mock, other values stay (enums) */
  const automock = (real: unknown): unknown => {
    if (typeof real === 'function') return fn();
    if (!real || typeof real !== 'object') return real;
    return Object.fromEntries(Object.entries(real).map(([k, v]) => [k, typeof v === 'function' ? fn() : v]));
  };
  const unsupported = (name: string) => () => {
    throw new Error(`${name} is not available in the lab's test runner.`);
  };
  const jest = {
    fn,
    mock(spec: string, factory?: () => unknown) {
      mocks.set(spec, { factory: factory ?? null, made: false });
    },
    unmock(spec: string) {
      mocks.delete(spec);
    },
    mocked: <T>(v: T) => v,
    isMockFunction: isMock,
    spyOn(obj: Record<string, unknown>, key: string) {
      const original = obj[key] as Fn;
      const spy = fn((...args: unknown[]) => original.apply(obj, args));
      obj[key] = spy;
      return spy;
    },
    clearAllMocks() {
      for (const f of all) f.mockClear();
    },
    resetAllMocks() {
      for (const f of all) f.mockReset();
    },
    restoreAllMocks() {
      for (const f of all) f.mockClear();
    },
    useFakeTimers: unsupported('jest.useFakeTimers'),
    setTimeout: () => undefined,
  };
  return { jest, mocks, automock };
}

/* ------------------------------------------------------------------ expect */

class Asymmetric {
  readonly label: string;
  readonly check: (v: unknown) => boolean;
  constructor(label: string, check: (v: unknown) => boolean) {
    this.label = label;
    this.check = check;
  }
  toString() {
    return this.label;
  }
}

function equals(a: unknown, b: unknown, strict = false): boolean {
  if (b instanceof Asymmetric) return b.check(a);
  if (a instanceof Asymmetric) return a.check(b);
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a)) return a.length === (b as unknown[]).length && a.every((x, i) => equals(x, (b as unknown[])[i], strict));
  if (strict && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  // toEqual: a property set to undefined counts as missing (as in Jest)
  const keys = (o: object) => Object.keys(o).filter((k) => strict || (o as Record<string, unknown>)[k] !== undefined);
  const ka = keys(a);
  const kb = keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => kb.includes(k) && equals((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], strict));
}

/** toMatchObject: every property of `expected` is in `actual` with an equal value (extra properties are fine) */
function matchesObject(actual: unknown, expected: unknown): boolean {
  if (expected instanceof Asymmetric) return expected.check(actual);
  if (typeof expected !== 'object' || expected === null) return equals(actual, expected);
  if (typeof actual !== 'object' || actual === null) return false;
  if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === expected.length && expected.every((e, i) => matchesObject(actual[i], e));
  return Object.keys(expected).every((k) => k in (actual as object) && matchesObject((actual as Record<string, unknown>)[k], (expected as Record<string, unknown>)[k]));
}

const elementLabel = (el: Element) => {
  const name = el.getAttribute('data-rn') ?? el.tagName.toLowerCase();
  const id = el.getAttribute('data-testid');
  const text = textOf(el);
  return `<${name}${id ? ` testID="${id}"` : ''}>${text.length > 60 ? `${text.slice(0, 57)}…` : text}</${name}>`;
};

/** Values printed the way Jest prints them: "text", Object { "key": value, }, Array [ … ], [MockFunction] */
export function pretty(v: unknown, indent = '', seen = new Set<unknown>()): string {
  if (v instanceof Asymmetric) return v.toString();
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number') return Object.is(v, -0) ? '-0' : String(v);
  if (typeof v === 'boolean' || typeof v === 'bigint' || typeof v === 'symbol') return String(v);
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'function') return isMock(v) ? '[MockFunction]' : `[Function ${v.name || 'anonymous'}]`;
  if (typeof Element !== 'undefined' && v instanceof Element) return elementLabel(v);
  if (v instanceof Date) return v.toISOString();
  if (v instanceof Error) return `[${v.name}: ${v.message}]`;
  if (seen.has(v)) return '[Circular]';
  seen.add(v);
  const next = `${indent}  `;
  if (Array.isArray(v)) {
    if (!v.length) return 'Array []';
    return `Array [\n${v.map((x) => `${next}${pretty(x, next, seen)},`).join('\n')}\n${indent}]`;
  }
  const proto = Object.getPrototypeOf(v);
  const name = proto === Object.prototype || proto === null ? 'Object' : ((v as object).constructor?.name ?? 'Object');
  const keys = Object.keys(v as object).sort();
  if (!keys.length) return `${name} {}`;
  return `${name} {\n${keys.map((k) => `${next}${JSON.stringify(k)}: ${pretty((v as Record<string, unknown>)[k], next, seen)},`).join('\n')}\n${indent}}`;
}

/** A line diff of two printed values, the way Jest shows it: "- " expected only, "+ " received only, "  " both */
export function diffLines(expected: string, received: string): string[] {
  const a = expected.split('\n');
  const b = received.split('\n');
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) out.push(`  ${a[i++]}`), j++;
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push(`- ${a[i++]}`);
    else out.push(`+ ${b[j++]}`);
  }
  while (i < a.length) out.push(`- ${a[i++]}`);
  while (j < b.length) out.push(`+ ${b[j++]}`);
  return out;
}

class AssertionFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssertionError';
  }
}

function diffMessage(head: string, expected: unknown, received: unknown) {
  const e = pretty(expected);
  const r = pretty(received);
  const lines = diffLines(e, r);
  const minus = lines.filter((l) => l.startsWith('- ')).length;
  const plus = lines.filter((l) => l.startsWith('+ ')).length;
  if (!e.includes('\n') && !r.includes('\n')) return `${head}\n\nExpected: ${e}\nReceived: ${r}`;
  return `${head}\n\n- Expected  - ${minus}\n+ Received  + ${plus}\n\n${lines.join('\n')}`;
}

type Result = { pass: boolean; message: (not: boolean) => string };

function onScreen(el: unknown) {
  return typeof Element !== 'undefined' && el instanceof Element && el.isConnected && !!el.closest('.lab-test-root');
}

const MATCHERS: Record<string, (received: unknown, ...args: unknown[]) => Result> = {
  toBe: (r, e) => ({
    pass: Object.is(r, e),
    message: (not) =>
      `expect(received).${not ? 'not.' : ''}toBe(expected) // Object.is equality\n\nExpected: ${not ? 'not ' : ''}${pretty(e)}\nReceived: ${pretty(r)}${!not && equals(r, e) ? '\n\nIf it should pass with deep equality, replace "toBe" with "toStrictEqual"' : ''}`,
  }),
  toEqual: (r, e) => ({ pass: equals(r, e), message: (not) => (not ? `expect(received).not.toEqual(expected) // deep equality\n\nExpected: not ${pretty(e)}` : diffMessage('expect(received).toEqual(expected) // deep equality', e, r)) }),
  toStrictEqual: (r, e) => ({ pass: equals(r, e, true), message: (not) => (not ? `expect(received).not.toStrictEqual(expected)\n\nExpected: not ${pretty(e)}` : diffMessage('expect(received).toStrictEqual(expected) // deep equality', e, r)) }),
  toMatchObject: (r, e) => ({ pass: matchesObject(r, e), message: (not) => (not ? `expect(received).not.toMatchObject(expected)\n\nExpected: not ${pretty(e)}` : diffMessage('expect(received).toMatchObject(expected)', e, r)) }),
  toBeTruthy: (r) => ({ pass: !!r, message: (not) => `expect(received).${not ? 'not.' : ''}toBeTruthy()\n\nReceived: ${pretty(r)}` }),
  toBeFalsy: (r) => ({ pass: !r, message: (not) => `expect(received).${not ? 'not.' : ''}toBeFalsy()\n\nReceived: ${pretty(r)}` }),
  toBeNull: (r) => ({ pass: r === null, message: (not) => `expect(received).${not ? 'not.' : ''}toBeNull()\n\nReceived: ${pretty(r)}` }),
  toBeUndefined: (r) => ({ pass: r === undefined, message: (not) => `expect(received).${not ? 'not.' : ''}toBeUndefined()\n\nReceived: ${pretty(r)}` }),
  toBeDefined: (r) => ({ pass: r !== undefined, message: (not) => `expect(received).${not ? 'not.' : ''}toBeDefined()\n\nReceived: ${pretty(r)}` }),
  toContain: (r, item) => ({
    pass: typeof r === 'string' ? r.includes(String(item)) : Array.isArray(r) && r.includes(item),
    message: (not) => `expect(received).${not ? 'not.' : ''}toContain(expected)\n\nExpected value: ${pretty(item)}\nReceived ${Array.isArray(r) ? 'array' : 'string'}: ${pretty(r)}`,
  }),
  toHaveLength: (r, n) => ({
    pass: (r as { length?: number })?.length === n,
    message: (not) => `expect(received).${not ? 'not.' : ''}toHaveLength(expected)\n\nExpected length: ${n}\nReceived length: ${(r as { length?: number })?.length}`,
  }),
  toBeGreaterThan: (r, n) => ({ pass: (r as number) > (n as number), message: (not) => `expect(received).${not ? 'not.' : ''}toBeGreaterThan(expected)\n\nExpected: > ${n}\nReceived:   ${pretty(r)}` }),
  toBeGreaterThanOrEqual: (r, n) => ({ pass: (r as number) >= (n as number), message: (not) => `expect(received).${not ? 'not.' : ''}toBeGreaterThanOrEqual(expected)\n\nExpected: >= ${n}\nReceived:    ${pretty(r)}` }),
  toBeLessThan: (r, n) => ({ pass: (r as number) < (n as number), message: (not) => `expect(received).${not ? 'not.' : ''}toBeLessThan(expected)\n\nExpected: < ${n}\nReceived:   ${pretty(r)}` }),
  toBeLessThanOrEqual: (r, n) => ({ pass: (r as number) <= (n as number), message: (not) => `expect(received).${not ? 'not.' : ''}toBeLessThanOrEqual(expected)\n\nExpected: <= ${n}\nReceived:    ${pretty(r)}` }),
  toMatch: (r, p) => ({
    pass: typeof r === 'string' && (p instanceof RegExp ? p.test(r) : r.includes(String(p))),
    message: (not) => `expect(received).${not ? 'not.' : ''}toMatch(expected)\n\nExpected pattern: ${p instanceof RegExp ? String(p) : pretty(p)}\nReceived string:  ${pretty(r)}`,
  }),
  toThrow: (r, e) => {
    let thrown: unknown;
    let did = false;
    try {
      (r as Fn)();
    } catch (error) {
      thrown = error;
      did = true;
    }
    const msg = thrown instanceof Error ? thrown.message : String(thrown);
    const pass = did && (e === undefined || (e instanceof RegExp ? e.test(msg) : typeof e === 'string' ? msg.includes(e) : true));
    return { pass, message: (not) => `expect(received).${not ? 'not.' : ''}toThrow(${e === undefined ? '' : 'expected'})\n\n${did ? `Received message: ${pretty(msg)}` : 'Received function did not throw'}` };
  },
  toHaveBeenCalled: (r) => callMatcher('toHaveBeenCalled', r, (m) => ({ pass: m.mock.calls.length > 0, detail: `Received number of calls: ${m.mock.calls.length}` })),
  toHaveBeenCalledTimes: (r, n) =>
    callMatcher('toHaveBeenCalledTimes', r, (m) => ({ pass: m.mock.calls.length === n, detail: `Expected number of calls: ${n}\nReceived number of calls: ${m.mock.calls.length}` }), 'expected'),
  toHaveBeenCalledWith: (r, ...args) =>
    callMatcher('toHaveBeenCalledWith', r, (m) => ({
      pass: m.mock.calls.some((c) => equals(c, args)),
      detail: `Expected: ${args.map((a) => pretty(a)).join(', ')}\nReceived: ${m.mock.calls.length ? m.mock.calls.map((c, i) => `\n  ${i + 1}: ${c.map((a) => pretty(a)).join(', ')}`).join('') : '(no calls)'}\n\nNumber of calls: ${m.mock.calls.length}`,
    }), '...expected'),
  toHaveBeenLastCalledWith: (r, ...args) =>
    callMatcher('toHaveBeenLastCalledWith', r, (m) => ({
      pass: !!m.mock.lastCall && equals(m.mock.lastCall, args),
      detail: `Expected: ${args.map((a) => pretty(a)).join(', ')}\nReceived: ${m.mock.lastCall ? m.mock.lastCall.map((a) => pretty(a)).join(', ') : '(no calls)'}`,
    }), '...expected'),
  // React Native Testing Library's matchers
  toBeOnTheScreen: (r) => ({
    pass: onScreen(r),
    message: (not) => (not ? `expect(element).not.toBeOnTheScreen()\n\nexpected element tree not to contain element, but found\n  ${pretty(r)}` : `expect(element).toBeOnTheScreen()\n\nelement could not be found in the element tree`),
  }),
  toHaveTextContent: (r, t) => {
    const text = r instanceof Element ? textOf(r) : '';
    const pass = t instanceof RegExp ? t.test(text) : normalise(text).includes(normalise(String(t)));
    return { pass, message: (not) => `expect(element).${not ? 'not.' : ''}toHaveTextContent()\n\nExpected element ${not ? 'not ' : ''}to have text content:\n  ${t instanceof RegExp ? String(t) : String(t)}\nReceived:\n  ${text}` };
  },
  toBeVisible: (r) => ({ pass: onScreen(r), message: (not) => `expect(element).${not ? 'not.' : ''}toBeVisible()\n\nReceived element ${not ? 'is' : 'is not'} visible:\n  ${pretty(r)}` }),
  toBeDisabled: (r) => ({
    pass: r instanceof Element && (r.getAttribute('aria-disabled') === 'true' || r.hasAttribute('disabled')),
    message: (not) => `expect(element).${not ? 'not.' : ''}toBeDisabled()\n\nReceived element ${not ? 'is' : 'is not'} disabled:\n  ${pretty(r)}`,
  }),
  toBeEnabled: (r) => ({
    pass: r instanceof Element && !(r.getAttribute('aria-disabled') === 'true' || r.hasAttribute('disabled')),
    message: (not) => `expect(element).${not ? 'not.' : ''}toBeEnabled()\n\nReceived element ${not ? 'is' : 'is not'} enabled:\n  ${pretty(r)}`,
  }),
};
const ALIASES: Record<string, string> = { toBeCalled: 'toHaveBeenCalled', toBeCalledTimes: 'toHaveBeenCalledTimes', toBeCalledWith: 'toHaveBeenCalledWith', lastCalledWith: 'toHaveBeenLastCalledWith', toThrowError: 'toThrow' };

function callMatcher(name: string, r: unknown, test: (m: MockFn) => { pass: boolean; detail: string }, arg = ''): Result {
  if (!isMock(r)) {
    return {
      pass: false,
      message: () => `expect(received).${name}(${arg})\n\nMatcher error: received value must be a mock function (jest.fn(), or a function of a jest.mock package)\n\nReceived: ${pretty(r)}`,
    };
  }
  const { pass, detail } = test(r);
  return { pass, message: (not) => `expect(jest.fn()).${not ? 'not.' : ''}${name}(${arg})\n\n${detail}` };
}

function createExpect() {
  const build = (received: unknown, not: boolean, mode: '' | 'resolves' | 'rejects') => {
    const api: Record<string, unknown> = {};
    for (const name of [...Object.keys(MATCHERS), ...Object.keys(ALIASES)]) {
      const matcher = MATCHERS[ALIASES[name] ?? name];
      const check = (value: unknown, args: unknown[]) => {
        const res = matcher(value, ...args);
        if (res.pass === not) throw new AssertionFailure(res.message(not));
      };
      api[name] = (...args: unknown[]) => {
        if (mode === '') return check(received, args);
        return Promise.resolve(received).then(
          (value) => {
            if (mode === 'rejects') throw new AssertionFailure(`expect(received).rejects.${name}()\n\nReceived promise resolved instead of rejected\nResolved to value: ${pretty(value)}`);
            check(value, args);
          },
          (error) => {
            if (mode === 'resolves') throw new AssertionFailure(`expect(received).resolves.${name}()\n\nReceived promise rejected instead of resolved\nRejected to value: ${pretty(error)}`);
            check(error, args);
          },
        );
      };
    }
    return api;
  };
  const expect = (received: unknown) => {
    const api = build(received, false, '');
    api.not = build(received, true, '');
    api.resolves = Object.assign(build(received, false, 'resolves'), { not: build(received, true, 'resolves') });
    api.rejects = Object.assign(build(received, false, 'rejects'), { not: build(received, true, 'rejects') });
    return api;
  };
  const typeOf = (C: unknown) => (C as { name?: string })?.name ?? 'value';
  return Object.assign(expect, {
    any: (C: unknown) =>
      new Asymmetric(`Any<${typeOf(C)}>`, (v) =>
        C === String ? typeof v === 'string' : C === Number ? typeof v === 'number' : C === Boolean ? typeof v === 'boolean' : C === Function ? typeof v === 'function' : C === Object ? typeof v === 'object' && v !== null : typeof C === 'function' && v instanceof (C as new () => unknown),
      ),
    anything: () => new Asymmetric('Anything', (v) => v !== null && v !== undefined),
    stringContaining: (s: string) => new Asymmetric(`StringContaining ${pretty(s)}`, (v) => typeof v === 'string' && v.includes(s)),
    stringMatching: (p: string | RegExp) => new Asymmetric(`StringMatching ${String(p)}`, (v) => typeof v === 'string' && (p instanceof RegExp ? p.test(v) : v.includes(p))),
    objectContaining: (o: object) => new Asymmetric(`ObjectContaining ${pretty(o)}`, (v) => matchesObject(v, o)),
    arrayContaining: (a: unknown[]) => new Asymmetric(`ArrayContaining ${pretty(a)}`, (v) => Array.isArray(v) && a.every((x) => v.some((y) => equals(y, x)))),
    assertions: () => undefined,
    hasAssertions: () => undefined,
  });
}

/* ------------------------------------------------------------------ React Native Testing Library */

type TextMatch = string | RegExp;
type QueryOpts = { exact?: boolean; name?: TextMatch; timeout?: number; hidden?: boolean };

const matchText = (value: string, m: TextMatch, exact = true) =>
  m instanceof RegExp ? m.test(value) : exact ? normalise(value) === normalise(m) : normalise(value).toLowerCase().includes(normalise(m).toLowerCase());
/** outer elements only: a Text inside a Text with the same words counts once */
const outermost = (list: Element[]) => list.filter((el) => !list.some((other) => other !== el && other.contains(el)));
const roleOf = (el: Element) => el.getAttribute('role') ?? (el.tagName === 'A' ? 'link' : el.tagName === 'BUTTON' ? 'button' : el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? 'textbox' : null);
const accessibleName = (el: Element) => el.getAttribute('aria-label') ?? textOf(el);

type Finder = { all: (roots: Element[]) => Element[]; describe: string };
const finders = {
  Text: (m: TextMatch, o: QueryOpts = {}): Finder => ({
    describe: `text: ${String(m)}`,
    all: (roots) => outermost(roots.flatMap((r) => [...r.querySelectorAll('[data-rn="Text"]')]).filter((el) => matchText(textOf(el), m, o.exact !== false))),
  }),
  Role: (role: string, o: QueryOpts = {}): Finder => ({
    describe: `role: ${role}${o.name !== undefined ? `, name: ${String(o.name)}` : ''}`,
    all: (roots) =>
      outermost(
        roots
          .flatMap((r) => [...r.querySelectorAll('*')])
          .filter((el) => roleOf(el) === role && (o.name === undefined || matchText(accessibleName(el), o.name, o.exact !== false))),
      ),
  }),
  TestId: (id: TextMatch): Finder => ({
    describe: `testID: ${String(id)}`,
    all: (roots) => roots.flatMap((r) => [...r.querySelectorAll('[data-testid]')]).filter((el) => matchText(el.getAttribute('data-testid') ?? '', id)),
  }),
  PlaceholderText: (m: TextMatch, o: QueryOpts = {}): Finder => ({
    describe: `placeholder: ${String(m)}`,
    all: (roots) => roots.flatMap((r) => [...r.querySelectorAll('[placeholder]')]).filter((el) => matchText(el.getAttribute('placeholder') ?? '', m, o.exact !== false)),
  }),
  DisplayValue: (m: TextMatch, o: QueryOpts = {}): Finder => ({
    describe: `display value: ${String(m)}`,
    all: (roots) => roots.flatMap((r) => [...r.querySelectorAll('input, textarea')]).filter((el) => matchText((el as HTMLInputElement).value, m, o.exact !== false)),
  }),
  LabelText: (m: TextMatch, o: QueryOpts = {}): Finder => ({
    describe: `accessibility label: ${String(m)}`,
    all: (roots) => roots.flatMap((r) => [...r.querySelectorAll('[aria-label]')]).filter((el) => matchText(el.getAttribute('aria-label') ?? '', m, o.exact !== false)),
  }),
};

function createQueries(roots: () => Element[], renderErrors: () => void) {
  const out: Record<string, unknown> = {};
  for (const [kind, make] of Object.entries(finders) as [string, (a: TextMatch, o?: QueryOpts) => Finder][]) {
    const none = (f: Finder) => new Error(`Unable to find an element with ${f.describe}`);
    const many = (f: Finder) => new Error(`Found multiple elements with ${f.describe}\n\n(If this is intentional, then use the \`*AllBy*\` variant of the query (like \`queryAllBy${kind}\`, \`getAllBy${kind}\`, or \`findAllBy${kind}\`)).`);
    const getAll = (a: TextMatch, o?: QueryOpts) => {
      renderErrors();
      const f = make(a, o);
      const list = f.all(roots());
      if (!list.length) throw none(f);
      return list;
    };
    const get = (a: TextMatch, o?: QueryOpts) => {
      const list = getAll(a, o);
      if (list.length > 1) throw many(make(a, o));
      return list[0];
    };
    const queryAll = (a: TextMatch, o?: QueryOpts) => (renderErrors(), make(a, o).all(roots()));
    const query = (a: TextMatch, o?: QueryOpts) => {
      const list = queryAll(a, o);
      if (list.length > 1) throw many(make(a, o));
      return list[0] ?? null;
    };
    const poll = async <T>(read: () => T, timeout: number): Promise<T> => {
      const end = Date.now() + timeout;
      for (;;) {
        try {
          return read();
        } catch (error) {
          if (Date.now() > end) throw error;
          await settle(50);
        }
      }
    };
    out[`getBy${kind}`] = get;
    out[`getAllBy${kind}`] = getAll;
    out[`queryBy${kind}`] = query;
    out[`queryAllBy${kind}`] = queryAll;
    out[`findBy${kind}`] = (a: TextMatch, o?: QueryOpts, w?: { timeout?: number }) => poll(() => get(a, o), w?.timeout ?? o?.timeout ?? FIND_TIMEOUT);
    out[`findAllBy${kind}`] = (a: TextMatch, o?: QueryOpts, w?: { timeout?: number }) => poll(() => getAll(a, o), w?.timeout ?? o?.timeout ?? FIND_TIMEOUT);
  }
  return out;
}

function createRntl(host: HTMLElement, log: (level: LogLevel, text: string) => void) {
  const mounted: { root: Root; el: HTMLElement }[] = [];
  const errors: unknown[] = [];
  /** an error thrown while React drew a component fails the test with that error (not "Unable to find…") */
  const renderErrors = () => {
    const e = errors.shift();
    errors.length = 0;
    if (e) throw e;
  };
  const flush = async () => {
    await settle(0);
    await settle(0);
    renderErrors();
  };
  const all = () => mounted.map((m) => m.el);
  const screen = createQueries(all, renderErrors);
  screen.debug = () => log('log', mounted.map((m) => textOf(m.el)).join('\n'));

  async function render(ui: ReactElement) {
    const el = document.createElement('div');
    el.className = 'lab-test-root';
    host.appendChild(el);
    const root = createRoot(el, { onUncaughtError: (e: unknown) => errors.push(e), onCaughtError: (e: unknown) => errors.push(e) });
    flushSync(() => root.render(ui));
    mounted.push({ root, el });
    await flush();
    return {
      ...createQueries(() => [el], renderErrors),
      container: el,
      root: el,
      debug: () => log('log', textOf(el)),
      rerender: async (next: ReactElement) => {
        flushSync(() => root.render(next));
        await flush();
      },
      unmount: () => {
        root.unmount();
        el.remove();
      },
    };
  }

  async function press(el: unknown) {
    if (!(el instanceof HTMLElement)) throw new Error('press() was given no element: the query before it found nothing.');
    if (el.closest('[aria-disabled="true"]')) return;
    el.click();
    await flush();
  }
  async function type(el: unknown, text: string, replace = false) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) throw new Error('type() needs a TextInput element.');
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, replace ? text : el.value + text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
  }
  const user = { press, longPress: press, type: (el: unknown, text: string) => type(el, text), clear: (el: unknown) => type(el, '', true), paste: (el: unknown, text: string) => type(el, text) };
  const fireEvent = Object.assign(
    async (el: unknown, name: string, ...args: unknown[]) => {
      if (name === 'press') return press(el);
      if (name === 'changeText') return type(el, String(args[0] ?? ''), true);
      throw new Error(`fireEvent(element, '${name}') is not available in the lab's test runner: use press or changeText.`);
    },
    { press, changeText: (el: unknown, text: string) => type(el, text, true), scroll: async () => undefined },
  );
  async function waitFor<T>(fn: () => T | Promise<T>, o: { timeout?: number; interval?: number } = {}) {
    const end = Date.now() + (o.timeout ?? FIND_TIMEOUT);
    for (;;) {
      try {
        return await fn();
      } catch (error) {
        if (Date.now() > end) throw error;
        await settle(o.interval ?? 50);
      }
    }
  }
  const cleanup = () => {
    for (const m of mounted.splice(0)) {
      try {
        m.root.unmount();
      } catch {
        /* already gone */
      }
      m.el.remove();
    }
    errors.length = 0;
  };
  const api = {
    render,
    screen,
    within: (el: Element) => createQueries(() => [el], renderErrors),
    userEvent: { setup: () => user, ...user },
    fireEvent,
    waitFor,
    act: async (fn: () => unknown) => {
      await fn();
      await flush();
    },
    cleanup,
  };
  return api;
}

/* ------------------------------------------------------------------ describe / test */

type Mode = 'run' | 'skip' | 'only' | 'todo';
type TestItem = { kind: 'test'; name: string; fn?: Fn; mode: Mode; timeout: number };
type Block = { kind: 'block'; name: string; items: (TestItem | Block)[]; before: Fn[]; after: Fn[]; beforeAll: Fn[]; afterAll: Fn[]; mode: Mode };

function createCollector() {
  const root: Block = { kind: 'block', name: '', items: [], before: [], after: [], beforeAll: [], afterAll: [], mode: 'run' };
  let current = root;
  let only = false;
  const addBlock = (mode: Mode) => (name: string, fn: () => unknown) => {
    if (mode === 'only') only = true;
    const block: Block = { kind: 'block', name: String(name), items: [], before: [], after: [], beforeAll: [], afterAll: [], mode };
    current.items.push(block);
    const parent = current;
    current = block;
    try {
      const r = fn();
      if (r && typeof (r as Promise<unknown>).then === 'function') throw new Error('describe() cannot be async: put the awaits inside test().');
    } finally {
      current = parent;
    }
  };
  const addTest = (mode: Mode) => (name: string, fn?: Fn, timeout?: number) => {
    if (mode === 'only') only = true;
    current.items.push({ kind: 'test', name: String(name), fn, mode: fn ? mode : 'todo', timeout: timeout ?? TEST_TIMEOUT });
  };
  const notHere = (what: string) => () => {
    throw new Error(`${what} is not available in the lab's test runner.`);
  };
  const describe = Object.assign(addBlock('run'), { skip: addBlock('skip'), only: addBlock('only'), each: notHere('describe.each') });
  const test = Object.assign(addTest('run'), { skip: addTest('skip'), only: addTest('only'), todo: (name: string) => addTest('todo')(name), each: notHere('test.each') });
  const hook = (key: 'before' | 'after' | 'beforeAll' | 'afterAll') => (fn: Fn) => {
    current[key].push(fn);
  };
  return {
    root,
    hasOnly: () => only,
    globals: { describe, test, it: test, xit: test.skip, xtest: test.skip, fit: test.only, xdescribe: describe.skip, fdescribe: describe.only, beforeEach: hook('before'), afterEach: hook('after'), beforeAll: hook('beforeAll'), afterAll: hook('afterAll') },
  };
}

async function withTimeout(fn: Fn, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = fn.length > 0 ? new Promise<void>((resolve, reject) => fn((e?: unknown) => (e ? reject(e) : resolve()))) : Promise.resolve().then(() => fn());
  try {
    await Promise.race([
      run,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Exceeded timeout of ${ms} ms for a test.\nAdd a timeout value to this test to increase the timeout, if this is a long-running test.`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

const toError = (e: unknown): TestError => {
  const error = e instanceof Error ? e : new Error(String(e));
  const where = locate(error);
  return { message: error instanceof AssertionFailure ? error.message : `${error.name === 'Error' ? '' : `${error.name}: `}${error.message}`, ...(where ? { where } : null) };
};

/* ------------------------------------------------------------------ run */

function testArea(): HTMLElement {
  let el = document.getElementById('lab-test-area');
  if (!el) {
    el = document.createElement('div');
    el.id = 'lab-test-area';
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;left:-10000px;top:0;width:390px;height:844px;overflow:hidden;';
    document.body.appendChild(el);
  }
  return el;
}

async function runFile(files: Record<string, string>, file: string): Promise<TestFileResult> {
  const started = Date.now();
  const logs: TestLog[] = [];
  const { jest, mocks, automock } = createJest();
  const expect = createExpect();
  const collector = createCollector();
  const log = (level: LogLevel, text: string) => logs.push({ level, text });
  const rntl = createRntl(testArea(), log);
  const testingLibrary = { ...rntl, cleanup: rntl.cleanup };
  const builtins = {
    ...createBuiltins({ requireFile: () => null, createRoot: () => ({ render: () => undefined, unmount: () => undefined }) }),
    '@testing-library/react-native': testingLibrary,
    '@jest/globals': { jest, expect, ...collector.globals },
  } as Record<string, unknown>;
  const modules = createModuleSystem(builtins, files, {
    globals: { jest, expect, ...collector.globals },
    mock: (spec) => {
      const m = mocks.get(spec);
      if (!m) return { found: false };
      if (!m.made) {
        m.value = m.factory ? m.factory() : automock(builtins[spec]);
        m.made = true;
      }
      return { found: true, value: m.value };
    },
  });

  // console.log in the code under test is shown with the results, like Jest does
  const original = { log: console.log, info: console.info, warn: console.warn, error: console.error };
  const capture = (level: LogLevel) => (...args: unknown[]) => {
    const text = args.map((a) => (typeof a === 'string' ? a : a instanceof Error ? a.message : pretty(a))).join(' ');
    const where = locate(new Error('log'));
    logs.push({ level, text, ...(where ? { where } : null) });
  };
  console.log = capture('log');
  console.info = capture('info');
  console.warn = capture('warn');
  console.error = capture('error');

  const tests: TestCaseResult[] = [];
  try {
    try {
      modules.load(file);
    } catch (error) {
      return { file, tests: [], error: toError(error), logs, ms: Date.now() - started };
    }
    const only = collector.hasOnly();
    const runBlock = async (block: Block, path: string[], before: Fn[], after: Fn[], skipped: boolean, inOnly: boolean): Promise<void> => {
      const skip = skipped || block.mode === 'skip';
      const onlyHere = inOnly || block.mode === 'only';
      let failedAll: TestError | null = null;
      if (!skip) {
        try {
          for (const f of block.beforeAll) await withTimeout(f, TEST_TIMEOUT);
        } catch (error) {
          failedAll = toError(error);
        }
      }
      for (const item of block.items) {
        if (item.kind === 'block') {
          await runBlock(item, [...path, item.name], [...before, ...item.before], [...item.after, ...after], skip, onlyHere);
          continue;
        }
        const name = item.name;
        const t0 = Date.now();
        if (skip || item.mode === 'skip' || (only && !onlyHere && item.mode !== 'only')) {
          tests.push({ path, name, status: 'skipped', ms: 0 });
          continue;
        }
        if (item.mode === 'todo' || !item.fn) {
          tests.push({ path, name, status: 'todo', ms: 0 });
          continue;
        }
        let error: TestError | undefined = failedAll ?? undefined;
        if (!error) {
          try {
            for (const h of before) await withTimeout(h, TEST_TIMEOUT);
            await withTimeout(item.fn, item.timeout);
          } catch (e) {
            error = toError(e);
          }
          for (const h of after) {
            try {
              await withTimeout(h, TEST_TIMEOUT);
            } catch (e) {
              error ??= toError(e);
            }
          }
        }
        rntl.cleanup();
        tests.push({ path, name, status: error ? 'failed' : 'passed', ms: Date.now() - t0, ...(error ? { error } : null) });
      }
      if (!skip) {
        for (const f of block.afterAll) {
          try {
            await withTimeout(f, TEST_TIMEOUT);
          } catch {
            /* reported with its tests */
          }
        }
      }
    };
    await runBlock(collector.root, [], collector.root.before, collector.root.after, false, false);
    if (!tests.length) return { file, tests, error: { message: 'Your test suite must contain at least one test.' }, logs, ms: Date.now() - started };
    return { file, tests, logs, ms: Date.now() - started };
  } finally {
    Object.assign(console, original);
    rntl.cleanup();
  }
}

/** Runs test files (compiled), one after the other, each in its own module system and mocks (as Jest does). */
export async function runTests(files: Record<string, string>, paths?: string[]): Promise<TestRun> {
  const started = Date.now();
  const list = (paths?.length ? paths : Object.keys(files).filter(isTestPath)).filter((p) => p in files).sort();
  const results: TestFileResult[] = [];
  for (const file of list) results.push(await runFile(files, file));
  return { files: results, ms: Date.now() - started };
}

