/**
 * Agent run: a coding-agent session played back step by step in a terminal window (prompt, thinking, tool calls,
 * edits, output). At each ask: step the playback stops and the student decides — approve the command, choose the
 * next prompt, spot the risk. A right choice continues; first-try right choices are the score.
 */
import { h, md } from '../../ui/dom.ts';
import type { AgentStep } from '../core.ts';
import { store, wait, reducedMotion } from './store.ts';
import type { Track } from './mount.ts';

type Cfg = { id: string; steps: AgentStep[] };

const TOOL: Record<string, string> = { read: 'Read', run: 'Bash', edit: 'Edit' };

function stepView(s: AgentStep): HTMLElement {
  switch (s.kind) {
    case 'user': return h('div', { class: 'ag-l ag-user' }, h('span', { class: 'ag-who mono' }, '❯ you'), h('div', { class: 'ag-t', html: md(s.text) }));
    case 'think': return h('div', { class: 'ag-l ag-think' }, h('span', { class: 'ag-who mono' }, '✻ thinking'), h('div', { class: 'ag-t', html: md(s.text) }));
    case 'say': return h('div', { class: 'ag-l ag-say' }, h('span', { class: 'ag-who mono' }, '◆ agent'), h('div', { class: 'ag-t', html: md(s.text) }));
    case 'read': case 'run': return h('div', { class: `ag-l ag-tool ag-${s.kind}` },
      h('p', { class: 'ag-call mono' }, h('span', { class: 'ag-bullet', 'aria-hidden': 'true' }, '●'), h('b', null, TOOL[s.kind]), `(${s.text})`),
      s.out.length ? h('pre', { class: 'ag-out mono' }, s.out.join('\n')) : null);
    case 'edit': return h('div', { class: 'ag-l ag-tool ag-edit' },
      h('p', { class: 'ag-call mono' }, h('span', { class: 'ag-bullet', 'aria-hidden': 'true' }, '●'), h('b', null, 'Edit'), `(${s.text})`),
      h('pre', { class: 'ag-diff mono' }, ...s.diff.map((l) => h('span', { class: l.startsWith('+') ? 'is-add' : 'is-del' }, `${l}\n`))));
    case 'ask': return h('div', { class: 'ag-l ag-ask' });
  }
}

export function mountAgent(host: HTMLElement, cfg: Cfg, track: Track) {
  const asks = cfg.steps.filter((s) => s.kind === 'ask').length;
  const saved = store.get<{ done: boolean }>(cfg.id);
  const screen = h('div', { class: 'ag-screen', role: 'log', 'aria-live': 'polite', 'aria-label': 'Agent session' });
  const pips = h('div', { class: 'ag-pips', 'aria-hidden': 'true' }, ...cfg.steps.map((s) => h('i', { class: s.kind === 'ask' ? 'is-ask' : '' })));
  const next = h('button', { type: 'button', class: 'ax-btn ax-btn-primary' }, '▶ Next step') as HTMLButtonElement;
  const play = h('button', { type: 'button', class: 'ax-btn' }, '⏩ Play to the next decision') as HTMLButtonElement;
  const restart = h('button', { type: 'button', class: 'ax-btn' }, '↺ Restart') as HTMLButtonElement;
  const status = h('p', { class: 'ax-status', role: 'status' });
  let at = 0;
  let firstTry = 0;
  let busy = false;
  let blocked = false;
  const picks: string[] = [];

  const setButtons = () => {
    const end = at >= cfg.steps.length;
    next.disabled = end || blocked || busy;
    play.disabled = end || blocked || busy;
    [...pips.children].forEach((p, i) => p.classList.toggle('is-on', i < at));
  };

  const finish = () => {
    status.className = 'ax-status is-ok';
    status.textContent = asks ? `Session complete · ${firstTry}/${asks} decisions right first time.` : 'Session complete.';
    if (asks) track(firstTry, asks, picks.join('\n'));
    store.set(cfg.id, { done: true });
  };

  const ask = (s: Extract<AgentStep, { kind: 'ask' }>, box: HTMLElement) => {
    blocked = true;
    let tries = 0;
    const feedback = h('p', { class: 'ag-fb', role: 'status' });
    const opts = h('div', { class: 'ag-opts' });
    s.options.forEach((o, i) => {
      const b = h('button', { type: 'button', class: 'ag-opt' }, h('span', { class: 'ag-opt-k mono' }, 'ABCDEF'[i]), h('span', { html: md(o.text) })) as HTMLButtonElement;
      b.addEventListener('click', () => {
        if (!blocked) return;
        tries++;
        b.classList.add(o.correct ? 'is-right' : 'is-wrong');
        feedback.className = `ag-fb ${o.correct ? 'is-ok' : 'is-bad'}`;
        feedback.innerHTML = `${o.correct ? '✓ ' : '✗ '}${md(o.why || (o.correct ? 'Right.' : 'Not quite — try another.'))}`;
        screen.scrollTop = screen.scrollHeight;
        if (!o.correct) { b.disabled = true; return; }
        if (tries === 1) firstTry++;
        picks.push(`${s.text} → ${o.text}`);
        opts.querySelectorAll('button').forEach((x) => ((x as HTMLButtonElement).disabled = true));
        blocked = false;
        setButtons();
        if (at >= cfg.steps.length) finish();
        else next.focus();
      });
      opts.append(b);
    });
    box.append(h('p', { class: 'ag-ask-k mono' }, '⚑ YOUR CALL'), h('div', { class: 'ag-ask-q', html: md(s.text) }), opts, feedback);
  };

  const step = async () => {
    if (at >= cfg.steps.length || blocked) return;
    const s = cfg.steps[at++];
    const el = stepView(s);
    screen.append(el);
    if (!reducedMotion()) el.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.16,1,.3,1)' });
    if (s.kind === 'ask') ask(s, el);
    screen.scrollTop = screen.scrollHeight;
    setButtons();
    if (at >= cfg.steps.length && !blocked) finish();
  };

  next.addEventListener('click', () => void step());
  play.addEventListener('click', async () => {
    busy = true;
    setButtons();
    while (at < cfg.steps.length && !blocked) {
      await step();
      if (cfg.steps[at - 1]?.kind === 'ask') break;
      await wait(420);
    }
    busy = false;
    setButtons();
  });
  restart.addEventListener('click', () => {
    at = 0; firstTry = 0; blocked = false; picks.length = 0;
    screen.replaceChildren();
    status.textContent = '';
    setButtons();
    void step();
  });

  host.replaceChildren(
    h('div', { class: 'ag' },
      h('div', { class: 'ax-win-bar' }, h('span', { class: 'ax-dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), h('span', { class: 'mono' }, 'agent · session'), h('span', { class: 'ag-live mono' }, h('span', { class: 'ag-live-dot', 'aria-hidden': 'true' }), asks ? `${asks} decision${asks === 1 ? '' : 's'}` : 'demo')),
      screen, pips,
      h('div', { class: 'ax-actions' }, next, play, restart)),
    status,
  );
  void step();
  if (saved.done) { status.className = 'ax-status'; status.textContent = 'You finished this session before. Run it again any time.'; }
}
