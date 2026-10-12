/**
 * Client side of the no-code web lab blocks: browser frames (WebFrame), AI prompt cards, quick checks, image zoom
 * and the live HTML/CSS sandbox. Each init is safe to call again after an Astro client-side navigation: elements
 * already wired are skipped (data-*-bound), new ones are wired.
 */
import { pageDoc, stripFences } from '@/lib/platform/web';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** true the first time an element is seen */
const claim = (el: HTMLElement, key: string) => {
  if (el.dataset[key]) return false;
  el.dataset[key] = '1';
  return true;
};

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // older browsers / http on the lab network: a hidden textarea + execCommand
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch {}
    ta.remove();
    return ok;
  }
}

const X_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

/** A modal <dialog> that removes itself on close; a click on the backdrop closes it. */
function modal(cls: string, label: string, content: Node): HTMLDialogElement {
  const dlg = document.createElement('dialog');
  dlg.className = cls;
  dlg.setAttribute('aria-label', label);
  dlg.append(content);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => dlg.remove());
  document.addEventListener('astro:before-swap', () => dlg.open && dlg.close(), { once: true });
  document.body.append(dlg);
  dlg.showModal();
  return dlg;
}

/* ------------------------------------------------------------- browser frames */

const DEVICE_W: Record<string, number> = { tablet: 820, phone: 390 };

export function initFrames(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-wf]').forEach(bindFrame);
}

function bindFrame(frame: HTMLElement) {
  if (!claim(frame, 'wfBound')) return;
  const stage = frame.querySelector<HTMLElement>('[data-wf-stage]')!;
  const iframe = frame.querySelector<HTMLIFrameElement>('[data-wf-frame]')!;
  const sizeTag = frame.querySelector<HTMLElement>('[data-wf-size]');
  let sizeTimer = 0;

  const layout = () => {
    const sw = stage.clientWidth;
    const sh = stage.clientHeight;
    if (!sw || !sh) return;
    const mode = frame.dataset.device ?? 'desktop';
    const pad = mode === 'desktop' ? 0 : Math.round(Math.min(24, sw * 0.05));
    // desktop: at least a small-laptop width, so a phone shows the real desktop layout (scaled)
    const w = mode === 'desktop' ? Math.max(sw, 1024) : DEVICE_W[mode];
    const s = Math.min(1, (sw - pad * 2) / w);
    frame.style.setProperty('--wf-w', `${w}px`);
    frame.style.setProperty('--wf-s', String(s));
    frame.style.setProperty('--wf-pad', `${pad}px`);
    frame.style.setProperty('--wf-ch', `${Math.max(120, (sh - pad * 2) / s)}px`);
    if (sizeTag) sizeTag.textContent = `${w}px${s < 0.995 ? ` · ${Math.round(s * 100)}%` : ''}`;
  };
  frame.classList.add('is-scaled');
  layout();
  if ('ResizeObserver' in window) new ResizeObserver(layout).observe(stage);
  else addEventListener('resize', layout);

  frame.querySelectorAll<HTMLButtonElement>('[data-wf-device]').forEach((b) =>
    b.addEventListener('click', () => {
      frame.dataset.device = b.dataset.wfDevice;
      frame.querySelectorAll('[data-wf-device]').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
      layout();
      if (sizeTag) {
        sizeTag.classList.add('on');
        clearTimeout(sizeTimer);
        sizeTimer = window.setTimeout(() => sizeTag.classList.remove('on'), 1400);
      }
    }),
  );
  const reload = frame.querySelector<HTMLElement>('[data-wf-reload]');
  reload?.addEventListener('click', () => {
    iframe.srcdoc = iframe.srcdoc; // replays the page (and its CSS animations)
    reload.classList.remove('spin');
    void reload.offsetWidth;
    reload.classList.add('spin');
  });
  frame.querySelector('[data-wf-full]')?.addEventListener('click', () => openFull(frame));
}

/** Shows new HTML in a frame (the sandbox's Run). */
export function setFrameHtml(frame: HTMLElement, html: string) {
  const iframe = frame.querySelector<HTMLIFrameElement>('[data-wf-frame]');
  if (!iframe) return;
  iframe.removeAttribute('loading');
  iframe.srcdoc = pageDoc(html);
  const live = frame.querySelector<HTMLElement>('[data-wf-live]');
  if (live && !reduced()) {
    live.classList.remove('pulse');
    void live.offsetWidth;
    live.classList.add('pulse');
  }
}

function openFull(frame: HTMLElement) {
  const clone = frame.cloneNode(true) as HTMLElement;
  delete clone.dataset.wfBound;
  clone.classList.remove('is-scaled');
  const iframe = clone.querySelector<HTMLIFrameElement>('[data-wf-frame]')!;
  iframe.removeAttribute('loading');
  const btn = clone.querySelector<HTMLButtonElement>('[data-wf-full]')!;
  btn.removeAttribute('data-wf-full');
  btn.setAttribute('aria-label', 'Close full screen');
  btn.title = 'Close (Esc)';
  btn.innerHTML = X_ICON;
  const dlg = modal('wf-dialog', `Full screen: ${iframe.title}`, clone);
  btn.addEventListener('click', () => dlg.close());
  bindFrame(clone);
  btn.focus();
}

/* ------------------------------------------------------------- AI prompt cards */

export function initPrompts(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-pc]').forEach((card) => {
    if (!claim(card, 'pcBound')) return;
    const text = card.querySelector<HTMLElement>('[data-pc-text]')?.textContent ?? '';
    const btn = card.querySelector<HTMLButtonElement>('[data-pc-copy]');
    const status = card.querySelector<HTMLElement>('[data-pc-status]');
    const label = btn?.querySelector<HTMLElement>('[data-pc-label]');
    let timer = 0;
    const say = (msg: string) => {
      if (!status) return;
      status.textContent = '';
      requestAnimationFrame(() => (status.textContent = msg));
    };
    btn?.addEventListener('click', async () => {
      const ok = await copyText(text);
      if (!ok) { say('Copy did not work here. Select the prompt text and copy it.'); return; }
      btn.classList.add('copied');
      if (label) label.textContent = 'Copied';
      say(card.dataset.pcSlots ? 'Prompt copied. Paste it, then replace the parts in [square brackets].' : 'Prompt copied. Paste it into the chat.');
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        btn.classList.remove('copied');
        if (label) label.textContent = 'Copy prompt';
      }, 2200);
    });
    // opening the assistant also copies, in case it does not fill the prompt in (signed out, app on a phone…)
    card.querySelector('[data-pc-open]')?.addEventListener('click', () => {
      copyText(text).then((ok) => ok && say('Opened in a new tab. The prompt is also copied, if you need to paste it.'));
    });
  });
}

/* ------------------------------------------------------------- quick checks */

export function initQuizzes(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-qc]').forEach((qc) => {
    if (!claim(qc, 'qcBound')) return;
    const inputs = Array.from(qc.querySelectorAll<HTMLInputElement>('[data-qc-in]'));
    const check = qc.querySelector<HTMLButtonElement>('[data-qc-check]')!;
    const retry = qc.querySelector<HTMLButtonElement>('[data-qc-retry]')!;
    const reveal = qc.querySelector<HTMLButtonElement>('[data-qc-reveal]')!;
    const msg = qc.querySelector<HTMLElement>('[data-qc-msg]')!;
    const details = qc.querySelector<HTMLDetailsElement>('[data-qc-explain]');
    // with scripts the disclosure only carries the staff's explanation (the answer is shown on the options)
    const explain = details && !details.hasAttribute('data-empty') ? details : null;
    const multi = qc.dataset.multi === 'true';
    const isRight = (i: HTMLInputElement) => i.hasAttribute('data-correct');
    const opt = (i: HTMLInputElement) => i.closest<HTMLElement>('.qc-opt')!;
    const sr = (i: HTMLInputElement, t: string) => { const s = opt(i).querySelector('[data-qc-sr]'); if (s) s.textContent = t; };

    const lock = (on: boolean) => inputs.forEach((i) => (i.disabled = on));
    qc.classList.add('is-js'); // the no-script "Show the answer" fallback gives way to Check
    if (details) details.hidden = true;

    const showAnswer = () => {
      inputs.forEach((i) => {
        if (isRight(i) && !i.checked) { opt(i).dataset.state = 'missed'; sr(i, ' (correct answer)'); }
      });
      lock(true);
      check.hidden = true;
      retry.hidden = false;
      reveal.hidden = true;
      if (explain) { explain.hidden = false; explain.open = true; }
    };

    check.addEventListener('click', () => {
      const chosen = inputs.filter((i) => i.checked);
      if (!chosen.length) {
        msg.dataset.tone = 'info';
        msg.textContent = multi ? 'Tick at least one option first.' : 'Choose an answer first.';
        inputs[0]?.focus();
        return;
      }
      const allRight = inputs.every((i) => i.checked === isRight(i));
      chosen.forEach((i) => {
        opt(i).dataset.state = isRight(i) ? 'right' : 'wrong';
        sr(i, isRight(i) ? ' (your answer: correct)' : ' (your answer: not correct)');
      });
      lock(true);
      qc.dataset.result = allRight ? 'right' : 'wrong';
      check.hidden = true;
      retry.hidden = false;
      if (allRight) {
        msg.dataset.tone = 'ok';
        msg.textContent = multi ? 'Correct, those are all of them.' : 'Correct!';
        showAnswer();
      } else {
        const someRight = chosen.some(isRight);
        msg.dataset.tone = 'bad';
        msg.textContent = multi && someRight ? 'Almost: some of your choices are right, but not all. Try again?' : 'Not quite. Try again, or show the answer.';
        reveal.hidden = false;
      }
      retry.focus();
    });
    reveal.addEventListener('click', () => { showAnswer(); explain?.querySelector('summary')?.focus(); });
    retry.addEventListener('click', () => {
      inputs.forEach((i) => { i.checked = false; delete opt(i).dataset.state; sr(i, ''); });
      lock(false);
      delete qc.dataset.result;
      msg.textContent = '';
      check.hidden = false;
      retry.hidden = true;
      reveal.hidden = true;
      if (explain) { explain.open = false; explain.hidden = true; }
      inputs[0]?.focus();
    });
  });
}

/* ------------------------------------------------------------- image zoom */

export function initImages(root: ParentNode = document) {
  root.querySelectorAll<HTMLAnchorElement>('[data-mi-zoom]').forEach((a) => {
    if (!claim(a, 'miBound')) return;
    a.addEventListener('click', (e) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return; // new tab still works
      e.preventDefault();
      const src = a.querySelector('img');
      if (!src) return;
      const box = document.createElement('div');
      box.className = 'mi-zoom';
      const img = Object.assign(document.createElement('img'), { src: src.currentSrc || src.src, alt: src.alt });
      const close = Object.assign(document.createElement('button'), { type: 'button', className: 'mi-close', innerHTML: X_ICON });
      close.setAttribute('aria-label', 'Close');
      box.append(img, close);
      const cap = a.closest('figure')?.querySelector('figcaption')?.textContent?.trim();
      if (cap) box.append(Object.assign(document.createElement('p'), { className: 'mi-zcap', textContent: cap }));
      const dlg = modal('mi-dialog', src.alt || cap || 'Image', box);
      close.addEventListener('click', () => dlg.close());
      img.addEventListener('click', () => dlg.close());
      close.focus();
    });
  });
}

/* ------------------------------------------------------------- web sandbox */

type Source = { get(): string; set(v: string): void; focus(): void };

export function initSandboxes(root: ParentNode = document) {
  const boxes = Array.from(root.querySelectorAll<HTMLElement>('[data-ws]')).filter((ws) => claim(ws, 'wsBound'));
  if (!boxes.length) return;
  const upgrades: ((mod: typeof import('./web-editor')) => void)[] = [];
  boxes.forEach((ws) => upgrades.push(bindSandbox(ws)));
  // the syntax-highlighting editor loads after the page is usable; the plain text area works until then
  const load = () => import('./web-editor').then((mod) => upgrades.forEach((u) => u(mod))).catch(() => {});
  if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 2500 });
  else setTimeout(load, 600);
}

function bindSandbox(ws: HTMLElement) {
  const key = `websandbox:${ws.dataset.wsId}`;
  const ta = ws.querySelector<HTMLTextAreaElement>('[data-ws-src]')!;
  const frame = ws.querySelector<HTMLElement>('[data-wf]')!;
  const status = ws.querySelector<HTMLElement>('[data-ws-status]')!;
  const auto = ws.querySelector<HTMLInputElement>('[data-ws-auto]');
  const starter = ta.defaultValue;
  let src: Source = { get: () => ta.value, set: (v) => (ta.value = v), focus: () => ta.focus() };
  let runTimer = 0;
  let saveTimer = 0;
  let resetArmed = 0;

  const say = (t: string) => (status.textContent = t);
  const save = () => {
    try {
      const code = src.get();
      if (code === starter) localStorage.removeItem(key);
      else localStorage.setItem(key, code);
      say('Saved in this browser');
    } catch { say('Not saved: this browser blocks storage'); }
  };
  const run = () => {
    clearTimeout(runTimer);
    const { code, stripped } = stripFences(src.get());
    if (stripped) {
      src.set(code);
      save();
      say('Removed the ``` lines around the code');
    }
    setFrameHtml(frame, code);
    ws.classList.remove('is-dirty');
  };
  const changed = () => {
    ws.classList.add('is-dirty');
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(save, 400);
    clearTimeout(runTimer);
    if (auto?.checked) runTimer = window.setTimeout(run, 750);
  };

  let saved: string | null = null;
  try { saved = localStorage.getItem(key); } catch {}
  if (saved != null && saved !== starter) {
    src.set(saved);
    run();
    say('Restored your last version');
  }

  ta.addEventListener('input', changed);
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); }
  });
  ws.querySelector('[data-ws-run]')?.addEventListener('click', run);
  auto?.addEventListener('change', () => { if (auto.checked && ws.classList.contains('is-dirty')) run(); });

  const copyBtn = ws.querySelector<HTMLButtonElement>('[data-ws-copy]');
  copyBtn?.addEventListener('click', async () => {
    const ok = await copyText(src.get());
    say(ok ? 'Code copied' : 'Copy did not work here: select the code and copy it');
    if (ok) { copyBtn.classList.add('copied'); setTimeout(() => copyBtn.classList.remove('copied'), 1600); }
  });

  const resetBtn = ws.querySelector<HTMLButtonElement>('[data-ws-reset]');
  const resetLabel = resetBtn?.querySelector<HTMLElement>('[data-ws-reset-label]');
  resetBtn?.addEventListener('click', () => {
    // two steps, so a stray tap doesn't wipe a student's work
    if (!resetArmed) {
      resetBtn.classList.add('armed');
      if (resetLabel) resetLabel.textContent = 'Tap again to reset';
      resetArmed = window.setTimeout(disarm, 3500);
      return;
    }
    disarm();
    src.set(starter);
    try { localStorage.removeItem(key); } catch {}
    run();
    say('Back to the starter code');
    src.focus();
  });
  function disarm() {
    clearTimeout(resetArmed);
    resetArmed = 0;
    resetBtn?.classList.remove('armed');
    if (resetLabel) resetLabel.textContent = 'Reset';
  }

  const upgrade = (mod: typeof import('./web-editor')) => {
    if (!ta.isConnected) return;
    // never swap the editor under a student who is typing: wait until they leave the text area
    if (document.activeElement === ta) { ta.addEventListener('blur', () => upgrade(mod), { once: true }); return; }
    const host = ws.querySelector<HTMLElement>('[data-ws-editor]')!;
    const ed = mod.createWebEditor({ parent: host, doc: src.get(), label: ta.getAttribute('aria-label') ?? 'Code', onChange: changed, onRun: run });
    ta.hidden = true;
    ws.classList.add('has-cm');
    src = ed;
  };
  return upgrade;
}
