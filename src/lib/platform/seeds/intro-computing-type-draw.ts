/**
 * Introduction to Computing (26CSCI01P) — Lab 3 "Code and flowcharts: from zero to hero".
 * Part 1 is the class test with its official answers. Then every question comes as a pair: FIRST its flowchart
 * (watch the perfect one run, fill its empty boxes, or draw it), THEN the same program in C++. The flowchart and
 * the program are checked on the same tests. Every flowchart given here is a perfect solution: every variable is
 * declared with its type and given a starting value first, one Start, one End, Yes and No on every decision.
 * Content only from the lecture files: Lectures 1–5, the Lecture 4 & 5 quiz, the class test, Wk6ProgramLogic and
 * Wk8ProgramLogic. C++ uses sequence and selection only (the lectures have no loops); loops appear only in
 * flowcharts (Wk8 programs 5–7). Node ids are stable: progress is stored by them.
 */
import type { Flow } from '../core.ts';
import { buildChart, type FStep } from '../../../lab/flow/build.ts';
import { parseChart } from '../../../lab/flow/chart.ts';
import { parseCppChecks } from '../../../lab/cpp/checks.ts';
import { NO_LOOPS, SKELETON } from './intro-computing-practice.ts';

type N = { id: string; type: string; data: Record<string, string> };

const chain = (nodes: N[]): Flow => ({
  nodes: nodes.map((n, i) => ({ id: n.id, type: n.type, x: 80 + (i % 2) * 40, y: 80 + i * 150, data: n.data })),
  edges: nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id })),
});
const part = (id: string, title: string, time: string): N => ({ id, type: 'part', data: { title, time } });
const task = (id: string, title: string, time: string, body: string): N => ({ id, type: 'task', data: { title, time, body } });
const vis = (id: string, visual: string, caption: string, text = ''): N => ({ id, type: 'cppvisual', data: { visual, text, caption } });
const answer = (id: string, mode: string, question: string, code: string, answers: string[], explain: string, caps = 'Count'): N =>
  ({ id, type: 'cppanswer', data: { question, code, input: '', mode, answers: answers.join('\n'), caps, explain } });
/** type exactly what the code prints (checked against the real output) */
const out = (id: string, question: string, code: string, explain = '') => answer(id, 'What it prints (the output)', question, code, [], explain);
/** type a value (one of the accepted answers) */
const val = (id: string, question: string, code: string, answers: string[], explain = '', caps = 'Count') => answer(id, 'A value', question, code, answers, explain, caps);
/** a whole program wrapped around the lines of main */
export const P = (body: string, includes = ['iostream']) => `${includes.map((i) => `#include <${i}>`).join('\n')}\nusing namespace std;\n\nint main() {\n${body}\n    return 0;\n}\n`;
const prog = (id: string, d: { title: string; goal: string; checks: string[]; starter?: string; hints?: string[] }): N =>
  ({ id, type: 'cpp', data: { title: d.title, goal: d.goal, starter: d.starter ?? SKELETON, input: '', checks: [...d.checks, NO_LOOPS].join('\n'), hints: (d.hints ?? []).join('\n'), paste: 'Blocked' } });
type FcMode = 'Show it running' | 'Read it and type the output' | 'Fill the empty boxes' | 'Draw it yourself';
const fc = (id: string, d: { title: string; goal: string; mode: FcMode; chart: string; input?: string; bank?: string[]; checks?: string[]; solution?: string }): N =>
  ({ id, type: 'flowchart', data: { title: d.title, goal: d.goal, mode: d.mode, chart: d.chart.trim(), input: d.input ?? '', bank: (d.bank ?? []).join('\n'), checks: (d.checks ?? []).join('\n'), solution: d.solution ?? '' } });

/** the empty boxes of a fill-in chart: the texts listed are replaced by ? */
export const blankOut = (chart: string, texts: string[]) => texts.reduce((c, t) => {
  const re = new RegExp(` ${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\n|$)`);
  if (!re.test(c)) throw new Error(`blankOut: “${t}” is not a box text`);
  return c.replace(re, ' ?$1');
}, chart);
/**
 * A flowchart check has no C++ code steps: the same tests as the program, without code / nocode. The lines are read
 * by the C++ check parser (a regex may contain ; or /), then written back with only in / expect / exact / not.
 */
export const flowChecks = (checks: string[]) => {
  const parsed = parseCppChecks(checks.join('\n'));
  if (!parsed.ok) throw new Error(parsed.error);
  const esc = (v: string) => v.replace(/\n/g, '\\n').replace(/\t/g, '\\t');
  return parsed.value.map((c) => {
    const steps = c.steps.flatMap((x) => ('in' in x ? [`in ${esc(x.in)}`] : 'expect' in x ? [`expect ${esc(x.expect)}`] : 'exact' in x ? [`exact ${esc(x.exact)}`] : 'not' in x ? [`not ${esc(x.not)}`] : []));
    return steps.length ? `${c.name} :: ${steps.join('; ')}` : '';
  }).filter(Boolean);
};
/** an empty canvas (Start and End) as tall as the perfect chart */
const canvasFor = (perfect: string) => {
  const c = parseChart(perfect);
  const rows = c.ok ? Math.max(...c.value.nodes.map((n) => Math.round((n.y - 24) / 100))) : 6;
  return `s start 0,0 Start\ne end 0,${Math.max(4, rows)} End`;
};
const sampleInput = (checks: string[]) => (/\bin\s+([^;]*)/.exec(checks[0] ?? '')?.[1] ?? '').trim().replace(/\\n/g, '\n');

/* ------------------------------------------------------------------ one question = its flowchart, then its code */
type Q = { id: string; title: string; goal: string; checks: string[]; perfect: FStep[]; hints?: string[]; starter?: string; blanks?: string[]; distractors?: string[] };
const WATCH = 'This is the **perfect flowchart** of the program: every variable is declared with its type and a starting value first. Press **Run** (or **Step**) and watch the values and the screen. Then type the same program in C++ below.';
const FILL = 'Choose the text of every empty box, then **Check**: your flowchart runs on the same tests as the program. Then type it in C++ below.';
const DRAW = 'Draw the flowchart **first**: declare every variable with its type and a starting value (e.g. `int a = 0, b = 0`), then Input, the calculations and Output. **Check** runs it on the same tests as the program. Then type it in C++ below.';
const CODE = 'Now type it in C++: one line of code for each shape of the flowchart.';

function pair(q: Q, mode: 'watch' | 'fill' | 'draw'): N[] {
  const perfect = buildChart(q.perfect);
  const checks = flowChecks(q.checks);
  const input = sampleInput(q.checks);
  const flow = mode === 'watch'
    ? fc(`${q.id}-flow`, { title: `${q.title}: the flowchart`, goal: `${q.goal}\n\n${WATCH}`, mode: 'Show it running', chart: perfect, input })
    : mode === 'fill'
      ? fc(`${q.id}-flow`, { title: `${q.title}: the flowchart`, goal: `${q.goal}\n\n${FILL}`, mode: 'Fill the empty boxes', chart: blankOut(perfect, q.blanks!), input,
        bank: [...q.blanks!, ...(q.distractors ?? [])].sort((a, b) => a.localeCompare(b)), checks, solution: perfect })
      : fc(`${q.id}-flow`, { title: `${q.title}: the flowchart`, goal: `${q.goal}\n\n${DRAW}`, mode: 'Draw it yourself', chart: canvasFor(perfect), input, checks, solution: perfect });
  return [flow, prog(q.id, { title: `${q.title}: the code`, goal: `${q.goal}\n\n${CODE}`, checks: q.checks, starter: q.starter, hints: q.hints })];
}

/* ------------------------------------------------------------------ the questions */
const median = (prefix: string): FStep => ({ if: 'n1 < n2',
  yes: [{ if: 'n3 > n2', yes: [`Output "${prefix}", n2`], no: [{ if: 'n3 < n1', yes: [`Output "${prefix}", n1`], no: [`Output "${prefix}", n3`] }] }],
  no: [{ if: 'n3 > n1', yes: [`Output "${prefix}", n1`], no: [{ if: 'n3 < n2', yes: [`Output "${prefix}", n2`], no: [`Output "${prefix}", n3`] }] }] });
const firstOf = (i: number): FStep => ({ if: `w1[${i}] < w2[${i}]`, yes: ['Output w1, " comes first"'], no: ['Output w2, " comes first"'] });
const VECTORS: FStep[] = [
  'string v1 = "", v2 = ""; int c1 = 0, c2 = 0, x1 = 0, y1 = 0, x2 = 0, y2 = 0',
  'Input line v1', 'Input line v2',
  "c1 = v1.find(',')", 'x1 = stoi(v1.substr(1, c1 - 1))', "y1 = stoi(v1.substr(c1 + 1, v1.find('>') - c1 - 1))",
  "c2 = v2.find(',')", 'x2 = stoi(v2.substr(1, c2 - 1))', "y2 = stoi(v2.substr(c2 + 1, v2.find('>') - c2 - 1))",
];

const Q = {
  q5: { id: 'ct-q5-code', title: 'Q5 in code: which word comes first?', goal: 'Read two words of **exactly 3 lowercase letters** each. Print `<word> comes first`, or `same word` when they are equal. Compare the first characters; if they are the same, the second; then the third — like the official answer.\n\nExample: `tea tee` prints `tea comes first`.',
    checks: ['Different first letters :: in cat dog; expect cat comes first', 'The other order :: in dog cat; expect cat comes first', 'Same first two letters :: in tea tee; expect tea comes first', 'Last letter decides :: in bat bad; expect bad comes first', 'Same word :: in sun sun; expect same word; not comes first'],
    hints: ['Read the two words with `cin >> w1 >> w2;`.', 'Compare `w1[0]` with `w2[0]`: if they are not equal, the smaller one decides.', 'If `w1[0] == w2[0]`, compare `w1[1]` and `w2[1]`, then `w1[2]` and `w2[2]`.'],
    perfect: ['string w1 = "", w2 = ""', 'Input w1, w2', { if: 'w1 == w2', yes: ['Output "same word"'], no: [{ if: 'w1[0] != w2[0]', yes: [firstOf(0)], no: [{ if: 'w1[1] != w2[1]', yes: [firstOf(1)], no: [firstOf(2)] }] }] }] },
  q6: { id: 'ct-q6-code', title: 'Q6 in code: count the words (at most 5)', goal: 'Read a whole line of comma-separated words (at most 5 words) with `getline`. Print `words: N`. Do it like the official answer: find the first comma, then look for the next comma in the substring after it, and use selection to stop at the last comma.\n\nExample: `today, is, a, good, day` prints `words: 5`.',
    checks: ['Five words :: in today, is, a, good, day; expect words: 5', 'Two words :: in good, day; expect words: 2', 'One word :: in hello; expect words: 1', 'Three words :: in a, b, c; expect words: 3', 'Four words :: in one, two, three, four; expect words: 4', String.raw`Reads a whole line :: code /getline\s*\(\s*cin/ Read the line with getline(cin, line).`],
    hints: ['`int c1 = line.find(\',\');` — if `c1 == string::npos` there is only 1 word.', 'Otherwise cut the rest: `string r1 = line.substr(c1 + 1);` and look for a comma in `r1`.', 'Repeat with if / else: every comma you find adds one word (at most 4 commas).'],
    perfect: ['string text = "", r1 = "", r2 = "", r3 = ""; int c1 = 0, c2 = 0, c3 = 0, words = 1', 'Input line text', "c1 = text.find(',')",
      { if: 'c1 != npos', yes: ['words = 2; r1 = text.substr(c1 + 1)', "c2 = r1.find(',')",
        { if: 'c2 != npos', yes: ['words = 3; r2 = r1.substr(c2 + 1)', "c3 = r2.find(',')",
          { if: 'c3 != npos', yes: ['words = 4; r3 = r2.substr(c3 + 1)', { if: "r3.find(',') != npos", yes: ['words = 5'] }] }] }] },
      'Output "words: ", words'] },
  q7: { id: 'ct-q7', title: 'Q7: sum of the integer and decimal parts', goal: 'Read a decimal number **as a string**. Print `sum of integer and decimal parts: ` and the sum of the two parts as integers.\n\nExample: `1.5` prints `sum of integer and decimal parts: 6`.',
    checks: ['1.5 :: in 1.5; expect sum of integer and decimal parts: 6', '12.34 :: in 12.34; expect sum of integer and decimal parts: 46', '0.5 :: in 0.5; expect sum of integer and decimal parts: 5', '7.25 :: in 7.25; expect sum of integer and decimal parts: 32', String.raw`Uses stoi :: code /stoi\s*\(/ Turn each part into an integer with stoi().`],
    hints: ['Read it into a string: `cin >> instring;`, then `dot_index = instring.find(\'.\');`.', 'The integer part is `instring.substr(0, dot_index)` and the decimal part is `instring.substr(dot_index + 1)`.',
      'Official answer (5 marks): read the number as a string; locate the full stop [2 marks]; the substring left of it with stoi() [1 mark]; the substring right of it with stoi() [1 mark]; print the sum of the two integers [1 mark].'],
    perfect: ['string instring = "", intsubstr = "", decsubstr = ""; int dot_index = 0', 'Input instring', "dot_index = instring.find('.')", 'intsubstr = instring.substr(0, dot_index)', 'decsubstr = instring.substr(dot_index + 1)', 'Output "sum of integer and decimal parts: ", stoi(intsubstr) + stoi(decsubstr)'] },

  hello: { id: 'z-hello', title: 'Three lines', goal: 'Print exactly these three lines:\n\n```\nHello, I am a C++ program\nI was typed by hand\nGoodbye\n```',
    checks: ['Line 1 :: expect Hello, I am a C++ program', 'Line 2 :: expect I was typed by hand', 'Exactly three lines :: exact Hello, I am a C++ program\\nI was typed by hand\\nGoodbye'],
    hints: ['One `cout << "…\\n";` per line.', '`\\n` ends a line.', 'Type the text exactly: capitals and commas count.'],
    perfect: ['Output "Hello, I am a C++ program"', 'Output "I was typed by hand"', 'Output "Goodbye"'] },
  card: { id: 'z-card', title: 'A student card with tabs', goal: 'Print this card. Between each label and its value there is **one tab** (`\\t`):\n\n```\nName:\tMona Adel\nID:\t240001\nModule:\tIntroduction to Computing\n```',
    checks: ['Name line :: expect Name:\\tMona Adel', 'ID line :: expect ID:\\t240001', 'The whole card :: exact Name:\\tMona Adel\\nID:\\t240001\\nModule:\\tIntroduction to Computing'],
    hints: ['`\\t` is a tab, `\\n` a new line.', '`cout << "Name:\\tMona Adel\\n";`', 'Three couts, one per line.'],
    perfect: ['Output "Name:\\tMona Adel"', 'Output "ID:\\t240001"', 'Output "Module:\\tIntroduction to Computing"'] },
  box: { id: 'z-box', title: 'Draw a box with characters', goal: 'Print exactly this box (3 lines):\n\n```\n+-----+\n| C++ |\n+-----+\n```',
    checks: ['The box :: exact +-----+\\n| C++ |\\n+-----+'],
    hints: ['Count the dashes: five.', 'The middle line has a space on each side of C++.', 'Three `cout` lines, each ending with `\\n`.'],
    perfect: ['Output "+-----+"', 'Output "| C++ |"', 'Output "+-----+"'] },

  types: { id: 'v-types', title: 'Four types in one sentence', goal: 'Declare `int age = 19;`, `float height = 1.75;`, `char grade = \'A\';` and `string name = "Mona Adel";`. Then print, using the variables:\n\n```\nMona Adel is 19 years old, 1.75 m tall, grade A\n```',
    checks: ['The sentence :: expect Mona Adel is 19 years old, 1.75 m tall, grade A', String.raw`int age :: code /int\s+age\s*=\s*19/ Declare int age = 19`, String.raw`float height :: code /float\s+height\s*=\s*1\.75/ Declare float height = 1.75`, String.raw`char grade :: code /char\s+grade\s*=\s*'A'/ Declare char grade = 'A' with single quotes`, String.raw`string name :: code /string\s+name\s*=/ Declare string name = "Mona Adel"`],
    hints: ['Declare the four variables first.', '`cout << name << " is " << age << " years old, " …`', 'The spaces and commas between the values are text in quotes.'],
    perfect: ["int age = 19; float height = 1.75; char grade = 'A'; string name = \"Mona Adel\"", 'Output name, " is ", age, " years old, ", height, " m tall, grade ", grade'] },
  steps: { id: 'v-steps', title: 'Follow x step by step (Lecture 3)', goal: 'Start with `int x = 3;`. Do these 8 steps and print `x = ` and the value after **each** one:\n\n`x = x + 2;` then `x += 4;` `x++;` `x--;` `x -= 4;` `x *= 2;` `x /= 2;` `x %= 2;`',
    checks: ['All 8 values :: exact x = 5\\nx = 9\\nx = 10\\nx = 9\\nx = 5\\nx = 10\\nx = 5\\nx = 1', String.raw`Uses the short forms :: code /\+=[\s\S]*\+\+[\s\S]*--[\s\S]*-=[\s\S]*\*=[\s\S]*\/=[\s\S]*%=/ Use the seven short forms of the goal, in that order.`],
    hints: ['After each step: `cout << "x = " << x << "\\n";`', '`x /= 2` with an int keeps only the whole part.', '`x %= 2` keeps the remainder after dividing by 2.'],
    perfect: ['int x = 3', ...['x = x + 2', 'x += 4', 'x++', 'x--', 'x -= 4', 'x *= 2', 'x /= 2', 'x %= 2'].flatMap((s) => [s, 'Output "x = ", x'])],
    blanks: ['x += 4', 'x *= 2', 'x %= 2'], distractors: ['x = 4', 'x = x * x', 'x = x / 2'] },
  circle: { id: 'v-circle', title: 'A constant: the circle', goal: 'Declare `const float pi = 3.14159;`. Read the radius `r` (a decimal number). Print `circumference: ` with `2 * pi * r`, and `area: ` with `pi * r * r`.',
    checks: ['Radius 2 :: in 2; expect circumference: 12.5664; expect area: 12.5664', 'Radius 10 :: in 10; expect circumference: 62.8318; expect area: 314.159', 'Radius 1 :: in 1; expect circumference: 6.28318; expect area: 3.14159', String.raw`const float pi :: code /const\s+float\s+pi\s*=\s*3\.14159/ Declare const float pi = 3.14159`],
    hints: ['`float r; cin >> r;`', '`cout << "circumference: " << 2 * pi * r << "\\n";`', 'The area is `pi * r * r`.'],
    perfect: ['const float pi = 3.14159; float r = 0', 'Input r', 'Output "circumference: ", 2 * pi * r', 'Output "area: ", pi * r * r'],
    blanks: ['Output "circumference: ", 2 * pi * r', 'Output "area: ", pi * r * r'], distractors: ['Output "circumference: ", pi * r * r', 'Output "area: ", 2 * pi * r', 'Output "area: ", pi * r'] },

  three: { id: 'i-three', title: 'Product, sum and difference', goal: 'Read two whole numbers `a` and `b`. Print three lines: `product: `, `sum: ` and `difference: ` (that is `a - b`).',
    checks: ['3 and 5 :: in 3 5; expect product: 15; expect sum: 8; expect difference: -2', '10 and 4 :: in 10 4; expect product: 40; expect sum: 14; expect difference: 6', String.raw`Reads with cin :: code /cin\s*>>/ Read the numbers with cin >>.`],
    hints: ['`int a, b; cin >> a >> b;`', 'Three couts, one per line.', '`a - b` can be negative.'],
    perfect: ['int a = 0, b = 0', 'Input a, b', 'Output "product: ", a * b', 'Output "sum: ", a + b', 'Output "difference: ", a - b'],
    blanks: ['Output "product: ", a * b', 'Output "difference: ", a - b'], distractors: ['Output "product: ", a + b', 'Output "difference: ", b - a'] },
  greet: { id: 'i-greet', title: 'A full name and an age', goal: 'Read a full name with `getline` (it has a space), then an age with `cin`. Print `Hello <name>, next year you will be <age + 1>`.\n\nExample: `Mohamed Salah` and `32` print `Hello Mohamed Salah, next year you will be 33`.',
    checks: ['Mohamed Salah :: in Mohamed Salah\\n32; expect Hello Mohamed Salah, next year you will be 33', 'Mona Adel :: in Mona Adel\\n19; expect Hello Mona Adel, next year you will be 20', String.raw`Uses getline :: code /getline\s*\(\s*cin/ Read the name with getline(cin, name).`],
    hints: ['`string name; getline(cin, name);`', '`int age; cin >> age;`', 'Print `age + 1`.'],
    perfect: ['string name = ""; int age = 0', 'Input line name', 'Input age', 'Output "Hello ", name, ", next year you will be ", age + 1'],
    blanks: ['Input line name', 'Output "Hello ", name, ", next year you will be ", age + 1'], distractors: ['Input name', 'Output "Hello ", name, ", next year you will be ", age'] },
  letter: { id: 'i-letter', title: 'A letter, its code and the next letter', goal: 'Read one lowercase letter `c`. Print three lines:\n\n```\nuppercase: A\nASCII code: 97\nnext letter: b\n```\n(for `a`). Use `(char)(c - 32)`, `(int)c` and `(char)(c + 1)`.',
    checks: ['a :: in a; expect uppercase: A; expect ASCII code: 97; expect next letter: b', 'm :: in m; expect uppercase: M; expect ASCII code: 109; expect next letter: n'],
    hints: ['`char c; cin >> c;`', '`(char)(c - 32)` is the uppercase letter: without `(char)` you would see a number.', '`(int)c` shows the code of the character.'],
    perfect: ["char c = ' '", 'Input c', 'Output "uppercase: ", char(c - 32)', 'Output "ASCII code: ", int(c)', 'Output "next letter: ", char(c + 1)'],
    blanks: ['Output "uppercase: ", char(c - 32)', 'Output "ASCII code: ", int(c)', 'Output "next letter: ", char(c + 1)'], distractors: ['Output "uppercase: ", c - 32', 'Output "ASCII code: ", c', 'Output "next letter: ", c + 1'] },

  time: { id: 'c-time', title: 'Seconds to hours, minutes and seconds (Wk8 2)', goal: 'Read a number of seconds `t` (a whole number). Print it as `h h m min s s`.\n\nExample: `3725` prints `1 h 2 min 5 s`.',
    checks: ['3725 :: in 3725; exact 1 h 2 min 5 s', '59 :: in 59; exact 0 h 0 min 59 s', '86399 :: in 86399; exact 23 h 59 min 59 s', '7200 :: in 7200; exact 2 h 0 min 0 s'],
    hints: ['Hours: `t / 3600`. What is left: `t % 3600`.', 'Minutes: what is left `/ 60`; seconds: what is left `% 60`.', '`cout << h << " h " << m << " min " << s << " s";`'],
    perfect: ['int t = 0, h = 0, m = 0, s = 0', 'Input t', 'h = t / 3600', 't = t % 3600', 'm = t / 60', 's = t % 60', 'Output h, " h ", m, " min ", s, " s"'],
    blanks: ['h = t / 3600', 't = t % 3600', 'm = t / 60', 's = t % 60'], distractors: ['h = t % 3600', 'm = t % 60', 's = t / 60'] },
  temp: { id: 'c-temp', title: 'Celsius to Fahrenheit, and back (Wk8 1)', goal: 'Read a temperature in Celsius `C`, then one in Fahrenheit `F` (decimal numbers). Print `F = ` with `1.8 * C + 32`, then `C = ` with `(F - 32) / 1.8`.',
    checks: ['37 and 212 :: in 37 212; expect F = 98.6; expect C = 100', '0 and 32 :: in 0 32; expect F = 32; expect C = 0', '-40 and -40 :: in -40 -40; expect F = -40; expect C = -40'],
    hints: ['Use `float` for both.', 'F = 1.8 * C + 32 (the Wk8 formula).', 'Going back: C = (F - 32) / 1.8 — the brackets matter.'],
    perfect: ['float C = 0, F = 0', 'Input C, F', 'Output "F = ", 1.8 * C + 32', 'Output "C = ", (F - 32) / 1.8'],
    blanks: ['Output "F = ", 1.8 * C + 32', 'Output "C = ", (F - 32) / 1.8'], distractors: ['Output "F = ", 1.8 * (C + 32)', 'Output "C = ", F - 32 / 1.8'] },
  avg: { id: 'c-avg', title: 'Sum and average of five numbers', goal: 'Read five whole numbers. Print `sum = ` and `average = `. The average must keep its decimal part: `1 2 3 4 6` gives `average = 3.2`.',
    checks: ['1 2 3 4 6 :: in 1 2 3 4 6; expect sum = 16; expect average = 3.2', '2 2 2 2 2 :: in 2 2 2 2 2; expect sum = 10; expect average = 2', '1 2 3 4 5 :: in 1 2 3 4 5; expect sum = 15; expect average = 3'],
    hints: ['`int sum = a + b + c + d + e;`', '`sum / 5` with two ints drops the decimal part.', 'Divide by `5.0` to keep it.'],
    perfect: ['int a = 0, b = 0, c = 0, d = 0, e = 0, sum = 0', 'Input a, b, c, d, e', 'sum = a + b + c + d + e', 'Output "sum = ", sum', 'Output "average = ", sum / 5.0'] },
  hexagon: { id: 'c-hexagon', title: 'The hexagon, rounded three ways (Program 11)', goal: 'Read the side `s` of a hexagon (a decimal number). Its area is `3 * sqrt(3) / 2 * pow(s, 2)`. Print four lines: `area: `, `rounded: ` (round), `down: ` (floor) and `up: ` (ceil).',
    checks: ['Side 2 :: in 2; expect area: 10.3923; expect rounded: 10; expect down: 10; expect up: 11', 'Side 3 :: in 3; expect area: 23.3827; expect rounded: 23; expect down: 23; expect up: 24', 'Side 1 :: in 1; expect area: 2.59808; expect rounded: 3; expect down: 2; expect up: 3', String.raw`Uses sqrt and pow :: code /sqrt\s*\([\s\S]*pow\s*\(|pow\s*\([\s\S]*sqrt\s*\(/ Use sqrt and pow from cmath.`],
    hints: ['`#include <cmath>` for sqrt, pow, round, floor and ceil.', 'Keep the area in a `float` variable.', '`cout << "rounded: " << round(area) << "\\n";`'],
    perfect: ['float s = 0, area = 0', 'Input s', 'area = 3 * sqrt(3) / 2 * pow(s, 2)', 'Output "area: ", area', 'Output "rounded: ", round(area)', 'Output "down: ", floor(area)', 'Output "up: ", ceil(area)'] },
  maxmin: { id: 'c-maxmin', title: 'Greatest and smallest with max and min only', goal: 'Read three whole numbers. Print `greatest: ` and `smallest: `. Use only `max` and `min` (no `if`): a max inside a max.',
    checks: ['4 9 2 :: in 4 9 2; expect greatest: 9; expect smallest: 2', '7 7 1 :: in 7 7 1; expect greatest: 7; expect smallest: 1', 'Negatives :: in -3 -8 -1; expect greatest: -1; expect smallest: -8', String.raw`No if :: nocode /\bif\s*\(/ Use max and min only.`, String.raw`Uses max and min :: code /max\s*\(\s*max\s*\(|max\s*\([^;]*max\s*\(/ Put a max inside a max.`],
    hints: ['`#include <algorithm>`', '`max(a, b)` gives the bigger of two.', '`max(max(a, b), c)` gives the biggest of three.'],
    perfect: ['int a = 0, b = 0, c = 0', 'Input a, b, c', 'Output "greatest: ", max(max(a, b), c)', 'Output "smallest: ", min(min(a, b), c)'] },
  modulus: { id: 'c-modulus', title: 'The modulus of a vector (Program 22)', goal: 'Read `x` and `y` (decimal numbers). Print `modulus: ` and `sqrt(x * x + y * y)`.',
    checks: ['3 and 4 :: in 3 4; expect modulus: 5', '1 and 1 :: in 1 1; expect modulus: 1.41421', '6 and 8 :: in 6 8; expect modulus: 10'],
    hints: ['`#include <cmath>`', '`float x, y; cin >> x >> y;`', '`sqrt(pow(x, 2) + pow(y, 2))` works too.'],
    perfect: ['float x = 0, y = 0', 'Input x, y', 'Output "modulus: ", sqrt(x * x + y * y)'] },

  divide: { id: 'e-divide', title: 'Divide, or say unknown (Wk8 4)', goal: 'Read two decimal numbers `a` and `b`. If `b` is 0, print `unknown`. Otherwise print `result: ` and `a / b`.',
    checks: ['7 / 2 :: in 7 2; expect result: 3.5', '7 / 0 :: in 7 0; expect unknown; not result', '-9 / 3 :: in -9 3; expect result: -3'],
    hints: ['`float a, b; cin >> a >> b;`', '`if (b == 0) { … } else { … }`', '`==` compares; `=` gives a value.'],
    perfect: ['float a = 0, b = 0', 'Input a, b', { if: 'b == 0', yes: ['Output "unknown"'], no: ['Output "result: ", a / b'] }] },
  z: { id: 'e-z', title: 'z = x / y, with the rules (Wk8 8)', goal: "Read `x` and `y` (decimal numbers). `x` can't be negative and `y` can't be zero. Print `x can't be negative` and/or `y can't be zero` for each broken rule (both if both are broken). If no rule is broken, print `z = ` and `x / y`.",
    checks: ['8 and 2 :: in 8 2; expect z = 4', "x is negative :: in -8 2; expect x can't be negative; not z =", "y is zero :: in 8 0; expect y can't be zero; not z =", "Both rules :: in -8 0; expect x can't be negative; expect y can't be zero; not z ="],
    hints: ['Test each rule with its own `if`.', 'Print `z` only when `x >= 0 and y != 0`.', '`and` (or `&&`) needs both sides to be true.'],
    perfect: ['float x = 0, y = 0', 'Input x, y', { if: 'x < 0', yes: ['Output "x can\'t be negative"'] }, { if: 'y == 0', yes: ['Output "y can\'t be zero"'] }, { if: 'x >= 0 and y != 0', yes: ['Output "z = ", x / y'] }] },
  greatest: { id: 'e-greatest', title: 'The greatest of three, with if only (Wk8 3)', goal: 'Read three whole numbers. Print `greatest: ` and the greatest. Use `if` / `else` (no max). Numbers can be equal.',
    checks: ['1 2 3 :: in 1 2 3; expect greatest: 3', '3 2 1 :: in 3 2 1; expect greatest: 3', '4 2 9 :: in 4 2 9; expect greatest: 9', '2 3 1 :: in 2 3 1; expect greatest: 3', '5 5 2 :: in 5 5 2; expect greatest: 5', '2 5 5 :: in 2 5 5; expect greatest: 5', '7 7 7 :: in 7 7 7; expect greatest: 7', String.raw`No max :: nocode /\bmax\s*\(/ Use if / else this time.`],
    hints: ['`if (a >= b and a >= c)` — a is the greatest.', '`else if (b >= c)` — b is.', '`else` — c is.'],
    perfect: ['int a = 0, b = 0, c = 0', 'Input a, b, c', { if: 'a >= b and a >= c', yes: ['Output "greatest: ", a'], no: [{ if: 'b >= c', yes: ['Output "greatest: ", b'], no: ['Output "greatest: ", c'] }] }] },
  kase: { id: 'e-case', title: 'Upper, lower, digit or other (Lecture 4)', goal: 'Read one character. If it is a lowercase letter, print `uppercase: ` and the uppercase letter. If it is an uppercase letter, print `lowercase: ` and the lowercase letter. If it is a digit, print `a digit`. Otherwise print `not a letter or digit`.',
    checks: ['a :: in a; expect uppercase: A', 'Q :: in Q; expect lowercase: q', '7 :: in 7; expect a digit', '? :: in ?; expect not a letter or digit'],
    hints: ["Lowercase: `c >= 'a' and c <= 'z'`.", "Uppercase to lowercase: `(char)(c + 32)`.", "A digit: `c >= '0' and c <= '9'`."],
    perfect: ["char c = ' '", 'Input c', { if: "c >= 'a' and c <= 'z'", yes: ['Output "uppercase: ", char(c - 32)'], no: [{ if: "c >= 'A' and c <= 'Z'", yes: ['Output "lowercase: ", char(c + 32)'], no: [{ if: "c >= '0' and c <= '9'", yes: ['Output "a digit"'], no: ['Output "not a letter or digit"'] }] }] }] },
  score: { id: 'e-score', title: 'Home win, away win or draw (Program 17)', goal: 'Read a football score as one word, like `2-1` (home goals, a dash, away goals). Print `home win`, `away win` or `draw`.',
    checks: ['2-1 :: in 2-1; expect home win', '0-0 :: in 0-0; expect draw', '1-3 :: in 1-3; expect away win', '10-2 :: in 10-2; expect home win', String.raw`Uses stoi :: code /stoi\s*\(/ Turn each side into a number with stoi.`],
    hints: ["`int d = s.find('-');`", '`int home = stoi(s.substr(0, d));` and `int away = stoi(s.substr(d + 1));`', 'Then compare home and away.'],
    perfect: ['string s = ""; int d = 0, home = 0, away = 0', 'Input s', "d = s.find('-')", 'home = stoi(s.substr(0, d))', 'away = stoi(s.substr(d + 1))', { if: 'home > away', yes: ['Output "home win"'], no: [{ if: 'home < away', yes: ['Output "away win"'], no: ['Output "draw"'] }] }] },
  sentence: { id: 'e-sentence', title: 'Question or statement? (Program 18)', goal: 'Read a whole line. If its last character is `?` print `interrogative`; if it is `.` print `declarative`; otherwise print `no end mark`.',
    checks: ['A question :: in Is it raining?; expect interrogative', 'A statement :: in It is raining.; expect declarative', 'No mark :: in Hello; expect no end mark'],
    hints: ['`getline(cin, line);`', 'The last character is `line[line.length() - 1]`.', "Compare it with `'?'` and `'.'`."],
    perfect: ["string text = \"\"; char last = ' '", 'Input line text', 'last = text[text.length() - 1]', { if: "last == '?'", yes: ['Output "interrogative"'], no: [{ if: "last == '.'", yes: ['Output "declarative"'], no: ['Output "no end mark"'] }] }] },

  dash: { id: 's-dash', title: 'A negative number or a dash? (Program 15)', goal: 'Read a whole line. If it has no `-`, print `no dash`. If the character after the first `-` is a digit, print `negative number`. Otherwise print `dash`.',
    checks: ['A negative number :: in it is -5 degrees; expect negative number', 'A dash :: in a well-known name; expect dash; not negative', 'No dash :: in no dash here; expect no dash', 'A dash at the end :: in the end -; expect dash; not negative'],
    hints: ["`int p = line.find('-');` then `if (p == string::npos)`.", 'Check `p + 1 < line.length()` before you look at `line[p + 1]`.', "A digit: `line[p + 1] >= '0' and line[p + 1] <= '9'`."],
    perfect: ['string text = ""; int p = 0', 'Input line text', "p = text.find('-')", { if: 'p == npos', yes: ['Output "no dash"'], no: [{ if: "p + 1 < text.length() and text[p + 1] >= '0' and text[p + 1] <= '9'", yes: ['Output "negative number"'], no: ['Output "dash"'] }] }] },
  decimal: { id: 's-decimal', title: 'A decimal number in a line? (Program 16)', goal: 'Read a whole line. Print `decimal number` if the first `.` has a digit just before it and a digit just after it. Otherwise print `no decimal number`.',
    checks: ['3.75 :: in it costs 3.75 pounds; expect decimal number; not no decimal', 'A full stop :: in The end.; expect no decimal number', 'Nothing before :: in version .5; expect no decimal number', 'Nothing after :: in 7.; expect no decimal number', 'pi :: in pi is 3.14; expect decimal number; not no decimal'],
    hints: ["`int p = line.find('.');`", 'Check `p > 0` and `p + 1 < line.length()` first.', "Then test `line[p - 1]` and `line[p + 1]` with `>= '0'` and `<= '9'`."],
    perfect: ["string text = \"\"; int p = 0; char before = ' ', after = ' '", 'Input line text', "p = text.find('.')",
      { if: 'p != npos and p > 0 and p + 1 < text.length()', yes: ['before = text[p - 1]; after = text[p + 1]',
        { if: "before >= '0' and before <= '9' and after >= '0' and after <= '9'", yes: ['Output "decimal number"'], no: ['Output "no decimal number"'] }], no: ['Output "no decimal number"'] }] },
  words: { id: 's-words', title: 'One, two, or three or more words (Programs 19 and 20)', goal: 'Read a whole line (words separated by one space). Print `one word`, `two words` or `three or more words`.',
    checks: ['One :: in hello; expect one word', 'Two :: in good day; expect two words', 'Five :: in today is a good day; expect three or more words', 'Three :: in I am here; expect three or more words'],
    hints: ["`int p = line.find(' ');` — npos means one word.", "Look for a space in the rest: `line.substr(p + 1).find(' ')`.", 'npos there means two words; anything else, three or more.'],
    perfect: ['string text = "", rest = ""; int p = 0', 'Input line text', "p = text.find(' ')", { if: 'p == npos', yes: ['Output "one word"'], no: ['rest = text.substr(p + 1)', { if: "rest.find(' ') == npos", yes: ['Output "two words"'], no: ['Output "three or more words"'] }] }] },
  name: { id: 's-name', title: "A footballer's first and second name (Lecture 4)", goal: 'Read a full name with getline. Print `first name: ` and `second name: `. If there is no space (like `Pele`), print `only one name: ` and the name.',
    checks: ['Mohamed Salah :: in Mohamed Salah; expect first name: Mohamed; expect second name: Salah', 'Pele :: in Pele; expect only one name: Pele; not first name', 'Mo Salah :: in Mo Salah; expect first name: Mo; expect second name: Salah'],
    hints: ["`int sp_index = line.find(' ');`", 'No space: `sp_index == string::npos`.', '`line.substr(0, sp_index)` and `line.substr(sp_index + 1)`.'],
    perfect: ['string text = ""; int sp_index = 0', 'Input line text', "sp_index = text.find(' ')", { if: 'sp_index == npos', yes: ['Output "only one name: ", text'], no: ['Output "first name: ", text.substr(0, sp_index)', 'Output "second name: ", text.substr(sp_index + 1)'] }] },
  email: { id: 's-email', title: 'A well-formed email address (Lecture 4)', goal: 'Read a string. Print `email address: yes` if it has an `@` with something before and after it, the part after the `@` has a `.`, and there is something before and after that dot. Otherwise print `email address: no`.',
    checks: ['The lecture example :: in Gerard.mckee@bue.edu.eg; expect email address: yes', 'A web site :: in www.bue.edu.eg; expect email address: no', 'Only @ :: in @; expect email address: no', 'Nothing after @ :: in gerard@; expect email address: no', 'Only a dot :: in gerard@.; expect email address: no', 'No dot :: in gerard@somewhere; expect email address: no', 'Short and right :: in a@b.c; expect email address: yes', 'No dot again :: in grd@xyzabc; expect email address: no'],
    hints: ["`int at = s.find('@');` — npos means no.", 'before = `s.substr(0, at)`, after = `s.substr(at + 1)`; both need a length > 0.', "In `after`: find the `.`, then check the parts before and after it."],
    perfect: ['string s = "", before = "", after = ""; int at = 0, dot = 0, ok = 0', 'Input s', "at = s.find('@')",
      { if: 'at != npos', yes: ['before = s.substr(0, at); after = s.substr(at + 1)', "dot = after.find('.')",
        { if: 'before.length() > 0 and dot != npos and dot > 0 and dot + 1 < after.length()', yes: ['ok = 1'] }] },
      { if: 'ok == 1', yes: ['Output "email address: yes"'], no: ['Output "email address: no"'] }] },
  tld: { id: 's-tld', title: 'The top-level domain (Lecture 4 challenge)', goal: 'Read an email address whose domain (after `@`) has **one or two** dots. Print `TLD: ` and the part after its last dot.\n\nExample: `gerard.mckee@bue.edu.eg` prints `TLD: eg`.',
    checks: ['bue.edu.eg :: in gerard.mckee@bue.edu.eg; expect TLD: eg', 'gmail.com :: in x@gmail.com; expect TLD: com', 'b.c :: in a@b.c; expect TLD: c'],
    hints: ["Take the domain first: `s.substr(s.find('@') + 1)` (the name can have dots too).", "`rest = domain.substr(domain.find('.') + 1);`", "If `rest` still has a `.`, take the part after it; otherwise `rest` is the TLD."],
    perfect: ['string s = "", domain = "", rest = ""; int d2 = 0', 'Input s', "domain = s.substr(s.find('@') + 1)", "rest = domain.substr(domain.find('.') + 1)", "d2 = rest.find('.')", { if: 'd2 == npos', yes: ['Output "TLD: ", rest'], no: ['Output "TLD: ", rest.substr(d2 + 1)'] }] },

  hmedian: { id: 'h-median', title: 'The median of three — any numbers (Lectures 2 and 3)', goal: 'Read three whole numbers. Print `median is: ` and the median. Use the second program of Lecture 2 (if `num1 < num2` … else …). It must also be right when numbers are equal (Lecture 3: what if the user enters 2 2 2 or 2 2 5?).',
    checks: ['1 2 3 :: in 1 2 3; expect median is: 2', '1 3 2 :: in 1 3 2; expect median is: 2', '2 1 3 :: in 2 1 3; expect median is: 2', '2 3 1 :: in 2 3 1; expect median is: 2', '3 1 2 :: in 3 1 2; expect median is: 2', '3 2 1 :: in 3 2 1; expect median is: 2', '2 2 2 :: in 2 2 2; expect median is: 2', '2 2 5 :: in 2 2 5; expect median is: 2', '5 2 2 :: in 5 2 2; expect median is: 2', '2 5 5 :: in 2 5 5; expect median is: 5'],
    hints: ['`if (num1 < num2)`: `if (num3 > num2)` median num2, `else if (num3 < num1)` num1, `else` num3.', 'In the `else` part: `if (num3 > num1)` num1, `else if (num3 < num2)` num2, `else` num3.', 'Try 2 2 5 on paper: which branch runs?'],
    perfect: ['int n1 = 0, n2 = 0, n3 = 0', 'Input n1, n2, n3', median('median is: ')] },
  stats: { id: 'h-stats', title: 'Average, standard deviation and median (Program 8)', goal: 'Read three whole numbers. Print three lines: `average: `, `standard deviation: ` and `median: `. The standard deviation is the square root of the average of the squared differences from the average: `sqrt((pow(a - avg, 2) + pow(b - avg, 2) + pow(c - avg, 2)) / 3)`.',
    checks: ['2 4 9 :: in 2 4 9; expect average: 5; expect standard deviation: 2.94392; expect median: 4', '1 1 1 :: in 1 1 1; expect average: 1; expect standard deviation: 0; expect median: 1', '3 1 2 :: in 3 1 2; expect average: 2; expect standard deviation: 0.816497; expect median: 2'],
    hints: ['`float avg = (a + b + c) / 3.0;`', 'Use the formula in the goal with sqrt and pow.', 'Reuse your median program for the last line.'],
    perfect: ['int n1 = 0, n2 = 0, n3 = 0; float avg = 0, sd = 0', 'Input n1, n2, n3', 'avg = (n1 + n2 + n3) / 3.0', 'sd = sqrt((pow(n1 - avg, 2) + pow(n2 - avg, 2) + pow(n3 - avg, 2)) / 3)', 'Output "average: ", avg', 'Output "standard deviation: ", sd', median('median: ')] },
  vector: { id: 'h-vector', title: 'Is it a vector <x, y>? (Program 21)', goal: 'Read a whole line. Print `correct format` if it is like `<x, y>`: a `<`, then a `>`, a `,` between them, and something on both sides of the comma. Otherwise print `wrong format`.',
    checks: ['<2, 3> :: in <2, 3>; expect correct format', '<-2,-3> :: in <-2,-3>; expect correct format', 'No < :: in 2, 3>; expect wrong format', 'No comma :: in <2 3>; expect wrong format', 'Nothing before , :: in <,3>; expect wrong format', 'Nothing after , :: in <2,>; expect wrong format', 'No > :: in <2,3; expect wrong format'],
    hints: ["`if (line.find('<') != string::npos)` — then look for '>'.", "Take the part between them, then find the ','.", 'Both parts around the comma must have a length > 0.'],
    perfect: ['string text = "", inside = ""; int lt = 0, gt = 0, c = 0, ok = 0', 'Input line text', "lt = text.find('<'); gt = text.find('>')",
      { if: 'lt != npos and gt != npos and gt > lt', yes: ['inside = text.substr(lt + 1, gt - lt - 1)', "c = inside.find(',')", { if: 'c != npos and c > 0 and c + 1 < inside.length()', yes: ['ok = 1'] }] },
      { if: 'ok == 1', yes: ['Output "correct format"'], no: ['Output "wrong format"'] }] },
  vsum: { id: 'h-vsum', title: 'The sum of two vectors (Program 23)', goal: 'Read two vectors, one per line, like `<1, 2>`. Print their sum in the same format: `<4, -2>`.',
    checks: ['<1, 2> + <3, -4> :: in <1, 2>\\n<3, -4>; expect <4, -2>', '<0, 0> + <5, 7> :: in <0, 0>\\n<5, 7>; expect <5, 7>', String.raw`Uses stoi :: code /stoi\s*\(/ Turn the parts into numbers with stoi.`],
    hints: ["For each line: `int c = v.find(',');`", "x = `stoi(v.substr(1, c - 1))`, y = `stoi(v.substr(c + 1, v.find('>') - c - 1))`.", 'Print `"<" << x1 + x2 << ", " << y1 + y2 << ">"`.'],
    perfect: [...VECTORS, 'Output "<", x1 + x2, ", ", y1 + y2, ">"'] },
  dot: { id: 'h-dot', title: 'Dot product and orthogonal (Programs 24 and 29)', goal: 'Read two vectors, one per line. Print `dot product: ` and `x1 * x2 + y1 * y2`, then `orthogonal: yes` if it is 0, otherwise `orthogonal: no`.',
    checks: ['Orthogonal :: in <1, 2>\\n<2, -1>; expect dot product: 0; expect orthogonal: yes', 'Not orthogonal :: in <1, 2>\\n<3, 4>; expect dot product: 11; expect orthogonal: no'],
    hints: ['Read both vectors like the last program.', '`int dot = x1 * x2 + y1 * y2;`', '`if (dot == 0)` …'],
    perfect: [...VECTORS, 'int dot = x1 * x2 + y1 * y2', 'Output "dot product: ", dot', { if: 'dot == 0', yes: ['Output "orthogonal: yes"'], no: ['Output "orthogonal: no"'] }] },
} satisfies Record<string, Q>;
export const QUESTIONS: Q[] = Object.values(Q);

/* ------------------------------------------------------------------ flowcharts to watch, read, and the loops */
export const CHARTS = {
  product: buildChart(['int num1 = 0, num2 = 0, product = 0', 'Output "Hello, I calculate the product of two numbers"', 'Input num1, num2', 'product = num1 * num2', 'Output "the product is: ", product', 'Output "Goodbye"']),
  divide: buildChart(Q.divide.perfect),
  count: buildChart(['int n = 1', { while: 'n <= 5', body: ['Output n', 'n = n + 1'] }]),
  ctof: buildChart(['float C = 0, F = 0', 'Input C', 'F = 1.8 * C + 32', 'Output F']),
  seconds: buildChart(Q.time.perfect),
  greatest: buildChart(Q.greatest.perfect),
  sum: buildChart(['int n = 0, total = 0, k = 1', 'Input n', { while: 'k <= n', body: ['total = total + k', 'k = k + 1'] }, 'Output "sum = ", total']),
  fives: buildChart(['int n = 1', { while: 'n <= 99', body: [{ if: 'n mod 5 = 0', yes: ['Output n'] }, 'n = n + 1'] }]),
  fifty: buildChart(['int k = 1, x = 0, total = 0', { while: 'k <= 50', body: ['Input x', 'total = total + x', 'k = k + 1'] }, 'Output "sum: ", total', 'Output "average: ", total / 50.0']),
  prime: buildChart(['int n = 0, d = 2, prime = 1', 'Input n', { if: 'n < 2', yes: ['prime = 0'] }, { while: 'd < n', body: [{ if: 'n mod d = 0', yes: ['prime = 0'] }, 'd = d + 1'] }, { if: 'prime == 1', yes: ['Output "prime"'], no: ['Output "not prime"'] }]),
};

const FIVES_LIST = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95].join('\\n');
const FIFTY = Array.from({ length: 50 }, (_, i) => i + 1).join(' ');
const TWOS = Array.from({ length: 50 }, () => 2).join(' ');
export const LOOP_CHECKS = {
  fives: [`1 to 99 :: exact ${FIVES_LIST}`, 'Uses a loop :: uses loop'],
  fifty: ['1 to 50 :: in ' + FIFTY + '; expect sum: 1275; expect average: 25.5', 'Fifty 2s :: in ' + TWOS + '; expect sum: 100; expect average: 2', 'Uses a loop :: uses loop'],
  prime: ['7 is prime :: in 7; exact prime', '9 is not prime :: in 9; exact not prime', '2 is prime :: in 2; exact prime', '15 is not prime :: in 15; exact not prime', '1 is not prime :: in 1; exact not prime', 'Uses a loop :: uses loop'],
};

export function introComputingTypeDrawLab(): Flow {
  return chain([
    { id: 'root', type: 'start', data: {
      title: 'Code and flowcharts: from zero to hero',
      description: 'The class test with its official answers, then every question as a pair: first its flowchart, then the same program in C++, from your first line to hard programs. Every flowchart shown is a perfect solution. Type every program yourself; every program and every flowchart is checked by running it.',
      difficulty: 'Beginner',
      estimatedTime: '11 h',
      objectives: [
        'Check your class test answers question by question, with the official marks',
        'Plan every program as a perfect flowchart first: declare and initialize every variable',
        'Turn each flowchart into C++, from your first cout to hard string programs',
        'Use int, float, char, string and const, cin and getline',
        'Calculate with operators, cmath and algorithm, and choose with if / else',
        'Work with strings: length, [ ], find, npos, substr, stoi',
        'Draw loops in flowcharts (Wk8 programs 5 to 7)',
      ].join('\n'),
      access: 'Open any time (no session, still tracked)',
    } },

    /* ======================================================== 1. the class test, with the official answers */
    part('p1', 'Class test answers', '1 h'),
    task('t1-0', 'How to use this part', '2 min',
      'These are the 7 questions of the class test. For each one, **answer it first**. Then read the official answer and its marks: it opens after a right answer, or in the last hint of a program. Q5, Q6 and Q7 come with their perfect flowchart first, then the program.'),
    vis('ct-vis-inc', 'x++ or ++x?', 'Q1 and Q4 use `x++`, `++x`, `x--` and the short forms like `+=`. Step through this first.'),
    task('t1-1', 'Q1 · x++ and ++x', '4 min', '**Q1** What is the value of `y` in each case? *[2 marks, 1 mark each]*'),
    val('ct-q1a', 'Q1 (i) What is the value of `y`?', 'int x=5; int y;\ny = x++ + 5;', ['10'], '**Official answer: 10** (1 mark). `x++` gives the old value of `x` (5) to the sum; only after that does `x` become 6. So `y = 5 + 5 = 10`.'),
    val('ct-q1b', 'Q1 (ii) What is the value of `y`?', 'int x=5; int y;\ny = ++x + 5;', ['11'], '**Official answer: 11** (1 mark). `++x` adds 1 first (`x` becomes 6), then the sum uses 6. So `y = 6 + 5 = 11`.'),
    task('t1-2', 'Q2 · What is wrong?', '10 min', '**Q2** What is wrong with each of these lines? *[2 marks, ½ mark each]* Fix each program so it compiles and runs. The official answer is the last hint.'),
    prog('ct-q2a', { title: 'Q2 (i) char b="a";', goal: 'This program does not compile. Fix the first line so it prints `a`.', starter: P('    char b="a";\n    cout << b << "\\n";'),
      checks: ['Prints a :: expect a', String.raw`Fixed the declaration :: code /char\s+b\s*=\s*'a'|string\s+b\s*=\s*"a"/ Write the character in single quotes ('a'), or make b a string.`],
      hints: ['A char holds one character.', 'A character is written in single quotes; double quotes make a string.', "Official answer (½ mark): the a should be in single quotes ('a'), or char should be string."] }),
    prog('ct-q2b', { title: 'Q2 (ii) cout >> "enter a number: \\n";', goal: 'This program does not compile. Fix it so it prints `enter a number:`.', starter: P('    cout >> "enter a number: \\n";'),
      checks: ['Prints the line :: expect enter a number:', String.raw`Uses << :: code /cout\s*<</ Send text to cout with <<.`],
      hints: ['`cout` is the screen: text goes into it.', '`<<` sends to cout; `>>` reads from cin.', 'Official answer (½ mark): the operator should be <<, not >>.'] }),
    prog('ct-q2c', { title: 'Q2 (iii) const pi = 3.14159;', goal: 'This program does not compile. Fix it so it prints `3.14159`.', starter: P('    const pi = 3.14159;\n    cout << pi << "\\n";'),
      checks: ['Prints pi :: expect 3.14159', String.raw`Gives pi a type :: code /const\s+(float|double)\s+pi/ A constant still needs a type: const float pi = 3.14159`],
      hints: ['Every variable needs a data type, even a constant.', 'Which type holds a decimal number?', "Official answer (½ mark): the type is not defined, it should be 'float': const float pi = 3.14159;"] }),
    prog('ct-q2d', { title: 'Q2 (iv) z = min(max(x,y));', goal: 'This program does not compile. Give `min` what it needs, so the program runs and prints `z`.', starter: P('    int x=1, y=2, z;\n    z = min(max(x,y));\n    cout << z << "\\n";', ['iostream', 'algorithm']),
      checks: [String.raw`Gives min a second value :: code /min\s*\(\s*max\s*\(\s*x\s*,\s*y\s*\)\s*,\s*[^)\s]/ min needs two values, like max: min(u, v).`],
      hints: ['`max(x, y)` takes two values and gives back one.', '`min` also needs two values.', 'Official answer (½ mark): min needs a second argument, i.e. min(u, v).'] }),
    vis('ct-vis-str', 'String explorer', 'Q3 uses this string. Click the characters: each one has an index, and the first is 0.', 'myname@BUE.EDU.EG'),
    task('t1-3', 'Q3 · String operations', '6 min', '**Q3** Given `string mystring = "myname@BUE.EDU.EG";` what does each statement return? *[2 marks, ½ mark each]*'),
    out('ct-q3a', 'Q3 (i) `len = mystring.length();` What does it print?', 'string mystring = "myname@BUE.EDU.EG";\nint len = mystring.length();\ncout << len;', '**Official answer: 17** (½ mark). The string has 17 characters.'),
    out('ct-q3b', 'Q3 (ii) `dot = mystring.find(\'.\');` What does it print?', 'string mystring = "myname@BUE.EDU.EG";\nint dot = mystring.find(\'.\');\ncout << dot;', '**Official answer: 10** (½ mark). The first `.` is at index 10 (counting from 0).'),
    out('ct-q3c', 'Q3 (iii) `sub1 = mystring.substr(dot+1,3);` What does it print?', 'string mystring = "myname@BUE.EDU.EG";\nint dot = mystring.find(\'.\');\nstring sub1 = mystring.substr(dot+1,3);\ncout << sub1;', '**Official answer: EDU** (½ mark). Start at index 11 and take 3 characters.'),
    out('ct-q3d', 'Q3 (iv) `sub2 = mystring.substr(dot+1);` What does it print?', 'string mystring = "myname@BUE.EDU.EG";\nint dot = mystring.find(\'.\');\nstring sub2 = mystring.substr(dot+1);\ncout << sub2;', '**Official answer: EDU.EG** (½ mark). With no length, substr takes everything to the end.'),
    task('t1-4', 'Q4 · A sequence of operations', '6 min', '**Q4** What are the values of `x` and `y` at the end? *[3 marks: 2 marks for x, 1 mark for y]*'),
    out('ct-q4x', 'Q4 What is `x` at the end?', 'int x=3;int y=1;\nx--;y++;\nx=pow(x,y);\nx=min(x,y);\nx++; y++;\nx+=y;\nx%=y;\ncout << x;', '**Official answer: x = 0** (2 marks). x: 3 → 2 → pow(2,2) = 4 → min(4,2) = 2 → 3 → 3+3 = 6 → 6 % 3 = 0.'),
    out('ct-q4y', 'Q4 What is `y` at the end?', 'int x=3;int y=1;\nx--;y++;\nx=pow(x,y);\nx=min(x,y);\nx++; y++;\nx+=y;\nx%=y;\ncout << y;', '**Official answer: y = 3** (1 mark). y: 1 → 2 → 3.'),
    task('t1-5', 'Q5 · Dictionary order', '10 min', '**Q5** If a user enters two words, explain in logical terms how to find which word comes first in a dictionary. For example, “coffee” comes before “tea”. *[2 marks]*'),
    val('ct-q5', 'Q5 Which word comes first in a dictionary: **tea** or **coffee**?', '', ['coffee'],
      '**Official answer** (2 marks): compare the ASCII code of the first character of each word to see which is greater (or lesser) *[1 mark]*. If the first characters are the same, compare the second character, and so on, until a character is different (assuming both words are the same length) *[1 mark]*.', 'Do not count'),
    vis('ct-vis-ascii', 'Characters are numbers (ASCII)', 'Q5 compares characters: `c` is 99 and `t` is 116, so “coffee” comes first.'),
    ...pair(Q.q5, 'watch'),
    task('t1-6', 'Q6 · Counting comma-separated words', '12 min', '**Q6** Explain in logical terms how to find the number of words in a string of comma-separated words, if at most 5 words are allowed. For example, “today, is, a, good, day” has 5 words and “good, day” has 2. *[4 marks]*'),
    val('ct-q6a', 'Q6 How many **commas** are in `today, is, a, good, day`?', '', ['4', 'four'], 'Count them: after today, is, a and good.', 'Do not count'),
    val('ct-q6b', 'Q6 So how many **words** are there?', '', ['5', 'five'],
      '**Official answer** (4 marks): count the number of commas by finding the first comma in the string *[1 mark]*, and then successively in the substrings that follow each comma found before *[1 mark]*. Then add 1 to the result to give the number of words *[1 mark]*. Use selection to decide if you have reached the last comma *[1 mark]*.', 'Do not count'),
    vis('ct-vis-getline', 'cin >> vs getline', 'A line with spaces needs `getline(cin, line)`: `cin >>` stops at the first space.'),
    ...pair(Q.q6, 'watch'),
    task('t1-7', 'Q7 · Integer part + decimal part', '12 min', '**Q7** Write a program that prints the integer sum of the integer and decimal parts of a decimal number entered by the user. For example, if the user enters 1.5 the program returns 6. Hint: read the decimal number into a string. *[5 marks]*'),
    ...pair(Q.q7, 'watch'),
    task('t1-8', 'Q7 · The official sample code', '3 min',
      'Read this after you solve Q7. It is the sample code from the class test answers:\n\n```cpp\n// sum integer and decimal parts of a decimal number\n#include <iostream>\nusing namespace std;\n\nint main() {\n    string instring;\n    int dot_index;\n    string intsubstr;\n    string decsubstr;\n\n    cout << "enter a decimal number: ";\n    cin >> instring;\n\n    dot_index = instring.find(\'.\');\n\n    intsubstr = instring.substr(0,dot_index);\n    decsubstr = instring.substr(dot_index+1);\n\n    cout << "you entered: "; cout << intsubstr; cout << "\\n";\n    cout << "you entered: "; cout << decsubstr; cout << "\\n";\n\n    cout << "sum of integer and decimal parts: "; cout << stoi(intsubstr) + stoi(decsubstr);\n\n    return 0;\n}\n```'),

    /* ======================================================== 2. flowcharts: the shapes and the perfect flowchart */
    part('p9', 'Flowcharts: the shapes, and the perfect flowchart', '40 min'),
    task('t9-1', 'The shapes', '5 min', [
      'A flowchart is a program drawn as shapes joined by arrows. Follow the arrows from **Start** to **End**.',
      '',
      '- **Oval** — Start and End.',
      '- **Parallelogram** — Input (what the user types) or Output (what appears on the screen). Write `Input a, b` (like `cin >>`), `Input line name` (like `getline`), or `Output "Sum = ", total`.',
      '- **Rectangle** — declarations and calculations: `int total = 0`, `total = a + b`.',
      '- **Diamond** — a decision: a question with a **Yes** arrow and a **No** arrow, like `b == 0?`.',
      '- **Arrow back up** — a loop: the shapes it goes back to run again.',
      '',
      'The flowcharts in this lab **run**: press Run to see each shape light up, the values change, and the screen.',
    ].join('\n')),
    task('t9-2', 'The perfect flowchart', '5 min', [
      'In this lab every question is planned as a flowchart **first**, then typed in C++. A perfect flowchart:',
      '',
      '1. Starts with one **Start** and finishes at an **End**.',
      '2. **Declares every variable with its type and gives it a starting value first**, in the first rectangle: `int a = 0, b = 0, total = 0`. A variable is never used before it has a value — the flowchart stops with a message if it is.',
      '3. Reads the inputs with **Input**, calculates in **rectangles**, shows results with **Output**.',
      '4. Gives **every decision** a Yes arrow and a No arrow.',
      '5. Has a way out of every loop.',
      '',
      'Then the code is one line per shape: the rectangle of declarations becomes `int a = 0, b = 0;`, Input becomes `cin >> a >> b;`, Output becomes `cout << …;`, a diamond becomes `if (…) { … } else { … }`.',
    ].join('\n')),
    fc('f-show-product', { title: 'Watch it run: the product program (sequence)', goal: 'The product program of Lecture 3 as a perfect flowchart. Press **Run**, or **Step** to go one shape at a time.', mode: 'Show it running', chart: CHARTS.product, input: '3 5' }),
    fc('f-show-divide', { title: 'Watch it run: a decision (Wk8 4)', goal: 'Change what the user types to `8 2` and run it again: the other arrow is followed.', mode: 'Show it running', chart: CHARTS.divide, input: '7 0' }),
    fc('f-show-count', { title: 'Watch it run: a loop', goal: 'The arrow from `n = n + 1` goes back up: the decision runs again until `n <= 5?` is No. `n` starts at 1 in the first rectangle — without a starting value the loop could not begin.', mode: 'Show it running', chart: CHARTS.count, input: '' }),
    fc('f-trace-ctof', { title: 'Read it: Celsius to Fahrenheit', goal: 'Follow the arrows with the input.', mode: 'Read it and type the output', chart: CHARTS.ctof, input: '25' }),
    fc('f-trace-seconds', { title: 'Read it: seconds to h, min and s', goal: '`/` with whole numbers keeps only the whole part; `%` is the remainder.', mode: 'Read it and type the output', chart: CHARTS.seconds, input: '3725' }),
    fc('f-trace-divide', { title: 'Read it: divide or unknown', goal: 'Which arrow does the decision follow?', mode: 'Read it and type the output', chart: CHARTS.divide, input: '9 0' }),
    fc('f-trace-greatest', { title: 'Read it: the greatest of three', goal: 'Two decisions in a row: follow Yes or No each time.', mode: 'Read it and type the output', chart: CHARTS.greatest, input: '4 9 2' }),
    fc('f-trace-sum', { title: 'Read it: a loop that adds', goal: 'Write down `total` and `k` each time the loop runs.', mode: 'Read it and type the output', chart: CHARTS.sum, input: '4' }),
    fc('f-trace-prime', { title: 'Read it: prime or not (Wk8 7)', goal: 'The loop tries every `d` from 2 up to `n - 1`.', mode: 'Read it and type the output', chart: CHARTS.prime, input: '9' }),

    /* ======================================================== 3. zero */
    part('p2', 'Code 1 · Zero: your first lines', '40 min'),
    vis('z-vis-first', 'Your first program, line by line', 'Every program in this lab starts like this. Step through it: what each line does, and what appears on the screen.'),
    vis('z-vis-anatomy', 'A program, piece by piece', 'The parts you type every time: `#include`, `using namespace std;`, `int main()`, the braces and `return 0;`.'),
    out('z-q1', 'What does it print? Watch the `\\n`.', 'cout << "Hello";\ncout << "World\\n";\ncout << "Bye\\n";'),
    ...pair(Q.hello, 'watch'),
    ...pair(Q.card, 'watch'),
    ...pair(Q.box, 'watch'),

    /* ======================================================== 4. values */
    part('p3', 'Code 2 · Values: variables, types and assignment', '55 min'),
    vis('v-vis-var', 'The life of a variable', 'A variable is a named box in memory. Watch it get a value, change, and be printed.'),
    vis('v-vis-types', 'Which box fits? (data types)', '`int` for whole numbers, `float` for decimals, `char` for one character, `string` for text.'),
    out('v-q1', 'What does it print?', 'int x = 3;\nx = x + 2;\nx += 4;\ncout << x;'),
    out('v-q2', 'What does it print?', 'int a = 7;\nint b = 2;\ncout << a / b << " " << a % b;'),
    ...pair(Q.types, 'watch'),
    vis('v-vis-inc', 'x++ or ++x?', 'The short forms: `x++`, `x--`, `+=`, `-=`, `*=`, `/=`, `%=`.'),
    ...pair(Q.steps, 'fill'),
    ...pair(Q.circle, 'fill'),

    /* ======================================================== 5. input */
    part('p4', 'Code 3 · Input: cin and getline', '50 min'),
    vis('i-vis-streams', 'cout & cin: data in and out', '`cin >> x` takes what the user types into `x`; `cout << x` shows it.'),
    vis('i-vis-flow', 'Keyboard → program → screen', 'Follow one value from the keyboard, through the program, to the screen.'),
    ...pair(Q.three, 'fill'),
    vis('i-vis-getline', 'cin >> vs getline', 'A name with a space needs getline: `cin >>` stops at the space. In a flowchart: `Input line name`.'),
    ...pair(Q.greet, 'fill'),
    vis('i-vis-ascii', 'Characters are numbers (ASCII)', 'Every character is a number: `a` is 97 and `A` is 65. That is why `c - 32` turns `a` into `A`. In a flowchart: `char(c - 32)` and `int(c)`.'),
    ...pair(Q.letter, 'fill'),

    /* ======================================================== 6. calculate */
    part('p5', 'Code 4 · Calculate: operators, cmath and algorithm', '1 h 30 min'),
    vis('c-vis-div', 'Whole-number division and %', '`7 / 2` is 3 with ints. `%` gives the remainder. You need both for time.'),
    out('c-q1', 'What does it print?', 'int t = 3725;\ncout << t / 3600 << " " << t % 3600;'),
    ...pair(Q.time, 'fill'),
    ...pair(Q.temp, 'fill'),
    ...pair(Q.avg, 'draw'),
    vis('c-vis-round', 'floor, ceil and round', '`floor` rounds down, `ceil` rounds up, `round` goes to the nearest whole number.'),
    ...pair(Q.hexagon, 'draw'),
    vis('c-vis-toolbox', 'The toolbox: every function, operator and symbol', 'max and min come from `<algorithm>`; pow, sqrt, floor, ceil and round from `<cmath>`.'),
    ...pair(Q.maxmin, 'draw'),
    ...pair(Q.modulus, 'draw'),

    /* ======================================================== 7. choose */
    part('p6', 'Code 5 · Choose: if, else if, else', '1 h 40 min'),
    vis('e-vis-median', 'Median: where does num3 go?', 'A decision picks one road. Watch how three numbers are compared with at most three conditions.'),
    out('e-q1', 'What does it print?', "if ('c' > 'd') { cout << \"yes\\n\"; }\nelse { cout << \"no\\n\"; }"),
    ...pair(Q.divide, 'draw'),
    ...pair(Q.z, 'draw'),
    ...pair(Q.greatest, 'draw'),
    ...pair(Q.kase, 'draw'),
    ...pair(Q.score, 'draw'),
    ...pair(Q.sentence, 'draw'),

    /* ======================================================== 8. strings */
    part('p7', 'Code 6 · Strings: find, npos and substr', '1 h 40 min'),
    vis('s-vis-string', 'String explorer', 'Try `find`, `substr` and `length` on this line. When `find` finds nothing it gives `string::npos` (in a flowchart: `npos`).', 'it costs 3.75 pounds'),
    out('s-q1', 'What does it print?', 'string s = "Liverpool";\ncout << s.substr(5) << " " << s.length();'),
    ...pair(Q.dash, 'draw'),
    ...pair(Q.decimal, 'draw'),
    ...pair(Q.words, 'draw'),
    ...pair(Q.name, 'draw'),
    vis('s-vis-email', 'Is it an email address?', 'The Lecture 4 checks, one by one: an @, something before and after it, a dot after it, something on both sides of the dot.', 'gerard.mckee@bue.edu.eg'),
    ...pair(Q.email, 'draw'),
    ...pair(Q.tld, 'draw'),

    /* ======================================================== 9. hero */
    part('p8', 'Code 7 · Hero: the hardest programs', '1 h 30 min'),
    vis('h-vis-median', 'Median: where does num3 go?', 'The second median program of Lecture 2: at most three conditions.'),
    ...pair(Q.hmedian, 'draw'),
    ...pair(Q.stats, 'draw'),
    vis('h-vis-vector', 'Is it a vector <x, y>?', 'The Lecture 5 steps: find `<`, then `>`, then `,`, then check both parts.', '<2, 3>'),
    ...pair(Q.vector, 'draw'),
    ...pair(Q.vsum, 'draw'),
    ...pair(Q.dot, 'draw'),

    /* ======================================================== 10. loops in flowcharts */
    part('p11', 'Loops in flowcharts (Wk8 programs 5 to 7)', '1 h'),
    task('t11-1', 'Loops: flowcharts first', '3 min', [
      'These three problems need a **loop**: an arrow that goes back up to a decision. Draw them as flowcharts; the C++ for loops come with the loop lectures.',
      '',
      'A perfect loop: its counter is declared and **given a starting value before the loop** (`int n = 1`), the decision tests it, and the body changes it (`n = n + 1`) so the loop ends.',
      '',
      'To draw an arrow, drag the **dot under a shape** onto the next shape. From a diamond, the first arrow is **Yes** and the second is **No** (select an arrow and press **Yes ⇄ No** to swap).',
    ].join('\n')),
    fc('f-fill-fives', { title: 'Fill it: numbers divisible by 5 (Wk8 5)', goal: 'A loop from 1 to 99 that prints only the numbers divisible by 5. Look at the first box: a counter needs a starting value.', mode: 'Fill the empty boxes',
      chart: blankOut(CHARTS.fives, ['int n = 1', 'n <= 99?', 'n mod 5 = 0?', 'n = n + 1']), bank: ['int n = 1', 'int n', 'n <= 99?', 'n >= 99?', 'n mod 5 = 0?', 'n mod 2 = 0?', 'n = n + 1', 'n = n + 5'].sort(), checks: LOOP_CHECKS.fives, solution: CHARTS.fives }),
    fc('f-draw-fives', { title: 'Draw it: numbers divisible by 5 from 1 to 99 (Wk8 5)', goal: 'No input. Show every number from 1 to 99 that is divisible by 5, one per Output (`Output n`). Declare and start the counter first.', mode: 'Draw it yourself', chart: canvasFor(CHARTS.fives), checks: LOOP_CHECKS.fives, solution: CHARTS.fives }),
    fc('f-draw-fifty', { title: 'Draw it: the sum and average of 50 integers (Wk8 6)', goal: 'Read 50 integers, one at a time, in a loop. Then `Output "sum: ", total` and `Output "average: ", …`. Start `total` at 0 and the counter at 1. The average can have a decimal part: divide by `50.0`.', mode: 'Draw it yourself', chart: canvasFor(CHARTS.fifty), checks: LOOP_CHECKS.fifty, solution: CHARTS.fifty }),
    fc('f-fill-prime', { title: 'Fill it: prime or not (Wk8 7)', goal: 'The declarations with their starting values, the loop condition, the test and the step.', mode: 'Fill the empty boxes',
      chart: blankOut(CHARTS.prime, ['int n = 0, d = 2, prime = 1', 'd < n?', 'n mod d = 0?', 'd = d + 1']), bank: ['int n = 0, d = 2, prime = 1', 'int n, d, prime', 'd < n?', 'd > n?', 'n mod d = 0?', 'd mod n = 0?', 'd = d + 1', 'd = d + 2'].sort(), checks: LOOP_CHECKS.prime, solution: CHARTS.prime }),
    fc('f-draw-prime', { title: 'Draw it: is N a prime? (Wk8 7)', goal: 'Read a positive integer `n`. Show exactly `prime` or `not prime`. Remember: 1 is not a prime.', mode: 'Draw it yourself', chart: canvasFor(CHARTS.prime), checks: LOOP_CHECKS.prime, solution: CHARTS.prime }),
  ]);
}
