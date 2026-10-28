/**
 * Animated, hands-on explanations for Introduction to Computing. Every visual asks the student to DO something
 * (press, drag, type a value, predict) — watching alone teaches little. Motion respects prefers-reduced-motion.
 */
import { h, md, prefersReducedMotion } from '../../ui/dom.ts';
import { clearPick, draggable, dropPicked } from '../../ui/dnd.ts';
import { formatG } from '../values.ts';
import { highlightCpp } from './syntax.ts';
import { btn, code, fly, kb, sleep } from './anim.ts';
import { anatomyVisual, flowVisual, mainVisual, toolboxVisual, typeboxVisual, variableVisual } from './concepts.ts';

/* =================================================================== logic → code */

const LOGIC = [
  { logic: 'Say what you do', code: 'cout << "Hello, I calculate the product of two numbers\\n";' },
  { logic: 'Ask for input', code: 'cout << "please enter two numbers: ";' },
  { logic: 'Read the input — into what type?', code: 'cin >> num1; cin >> num2;', needs: 'int num1, num2, product;' },
  { logic: 'Do something with the input', code: 'product = num1 * num2;' },
  { logic: 'Give output', code: 'cout << "the product is: "; cout << product; cout << "\\n";' },
  { logic: 'Say goodbye', code: 'cout << "Goodbye\\n";' },
  { logic: 'Close', code: 'return 0;' },
];

function logicVisual(host: HTMLElement) {
  const cards = LOGIC.map((s, i) => h('li', { class: 'cx-lg-step', tabindex: '0', 'data-i': String(i) }, h('span', { class: 'cx-lg-n mono' }, String(i + 1)), s.logic));
  const decl = h('div', { class: 'cx-lg-line is-decl', hidden: true }, code(LOGIC[2].needs!));
  const lines = LOGIC.map((s) => h('div', { class: 'cx-lg-line', hidden: true }, code(s.code)));
  const panel = h('div', { class: 'cx-lg-code mono' },
    h('div', { class: 'cx-lg-fixed' }, code('#include <iostream>\nusing namespace std;\nint main() {')),
    h('div', { class: 'cx-lg-body' }, decl, ...lines),
    h('div', { class: 'cx-lg-fixed' }, code('}')));
  const caption = h('p', { class: 'cx-vis-say' }, 'Each line of program logic becomes one or two lines of C++. Press Translate, or click a step.');
  let busy = false;
  const focus = (i: number) => {
    cards.forEach((c, j) => c.classList.toggle('is-on', j === i));
    lines.forEach((l, j) => l.classList.toggle('is-on', j === i));
    decl.classList.toggle('is-on', i === 2);
    lines[i].hidden = false;
    if (i >= 2) decl.hidden = false;
    caption.innerHTML = md(i === 2 ? '**Read the input** — first decide *what type* it goes into: whole numbers → `int`. So we declare the variables at the top of main.' : `**${LOGIC[i].logic}** → \`${LOGIC[i].code.replace(/\\n/g, '\\\\n')}\``);
  };
  const play = async () => {
    if (busy) return;
    busy = true;
    lines.forEach((l) => (l.hidden = true));
    decl.hidden = true;
    for (let i = 0; i < LOGIC.length; i++) { focus(i); await sleep(1100); }
    cards.forEach((c) => c.classList.remove('is-on'));
    lines.forEach((l) => l.classList.remove('is-on'));
    caption.innerHTML = md('That is the whole program. **Logic first, then code** — line by line, the same order every time.');
    busy = false;
  };
  cards.forEach((c, i) => {
    c.addEventListener('click', () => !busy && focus(i));
    c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!busy) focus(i); } });
  });
  host.replaceChildren(h('div', { class: 'cx-lg' },
    h('div', null, h('p', { class: 'cx-vis-k mono' }, 'Program logic (Notepad)'), h('ol', { class: 'cx-lg-steps' }, ...cards)),
    h('div', null, h('p', { class: 'cx-vis-k mono' }, 'Program code (Visual Studio)'), panel)),
    h('div', { class: 'cx-vis-bar' }, btn('▶ Translate', play, 'btn-primary'), caption));
}

/* =================================================================== cout & cin */

function streamsVisual(host: HTMLElement) {
  const stage = h('div', { class: 'cx-st' });
  const typed = h('input', { class: 'input mono cx-st-in', value: '3 5', 'aria-label': 'What the user types' }) as HTMLInputElement;
  const buf = h('div', { class: 'cx-st-buf mono', 'aria-label': 'Keyboard buffer' });
  const box1 = h('div', { class: 'cx-box', 'data-type': 'int' }, h('span', { class: 'cx-box-type mono' }, 'int'), h('span', { class: 'cx-box-name mono' }, 'num1'), h('span', { class: 'cx-val' }, '?'));
  const box2 = h('div', { class: 'cx-box', 'data-type': 'int' }, h('span', { class: 'cx-box-type mono' }, 'int'), h('span', { class: 'cx-box-name mono' }, 'num2'), h('span', { class: 'cx-val' }, '?'));
  const screen = h('pre', { class: 'cx-st-screen mono', 'aria-label': 'Screen' });
  const say = h('p', { class: 'cx-vis-say' });
  const drawBuf = (used = 0) => buf.replaceChildren(...[...`${typed.value}\n`].map((c, i) => h('span', { class: `cx-kb${i < used ? ' is-used' : ''}` }, kb(c))));
  drawBuf();
  typed.addEventListener('input', () => { drawBuf(); [box1, box2].forEach((b) => (b.querySelector('.cx-val')!.textContent = '?')); });

  const doCin = async () => {
    const text = `${typed.value}\n`;
    let pos = 0;
    for (const box of [box1, box2]) {
      while (pos < text.length && /\s/.test(text[pos])) pos++;
      const m = text.slice(pos).match(/^[+-]?\d+/);
      if (!m) {
        box.querySelector('.cx-val')!.textContent = '0';
        say.innerHTML = md(`cin wanted a **whole number** but found “${text.slice(pos).trim() || 'nothing'}” — the variable gets **0** and cin stops reading.`);
        return;
      }
      const cells = buf.querySelectorAll('.cx-kb');
      await fly(stage, cells[pos], box, m[0], 'is-in');
      box.querySelector('.cx-val')!.textContent = String(Number(m[0]));
      box.classList.add('is-new');
      setTimeout(() => box.classList.remove('is-new'), 600);
      pos += m[0].length;
      drawBuf(pos);
    }
    say.innerHTML = md('`>>` points **into** the variable: cin skips spaces, reads one value per variable, and leaves the rest waiting in the buffer.');
  };

  const doCout = async () => {
    const a = Number(box1.querySelector('.cx-val')!.textContent), b = Number(box2.querySelector('.cx-val')!.textContent);
    if (!Number.isFinite(a) || !Number.isFinite(b)) { say.innerHTML = md('Run **cin** first, so num1 and num2 have values.'); return; }
    screen.textContent = '';
    const parts = ['the product is: ', String(a * b), '\n'];
    const srcs = stage.querySelectorAll('.cx-st-part');
    for (let i = 0; i < parts.length; i++) {
      await fly(stage, srcs[i], screen, kb(parts[i]) === '⏎' ? '\\n' : parts[i], 'is-out');
      screen.textContent += parts[i];
    }
    say.innerHTML = md('`<<` points **towards** cout: each piece is sent to the screen in order. Text keeps its quotes in the code, not on the screen; `num1 * num2` is calculated first.');
  };

  stage.append(
    h('div', { class: 'cx-st-row' },
      h('div', { class: 'cx-st-col' }, h('p', { class: 'cx-vis-k mono' }, '⌨ The user types'), typed, buf),
      h('div', { class: 'cx-st-col cx-st-mid' }, code('cin >> num1 >> num2;'), h('span', { class: 'cx-st-arrow', 'aria-hidden': 'true' }, '⟹'), h('div', { class: 'cx-st-boxes' }, box1, box2))),
    h('div', { class: 'cx-st-row' },
      h('div', { class: 'cx-st-col cx-st-mid' },
        h('code', { class: 'cx-inline' }, h('span', { html: highlightCpp('cout << ') }), h('span', { class: 'cx-st-part', html: highlightCpp('"the product is: "') }), h('span', { html: highlightCpp(' << ') }), h('span', { class: 'cx-st-part', html: highlightCpp('num1 * num2') }), h('span', { html: highlightCpp(' << ') }), h('span', { class: 'cx-st-part', html: highlightCpp('"\\n"') }), h('span', { html: highlightCpp(';') }))),
      h('div', { class: 'cx-st-col' }, h('p', { class: 'cx-vis-k mono' }, '🖥 Console'), screen)));
  host.replaceChildren(stage, h('div', { class: 'cx-vis-bar' }, btn('▶ cin >> num1 >> num2', doCin, 'btn-primary'), btn('▶ cout << …', doCout), say));
  say.innerHTML = md('Change what the user types (try `7 -2`, `10\n3`, or `abc`), then run **cin**, then **cout**.');
}

/* =================================================================== data types */

const TYPE_ITEMS: { v: string; ans: 'int' | 'float' | 'char' | 'string'; why: string }[] = [
  { v: '7', ans: 'int', why: 'A whole number with no quotes → int.' },
  { v: '3.5', ans: 'float', why: 'It has a decimal point → float (or double).' },
  { v: "'a'", ans: 'char', why: 'ONE character in single quotes → char.' },
  { v: '"a"', ans: 'string', why: 'Double quotes make text → string, even for one letter.' },
  { v: "'7'", ans: 'char', why: "Single quotes: it is the character 7 (code 55), not the number 7 → char." },
  { v: '"7"', ans: 'string', why: 'Double quotes: it is text that looks like a number → string. Use stoi("7") to get the number.' },
  { v: '-12', ans: 'int', why: 'Negative whole numbers are ints too.' },
  { v: '7.0', ans: 'float', why: 'The .0 makes it a decimal number → float/double, even though it is “whole”.' },
  { v: '"Mohamed Salah"', ans: 'string', why: 'Text with a space → string (read it with getline).' },
  { v: "' '", ans: 'char', why: 'A space is a character too → char.' },
];

function typesVisual(host: HTMLElement) {
  const placed = new Map<number, string>();
  const say = h('p', { class: 'cx-vis-say' }, 'Drag each value into the box that can hold it (or tap a value, then a box).');
  const score = h('span', { class: 'cx-score mono' });
  const pool = h('div', { class: 'cx-ty-pool' });
  const bins = (['int', 'float', 'char', 'string'] as const).map((t) => h('div', { class: 'cx-ty-bin', 'data-drop': t, 'data-type': t, tabindex: '0' },
    h('span', { class: 'cx-box-type mono' }, t), h('span', { class: 'cx-ty-hint' }, t === 'int' ? 'whole numbers' : t === 'float' ? 'decimals' : t === 'char' ? "one character 'x'" : 'text "…"'), h('div', { class: 'cx-ty-in' })));
  const drop = (i: number, target: HTMLElement) => {
    const t = target.dataset.drop!;
    const item = TYPE_ITEMS[i];
    const chip = pool.querySelector<HTMLElement>(`[data-i="${i}"]`) ?? host.querySelector<HTMLElement>(`[data-i="${i}"]`);
    if (!chip) return;
    if (t === item.ans) {
      placed.set(i, t);
      target.querySelector('.cx-ty-in')!.append(chip);
      chip.classList.add('is-ok');
      chip.setAttribute('aria-disabled', 'true');
      say.innerHTML = md(`✓ \`${item.v}\` — ${item.why}`);
    } else {
      chip.classList.remove('is-shake');
      void chip.offsetWidth;
      chip.classList.add('is-shake');
      say.innerHTML = md(`✗ \`${item.v}\` is not a **${t}**. Look at the quotes and the decimal point.`);
    }
    score.textContent = `${placed.size} / ${TYPE_ITEMS.length}`;
    if (placed.size === TYPE_ITEMS.length) say.innerHTML = md('🎉 All sorted. Quotes decide: **\'x\'** = char, **"x"** = string. A decimal point = float.');
  };
  TYPE_ITEMS.forEach((item, i) => {
    const chip = h('button', { type: 'button', class: 'cx-ty-chip mono', 'data-i': String(i) }, item.v);
    draggable(chip, { scope: host, onDrop: (target) => { if (!placed.has(i)) drop(i, target); } });
    pool.append(chip);
  });
  bins.forEach((b) => {
    b.addEventListener('click', () => dropPicked(b));
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter') dropPicked(b); });
  });
  score.textContent = `0 / ${TYPE_ITEMS.length}`;
  host.replaceChildren(pool, h('div', { class: 'cx-ty-bins' }, ...bins), h('div', { class: 'cx-vis-bar' }, score, btn('⟲ Again', () => { clearPick(); typesVisual(host); }), say));
}

/* =================================================================== division */

function divisionVisual(host: HTMLElement) {
  const a = h('input', { type: 'range', min: '0', max: '23', value: '7', class: 'cx-range', 'aria-label': 'a' }) as HTMLInputElement;
  const b = h('input', { type: 'range', min: '1', max: '6', value: '2', class: 'cx-range', 'aria-label': 'b' }) as HTMLInputElement;
  const dots = h('div', { class: 'cx-dv-dots', 'aria-hidden': 'true' });
  const rows = h('div', { class: 'cx-dv-rows mono' });
  const labels = h('p', { class: 'cx-dv-decl' });
  const draw = () => {
    const x = Number(a.value), y = Number(b.value);
    const q = Math.trunc(x / y), r = x % y;
    labels.replaceChildren(code(`int a = ${x}; int b = ${y};`));
    dots.replaceChildren(...Array.from({ length: q }, (_, g) => h('span', { class: 'cx-dv-group', style: `--d:${g * 60}ms` }, ...Array.from({ length: y }, () => h('i', null)))),
      ...(r ? [h('span', { class: 'cx-dv-group is-rest' }, ...Array.from({ length: r }, () => h('i', null)))] : []));
    rows.replaceChildren(
      h('div', null, code('a / b'), h('b', null, String(q)), h('span', null, `${q} full group${q === 1 ? '' : 's'} of ${y} — the rest is thrown away`)),
      h('div', null, code('a % b'), h('b', { class: 'is-rest' }, String(r)), h('span', null, 'what is left over (the remainder)')),
      h('div', null, code('a / 2.0'), h('b', null, formatG(x / 2)), h('span', null, 'one value is a decimal → decimal division')),
      h('div', null, code('(float) a / b'), h('b', null, formatG(Math.fround(x) / y)), h('span', null, 'cast first, then divide')));
  };
  a.addEventListener('input', draw);
  b.addEventListener('input', draw);
  draw();
  host.replaceChildren(h('div', { class: 'cx-dv' },
    h('div', { class: 'cx-dv-ctl' }, h('label', null, 'a', a), h('label', null, 'b', b), labels), dots, rows),
    h('p', { class: 'cx-vis-say', html: md('**int / int gives an int**: C++ cuts off the decimals (it does not round). `%` gives the leftover. Predict first, then move the sliders.') }));
}

/* =================================================================== rounding */

function roundingVisual(host: HTMLElement) {
  const MIN = -3, MAX = 7;
  const slider = h('input', { type: 'range', min: String(MIN), max: String(MAX), step: '0.1', value: '5.5', class: 'cx-range cx-rd-range', 'aria-label': 'x' }) as HTMLInputElement;
  const line = h('div', { class: 'cx-rd-line' });
  for (let t = MIN; t <= MAX; t++) line.append(h('span', { class: 'cx-rd-tick mono', style: `left:${((t - MIN) / (MAX - MIN)) * 100}%` }, String(t)));
  const mk = (cls: string, label: string) => { const m = h('span', { class: `cx-rd-mk ${cls}` }, h('b', { class: 'mono' }, label)); line.append(m); return m; };
  const mx = mk('is-x', 'x'), mf = mk('is-floor', 'floor'), mc = mk('is-ceil', 'ceil'), mr = mk('is-round', 'round');
  const out = h('div', { class: 'cx-rd-out mono' });
  const at = (v: number) => `${((v - MIN) / (MAX - MIN)) * 100}%`;
  const round = (v: number) => Math.sign(v) * Math.floor(Math.abs(v) + 0.5);
  // the slider moves in steps of 0.1; a preset such as 4.51 keeps its own value
  let x = 5.5;
  const draw = () => {
    mx.style.left = at(x); mf.style.left = at(Math.floor(x)); mc.style.left = at(Math.ceil(x)); mr.style.left = at(round(x));
    out.replaceChildren(
      h('div', null, code(`floor(${formatG(x)})`), h('b', null, formatG(Math.floor(x))), h('span', null, 'down to the whole number at or below')),
      h('div', null, code(`ceil(${formatG(x)})`), h('b', null, formatG(Math.ceil(x))), h('span', null, 'up to the whole number at or above')),
      h('div', null, code(`round(${formatG(x)})`), h('b', null, formatG(round(x))), h('span', null, '.5 and above goes away from zero')));
  };
  slider.addEventListener('input', () => { x = Math.round(Number(slider.value) * 10) / 10; draw(); });
  const presets = [5.5, 4.1, 4.51, 3, -2.5].map((v) => btn(String(v), () => { x = v; slider.value = String(v); draw(); }));
  draw();
  host.replaceChildren(h('div', { class: 'cx-rd' }, line, slider, out),
    h('div', { class: 'cx-vis-bar' }, h('span', { class: 'cx-vis-k mono' }, 'Try:'), ...presets,
      h('p', { class: 'cx-vis-say', html: md('Predict `round(5.5)` and `ceil(4.1)` before you press them — these were quiz questions.') })));
}

/* =================================================================== x++ vs ++x */

function incrementVisual(host: HTMLElement) {
  const panel = (title: string, src: string, post: boolean) => {
    const bx = h('div', { class: 'cx-box', 'data-type': 'int' }, h('span', { class: 'cx-box-type mono' }, 'int'), h('span', { class: 'cx-box-name mono' }, 'x'), h('span', { class: 'cx-val' }, '6'));
    const by = h('div', { class: 'cx-box', 'data-type': 'int' }, h('span', { class: 'cx-box-type mono' }, 'int'), h('span', { class: 'cx-box-name mono' }, 'y'), h('span', { class: 'cx-val' }, '2'));
    const steps = h('ol', { class: 'cx-inc-steps' });
    const stage = h('div', { class: 'cx-inc-stage' }, bx, by);
    const wrap = h('div', { class: 'cx-inc' }, h('p', { class: 'cx-vis-k mono' }, title), code(src), stage, steps);
    const set = (b: HTMLElement, v: number) => { b.querySelector('.cx-val')!.textContent = String(v); b.classList.add('is-new'); setTimeout(() => b.classList.remove('is-new'), 600); };
    const play = async () => {
      steps.replaceChildren();
      set(bx, 6); set(by, 2);
      await sleep(300);
      if (post) {
        steps.append(h('li', null, 'Use the OLD x (6) …'));
        await fly(wrap, bx, by, '6');
        set(by, 6);
        await sleep(300);
        steps.append(h('li', null, '… then add 1 to x → 7'));
        set(bx, 7);
      } else {
        steps.append(h('li', null, 'First add 1 to x → 7 …'));
        set(bx, 7);
        await sleep(500);
        steps.append(h('li', null, '… then use the NEW x (7)'));
        await fly(wrap, bx, by, '7');
        set(by, 7);
      }
    };
    return { wrap, play };
  };
  const p1 = panel('Postfix: use, then add', 'y = x++;', true);
  const p2 = panel('Prefix: add, then use', 'y = ++x;', false);
  host.replaceChildren(
    h('p', { class: 'cx-vis-say', html: md('From the quiz: `int x = 4; int y = 2; x += y;` → now **x = 6, y = 2**. What is y after each line? Predict, then play.') }),
    h('div', { class: 'cx-inc-grid' }, p1.wrap, p2.wrap),
    h('div', { class: 'cx-vis-bar' }, btn('▶ Play x++', () => p1.play(), 'btn-primary'), btn('▶ Play ++x', () => p2.play()), h('p', { class: 'cx-vis-say' }, 'Either way x ends up 7. Only y is different.')));
}

/* =================================================================== median */

function medianVisual(host: HTMLElement) {
  const n1 = h('input', { type: 'number', class: 'input mono cx-numin', value: '2', 'aria-label': 'num1' }) as HTMLInputElement;
  const n2 = h('input', { type: 'number', class: 'input mono cx-numin', value: '6', 'aria-label': 'num2' }) as HTMLInputElement;
  const n3 = h('input', { type: 'range', min: '-2', max: '10', step: '1', value: '4', class: 'cx-range', 'aria-label': 'num3' }) as HTMLInputElement;
  const line = h('div', { class: 'cx-md-line' });
  const codeBox = h('pre', { class: 'cx-md-code mono' });
  const say = h('p', { class: 'cx-vis-say' });
  const SRC = (lo: string, hi: string) => [
    `if (${lo === 'num1' ? 'num1 < num2' : 'num2 < num1'}) {`,
    `    if (num3 > ${hi}) median = ${hi};`,
    `    else if (num3 < ${lo}) median = ${lo};`,
    '    else median = num3;',
    '}',
  ];
  const draw = () => {
    const a = Number(n1.value), b = Number(n2.value), c = Number(n3.value);
    const lo = a < b ? 'num1' : 'num2', hi = a < b ? 'num2' : 'num1';
    const vlo = Math.min(a, b), vhi = Math.max(a, b);
    const zone = c > vhi ? 1 : c < vlo ? 2 : 3;
    const median = zone === 1 ? vhi : zone === 2 ? vlo : c;
    const MIN = Math.min(-2, a, b, c) - 1, MAX = Math.max(10, a, b, c) + 1;
    const at = (v: number) => `${((v - MIN) / (MAX - MIN)) * 100}%`;
    line.replaceChildren(
      h('span', { class: `cx-md-zone${zone === 2 ? ' is-on' : ''}`, style: `left:0;width:${at(vlo)}` }, 'left'),
      h('span', { class: `cx-md-zone${zone === 3 ? ' is-on' : ''}`, style: `left:${at(vlo)};width:calc(${at(vhi)} - ${at(vlo)})` }, 'middle'),
      h('span', { class: `cx-md-zone${zone === 1 ? ' is-on' : ''}`, style: `left:${at(vhi)};right:0` }, 'right'),
      h('span', { class: 'cx-md-pt', style: `left:${at(a)}` }, h('b', { class: 'mono' }, `num1 = ${a}`)),
      h('span', { class: 'cx-md-pt', style: `left:${at(b)}` }, h('b', { class: 'mono' }, `num2 = ${b}`)),
      h('span', { class: 'cx-md-pt is-3', style: `left:${at(c)}` }, h('b', { class: 'mono' }, `num3 = ${c}`)));
    const src = SRC(lo, hi);
    codeBox.replaceChildren(...src.map((l, i) => h('span', { class: `cx-sl${i === 0 || i === zone ? ' is-on' : ''}`, html: highlightCpp(l) || ' ' })));
    say.innerHTML = a === b || c === a || c === b
      ? md(`Equal numbers! The nested version still answers **${median}** — but the six-if version from Lecture 3 uses strict \`<\` and prints **nothing** for 2 2 2. Try it in the editor.`)
      : md(`num3 lands in the **${zone === 1 ? 'right' : zone === 2 ? 'left' : 'middle'}** position → the median is **${median}**. At most 3 tests, never 6.`);
  };
  [n1, n2, n3].forEach((x) => x.addEventListener('input', draw));
  draw();
  host.replaceChildren(h('div', { class: 'cx-md' },
    h('div', { class: 'cx-md-ctl' }, h('label', { class: 'mono' }, 'num1 ', n1), h('label', { class: 'mono' }, 'num2 ', n2), h('label', { class: 'mono cx-md-3' }, 'drag num3 ', n3)),
    line, codeBox), say);
}

/* =================================================================== ASCII */

function asciiVisual(host: HTMLElement) {
  const strip = (from: number) => h('div', { class: 'cx-as-row' }, ...Array.from({ length: 26 }, (_, i) => h('span', { class: 'cx-as-c', 'data-code': String(from + i) }, h('b', null, String.fromCharCode(from + i)), h('i', { class: 'mono' }, String(from + i)))));
  const upper = strip(65), lower = strip(97);
  const ch = h('input', { class: 'input mono cx-as-in', value: 'a', maxlength: '1', 'aria-label': 'A character' }) as HTMLInputElement;
  const out = h('div', { class: 'cx-as-out mono' });
  const stage = h('div', { class: 'cx-as' }, h('p', { class: 'cx-vis-k mono' }, 'Upper case: 65 … 90'), upper, h('p', { class: 'cx-vis-k mono' }, 'Lower case: 97 … 122  (always 32 more)'), lower);
  // the lit cells stay lit until the next press, so the codes can be read
  const light = (...codes: number[]) => {
    stage.querySelectorAll('.is-hit').forEach((c) => c.classList.remove('is-hit'));
    codes.forEach((code) => stage.querySelectorAll(`[data-code="${code}"]`).forEach((c) => c.classList.add('is-hit')));
  };
  const show = () => {
    const c = ch.value || 'a';
    const k = c.charCodeAt(0);
    stage.querySelectorAll('.is-pick').forEach((x) => x.classList.remove('is-pick'));
    stage.querySelectorAll(`[data-code="${k}"]`).forEach((x) => x.classList.add('is-pick'));
    out.replaceChildren(h('div', null, code(`char c = '${c}';`), h('span', null, `stored as the number ${k}`)));
  };
  const minus = async () => {
    const c = ch.value || 'a';
    const k = c.charCodeAt(0);
    const from = stage.querySelector(`[data-code="${k}"]`), to = stage.querySelector(`[data-code="${k - 32}"]`);
    if (from && to) await fly(stage, from, to, '− 32');
    light(k - 32);
    out.replaceChildren(
      h('div', null, code('c - 32'), h('b', null, String(k - 32)), h('span', null, 'char − int gives an int: cout prints the number!')),
      h('div', null, code('(char)(c - 32)'), h('b', null, `'${String.fromCharCode(k - 32)}'`), h('span', null, k >= 97 && k <= 122 ? 'cast back to char: the uppercase letter' : 'only lowercase letters have an uppercase 32 places below')));
  };
  const cmpA = h('input', { class: 'input mono cx-as-in', value: 'c', maxlength: '1', 'aria-label': 'First character' }) as HTMLInputElement;
  const cmpB = h('input', { class: 'input mono cx-as-in', value: 'd', maxlength: '1', 'aria-label': 'Second character' }) as HTMLInputElement;
  const cmpOut = h('div', { class: 'cx-as-out mono' });
  const compare = () => {
    const x = cmpA.value || 'c', y = cmpB.value || 'd';
    const kx = x.charCodeAt(0), ky = y.charCodeAt(0);
    light(kx, ky);
    cmpOut.replaceChildren(h('div', null, code(`'${x}' > '${y}'`), h('b', null, kx > ky ? 'true' : 'false'), h('span', null, `C++ compares the codes: ${kx} > ${ky}`)));
  };
  ch.addEventListener('input', show);
  show();
  host.replaceChildren(stage,
    h('div', { class: 'cx-vis-bar' }, h('label', { class: 'mono' }, 'c = ', ch), btn("▶ c - 32", minus, 'btn-primary'), out),
    h('div', { class: 'cx-vis-bar' }, h('label', { class: 'mono' }, 'compare ', cmpA, ' > ', cmpB), btn('▶ Compare', compare), cmpOut));
}

/* =================================================================== string explorer */

function stringVisual(host: HTMLElement, start: string) {
  const input = h('input', { class: 'input mono cx-sx-in', value: start || 'Introduction to Computing', 'aria-label': 'The string s' }) as HTMLInputElement;
  const cells = h('div', { class: 'cx-sx-cells mono' });
  const result = h('div', { class: 'cx-sx-res mono', role: 'status' });
  const field = (v: string, label: string, w = 5) => h('input', { class: 'input mono cx-sx-arg', value: v, 'aria-label': label, size: String(w) }) as HTMLInputElement;
  const iIdx = field('3', 'position'), iFind = field('o', 'what to find', 6), iPos = field('14', 'start'), iLen = field('', 'length (optional)');
  let busy = false;
  const s = () => input.value;
  const draw = () => {
    cells.replaceChildren(...[...s()].map((c, i) => h('span', { class: 'cx-sc' }, h('b', null, kb(c)), h('i', null, String(i)))));
    result.textContent = '';
  };
  const mark = (from: number, len: number, cls = 'is-hit') => [...cells.children].forEach((c, i) => c.classList.toggle(cls, i >= from && i < from + len));
  const clear = () => [...cells.children].forEach((c) => c.classList.remove('is-hit', 'is-scan', 'is-len'));
  const res = (expr: string, value: string, note = '') => result.replaceChildren(code(expr), h('b', null, `→ ${value}`), ...(note ? [h('span', null, note)] : []));
  const ops = {
    length: () => { clear(); mark(0, s().length, 'is-len'); res('s.length()', String(s().length), `positions 0 to ${s().length - 1}`); },
    index: () => {
      clear();
      const i = Number(iIdx.value);
      if (!(i >= 0 && i < s().length)) { res(`s[${iIdx.value}]`, 'ERROR', `string subscript out of range — the last position is ${s().length - 1}`); return; }
      mark(i, 1);
      res(`s[${i}]`, `'${s()[i]}'`, 'same as s.at(' + i + ')');
    },
    find: async () => {
      if (busy) return;
      busy = true;
      clear();
      const q = iFind.value;
      const hit = q ? s().indexOf(q) : 0;
      const expr = q.length === 1 ? `s.find('${q}')` : `s.find("${q}")`;
      const end = hit < 0 ? s().length : hit;
      for (let i = 0; i < end; i++) {
        mark(i, q.length || 1, 'is-scan');
        await sleep(prefersReducedMotion() ? 0 : 110);
      }
      clear();
      if (hit < 0) res(expr, 'npos', 'not found: string::npos, the biggest possible number (18446744073709551615)');
      else { mark(hit, q.length || 1); res(expr, String(hit), q.length > 1 ? 'where the text starts' : 'the FIRST match, counting from 0'); }
      busy = false;
    },
    substr: () => {
      clear();
      const p = Number(iPos.value), lenTxt = iLen.value.trim();
      if (!(p >= 0 && p <= s().length)) { res(`s.substr(${iPos.value})`, 'ERROR', 'out_of_range: the start is past the end of the string'); return; }
      const len = lenTxt ? Math.max(0, Number(lenTxt)) : s().length - p;
      const out = s().substr(p, len);
      mark(p, out.length);
      res(lenTxt ? `s.substr(${p}, ${len})` : `s.substr(${p})`, `"${out}"`, lenTxt ? `start at ${p}, take ${len} characters (a LENGTH, not an end position)` : `from ${p} to the end`);
    },
  };
  input.addEventListener('input', draw);
  draw();
  host.replaceChildren(h('div', { class: 'cx-sx' },
    h('label', { class: 'cx-sx-top mono' }, 'string s = "', input, '";'), cells,
    h('div', { class: 'cx-sx-ops' },
      h('div', null, btn('s.length()', ops.length)),
      h('div', null, h('span', { class: 'mono' }, 's['), iIdx, h('span', { class: 'mono' }, ']'), btn('▶', ops.index)),
      h('div', null, h('span', { class: 'mono' }, 's.find('), iFind, h('span', { class: 'mono' }, ')'), btn('▶', () => void ops.find())),
      h('div', null, h('span', { class: 'mono' }, 's.substr('), iPos, h('span', { class: 'mono' }, ','), iLen, h('span', { class: 'mono' }, ')'), btn('▶', ops.substr))),
    result),
    h('p', { class: 'cx-vis-say', html: md('Positions start at **0**. Before you press, say the answer out loud — then check.') }));
}

/* =================================================================== cin >> vs getline */

const GL_CASES = [
  { label: 'cin >> name;', input: 'Mohamed Salah\n', reads: [{ how: 'cin', name: 'name' }], note: '**cin >>** stops at the first space: name is "Mohamed" and “ Salah⏎” waits in the buffer.' },
  { label: 'getline(cin, name);', input: 'Mohamed Salah\n', reads: [{ how: 'getline', name: 'name' }], note: '**getline** takes the whole line, spaces included, and throws away the ⏎.' },
  { label: 'cin >> age; getline(cin, name);', input: '20\nAli\n', reads: [{ how: 'cin', name: 'age' }, { how: 'getline', name: 'name' }], note: 'The trap: cin leaves the ⏎ behind, so getline reads an **empty** line. (Fix: use getline for both, or cin.ignore().)' },
] as const;

function getlineVisual(host: HTMLElement) {
  const tabs = h('div', { class: 'cx-gl-tabs', role: 'tablist' });
  const buf = h('div', { class: 'cx-st-buf mono' });
  const boxes = h('div', { class: 'cx-st-boxes' });
  const say = h('p', { class: 'cx-vis-say' });
  const stage = h('div', { class: 'cx-gl' });
  let cur = 0;
  const load = (k: number) => {
    cur = k;
    const c = GL_CASES[k];
    [...tabs.children].forEach((t, i) => t.setAttribute('aria-selected', String(i === k)));
    buf.replaceChildren(...[...c.input].map((ch) => h('span', { class: 'cx-kb' }, kb(ch))));
    boxes.replaceChildren(...c.reads.map((r) => h('div', { class: 'cx-box', 'data-type': r.name === 'age' ? 'int' : 'string', 'data-name': r.name },
      h('span', { class: 'cx-box-type mono' }, r.name === 'age' ? 'int' : 'string'), h('span', { class: 'cx-box-name mono' }, r.name), h('span', { class: 'cx-val' }, r.name === 'age' ? '?' : '""'))));
    say.innerHTML = md(`The user types ${[...c.input].map(kb).join('')} — predict what lands in ${c.reads.map((r) => `**${r.name}**`).join(' and ')}, then press Run.`);
  };
  const run = async () => {
    const c = GL_CASES[cur];
    load(cur);
    let pos = 0;
    const cellsOf = () => buf.querySelectorAll('.cx-kb');
    for (const r of c.reads) {
      const box = boxes.querySelector<HTMLElement>(`[data-name="${r.name}"]`)!;
      let from = pos, to = pos, value = '';
      if (r.how === 'cin') {
        while (/\s/.test(c.input[from] ?? '')) from++;
        to = from;
        while (to < c.input.length && !/\s/.test(c.input[to])) to++;
        value = c.input.slice(from, to);
        pos = to;
      } else {
        const nl = c.input.indexOf('\n', pos);
        value = c.input.slice(pos, nl);
        from = pos; to = nl;
        pos = nl + 1;
      }
      if (to > from) await fly(stage, cellsOf()[from], box, value);
      else await sleep(400);
      [...cellsOf()].forEach((cell, i) => cell.classList.toggle('is-used', i < pos));
      box.querySelector('.cx-val')!.textContent = r.name === 'age' ? value : `"${value}"`;
      box.classList.add('is-new');
    }
    say.innerHTML = md(c.note);
  };
  GL_CASES.forEach((c, i) => tabs.append(h('button', { type: 'button', role: 'tab', class: 'cx-gl-tab mono', onclick: () => load(i) }, c.label)));
  stage.append(h('div', { class: 'cx-st-row' }, h('div', { class: 'cx-st-col' }, h('p', { class: 'cx-vis-k mono' }, '⌨ Keyboard buffer'), buf), h('div', { class: 'cx-st-col' }, h('p', { class: 'cx-vis-k mono' }, 'Memory'), boxes)));
  load(0);
  host.replaceChildren(tabs, stage, h('div', { class: 'cx-vis-bar' }, btn('▶ Run', run, 'btn-primary'), say));
}

/* =================================================================== ladders: email & vector */

type Rung = { label: string; code: string; test: (s: string) => { pass: boolean; detail: string } };

const EMAIL_RUNGS: Rung[] = [
  { label: 'It contains @', code: 'at = s.find(\'@\');  at != string::npos', test: (s) => { const at = s.indexOf('@'); return { pass: at >= 0, detail: at >= 0 ? `@ is at ${at}` : 'find gives npos' }; } },
  { label: 'Something before the @', code: 's.substr(0, at).length() > 0', test: (s) => { const b = s.slice(0, s.indexOf('@')); return { pass: b.length > 0, detail: `"${b}"` }; } },
  { label: 'Something after the @', code: 'after = s.substr(at + 1);  after.length() > 0', test: (s) => { const a = s.slice(s.indexOf('@') + 1); return { pass: a.length > 0, detail: `"${a}"` }; } },
  { label: 'A dot after the @', code: 'dot = after.find(\'.\');  dot != string::npos', test: (s) => { const a = s.slice(s.indexOf('@') + 1); const d = a.indexOf('.'); return { pass: d >= 0, detail: d >= 0 ? `. is at ${d} in "${a}"` : 'no dot: npos' }; } },
  { label: 'Something on both sides of that dot', code: 'dot > 0 && dot < after.length() - 1', test: (s) => { const a = s.slice(s.indexOf('@') + 1); const d = a.indexOf('.'); return { pass: d > 0 && d < a.length - 1, detail: `"${a.slice(0, d)}" . "${a.slice(d + 1)}"` }; } },
];

const VECTOR_RUNGS: Rung[] = [
  { label: 'It has <', code: 'l = s.find(\'<\');  l != string::npos', test: (s) => { const l = s.indexOf('<'); return { pass: l >= 0, detail: l >= 0 ? `< at ${l}` : 'npos' }; } },
  { label: 'It has >', code: 'r = s.find(\'>\');  r != string::npos', test: (s) => { const r = s.indexOf('>'); return { pass: r >= 0, detail: r >= 0 ? `> at ${r}` : 'npos' }; } },
  { label: 'Take what is between them', code: 'in = s.substr(l + 1, r - l - 1);', test: (s) => { const l = s.indexOf('<'), r = s.indexOf('>'); return { pass: r > l, detail: `"${s.slice(l + 1, r)}"` }; } },
  { label: 'It has a comma inside', code: 'c = in.find(\',\');  c != string::npos', test: (s) => { const inner = s.slice(s.indexOf('<') + 1, s.indexOf('>')); const c = inner.indexOf(','); return { pass: c >= 0, detail: c >= 0 ? `, at ${c}` : 'npos' }; } },
  { label: 'Both sides of the comma have something', code: 'x = in.substr(0, c);  y = in.substr(c + 1);  both length() > 0', test: (s) => { const inner = s.slice(s.indexOf('<') + 1, s.indexOf('>')); const c = inner.indexOf(','); const x = inner.slice(0, c).trim(), y = inner.slice(c + 1).trim(); return { pass: x.length > 0 && y.length > 0, detail: `x = "${x}", y = "${y}"` }; } },
];

function ladderVisual(host: HTMLElement, kind: 'email' | 'vector', start: string) {
  const rungs = kind === 'email' ? EMAIL_RUNGS : VECTOR_RUNGS;
  const presets = kind === 'email'
    ? ['Gerard.mckee@bue.edu.eg', 'www.bue.edu.eg', '@', 'gerard@', 'gerard@.', 'gerard@somewhere', 'grd@xyzabc']
    : ['<2, 3>', '<-2, 3>', '2,3>', '<2 3>', '<, 3>', '<2,>', '<2,3'];
  const input = h('input', { class: 'input mono cx-ld-in', value: start || presets[0], 'aria-label': kind === 'email' ? 'The text to check' : 'The vector to check' }) as HTMLInputElement;
  const list = h('ol', { class: 'cx-ld' });
  const verdict = h('p', { class: 'cx-ld-v', role: 'status' });
  let busy = false;
  const run = async () => {
    if (busy) return;
    busy = true;
    const s = input.value;
    verdict.textContent = '';
    list.replaceChildren(...rungs.map((r) => h('li', { class: 'cx-ld-r' }, h('span', { class: 'cx-ld-ico', 'aria-hidden': 'true' }, '○'), h('div', null, h('b', null, r.label), code(r.code), h('small', { class: 'mono' })))));
    let ok = true;
    for (let i = 0; i < rungs.length; i++) {
      const li = list.children[i] as HTMLElement;
      li.classList.add('is-testing');
      await sleep(450);
      const t = rungs[i].test(s);
      li.classList.remove('is-testing');
      li.classList.add(t.pass ? 'is-pass' : 'is-fail');
      li.querySelector('.cx-ld-ico')!.textContent = t.pass ? '✓' : '✗';
      li.querySelector('small')!.textContent = t.detail;
      if (!t.pass) { ok = false; [...list.children].slice(i + 1).forEach((x) => x.classList.add('is-skip')); break; }
    }
    if (kind === 'email') {
      const tld = ok ? s.slice(s.lastIndexOf('.') + 1) : '';
      verdict.innerHTML = md(ok ? `✓ **A well-formed email address.** Its top-level domain (TLD) is after the last dot: **.${tld}** → \`s.substr(s.rfind('.') + 1)\`` : '✗ **Not an email address** — the first failed test says why. Every later test is skipped (that is what nested if/else does).');
    } else verdict.innerHTML = md(ok ? '✓ **correct format**' : '✗ **wrong format** — stop at the first failed test, like the nested if/else in Lecture 5.');
    verdict.className = `cx-ld-v ${ok ? 'is-ok' : 'is-bad'}`;
    busy = false;
  };
  host.replaceChildren(h('div', { class: 'cx-ld-top' }, h('label', { class: 'mono' }, 'string s = "', input, '";'), btn('▶ Check it', () => void run(), 'btn-primary')),
    h('div', { class: 'cx-vis-bar' }, h('span', { class: 'cx-vis-k mono' }, 'Try:'), ...presets.map((p) => btn(p, () => { input.value = p; void run(); }))),
    list, verdict);
  void run();
}

/* =================================================================== registry */

export function mountVisual(host: HTMLElement, id: string, text: string) {
  switch (id) {
    case 'anatomy': return anatomyVisual(host);
    case 'main': return mainVisual(host);
    case 'variable': return variableVisual(host);
    case 'typebox': return typeboxVisual(host);
    case 'flow': return flowVisual(host);
    case 'toolbox': return toolboxVisual(host);
    case 'logic': return logicVisual(host);
    case 'streams': return streamsVisual(host);
    case 'types': return typesVisual(host);
    case 'division': return divisionVisual(host);
    case 'rounding': return roundingVisual(host);
    case 'increment': return incrementVisual(host);
    case 'median': return medianVisual(host);
    case 'ascii': return asciiVisual(host);
    case 'string': return stringVisual(host, text);
    case 'getline': return getlineVisual(host);
    case 'email': return ladderVisual(host, 'email', text);
    case 'vector': return ladderVisual(host, 'vector', text);
  }
  host.textContent = 'This visual is not available.';
}
