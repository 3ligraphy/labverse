/**
 * "Start here: the words of C++" — the first part of the Introduction to Computing revision lab. One visual per idea
 * (the pieces of a program, why int main, a variable's life, data types, cin/cout), each driven by the student, and
 * each running the real engine so every error message is the one Visual Studio would give.
 */
import { h, md } from '../../ui/dom.ts';
import { run } from '../index.ts';
import { highlightCpp } from './syntax.ts';
import { btn, code, fly, sleep } from './anim.ts';

const memBox = (type: string, name: string, value = '?', note = '') =>
  h('div', { class: 'cx-box', 'data-type': type },
    h('span', { class: 'cx-box-type mono' }, type),
    h('span', { class: 'cx-box-name mono' }, name),
    h('span', { class: `cx-val${value === '?' ? ' cx-unset' : ''}` }, value),
    note ? h('span', { class: 'cx-box-note' }, note) : null);

function setVal(box: HTMLElement, v: string, cls = 'is-new') {
  const el = box.querySelector('.cx-val')!;
  el.textContent = v;
  el.classList.toggle('cx-unset', v === '?');
  box.classList.remove(cls);
  void box.offsetWidth; // restart the pop
  box.classList.add(cls);
}

/** what Visual Studio would show: the first build error, or the console (with the run-time error that stopped it) */
function outcome(src: string, typed: string) {
  const r = run(src, typed ? `${typed}\n` : '', 50_000);
  if (!r.compiled.ok) {
    const e = r.compiled.errors[0];
    return h('div', { class: 'cx-msg is-err' },
      h('p', { html: md(`**✗ It does not build.** ${e.code ? `${e.code} · ` : ''}line ${e.line}: ${e.message}`) }),
      e.hint ? h('p', { html: md(e.hint) }) : null);
  }
  const w = r.compiled.warnings[0];
  return h('div', { class: 'cx-an-run' },
    w ? h('div', { class: 'cx-msg is-warn' }, h('p', { html: md(`⚠ ${w.code ? `${w.code} · ` : ''}line ${w.line}: ${w.message}`) })) : null,
    typed ? h('p', { class: 'cx-an-typed mono' }, `The user types: ${typed} ⏎`) : null,
    h('pre', { class: 'cx-con mono' }, r.output || ' ', r.error ? h('span', { class: 'cx-con-err' }, `\n${r.error.message}`) : null));
}

/* =================================================================== a program, piece by piece */

const ANATOMY = String.raw`#include <iostream>
#include <string>
using namespace std;

// say hello, ask for a name
int main() {
    string name;
    int age = 19;
    cout << "Your name? ";
    cin >> name;
    cout << "Hi " << name << ", next year you are " << age + 1 << "\n";
    return 0;
}`;

type Piece = { tag: string; lines: number[]; mark?: 'semi' | 'brace'; title: string; body: string; cut: { line: number; to: string | null; note: string } };

const PIECES: Piece[] = [
  { tag: 'library', lines: [0, 1], title: '`#include` — bring in a library',
    body: 'A **library** is a toolbox of code someone already wrote and tested. `#include <iostream>` brings in the **i**nput/**o**utput **stream** tools: `cout`, `cin`, `getline`. `#include <string>` brings in `string`. Later you add `<cmath>` for `sqrt`, `pow`, `round` and `<algorithm>` for `max`, `min`.\n`#include` lines go at the very top and have **no** `;`.',
    cut: { line: 0, to: null, note: 'Without `<iostream>`, C++ has never heard of `cout` — the build stops at the first `cout`.' } },
  { tag: 'namespace', lines: [2], title: '`using namespace std;` — the family name',
    body: 'Everything in the standard toolboxes has the family name **std** (“standard”): the full name of `cout` is `std::cout`. This line says “we are using the std family”, so you can write just `cout`, `cin` and `string`.',
    cut: { line: 2, to: null, note: 'Now `string`, `cout` and `cin` are unknown — you would have to write `std::cout` every time.' } },
  { tag: 'comment', lines: [4], title: '`//` — a note for people',
    body: 'Everything after `//` on a line is a **comment**. The computer skips it. Use comments to write your program logic: “say hello, ask for input, read it…”',
    cut: { line: 4, to: null, note: 'Nothing changes: the computer never reads comments.' } },
  { tag: 'main', lines: [5, 12], title: '`int main()` — where the program starts',
    body: 'When you press ▶ Run, the computer looks for the function called **main** and runs its lines from top to bottom.\n`int` — main gives back a whole number when it finishes.  `()` — main’s inputs (none here).  `{ … }` — main’s body: every instruction of the program.',
    cut: { line: 5, to: 'main() {', note: 'Take away `int` and Visual Studio refuses: main must say what kind of answer it gives back.' } },
  { tag: '{ }', lines: [5, 12], mark: 'brace', title: '`{ }` — a block',
    body: '`{` opens a **block** and `}` closes it, like brackets around a paragraph. Everything between main’s `{` and `}` belongs to main. Every `{` needs its own `}`.',
    cut: { line: 12, to: null, note: 'Without the last `}`, main never ends.' } },
  { tag: 'declaration', lines: [6], title: '`string name;` — a declaration',
    body: '**Declaring** a variable creates a labelled box in memory: first the **type** (what may go in the box), then the **name**. `string name;` makes a box called `name` that holds text. Declare a variable **before** you use it.',
    cut: { line: 6, to: null, note: 'Now `cin >> name` uses a box that was never made.' } },
  { tag: 'initialisation', lines: [7], title: '`int age = 19;` — declaration + initialisation',
    body: 'This **declares** the box `age` and **initialises** it — gives it its first value — in the same line. Without a first value the box holds leftover rubbish, and Visual Studio stops the program the moment you read it.',
    cut: { line: 7, to: '    int age;', note: 'It builds, but stops while running: `age` is read before it has a value.' } },
  { tag: ';', lines: [6, 7, 8, 9, 10, 11], mark: 'semi', title: '`;` — the end of one instruction',
    body: 'Every instruction ends with `;`, like a full stop ends a sentence. Lines that open or close a block (`int main() {`, `}`) and `#include` lines don’t get one.',
    cut: { line: 6, to: '    string name', note: 'One missing `;` and Visual Studio can’t tell where the instruction ends.' } },
  { tag: 'output', lines: [8, 10], title: '`cout <<` — send to the screen',
    body: '`cout` is the **c**onsole **out** — the screen. `<<` points the way the data moves: out of the program, towards `cout`. Text in double quotes is printed as it is; a variable prints its **value**; `age + 1` is worked out first (20); `"\\n"` starts a new line.',
    cut: { line: 8, to: null, note: 'It still runs — but nobody asks the user anything, so they don’t know they should type.' } },
  { tag: 'input', lines: [9], title: '`cin >>` — take from the keyboard',
    body: '`cin` is the **c**onsole **in** — the keyboard. `>>` points **into** the variable: the program waits, the user types and presses Enter, and the value is stored in `name`. cin stops at the first space.',
    cut: { line: 9, to: null, note: 'It runs, but `name` stays empty — so it greets nobody.' } },
  { tag: 'return', lines: [11], title: '`return 0;` — finished, all good',
    body: '`return 0;` ends main and hands **0** back to the computer. 0 means “finished without problems”; any other number means something went wrong.',
    cut: { line: 11, to: null, note: 'Still works: for main only, C++ adds `return 0;` for you. Write it anyway — it is the “close” step of your program logic.' } },
];

/** highlighted line with ; { } wrapped, so the ; and { } pieces can light them up (entities like &lt; keep their ;) */
const marked = (line: string) => (highlightCpp(line) || ' ')
  .replace(/(&[a-z0-9#]+;)|([;{}])/gi, (_m, ent: string | undefined, ch: string) => ent ?? `<span class="cx-an-${ch === ';' ? 'semi' : 'brace'}">${ch}</span>`);

export function anatomyVisual(host: HTMLElement) {
  const src = ANATOMY.split('\n');
  const lines = src.map((l, i) => h('div', { class: 'cx-an-line', 'data-i': String(i) },
    h('span', { class: 'cx-an-n' }, String(i + 1)), h('span', { class: 'cx-an-src', html: marked(l) }), h('span', { class: 'cx-an-tag' })));
  const codeEl = h('div', { class: 'cx-an-code mono' }, ...lines);
  const title = h('p', { class: 'cx-an-title' }, 'Tap any line of the program — or press Next ▶ to walk through it piece by piece.');
  const body = h('div', { class: 'cx-an-body' });
  const out = h('div', { class: 'cx-an-out', role: 'status' });
  let cur = -1;
  let cutOn = false;
  const cutBtn = btn('✂ Remove it — what happens?', () => cut());
  cutBtn.hidden = true;
  const chips = PIECES.map((p, i) => h('button', { type: 'button', class: 'cx-an-chip mono', 'aria-pressed': 'false', onclick: () => pick(i) }, p.tag));

  const restore = () => {
    cutOn = false;
    lines.forEach((l, i) => { l.classList.remove('is-cut', 'is-edit'); (l.children[1] as HTMLElement).innerHTML = marked(src[i]); });
    out.replaceChildren();
    cutBtn.textContent = '✂ Remove it — what happens?';
  };
  const pick = (i: number) => {
    restore();
    cur = i;
    const p = PIECES[i];
    codeEl.classList.add('has-pick');
    codeEl.classList.toggle('mark-semi', p.mark === 'semi');
    codeEl.classList.toggle('mark-brace', p.mark === 'brace');
    lines.forEach((l, j) => { l.classList.toggle('is-on', p.lines.includes(j)); l.children[2].textContent = j === p.lines[0] ? p.tag : ''; });
    chips.forEach((c, j) => { c.classList.toggle('is-on', j === i); c.setAttribute('aria-pressed', String(j === i)); });
    title.innerHTML = md(p.title);
    body.innerHTML = md(p.body);
    cutBtn.hidden = false;
  };
  const cut = () => {
    if (cur < 0) return;
    if (cutOn) { restore(); return; }
    const p = PIECES[cur];
    const edited = [...src];
    const line = lines[p.cut.line];
    if (p.cut.to === null) { edited.splice(p.cut.line, 1); line.classList.add('is-cut'); }
    else { edited[p.cut.line] = p.cut.to; line.classList.add('is-edit'); (line.children[1] as HTMLElement).innerHTML = marked(p.cut.to); }
    out.replaceChildren(h('p', { class: 'cx-an-note', html: md(p.cut.note) }), outcome(edited.join('\n'), 'Mona'));
    cutOn = true;
    cutBtn.textContent = '↩ Put it back';
  };
  lines.forEach((l, i) => l.addEventListener('click', () => {
    const k = PIECES.findIndex((p) => !p.mark && p.lines.includes(i));
    if (k >= 0) pick(k);
  }));

  host.replaceChildren(h('div', { class: 'cx-an' }, codeEl,
    h('div', { class: 'cx-an-side' },
      h('div', { class: 'cx-an-chips', role: 'group', 'aria-label': 'Pieces of the program' }, ...chips),
      h('div', { class: 'cx-an-card' }, title, body,
        h('div', { class: 'cx-vis-bar' }, btn('◀', () => pick((cur - 1 + PIECES.length) % PIECES.length)), btn('Next ▶', () => pick((cur + 1) % PIECES.length), 'btn-primary'), cutBtn),
        out))));
}

/* =================================================================== why int main()? */

export function mainVisual(host: HTMLElement) {
  let ret = 0;
  let busy = false;
  const stage = h('div', { class: 'cx-mn' });
  const pcSay = h('p', { class: 'cx-mn-say' }, 'Waiting. Press ▶ Run the program.');
  const pc = h('div', { class: 'cx-mn-pc' }, h('p', { class: 'cx-vis-k mono' }, '💻 The computer'), pcSay);
  const src = () => ['int main() {', '    cout << "Hi\\n";', `    return ${ret};`, '}'];
  const lines = src().map((l) => h('div', { class: 'cx-mn-line mono', html: highlightCpp(l) }));
  const screen = h('pre', { class: 'cx-con mono cx-mn-con' }, ' ');
  const say = h('p', { class: 'cx-vis-say' });
  const on = (i: number) => lines.forEach((l, j) => l.classList.toggle('is-on', j === i));

  const play = async () => {
    if (busy) return;
    busy = true;
    screen.textContent = ' ';
    on(-1);
    pcSay.innerHTML = md('You pressed **▶ Run**. I look for the function called **main** and start at its first line.');
    await sleep(700);
    await fly(stage, pc, lines[0], 'start', 'is-in');
    on(0);
    await sleep(500);
    on(1);
    await fly(stage, lines[1], screen, 'Hi', 'is-out');
    screen.textContent = 'Hi\n';
    await sleep(400);
    on(2);
    await fly(stage, lines[2], pc, String(ret));
    pcSay.innerHTML = md(ret === 0 ? 'main gave back **0** → “finished without problems” ✓' : `main gave back **${ret}** → “something went wrong” ✗`);
    screen.textContent = `Hi\n\nC:\\Users\\you\\Project1.exe exited with code ${ret}.`;
    on(3);
    say.innerHTML = md(ret === 0
      ? 'That is why it is **int** main: when main finishes it hands a whole number back to the computer. **0** = all good. Visual Studio prints it at the end: “exited with code 0”.'
      : 'Any number other than 0 tells the computer “something went wrong”. Your programs finish normally, so they always `return 0;`.');
    busy = false;
  };
  const flip = btn('Try return 1', () => {
    if (busy) return;
    ret = ret === 0 ? 1 : 0;
    lines[2].innerHTML = highlightCpp(src()[2]);
    flip.textContent = ret === 0 ? 'Try return 1' : 'Back to return 0';
    void play();
  });

  const legend = [
    ['int', 'the kind of answer main gives back: a whole number'],
    ['main', 'the name the computer looks for — it must be exactly main'],
    ['()', 'main’s inputs: none here'],
    ['{ }', 'main’s body: every instruction of the program'],
    ['return 0;', 'the answer it gives back: 0 = all good'],
  ].map(([k, v]) => h('div', { class: 'cx-mn-key' }, code(k), h('span', null, v)));

  stage.append(pc, h('div', { class: 'cx-mn-code' }, ...lines), h('div', { class: 'cx-mn-out' }, h('p', { class: 'cx-vis-k mono' }, '🖥 Console'), screen));
  host.replaceChildren(stage, h('div', { class: 'cx-mn-legend' }, ...legend),
    h('div', { class: 'cx-vis-bar' }, btn('▶ Run the program', () => void play(), 'btn-primary'), flip, say));
  say.innerHTML = md('Press **▶ Run the program** and follow the chip: who starts main, and what main hands back at the end.');
}

/* =================================================================== the life of a variable */

const LIFE = [
  { src: 'int age;', tag: 'declaration',
    say: '**Declaration**: a box called `age` is made in memory for a whole number (an int takes 4 bytes). It has **no value yet** (`?`) — reading it now would stop the program.' },
  { src: 'age = 19;', tag: 'assignment',
    say: '**Assignment**: `=` means “store into” — not “is equal to” (that is `==`). The value on the right goes into the box on the left.' },
  { src: 'int year = 2026;', tag: 'declaration + initialisation',
    say: '**Initialisation**: declare the box **and** give it its first value in one line. A good habit: no box without a value.' },
  { src: 'age = age + 1;', tag: 'assignment',
    say: 'The right side is worked out first, with the **old** value (19 + 1 = 20), then the result **replaces** it. A box holds one value at a time.' },
  { src: 'cin >> age;', tag: 'input',
    say: '**cin** waits for the keyboard and stores what the user types **into** the box. The old value is gone.' },
  { src: 'cout << age;', tag: 'output',
    say: '**cout** copies the value **out** to the screen. The box keeps its value — printing does not empty it.' },
];

export function variableVisual(host: HTMLElement) {
  const stage = h('div', { class: 'cx-vr' });
  const rows = LIFE.map((s, i) => h('li', { class: 'cx-vr-line' }, h('span', { class: 'cx-vr-n mono' }, String(i + 1)), code(s.src), h('span', { class: 'cx-vr-tag mono' })));
  const mem = h('div', { class: 'cx-mem cx-vr-mem' });
  const empty = h('p', { class: 'cx-vr-empty' }, 'Memory is empty: no variables yet.');
  const typed = h('input', { class: 'input mono cx-vr-in', value: '25', 'aria-label': 'What the user will type' }) as HTMLInputElement;
  const screen = h('pre', { class: 'cx-con mono cx-vr-con' }, ' ');
  const say = h('p', { class: 'cx-vis-say' });
  const boxes: Record<string, HTMLElement> = {};
  let step = 0;
  let busy = false;
  const next = btn('▶ Next line', () => void go(), 'btn-primary');

  const reset = () => {
    step = 0;
    rows.forEach((r) => { r.classList.remove('is-on', 'is-done'); r.querySelector('.cx-vr-tag')!.textContent = ''; });
    for (const k of Object.keys(boxes)) delete boxes[k];
    mem.replaceChildren(empty);
    screen.textContent = ' ';
    next.textContent = '▶ Next line';
    next.disabled = false;
    say.innerHTML = md('Press **▶ Next line** and watch memory. Each line is one of the words you need: declaration, initialisation, assignment, input, output.');
  };
  const make = (name: string, note: string) => {
    if (!boxes[name]) { empty.remove(); boxes[name] = memBox('int', name, '?', note); mem.append(boxes[name]); setVal(boxes[name], '?'); }
    return boxes[name];
  };

  const go = async () => {
    if (busy || step >= LIFE.length) return;
    busy = true;
    const row = rows[step];
    rows.forEach((r, j) => r.classList.toggle('is-on', j === step));
    row.querySelector('.cx-vr-tag')!.textContent = LIFE[step].tag;
    say.innerHTML = md(LIFE[step].say);
    switch (step) {
      case 0: make('age', '4 bytes'); break;
      case 1: await fly(stage, row, boxes.age, '19'); setVal(boxes.age, '19'); break;
      case 2: { const y = make('year', '4 bytes'); await fly(stage, row, y, '2026'); setVal(y, '2026'); break; }
      case 3:
        await fly(stage, boxes.age, row, '19', 'is-out');
        await fly(stage, row, boxes.age, '20');
        setVal(boxes.age, '20');
        break;
      case 4: {
        const m = typed.value.match(/^\s*[+-]?\d+/);
        if (m) { await fly(stage, typed, boxes.age, m[0].trim(), 'is-in'); setVal(boxes.age, String(Number(m[0]))); }
        else { setVal(boxes.age, '0'); say.innerHTML = md(`cin wanted a **whole number** but the user typed “${typed.value}”. The box gets **0** and cin stops reading.`); }
        break;
      }
      case 5: {
        const v = boxes.age.querySelector('.cx-val')!.textContent ?? '';
        await fly(stage, boxes.age, screen, v, 'is-out');
        screen.textContent = v;
        setVal(boxes.age, v, 'is-read');
        break;
      }
    }
    row.classList.add('is-done');
    step++;
    if (step === LIFE.length) {
      next.textContent = '✓ Done';
      next.disabled = true;
      say.innerHTML += md('\n\n**Declaration** makes the box · **initialisation** gives its first value · **assignment** (`=`) replaces the value · **cin** fills it from the keyboard · **cout** copies it to the screen.');
    }
    busy = false;
  };

  stage.append(
    h('ol', { class: 'cx-vr-code' }, ...rows),
    h('div', { class: 'cx-vr-right' },
      h('p', { class: 'cx-vis-k mono' }, 'Memory'), mem,
      h('label', { class: 'cx-vr-kb' }, h('span', { class: 'cx-vis-k mono' }, '⌨ The user will type'), typed),
      h('p', { class: 'cx-vis-k mono' }, '🖥 Console'), screen));
  host.replaceChildren(stage, h('div', { class: 'cx-vis-bar' }, next, btn('⟲ Start again', () => { if (!busy) reset(); }), say));
  reset();
}

/* =================================================================== data types: what is really stored */

const KINDS = [
  { t: 'int', bytes: 4, holds: 'whole numbers, about −2.1 billion … 2.1 billion' },
  { t: 'float', bytes: 4, holds: 'decimals, about 7 digits' },
  { t: 'double', bytes: 8, holds: 'decimals, about 15 digits — the usual choice' },
  { t: 'char', bytes: 1, holds: "one character in single quotes, 'A' — stored as a number" },
  { t: 'string', bytes: 0, holds: 'text in double quotes, "Mona" — any length' },
  { t: 'bool', bytes: 1, holds: 'true or false — cout prints 1 or 0' },
];
const TB_PRESETS = ['19', '-7', '3.75', '3.14159265358979', "'A'", '"Mona"', 'true', '3000000000'];
const kept = (v: number, digits: number) => String(Number(v.toPrecision(digits)));

export function typeboxVisual(host: HTMLElement) {
  const input = h('input', { class: 'input mono cx-tb-in', value: '3.75', 'aria-label': 'The value to store' }) as HTMLInputElement;
  const rows = KINDS.map((k) => {
    const cells = k.bytes ? h('span', { class: 'cx-tb-bytes', title: `${k.bytes} byte${k.bytes > 1 ? 's' : ''}` }, ...Array.from({ length: k.bytes }, () => h('i', null)), h('em', null, `${k.bytes} B`)) : h('span', { class: 'cx-tb-bytes is-grow' }, h('em', null, 'grows'));
    const res = h('div', { class: 'cx-tb-res' });
    const row = h('div', { class: 'cx-tb-row', 'data-type': k.t }, h('span', { class: 'cx-tb-type mono' }, k.t), cells, h('span', { class: 'cx-tb-holds' }, k.holds), res);
    return { k, row, res };
  });
  const say = h('p', { class: 'cx-vis-say' });

  const show = () => {
    const v = input.value.trim() || '0';
    for (const { k, row, res } of rows) {
      const r = run(`#include <iostream>\n#include <string>\nusing namespace std;\nint main() {\n    ${k.t} x = ${v};\n    cout << x;\n    return 0;\n}\n`, '', 5_000);
      row.classList.remove('is-ok', 'is-warn', 'is-err');
      if (!r.compiled.ok) {
        row.classList.add('is-err');
        res.replaceChildren(h('b', null, '✗ '), h('span', null, r.compiled.errors[0].message));
        continue;
      }
      const w = r.compiled.warnings[0];
      const out = r.output;
      const c = out.length === 1 ? out.charCodeAt(0) : -1;
      const shown = k.t === 'char' && c >= 0 && (c < 32 || c === 127) ? `(character number ${c}: nothing visible)` : out;
      row.classList.add(w ? 'is-warn' : 'is-ok');
      const num = Number(v);
      const extra = (k.t === 'float' || k.t === 'double') && /^[+-]?\d*\.\d+$/.test(v) && Number.isFinite(num)
        ? h('span', { class: 'cx-tb-kept' }, `really stored: ${k.t === 'float' ? kept(Math.fround(num), 9) : kept(num, 15)}`) : null;
      res.replaceChildren(...[h('span', { class: 'cx-tb-k mono' }, 'cout << x →'), h('b', { class: 'mono' }, shown || ' '), extra, w ? h('span', { class: 'cx-tb-w' }, `⚠ ${w.message}`) : null].filter((n): n is HTMLElement => n !== null));
    }
    say.innerHTML = md(`Each row runs \`T x = ${v};\` then \`cout << x;\`. Green: stored as it is. Amber: Visual Studio warns — something is lost. Red: it does not build.`);
  };
  input.addEventListener('input', show);
  const presets = TB_PRESETS.map((p) => btn(p, () => { input.value = p; show(); }));
  host.replaceChildren(
    h('div', { class: 'cx-tb-top' }, h('label', { class: 'mono' }, 'T x = ', input, ';')),
    h('div', { class: 'cx-vis-bar' }, h('span', { class: 'cx-vis-k mono' }, 'Try:'), ...presets),
    h('div', { class: 'cx-tb' }, ...rows.map((r) => r.row)),
    h('div', { class: 'cx-vis-bar' }, say));
  show();
}

/* =================================================================== keyboard → program → screen */

export function flowVisual(host: HTMLElement) {
  const stage = h('div', { class: 'cx-fl' });
  const typed = h('input', { class: 'input mono cx-fl-in', value: 'Mona', 'aria-label': 'What the user types' }) as HTMLInputElement;
  const cinCode = code('cin >> name;');
  const box = memBox('string', 'name');
  const coutCode = code('cout << "Hi " << name;');
  const screen = h('pre', { class: 'cx-con mono cx-fl-screen' }, ' ');
  const say = h('p', { class: 'cx-vis-say' });
  const out = h('div', { class: 'cx-an-out' });
  let busy = false;
  const arrow = () => h('span', { class: 'cx-fl-arrow', 'aria-hidden': 'true' }, '→');
  const node = (label: string, ...kids: (Node | null)[]) => h('div', { class: 'cx-fl-node' }, h('p', { class: 'cx-vis-k mono' }, label), ...kids);

  const play = async () => {
    if (busy) return;
    busy = true;
    out.replaceChildren();
    screen.textContent = ' ';
    setVal(box, '?');
    const word = typed.value.trim().split(/\s+/)[0] ?? '';
    await fly(stage, typed, cinCode, word || '⏎', 'is-in');
    await fly(stage, cinCode, box, `"${word}"`, 'is-in');
    setVal(box, `"${word}"`);
    await sleep(250);
    await fly(stage, coutCode, screen, 'Hi ', 'is-out');
    screen.textContent = 'Hi ';
    await fly(stage, box, screen, word, 'is-out');
    screen.textContent = `Hi ${word}`;
    say.innerHTML = md(typed.value.trim().includes(' ')
      ? `cin stopped at the space: only **${word}** went into \`name\`. (To read a whole line, use \`getline(cin, name)\` — Part 8.)`
      : '**cin** = console **in**: `>>` points **into** `name`. **cout** = console **out**: `<<` points **towards** cout. Data always flows the way the arrows point.');
    busy = false;
  };
  const wrong = () => {
    out.replaceChildren(h('p', { class: 'cx-an-note', html: md('Swap the arrows: `cin << name;`') }),
      outcome('#include <iostream>\n#include <string>\nusing namespace std;\nint main() {\n    string name;\n    cin << name;\n    return 0;\n}\n', ''));
  };

  stage.append(
    node('⌨ Keyboard', typed), arrow(), node('reads', cinCode), arrow(), node('Memory', box), arrow(), node('prints', coutCode), arrow(), node('🖥 Screen', screen));
  host.replaceChildren(stage, h('div', { class: 'cx-vis-bar' }, btn('▶ Run', () => void play(), 'btn-primary'), btn('What if: cin << name ?', wrong), say), out);
  say.innerHTML = md('Type a name, press **▶ Run** and follow the data: keyboard → `cin` → the box → `cout` → screen. Then try a full name with a space.');
}

/* =================================================================== the toolbox: every function, operator and symbol */

type Tool = { k: string; sig: string; what: string; watch: string; args?: [string, string][]; input?: string; code: (a: string[]) => string };
type Shelf = { label: string; include: string; tools: Tool[] };

const WORD = '"Introduction"';
const SHELVES: Shelf[] = [
  { label: 'cmath', include: '#include <cmath>', tools: [
    { k: 'sqrt', sig: 'sqrt(x)', what: 'the **square root**: the number that, times itself, gives x.', watch: 'It always gives back a **double**: `sqrt(2)` prints 1.41421 (cout shows 6 digits).', args: [['x', '16']], code: (a) => `cout << sqrt(${a[0]});` },
    { k: 'pow', sig: 'pow(x, y)', what: '**x to the power y**: x multiplied by itself y times.', watch: '`pow(2, 3)` is 8. In C++ `2^3` is **not** a power. pow gives back a double.', args: [['x', '2'], ['y', '10']], code: (a) => `cout << pow(${a[0]}, ${a[1]});` },
    { k: 'round', sig: 'round(x)', what: 'the **nearest** whole number; .5 goes away from zero.', watch: '`round(2.5)` is 3 and `round(-2.5)` is -3.', args: [['x', '2.5']], code: (a) => `cout << round(${a[0]});` },
    { k: 'floor', sig: 'floor(x)', what: '**down** to the whole number at or below x.', watch: '`floor(-4.7)` is -5: down, not towards zero.', args: [['x', '4.7']], code: (a) => `cout << floor(${a[0]});` },
    { k: 'ceil', sig: 'ceil(x)', what: '**up** to the whole number at or above x.', watch: '`ceil(4.1)` is 5; `ceil(-4.1)` is -4.', args: [['x', '4.1']], code: (a) => `cout << ceil(${a[0]});` },
  ] },
  { label: 'algorithm', include: '#include <algorithm>', tools: [
    { k: 'max', sig: 'max(a, b)', what: 'the **bigger** of two values.', watch: 'Both must be the **same type**: `max(3, 4.5)` does not build — write `max(3.0, 4.5)`. Try it.', args: [['a', '3'], ['b', '7']], code: (a) => `cout << max(${a[0]}, ${a[1]});` },
    { k: 'min', sig: 'min(a, b)', what: 'the **smaller** of two values.', watch: 'The smallest of three: `min(a, min(b, c))`.', args: [['a', '3'], ['b', '7']], code: (a) => `cout << min(${a[0]}, ${a[1]});` },
  ] },
  { label: 'iostream', include: '#include <iostream>', tools: [
    { k: 'cout <<', sig: 'cout << value', what: '**prints** to the screen: text, numbers, variables, calculations.', watch: 'Nothing is added between values — not even a space: `cout << a << " " << b;`', args: [['value', '"Total: " << 5 + 3']], code: (a) => `cout << ${a[0]};` },
    { k: 'cin >>', sig: 'cin >> variable', what: 'reads **one** value — one word — from the keyboard into a variable.', watch: 'It stops at the first space: “Mohamed Salah” gives just “Mohamed”.', input: 'Mohamed Salah', code: () => 'string word;\ncin >> word;\ncout << word;' },
    { k: 'getline', sig: 'getline(cin, s)', what: 'reads the **whole line**, spaces included, into a string.', watch: 'Right after `cin >> x` the Enter key is still waiting, so a getline there reads an empty line. Part 8 shows the fix.', input: 'Mohamed Salah', code: () => 'string line;\ngetline(cin, line);\ncout << line;' },
  ] },
  { label: 'string', include: '#include <string>', tools: [
    { k: 'length()', sig: 's.length()', what: '**how many** characters — spaces count too.', watch: 'The last position is `s.length() - 1`, because positions start at 0.', args: [['s', WORD]], code: (a) => `string s = ${a[0]};\ncout << s.length();` },
    { k: 's[i]', sig: 's[i]', what: 'the character at **position i**. Positions start at **0**.', watch: '`s[99]` is past the end: Visual Studio stops with “string subscript out of range”.', args: [['s', WORD], ['i', '0']], code: (a) => `string s = ${a[0]};\ncout << s[${a[1]}];` },
    { k: 'at(i)', sig: 's.at(i)', what: 'the same as `s[i]`, but it **checks** the position first.', watch: '`s.at(99)` stops the program with “out_of_range”.', args: [['s', WORD], ['i', '3']], code: (a) => `string s = ${a[0]};\ncout << s.at(${a[1]});` },
    { k: 'find', sig: 's.find(x)', what: 'the position of the **first** x — a character `\'o\'` or a text `"duc"`.', watch: 'Not found → `string::npos`. Check with `if (s.find(x) != string::npos)`.', args: [['s', WORD], ['x', "'o'"]], code: (a) => `string s = ${a[0]};\ncout << s.find(${a[1]});` },
    { k: 'substr', sig: 's.substr(start, length)', what: 'a **piece** of the string: where it starts, then **how many** characters.', watch: 'The second number is a **length**, not an end position. Leave it out to take the rest: `s.substr(5)`.', args: [['s', WORD], ['start', '5'], ['length', '3']], code: (a) => `string s = ${a[0]};\ncout << s.substr(${a[1]}, ${a[2]});` },
    { k: 'npos', sig: 'string::npos', what: 'the answer `find` gives when there is **no match** — the biggest size_t number.', watch: 'Don’t print it — compare with it: `!= string::npos` means “found”.', code: () => 'cout << string::npos;' },
    { k: 'stoi', sig: 'stoi(text)', what: '**text → int**: "42" becomes the number 42 (here + 1).', watch: '`stoi("abc")` stops the program (“invalid_argument”). `stoi("-23")` works.', args: [['text', '"42"']], code: (a) => `cout << stoi(${a[0]}) + 1;` },
    { k: 'stod', sig: 'stod(text)', what: '**text → double**: "3.75" becomes 3.75 (here × 2).', watch: 'Use it to calculate with numbers that arrived as text.', args: [['text', '"3.75"']], code: (a) => `cout << stod(${a[0]}) * 2;` },
    { k: 'to_string', sig: 'to_string(n)', what: '**number → text**, so you can join it to other text with `+`.', watch: '`to_string(3.5)` gives "3.500000" — six decimals.', args: [['n', '42']], code: (a) => `cout << to_string(${a[0]}) + "!";` },
  ] },
  { label: 'operators', include: 'built into C++ — no #include', tools: [
    { k: '/', sig: 'a / b', what: '**division**. int / int gives an int: the decimals are cut off.', watch: '`7 / 2` is 3, but `7 / 2.0` is 3.5.', args: [['a', '7'], ['b', '2']], code: (a) => `cout << ${a[0]} / ${a[1]};` },
    { k: '%', sig: 'a % b', what: 'the **remainder** after whole-number division.', watch: '`n % 2 == 0` means n is even.', args: [['a', '7'], ['b', '2']], code: (a) => `cout << ${a[0]} % ${a[1]};` },
    { k: '+= -= *= /= %=', sig: 'x += 5', what: 'short for `x = x + 5` — and the same with -, *, / and %.', watch: 'The box changes: its old value is gone.', args: [['x starts at', '10'], ['add', '5']], code: (a) => `int x = ${a[0]};\nx += ${a[1]};\ncout << x;` },
    { k: '++ --', sig: 'x++   x--', what: '**add 1** and **take away 1**.', watch: 'On a line of its own `x++` and `++x` do the same; inside a bigger line they differ (Part 5).', args: [['x starts at', '5']], code: (a) => `int x = ${a[0]};\nx++;\ncout << x;` },
    { k: '== != < >', sig: 'a == b', what: '**compare**: `==` equal, `!=` not equal, `<` `>` `<=` `>=`. The answer is true (1) or false (0).', watch: '`=` stores, `==` compares. `if (x = 5)` is a classic bug.', args: [['a', '5'], ['b', '5']], code: (a) => `cout << (${a[0]} == ${a[1]}) << (${a[0]} != ${a[1]}) << (${a[0]} < ${a[1]});` },
    { k: 'and or', sig: 'p and q   p or q', what: '**and** (`&&`): both must be true. **or** (`||`): at least one must be.', watch: '`0 < x < 10` does not mean what it looks like — write `x > 0 and x < 10`.', args: [['x', '7']], code: (a) => `int x = ${a[0]};\ncout << (x > 0 and x < 10) << (x < 0 or x > 100);` },
  ] },
  { label: 'symbols', include: 'built into C++ — no #include', tools: [
    { k: '\\n', sig: '"\\n"', what: '**new line**: what comes next starts on the next line.', watch: 'It goes inside the quotes: `"Hello\\n"`. `endl` does the same job.', code: () => 'cout << "Hello\\nWorld";' },
    { k: '\\t', sig: '"\\t"', what: 'a **tab**: jumps to the next column.', watch: 'Handy for neat tables.', code: () => 'cout << "Name\\tAge\\nMona\\t19";' },
    { k: '// /* */', sig: '// …   /* … */', what: '**comments**: `//` until the end of the line, `/* … */` over many lines.', watch: 'Comments are for people — the computer skips them.', code: () => '// the computer skips this\n/* and this,\n   over two lines */\ncout << "only this runs";' },
    { k: 'const', sig: 'const double PI = 3.14159;', what: 'a box whose value can **never change**.', watch: 'Try `PI = 3;` after it: it does not build.', code: () => 'const double PI = 3.14159;\ncout << PI * 2;' },
  ] },
];

const unquote = (v: string) => v.trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');

/** the string as numbered cells, with the cells a string tool looks at lit up */
function stringCells(tool: Tool, a: string[]) {
  const s = unquote(a[0] ?? '');
  let hi: number[] = [];
  if (tool.k === 'length()') hi = [...s].map((_, i) => i);
  else if (tool.k === 's[i]' || tool.k === 'at(i)') hi = [Number(a[1])];
  else if (tool.k === 'find') { const x = unquote(a[1] ?? ''); const p = x ? s.indexOf(x) : -1; if (p >= 0) hi = [...x].map((_, i) => p + i); }
  else if (tool.k === 'substr') { const st = Number(a[1]); const n = a[2]?.trim() ? Number(a[2]) : s.length; hi = Array.from({ length: Math.max(0, Math.min(n, s.length - st)) }, (_, i) => st + i); }
  return h('div', { class: 'cx-tx-str mono' }, ...[...s].map((c, i) => h('span', { class: `cx-tx-c${hi.includes(i) ? ' is-hit' : ''}` }, h('b', null, c === ' ' ? '·' : c), h('i', null, String(i)))));
}

export function toolboxVisual(host: HTMLElement) {
  const stage = h('div', { class: 'cx-tx' });
  const shelfBar = h('div', { class: 'cx-tx-shelves', role: 'tablist', 'aria-label': 'Libraries' });
  const toolBar = h('div', { class: 'cx-tx-tools', role: 'group', 'aria-label': 'Tools' });
  const card = h('div', { class: 'cx-tx-card' });
  let shelf = 0;
  let busy = false;

  const open = (si: number, ti: number) => {
    shelf = si;
    [...shelfBar.children].forEach((b, j) => { b.classList.toggle('is-on', j === si); b.setAttribute('aria-selected', String(j === si)); });
    const tools = SHELVES[si].tools;
    toolBar.replaceChildren(...tools.map((t, j) => h('button', { type: 'button', class: `cx-an-chip mono${j === ti ? ' is-on' : ''}`, onclick: () => open(si, j) }, t.k)));
    const tool = tools[ti];
    const inputs = (tool.args ?? []).map(([label, value]) => h('input', { class: 'input mono cx-tx-arg', value, 'aria-label': label, size: String(Math.max(3, value.length + 1)) }) as HTMLInputElement);
    const typed = tool.input !== undefined ? h('input', { class: 'input mono cx-tx-arg', value: tool.input, 'aria-label': 'What the user types', size: '16' }) as HTMLInputElement : null;
    const mach = h('div', { class: 'cx-tx-mach mono' }, tool.k);
    const result = h('div', { class: 'cx-tx-res mono' }, ' ');
    const codeBox = h('pre', { class: 'cx-tx-code mono' });
    const msg = h('div', { class: 'cx-tx-msg' });
    const cells = h('div');
    const vals = () => inputs.map((i) => i.value);
    const compute = () => {
      const src = tool.code(vals());
      codeBox.innerHTML = highlightCpp(src);
      const r = run(`#include <iostream>\n#include <string>\n#include <cmath>\n#include <algorithm>\nusing namespace std;\nint main() {\n${src}\nreturn 0;\n}\n`, typed ? `${typed.value}\n` : '', 20_000);
      if (SHELVES[shelf].label === 'string' && tool.args?.[0]?.[0] === 's') cells.replaceChildren(stringCells(tool, vals()));
      if (!r.compiled.ok) return { text: '✗', note: h('div', { class: 'cx-msg is-err' }, h('p', { html: md(`**It does not build.** ${r.compiled.errors[0].code ?? ''} ${r.compiled.errors[0].message}`) })) };
      if (r.error) return { text: '✗', note: h('div', { class: 'cx-msg is-err' }, h('p', { html: md(`**It builds, but stops while running:** ${r.error.message}`) })) };
      return { text: r.output || ' ', note: null };
    };
    const show = (x: { text: string; note: HTMLElement | null }) => {
      result.textContent = x.text;
      result.classList.toggle('is-bad', x.text === '✗');
      msg.replaceChildren(...(x.note ? [x.note] : []));
    };
    const play = async () => {
      if (busy) return;
      busy = true;
      const x = compute();
      result.textContent = ' ';
      for (const i of [...inputs, ...(typed ? [typed] : [])]) await fly(stage, i, mach, i.value.length > 14 ? `${i.value.slice(0, 13)}…` : i.value, 'is-in');
      mach.classList.remove('is-busy'); void mach.offsetWidth; mach.classList.add('is-busy');
      await sleep(350);
      if (x.text !== '✗') await fly(stage, mach, result, x.text.length > 14 ? `${x.text.slice(0, 13)}…` : x.text, 'is-out');
      show(x);
      busy = false;
    };
    [...inputs, ...(typed ? [typed] : [])].forEach((i) => i.addEventListener('input', () => show(compute())));
    card.replaceChildren(
      h('div', { class: 'cx-tx-head' }, code(tool.sig), h('span', { class: 'cx-tx-inc mono' }, SHELVES[si].include)),
      h('p', { class: 'cx-tx-what', html: md(`**${tool.k}** — ${tool.what}`) }),
      h('div', { class: 'cx-tx-machine' },
        h('div', { class: 'cx-tx-ins' }, ...inputs.map((i, j) => h('label', { class: 'cx-tx-in' }, h('span', { class: 'mono' }, tool.args![j][0]), i)), ...(typed ? [h('label', { class: 'cx-tx-in' }, h('span', { class: 'mono' }, '⌨ the user types'), typed)] : []), ...(!inputs.length && !typed ? [h('span', { class: 'cx-tx-none' }, 'no inputs')] : [])),
        h('span', { class: 'cx-fl-arrow', 'aria-hidden': 'true' }, '→'), mach, h('span', { class: 'cx-fl-arrow', 'aria-hidden': 'true' }, '→'), result),
      cells,
      h('div', { class: 'cx-vis-bar' }, btn('▶ Run it', () => void play(), 'btn-primary'), h('p', { class: 'cx-vis-say', html: md(`⚠ ${tool.watch}`) })),
      msg,
      h('details', { class: 'cx-tx-src' }, h('summary', null, 'The C++ it runs'), codeBox));
    show(compute());
  };

  SHELVES.forEach((s, i) => shelfBar.append(h('button', { type: 'button', role: 'tab', class: 'cx-gl-tab mono', onclick: () => open(i, 0) }, s.label)));
  stage.append(shelfBar, toolBar, card);
  host.replaceChildren(stage);
  open(0, 0);
}
