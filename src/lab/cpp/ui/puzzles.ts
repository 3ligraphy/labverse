/**
 * Read-before-write activities: "Predict, then run" (choose what the code does, then run or step through it to
 * see the truth) and "Order the lines" (a Parsons puzzle: arrange the code cards, then run your order).
 */
import { h, md, shuffle } from '../../ui/dom.ts';
import { clearPick, draggable, dropPicked } from '../../ui/dnd.ts';
import { compile, Machine } from '../index.ts';
import { highlightCpp, highlightLines } from './syntax.ts';
import { CppRunner } from './runner.ts';

export type Track = (passed: number, total: number, code: string) => void;

const HEAD = '#include <iostream>\n#include <string>\n#include <cmath>\n#include <algorithm>\nusing namespace std;\n\nint main() {\n';
/** a snippet of statements → a whole program (and how many lines were added on top) */
export function wrapProgram(code: string): { src: string; offset: number } {
  if (/\b(int|void)\s+main\s*\(/.test(code)) return { src: code, offset: 0 };
  const body = code.replace(/\s+$/, '').split('\n').map((l) => (l ? `    ${l}` : l)).join('\n');
  return { src: `${HEAD}${body}\n    return 0;\n}\n`, offset: HEAD.split('\n').length - 1 };
}

const store = {
  get(id: string): Record<string, unknown> { try { return JSON.parse(localStorage.getItem(`cpp:${id}`) ?? '{}'); } catch { return {}; } },
  set(id: string, patch: Record<string, unknown>) { try { localStorage.setItem(`cpp:${id}`, JSON.stringify({ ...store.get(id), ...patch })); } catch { /* storage off */ } },
};

const codeBlock = (code: string) => {
  const lines = highlightLines(code.replace(/\s+$/, ''));
  return h('pre', { class: 'cx-static mono' }, h('code', null, ...lines.map((l, i) => h('span', { class: 'cx-sl', 'data-n': String(i + 1), html: l || ' ' }))));
};

const inputChip = (input: string) => (input.trim()
  ? h('p', { class: 'cx-typed mono' }, h('span', null, 'The user types: '), ...input.split(/\r?\n/).filter(Boolean).map((l) => h('kbd', null, `${l} ⏎`)))
  : null);

/* ----------------------------------------------------------------- predict */

export type PredictCfg = { id: string; questionHtml: string; code: string; input: string; options: { text: string; correct: boolean }[]; explainHtml: string; trace: boolean };

export function mountPredict(host: HTMLElement, cfg: PredictCfg, track: Track) {
  const saved = store.get(cfg.id) as { pick?: number; solved?: boolean };
  let pick: number | null = saved.solved ? saved.pick ?? null : null;
  let tries = 0;
  const letters = 'ABCDEFGH';
  const opts = h('div', { class: 'cx-opts', role: 'radiogroup', 'aria-label': 'Your prediction' });
  const result = h('p', { class: 'cx-pred-res', role: 'status' });
  const explain = h('div', { class: 'cx-explain', html: cfg.explainHtml });
  explain.hidden = true;
  const replay = h('div', { class: 'cx-replay' });
  replay.hidden = true;
  const lock = h('button', { type: 'button', class: 'btn btn-primary btn-sm' }, 'Check my answer') as HTMLButtonElement;
  const runBtn = h('button', { type: 'button', class: 'cx-btn' }, cfg.trace ? '⏭ Step through it' : '▶ Run it') as HTMLButtonElement;
  runBtn.hidden = true;
  let runner: CppRunner | null = null;

  const renderOpts = (locked: boolean) => {
    opts.replaceChildren(...cfg.options.map((o, i) => {
      const chosen = pick === i;
      const state = locked && chosen ? (o.correct ? ' is-right' : ' is-wrong') : '';
      return h('button', {
        type: 'button', role: 'radio', 'aria-checked': String(chosen), class: `cx-opt${chosen ? ' is-chosen' : ''}${state}`, disabled: locked && saved.solved ? true : undefined,
        onclick: () => { if (saved.solved && locked) return; pick = i; renderOpts(false); result.textContent = ''; lock.disabled = false; },
      }, h('span', { class: 'cx-opt-k mono' }, letters[i]), h('span', { class: 'cx-opt-t', html: md(o.text) }));
    }));
  };

  const reveal = () => {
    explain.hidden = !cfg.explainHtml.trim();
    runBtn.hidden = false;
  };

  lock.addEventListener('click', () => {
    if (pick === null) { result.textContent = 'Choose an answer first. Make a guess, even if you are not sure.'; return; }
    tries++;
    const right = cfg.options[pick].correct;
    track(right ? 1 : 0, 1, cfg.code);
    renderOpts(true);
    if (right) {
      saved.solved = true;
      store.set(cfg.id, { pick, solved: true });
      result.className = 'cx-pred-res is-ok';
      result.textContent = tries === 1 ? '✓ Correct, first time!' : '✓ Correct.';
      lock.hidden = true;
      reveal();
    } else {
      result.className = 'cx-pred-res is-bad';
      result.textContent = tries === 1 ? '✗ Not correct. Run the code to see what really happens, then try again.' : '✗ Still not correct. Go through it line by line and watch the memory boxes.';
      lock.textContent = 'Try again';
      runBtn.hidden = false;
    }
  });

  runBtn.addEventListener('click', () => {
    replay.hidden = false;
    if (!runner) {
      const { src } = wrapProgram(cfg.code);
      runner = new CppRunner(replay, { id: `${cfg.id}--replay`, starter: src, input: cfg.input, readOnly: true, autoStep: cfg.trace });
      if (!cfg.trace) (replay.querySelector('.cx-run') as HTMLButtonElement | null)?.click();
    }
    replay.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    // the explanation stays hidden until they get it right: running shows WHAT happens, they work out WHY
    explain.hidden = !(saved.solved && cfg.explainHtml.trim());
  });

  renderOpts(Boolean(saved.solved));
  if (saved.solved) { lock.hidden = true; result.className = 'cx-pred-res is-ok'; result.textContent = '✓ You answered this one.'; reveal(); }

  host.replaceChildren(h('div', { class: 'cx-pred-body' },
    codeBlock(cfg.code), inputChip(cfg.input), opts,
    h('div', { class: 'cx-pred-bar' }, lock, runBtn, result), replay, explain));
}

/* ----------------------------------------------------------------- parsons */

export type ParsonsCfg = { id: string; code: string; input: string };

const FIXED = /^\s*(#.*|using\s+namespace\s+std\s*;|(int|void)\s+main\s*\(.*\)\s*\{?|\{|\}|return\s+0\s*;)\s*$/;

export function splitCards(code: string) {
  const blocks = code.replace(/\r/g, '').replace(/\s+$/, '').split(/\n\s*\n/).map((b) => b.replace(/^\n+|\n+$/g, ''));
  let first = 0;
  while (first < blocks.length && blocks[first].split('\n').every((l) => FIXED.test(l))) first++;
  let last = blocks.length;
  while (last > first && blocks[last - 1].split('\n').every((l) => FIXED.test(l))) last--;
  return { head: blocks.slice(0, first), cards: blocks.slice(first, last), tail: blocks.slice(last) };
}

export function mountParsons(host: HTMLElement, cfg: ParsonsCfg, track: Track) {
  const { head, cards, tail } = splitCards(cfg.code);
  const saved = store.get(cfg.id) as { order?: string[]; solved?: boolean };
  let order = saved.order && saved.order.length === cards.length && saved.order.every((c) => cards.includes(c)) ? saved.order : shuffle(cards, cfg.id);
  const list = h('ol', { class: 'cx-cards', 'aria-label': 'Code cards — put them in order' });
  const result = h('div', { class: 'cx-msg', role: 'status' });
  const replay = h('div', { class: 'cx-replay' });
  replay.hidden = true;
  const program = () => [...head, ...order, ...tail].join('\n\n');
  const reference = (() => {
    const c = compile(cfg.code);
    if (!c.ok) return null;
    const m = new Machine(c.program, { input: cfg.input ? `${cfg.input}\n` : '' });
    m.run();
    return m.printed;
  })();

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    order = next;
    store.set(cfg.id, { order });
    render(item);
  };

  const fixedView = (blocks: string[]) => blocks.length ? h('pre', { class: 'cx-fixed mono', html: blocks.map((b) => highlightCpp(b)).join('\n\n') }) : null;

  const render = (focus?: string) => {
    list.replaceChildren(...order.map((text, i) => {
      const grip = h('button', { type: 'button', class: 'cx-grip', 'aria-label': `Move card ${i + 1}` }, '⋮⋮');
      const row = h('li', { class: 'cx-card', 'data-drop': String(i), 'data-i': String(i) },
        grip,
        h('pre', { class: 'cx-card-code mono', html: highlightCpp(text) }),
        h('span', { class: 'cx-card-arrows' },
          h('button', { type: 'button', 'aria-label': 'Move up', disabled: i === 0, onclick: () => move(i, i - 1) }, '↑'),
          h('button', { type: 'button', 'aria-label': 'Move down', disabled: i === order.length - 1, onclick: () => move(i, i + 1) }, '↓')));
      row.addEventListener('click', (e) => { if (!(e.target as HTMLElement).closest('.cx-card-arrows, .cx-grip')) dropPicked(row); });
      draggable(grip, { scope: list, onDrop: (target) => move(i, Number(target.dataset.i)) });
      return row;
    }));
    if (focus) (list.children[order.indexOf(focus)]?.querySelector('.cx-grip') as HTMLElement | null)?.focus();
  };

  const say = (html: string, tone: string) => { result.className = `cx-msg is-${tone}`; result.innerHTML = html; };
  const check = () => {
    clearPick();
    const src = program();
    const c = compile(src);
    let output: string | null = null;
    let crash = '';
    if (c.ok) {
      const m = new Machine(c.program, { input: cfg.input ? `${cfg.input}\n` : '' });
      m.run();
      output = m.status === 'done' ? m.printed : null;
      crash = m.error ? m.error.message.replace(/^Run-Time Check Failure #3 – /, '') : '';
    }
    const exact = order.every((b, i) => b === cards[i]);
    const ok = exact || (output !== null && output === reference);
    const placed = order.filter((b, i) => b === cards[i]).length;
    track(ok ? 1 : 0, 1, src);
    [...list.children].forEach((li, i) => li.setAttribute('data-state', ok ? 'pass' : order[i] === cards[i] ? '' : 'fail'));
    if (ok) {
      store.set(cfg.id, { order, solved: true });
      say(md(`✓ **It works.** Your program shows exactly what it should.${exact ? '' : ' (Your order is different from ours, and it still works.)'}`), 'ok');
      replay.hidden = false;
      replay.replaceChildren();
      new CppRunner(replay, { id: `${cfg.id}--replay`, starter: src, input: cfg.input, readOnly: true });
    } else {
      const why = !c.ok ? `It does not build yet: ${c.errors[0].message}` : output === null ? `It stops with an error when it runs: ${crash}` : 'It runs, but what it shows is not right yet.';
      say(md(`${why}\n\nCards in the right place: **${placed} of ${cards.length}**. The red cards are in the wrong place. Think about the plan (program logic): what must happen first?`), 'warn');
    }
  };

  render();
  const checkBtn = h('button', { type: 'button', class: 'btn btn-primary btn-sm' }, '✓ Check my order');
  checkBtn.addEventListener('click', check);
  host.replaceChildren(h('div', { class: 'cx-parsons' },
    h('p', { class: 'cx-how mono' }, 'Drag a card by ⋮⋮, or tap ⋮⋮ and then tap where it goes, or use ↑ ↓'),
    fixedView(head), list, fixedView(tail), inputChip(cfg.input),
    h('div', { class: 'cx-pred-bar' }, checkBtn), result, replay));
  if (saved.solved) say(md('✓ **Solved** before. You can still move the cards and check again.'), 'ok');
}
