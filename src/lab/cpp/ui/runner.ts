/**
 * The C++ workbench: an editor next to the "machine" — every variable as a labelled box, the keyboard buffer cin
 * reads from, and the console. Run it, or Step through it line by line (and Back). Graded exercises add Check,
 * a checklist and hints that open one at a time. Also used read-only to replay a "predict" question.
 */
import { EditorState, StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection, type DecorationSet } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { lintGutter, setDiagnostics } from '@codemirror/lint';
import { labHighlight } from '../../ui/highlight.ts';
import { labEditorTheme } from '../../ui/editor.ts';
import { h, md } from '../../ui/dom.ts';
import { compile, Machine, literal, type Cell, type Diag } from '../index.ts';
import type { CppCheck } from '../checks.ts';
import { gradeCpp } from '../grade.ts';
import { cppLanguage, highlightLines } from './syntax.ts';

/* ------------------------------------------------------------ the machine view */

const showChar = (c: string) => (c === '\n' ? '⏎' : c === ' ' ? '·' : c === '\t' ? '⇥' : c);

/** memory boxes: one per variable (strings as indexed cells) */
export function renderMemory(box: HTMLElement, m: Machine | null, emptyText = 'Variables appear here when they are declared.') {
  const cells = m?.vars() ?? [];
  if (!cells.length) { box.replaceChildren(h('p', { class: 'cx-empty' }, emptyText)); return; }
  box.replaceChildren(...cells.map((c) => cellBox(c, m!)));
}

function cellBox(c: Cell, m: Machine) {
  const fresh = c.changed === m.tick;
  const mark = m.lastStr && m.lastStr.name === c.name ? m.lastStr : null;
  const readMark = m.lastRead && m.lastRead.name === c.name;
  let val: HTMLElement;
  if (!c.init) val = h('span', { class: 'cx-val cx-unset', title: 'Declared but no value yet — reading it is an error' }, '?');
  else if (c.vt === 'string') {
    const s = String(c.value.v);
    const from = mark?.from ?? -1;
    const len = mark?.op === 'find' || mark?.op === 'rfind' ? (mark.hit !== undefined && mark.hit >= 0 ? mark.len ?? 1 : 0) : mark?.len ?? 0;
    val = h('span', { class: 'cx-str-cells', 'aria-label': `"${s}"` },
      ...[...s].map((ch, i) => h('span', { class: `cx-sc${i >= from && i < from + len ? ' is-hit' : ''}${mark?.op === 'length' ? ' is-len' : ''}` },
        h('b', null, showChar(ch)), h('i', null, String(i)))),
      s.length === 0 ? h('span', { class: 'cx-sc is-empty' }, h('b', null, '""')) : null);
  } else if (c.vt === 'char') {
    val = h('span', { class: 'cx-val' }, literal(c.value), h('small', { class: 'cx-code' }, String(((Number(c.value.v) % 256) + 256) % 256)));
  } else val = h('span', { class: 'cx-val' }, literal(c.value));
  const note = mark && (mark.op === 'find' || mark.op === 'rfind') ? (mark.hit !== undefined && mark.hit >= 0 ? `${mark.op}("${mark.query}") → ${mark.hit}` : `${mark.op}("${mark.query}") → npos (not found)`)
    : mark?.op === 'substr' ? `substr → [${mark.from}, ${(mark.from ?? 0) + (mark.len ?? 0)})` : mark?.op === 'index' || mark?.op === 'at' ? `[${mark.from}]` : mark?.op === 'length' ? `length() → ${String(c.value.v).length}` : '';
  return h('div', { class: `cx-box${fresh ? ' is-new' : ''}${readMark ? ' is-read' : ''}${c.isConst ? ' is-const' : ''}`, 'data-type': c.vt },
    h('span', { class: 'cx-box-type mono' }, c.decl),
    h('span', { class: 'cx-box-name mono' }, c.name),
    val,
    note ? h('span', { class: 'cx-box-note mono' }, note) : null);
}

/** the keyboard buffer: what was typed, what cin has already taken, and what it just read */
export function renderBuffer(box: HTMLElement, m: Machine | null) {
  if (!m || !m.input) { box.replaceChildren(h('p', { class: 'cx-empty' }, 'Nothing typed yet. cin waits here for the keyboard.')); return; }
  const from = m.lastRead?.from ?? -1, to = m.lastRead?.to ?? -1;
  box.replaceChildren(...[...m.input].map((ch, i) => h('span', {
    class: `cx-kb${i < m.pos ? ' is-used' : ''}${i >= from && i < to ? ' is-read' : ''}${i === m.pos ? ' is-next' : ''}`,
    title: ch === '\n' ? 'Enter (newline)' : ch === ' ' ? 'space' : ch,
  }, showChar(ch))));
}

/** the console: printed text, typed input, notes, and an input line while cin waits */
export function renderConsole(box: HTMLElement, m: Machine | null, onType?: (text: string) => void, placeholder = 'Type here, then Enter') {
  const kids: Node[] = [];
  for (const s of m?.segs ?? []) kids.push(h('span', { class: `cx-seg cx-seg-${s.kind}` }, s.text));
  if (m?.status === 'input' && onType) {
    const input = h('input', { class: 'cx-stdin mono', type: 'text', 'aria-label': 'Keyboard input for the program', placeholder, spellcheck: 'false', autocomplete: 'off' }) as HTMLInputElement;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); onType(input.value); } });
    kids.push(input);
    queueMicrotask(() => input.focus({ preventScroll: true }));
  }
  if (m?.status === 'done') kids.push(h('span', { class: 'cx-seg cx-seg-end' }, `\n— program finished (return ${m.exit}) —`));
  if (!kids.length) kids.push(h('span', { class: 'cx-empty' }, 'Output appears here.'));
  box.replaceChildren(...kids);
  box.scrollTop = box.scrollHeight;
}

/* ------------------------------------------------------------ editor helpers */

const setLine = StateEffect.define<{ line: number; kind: 'cur' | 'err' } | null>();
const lineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setLine)) continue;
      if (!e.value || e.value.line < 1 || e.value.line > tr.state.doc.lines) deco = Decoration.none;
      else deco = Decoration.set([Decoration.line({ class: e.value.kind === 'err' ? 'cx-line-err' : 'cx-line-cur' }).range(tr.state.doc.line(e.value.line).from)]);
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/* ------------------------------------------------------------ the workbench */

export type RunnerOpts = {
  id: string;
  starter: string;
  /** typed for the student when the program asks (one line per Enter) */
  input?: string;
  checks?: CppCheck[];
  hints?: string[];
  paste?: boolean;
  /** replay mode: code can't be edited (predict questions, puzzles) */
  readOnly?: boolean;
  /** start straight in step mode (replays) */
  autoStep?: boolean;
  /** a predict snippet wrapped in main(): editor lines are shifted by this many */
  lineOffset?: number;
  onCheck?: (passed: number, total: number, code: string) => void;
};

const store = {
  get(id: string): { code?: string; solved?: boolean; hints?: number } { try { return JSON.parse(localStorage.getItem(`cpp:${id}`) ?? '{}'); } catch { return {}; } },
  set(id: string, patch: Record<string, unknown>) { try { localStorage.setItem(`cpp:${id}`, JSON.stringify({ ...store.get(id), ...patch })); } catch { /* storage off */ } },
};

export class CppRunner {
  private view: EditorView;
  private m: Machine | null = null;
  private mode: 'idle' | 'run' | 'step' = 'idle';
  private preset: string[] = [];
  /** the replay log for Back: each press of Next line (a mark), the statements it ran, and what was typed */
  private log: ({ step: true } | { feed: string } | { mark: true })[] = [];
  /** the line the current press of Next line started on */
  private from = 0;
  private els: Record<'mem' | 'kb' | 'con' | 'msg' | 'checks' | 'hint' | 'status', HTMLElement>;
  private btn: Record<'run' | 'step' | 'back' | 'end' | 'check' | 'reset', HTMLButtonElement | null>;
  private usesInput: boolean;

  constructor(host: HTMLElement, private opts: RunnerOpts) {
    const saved = opts.readOnly ? {} : store.get(opts.id);
    const graded = Boolean(opts.checks?.length);
    this.usesInput = /\bcin\b|getline/.test(opts.starter) || Boolean(opts.input);
    const b = (cls: string, label: string, title: string, on: () => void) => h('button', { type: 'button', class: `cx-btn ${cls}`, title, onclick: on }, label) as HTMLButtonElement;
    this.btn = {
      run: b('cx-run', '▶ Run', 'Run the whole program', () => this.run()),
      step: b('cx-step', '⏭ Step', 'Run one line, then pause', () => this.step()),
      back: b('cx-back', '◀ Back', 'Go back one step', () => this.back()),
      end: b('cx-end', '⏩ To the end', 'Run the rest', () => this.toEnd()),
      check: graded ? b('cx-check btn-primary', '✓ Check', 'Test your program against the task', () => this.check()) : null,
      reset: opts.readOnly ? null : b('cx-reset', '⟲', 'Start again from the original code', () => this.reset()),
    };
    this.els = {
      mem: h('div', { class: 'cx-mem', 'aria-live': 'polite' }),
      kb: h('div', { class: 'cx-kbuf mono', 'aria-label': 'Keyboard buffer' }),
      con: h('pre', { class: 'cx-con mono', role: 'log', 'aria-live': 'polite', 'aria-label': 'Console output' }),
      msg: h('div', { class: 'cx-msg', role: 'status' }),
      checks: h('ul', { class: 'cx-checks' }),
      hint: h('div', { class: 'cx-hints' }),
      status: h('span', { class: 'cx-state mono' }),
    };

    const editorHost = h('div', { class: 'cx-editor' });
    const exts: Extension[] = [
      lineNumbers({ formatNumber: (n) => String(Math.max(1, n)) }),
      history(), drawSelection(), indentOnInput(), indentUnit.of('    '), EditorState.tabSize.of(4), bracketMatching(), closeBrackets(), highlightActiveLine(),
      cppLanguage, syntaxHighlighting(labHighlight), lintGutter(), lineField, labEditorTheme,
      keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab, { key: 'Mod-Enter', run: () => { this.run(); return true; } }]),
      EditorState.readOnly.of(Boolean(opts.readOnly)), EditorView.editable.of(!opts.readOnly),
      EditorView.contentAttributes.of({ 'aria-label': 'C++ code editor', spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off' }),
      EditorView.updateListener.of((u) => {
        if (!u.docChanged) return;
        if (this.mode !== 'idle') this.stop();
        if (!opts.readOnly) store.set(opts.id, { code: u.state.doc.toString() });
      }),
    ];
    if (opts.paste === false) {
      exts.push(EditorView.domEventHandlers({
        paste: (e) => { e.preventDefault(); this.say('Type it yourself — in the lab and the lab test, pasting is not allowed. Typing it is how your hands learn C++.', 'warn'); return true; },
        drop: (e) => { e.preventDefault(); return true; },
      }));
    }
    this.view = new EditorView({ parent: editorHost, state: EditorState.create({ doc: saved.code ?? opts.starter, extensions: exts }) });

    const toolbar = h('div', { class: 'cx-bar' }, this.btn.run, this.btn.step, this.btn.back, this.btn.end, h('span', { class: 'cx-grow' }), this.els.status, this.btn.check, this.btn.reset);
    const panes = h('div', { class: 'cx-panes' },
      h('section', { class: 'cx-pane cx-pane-mem' }, h('p', { class: 'cx-pane-k mono' }, 'Memory'), this.els.mem),
      this.usesInput ? h('section', { class: 'cx-pane cx-pane-kb' }, h('p', { class: 'cx-pane-k mono' }, 'Keyboard buffer', h('small', null, ' what cin reads from')), this.els.kb) : null,
      h('section', { class: 'cx-pane cx-pane-con' }, h('p', { class: 'cx-pane-k mono' }, 'Console'), this.els.con));
    host.replaceChildren(h('div', { class: 'cx-wb' }, toolbar, h('div', { class: 'cx-grid' }, editorHost, panes), this.els.msg, graded ? this.els.checks : null, opts.hints?.length ? this.els.hint : null));
    this.btn.back!.hidden = true;
    this.btn.end!.hidden = true;
    if (graded) this.renderChecks(null);
    if (opts.hints?.length) this.renderHints(saved.hints ?? 0);
    if (saved.solved) this.say('✓ Solved — every check passes. You can keep experimenting.', 'ok');
    this.render();
    if (opts.autoStep) this.step();
  }

  get code() { return this.view.state.doc.toString(); }
  private offset = () => this.opts.lineOffset ?? 0;
  private source = () => this.code;

  private say(text: string, tone: 'ok' | 'err' | 'warn' | 'info' = 'info', hint?: string) {
    this.els.msg.className = `cx-msg is-${tone}`;
    this.els.msg.replaceChildren(h('p', { html: md(text) }), ...(hint ? [h('p', { class: 'cx-hint', html: md(hint) })] : []));
  }

  private mark(line: number | null, kind: 'cur' | 'err' = 'cur') {
    const l = line === null ? null : line - this.offset();
    this.view.dispatch({ effects: setLine.of(l === null || l < 1 ? null : { line: l, kind }) });
    if (l && l >= 1 && l <= this.view.state.doc.lines) {
      const pos = this.view.state.doc.line(l).from;
      this.view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'nearest' }) });
    }
  }

  private build(): Machine | null {
    const c = compile(this.source());
    const diags: Diag[] = c.ok ? c.warnings : [...c.errors, ...c.warnings];
    const doc = this.view.state.doc;
    this.view.dispatch(setDiagnostics(this.view.state, diags.filter((d) => d.line - this.offset() >= 1 && d.line - this.offset() <= doc.lines).map((d) => {
      const line = doc.line(d.line - this.offset());
      return { from: line.from, to: line.to, severity: d.severity, message: `${d.message}${d.hint ? ` ${d.hint}` : ''}` };
    })));
    if (!c.ok) {
      const e = c.errors[0];
      this.mark(e.line, 'err');
      const where = e.line - this.offset() >= 1 ? `Line ${e.line - this.offset()}: ` : '';
      this.say(`**Build failed** — ${where}${e.message}${c.errors.length > 1 ? ` (and ${c.errors.length - 1} more)` : ''}`, 'err', e.hint ? `${e.hint}${e.code ? `  ·  ${e.code}` : ''}` : e.code);
      return null;
    }
    if (c.warnings.length) {
      const w = c.warnings[0];
      this.say(`⚠ Warning, line ${w.line - this.offset()}: ${w.message}`, 'warn', w.hint);
    } else this.els.msg.replaceChildren();
    this.preset = (this.opts.input ?? '').split(/\r?\n/).filter((l, i, all) => l.length || i < all.length - 1);
    this.log = [];
    return new Machine(c.program, { interactive: true });
  }

  /** feeds the preset input line when the program waits for it */
  private autoFeed(): boolean {
    if (this.m?.status !== 'input' || !this.preset.length) return false;
    const line = this.preset.shift()!;
    this.m.feed(line);
    this.log.push({ feed: line });
    return true;
  }

  private type = (text: string) => {
    if (!this.m) return;
    this.m.feed(text);
    this.log.push({ feed: text });
    if (this.mode === 'run') { this.run(true); return; }
    // step mode: finish the cin line that was waiting, then pause before the next line
    this.advance(true);
    this.after();
  };

  /** run one statement, and keep going while the program is still on the line it started from
      (so cin >> a; cin >> b; on one line is one press, like the button says) */
  private advance(first: boolean) {
    const m = this.m!;
    for (let n = 0; n < 5000; n++) {
      if (!first || n > 0) {
        if (m.status !== 'running' || m.line !== this.from) return;
      }
      m.step();
      this.log.push({ step: true });
      // a cin line with typed-in input finishes in the same press (the boxes fill)
      while (m.status === 'input' && this.autoFeed()) {
        m.step();
        this.log.push({ step: true });
      }
    }
  }

  run(resume = false) {
    if (!resume || !this.m) { this.m = this.build(); if (!this.m) { this.render(); return; } }
    this.mode = 'run';
    for (;;) {
      this.m.run();
      if (!this.autoFeed()) break;
    }
    this.after();
  }

  step(resume = false) {
    if (!resume && (!this.m || this.mode !== 'step' || this.m.status === 'done' || this.m.status === 'error')) {
      this.m = this.build();
      if (!this.m) { this.render(); return; }
      this.mode = 'step';
    }
    if (!this.m) return;
    if (!resume) {
      if (this.m.status === 'input' && !this.autoFeed()) { this.render(); return; }
      this.from = this.m.line;
      this.log.push({ mark: true });
      this.advance(true);
    }
    this.after();
  }

  private back() {
    if (this.mode !== 'step' || !this.log.length) return;
    const log = [...this.log];
    // drop the last press of Next line: its statements and anything typed during it
    while (log.length && !('mark' in log[log.length - 1])) log.pop();
    log.pop();
    this.m = this.build();
    if (!this.m) return;
    this.mode = 'step';
    for (const a of log) {
      if ('step' in a) this.m.step();
      else if ('feed' in a) { this.m.feed(a.feed); this.preset.shift(); }
      this.log.push(a);
    }
    this.after();
  }

  private toEnd() {
    if (!this.m) return;
    this.mode = 'run';
    this.run(true);
  }

  private stop() {
    this.m = null;
    this.mode = 'idle';
    this.mark(null);
    this.render();
  }

  private after() {
    const m = this.m!;
    if (m.status === 'error') {
      this.mark(m.error!.line, 'err');
      const l = m.error!.line - this.offset();
      this.say(`**The program crashed**${l >= 1 ? ` on line ${l}` : ''} — ${m.error!.message}`, 'err', m.error!.hint);
    } else if (this.mode === 'step') this.mark(m.status === 'done' ? null : m.line);
    else this.mark(null);
    this.render();
  }

  private render() {
    const m = this.m;
    renderMemory(this.els.mem, m);
    if (this.usesInput) renderBuffer(this.els.kb, m);
    renderConsole(this.els.con, m, this.type);
    const stepping = this.mode === 'step' && m && m.status !== 'done' && m.status !== 'error';
    this.btn.back!.hidden = !(this.mode === 'step' && this.log.some((a) => 'step' in a));
    this.btn.end!.hidden = !stepping;
    this.btn.step!.textContent = stepping ? '⏭ Next line' : '⏭ Step';
    this.els.status.textContent = !m ? '' : m.status === 'input' ? 'waiting for the keyboard…' : m.status === 'done' ? 'finished' : m.status === 'error' ? 'crashed' : this.mode === 'step' ? `paused before line ${m.line - this.offset()}` : '';
  }

  private renderChecks(outcome: ReturnType<typeof gradeCpp> | null) {
    const checks = this.opts.checks ?? [];
    this.els.checks.replaceChildren(...checks.map((c, i) => {
      const r = outcome?.results[i];
      return h('li', { class: `cx-ck${r ? (r.pass ? ' is-pass' : ' is-fail') : ''}` },
        h('span', { class: 'cx-ck-ico', 'aria-hidden': 'true' }, r ? (r.pass ? '✓' : '✗') : '○'),
        h('span', null, c.name, r?.message ? h('small', { html: md(r.message) }) : null));
    }));
  }

  private check() {
    const code = this.code;
    const outcome = gradeCpp(code, this.opts.checks ?? []);
    this.renderChecks(outcome);
    const passed = outcome.results.filter((r) => r.pass).length;
    const total = outcome.results.length;
    if (outcome.compileError) {
      const e = outcome.compileError;
      this.mark(e.line, 'err');
      this.say(`**Build failed** — Line ${e.line}: ${e.message}`, 'err', e.hint);
    } else if (passed === total) {
      store.set(this.opts.id, { solved: true });
      this.say(`✓ **All ${total} checks pass.** Well done — run it once more and read your output like a user would.`, 'ok');
    } else this.say(`${passed} of ${total} checks pass. Read the first ✗ below, fix one thing, and check again.`, 'warn');
    this.opts.onCheck?.(passed, total, code);
  }

  private renderHints(open: number) {
    const hints = this.opts.hints ?? [];
    const shown = hints.slice(0, open).map((t, i) => h('p', { class: 'cx-hint-i', html: md(`**Hint ${i + 1}.** ${t}`) }));
    const more = open < hints.length
      ? h('button', { type: 'button', class: 'cx-btn cx-hint-btn', onclick: () => { store.set(this.opts.id, { hints: open + 1 }); this.renderHints(open + 1); } }, open ? `Another hint (${open + 1}/${hints.length})` : `Stuck? Open a hint (1/${hints.length})`)
      : null;
    this.els.hint.replaceChildren(...shown, more ?? h('p', { class: 'cx-empty' }, 'That’s every hint — the rest is yours. Try a small change and Step through it.'));
  }

  private reset() {
    if (this.code !== this.opts.starter && !confirm('Start again from the original code? Your changes will be lost.')) return;
    this.view.dispatch({ changes: { from: 0, to: this.view.state.doc.length, insert: this.opts.starter } });
    store.set(this.opts.id, { code: this.opts.starter });
    this.stop();
    this.els.msg.replaceChildren();
    if (this.opts.checks?.length) this.renderChecks(null);
  }

  destroy() { this.view.destroy(); }
}
