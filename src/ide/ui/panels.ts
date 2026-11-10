/** Bottom panel views: Problems (diagnostics from the language services) and Output (named channels). */
import * as monaco from 'monaco-editor';
import { basename, clear, debounce, dirname, h, icon } from '../core/dom';
import { fileIcon, pathOf, type Editors } from './editors';
import { iconButton, type Workbench } from './workbench';

export class Problems {
  readonly el = h('div', { class: 'ide-problems' });
  errors = 0;
  warnings = 0;
  /** extra diagnostics from runners (e.g. the C++ compiler), per owner */
  constructor(private wb: Workbench, private editors: Editors) {
    const paint = debounce(() => this.paint(), 150);
    monaco.editor.onDidChangeMarkers(paint);
    wb.addPanelView({ id: 'problems', title: 'Problems', el: this.el });
    this.paint();
  }
  private paint() {
    const all = monaco.editor.getModelMarkers({}).filter((m) => m.resource.scheme === 'file' && m.severity >= monaco.MarkerSeverity.Warning && !m.resource.path.includes('/node_modules/'));
    this.errors = all.filter((m) => m.severity === monaco.MarkerSeverity.Error).length;
    this.warnings = all.length - this.errors;
    this.wb.setPanelBadge('problems', all.length ? String(all.length) : '');
    this.wb.status('problems', 'left', 20, { iconName: 'error', text: `${this.errors}  ⚠ ${this.warnings}`, title: `${this.errors} errors, ${this.warnings} warnings`, onclick: () => this.wb.togglePanel('problems') });
    clear(this.el);
    if (!all.length) { this.el.append(h('p', { class: 'ide-panel-empty' }, 'No problems have been detected in the workspace.')); return; }
    const byFile = new Map<string, monaco.editor.IMarker[]>();
    for (const m of all) { const p = pathOf(m.resource); byFile.set(p, [...(byFile.get(p) ?? []), m]); }
    for (const [path, markers] of byFile) {
      this.el.append(h('div', { class: 'ide-row ide-problem-file' }, fileIcon(path), h('span', { class: 'ide-row-name' }, basename(path)), h('span', { class: 'ide-row-dir' }, dirname(path).slice(1)), h('span', { class: 'ide-count' }, String(markers.length))));
      for (const m of markers.sort((a, b) => b.severity - a.severity || a.startLineNumber - b.startLineNumber)) {
        const err = m.severity === monaco.MarkerSeverity.Error;
        const row = h('div', { class: 'ide-row ide-problem' }, icon(err ? 'error' : 'warning', err ? 'ide-err' : 'ide-warn'),
          h('span', { class: 'ide-problem-msg' }, m.message), h('span', { class: 'ide-row-dir' }, `${m.source ?? ''}${m.code ? `(${typeof m.code === 'object' ? m.code.value : m.code})` : ''} [Ln ${m.startLineNumber}, Col ${m.startColumn}]`));
        row.addEventListener('click', () => void this.editors.openFile(path, { line: m.startLineNumber, column: m.startColumn, endLine: m.endLineNumber, endColumn: m.endColumn }));
        this.el.append(row);
      }
    }
  }
}

export class Output {
  readonly el = h('div', { class: 'ide-output' });
  private pre = h('pre', { class: 'ide-output-text', tabIndex: 0 });
  private select = h('select', { class: 'ide-select', 'aria-label': 'Output channel' });
  private channels = new Map<string, string>();
  private current = 'IDE';
  constructor(private wb: Workbench) {
    this.el.append(this.pre);
    this.select.addEventListener('change', () => this.show(this.select.value, false));
    wb.addPanelView({ id: 'output', title: 'Output', el: this.el, actions: () => [this.select, iconButton('clear-all', 'Clear Output', () => { this.channels.set(this.current, ''); this.paint(); })] });
    this.append('IDE', '');
  }
  append(channel: string, text: string) {
    const fresh = !this.channels.has(channel);
    const next = ((this.channels.get(channel) ?? '') + text).slice(-400_000);
    this.channels.set(channel, next);
    if (fresh) { clear(this.select).append(...[...this.channels.keys()].map((c) => h('option', { value: c, selected: c === this.current }, c))); }
    if (channel === this.current) this.paint();
  }
  line(channel: string, text: string) { this.append(channel, text + '\n'); }
  clear(channel: string) { this.channels.set(channel, ''); if (channel === this.current) this.paint(); }
  show(channel: string, reveal = true) {
    if (!this.channels.has(channel)) this.append(channel, '');
    this.current = channel;
    this.select.value = channel;
    this.paint();
    if (reveal) this.wb.showPanel('output');
  }
  private paint() {
    const stick = this.pre.scrollTop + this.pre.clientHeight >= this.pre.scrollHeight - 30;
    this.pre.textContent = this.channels.get(this.current) ?? '';
    if (stick) this.pre.scrollTop = this.pre.scrollHeight;
  }
}
