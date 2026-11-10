/**
 * Prompt workbench: the student writes a prompt; a live "scanner" lights up each ingredient the rubric finds
 * (context, goal, constraints, …), with a strength ring, word and token counts. ▶ Check records the score.
 */
import { h, md, debounce } from '../../ui/dom.ts';
import { scorePrompt, type RubricItem } from '../core.ts';
import { store } from './store.ts';
import type { Track } from './mount.ts';

type Cfg = { id: string; starter: string; rubric: RubricItem[]; minWords: number; example: string };

export function mountPrompt(host: HTMLElement, cfg: Cfg, track: Track) {
  const saved = store.get<{ text: string; solved: boolean }>(cfg.id);
  const area = h('textarea', {
    class: 'ax-pw-input', rows: 9, spellcheck: 'true', 'aria-label': 'Your prompt', placeholder: 'Write your prompt for the coding agent…',
  }) as HTMLTextAreaElement;
  area.value = saved.text ?? cfg.starter;

  const words = h('span', { class: 'ax-pw-stat' });
  const tokens = h('span', { class: 'ax-pw-stat' });
  const ringFill = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  const ring = h('div', { class: 'ax-ring', 'aria-hidden': 'true' });
  ring.innerHTML = '<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" class="ax-ring-b"/></svg>';
  ringFill.setAttribute('cx', '60'); ringFill.setAttribute('cy', '60'); ringFill.setAttribute('r', '50');
  ringFill.setAttribute('class', 'ax-ring-f'); ringFill.setAttribute('pathLength', '100');
  ring.querySelector('svg')!.append(ringFill);
  const pct = h('b', { class: 'ax-ring-v' }, '0');
  ring.append(h('div', { class: 'ax-ring-c' }, pct, h('small', null, '%')));
  const grade = h('p', { class: 'ax-ring-k mono' }, 'SIGNAL');

  const list = h('ul', { class: 'ax-scan-list' });
  const items = cfg.rubric.map((r) => {
    const tip = h('span', { class: 'ax-scan-tip' }, r.tip);
    const li = h('li', { class: 'ax-scan-i' }, h('span', { class: 'ax-led', 'aria-hidden': 'true' }), h('span', { class: 'ax-scan-n' }, r.name), tip);
    list.append(li);
    return li;
  });
  const lenRow = cfg.minWords ? h('li', { class: 'ax-scan-i' }, h('span', { class: 'ax-led', 'aria-hidden': 'true' }), h('span', { class: 'ax-scan-n' }, `${cfg.minWords}+ words`), h('span', { class: 'ax-scan-tip' }, 'Short prompts make the agent guess. Say more.')) : null;
  if (lenRow) list.append(lenRow);

  const status = h('p', { class: 'ax-status', role: 'status', 'aria-live': 'polite' });
  const example = h('details', { class: 'ax-example' }, h('summary', null, 'Compare with an example prompt'), h('div', { class: 'ax-example-b', html: md(cfg.example) }));
  example.hidden = !(cfg.example && saved.solved);

  const update = () => {
    const s = scorePrompt(area.value, cfg.rubric, cfg.minWords);
    s.found.forEach((f, i) => items[i].classList.toggle('is-on', f));
    lenRow?.classList.toggle('is-on', s.longEnough);
    const total = s.total + (cfg.minWords ? 1 : 0);
    const got = s.passed + (cfg.minWords && s.longEnough ? 1 : 0);
    const p = Math.round((got / Math.max(1, total)) * 100);
    pct.textContent = String(p);
    ringFill.style.strokeDashoffset = String(100 - p);
    host.style.setProperty('--sig', String(p / 100));
    grade.textContent = p === 100 ? 'READY TO SEND' : p >= 60 ? 'GETTING THERE' : 'TOO VAGUE';
    words.textContent = `${s.words} words`;
    tokens.textContent = `≈ ${s.tokens} tokens`;
    return s;
  };
  const save = debounce(() => store.set(cfg.id, { text: area.value }), 400);
  area.addEventListener('input', () => { update(); save(); });

  const check = h('button', { type: 'button', class: 'ax-btn ax-btn-primary' }, '▶ Check my prompt');
  check.addEventListener('click', () => {
    const s = update();
    track(s.passed, s.total, area.value);
    if (s.solved) {
      status.className = 'ax-status is-ok';
      status.textContent = `✓ Every ingredient is there (${s.passed}/${s.total}). An agent can act on this without guessing.`;
      store.set(cfg.id, { solved: true, text: area.value });
      if (cfg.example) example.hidden = false;
    } else {
      const missing = cfg.rubric.filter((_, i) => !s.found[i]).map((r) => r.name);
      status.className = 'ax-status is-bad';
      status.textContent = `${s.passed}/${s.total} ingredients.${missing.length ? ` Still missing: ${missing.join(', ')}.` : ''}${s.longEnough ? '' : ` Write at least ${cfg.minWords} words.`}`;
    }
  });
  const reset = h('button', { type: 'button', class: 'ax-btn' }, '↺ Start over');
  reset.addEventListener('click', () => { area.value = cfg.starter; update(); store.set(cfg.id, { text: cfg.starter }); status.textContent = ''; area.focus(); });
  const copy = h('button', { type: 'button', class: 'ax-btn' }, '⧉ Copy');
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(area.value); copy.textContent = '✓ Copied'; } catch { copy.textContent = 'Select and copy'; }
    setTimeout(() => (copy.textContent = '⧉ Copy'), 1600);
  });

  host.replaceChildren(
    h('div', { class: 'ax-pw' },
      h('div', { class: 'ax-pw-ed' },
        h('div', { class: 'ax-win-bar' }, h('span', { class: 'ax-dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), h('span', { class: 'mono' }, 'prompt.md'), h('span', { class: 'ax-pw-stats mono' }, words, tokens)),
        area,
        h('div', { class: 'ax-actions' }, check, reset, copy)),
      h('aside', { class: 'ax-scan', 'aria-label': 'Prompt scanner' },
        h('div', { class: 'ax-scan-top' }, ring, h('div', null, h('p', { class: 'mono ax-scan-k' }, 'INGREDIENT SCAN'), grade)),
        list)),
    status, example,
  );
  update();
  if (saved.solved) { status.className = 'ax-status is-ok'; status.textContent = '✓ Solved before in this browser. Try to make it even sharper.'; }
}
