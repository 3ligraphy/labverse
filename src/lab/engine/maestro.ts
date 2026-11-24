/**
 * Lab 07: a Maestro flow (the YAML a real `maestro test` reads) played on the lab's preview phone, so students write and
 * run end-to-end tests with nothing to install. The output has the same shape as Maestro's in a terminal
 * ("Tap on "Start scanning"... COMPLETED"). Supported: launchApp, stopApp, openLink, clearState, tapOn, assertVisible,
 * assertNotVisible, extendedWaitUntil, inputText, eraseText, takeScreenshot, waitForAnimationToEnd, hideKeyboard.
 * As in Maestro, a text is a regular expression that must match the element's whole text, and the flow stops at the
 * first failed step. Pure (works on any PreviewDriver): the lab page, checks and Node tests run it the same way.
 */
import type { PreviewDriver, Query } from '../runtime/protocol.ts';

export type FlowCommand = { line: number; command: string; arg: unknown };
export type Flow = { config: Record<string, unknown>; commands: FlowCommand[] };
export type Parsed = { ok: true; flow: Flow } | { ok: false; line: number; message: string };
export type StepStatus = 'COMPLETED' | 'FAILED' | 'WARNED';
export type StepResult = { text: string; status: StepStatus; line: number; detail?: string };
export type FlowResult = { ok: boolean; name: string; steps: StepResult[]; error?: string };

const SUPPORTED = ['launchApp', 'stopApp', 'openLink', 'clearState', 'tapOn', 'assertVisible', 'assertNotVisible', 'extendedWaitUntil', 'inputText', 'eraseText', 'takeScreenshot', 'waitForAnimationToEnd', 'hideKeyboard'];

/* ------------------------------------------------------------------ YAML (the part flows use) */

/** removes a # comment that is not inside quotes */
function stripComment(line: string) {
  let quote = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
}

function scalar(raw: string): unknown {
  const v = raw.trim();
  if (v === '') return null;
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v.startsWith('{')) return inlineMap(v);
  return v;
}

/** { text: "Allow camera", optional: true } */
function inlineMap(v: string): Record<string, unknown> {
  if (!v.endsWith('}')) throw new Error('This { … } is not closed with }.');
  const body = v.slice(1, -1);
  const parts: string[] = [];
  let quote = '';
  let cur = '';
  for (const c of body) {
    if (quote) {
      if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === ',') {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.trim()) parts.push(cur);
  const out: Record<string, unknown> = {};
  for (const p of parts) {
    const i = p.indexOf(':');
    if (i < 0) throw new Error(`"${p.trim()}" needs a key and a value, like text: "Start scanning".`);
    out[p.slice(0, i).trim()] = scalar(p.slice(i + 1));
  }
  return out;
}

export function parseFlow(source: string): Parsed {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const sep = lines.findIndex((l) => l.trim() === '---');
  if (sep < 0) return { ok: false, line: 1, message: 'A flow needs its settings (appId: …), then a line with three dashes (---), then the commands.' };
  const config: Record<string, unknown> = {};
  let block: Record<string, unknown> | null = null;
  for (let i = 0; i < sep; i++) {
    const raw = stripComment(lines[i]);
    if (!raw.trim()) continue;
    const m = /^(\s*)([\w-]+):\s*(.*)$/.exec(raw);
    if (!m) return { ok: false, line: i + 1, message: `Line ${i + 1} should be a setting such as appId: host.exp.exponent.` };
    if (m[1] && block) block[m[2]] = scalar(m[3]);
    else if (m[3].trim() === '') config[m[2]] = block = {};
    else {
      config[m[2]] = scalar(m[3]);
      block = null;
    }
  }
  const commands: FlowCommand[] = [];
  let open: { cmd: FlowCommand; indent: number } | null = null;
  for (let i = sep + 1; i < lines.length; i++) {
    const raw = stripComment(lines[i]);
    if (!raw.trim()) continue;
    const item = /^(\s*)-\s+(.*)$/.exec(raw);
    try {
      if (item && (!open || item[1].length <= open.indent)) {
        const text = item[2].trim();
        const m = /^([\w]+)\s*:\s*(.*)$/.exec(text);
        if (!m) {
          if (!/^\w+$/.test(text)) return { ok: false, line: i + 1, message: `Line ${i + 1}: "${text}" is not a command. A command looks like - tapOn: "Start scanning".` };
          commands.push({ line: i + 1, command: text, arg: null });
          open = null;
          continue;
        }
        const cmd = { line: i + 1, command: m[1], arg: m[2].trim() === '' ? {} : scalar(m[2]) };
        commands.push(cmd);
        open = m[2].trim() === '' ? { cmd, indent: item[1].length } : null;
        continue;
      }
      const prop = /^(\s+)([\w]+):\s*(.*)$/.exec(raw);
      if (prop && open && typeof open.cmd.arg === 'object' && open.cmd.arg) {
        const target = open.cmd.arg as Record<string, unknown>;
        target[prop[2]] = prop[3].trim() === '' ? {} : scalar(prop[3]);
        continue;
      }
      return { ok: false, line: i + 1, message: `Line ${i + 1} is not understood. Each command starts with "- ", and its options are indented under it.` };
    } catch (error) {
      return { ok: false, line: i + 1, message: `Line ${i + 1}: ${(error as Error).message}` };
    }
  }
  return { ok: true, flow: { config, commands } };
}

/* ------------------------------------------------------------------ run */

type Selector = { text?: string; id?: string; optional: boolean };

function selectorOf(arg: unknown): Selector | string {
  if (typeof arg === 'string' || typeof arg === 'number') return { text: String(arg), optional: false };
  if (arg && typeof arg === 'object') {
    const o = arg as Record<string, unknown>;
    const other = Object.keys(o).filter((k) => !['text', 'id', 'optional', 'label'].includes(k));
    if (other.length) return `"${other[0]}" is not available on the lab's phone: select by text or id.`;
    if (o.text === undefined && o.id === undefined) return 'Say which element: text: "…" or id: "…".';
    return { text: o.text === undefined ? undefined : String(o.text), id: o.id === undefined ? undefined : String(o.id), optional: o.optional === true };
  }
  return 'Say which element: a text, or { id: "…" }.';
}

/** Maestro reads a text as a regular expression that must match the whole text */
function textRegex(text: string) {
  try {
    return new RegExp(`^(?:${text})$`);
  } catch {
    return new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
  }
}
const queryOf = (s: Selector): Query => (s.id !== undefined ? { testID: s.id } : { text: textRegex(s.text ?? '') });
const label = (s: Selector) => (s.id !== undefined ? `id: ${s.id}` : `"${s.text}"`);
const notFound = (s: Selector) => (s.id !== undefined ? `Element not found: Id matching regex: ${s.id}` : `Element not found: Text matching regex: ${s.text}`);

async function until(driver: PreviewDriver, check: () => Promise<boolean>, ms: number) {
  const end = Date.now() + ms;
  for (;;) {
    if (await check()) return true;
    if (Date.now() > end) return false;
    await driver.wait(150);
  }
}

export type FlowOptions = { name?: string; env?: Record<string, string>; device?: string; timeouts?: { find?: number; optional?: number; maxWait?: number } };

export async function runFlow(source: string, driver: PreviewDriver, opts: FlowOptions = {}): Promise<FlowResult> {
  const name = opts.name ?? 'flow';
  const parsed = parseFlow(source);
  if (!parsed.ok) return { ok: false, name, steps: [], error: parsed.message };
  const { config, commands } = parsed.flow;
  const appId = String(config.appId ?? '');
  if (!appId) return { ok: false, name, steps: [], error: 'The flow needs appId: … before the --- line (in Expo Go: appId: host.exp.exponent).' };
  const env = { ...((config.env as Record<string, string>) ?? {}), ...(opts.env ?? {}) };
  const sub = (s: string) => s.replace(/\$\{(\w+)\}/g, (all, k: string) => env[k] ?? all);
  const find = opts.timeouts?.find ?? 4000;
  const optionalWait = opts.timeouts?.optional ?? 1500;
  const maxWait = opts.timeouts?.maxWait ?? 15000;
  const visible = async (s: Selector) => (await driver.find(queryOf(s))).length > 0;
  const steps: StepResult[] = [];

  for (const c of commands) {
    const step = (text: string, status: StepStatus, detail?: string) => steps.push({ text, status, line: c.line, ...(detail ? { detail } : null) });
    const fail = (text: string, detail: string) => {
      step(text, 'FAILED', detail);
      return { ok: false, name, steps } as FlowResult;
    };
    switch (c.command) {
      case 'launchApp': {
        const clear = !!(c.arg && typeof c.arg === 'object' && (c.arg as Record<string, unknown>).clearState === true);
        if (clear) await driver.resetDevice?.();
        await driver.rerun();
        step(`Launch app "${typeof c.arg === 'string' ? c.arg : appId}"${clear ? ' with clear state' : ''}`, 'COMPLETED');
        break;
      }
      case 'stopApp':
        step(`Stop ${typeof c.arg === 'string' ? c.arg : appId}`, 'COMPLETED');
        break;
      case 'clearState':
        await driver.resetDevice?.();
        step(`Clear state of ${typeof c.arg === 'string' ? c.arg : appId}`, 'COMPLETED');
        break;
      case 'openLink': {
        const link = typeof c.arg === 'string' ? c.arg : String((c.arg as Record<string, unknown>)?.link ?? '');
        if (!link) return fail('Open link', 'openLink needs a link, for example openLink: ${APP_URL}.');
        // in the lab, the project's link (Expo Go's exp://… or ${APP_URL}) opens the project on the phone
        await driver.rerun();
        step(`Open ${link}`, 'COMPLETED');
        break;
      }
      case 'tapOn': {
        const s = selectorOf(c.arg);
        if (typeof s === 'string') return fail('Tap on', s);
        const sel = { ...s, text: s.text === undefined ? undefined : sub(s.text) };
        const text = `Tap on ${sel.optional ? '(Optional) ' : ''}${label(sel)}`;
        let pressed = false;
        const ok = await until(driver, async () => (pressed = await driver.press(queryOf(sel))) || (await visible(sel)), sel.optional ? optionalWait : find);
        if (ok) {
          // a text that is shown but is no button: Maestro taps it anyway (nothing happens)
          if (!pressed) await driver.wait(100);
          step(text, 'COMPLETED');
          await driver.wait(250);
        } else if (sel.optional) step(text, 'WARNED', `Warning: ${notFound(sel)}`);
        else return fail(text, notFound(sel));
        break;
      }
      case 'assertVisible':
      case 'assertNotVisible': {
        const s = selectorOf(c.arg);
        if (typeof s === 'string') return fail(c.command, s);
        const sel = { ...s, text: s.text === undefined ? undefined : sub(s.text) };
        const want = c.command === 'assertVisible';
        const text = `Assert that ${label(sel)} is ${want ? '' : 'not '}visible`;
        const ok = await until(driver, async () => (await visible(sel)) === want, sel.optional ? optionalWait : find);
        if (ok) step(text, 'COMPLETED');
        else if (sel.optional) step(text, 'WARNED', `Warning: Assertion is false: ${label(sel)} is ${want ? '' : 'not '}visible`);
        else return fail(text, `Assertion is false: ${label(sel)} is ${want ? '' : 'not '}visible`);
        break;
      }
      case 'extendedWaitUntil': {
        const o = (c.arg ?? {}) as Record<string, unknown>;
        const target = o.visible ?? o.notVisible;
        if (target === undefined) return fail('Wait until', 'extendedWaitUntil needs visible: … or notVisible: …, and a timeout.');
        const s = selectorOf(target);
        if (typeof s === 'string') return fail('Wait until', s);
        const sel = { ...s, text: s.text === undefined ? undefined : sub(s.text) };
        const want = o.visible !== undefined;
        const timeout = Math.min(Number(o.timeout ?? 10000), maxWait);
        const text = `Assert that ${label(sel)} is ${want ? '' : 'not '}visible`;
        if (await until(driver, async () => (await visible(sel)) === want, timeout)) step(text, 'COMPLETED');
        else return fail(text, `Assertion is false: ${label(sel)} is ${want ? '' : 'not '}visible`);
        break;
      }
      case 'inputText': {
        const value = sub(String(typeof c.arg === 'object' && c.arg ? ((c.arg as Record<string, unknown>).text ?? '') : (c.arg ?? '')));
        if (!(await driver.type({}, value))) return fail(`Input text ${value}`, 'There is no text field on the screen to type into.');
        step(`Input text ${value}`, 'COMPLETED');
        break;
      }
      case 'eraseText':
        await driver.type({}, '');
        step('Erase text', 'COMPLETED');
        break;
      case 'takeScreenshot':
        step(`Take screenshot ${typeof c.arg === 'string' ? c.arg : 'screenshot'}`, 'COMPLETED');
        break;
      case 'waitForAnimationToEnd':
        await driver.wait(400);
        step('Wait for animation to end', 'COMPLETED');
        break;
      case 'hideKeyboard':
        step('Hide Keyboard', 'COMPLETED');
        break;
      default:
        return fail(c.command, `${c.command} is not available on the lab's phone. It can run: ${SUPPORTED.join(', ')}.`);
    }
  }
  return { ok: true, name, steps };
}

/** The run as Maestro prints it in a terminal. */
export function flowLines(r: FlowResult, device = 'BUENOVA phone'): { text: string; tone: 'pass' | 'fail' | 'warn' | 'dim' | '' }[] {
  if (r.error) return [{ text: r.error, tone: 'fail' }];
  const out: { text: string; tone: 'pass' | 'fail' | 'warn' | 'dim' | '' }[] = [{ text: `Running on ${device}`, tone: 'dim' }, { text: ` > Flow ${r.name}`, tone: '' }];
  for (const s of r.steps) {
    out.push({ text: `${s.text}... ${s.status}`, tone: s.status === 'COMPLETED' ? 'pass' : s.status === 'WARNED' ? 'warn' : 'fail' });
    if (s.detail) out.push({ text: s.status === 'FAILED' ? `\n${s.detail}` : ` ${s.detail}`, tone: s.status === 'FAILED' ? 'fail' : 'warn' });
  }
  return out;
}
