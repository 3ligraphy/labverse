/**
 * Animated, interactive explanations for AI for Coding (no grading, always usable: [data-free]).
 *   loop        — the agent loop (gather → plan → act → observe → verify), run one turn, or let it skip the tests
 *   context     — the context window: add and remove what the agent sees, watch it fill and lose focus
 *   anatomy     — a strong prompt split into its parts; switch a part off and see what the agent would do instead
 *   specificity — a slider from vague to specific: how many things the agent must guess
 */
import { h, md } from '../../ui/dom.ts';
import { wait } from './store.ts';

export function mountAiVisual(host: HTMLElement, visual: string) {
  const make = VISUALS[visual];
  host.replaceChildren(make ? make() : h('p', null, 'This visual is not available.'));
}

const VISUALS: Record<string, () => HTMLElement> = { loop, context, anatomy, specificity };

/* -------------------------------------------------------------------- loop */

const STAGES = [
  { k: 'Gather context', d: 'Reads files, searches the repo, reads your instructions file.', log: 'Read(src/cart.ts) · Grep("applyDiscount")' },
  { k: 'Plan', d: 'Decides the smallest change that meets the goal.', log: 'Plan: fix rounding in applyDiscount, add a test' },
  { k: 'Act', d: 'Calls a tool: edits a file or runs a command.', log: 'Edit(src/cart.ts) +3 −1' },
  { k: 'Observe', d: 'Reads what the tool gave back: output, errors, diffs.', log: 'Bash(npm test) → 1 failed, 41 passed' },
  { k: 'Verify', d: 'Checks the result against the goal. Not done? Go round again.', log: 'Test still failing → loop again' },
];

function loop(): HTMLElement {
  const size = 300;
  const r = 112;
  const c = size / 2;
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('class', 'vz-loop-svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<circle cx="${c}" cy="${c}" r="${r}" class="vz-orbit"/><circle cx="${c}" cy="${c}" r="${r}" class="vz-orbit-run" pathLength="100"/><circle cx="${c}" cy="${c}" r="46" class="vz-core"/><text x="${c}" y="${c - 4}" class="vz-core-t">AGENT</text><text x="${c}" y="${c + 14}" class="vz-core-s" data-turn>turn 0</text>`;
  const pos = STAGES.map((_, i) => {
    const a = (i / STAGES.length) * Math.PI * 2 - Math.PI / 2;
    return { x: c + r * Math.cos(a), y: c + r * Math.sin(a) };
  });
  const nodes = pos.map((p, i) => {
    const g = document.createElementNS(svgNs, 'g');
    g.setAttribute('class', 'vz-node');
    g.innerHTML = `<circle cx="${p.x}" cy="${p.y}" r="17"/><text x="${p.x}" y="${p.y + 4}">${i + 1}</text>`;
    svg.append(g);
    return g;
  });
  const labels = STAGES.map((s, i) => h('li', { class: 'vz-stage' }, h('span', { class: 'vz-stage-n mono' }, String(i + 1).padStart(2, '0')), h('div', null, h('b', null, s.k), h('p', null, s.d))));
  const log = h('pre', { class: 'vz-log mono', 'aria-live': 'polite' }, '$ agent "make the discount test pass"\n');
  const skip = h('input', { type: 'checkbox' }) as HTMLInputElement;
  const runBtn = h('button', { type: 'button', class: 'ax-btn ax-btn-primary' }, '▶ Run the task') as HTMLButtonElement;
  const turnEl = svg.querySelector('[data-turn]')!;
  const outcome = h('p', { class: 'ax-status', role: 'status' });

  const light = (i: number) => {
    nodes.forEach((n, j) => n.classList.toggle('is-on', j === i));
    labels.forEach((l, j) => l.classList.toggle('is-on', j === i));
    svg.style.setProperty('--run', String(((i + 1) / STAGES.length) * 100));
  };

  runBtn.addEventListener('click', async () => {
    runBtn.disabled = true;
    outcome.textContent = '';
    log.textContent = '$ agent "make the discount test pass"\n';
    const turns = skip.checked ? 1 : 2;
    for (let t = 1; t <= turns; t++) {
      turnEl.textContent = `turn ${t}`;
      for (let i = 0; i < STAGES.length; i++) {
        if (skip.checked && i >= 3) { nodes[i].classList.add('is-skip'); continue; }
        light(i);
        const last = t === turns && i === STAGES.length - 1;
        const line = t === 2 && i === 3 ? 'Bash(npm test) → 42 passed ✓' : last ? 'Goal met: tests green → stop and report' : STAGES[i].log;
        log.textContent += `  ${String(i + 1).padStart(2, '0')} ${STAGES[i].k.padEnd(15)} ${line}\n`;
        await wait(650);
      }
    }
    light(-1);
    nodes.forEach((n) => n.classList.remove('is-skip'));
    if (skip.checked) {
      outcome.className = 'ax-status is-bad';
      outcome.textContent = '✗ It said “Done!” after one edit — but nobody ran the tests. The bug is still there. Agents need a way to check their work.';
      log.textContent += '  ✗ "Done! Fixed the discount." (never verified)\n';
    } else {
      outcome.className = 'ax-status is-ok';
      outcome.textContent = '✓ Two turns: the first fix failed a test, the agent saw it and fixed it. The loop + a test = an agent that corrects itself.';
    }
    runBtn.disabled = false;
  });

  return h('div', { class: 'vz vz-loop' },
    h('div', { class: 'vz-loop-stage' }, svg, h('ol', { class: 'vz-stages' }, ...labels)),
    log,
    h('div', { class: 'ax-actions' }, runBtn, h('label', { class: 'ax-toggle' }, skip, h('span', { class: 'ax-switch', 'aria-hidden': 'true' }), 'Let the agent skip observe & verify')),
    outcome);
}

/* ----------------------------------------------------------------- context */

const CONTEXT_ITEMS = [
  { k: 'System prompt & tools', t: 6, useful: true, fixed: true, c: '#5b6b9a' },
  { k: 'Instructions file (CLAUDE.md / AGENTS.md)', t: 3, useful: true, on: true, c: '#00e5ff' },
  { k: 'Your prompt', t: 1, useful: true, fixed: true, c: '#b388ff' },
  { k: 'The 3 files that matter', t: 14, useful: true, on: true, c: '#4dffb8' },
  { k: 'Failing test output (last 30 lines)', t: 3, useful: true, on: false, c: '#ffd166' },
  { k: 'The whole 4 000-line server log', t: 55, useful: false, on: false, c: '#ff4fd8' },
  { k: 'Every file in the repo', t: 140, useful: false, on: false, c: '#ff7a6b' },
  { k: 'Yesterday’s unrelated chat', t: 30, useful: false, on: false, c: '#8a7dff' },
];

function context(): HTMLElement {
  const CAP = 200;
  const state = CONTEXT_ITEMS.map((i) => Boolean(i.fixed || i.on));
  const bar = h('div', { class: 'vz-ctx-bar', role: 'img' });
  const used = h('b', { class: 'vz-ctx-used' });
  const focus = h('b', { class: 'vz-ctx-focus' });
  const note = h('p', { class: 'ax-status', role: 'status' });
  const toggles = CONTEXT_ITEMS.map((it, i) => {
    const box = h('input', { type: 'checkbox', checked: state[i] ? true : undefined, disabled: it.fixed ? true : undefined }) as HTMLInputElement;
    box.addEventListener('change', () => { state[i] = box.checked; draw(); });
    return h('label', { class: `vz-ctx-item${it.useful ? '' : ' is-noise'}`, style: `--ic:${it.c}` }, box, h('span', { class: 'vz-ctx-sw', 'aria-hidden': 'true' }), h('span', { class: 'vz-ctx-k' }, it.k), h('span', { class: 'vz-ctx-t mono' }, `${it.t}k`));
  });

  const draw = () => {
    const on = CONTEXT_ITEMS.filter((_, i) => state[i]);
    const total = on.reduce((a, i) => a + i.t, 0);
    const useful = on.filter((i) => i.useful).reduce((a, i) => a + i.t, 0);
    const scale = Math.max(CAP, total);
    bar.replaceChildren(...on.map((i) => h('span', { class: 'vz-ctx-seg', style: `--w:${(i.t / scale) * 100}%; --ic:${i.c}`, title: `${i.k}: ${i.t}k tokens` })),
      h('span', { class: 'vz-ctx-cap', style: `--x:${(CAP / scale) * 100}%`, 'aria-hidden': 'true' }));
    bar.setAttribute('aria-label', `${total}k of ${CAP}k tokens used`);
    used.textContent = `${total}k / ${CAP}k`;
    const f = Math.round((useful / Math.max(1, total)) * 100);
    focus.textContent = `${f}%`;
    bar.parentElement?.style.setProperty('--focus', String(f / 100));
    const testOn = state[4];
    if (total > CAP) { note.className = 'ax-status is-bad'; note.textContent = `✗ Over the limit by ${total - CAP}k. The oldest content gets summarised or dropped — often your first instructions. The agent “forgets” the plan.`; }
    else if (f < 60) { note.className = 'ax-status is-bad'; note.textContent = `⚠ It fits, but only ${f}% of what the agent reads helps. Noise drowns the signal: answers get slower, vaguer and more expensive.`; }
    else if (!testOn) { note.className = 'ax-status'; note.textContent = 'Focused — but the agent cannot see what is failing. Add the failing test output so it knows what “fixed” means.'; }
    else { note.className = 'ax-status is-ok'; note.textContent = `✓ ${f}% signal, ${CAP - total}k free for the agent to work. Small, relevant context beats “everything, just in case”.`; }
  };

  const el = h('div', { class: 'vz vz-ctx' },
    h('div', { class: 'vz-ctx-head' }, h('div', null, h('p', { class: 'mono vz-k' }, 'CONTEXT WINDOW'), used), h('div', null, h('p', { class: 'mono vz-k' }, 'SIGNAL'), focus)),
    bar,
    h('div', { class: 'vz-ctx-list' }, ...toggles),
    note);
  draw();
  return el;
}

/* ----------------------------------------------------------------- anatomy */

const ANATOMY = [
  { k: 'Context', c: '#00e5ff', text: 'In our Expo app, the cart screen is `app/cart.tsx` and prices come from `lib/price.ts`.', without: 'searches the whole repo and edits the first `price` it finds — maybe the wrong one.' },
  { k: 'Goal', c: '#4dffb8', text: 'Totals should show two decimals: 19.9 must show as **19.90 EGP**.', without: 'guesses what “fix the price” means and changes something you did not want.' },
  { k: 'Limits', c: '#ffd166', text: 'Only change `lib/price.ts`. Do not add packages. Keep `formatPrice(value)` the same signature.', without: 'installs a currency library and renames the function used in 12 files.' },
  { k: 'Example', c: '#b388ff', text: '`formatPrice(5)` → `"5.00 EGP"`, `formatPrice(1234.5)` → `"1,234.50 EGP"`.', without: 'picks its own format — `EGP 5`, `5 £E` … — and you only notice later.' },
  { k: 'Done when', c: '#ff4fd8', text: 'Add tests for these cases in `lib/price.test.ts` and run `npm test` until it passes.', without: 'says “Done!” without running anything. You find the bug in the demo.' },
];

function anatomy(): HTMLElement {
  const off = new Set<number>();
  const spans = ANATOMY.map((p) => h('span', { class: 'vz-an-part', style: `--pc:${p.c}`, html: `${md(p.text)} ` }));
  const prompt = h('p', { class: 'vz-an-prompt' }, ...spans);
  const effects = h('ul', { class: 'vz-an-fx', 'aria-live': 'polite' });
  const score = h('b', { class: 'vz-an-score' });
  const chips = ANATOMY.map((p, i) => {
    const b = h('button', { type: 'button', class: 'vz-an-chip', style: `--pc:${p.c}`, 'aria-pressed': 'true' }, h('span', { class: 'vz-an-dot', 'aria-hidden': 'true' }), p.k) as HTMLButtonElement;
    b.addEventListener('click', () => { off.has(i) ? off.delete(i) : off.add(i); draw(); });
    b.addEventListener('mouseenter', () => spans[i].classList.add('is-focus'));
    b.addEventListener('mouseleave', () => spans[i].classList.remove('is-focus'));
    b.addEventListener('focus', () => spans[i].classList.add('is-focus'));
    b.addEventListener('blur', () => spans[i].classList.remove('is-focus'));
    return b;
  });
  const draw = () => {
    chips.forEach((c, i) => c.setAttribute('aria-pressed', String(!off.has(i))));
    spans.forEach((s, i) => s.classList.toggle('is-off', off.has(i)));
    score.textContent = `${ANATOMY.length - off.size}/${ANATOMY.length}`;
    effects.replaceChildren(...(off.size
      ? [...off].sort().map((i) => h('li', { style: `--pc:${ANATOMY[i].c}` }, h('b', null, `Without ${ANATOMY[i].k.toLowerCase()}`), ' the agent ', h('span', { html: md(ANATOMY[i].without) })))
      : [h('li', { class: 'is-ok' }, h('b', null, 'All five parts.'), ' The agent knows where to look, what “working” means, what not to touch, the exact format, and how to prove it is done.')]));
  };
  draw();
  return h('div', { class: 'vz vz-an' },
    h('div', { class: 'vz-an-head' }, h('p', { class: 'mono vz-k' }, 'SWITCH A PART OFF'), h('p', { class: 'mono vz-k' }, 'PARTS ', score)),
    h('div', { class: 'vz-an-chips' }, ...chips),
    h('div', { class: 'vz-an-card' }, h('span', { class: 'vz-an-tag mono' }, 'prompt'), prompt),
    effects);
}

/* ------------------------------------------------------------- specificity */

const LEVELS = [
  { p: 'make login better', guesses: ['Which login — web, mobile, or the API?', 'Better how: faster, safer, prettier?', 'Which files may it change?', 'Is a new library OK?', 'How do we know it worked?', 'Keep the old behaviour for existing users?'] },
  { p: 'make the login screen safer', guesses: ['Which login screen file?', 'Safer against what?', 'Which files may it change?', 'Is a new library OK?', 'How do we know it worked?'] },
  { p: 'in app/login.tsx, stop the app from crashing when the password is empty', guesses: ['What should happen instead of the crash?', 'Is a new library OK?', 'How do we know it worked?'] },
  { p: 'in app/login.tsx, when the password is empty show “Enter your password” under the field and do not call the API. No new packages.', guesses: ['How do we know it worked?'] },
  { p: 'in app/login.tsx, when the password is empty show “Enter your password” under the field and do not call the API. No new packages. Add a test in login.test.tsx for the empty case and run npm test until it passes.', guesses: [] },
];

function specificity(): HTMLElement {
  const range = h('input', { type: 'range', min: '1', max: String(LEVELS.length), value: '1', class: 'vz-sp-range', 'aria-label': 'How specific is the prompt' }) as HTMLInputElement;
  const prompt = h('p', { class: 'vz-sp-prompt mono' });
  const list = h('ul', { class: 'vz-sp-list' });
  const meter = h('div', { class: 'vz-sp-meter', 'aria-hidden': 'true' }, ...Array.from({ length: 6 }, () => h('i')));
  const count = h('b', { class: 'vz-sp-count' });
  const verdict = h('p', { class: 'ax-status', role: 'status' });
  const draw = () => {
    const lv = LEVELS[Number(range.value) - 1];
    prompt.textContent = `❯ ${lv.p}`;
    list.replaceChildren(...(lv.guesses.length ? lv.guesses.map((g) => h('li', null, h('span', { 'aria-hidden': 'true' }, '?'), g)) : [h('li', { class: 'is-ok' }, h('span', { 'aria-hidden': 'true' }, '✓'), 'Nothing left to guess.')]));
    [...meter.children].forEach((m, i) => m.classList.toggle('is-on', i < lv.guesses.length));
    count.textContent = String(lv.guesses.length);
    host().style.setProperty('--lv', String((Number(range.value) - 1) / (LEVELS.length - 1)));
    verdict.className = `ax-status ${lv.guesses.length === 0 ? 'is-ok' : lv.guesses.length > 3 ? 'is-bad' : ''}`;
    verdict.textContent = lv.guesses.length === 0 ? '✓ Every guess became an instruction. This is a prompt an agent can finish on its own.' : `Every guess is a coin flip the agent makes for you. ${lv.guesses.length} guess${lv.guesses.length === 1 ? '' : 'es'} → many ways to get it “right” but wrong.`;
  };
  const el = h('div', { class: 'vz vz-sp' },
    h('div', { class: 'vz-sp-scale mono', 'aria-hidden': 'true' }, h('span', null, 'VAGUE'), h('span', null, 'SPECIFIC')),
    range,
    h('div', { class: 'vz-sp-card' }, prompt),
    h('div', { class: 'vz-sp-out' }, h('div', { class: 'vz-sp-head' }, h('p', { class: 'mono vz-k' }, 'THE AGENT MUST GUESS'), count, meter), list),
    verdict);
  const host = () => el;
  range.addEventListener('input', draw);
  draw();
  return el;
}
