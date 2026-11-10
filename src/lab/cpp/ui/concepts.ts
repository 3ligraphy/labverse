/**
 * "Start here: the words of C++" — the first part of the Introduction to Computing revision lab. One visual per idea
 * (the pieces of a program, why int main, a variable's life, data types, cin/cout), each driven by the student, and
 * each running the real engine so every error message is the one Visual Studio would give.
 */
import { h, md } from '../../ui/dom.ts';
import { run } from '../index.ts';
import { formatG } from '../values.ts';
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
  { tag: 'library', lines: [0, 1], title: '`#include`: bring a library (a toolbox)',
    body: 'A **library** is a toolbox of code that other people wrote for us. `#include <iostream>` brings the tools to talk: `cout` (show on the screen), `cin` (read from the keyboard) and `getline`. `#include <string>` brings `string` (text). Later we also use `<cmath>` for maths (`sqrt`, `pow`, `round`) and `<algorithm>` for `max` and `min`.\n`#include` lines go at the very top. They do **not** end with `;`.',
    cut: { line: 0, to: null, note: 'Without `<iostream>`, C++ does not know `cout`. The program stops at the first `cout`, so it does not build.' } },
  { tag: 'namespace', lines: [2], title: '`using namespace std;`: use the short names',
    body: 'All the tools in these libraries have the family name **std** (short for standard). So the full name of `cout` is `std::cout`. This line lets you write the short name: `cout`, `cin` and `string`.',
    cut: { line: 2, to: null, note: 'Now C++ does not know `string`, `cout` and `cin`. You would have to write `std::cout` every time.' } },
  { tag: 'comment', lines: [4], title: '`//`: a note for people',
    body: 'Everything after `//` on a line is a **comment**. The computer does not read it. We use comments to write the plan of the program in normal words: say hello, ask for input, read it…',
    cut: { line: 4, to: null, note: 'Nothing changes. The computer never reads comments.' } },
  { tag: 'main', lines: [5, 12], title: '`int main()`: the program starts here',
    body: 'When you press ▶ Run, the computer looks for **main** and runs its lines from top to bottom.\n`int`: when main ends, it gives back a whole number.  `()`: main gets no values here.  `{ … }`: all the lines of the program go inside.',
    cut: { line: 5, to: 'main() {', note: 'Remove `int` and Visual Studio says no: main must say what kind of value it gives back.' } },
  { tag: '{ }', lines: [5, 12], mark: 'brace', title: '`{ }`: a block',
    body: '`{` opens a **block** and `}` closes it. A block is a group of lines that belong together. All the lines between main’s `{` and `}` belong to main. Every `{` needs its own `}`.',
    cut: { line: 12, to: null, note: 'Without the last `}`, main never ends, so the program does not build.' } },
  { tag: 'declaration', lines: [6], title: '`string name;`: make a box (declaration)',
    body: '**Declaration** means: make a new box in memory. First write the **type** (what can go in the box), then the **name** of the box. `string name;` makes a box called `name` for text. You must make a box **before** you use it.',
    cut: { line: 6, to: null, note: 'Now `cin >> name` tries to use a box that does not exist.' } },
  { tag: 'initialisation', lines: [7], title: '`int age = 19;`: make a box and fill it (initialisation)',
    body: 'This line makes the box `age` **and** puts the first value (19) in it. Giving a box its first value is called **initialisation**. If a box has no first value, it has a random old value inside, and Visual Studio stops the program when you read it.',
    cut: { line: 7, to: '    int age;', note: 'It builds, but it stops while running: the program reads `age` before it has a value.' } },
  { tag: ';', lines: [6, 7, 8, 9, 10, 11], mark: 'semi', title: '`;`: the end of one instruction',
    body: 'Every instruction ends with `;`, like a sentence ends with a full stop. Some lines do not get `;`: lines that open or close a block (`int main() {` and `}`), and `#include` lines.',
    cut: { line: 6, to: '    string name', note: 'One missing `;` and Visual Studio cannot see where the instruction ends.' } },
  { tag: 'output', lines: [8, 10], title: '`cout <<`: show on the screen',
    body: '`cout` shows things on the screen. The arrows `<<` point the way the data goes: out, to the screen. Words in quotes are shown exactly as they are. A box name shows the **value inside** the box. `age + 1` is calculated first (20). `"\\n"` means: go to a new line.',
    cut: { line: 8, to: null, note: 'It still runs, but the program never asks for the name. The user does not know what to type.' } },
  { tag: 'input', lines: [9], title: '`cin >>`: read from the keyboard',
    body: '`cin` reads what the user types. The arrows `>>` point **into** the box. The program waits, the user types and presses Enter, and the value goes into `name`. `cin` stops at the first space.',
    cut: { line: 9, to: null, note: 'It runs, but `name` stays empty. So it says hello to nobody.' } },
  { tag: 'return', lines: [11], title: '`return 0;`: the end, everything is OK',
    body: '`return 0;` ends main and gives **0** back to the computer. 0 means: finished with no problems. Any other number means: something went wrong.',
    cut: { line: 11, to: null, note: 'It still works: for main only, C++ adds `return 0;` for you. But always write it. It is the last step of the plan: close.' } },
];

/** highlighted line with ; { } wrapped, so the ; and { } pieces can light them up (entities like &lt; keep their ;) */
const marked = (line: string) => (highlightCpp(line) || ' ')
  .replace(/(&[a-z0-9#]+;)|([;{}])/gi, (_m, ent: string | undefined, ch: string) => ent ?? `<span class="cx-an-${ch === ';' ? 'semi' : 'brace'}">${ch}</span>`);

export function anatomyVisual(host: HTMLElement) {
  const src = ANATOMY.split('\n');
  const lines = src.map((l, i) => h('div', { class: 'cx-an-line', 'data-i': String(i) },
    h('span', { class: 'cx-an-n' }, String(i + 1)), h('span', { class: 'cx-an-src', html: marked(l) }), h('span', { class: 'cx-an-tag' })));
  const codeEl = h('div', { class: 'cx-an-code mono' }, ...lines);
  const title = h('p', { class: 'cx-an-title' }, 'Tap any line of the program, or press Next ▶ to see each part one by one.');
  const body = h('div', { class: 'cx-an-body' });
  const out = h('div', { class: 'cx-an-out', role: 'status' });
  let cur = -1;
  let cutOn = false;
  const cutBtn = btn('✂ Remove it: what happens?', () => cut());
  cutBtn.hidden = true;
  const chips = PIECES.map((p, i) => h('button', { type: 'button', class: 'cx-an-chip mono', 'aria-pressed': 'false', onclick: () => pick(i) }, p.tag));

  const restore = () => {
    cutOn = false;
    lines.forEach((l, i) => { l.classList.remove('is-cut', 'is-edit'); (l.children[1] as HTMLElement).innerHTML = marked(src[i]); });
    out.replaceChildren();
    cutBtn.textContent = '✂ Remove it: what happens?';
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
    pcSay.innerHTML = md('You pressed **▶ Run**. The computer looks for **main** and starts at its first line.');
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
    pcSay.innerHTML = md(ret === 0 ? 'main gave back **0**. This means: finished with no problems ✓' : `main gave back **${ret}**. This means: something went wrong ✗`);
    screen.textContent = `Hi\n\nC:\\Users\\you\\Project1.exe exited with code ${ret}.`;
    on(3);
    say.innerHTML = md(ret === 0
      ? 'This is why we write **int** main: when main ends, it gives a whole number back to the computer. **0** means everything is OK. Visual Studio shows it at the end: “exited with code 0”.'
      : 'Any number that is not 0 tells the computer: something went wrong. Our programs end normally, so they always `return 0;`.');
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
    ['int', 'main gives back a whole number'],
    ['main', 'the name the computer looks for. It must be exactly main'],
    ['()', 'the values main gets: none here'],
    ['{ }', 'all the lines of the program go inside'],
    ['return 0;', 'what main gives back: 0 means OK'],
  ].map(([k, v]) => h('div', { class: 'cx-mn-key' }, code(k), h('span', null, v)));

  stage.append(pc, h('div', { class: 'cx-mn-code' }, ...lines), h('div', { class: 'cx-mn-out' }, h('p', { class: 'cx-vis-k mono' }, '🖥 Console'), screen));
  host.replaceChildren(stage, h('div', { class: 'cx-mn-legend' }, ...legend),
    h('div', { class: 'cx-vis-bar' }, btn('▶ Run the program', () => void play(), 'btn-primary'), flip, say));
  say.innerHTML = md('Press **▶ Run the program** and follow the moving label. Who starts main? What does main give back at the end?');
}

/* =================================================================== the life of a variable */

const LIFE = [
  { src: 'int age;', tag: 'declaration',
    say: '**Declaration**: a new box called `age` is made in memory. It is for a whole number (an int uses 4 bytes of memory). It has **no value yet** (`?`). If you read it now, the program stops.' },
  { src: 'age = 19;', tag: 'assignment',
    say: '**Assignment**: `=` means **put into the box**. It does not mean “is equal to” (that is `==`). The value on the right goes into the box on the left.' },
  { src: 'int year = 2026;', tag: 'declaration + initialisation',
    say: '**Initialisation**: make the box **and** give it its first value, in one line. A good habit: never leave a box without a value.' },
  { src: 'age = age + 1;', tag: 'assignment',
    say: 'First the computer calculates the right side with the **old** value: 19 + 1 = 20. Then it puts 20 in the box. A box holds only **one** value, so 19 is gone.' },
  { src: 'cin >> age;', tag: 'input',
    say: '**cin** waits for the keyboard. What the user types goes **into** the box. The old value is gone.' },
  { src: 'cout << age;', tag: 'output',
    say: '**cout** shows a **copy** of the value on the screen. The box keeps its value: showing it does not empty the box.' },
];

export function variableVisual(host: HTMLElement) {
  const stage = h('div', { class: 'cx-vr' });
  const rows = LIFE.map((s, i) => h('li', { class: 'cx-vr-line' }, h('span', { class: 'cx-vr-n mono' }, String(i + 1)), code(s.src), h('span', { class: 'cx-vr-tag mono' })));
  const mem = h('div', { class: 'cx-mem cx-vr-mem' });
  const empty = h('p', { class: 'cx-vr-empty' }, 'Memory is empty: no boxes yet.');
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
    say.innerHTML = md('Press **▶ Next line** and watch the memory. Each line teaches one word: declaration, initialisation, assignment, input, output.');
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
        else { setVal(boxes.age, '0'); say.innerHTML = md(`cin wanted a **whole number**, but the user typed “${typed.value}”. So the box gets **0**, and cin stops reading.`); }
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
      say.innerHTML += md('\n\n**Declaration** makes the box · **initialisation** gives the first value · **assignment** (`=`) puts a new value in · **cin** fills the box from the keyboard · **cout** shows the value on the screen.');
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
  { t: 'int', bytes: 4, holds: 'whole numbers (no decimal point), from about −2 billion to 2 billion' },
  { t: 'float', bytes: 4, holds: 'numbers with a decimal point, about 7 digits' },
  { t: 'double', bytes: 8, holds: 'numbers with a decimal point, about 15 digits: the usual choice' },
  { t: 'char', bytes: 1, holds: "one letter or symbol in single quotes, like 'A'. Inside, it is a number" },
  { t: 'string', bytes: 0, holds: 'text in double quotes, like "Mona". Any length' },
  { t: 'bool', bytes: 1, holds: 'true or false. cout shows 1 or 0' },
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
      const shown = k.t === 'char' && c >= 0 && (c < 32 || c === 127) ? `(character number ${c}: you cannot see it)` : out;
      row.classList.add(w ? 'is-warn' : 'is-ok');
      const num = Number(v);
      const extra = (k.t === 'float' || k.t === 'double') && /^[+-]?\d*\.\d+$/.test(v) && Number.isFinite(num)
        ? h('span', { class: 'cx-tb-kept' }, `really stored: ${k.t === 'float' ? kept(Math.fround(num), 9) : kept(num, 15)}`) : null;
      res.replaceChildren(...[h('span', { class: 'cx-tb-k mono' }, 'cout << x →'), h('b', { class: 'mono' }, shown || ' '), extra, w ? h('span', { class: 'cx-tb-w' }, `⚠ ${w.message}`) : null].filter((n): n is HTMLElement => n !== null));
    }
    say.innerHTML = md(`Each row runs \`T x = ${v};\` and then \`cout << x;\`. Green: the value is kept. Yellow: Visual Studio warns you that part of the value is lost. Red: it does not build.`);
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
      ? `cin stopped at the space. Only **${word}** went into \`name\`. To read the whole line, use \`getline(cin, name)\` (see the Strings part).`
      : '**cin** = console **in**: `>>` points **into** `name`. **cout** = console **out**: `<<` points **to** cout. The data always goes the way the arrows point.');
    busy = false;
  };
  const wrong = () => {
    out.replaceChildren(h('p', { class: 'cx-an-note', html: md('Turn the arrows the wrong way: `cin << name;`') }),
      outcome('#include <iostream>\n#include <string>\nusing namespace std;\nint main() {\n    string name;\n    cin << name;\n    return 0;\n}\n', ''));
  };

  stage.append(
    node('⌨ Keyboard', typed), arrow(), node('reads', cinCode), arrow(), node('Memory', box), arrow(), node('prints', coutCode), arrow(), node('🖥 Screen', screen));
  host.replaceChildren(stage, h('div', { class: 'cx-vis-bar' }, btn('▶ Run', () => void play(), 'btn-primary'), btn('What if: cin << name ?', wrong), say), out);
  say.innerHTML = md('Type a name and press **▶ Run**. Follow the data: keyboard → `cin` → the box → `cout` → screen. Then try a full name with a space.');
}

/* =================================================================== the toolbox: every function, operator and symbol */

type Tool = { k: string; sig: string; what: string; watch: string; args?: [string, string][]; input?: string; code: (a: string[]) => string };
type Shelf = { label: string; include: string; tools: Tool[] };

const WORD = '"Introduction"';
const SHELVES: Shelf[] = [
  { label: 'cmath', include: '#include <cmath>', tools: [
    { k: 'sqrt', sig: 'sqrt(x)', what: 'the **square root** of x: the number that, multiplied by itself, gives x. sqrt(16) is 4, because 4 × 4 = 16.', watch: 'The answer is always a **double** (it can have decimals): `sqrt(2)` shows 1.41421.', args: [['x', '16']], code: (a) => `cout << sqrt(${a[0]});` },
    { k: 'pow', sig: 'pow(x, y)', what: 'x **to the power** y: x multiplied by itself y times. pow(2, 3) = 2 × 2 × 2 = 8.', watch: 'In C++, `2^3` is **not** a power. Always use pow. The answer is a double.', args: [['x', '2'], ['y', '10']], code: (a) => `cout << pow(${a[0]}, ${a[1]});` },
    { k: 'round', sig: 'round(x)', what: 'the **nearest** whole number. A number ending in .5 goes away from zero.', watch: '`round(2.5)` is 3. `round(-2.5)` is -3.', args: [['x', '2.5']], code: (a) => `cout << round(${a[0]});` },
    { k: 'floor', sig: 'floor(x)', what: 'goes **down** to a whole number.', watch: '`floor(4.7)` is 4. `floor(-4.7)` is -5, because down means smaller.', args: [['x', '4.7']], code: (a) => `cout << floor(${a[0]});` },
    { k: 'ceil', sig: 'ceil(x)', what: 'goes **up** to a whole number.', watch: '`ceil(4.1)` is 5. `ceil(-4.1)` is -4, because up means bigger.', args: [['x', '4.1']], code: (a) => `cout << ceil(${a[0]});` },
  ] },
  { label: 'algorithm', include: '#include <algorithm>', tools: [
    { k: 'max', sig: 'max(a, b)', what: 'gives the **bigger** of two values.', watch: 'Both values must be the **same type**. `max(3, 4.5)` does not build (an int and a double). Write `max(3.0, 4.5)`. Try it!', args: [['a', '3'], ['b', '7']], code: (a) => `cout << max(${a[0]}, ${a[1]});` },
    { k: 'min', sig: 'min(a, b)', what: 'gives the **smaller** of two values.', watch: 'To find the smallest of three numbers: `min(a, min(b, c))`.', args: [['a', '3'], ['b', '7']], code: (a) => `cout << min(${a[0]}, ${a[1]});` },
  ] },
  { label: 'iostream', include: '#include <iostream>', tools: [
    { k: 'cout <<', sig: 'cout << value', what: '**shows** things on the screen: text, numbers, boxes and calculations.', watch: 'cout adds nothing between values, not even a space. Write the space yourself: `cout << a << " " << b;`', args: [['value', '"Total: " << 5 + 3']], code: (a) => `cout << ${a[0]};` },
    { k: 'cin >>', sig: 'cin >> variable', what: 'reads **one** value (one word) from the keyboard and puts it in a box.', watch: 'It stops at the first space: “Mohamed Salah” gives only “Mohamed”.', input: 'Mohamed Salah', code: () => 'string word;\ncin >> word;\ncout << word;' },
    { k: 'getline', sig: 'getline(cin, s)', what: 'reads the **whole line**, with the spaces, and puts it in a string box.', watch: 'If `cin >> x` comes just before it, the Enter key is still waiting, and getline reads an empty line. The Strings part shows the fix.', input: 'Mohamed Salah', code: () => 'string line;\ngetline(cin, line);\ncout << line;' },
  ] },
  { label: 'string', include: '#include <string>', tools: [
    { k: 'length()', sig: 's.length()', what: 'tells you **how many** characters the text has. Spaces count too.', watch: 'Positions start at 0, so the last position is `s.length() - 1`.', args: [['s', WORD]], code: (a) => `string s = ${a[0]};\ncout << s.length();` },
    { k: 's[i]', sig: 's[i]', what: 'gives the character at **position i**. The first position is **0**, not 1.', watch: '`s[99]` is after the end of the text. Visual Studio stops the program: “string subscript out of range”.', args: [['s', WORD], ['i', '0']], code: (a) => `string s = ${a[0]};\ncout << s[${a[1]}];` },
    { k: 'at(i)', sig: 's.at(i)', what: 'the same as `s[i]`, but it **checks** the position first.', watch: '`s.at(99)` stops the program with “out_of_range”.', args: [['s', WORD], ['i', '3']], code: (a) => `string s = ${a[0]};\ncout << s.at(${a[1]});` },
    { k: 'find', sig: 's.find(x)', what: 'gives the position where x is found **first**. x can be one character, like `\'o\'`, or a text, like `"duc"`.', watch: 'If x is not in the text, find gives `string::npos`. Check it like this: `if (s.find(x) != string::npos)`.', args: [['s', WORD], ['x', "'o'"]], code: (a) => `string s = ${a[0]};\ncout << s.find(${a[1]});` },
    { k: 'substr', sig: 's.substr(start, length)', what: 'gives a **piece** of the text: first the start position, then **how many** characters.', watch: 'The second number is **how many**, not where to stop. Leave it out to take everything to the end: `s.substr(5)`.', args: [['s', WORD], ['start', '5'], ['length', '3']], code: (a) => `string s = ${a[0]};\ncout << s.substr(${a[1]}, ${a[2]});` },
    { k: 'npos', sig: 'string::npos', what: 'what `find` gives when it **does not find** anything. It is a very big number.', watch: 'Do not show it on the screen. Compare with it: `!= string::npos` means “found”.', code: () => 'cout << string::npos;' },
    { k: 'stoi', sig: 'stoi(text)', what: 'changes **text into an int**: "42" becomes the number 42 (here we add 1 to it).', watch: '`stoi("abc")` stops the program (“invalid_argument”). `stoi("-23")` works.', args: [['text', '"42"']], code: (a) => `cout << stoi(${a[0]}) + 1;` },
    { k: 'stod', sig: 'stod(text)', what: 'changes **text into a double**: "3.75" becomes 3.75 (here we multiply it by 2).', watch: 'Use it when a number comes in as text and you need to calculate with it.', args: [['text', '"3.75"']], code: (a) => `cout << stod(${a[0]}) * 2;` },
    { k: 'to_string', sig: 'to_string(n)', what: 'changes **a number into text**, so you can join it to other text with `+`.', watch: '`to_string(3.5)` gives "3.500000" (six decimals).', args: [['n', '42']], code: (a) => `cout << to_string(${a[0]}) + "!";` },
  ] },
  { label: 'operators', include: 'part of C++: no #include needed', tools: [
    { k: '/', sig: 'a / b', what: '**divide**. An int divided by an int gives an int: the decimals are cut off (not rounded).', watch: '`7 / 2` is 3, but `7 / 2.0` is 3.5.', args: [['a', '7'], ['b', '2']], code: (a) => `cout << ${a[0]} / ${a[1]};` },
    { k: '%', sig: 'a % b', what: 'gives the **remainder**: what is left over after dividing whole numbers.', watch: '`n % 2 == 0` means n is even.', args: [['a', '7'], ['b', '2']], code: (a) => `cout << ${a[0]} % ${a[1]};` },
    { k: '+= -= *= /= %=', sig: 'x += 5', what: 'a short way to write `x = x + 5`. It works the same way with -, *, / and %.', watch: 'The box changes: its old value is gone.', args: [['x starts at', '10'], ['add', '5']], code: (a) => `int x = ${a[0]};\nx += ${a[1]};\ncout << x;` },
    { k: '++ --', sig: 'x++   x--', what: '`++` **adds 1**. `--` **takes away 1**.', watch: 'On a line alone, `x++` and `++x` do the same thing. Inside a bigger line they are different (see the Calculating part).', args: [['x starts at', '5']], code: (a) => `int x = ${a[0]};\nx++;\ncout << x;` },
    { k: '== != < >', sig: 'a == b', what: '**compares** two values: `==` equal, `!=` not equal, `<` less, `>` more, `<=` and `>=`. The answer is true (1) or false (0).', watch: '`=` puts a value in a box. `==` compares. Writing `if (x = 5)` is a common mistake.', args: [['a', '5'], ['b', '5']], code: (a) => `cout << (${a[0]} == ${a[1]}) << (${a[0]} != ${a[1]}) << (${a[0]} < ${a[1]});` },
    { k: 'and or', sig: 'p and q   p or q', what: '**and** (also written `&&`): both must be true. **or** (also written `||`): at least one must be true.', watch: '`0 < x < 10` does not work like in maths. Write `x > 0 and x < 10`.', args: [['x', '7']], code: (a) => `int x = ${a[0]};\ncout << (x > 0 and x < 10) << (x < 0 or x > 100);` },
  ] },
  { label: 'symbols', include: 'part of C++: no #include needed', tools: [
    { k: '\\n', sig: '"\\n"', what: '**new line**: what comes next starts on the next line.', watch: 'Write it inside the quotes: `"Hello\\n"`. `endl` does the same job.', code: () => 'cout << "Hello\\nWorld";' },
    { k: '\\t', sig: '"\\t"', what: 'a **tab**: jumps to the next column.', watch: 'Good for neat tables.', code: () => 'cout << "Name\\tAge\\nMona\\t19";' },
    { k: '// /* */', sig: '// …   /* … */', what: '**comments**, notes for people: `//` until the end of the line, `/* … */` for many lines.', watch: 'The computer does not read comments.', code: () => '// the computer skips this\n/* and this,\n   over two lines */\ncout << "only this runs";' },
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
      if (r.error) return { text: '✗', note: h('div', { class: 'cx-msg is-err' }, h('p', { html: md(`**It builds, but it stops while running:** ${r.error.message}`) })) };
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
        h('div', { class: 'cx-tx-ins' }, ...inputs.map((i, j) => h('label', { class: 'cx-tx-in' }, h('span', { class: 'mono' }, tool.args![j][0]), i)), ...(typed ? [h('label', { class: 'cx-tx-in' }, h('span', { class: 'mono' }, '⌨ the user types'), typed)] : []), ...(!inputs.length && !typed ? [h('span', { class: 'cx-tx-none' }, 'no values go in')] : [])),
        h('span', { class: 'cx-fl-arrow', 'aria-hidden': 'true' }, '→'), mach, h('span', { class: 'cx-fl-arrow', 'aria-hidden': 'true' }, '→'), result),
      cells,
      h('div', { class: 'cx-vis-bar' }, btn('▶ Run it', () => void play(), 'btn-primary'), h('p', { class: 'cx-vis-say', html: md(`⚠ ${tool.watch}`) })),
      msg,
      h('details', { class: 'cx-tx-src' }, h('summary', null, 'See the C++ code'), codeBox));
    show(compute());
  };

  SHELVES.forEach((s, i) => shelfBar.append(h('button', { type: 'button', role: 'tab', class: 'cx-gl-tab mono', onclick: () => open(i, 0) }, s.label)));
  stage.append(shelfBar, toolBar, card);
  host.replaceChildren(stage);
  open(0, 0);
}

/* =================================================================== your first program, line by line */

const FIRST_CODE = [
  '#include <iostream>',
  '#include <string>',
  '#include <cmath>',
  'using namespace std;',
  '',
  'int main() {',
  '    string name;',
  '    int tickets;',
  '    double price = 25.75;',
  '    cout << "Your name? ";',
  '    cin >> name;',
  '    cout << "How many tickets? ";',
  '    cin >> tickets;',
  '    double total = tickets * price;',
  '    cout << name << ", you pay " << round(total) << "\\n";',
  '    return 0;',
  '}',
];

/** one press of Next: the lines it runs, the word it teaches, and what the line does in plain words */
const FIRST = [
  { lines: [0, 1, 2], word: 'library',
    say: '`#include` adds a **library** to the program. A library is ready-made code. `<iostream>` lets us use `cout` (show on the screen) and `cin` (read what the user types). `<string>` lets us use text. `<cmath>` lets us use maths, like `round`.' },
  { lines: [3], word: 'using namespace std',
    say: 'This line lets us write the short names `cout` and `cin`. Without it, we must write `std::cout` and `std::cin`.' },
  { lines: [5], word: 'main',
    say: 'The program **starts here**. When you press Run, the computer runs the lines inside `main`, from top to bottom.' },
  { lines: [6], word: 'variable · declaration',
    say: 'This line makes a **variable** called `name`. A variable is a place in memory that keeps a value. Making a variable is called a **declaration**. `string` means it keeps text. It is empty now.' },
  { lines: [7], word: 'data type',
    say: 'This line makes a variable called `tickets`. `int` is its **data type**: it keeps whole numbers only. It has no value yet (`?`).' },
  { lines: [8], word: 'initialisation',
    say: 'This line makes a variable called `price` **and** gives it a first value: 25.75. Giving the first value is called **initialisation**. `double` keeps numbers with a decimal point.' },
  { lines: [9], word: 'cout',
    say: '`cout` shows text **on the screen**. The text between the quotes appears exactly as it is written.' },
  { lines: [10], word: 'cin',
    say: '`cin` **waits** for the user to type. What the user types is saved in the variable `name`.' },
  { lines: [11], word: 'cout',
    say: 'Show the next question on the screen.' },
  { lines: [12], word: 'cin',
    say: 'The user types a whole number. It is saved in `tickets`. The `?` is gone.' },
  { lines: [13], word: '= (save into)',
    say: 'Multiply `tickets` by `price`, then save the answer in a new variable, `total`. `=` means: **save the value on the right into the variable on the left**.' },
  { lines: [14], word: 'function',
    say: 'Show the answer. `name` shows the text saved in it. `round(total)` is a **function**: you give it a number and it gives back the nearest whole number. `"\\n"` moves to a new line.' },
  { lines: [15, 16], word: 'return 0',
    say: 'The program **ends** here. `return 0` means: it finished with no problems.' },
];

const WORDS: [string, string, number][] = [
  ['library', 'ready-made code you add with #include', 1],
  ['using namespace std', 'lets you write short names, like cout', 2],
  ['main', 'the program starts here', 3],
  ['variable', 'a place in memory that keeps a value', 4],
  ['declaration', 'making a variable', 4],
  ['data type', 'what kind of value a variable keeps', 5],
  ['initialisation', 'giving a variable its first value', 6],
  ['cout', 'shows on the screen', 7],
  ['cin', 'reads what the user types', 8],
  ['=', 'saves a value into a variable', 11],
  ['function', 'ready-made code that gives back an answer', 12],
  ['return 0', 'the program ended with no problems', 13],
];

export function firstProgramVisual(host: HTMLElement) {
  const stage = h('div', { class: 'cx-fp' });
  const nameIn = h('input', { class: 'input mono cx-fp-in', value: 'Mona', 'aria-label': 'The name the user will type' }) as HTMLInputElement;
  const ticketsIn = h('input', { class: 'input mono cx-fp-in', value: '2', inputmode: 'numeric', 'aria-label': 'The number of tickets the user will type' }) as HTMLInputElement;
  const counter = h('span', { class: 'cx-fp-count mono' });
  const word = h('span', { class: 'cx-fp-word' });
  const say = h('p', { class: 'cx-fp-say' });
  const lines = FIRST_CODE.map((l, i) => h('div', { class: 'cx-fp-line', html: `<span class="cx-fp-n">${i + 1}</span>${highlightCpp(l) || ' '}` }));
  const mem = h('div', { class: 'cx-mem cx-fp-mem' });
  const screen = h('pre', { class: 'cx-con mono cx-fp-screen' }, ' ');
  const words = h('ul', { class: 'cx-fp-words' }, ...WORDS.map(([w, m]) => h('li', null, h('b', { class: 'mono' }, w), h('span', null, m))));
  let n = 0; // presses of Next done
  let busy = false;

  const input = () => {
    const name = nameIn.value.trim().split(/\s+/)[0] || 'Mona';
    const m = ticketsIn.value.match(/^\s*\d+/);
    const tickets = m ? Number(m[0]) : 0;
    const total = tickets * 25.75;
    return { name, tickets, total, pay: Math.round(total), bad: !m };
  };

  /** memory and screen after `k` presses */
  const draw = (k: number) => {
    const o = input();
    const box = (type: string, nm: string, v: string) => { const b = memBox(type, nm, v); b.dataset.box = nm; return b; };
    const boxes = [
      k >= 4 ? box('string', 'name', k >= 8 ? `"${o.name}"` : '""') : null,
      k >= 5 ? box('int', 'tickets', k >= 10 ? String(o.tickets) : '?') : null,
      k >= 6 ? box('double', 'price', '25.75') : null,
      k >= 11 ? box('double', 'total', formatG(o.total)) : null,
    ].filter((b) => b !== null) as HTMLElement[];
    mem.replaceChildren(...(boxes.length ? boxes : [h('span', { class: 'cx-fp-empty' }, 'No variables yet.')]));
    let out = '';
    if (k >= 7) out += 'Your name? ';
    if (k >= 8) out += `${o.name}\n`;
    if (k >= 9) out += 'How many tickets? ';
    if (k >= 10) out += `${ticketsIn.value.trim() || '0'}\n`;
    if (k >= 12) out += `${o.name}, you pay ${o.pay}\n`;
    screen.textContent = out || ' ';
    const step = FIRST[k - 1];
    lines.forEach((l, i) => l.classList.toggle('is-on', !!step && step.lines.includes(i)));
    [...words.children].forEach((li, i) => li.classList.toggle('is-met', WORDS[i][2] <= k));
    counter.textContent = `${k} / ${FIRST.length}`;
    if (step) {
      word.textContent = step.word;
      word.hidden = false;
      say.innerHTML = md(step.say + (k === 10 && o.bad ? `\n\n“${ticketsIn.value}” is not a whole number, so \`tickets\` gets **0**.` : ''));
    } else {
      word.hidden = true;
      say.innerHTML = md('Press **Next ▶**. The program runs **one line at a time**. For each line you see what it does, what is saved in memory, and what appears on the screen.');
    }
    next.disabled = k >= FIRST.length;
    back.disabled = k === 0;
  };

  const boxEl = (nm: string) => mem.querySelector(`[data-box="${nm}"]`) as HTMLElement | null;
  const go = async () => {
    if (busy || n >= FIRST.length) return;
    busy = true;
    const o = input();
    const line = lines[FIRST[n].lines[0]];
    const k = n + 1;
    if (k === 11) { // read the two values before the answer is saved
      const t = boxEl('tickets'), p = boxEl('price');
      if (t) await fly(stage, t, line, String(o.tickets), 'is-out');
      if (p) await fly(stage, p, line, '25.75', 'is-out');
    }
    draw(k);
    n = k;
    switch (k) {
      case 4: case 5: { const b = mem.lastElementChild as HTMLElement | null; if (b) setVal(b, b.querySelector('.cx-val')!.textContent ?? '?'); break; }
      case 6: { const b = boxEl('price'); if (b) { await fly(stage, line, b, '25.75'); setVal(b, '25.75'); } break; }
      case 7: case 9: await fly(stage, line, screen, k === 7 ? 'Your name? ' : 'How many tickets? ', 'is-out'); break;
      case 8: { const b = boxEl('name'); if (b) { await fly(stage, nameIn, b, o.name, 'is-in'); setVal(b, `"${o.name}"`); } break; }
      case 10: { const b = boxEl('tickets'); if (b) { await fly(stage, ticketsIn, b, String(o.tickets), 'is-in'); setVal(b, String(o.tickets)); } break; }
      case 11: { const b = boxEl('total'); if (b) { await fly(stage, line, b, formatG(o.total)); setVal(b, formatG(o.total)); } break; }
      case 12: await fly(stage, line, screen, `${o.name}, you pay ${o.pay}`, 'is-out'); break;
      default: break;
    }
    busy = false;
  };
  const next = btn('Next ▶', () => void go(), 'btn-primary');
  const back = btn('◀ Back', () => { if (!busy && n > 0) { n -= 1; draw(n); } });
  const playAll = btn('▶ Play all', async () => {
    if (busy) return;
    if (n >= FIRST.length) { n = 0; draw(0); }
    while (n < FIRST.length) { await go(); await sleep(1600); }
  });
  [nameIn, ticketsIn].forEach((i) => i.addEventListener('input', () => { if (!busy) draw(n); }));

  stage.append(
    h('div', { class: 'cx-fp-head' }, counter, word),
    h('div', { class: 'cx-fp-grid' },
      h('div', { class: 'cx-fp-lines mono' }, ...lines),
      h('div', { class: 'cx-fp-side' },
        h('div', { class: 'cx-fp-typed' }, h('span', { class: 'cx-vis-k mono' }, '⌨ The user will type'),
          h('label', null, h('span', null, 'name'), nameIn), h('label', null, h('span', null, 'tickets'), ticketsIn)),
        h('p', { class: 'cx-vis-k mono' }, 'Memory'), mem,
        h('p', { class: 'cx-vis-k mono' }, '🖥 Screen'), screen)),
    h('div', { class: 'cx-fp-explain' }, say),
    h('div', { class: 'cx-vis-bar' }, back, next, playAll, btn('⟲ Start again', () => { if (!busy) { n = 0; draw(0); } })),
    h('div', { class: 'cx-fp-glossary' }, h('p', { class: 'cx-vis-k mono' }, 'Words in this program'), words));
  host.replaceChildren(stage);
  draw(0);
}
