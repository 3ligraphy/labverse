/**
 * Wireless Networks · Sheet 2 — the page's own interactive pieces: the hexagon cluster explorer, the (i, j) shift
 * checks, the reuse calculators, the sectoring simulator and the advantages/disadvantages sort.
 */
import { clusterSize, reuseDistance, reuseRatio, shiftsFor, sirDb, validClusterSizes } from '@/lib/wireless/core';
import { add, DIRECTIONS, grid, shiftVectors, tiling, toPixel, type Hex } from '@/lib/wireless/hex';

const fmt = (n: number, p = 4) => String(Number(n.toPrecision(p)));
const $ = <T extends Element = HTMLElement>(root: ParentNode, sel: string) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(root: ParentNode, sel: string) => [...root.querySelectorAll<T>(sel)];
const same = (a: Hex, b: Hex) => a.q === b.q && a.r === b.r;
const MAX = 5;

/* ------------------------------------------------------------------ cluster explorer */

function corners(cx: number, cy: number, size: number) {
  return Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 180) * (60 * k + 30);
    return [cx + size * Math.cos(a), cy + size * Math.sin(a)] as const;
  });
}
const hue = (label: number, n: number) => (200 + label * (360 / Math.max(n, 1)) * 7) % 360;

function initExplorer(fig: HTMLElement) {
  const svg = $<SVGSVGElement>(fig, '[data-svg]')!;
  const triangle = fig.dataset.triangle === '1';
  let i = Number(fig.dataset.i), j = Number(fig.dataset.j);
  let selected: Hex = { q: 0, r: 0 };

  const render = () => {
    const n = clusterSize(i, j);
    const t = tiling(i, j);
    const rings = triangle ? Math.max(3, i + j + 1) : Math.min(11, Math.max(4, i + j + 2));
    const cells = grid(rings);
    const size = 560 / (Math.sqrt(3) * (2 * rings + 1));
    const showBorders = $<HTMLInputElement>(fig, '[data-borders]')?.checked ?? true;
    const showLabels = ($<HTMLInputElement>(fig, '[data-labels]')?.checked ?? true) && size >= 11;
    const showTier = triangle || ($<HTMLInputElement>(fig, '[data-tier]')?.checked ?? true);
    if (Math.max(Math.abs(selected.q), Math.abs(selected.r), Math.abs(selected.q + selected.r)) > rings) selected = { q: 0, r: 0 };
    const selLabel = t.label(selected);
    const { v1, turn } = shiftVectors(i, j);
    const tier = t.firstTier(selected);
    const P = (h: Hex) => toPixel(h, size);

    const inGrid = new Set(cells.map((h) => `${h.q},${h.r}`));
    let cellsSvg = '', labels = '', borders = '';
    for (const h of cells) {
      const { x, y } = P(h);
      const label = t.label(h);
      const co = label === selLabel;
      const isSel = same(h, selected);
      const fill = co ? (isSel ? '#ffffff' : '#63e6ff') : `hsl(${hue(label, n)} 60% 55% / ${label % 2 ? 0.16 : 0.24})`;
      const pts = corners(x, y, size * 0.985).map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
      cellsSvg += `<polygon class="cell${co ? ' co' : ''}${isSel ? ' sel' : ''}" points="${pts}" fill="${fill}" data-q="${h.q}" data-r="${h.r}"><title>Channel set ${label + 1}</title></polygon>`;
      if (showLabels) labels += `<text class="lbl${co ? ' co' : ''}" x="${x.toFixed(1)}" y="${y.toFixed(1)}">${label + 1}</text>`;
      if (showBorders && n > 1) {
        const c = corners(x, y, size);
        for (let d = 0; d < 3; d++) {
          const nb = add(h, DIRECTIONS[d]);
          if (!inGrid.has(`${nb.q},${nb.r}`) || t.copy(nb) === t.copy(h)) continue;
          const [a, b] = [c[(6 - d) % 6], c[(5 - d + 6) % 6]];
          borders += `<line class="border" x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}"/>`;
        }
      }
    }

    // The i-then-j path from the selected cell, and the reuse distance D that closes the triangle.
    let overlay = '';
    const s = P(selected), m = P(add(selected, turn)), e = P(add(selected, v1));
    if (showTier && !triangle && n > 1) for (const h of tier) { const p = P(h); overlay += `<line class="tier" x1="${s.x}" y1="${s.y}" x2="${p.x}" y2="${p.y}"/>`; }
    if (n > 1) {
      overlay += `<line class="dline" x1="${s.x}" y1="${s.y}" x2="${e.x}" y2="${e.y}"/>`;
      overlay += `<polyline class="path" points="${s.x},${s.y} ${m.x},${m.y} ${e.x},${e.y}" marker-end="url(#cx-arrow-${fig.dataset.uid})"/>`;
      const mid = (a: { x: number; y: number }, b: { x: number; y: number }, off = 0) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + off });
      // Put each side's label on the outside of the triangle, away from the opposite corner.
      const outside = (a: { x: number; y: number }, b: { x: number; y: number }, away: { x: number; y: number }, dist: number) => {
        const c = mid(a, b), len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        let nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
        if ((away.x - c.x) * nx + (away.y - c.y) * ny > 0) { nx = -nx; ny = -ny; }
        return { x: c.x + nx * dist, y: c.y + ny * dist };
      };
      const third = j > 0 ? e : { x: m.x, y: m.y - size };
      if (i > 0) { const p = outside(s, m, third, size * 0.75); overlay += `<text class="tag y" x="${p.x}" y="${p.y}">${triangle ? 'i(2R′)' : `i = ${i}`}</text>`; }
      if (j > 0) { const p = outside(m, e, s, size * 0.95); overlay += `<text class="tag y" x="${p.x}" y="${p.y}">${triangle ? 'j(2R′)' : `j = ${j}`}</text>`; }
      if (i > 0 && j > 0) { const pd = outside(s, e, m, size * 0.75); overlay += `<text class="tag p" x="${pd.x}" y="${pd.y}">D</text>`; }
      if (triangle && i > 0 && j > 0) {
        const r = size * 0.9;
        // the inside angle at the turn: from the direction back to the start (west) round to the j-direction (north-east)
        const a1 = Math.atan2(s.y - m.y, s.x - m.x), a2 = Math.atan2(e.y - m.y, e.x - m.x);
        let delta = a2 - a1; while (delta <= -Math.PI) delta += 2 * Math.PI; while (delta > Math.PI) delta -= 2 * Math.PI;
        overlay += `<path class="arc" d="M ${m.x + r * Math.cos(a1)} ${m.y + r * Math.sin(a1)} A ${r} ${r} 0 0 ${delta > 0 ? 1 : 0} ${m.x + r * Math.cos(a2)} ${m.y + r * Math.sin(a2)}"/>`;
        const bis = a1 + delta / 2;
        overlay += `<text class="tag w" x="${m.x + r * 1.75 * Math.cos(bis)}" y="${m.y + r * 1.75 * Math.sin(bis)}">120°</text>`;
        overlay += `<text class="tag w" x="${s.x - size * 1.3}" y="${s.y}">C1</text><text class="tag w" x="${m.x + size * 0.9}" y="${m.y + size * 0.9}">C2</text><text class="tag w" x="${e.x + size * 1.3}" y="${e.y}">C1</text>`;
      }
    }
    const pad = 8, w = Math.sqrt(3) * size * (2 * rings + 1), h = size * (3 * rings + 2);
    svg.setAttribute('viewBox', `${-w / 2 - pad} ${-h / 2 - pad} ${w + 2 * pad} ${h + 2 * pad}`);
    svg.innerHTML = `<defs><marker id="cx-arrow-${fig.dataset.uid}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#ffd166"/></marker></defs>${cellsSvg}${borders}${labels}${overlay}`;
    svg.setAttribute('aria-label', `Hexagonal grid of clusters with ${n} cells each, shift i = ${i}, j = ${j}. Channel set ${selLabel + 1} is highlighted.`);

    $(fig, '[data-out="i"]')!.textContent = String(i);
    $(fig, '[data-out="j"]')!.textContent = String(j);
    $(fig, '[data-read="n"]')!.textContent = String(n);
    $(fig, '[data-read="q"]')!.textContent = fmt(reuseRatio(n));
    $(fig, '[data-read="f"]')!.textContent = `1/${n}`;
    $(fig, '[data-read="sel"]')!.textContent = `#${selLabel + 1}`;
    $$<HTMLButtonElement>(fig, '[data-d]').forEach((b) => {
      const [k, dv] = b.dataset.d!.split(':'); const v = (k === 'i' ? i : j) + Number(dv); const other = k === 'i' ? j : i;
      b.disabled = v < 0 || v > MAX || v + other === 0;
    });
    if (fig.dataset.touched) {
      $(fig, '[data-cap]')!.textContent = n === 1
        ? 'N = 1: every cell uses every channel. No reuse distance at all, and neighbours interfere.'
        : `Move ${i} cell${i === 1 ? '' : 's'}, turn 60°, move ${j} cell${j === 1 ? '' : 's'}: N = ${i}² + ${i}·${j} + ${j}² = ${n}, D = √(3·${n}) R = ${fmt(reuseRatio(n), 3)} R. The six cells in cyan reuse channel set ${selLabel + 1}.`;
    }
  };

  fig.addEventListener('click', (e) => {
    const target = e.target as Element;
    const step = target.closest<HTMLButtonElement>('[data-d]');
    if (step) {
      const [k, dv] = step.dataset.d!.split(':');
      if (k === 'i') i = Math.min(MAX, Math.max(0, i + Number(dv))); else j = Math.min(MAX, Math.max(0, j + Number(dv)));
      if (i + j === 0) k === 'i' ? (j = 1) : (i = 1);
      fig.dataset.touched = '1'; render(); return;
    }
    if (target.closest('[data-swap]')) { [i, j] = [j, i]; fig.dataset.touched = '1'; render(); return; }
    const cell = target.closest<SVGPolygonElement>('polygon.cell');
    if (cell) { selected = { q: Number(cell.dataset.q), r: Number(cell.dataset.r) }; fig.dataset.touched = '1'; render(); }
  });
  fig.addEventListener('change', (e) => { if ((e.target as Element).matches('input[type=checkbox]')) render(); });
  render();
}

/* ------------------------------------------------------------------ shift checks */

function initShiftChecks(root: ParentNode) {
  root.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('[data-shift] button');
    if (!btn) return;
    const box = btn.closest<HTMLElement>('[data-shift]')!;
    const target = Number(box.dataset.shift);
    const [iIn, jIn] = $$<HTMLInputElement>(box, 'input');
    const fb = $(box, '[data-feedback]')!;
    const i = Number(iIn.value), j = Number(jIn.value);
    let ok = false;
    if (iIn.value === '' || jIn.value === '' || !Number.isInteger(i) || !Number.isInteger(j) || i < 0 || j < 0) {
      fb.textContent = 'Enter two whole numbers, 0 or more.';
    } else {
      const n = clusterSize(i, j);
      ok = n === target;
      fb.textContent = ok
        ? `Correct — ${i}² + ${i}·${j} + ${j}² = ${i * i} + ${i * j} + ${j * j} = ${n}.${i < j ? ' (That is the mirror image of the solution’s shift; both work.)' : ''}`
        : `Not yet — ${i}² + ${i}·${j} + ${j}² = ${n}, not ${target}. ${n < target ? 'Try bigger values.' : 'Try smaller values.'}`;
    }
    box.classList.toggle('ok', ok); box.classList.toggle('bad', !ok);
  });
}

/* ------------------------------------------------------------------ reuse calculators */

function initReuse(root: ParentNode) {
  const mini = $<HTMLFormElement>(root, '[data-reuse-mini]');
  const runMini = () => {
    if (!mini) return;
    const fd = new FormData(mini); const n = Number(fd.get('n')), r = Number(fd.get('r'));
    const out = $(mini, 'output')!;
    if (!(n >= 1) || !(r >= 0)) { out.innerHTML = '<span>Enter N ≥ 1 and R ≥ 0</span>'; return; }
    out.innerHTML = `<span>D <b>${fmt(reuseDistance(r, n))} km</b></span><span>Q <b>${fmt(reuseRatio(n))}</b></span><span>1/N <b>${fmt(1 / n)}</b></span>`;
  };
  mini?.addEventListener('input', runMini); mini?.addEventListener('submit', (e) => e.preventDefault()); runMini();

  const form = $<HTMLFormElement>(root, '[data-reuse]');
  const run = () => {
    if (!form) return;
    const fd = new FormData(form); const n = Number(fd.get('n')), r = Number(fd.get('r'));
    const out = $(form, 'output')!;
    const shifts = Number.isInteger(n) && n >= 1 ? shiftsFor(n) : [];
    out.classList.toggle('bad', !shifts.length);
    if (!shifts.length) {
      const valid = validClusterSizes(Math.max(40, Math.ceil(n) + 10));
      const below = [...valid].reverse().find((v) => v < n), above = valid.find((v) => v > n);
      out.innerHTML = `<span>Not valid <b>no whole i, j</b></span><span>Nearest <b>${[below, above].filter(Boolean).join(' or ')}</b></span><span>Rule <b>i² + ij + j²</b></span>`;
      return;
    }
    const [i, j] = shifts[0];
    out.innerHTML = `<span>Shift <b>i = ${i}, j = ${j}</b></span><span>D <b>${fmt(reuseDistance(r, n))} km</b></span><span>Q <b>${fmt(reuseRatio(n))}</b></span>`;
  };
  form?.addEventListener('input', run); form?.addEventListener('submit', (e) => e.preventDefault()); run();
}

/* ------------------------------------------------------------------ sectoring simulator */

const INTERFERERS: Record<number, number> = { 1: 6, 3: 2, 6: 1 };

function initSectors(fig: HTMLElement) {
  const svg = $<SVGSVGElement>(fig, '[data-sector-svg]')!;
  let mode = 1;
  const render = () => {
    const n = Number($<HTMLSelectElement>(fig, '[data-sx-n]')!.value);
    const exp = Number($<HTMLInputElement>(fig, '[data-sx-exp]')!.value);
    const ch = Number($<HTMLInputElement>(fig, '[data-sx-ch]')!.value);
    const i0 = INTERFERERS[mode];
    const R = 120;
    const hex = corners(0, 0, R).map(([a, b]) => `${a},${b}`).join(' ');
    let body = '';
    if (mode === 1) {
      body += `<polygon points="${hex}" fill="#63e6ff" opacity=".18"/>`;
      for (let k = 1; k <= 3; k++) body += `<circle cx="0" cy="0" r="${k * 30}" fill="none" stroke="#63e6ff" stroke-opacity="${0.5 - k * 0.12}" stroke-width="1.5"/>`;
      body += `<text class="sl" x="0" y="34">Site · 360°</text>`;
    } else {
      // Sector boundaries run from the site to hexagon corners; a 120° layout uses every other corner.
      const span = 360 / mode;
      const start = -90; // a corner of the hexagon
      for (let k = 0; k < mode; k++) {
        const a0 = start + k * span, a1 = a0 + span, mid = ((a0 + a1) / 2) * (Math.PI / 180);
        const pts = [[0, 0]];
        for (let a = a0; a <= a1 + 0.01; a += span / 12) {
          // a ray from the centre to the hexagon edge at angle a (pointy-top hexagon: apothem R cos 30°)
          const rad = (a * Math.PI) / 180;
          const rel = ((((a + 30) % 60) + 60) % 60) - 30; // angle from the nearest flat-edge normal (normals at 0°, 60°, …)
          const dist = (R * Math.cos(Math.PI / 6)) / Math.cos((rel * Math.PI) / 180);
          pts.push([dist * Math.cos(rad), dist * Math.sin(rad)]);
        }
        body += `<polygon class="sec" points="${pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="hsl(${190 + k * (mode === 3 ? 50 : 25)} 80% 60% / ${k % 2 ? 0.22 : 0.32})"/>`;
        const bx = Math.cos(mid), by = Math.sin(mid);
        body += `<path class="beam" d="M 0 0 L ${(80 * Math.cos(mid - 0.3)).toFixed(1)} ${(80 * Math.sin(mid - 0.3)).toFixed(1)} Q ${(100 * bx).toFixed(1)} ${(100 * by).toFixed(1)} ${(80 * Math.cos(mid + 0.3)).toFixed(1)} ${(80 * Math.sin(mid + 0.3)).toFixed(1)} Z"/>`;
        body += `<text class="sl" x="${(62 * bx).toFixed(1)}" y="${(62 * by).toFixed(1)}">S${k + 1}</text>`;
      }
    }
    svg.innerHTML = `${body}<polygon class="hexo" points="${hex}"/><circle class="bs" cx="0" cy="0" r="6"/>`;
    svg.setAttribute('aria-label', mode === 1 ? 'One omnidirectional antenna covering the whole cell' : `${mode} directional antennas, each covering a ${360 / mode}° sector`);
    $(fig, '[data-sx-n-out]')!.textContent = exp.toFixed(1);
    $(fig, '[data-sx="ant"]')!.textContent = String(mode);
    $(fig, '[data-sx="i0"]')!.textContent = String(i0);
    $(fig, '[data-sx="sir"]')!.textContent = `${sirDb(n, exp, i0).toFixed(1)} dB`;
    $(fig, '[data-sx="ch"]')!.textContent = ch >= 1 ? fmt(ch / mode, 3) : '–';
    const gain = 10 * Math.log10(6 / i0);
    $(fig, '[data-sx-cap]')!.textContent = mode === 1
      ? 'One omnidirectional antenna hears all six first-tier co-channel cells.'
      : `${mode} directional antennas: each sector hears only ${i0} of the 6 first-tier co-channel cell${i0 === 1 ? '' : 's'}, so S/I improves by ${gain.toFixed(1)} dB, but each sector gets only 1/${mode} of the channels (the loss in traffic).`;
    $$<HTMLButtonElement>(fig, '[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.mode) === mode)));
  };
  fig.addEventListener('click', (e) => { const b = (e.target as Element).closest<HTMLButtonElement>('[data-mode]'); if (b) { mode = Number(b.dataset.mode); render(); } });
  fig.addEventListener('input', render);
  render();
}

/* ------------------------------------------------------------------ advantages / disadvantages */

function initSort(list: HTMLElement) {
  const score = list.closest('section')?.querySelector<HTMLElement>('[data-sort-score]');
  list.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('[data-pick]');
    if (!b) return;
    const li = b.closest<HTMLElement>('li')!;
    $$<HTMLButtonElement>(li, '[data-pick]').forEach((x) => x.classList.toggle('on', x === b));
    const ok = b.dataset.pick === li.dataset.side;
    li.classList.toggle('ok', ok); li.classList.toggle('bad', !ok);
    const items = $$(list, 'li'), right = items.filter((x) => x.classList.contains('ok')).length;
    if (score) score.textContent = right === items.length ? `All ${items.length} sorted correctly ✓` : `${right} of ${items.length} sorted`;
  });
}

export function initSheet2(root: ParentNode) {
  $$(root, '[data-hexlab]').forEach((fig, k) => { fig.dataset.uid = String(k); initExplorer(fig); });
  initShiftChecks(root);
  initReuse(root);
  $$(root, '[data-sectors]').forEach(initSectors);
  $$(root, '[data-sort]').forEach(initSort);
}
