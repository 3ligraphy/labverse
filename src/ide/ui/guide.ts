/**
 * The Guide panel: shows the project's GUIDE.md as a page of steps (course projects have one). File names in it
 * open the file; each step ("## Step …") has a Done tick that is remembered for this project.
 * The Markdown is drawn with DOM nodes only (no HTML from the file is ever inserted).
 */
import { clear, debounce, h, icon } from '../core/dom';
import type { IDE } from '../core/ide';
import { memo } from '../core/settings';
import { iconButton } from './workbench';

const GUIDE = '/GUIDE.md';
/** only "## Step …" headings get a Done tick and count in "x / y steps done"; other "##" headings are plain */
const STEP = /^step\b/i;
const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[([^\]]+)\]\(((?:[^()\s]|\([^()]*\))+)\))/g;

export function installGuide(ide: IDE) {
  const { fs, editors, wb, ws } = ide;
  const el = h('div', { class: 'ide-guide' });
  const doneKey = `guide:${ws.id}`;
  let installed = false;

  /** `code`, **bold** and [file](path) links inside one line of text. */
  const inline = (text: string): (Node | string)[] => {
    const out: (Node | string)[] = [];
    let last = 0;
    for (const m of text.matchAll(INLINE)) {
      if (m.index! > last) out.push(text.slice(last, m.index));
      if (m[1]) out.push(h('code', null, m[1].slice(1, -1)));
      else if (m[2]) out.push(h('b', null, m[2].slice(2, -2)));
      else {
        const label = m[4];
        const target = m[5];
        if (/^https?:\/\//.test(target)) out.push(h('a', { href: target, target: '_blank', rel: 'noopener noreferrer' }, label));
        else {
          const path = '/' + target.replace(/^\.?\//, '');
          out.push(h('button', { class: 'ide-guide-file', type: 'button', title: `Open ${target}`, onclick: () => void editors.openFile(path) }, icon('go-to-file'), label));
        }
      }
      last = m.index! + m[0].length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  };

  const render = (md: string) => {
    const done = new Set(memo.get<string[]>(doneKey, []));
    const root = h('div', { class: 'ide-guide-page' });
    const lines = md.replace(/\r/g, '').split('\n');
    let para: string[] = [];
    let lists: { indent: number; el: HTMLOListElement | HTMLUListElement }[] = [];
    const flushPara = () => { if (para.length) { root.append(h('p', null, inline(para.join(' ')))); para = []; } };
    const closeLists = () => { lists = []; };
    for (const raw of lines) {
      const line = raw.replace(/\s+$/, '');
      const item = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(line);
      if (!line.trim()) { flushPara(); closeLists(); continue; }
      if (/^---+$/.test(line.trim())) { flushPara(); closeLists(); root.append(h('hr')); continue; }
      const head = /^(#{1,3})\s+(.*)$/.exec(line);
      if (head) {
        flushPara(); closeLists();
        const level = head[1].length;
        const text = head[2];
        if (level === 2 && STEP.test(text)) {
          const box = h('input', { type: 'checkbox', checked: done.has(text), 'aria-label': `Mark "${text}" as done` });
          const section = h('h2', { class: done.has(text) ? 'step done' : 'step' }, h('label', null, box, h('span', null, inline(text))));
          box.addEventListener('change', () => {
            const now = new Set(memo.get<string[]>(doneKey, []));
            if (box.checked) now.add(text); else now.delete(text);
            memo.set(doneKey, [...now]);
            section.classList.toggle('done', box.checked);
            paintProgress();
          });
          root.append(section);
        } else root.append(h(level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3', null, inline(text)));
        continue;
      }
      if (item) {
        flushPara();
        const indent = item[1].length;
        const ordered = /\d/.test(item[2]);
        while (lists.length && lists[lists.length - 1].indent > indent) lists.pop();
        let cur = lists[lists.length - 1];
        if (!cur || cur.indent < indent) {
          const list = ordered ? h('ol') : h('ul');
          if (cur) (cur.el.lastElementChild ?? cur.el).append(list);
          else root.append(list);
          cur = { indent, el: list };
          lists.push(cur);
        }
        cur.el.append(h('li', null, inline(item[3])));
        continue;
      }
      if (lists.length && /^\s+\S/.test(line)) { lists[lists.length - 1].el.lastElementChild?.append(' ', ...inline(line.trim())); continue; }
      closeLists();
      para.push(line.trim());
    }
    flushPara();
    return root;
  };

  const progress = h('span', { class: 'ide-guide-progress' });
  const paintProgress = () => {
    const steps = el.querySelectorAll('h2.step').length;
    const ticked = el.querySelectorAll('h2.step.done').length;
    progress.textContent = steps ? `${ticked} / ${steps} steps done` : '';
  };

  const paint = async () => {
    if (!(await fs.exists(GUIDE))) {
      if (installed) { wb.removeSideView('guide'); installed = false; }
      return;
    }
    const md = editors.getModelIfOpen(GUIDE)?.getValue() ?? (await fs.readText(GUIDE));
    const top = el.scrollTop;
    clear(el).append(progress, render(md));
    el.scrollTop = top;
    paintProgress();
    if (!installed) {
      installed = true;
      wb.addSideView({ id: 'guide', title: 'Guide', iconName: 'book', el, order: 0, actions: () => [iconButton('go-to-file', 'Open GUIDE.md as text', () => editors.openFile(GUIDE))] });
      // the first time a project with a guide opens, the guide is what the student sees first
      if (!memo.get(`guide-seen:${ws.id}`, false)) { memo.set(`guide-seen:${ws.id}`, true); wb.showSide('guide', false); }
    }
  };
  const soon = debounce(() => void paint(), 300);
  fs.changed.on((e) => { if (e.path === GUIDE || e.to === GUIDE || e.type === 'delete') soon(); });
  editors.saved.on((p) => { if (p === GUIDE) soon(); });
  void paint();
}
