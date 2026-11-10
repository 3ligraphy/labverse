/**
 * Wireless Networks · Lecture 1 — every interactive piece of the lecture page: progress ticks (this browser only),
 * the slide viewer (slide image + "open the PDF at this page"), present mode, and one small widget per section.
 */
import {
  bandOf, BANDS, C, dopplerHz, formatHz, formatLength, formatRate, formatSeconds, multihopPowerRatio, period, shannonCapacity, snrDb, wavelength,
} from '@/lib/wireless/core';

const KEY = 'buenova:wireless-lecture-01';
const PDF = '/wireless/lecture-01/WN_Lecture_1.pdf';
const PAGES = 25;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const num = (v: unknown) => Number(String(v ?? '').trim());
const fmt = (n: number, p = 3) => (Math.abs(n) >= 1e5 || (n !== 0 && Math.abs(n) < 1e-3) ? n.toExponential(2) : String(Number(n.toPrecision(p))));
const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
const $ = <T extends Element = HTMLElement>(root: ParentNode, sel: string) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(root: ParentNode, sel: string) => [...root.querySelectorAll<T>(sel)];
const press = (group: HTMLElement[], on: HTMLElement) => group.forEach((b) => b.setAttribute('aria-pressed', String(b === on)));

/** A canvas sized to its box and the screen's pixel density; returns a 2D context in CSS pixels. */
function prep(canvas: HTMLCanvasElement) {
  const w = canvas.clientWidth || 600;
  const h = Number(canvas.getAttribute('height')) || 200;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.style.height = `${h}px`; canvas.height = Math.round(h * dpr); }
  const g = canvas.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  return { g, w, h };
}
function axis(g: CanvasRenderingContext2D, w: number, y: number) {
  g.strokeStyle = css('--line-2'); g.lineWidth = 1; g.setLineDash([4, 4]);
  g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); g.setLineDash([]);
}
function curve(g: CanvasRenderingContext2D, w: number, fn: (x: number) => number, color: string, width = 2.5) {
  g.strokeStyle = color; g.lineWidth = width; g.beginPath();
  for (let x = 0; x <= w; x++) { const y = fn(x); if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); }
  g.stroke();
}

/* ------------------------------------------------------------------ widgets */

function snr(root: HTMLElement) {
  const run = () => {
    const s = num($<HTMLInputElement>(root, '[name=s]')!.value), n = num($<HTMLInputElement>(root, '[name=n]')!.value);
    const out = $(root, '[data-out]')!;
    if (!(s > 0 && n > 0)) { out.textContent = 'Enter two positive powers.'; return; }
    const db = snrDb(s, n);
    const q = db >= 40 ? 'excellent' : db >= 25 ? 'very good' : db >= 15 ? 'good' : db >= 10 ? 'weak' : 'poor — the signal is close to the noise';
    out.textContent = `Ratio ${fmt(s / n)} → SNR = ${fmt(db)} dB · link quality: ${q}`;
  };
  root.addEventListener('input', run); run();
}

function chain(root: HTMLElement) {
  const tabs = $$<HTMLButtonElement>(root, '[data-stage]');
  tabs.forEach((t) => t.addEventListener('click', () => {
    tabs.forEach((x) => x.setAttribute('aria-selected', String(x === t)));
    $$(root, '[data-stage-panel]').forEach((p) => (p.hidden = p.dataset.stagePanel !== t.dataset.stage));
  }));
}

function segPanels(root: HTMLElement, btnAttr: string, panelAttr: string) {
  const btns = $$<HTMLButtonElement>(root, `[${btnAttr}]`);
  btns.forEach((b) => b.addEventListener('click', () => {
    press(btns, b);
    const v = b.getAttribute(btnAttr);
    $$(root, `[${panelAttr}]`).forEach((p) => (p.hidden = p.getAttribute(panelAttr) !== v));
  }));
}

function handover(root: HTMLElement) {
  const input = $<HTMLInputElement>(root, '[data-pos]')!, user = $(root, '[data-user]')!, out = $(root, '[data-out]')!;
  const aps = [12, 50, 88];
  let current = 0, handovers = 0;
  const run = () => {
    const x = num(input.value);
    user.style.setProperty('--x', `${x}%`);
    const best = aps.reduce((b, ap, i) => (Math.abs(ap - x) < Math.abs(aps[b] - x) ? i : b), 0);
    if (best !== current) { handovers++; current = best; }
    $$(root, '.wl-ap').forEach((a, i) => a.classList.toggle('on', i === current));
    out.textContent = `Connected to AP ${current + 1} · ${handovers} handover${handovers === 1 ? '' : 's'} · session still alive`;
  };
  input.addEventListener('input', run); run();
}

function timeline(root: HTMLElement) {
  $$<HTMLButtonElement>(root, 'button').forEach((b) => b.addEventListener('click', () => {
    const open = b.getAttribute('aria-expanded') !== 'true';
    b.setAttribute('aria-expanded', String(open));
    b.nextElementSibling!.toggleAttribute('hidden', !open);
  }));
}

function order(root: HTMLElement) {
  const box = $(root, '[data-order-items]')!, out = $(root, '[data-out]')!;
  let next = 0;
  const reset = () => {
    next = 0;
    const items = $$<HTMLButtonElement>(box, 'button');
    items.sort(() => Math.random() - 0.5).forEach((b) => { b.disabled = false; b.className = ''; box.append(b); });
    out.textContent = 'Pick the oldest event first.';
  };
  box.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b || b.disabled) return;
    if (num(b.dataset.rank) === next) {
      b.disabled = true; b.className = 'ok'; next++;
      out.textContent = next === 4 ? 'Correct order: 1901 radio → 1962 Telstar → 1997 Wi-Fi → 2019 5G.' : `Right! Now pick event ${next + 1}.`;
    } else { b.className = 'bad'; out.textContent = 'Not that one yet — which happened earlier?'; setTimeout(() => (b.className = ''), 700); }
  });
  $(root, '[data-order-reset]')!.addEventListener('click', reset);
}

function shannon(root: HTMLElement) {
  const b = $<HTMLInputElement>(root, '[data-b]')!, s = $<HTMLInputElement>(root, '[data-s]')!;
  const run = () => {
    const B = num(b.value) * 1e6, S = num(s.value), cap = shannonCapacity(B, S);
    $(root, '[data-b-out]')!.textContent = `${b.value} MHz`;
    $(root, '[data-snr-out]')!.textContent = `${S} dB (× ${fmt(10 ** (S / 10))})`;
    $(root, '[data-out]')!.textContent = `C ≈ ${formatRate(cap)}  ·  log₂(1 + SNR) = ${fmt(Math.log2(1 + 10 ** (S / 10)))} bit/s/Hz`;
    $(root, '[data-bar]')!.style.width = `${Math.min(100, (cap / shannonCapacity(160e6, 50)) * 100)}%`;
  };
  root.addEventListener('input', run);
  $(root, '[data-example]')!.addEventListener('click', () => { b.value = '20'; s.value = '30'; run(); });
  run();
}

function bands(root: HTMLElement) {
  const f = $<HTMLInputElement>(root, '[data-f]')!;
  const lo = Math.log10(3e6), hi = Math.log10(300e9);
  const toHz = (v: number) => 10 ** (lo + (v / 1000) * (hi - lo));
  const toSlider = (hz: number) => Math.round(((Math.log10(hz) - lo) / (hi - lo)) * 1000);
  const run = () => {
    const hz = toHz(num(f.value)), band = bandOf(hz) ?? BANDS[BANDS.length - 1];
    $(root, '[data-f-out]')!.textContent = formatHz(hz);
    $$(root, '[data-band]').forEach((el) => el.classList.toggle('on', el.dataset.band === band.id));
    $(root, '[data-info]')!.innerHTML = `<b>${band.id} · ${band.name}</b> (${formatHz(band.from)}–${formatHz(band.to)})<br>λ = c / f = <b>${formatLength(wavelength(hz))}</b> · Uses: ${band.uses} · ${band.trait}`;
  };
  f.value = String(toSlider(2.4e9));
  f.addEventListener('input', run);
  $$<HTMLButtonElement>(root, '[data-band]').forEach((el) => el.addEventListener('click', () => { f.value = String(toSlider(Math.sqrt(num(el.dataset.from) * num(el.dataset.to)))); run(); }));
  run();
}

function evolution(root: HTMLElement) {
  const btns = $$<HTMLButtonElement>(root, '[data-scale]');
  const rows = $$(root, '[data-rate]');
  const max = Math.max(...rows.map((r) => num(r.dataset.rate)));
  const run = (scale: string) => rows.forEach((r) => {
    const v = num(r.dataset.rate);
    const pct = scale === 'log' ? ((Math.log10(v) - 7) / (Math.log10(max) - 7)) * 100 : (v / max) * 100;
    $(r, 'i')!.style.width = `${Math.max(1, pct)}%`;
  });
  btns.forEach((b) => b.addEventListener('click', () => { press(btns, b); run(b.dataset.scale!); }));
  run('log');
}

/** "Pick the right category" lists: every <li data-answer> gets one button per choice. */
function sorter(root: HTMLElement) {
  const choices = (root.dataset.choices ?? '').split('|');
  for (const li of $$(root, 'li[data-answer]')) {
    const row = document.createElement('span');
    row.className = 'wl-sort-btns';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', `Category for: ${li.textContent?.trim()}`);
    for (const c of choices) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = c;
      b.addEventListener('click', () => {
        const ok = c === li.dataset.answer;
        row.querySelectorAll('button').forEach((x) => x.classList.remove('ok', 'bad'));
        b.classList.add(ok ? 'ok' : 'bad');
        li.classList.toggle('ok', ok);
        li.classList.toggle('bad', !ok);
      });
      row.append(b);
    }
    li.append(row);
  }
}

function doppler(root: HTMLElement) {
  const run = () => {
    const kmh = num($<HTMLInputElement>(root, '[name=v]')!.value), ghz = num($<HTMLInputElement>(root, '[name=f]')!.value);
    const v = kmh / 3.6, f = ghz * 1e9;
    $(root, '[data-out]')!.textContent = Number.isFinite(v) && f > 0
      ? `v = ${fmt(v)} m/s · λ = ${formatLength(wavelength(f))} → f_d = v·f / c ≈ ${fmt(dopplerHz(v, f))} Hz`
      : 'Enter a speed and a frequency.';
  };
  root.addEventListener('input', run); run();
}

function fspl(root: HTMLElement) {
  const run = () => {
    const d = num($<HTMLSelectElement>(root, '[name=d]')!.value), f = num($<HTMLSelectElement>(root, '[name=f]')!.value);
    const factor = d * d * f * f;
    $(root, '[data-out]')!.textContent = `Loss × ${fmt(factor)} = +${fmt(10 * Math.log10(factor))} dB (d² gives ×${d * d}, f² gives ×${f * f})`;
  };
  root.addEventListener('change', run); run();
}

function flips(scope: ParentNode) {
  $$<HTMLButtonElement>(scope, '.wl-flip').forEach((b) => b.addEventListener('click', () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'))));
}

function topology(root: HTMLElement) {
  const svg = $(root, '[data-topo-svg]')!, text = $(root, '[data-topo-text]')!;
  const node = (x: number, y: number, label: string, ap = false) =>
    `<g class="${ap ? 'ap' : 'dev'}"><circle cx="${x}" cy="${y}" r="${ap ? 26 : 20}"/><text x="${x}" y="${y + 4}" text-anchor="middle">${label}</text></g>`;
  const link = (a: [number, number], b: [number, number]) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`;
  const packet = (pts: [number, number][]) => {
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
    return `<path id="wl-pkt" d="${path}" fill="none" stroke="none"/>${reduced() ? '' : `<circle class="pkt" r="6"><animateMotion dur="${pts.length * 0.9}s" repeatCount="indefinite"><mpath href="#wl-pkt"/></animateMotion></circle>`}`;
  };
  const views: Record<string, [string, string]> = {
    infra: [
      link([260, 50], [90, 170]) + link([260, 50], [260, 170]) + link([260, 50], [430, 170]) + node(260, 50, 'AP', true) + node(90, 170, 'A') + node(260, 170, 'Dev') + node(430, 170, 'B') + packet([[90, 170], [260, 50], [430, 170]]),
      '<b>Infrastructure-based.</b> The access point (or cellular base station) controls access, addressing and handover. Even A → B, two nearby devices, goes <b>through the AP</b>.',
    ],
    direct: [
      link([130, 110], [390, 110]) + node(130, 110, 'A') + node(390, 110, 'B') + packet([[130, 110], [390, 110]]),
      '<b>Direct (infrastructure-less).</b> Wi-Fi Direct or Bluetooth: devices link in <b>one hop</b> with no access point.',
    ],
    multi: [
      link([70, 150], [200, 70]) + link([200, 70], [330, 150]) + link([330, 150], [450, 70]) + node(70, 150, 'A') + node(200, 70, 'R1') + node(330, 150, 'R2') + node(450, 70, 'B') + packet([[70, 150], [200, 70], [330, 150], [450, 70]]),
      '<b>Multihop (infrastructure-less).</b> MANET, VANET or WSN: nodes self-organise and <b>relay for each other</b>; no single point of failure.',
    ],
  };
  const btns = $$<HTMLButtonElement>(root, '[data-topo]');
  const show = (k: string) => { svg.innerHTML = views[k][0]; text.innerHTML = views[k][1]; };
  btns.forEach((b) => b.addEventListener('click', () => { press(btns, b); show(b.dataset.topo!); }));
  show('infra');
}

function hops(root: HTMLElement) {
  const n = $<HTMLInputElement>(root, '[data-n]')!, k = $<HTMLInputElement>(root, '[data-k]')!, track = $(root, '[data-track]')!;
  const run = () => {
    const N = num(n.value), K = num(k.value), ratio = multihopPowerRatio(K, N);
    $(root, '[data-n-out]')!.textContent = String(N);
    $(root, '[data-k-out]')!.textContent = String(K);
    $(root, '[data-power]')!.textContent = `${fmt(ratio * 100)}% (${ratio < 1 ? `saves ${fmt((1 - ratio) * 100)}%` : 'same'})`;
    $(root, '[data-power-bar]')!.style.width = `${ratio * 100}%`;
    $(root, '[data-delay]')!.textContent = `× ${K}`;
    $(root, '[data-delay-bar]')!.style.width = `${(K / 5) * 100}%`;
    track.innerHTML = Array.from({ length: K + 1 }, (_, i) => `<span class="${i === 0 ? 'a' : i === K ? 'b' : 'r'}" style="--x:${(i / K) * 100}%">${i === 0 ? 'A' : i === K ? 'B' : `R${i}`}</span>`).join('');
  };
  root.addEventListener('input', run); run();
}

function reveal(scope: ParentNode) {
  $$<HTMLButtonElement>(scope, '[data-reveal-next]').forEach((b) => b.addEventListener('click', () => { b.nextElementSibling?.removeAttribute('hidden'); b.hidden = true; }));
}

/* ---------------------------------------------------------- canvas widgets */

type Anim = { draw: (t: number) => void; animated: boolean };
const anims: Anim[] = [];

function inverse(root: HTMLElement) {
  const canvas = $<HTMLCanvasElement>(root, '[data-canvas]')!, r = $<HTMLInputElement>(root, '[data-r]')!;
  const draw = () => {
    const { g, w, h } = prep(canvas), R = num(r.value);
    const cx = 40, cy = h / 2, scale = (w - 60) / 10;
    g.fillStyle = css('--accent-text');
    g.beginPath(); g.arc(cx, cy, 6, 0, Math.PI * 2); g.fill();
    for (let i = 1; i <= 10; i++) { g.strokeStyle = i <= R ? css('--info') : css('--line'); g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, i * scale, -0.5, 0.5); g.stroke(); }
    // a fixed bundle of 24 "energy rays": fewer cross each square at larger r
    g.strokeStyle = css('--accent-text'); g.globalAlpha = 0.5;
    for (let i = 0; i < 24; i++) { const a = -0.45 + (i / 23) * 0.9; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * R * scale, cy + Math.sin(a) * R * scale); g.stroke(); }
    g.globalAlpha = 1;
    const box = 22; g.strokeStyle = css('--warn'); g.lineWidth = 2; g.strokeRect(cx + R * scale - box / 2, cy - box / 2, box, box);
    $(root, '[data-r-out]')!.textContent = `${R} m`;
    $(root, '[data-out]')!.textContent = `Power density at ${R} m = 1/${fmt(R * R)} of the value at 1 m (${fmt(100 / (R * R))}%). Double the distance → ¼ of the power.`;
  };
  r.addEventListener('input', draw);
  anims.push({ draw, animated: false });
}

function em(root: HTMLElement) {
  const canvas = $<HTMLCanvasElement>(root, '[data-canvas]')!;
  let paused = false, offset = 0;
  const pause = $<HTMLButtonElement>(root, '[data-pause]')!;
  pause.addEventListener('click', () => { paused = !paused; pause.textContent = paused ? 'Play' : 'Pause'; });
  const draw = (t: number) => {
    if (!paused) offset = t / 600;
    const { g, w, h } = prep(canvas), mid = h / 2, k = (Math.PI * 2) / (w / 2.2);
    axis(g, w, mid);
    // B is drawn in a skewed (perspective) plane, perpendicular to E
    g.globalAlpha = 0.9;
    for (let x = 0; x <= w; x += 10) {
      const b = Math.sin(k * x - offset) * 0.55;
      g.strokeStyle = css('--info'); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, mid); g.lineTo(x + b * 40, mid + b * 26); g.stroke();
    }
    g.globalAlpha = 1;
    curve(g, w, (x) => mid - Math.sin(k * x - offset) * (h * 0.38), css('--accent-text'), 2.5);
    g.fillStyle = css('--text-3'); g.font = '12px ui-monospace, monospace';
    g.fillText('E (vertical)', 8, 16); g.fillText('B (horizontal)', 8, h - 8); g.fillText('travel →', w - 70, mid - 8);
  };
  anims.push({ draw, animated: true });
}

function polar(root: HTMLElement) {
  const t = $<HTMLInputElement>(root, '[data-t]')!;
  const run = () => {
    const deg = num(t.value), p = Math.cos((deg * Math.PI) / 180) ** 2;
    $(root, '[data-ant]')!.style.transform = `rotate(${deg}deg)`;
    $(root, '[data-t-out]')!.textContent = `${deg}°`;
    $(root, '[data-out]')!.textContent = `Received power ≈ ${fmt(p * 100)}% of an aligned antenna${deg === 90 ? ' — cross-polarized: almost nothing' : ''}.`;
  };
  t.addEventListener('input', run); run();
}

function amp(root: HTMLElement) {
  const canvas = $<HTMLCanvasElement>(root, '[data-canvas]')!, a = $<HTMLInputElement>(root, '[data-a]')!, l = $<HTMLInputElement>(root, '[data-l]')!;
  const draw = () => {
    const { g, w, h } = prep(canvas), A = num(a.value), L = num(l.value), mid = h / 2, px = w / 4; // 4 m across
    axis(g, w, mid);
    curve(g, w, (x) => mid - Math.sin((2 * Math.PI * x) / (L * px)) * A * (h * 0.36), css('--accent-text'));
    const peak = (L * px) / 4, top = mid - A * h * 0.36;
    g.strokeStyle = css('--warn'); g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(peak, mid); g.lineTo(peak, top); g.stroke();
    g.beginPath(); g.moveTo(peak, top - 8); g.lineTo(peak + L * px, top - 8); g.stroke();
    g.fillStyle = css('--warn'); g.font = '12px ui-monospace, monospace';
    g.fillText('A', peak + 5, (mid + top) / 2); g.fillText('λ', peak + (L * px) / 2, top - 12);
    $(root, '[data-a-out]')!.textContent = A.toFixed(1);
    $(root, '[data-l-out]')!.textContent = `${L.toFixed(2)} m`;
    $(root, '[data-out]')!.textContent = `Power ∝ A² = ${fmt(A * A)} (×${fmt(A * A)} the power of A = 1) · Half-wave dipole = λ/2 = ${fmt(L / 2)} m`;
  };
  root.addEventListener('input', draw);
  anims.push({ draw, animated: false });
}

function freq(root: HTMLElement) {
  const canvas = $<HTMLCanvasElement>(root, '[data-canvas]')!, f = $<HTMLInputElement>(root, '[data-f]')!;
  const draw = () => {
    const { g, w, h } = prep(canvas), F = num(f.value), mid = h / 2 - 8, x0 = 10, x1 = w - 10;
    axis(g, w, mid);
    g.save(); g.beginPath(); g.rect(x0, 0, x1 - x0, h); g.clip();
    curve(g, w, (x) => mid - Math.sin(((x - x0) / (x1 - x0)) * F * 2 * Math.PI) * (h * 0.32), css('--accent-text'));
    g.restore();
    g.fillStyle = css('--text-3'); g.font = '12px ui-monospace, monospace';
    g.fillText('0 s', x0, h - 4); g.fillText('1 s', x1 - 22, h - 4);
    g.fillStyle = css('--warn'); g.fillRect(x0, h - 26, (x1 - x0) / F, 4); g.fillText(`T = ${fmt(1 / F)} s`, x0 + 4, h - 32);
    $(root, '[data-f-out]')!.textContent = `${F} Hz`;
    $(root, '[data-out]')!.textContent = `${F} cycle${F === 1 ? '' : 's'} in 1 second → f = ${F} Hz and T = 1/f = ${fmt(1 / F)} s`;
  };
  f.addEventListener('input', draw);
  $$<HTMLButtonElement>(root, '[data-preset]').forEach((b) => b.addEventListener('click', () => { f.value = b.dataset.preset!; draw(); }));
  anims.push({ draw, animated: false });
}

function periodCalc(root: HTMLElement) {
  const run = () => {
    const hz = num($<HTMLInputElement>(root, '[name=v]')!.value) * num($<HTMLSelectElement>(root, '[name=u]')!.value);
    $(root, '[data-out]')!.textContent = hz > 0 ? `f = ${formatHz(hz)} → T = 1 / f = ${formatSeconds(period(hz))}` : 'Enter a positive frequency.';
  };
  root.addEventListener('input', run); run();
}

function lambda(root: HTMLElement) {
  const canvas = $<HTMLCanvasElement>(root, '[data-canvas]')!, v = $<HTMLInputElement>(root, '[name=v]')!, u = $<HTMLSelectElement>(root, '[name=u]')!;
  const draw = () => {
    const hz = num(v.value) * num(u.value), out = $(root, '[data-out]')!;
    const { g, w, h } = prep(canvas), mid = h / 2 - 6;
    axis(g, w, mid);
    if (!(hz > 0)) { out.textContent = 'Enter a positive frequency.'; return; }
    const lam = wavelength(hz), cycles = 0.25 / lam;
    if (cycles <= 60) curve(g, w, (x) => mid - Math.sin((x / w) * cycles * 2 * Math.PI) * (h * 0.3), css('--accent-text'));
    g.fillStyle = css('--text-3'); g.font = '12px ui-monospace, monospace';
    g.fillText('0', 2, h - 4); g.fillText('25 cm', w - 44, h - 4);
    const mhz = hz / 1e6;
    out.textContent = `λ = c / f = 3×10⁸ / ${fmt(hz)} = ${formatLength(lam)}  (300 / ${fmt(mhz)} MHz)  ·  λ/2 dipole = ${formatLength(lam / 2)}  ·  λ/4 antenna = ${formatLength(lam / 4)}${cycles > 60 ? '  ·  too many waves to draw in 25 cm' : `  ·  ${fmt(cycles)} waves in 25 cm`}`;
  };
  root.addEventListener('input', draw);
  $$<HTMLButtonElement>(root, '[data-preset]').forEach((b) => b.addEventListener('click', () => { v.value = b.dataset.preset!; u.value = '1e9'; draw(); }));
  anims.push({ draw, animated: false });
}

function modulation(root: HTMLElement) {
  const canvas = $<HTMLCanvasElement>(root, '[data-canvas]')!;
  const bits = $$<HTMLButtonElement>(root, '[data-bits] button');
  const schemes = $$<HTMLButtonElement>(root, '[data-scheme]');
  let scheme = 'ask';
  const notes: Record<string, string> = {
    ask: 'ASK: bit 1 → full amplitude, bit 0 → small amplitude. Frequency and phase stay the same.',
    fsk: 'FSK: bit 1 → higher frequency, bit 0 → lower frequency. Amplitude stays the same.',
    psk: 'PSK: bit 1 → phase 0, bit 0 → phase π (the wave flips). Amplitude and frequency stay the same.',
  };
  const draw = () => {
    const { g, w, h } = prep(canvas), seq = bits.map((b) => b.getAttribute('aria-pressed') === 'true'), n = seq.length, slot = w / n, mid = h / 2 + 6;
    seq.forEach((one, i) => {
      g.fillStyle = one ? css('--accent-soft') : 'transparent'; g.fillRect(i * slot, 0, slot, h);
      g.fillStyle = css('--text-3'); g.font = '13px ui-monospace, monospace'; g.fillText(one ? '1' : '0', i * slot + slot / 2 - 4, 16);
      g.strokeStyle = css('--line'); g.beginPath(); g.moveTo(i * slot, 0); g.lineTo(i * slot, h); g.stroke();
    });
    const amp = h * 0.32;
    curve(g, w, (x) => {
      const i = Math.min(n - 1, Math.floor(x / slot)), one = seq[i], local = (x - i * slot) / slot;
      if (scheme === 'ask') return mid - Math.sin(local * 6 * Math.PI) * amp * (one ? 1 : 0.25);
      if (scheme === 'fsk') return mid - Math.sin(local * (one ? 8 : 4) * Math.PI) * amp;
      return mid - Math.sin(local * 6 * Math.PI + (one ? 0 : Math.PI)) * amp;
    }, css('--info'), 2.2);
    $(root, '[data-out]')!.textContent = `Bits ${seq.map((b) => (b ? 1 : 0)).join(' ')} · ${notes[scheme]}`;
  };
  bits.forEach((b) => b.addEventListener('click', () => { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '1' : '0'; draw(); }));
  schemes.forEach((b) => b.addEventListener('click', () => { press(schemes, b); scheme = b.dataset.scheme!; draw(); }));
  anims.push({ draw, animated: false });
}

function spectrum(root: HTMLElement) {
  const info: string[] = [
    '<b>Radio.</b> Long wavelengths. Together with microwaves (below about 300 GHz) it carries most wireless networks: AM, FM, TV, cellular.',
    '<b>Microwave.</b> Wi-Fi, microwave links, satellite (C, Ku, Ka bands) and millimetre-wave 5G. Still below about 300 GHz.',
    '<b>Infrared.</b> Serves remote controls; infrared and optical links use frequencies above the radio bands.',
    '<b>Visible light.</b> Occupies only a small part of the spectrum. Li-Fi sends data over visible light.',
    '<b>Ultraviolet.</b> Higher frequency, shorter wavelength than visible light. Not used for wireless networks.',
    '<b>X-rays.</b> Very high frequency; still travels at c in a vacuum.',
    '<b>Gamma rays.</b> The highest frequency and shortest wavelength. All electromagnetic waves travel at c in a vacuum.',
  ];
  const btns = $$<HTMLButtonElement>(root, '[data-region]');
  btns.forEach((b) => b.addEventListener('click', () => { press(btns, b); $(root, '[data-info]')!.innerHTML = info[num(b.dataset.region)]; }));
}

function examples(sec: HTMLElement) {
  const out = $(sec, '[data-examples-out]')!;
  $$<HTMLButtonElement>(sec, '[data-examples] button').forEach((b) => b.addEventListener('click', () => {
    const f1 = num(b.dataset.hz), f2 = b.dataset.hz2 ? num(b.dataset.hz2) : 0;
    const one = (f: number) => `${formatHz(f)} → λ = ${formatLength(C / f)}`;
    out.textContent = `${b.querySelector('b')!.textContent}: ${one(f1)}${f2 ? `  ·  ${one(f2)}` : ''}`;
  }));
}

function quiz(root: HTMLElement) {
  const solved = new Set<number>();
  const qs = $$(root, '[data-q]');
  const score = () => { const s = root.closest('.wl-sec')!.querySelector('[data-score]'); if (s) s.textContent = `Score: ${solved.size} / ${qs.length}`; };
  qs.forEach((q, i) => {
    const msg = $(q, '[data-msg]')!;
    const choices = $(q, '[data-correct]');
    choices?.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-choice]'); if (!b) return;
      const ok = b.dataset.choice === choices.dataset.correct;
      choices.querySelectorAll('button').forEach((x) => x.classList.remove('ok', 'bad'));
      b.classList.add(ok ? 'ok' : 'bad');
      msg.textContent = ok ? 'Correct!' : 'Not quite — try another option.';
      if (ok) solved.add(i); score();
    });
    $(q, '[data-check]')?.addEventListener('click', () => {
      const all = $$(q, '[data-num]').map((l) => {
        const v = $<HTMLInputElement>(l, 'input')!.value, want = num(l.dataset.answer), tol = num(l.dataset.tol);
        const ok = v.trim() !== '' && Math.abs(num(v) - want) <= Math.abs(want) * tol;
        l.classList.toggle('ok', ok); l.classList.toggle('bad', !ok);
        return ok;
      });
      const ok = all.every(Boolean);
      msg.textContent = ok ? 'Correct!' : 'Not yet — check your units, then try again.';
      if (ok) solved.add(i); score();
    });
  });
}

/* ------------------------------------------------- viewer, progress, present */

function viewer() {
  const dlg = document.querySelector<HTMLDialogElement>('[data-viewer]');
  if (!dlg) return;
  const map = JSON.parse(dlg.dataset.map ?? '{}') as Record<string, { id: string; title: string }>;
  let page = 1;
  const show = (p: number) => {
    page = Math.min(PAGES, Math.max(1, p));
    const img = $<HTMLImageElement>(dlg, '[data-v-img]')!;
    img.src = `/wireless/lecture-01/slide-${String(page).padStart(2, '0')}.webp`;
    img.alt = `Lecture 1, slide ${page}: ${map[page]?.title ?? ''}`;
    $(dlg, '[data-v-num]')!.textContent = `Slide ${page}`;
    $(dlg, '[data-v-sec]')!.textContent = map[page] ? `· ${map[page].title}` : '';
    $<HTMLAnchorElement>(dlg, '[data-v-pdf]')!.href = `${PDF}#page=${page}`;
    $<HTMLAnchorElement>(dlg, '[data-v-go]')!.href = `#${map[page]?.id ?? 'top'}`;
    $<HTMLButtonElement>(dlg, '[data-v-prev]')!.disabled = page === 1;
    $<HTMLButtonElement>(dlg, '[data-v-next]')!.disabled = page === PAGES;
  };
  document.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-open-slide]');
    if (!b) return;
    show(num(b.dataset.openSlide));
    if (!dlg.open) dlg.showModal();
  });
  $(dlg, '[data-v-prev]')!.addEventListener('click', () => show(page - 1));
  $(dlg, '[data-v-next]')!.addEventListener('click', () => show(page + 1));
  $(dlg, '[data-v-close]')!.addEventListener('click', () => dlg.close());
  $(dlg, '[data-v-go]')!.addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') show(page + 1); if (e.key === 'ArrowLeft') show(page - 1); });
}

function progress(root: HTMLElement) {
  const ids = (root.dataset.sections ?? '').split(',');
  let done = new Set<string>();
  try { done = new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]')); } catch {}
  const paint = () => {
    document.querySelectorAll<HTMLElement>('[data-progress]').forEach((el) => (el.textContent = `${done.size}/${ids.length}`));
    document.querySelectorAll<HTMLElement>('[data-dial]').forEach((el) => el.style.setProperty('--p', `${(done.size / ids.length) * 100}%`));
    $$<HTMLInputElement>(document, '[data-got]').forEach((b) => (b.checked = done.has(b.dataset.got!)));
    $$(document, '[data-nav]').forEach((a) => a.classList.toggle('done', done.has(a.dataset.nav!)));
    const fin = document.querySelector('[data-finish-msg]');
    if (fin) fin.textContent = done.size === ids.length ? 'You have marked every section as understood. Well done — Lecture 1 is complete.' : `${done.size} of ${ids.length} sections marked as understood. Tick “I’ve got this” on the rest to complete the lecture.`;
  };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...done])); } catch {} paint(); };
  document.addEventListener('change', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLInputElement>('[data-got]'); if (!b) return;
    if (b.checked) done.add(b.dataset.got!); else done.delete(b.dataset.got!); save();
  });
  document.querySelector('[data-reset]')?.addEventListener('click', () => { if (confirm('Reset your Lecture 1 progress in this browser?')) { done.clear(); save(); } });
  paint();

  const links = $$<HTMLAnchorElement>(document, '[data-nav]');
  const obs = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) links.forEach((a) => a.classList.toggle('active', a.dataset.nav === en.target.id));
  }, { rootMargin: '-30% 0px -60%' });
  $$(root, '[data-sec]').forEach((s) => obs.observe(s));
}

function present(root: HTMLElement) {
  const bar = document.querySelector<HTMLElement>('[data-presenter]');
  const secs = $$(root, '[data-sec]');
  if (!bar || !secs.length) return;
  let i = 0;
  const go = (n: number) => {
    i = Math.min(secs.length - 1, Math.max(0, n));
    secs.forEach((s, k) => s.classList.toggle('wl-current', k === i));
    $(bar, '[data-p-count]')!.textContent = `${i + 1} / ${secs.length}`;
    window.scrollTo({ top: 0 });
    window.dispatchEvent(new Event('resize'));
  };
  const enter = () => {
    const visible = secs.findIndex((s) => s.getBoundingClientRect().bottom > 120);
    document.documentElement.classList.add('wl-presenting'); bar.hidden = false; go(Math.max(0, visible));
  };
  const exit = () => {
    document.documentElement.classList.remove('wl-presenting'); bar.hidden = true;
    secs.forEach((s) => s.classList.remove('wl-current')); secs[i].scrollIntoView();
  };
  document.querySelectorAll('[data-present]').forEach((b) => b.addEventListener('click', enter));
  $(bar, '[data-p-prev]')!.addEventListener('click', () => go(i - 1));
  $(bar, '[data-p-next]')!.addEventListener('click', () => go(i + 1));
  $(bar, '[data-p-exit]')!.addEventListener('click', exit);
  document.addEventListener('keydown', (e) => {
    if (!document.documentElement.classList.contains('wl-presenting') || document.querySelector('dialog[open]')) return;
    if ((e.target as HTMLElement).closest('input, select, textarea')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(i + 1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(i - 1); }
    if (e.key === 'Escape') exit();
  });
}

function glossary() {
  const q = document.querySelector<HTMLInputElement>('[data-gloss-q]');
  q?.addEventListener('input', () => {
    const v = q.value.trim().toLowerCase();
    $$(document, '[data-gloss] > div').forEach((d) => (d.hidden = !!v && !d.dataset.text!.includes(v)));
  });
}

/* --------------------------------------------------------------------- init */

export function initLecture() {
  const root = document.querySelector<HTMLElement>('[data-lecture]');
  if (!root || root.dataset.wired) return;
  root.dataset.wired = '1';
  anims.length = 0;
  const each = (sel: string, fn: (el: HTMLElement) => void) => $$(root, sel).forEach(fn);
  each('[data-snr]', snr);
  each('[data-chain]', chain);
  each('[data-then-now]', (el) => segPanels(el, 'data-era', 'data-era-panel'));
  each('[data-handover]', handover);
  each('[data-timeline]', timeline);
  each('[data-order]', order);
  each('[data-shannon]', shannon);
  each('[data-bands]', bands);
  each('[data-evolution]', evolution);
  each('[data-sort]', sorter);
  each('[data-doppler]', doppler);
  each('[data-fspl]', fspl);
  each('[data-topology]', topology);
  each('[data-hops]', hops);
  each('[data-inverse]', inverse);
  each('[data-em]', em);
  each('[data-polar]', polar);
  each('[data-amp]', amp);
  each('[data-freq]', freq);
  each('[data-period]', periodCalc);
  each('[data-lambda]', lambda);
  each('[data-mod]', modulation);
  each('[data-spectrum]', spectrum);
  each('#examples', examples);
  each('[data-quiz]', quiz);
  flips(root); reveal(root);
  viewer(); progress(root); present(root); glossary();

  // draw every canvas now and on resize; only the EM wave animates, and only while it is on screen
  const drawAll = () => anims.forEach((a) => a.draw(performance.now()));
  drawAll();
  let raf = 0;
  window.addEventListener('resize', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(drawAll); });
  const moving = anims.filter((a) => a.animated);
  if (moving.length && !reduced()) {
    const emCanvas = root.querySelector('[data-em] canvas')!;
    let visible = false;
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(emCanvas);
    const loop = (t: number) => {
      if (!document.body.contains(root)) return; // page swapped away
      if (visible) moving.forEach((a) => a.draw(t));
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
