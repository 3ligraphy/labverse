/** Search across the workspace, with replace. */
import { basename, clear, debounce, dirname, escapeRe, h, icon } from '../core/dom';
import { isBinaryPath, type WorkspaceFS } from '../core/fs';
import { fileIcon, type Editors } from './editors';
import { confirmBox, notify } from './widgets';

type Match = { line: number; col: number; len: number; text: string };

export class SearchView {
  readonly el: HTMLElement;
  private q = h('input', { class: 'ide-input', type: 'text', placeholder: 'Search', spellcheck: false, 'aria-label': 'Search' });
  private r = h('input', { class: 'ide-input', type: 'text', placeholder: 'Replace', spellcheck: false, 'aria-label': 'Replace' });
  private inc = h('input', { class: 'ide-input', type: 'text', placeholder: 'files to include (e.g. src, .ts)', spellcheck: false });
  private exc = h('input', { class: 'ide-input', type: 'text', placeholder: 'files to exclude (e.g. dist, .min.js)', spellcheck: false });
  private opts = { case: false, word: false, regex: false };
  private info = h('p', { class: 'ide-search-info' });
  private out = h('div', { class: 'ide-search-results' });
  private results = new Map<string, Match[]>();
  private closed = new Set<string>();

  constructor(private fs: WorkspaceFS, private editors: Editors) {
    const toggle = (key: keyof typeof this.opts, label: string, title: string) => {
      const b = h('button', { class: 'ide-toggle', type: 'button', title, 'aria-pressed': 'false' }, label);
      b.addEventListener('click', () => { this.opts[key] = !this.opts[key]; b.setAttribute('aria-pressed', String(this.opts[key])); void this.run(); });
      return b;
    };
    const go = debounce(() => void this.run(), 250);
    for (const i of [this.q, this.inc, this.exc]) i.addEventListener('input', go);
    this.q.addEventListener('keydown', (e) => { if (e.key === 'Enter') void this.run(); });
    this.r.addEventListener('keydown', (e) => { if (e.key === 'Enter') void this.replaceAll(); });
    this.el = h('div', { class: 'ide-search' },
      h('div', { class: 'ide-search-box' },
        h('div', { class: 'ide-search-line' }, this.q, toggle('case', 'Aa', 'Match Case'), toggle('word', 'ab', 'Match Whole Word'), toggle('regex', '.*', 'Use Regular Expression')),
        h('div', { class: 'ide-search-line' }, this.r, h('button', { class: 'ide-icon-btn', type: 'button', title: 'Replace All', onclick: () => void this.replaceAll() }, icon('replace-all'))),
        this.inc, this.exc),
      this.info, this.out);
  }
  focus(text?: string) { if (text) { this.q.value = text; void this.run(); } this.q.focus(); this.q.select(); }

  private regex(): RegExp | null {
    const raw = this.q.value;
    if (!raw) return null;
    try {
      let src = this.opts.regex ? raw : escapeRe(raw);
      if (this.opts.word) src = `\\b(?:${src})\\b`;
      return new RegExp(src, this.opts.case ? 'g' : 'gi');
    } catch { return null; }
  }
  private wanted(path: string) {
    const terms = (s: string) => s.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
    const p = path.toLowerCase();
    const inc = terms(this.inc.value);
    if (inc.length && !inc.some((t) => p.includes(t))) return false;
    return !terms(this.exc.value).some((t) => p.includes(t));
  }
  private async textOf(path: string) { return this.editors.getModelIfOpen(path)?.getValue() ?? (await this.fs.readText(path)); }

  private seq = 0;
  async run() {
    const mine = ++this.seq;
    this.results.clear();
    const re = this.regex();
    if (!re) { this.info.textContent = this.q.value ? 'That regular expression is not valid.' : ''; clear(this.out); return; }
    this.info.textContent = 'Searching…';
    let total = 0;
    for (const path of await this.fs.walk('/')) {
      if (mine !== this.seq) return;
      if (isBinaryPath(path) || !this.wanted(path)) continue;
      let text: string;
      try { text = await this.textOf(path); } catch { continue; }
      if (text.length > 2_000_000) continue;
      const found: Match[] = [];
      const lines = text.split('\n');
      for (let i = 0; i < lines.length && total < 5000; i++) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(lines[i])) && total < 5000) {
          if (!m[0].length) { re.lastIndex++; continue; }
          found.push({ line: i + 1, col: m.index + 1, len: m[0].length, text: lines[i] });
          total++;
        }
      }
      if (found.length) this.results.set(path, found);
    }
    if (mine !== this.seq) return;
    this.info.textContent = total ? `${total}${total >= 5000 ? '+' : ''} result${total === 1 ? '' : 's'} in ${this.results.size} file${this.results.size === 1 ? '' : 's'}` : 'No results found.';
    this.paint();
  }

  private paint() {
    clear(this.out);
    for (const [path, matches] of this.results) {
      const shut = this.closed.has(path);
      const head = h('div', { class: 'ide-row ide-search-file', title: path },
        icon(shut ? 'chevron-right' : 'chevron-down', 'ide-twist'), fileIcon(path), h('span', { class: 'ide-row-name' }, basename(path)),
        h('span', { class: 'ide-row-dir' }, dirname(path) === '/' ? '' : dirname(path).slice(1)), h('span', { class: 'ide-count' }, String(matches.length)));
      head.addEventListener('click', () => { if (shut) this.closed.delete(path); else this.closed.add(path); this.paint(); });
      this.out.append(head);
      if (shut) continue;
      for (const m of matches) {
        const start = Math.max(0, m.col - 1 - 30);
        const row = h('div', { class: 'ide-row ide-search-hit', title: `Line ${m.line}` },
          h('span', { class: 'ide-hit-text' }, (start ? '…' : '') + m.text.slice(start, m.col - 1), h('mark', null, m.text.slice(m.col - 1, m.col - 1 + m.len)), m.text.slice(m.col - 1 + m.len, m.col + m.len + 120)));
        row.addEventListener('click', () => void this.editors.openFile(path, { line: m.line, column: m.col, endColumn: m.col + m.len, preview: true }));
        this.out.append(row);
      }
    }
  }

  async replaceAll() {
    const re = this.regex();
    if (!re || !this.results.size) return;
    const total = [...this.results.values()].reduce((n, m) => n + m.length, 0);
    const ok = await confirmBox(`Replace ${total} occurrence${total === 1 ? '' : 's'} across ${this.results.size} file${this.results.size === 1 ? '' : 's'} with "${this.r.value}"?`, 'Files are saved after replacing.', ['Replace']);
    if (!ok) return;
    const withText = this.opts.regex ? this.r.value : this.r.value.replace(/\$/g, '$$$$');
    for (const path of this.results.keys()) {
      const model = this.editors.getModelIfOpen(path);
      const next = (await this.textOf(path)).replace(re, withText);
      if (model) { model.pushEditOperations([], [{ range: model.getFullModelRange(), text: next }], () => null); await this.editors.save(path, true); }
      else await this.fs.write(path, next);
    }
    notify(`Replaced ${total} occurrence${total === 1 ? '' : 's'}.`);
    await this.run();
  }
}
