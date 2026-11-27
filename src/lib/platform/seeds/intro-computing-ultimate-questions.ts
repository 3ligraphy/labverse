/**
 * Intro to Computing · Lab 4 — the questions that are not copied from Labs 1–3: the lab-sheet and lecture questions
 * (their own words) and the new ones. Each program is checked by running it (`in …; expect …`); the reference
 * solutions live in tests/support/ultimate-solutions.ts. Only lecture content: no arrays, no functions of your own.
 */
import { buildChart, type FStep } from '../../../lab/flow/build.ts';

type N = { id: string; type: string; data: Record<string, string> };
type Topic = 't1' | 't2' | 't3' | 't4' | 't5' | 't6' | 't7' | 't8' | 't9' | 't10' | 't11' | 't12' | 't13' | 't14' | 't15';

export const SKELETON = '#include <iostream>\nusing namespace std;\n\nint main() {\n\n    return 0;\n}\n';

/** a program to type (paste blocked), checked on several inputs */
export const prog = (id: string, d: { title: string; goal: string; checks: string[]; starter?: string; hints?: string[]; tag?: string }): N =>
  ({ id, type: 'cpp', data: { title: d.title, goal: d.goal, starter: d.starter ?? SKELETON, input: '', checks: d.checks.join('\n'), hints: (d.hints ?? []).join('\n'), paste: 'Blocked', tag: d.tag ?? 'New' } });

const answer = (id: string, mode: string, tag: string, question: string, code: string, answers: string[] = [], input = ''): N =>
  ({ id, type: 'cppanswer', data: { question, code, input, mode, answers: answers.join('\n'), caps: 'Count', explain: '', tag } });
/** type exactly what the code prints (checked against the real output); tag = where the question comes from */
export const out = (id: string, tag: string, question: string, code: string, input = '') => answer(id, 'What it prints (the output)', tag, question, code, [], input);
/** type a value (checked against the accepted forms) */
export const val = (id: string, tag: string, question: string, code: string, answers: string[]) => answer(id, 'A value', tag, question, code, answers);
/** a flowchart to watch (Show it running), placed above the code question it belongs to: id `<question>-flow` */
export const flow = (id: string, title: string, goal: string, steps: FStep[], input = ''): N =>
  ({ id: `${id}-flow`, type: 'flowchart', data: { title, goal, mode: 'Show it running', chart: buildChart(steps), input, bank: '', checks: '', solution: '' } });

/* the checks every loop sheet adds: Wk9 is about while, Wk10 about for */
const WHILE = ['Uses while :: code /while\\s*\\(/ Use a while loop: this sheet is about while.', 'No for :: nocode /for\\s*\\(/ Use while here: for comes in the Wk10 sheet.'];
const FOR = ['Uses for :: code /for\\s*\\(/ Use a for loop.', 'No while :: nocode /while\\s*\\(/ Use for here, not while.'];
const A_LOOP = 'Uses a loop :: code /while\\s*\\(|for\\s*\\(/ Repeat with a loop: do not write the same line many times.';
const list = (n: number, f: (i: number) => number | string, sep = ' ') => Array.from({ length: n }, (_, i) => f(i)).join(sep);
const lines = (n: number, text: string) => list(n, () => text, '\\n') + '\\n';

/* ===================================================================== 1 · Output */
const t1: N[] = [
  prog('n1-1', {
    title: 'A receipt with tabs',
    goal: 'Print this receipt: 4 lines, with **one tab** (`\\t`) between the two columns:\n\n| | |\n|---|---|\n| `Item` | `Price` |\n| `Tea` | `15` |\n| `Cake` | `30` |\n| `Total` | `45` |',
    checks: ['Prints the receipt :: exact Item\\tPrice\\nTea\\t15\\nCake\\t30\\nTotal\\t45\\n', 'Uses \\t :: code /\\\\t/ Put \\t between the columns.'],
    hints: ['One `cout` per line: `cout << "Tea\\t15\\n";`'],
  }),
  prog('n1-2', {
    title: 'Three lines with one cout',
    goal: 'Print these three lines using **only one** `cout` statement (put `\\n` where a new line starts):\n\n```\nReady\nSteady\nGo!\n```',
    checks: ['Prints the 3 lines :: exact Ready\\nSteady\\nGo!\\n', 'One cout :: nocode /cout[\\s\\S]*cout/ Use only one cout: one text with \\n inside it.'],
  }),
  prog('n1-3', {
    title: 'endl and \\n',
    goal: 'Print `Line 1`, `Line 2` and `Line 3`, each on its own line. End line 1 with `endl` and line 2 with `\\n`: both start a new line.',
    checks: ['Prints the 3 lines :: exact Line 1\\nLine 2\\nLine 3\\n', 'Uses endl :: code /endl/ End line 1 with endl.', 'Uses \\n :: code /\\\\n/ End line 2 with \\n.'],
  }),
  prog('n1-4', {
    title: 'A staircase of stars',
    goal: 'Print this staircase (4 lines, no spaces):\n\n```\n*\n**\n***\n****\n```',
    checks: ['Prints the staircase :: exact *\\n**\\n***\\n****\\n'],
  }),
  prog('n1-5', {
    title: 'Comments do not print',
    goal: 'Print `Total: 7`. Above the `cout` line, write a `//` comment that says what the line does, and somewhere a `/* … */` comment with your name. Comments are notes for people: they never print.',
    checks: ['Prints only the total :: exact Total: 7\\n', 'A // comment :: code /\\/\\/.*\\w/ Add a line comment (it starts with two slashes) that says what the cout line does.', 'A /* */ comment :: code /\\/\\*[\\s\\S]*?\\*\\// Add a block comment (it starts with slash star and ends with star slash) with your name.'],
  }),
];

/* ===================================================================== 2 · Values */
const t2: N[] = [
  prog('n2-1', {
    title: 'Swap two values',
    goal: 'Declare `int a = 5;` and `int b = 9;`. **Swap** them using a third variable `temp`, then print `a = ` and `b = ` with the variables:\n\n```\na = 9, b = 5\n```',
    checks: ['Swaps :: exact a = 9, b = 5\\n', 'Uses temp :: code /int\\s+temp\\s*=/ Use a third variable: int temp = a;', 'Prints the variables :: nocode /"a\\s*=\\s*9/ Print the variables a and b, not the numbers inside the text.'],
    hints: ['Three steps: `temp = a;` then `a = b;` then `b = temp;`'],
  }),
  prog('n2-2', {
    title: 'x step by step',
    goal: 'Start with `int x = 10;`. Write these 5 lines, and after **each** one print `x = ` and the value on its own line: `x += 5;` `x *= 2;` `x -= 6;` `x /= 4;` `x %= 4;`',
    checks: ['Prints every step :: exact x = 15\\nx = 30\\nx = 24\\nx = 6\\nx = 2\\n', 'Uses the 5 operators :: code /\\+=[\\s\\S]*\\*=[\\s\\S]*-=[\\s\\S]*\\/=[\\s\\S]*%=/ Use the 5 compound operators, in this order.'],
    hints: ['`x /= 4;` divides whole numbers: 24 / 4 = 6. `x %= 4;` keeps the remainder: 6 % 4 = 2.'],
  }),
  prog('n2-3', {
    title: 'int or float?',
    goal: 'Declare `int a = 7;`, `int b = 2;` and `float c = 7;`. Print three lines:\n\n```\na / b = 3\na % b = 1\nc / b = 3.5\n```\n\nCalculate each value in the code: `a / b`, `a % b`, `c / b`. Two whole numbers give a whole number; a float keeps the decimal part.',
    checks: ['Prints the 3 results :: exact a / b = 3\\na % b = 1\\nc / b = 3.5\\n', 'c is a float :: code /float\\s+c\\s*=\\s*7/ Declare float c = 7;', 'Calculates :: code /c\\s*\\/\\s*b/ Print c divided by b, calculated by the program.'],
  }),
  prog('n2-4', {
    title: 'A constant price',
    goal: 'Declare `const float price = 12.5;` and `int quantity = 4;`. Print `total: ` and `price * quantity`:\n\n```\ntotal: 50\n```\n\nThen try adding `price = 13;` — the program does not compile, because a constant cannot change. Delete that line again.',
    checks: ['Prints the total :: exact total: 50\\n', 'price is a const :: code /const\\s+float\\s+price\\s*=\\s*12\\.5/ Keep: const float price = 12.5;', 'Calculates :: code /price\\s*\\*\\s*quantity/ Print price * quantity.'],
  }),
  prog('n2-5', {
    title: 'true or false: bool',
    goal: 'Declare `int mark = 72;` and `bool passed = mark >= 50;`. Print `passed: ` and `passed`, then `failed: ` and `!passed`. `cout` prints `true` as **1** and `false` as **0**:\n\n```\npassed: 1\nfailed: 0\n```',
    checks: ['Prints 1 and 0 :: exact passed: 1\\nfailed: 0\\n', 'A bool :: code /bool\\s+passed\\s*=\\s*mark\\s*>=\\s*50/ Declare bool passed = mark >= 50;', 'Uses ! :: code /!\\s*passed/ Print !passed (not passed).'],
  }),
];

/* ===================================================================== 3 · Input */
const t3: N[] = [
  prog('n3-1', {
    title: 'Ten years from now',
    goal: 'Read a first name (one word) and an age with `cin`. Print:\n\n```\nHi Mona, in 10 years you will be 29\n```\n\n(for `Mona 19`).',
    checks: ['Mona 19 :: in Mona 19; expect Hi Mona, in 10 years you will be 29', 'Omar 7 :: in Omar 7; expect Hi Omar, in 10 years you will be 17', 'Sara 40 :: in Sara 40; expect Hi Sara, in 10 years you will be 50'],
  }),
  prog('n3-2', {
    title: 'Repeat what I typed',
    goal: 'Read a whole line (it can have spaces) with `getline`. Print `You typed: ` and the line, then `Goodbye`.',
    checks: ['A line with spaces :: in I love C++; expect You typed: I love C++; expect Goodbye', 'One word :: in one; expect You typed: one', 'Symbols :: in 2 + 2 = 4; expect You typed: 2 + 2 = 4', 'Uses getline :: code /getline\\s*\\(\\s*cin/ Read the whole line with getline(cin, line);'],
  }),
  prog('n3-3', {
    title: 'Backwards',
    goal: 'Read three whole numbers (on one line). Print them **backwards**, with one space between them: `1 2 3` prints `3 2 1`.',
    checks: ['1 2 3 :: in 1 2 3; expect 3 2 1', '10 -4 7 :: in 10 -4 7; expect 7 -4 10', '5 5 6 :: in 5 5 6; expect 6 5 5'],
  }),
  prog('n3-4', {
    title: 'A seat in the cinema',
    goal: 'Read a row letter (a `char`) and a seat number (an `int`), like `B 12`. Print:\n\n```\nseat: B12\nnext seat: B13\n```',
    checks: ['B 12 :: in B 12; expect seat: B12; expect next seat: B13', 'A 1 :: in A 1; expect seat: A1; expect next seat: A2', 'K 99 :: in K 99; expect seat: K99; expect next seat: K100', 'Uses a char :: code /char\\s+\\w+/ Read the row into a char.'],
  }),
  prog('n3-5', {
    title: 'Price times quantity',
    goal: 'Read a price (a decimal number) and a quantity (a whole number). Print `to pay: ` and the price times the quantity: `2.5 4` prints `to pay: 10`.',
    checks: ['2.5 and 4 :: in 2.5 4; expect to pay: 10', '1.25 and 3 :: in 1.25 3; expect to pay: 3.75', '10 and 0 :: in 10 0; expect to pay: 0'],
  }),
];

/* ===================================================================== 4 · Calculating */
const t4sheet: N[] = [
  prog('s-p10', {
    tag: 'Wk6 sheet',
    title: 'Program 10: the area of an isosceles triangle',
    goal: '**Lab sheet, Program 10:** Calculate the area of an isosceles triangle, where the user enters the base and one of the two equal angles of the triangle.\n\nAdded constraints (the sheet asks you to add them): the angle is in degrees. Use `const float pi = 3.14159;`. The height is `(base / 2) * tan(angle * pi / 180)` and the area is `base * height / 2`. `tan` comes from `cmath` and works in radians. Print `area: ` and the area.',
    checks: ['Base 10, angle 45 :: in 10 45; expect area: 25', 'Base 6, angle 60 :: in 6 60; expect area: 15.5884', 'Base 4, angle 30 :: in 4 30; expect area: 2.3094', 'Uses tan :: code /tan\\s*\\(/ The height needs tan( ) from cmath.'],
    hints: ['`#include <cmath>` gives you `tan`. Turn degrees into radians: `angle * pi / 180`.'],
  }),
  prog('s-p13', {
    tag: 'Wk6 sheet',
    title: 'Program 13: the area of a parallelogram (two sides)',
    goal: '**Lab sheet, Program 13:** Calculate the area of a parallelogram, where the user enters the lengths of the long and short sides of the parallelogram.\n\nAdded constraint: two sides are not enough — the user also enters the angle between them, in degrees. The area is `long * short * sin(angle * pi / 180)` with `const float pi = 3.14159;`. Print `area: ` and the area.',
    checks: ['8, 5 and 30 degrees :: in 8 5 30; expect area: 20', '10, 4 and 90 degrees :: in 10 4 90; expect area: 40', '6, 6 and 45 degrees :: in 6 6 45; expect area: 25.4558', 'Uses sin :: code /sin\\s*\\(/ The area needs sin( ) from cmath.'],
  }),
  prog('s-p14', {
    tag: 'Wk6 sheet',
    title: 'Program 14: the area of a parallelogram (angle, length, height)',
    goal: '**Lab sheet, Program 14:** Calculate the area of a parallelogram, where the user enters the angle, the length, and the height of the parallelogram.\n\nRead the three numbers in this order. Think: does the area need the angle? (It is `length * height`.) Print `area: ` and the area.',
    checks: ['60, 8 and 3 :: in 60 8 3; expect area: 24', '30, 10 and 2.5 :: in 30 10 2.5; expect area: 25', '45, 7 and 7 :: in 45 7 7; expect area: 49'],
  }),
];
const t4: N[] = [
  prog('n4-1', {
    title: 'Seconds since midnight',
    goal: 'Read a time as three whole numbers: hours, minutes and seconds (`13 45 20`). Print `seconds since midnight: ` and the total number of seconds.',
    checks: ['13:45:20 :: in 13 45 20; expect seconds since midnight: 49520', '00:00:59 :: in 0 0 59; expect seconds since midnight: 59', '23:59:59 :: in 23 59 59; expect seconds since midnight: 86399'],
  }),
  prog('n4-2', {
    title: 'The digits of a 3-digit number',
    goal: 'Read a whole number with 3 digits, like `482`. Using `/` and `%` only, print four lines:\n\n```\nhundreds: 4\ntens: 8\nunits: 2\nsum of digits: 14\n```',
    checks: ['482 :: in 482; expect hundreds: 4; expect tens: 8; expect units: 2; expect sum of digits: 14', '905 :: in 905; expect hundreds: 9; expect tens: 0; expect units: 5; expect sum of digits: 14', '100 :: in 100; expect hundreds: 1; expect tens: 0; expect units: 0; expect sum of digits: 1', 'Uses % :: code /%\\s*10/ Get the last digit with % 10.'],
    hints: ['`n % 10` is the last digit. `n / 10 % 10` is the middle one. `n / 100` is the first.'],
  }),
  prog('n4-3', {
    title: 'The distance between two points',
    goal: 'Read two points: `x1 y1 x2 y2` (decimal numbers). Print `distance: ` and the distance between them, `sqrt((x2 - x1)² + (y2 - y1)²)`, using `pow` and `sqrt`.',
    checks: ['(0, 0) and (3, 4) :: in 0 0 3 4; expect distance: 5', '(1, 1) and (4, 5) :: in 1 1 4 5; expect distance: 5', 'The same point :: in 2 3 2 3; expect distance: 0', '(0, 0) and (1, 1) :: in 0 0 1 1; expect distance: 1.41421', 'Uses pow and sqrt :: code /pow\\s*\\([\\s\\S]*sqrt|sqrt[\\s\\S]*pow\\s*\\(/ Use pow( , 2) and sqrt( ).'],
  }),
  prog('n4-4', {
    title: 'Four marks: average, rounded, best',
    goal: 'Read four marks (decimal numbers). Print three lines: `average: ` (the exact average), `rounded: ` (the average with `round`) and `best mark: ` (the biggest of the four, with `max` only — a max of two maxes).',
    checks: ['70 80 90 65 :: in 70 80 90 65; expect average: 76.25; expect rounded: 76; expect best mark: 90', '50.5 60 70 80 :: in 50.5 60 70 80; expect average: 65.125; expect rounded: 65; expect best mark: 80', '100 100 99 98 :: in 100 100 99 98; expect average: 99.25; expect rounded: 99; expect best mark: 100', 'Uses round and max :: code /round\\s*\\([\\s\\S]*max\\s*\\(|max\\s*\\([\\s\\S]*round\\s*\\(/ Use round( ) and max( ).', 'No if :: nocode /\\bif\\s*\\(/ Find the best mark with max only, no if.'],
  }),
  prog('n4-5', {
    title: 'Money in the bank',
    goal: 'Read an amount of money and a yearly rate in percent (decimal numbers), then a number of years (a whole number). Print `after N years: ` and `money * (1 + rate / 100)` to the power of the years (use `pow`).',
    checks: ['1000 at 10% for 2 years :: in 1000 10 2; expect after 2 years: 1210', '500 for 0 years :: in 500 5 0; expect after 0 years: 500', '2000 at 3.5% for 3 years :: in 2000 3.5 3; expect after 3 years: 2217.44', 'Uses pow :: code /pow\\s*\\(/ Use pow to raise (1 + rate divided by 100) to the power of years.'],
  }),
];

/* ===================================================================== 5 · Choosing */
const t5: N[] = [
  prog('n5-1', {
    title: 'Positive, negative or zero',
    goal: 'Read a whole number. Print `positive`, `negative` or `zero`.',
    checks: ['5 :: in 5; expect positive', '-3 :: in -3; expect negative', '0 :: in 0; expect zero'],
  }),
  prog('n5-2', {
    title: 'A leap year',
    goal: 'Read a year. Print `leap year` or `not a leap year`. A year is a leap year when it can be divided by 4 **and not** by 100 — **or** when it can be divided by 400. Use `%`, `&&` and `||` in one condition.',
    checks: ['2024 :: in 2024; expect leap year', '1900 :: in 1900; expect not a leap year', '2000 :: in 2000; expect leap year', '2023 :: in 2023; expect not a leap year', 'Uses && and || :: code /&&[\\s\\S]*\\|\\||\\|\\|[\\s\\S]*&&/ Write the rule with && and ||.'],
  }),
  prog('n5-3', {
    title: 'A ticket price',
    goal: 'Read an age (a whole number) and one letter: `s` for a student, `n` for not a student. Print `price: ` and the price:\n\n- under 12: **20**\n- 60 or older: **25**\n- everyone else: **50**, but students pay **30**',
    checks: ['A child :: in 8 n; expect price: 20', 'A student :: in 20 s; expect price: 30', 'Not a student :: in 20 n; expect price: 50', 'Over 60 :: in 65 s; expect price: 25', 'Exactly 12 :: in 12 n; expect price: 50'],
  }),
  prog('n5-4', {
    title: 'What kind of triangle?',
    goal: 'Read three whole numbers: the sides of a triangle. If one side is as long as the other two together or longer, print `not a triangle`. Otherwise print `equilateral` (3 equal sides), `isosceles` (2 equal sides) or `scalene` (no equal sides).',
    checks: ['3 3 3 :: in 3 3 3; expect equilateral', '3 3 5 :: in 3 3 5; expect isosceles', '3 4 5 :: in 3 4 5; expect scalene', '1 2 3 :: in 1 2 3; expect not a triangle', '5 3 3 :: in 5 3 3; expect isosceles'],
    hints: ['Check “not a triangle” first: `a + b <= c || a + c <= b || b + c <= a`.'],
  }),
  prog('n5-5', {
    title: 'The BMI',
    goal: 'Read a weight in kg and a height in m (decimal numbers). Print `BMI: ` and `weight / (height * height)`, then on the next line: `underweight` (under 18.5), `normal` (under 25), `overweight` (under 30) or `obese`.',
    checks: ['50 kg, 1.8 m :: in 50 1.8; expect BMI: 15.4321; expect underweight', '70 kg, 1.75 m :: in 70 1.75; expect BMI: 22.8571; expect normal', '85 kg, 1.7 m :: in 85 1.7; expect BMI: 29.4118; expect overweight', '100 kg, 1.6 m :: in 100 1.6; expect BMI: 39.0625; expect obese'],
  }),
];

/* ===================================================================== 6 · Characters and ASCII */
const t6: N[] = [
  prog('n6-1', {
    title: 'The letters around it',
    goal: 'Read one lowercase letter from `b` to `y`. A `char` is a number (its ASCII code), so `c - 1` is the letter before it and `c + 1` the letter after it. Print:\n\n```\nbefore: l\nafter: n\n```\n\n(for `m`). Store each result in a `char`, so it prints as a letter and not as a number.',
    checks: ['m :: in m; expect before: l; expect after: n', 'b :: in b; expect before: a; expect after: c', 'y :: in y; expect before: x; expect after: z'],
  }),
  prog('n6-2', {
    title: 'The ASCII code of a character',
    goal: 'Read one character. Print its ASCII code:\n\n```\nthe ASCII code of A is 65\n```\n\nTo print the code of a `char c`, cast it to an `int`: `(int)c`.',
    checks: ['A :: in A; expect the ASCII code of A is 65', 'a :: in a; expect the ASCII code of a is 97', 'The digit 0 :: in 0; expect the ASCII code of 0 is 48', 'A question mark :: in ?; expect the ASCII code of ? is 63'],
  }),
  prog('n6-3', {
    title: 'Position in the alphabet',
    goal: "Read one capital letter. Print its position in the alphabet: `A` is 1, `B` is 2, … `Z` is 26.\n\n```\nC is letter 3 of the alphabet\n```\n\n`c - 'A'` is 0 for `A`, 1 for `B`, and so on.",
    checks: ['A :: in A; expect A is letter 1 of the alphabet', 'C :: in C; expect C is letter 3 of the alphabet', 'Z :: in Z; expect Z is letter 26 of the alphabet'],
  }),
  prog('n6-4', {
    title: 'A digit as a number',
    goal: "Read one character that is a digit, like `7`, into a `char`. The character `'7'` has the code 55, not 7. Its number is `c - '0'` (the codes of `'0'` to `'9'` are in order). Print the number doubled:\n\n```\n7 doubled is 14\n```",
    checks: ["7 :: in 7; expect 7 doubled is 14", "0 :: in 0; expect 0 doubled is 0", "9 :: in 9; expect 9 doubled is 18", "Reads a char :: code /char\\s+\\w+/ Read the digit into a char, not an int.", "Uses the code of '0' :: code /-\\s*('0'|48)/ Turn the character into its number: c - '0'."],
  }),
  prog('n6-5', {
    title: 'Shift a letter by 3',
    goal: "Read one lowercase letter. Print the letter 3 places later in the alphabet. After `z` the alphabet starts again at `a`:\n\n- `a` becomes `d`\n- `x` becomes `a`\n- `z` becomes `c`\n\nPrint `a becomes d`. One way: the position is `c - 'a'` (0 to 25); add 3; `% 26` turns 26, 27 and 28 back into 0, 1 and 2; the new letter is `'a' + position`.",
    checks: ['a :: in a; expect a becomes d', 'm :: in m; expect m becomes p', 'x starts again at a :: in x; expect x becomes a', 'z :: in z; expect z becomes c'],
    hints: ["Store the new letter in a `char`: `char shifted = 'a' + position;`"],
  }),
];

/* ===================================================================== 7 · Strings */
const t7: N[] = [
  prog('n7-1', {
    title: 'The middle letter',
    goal: 'Read one word with an odd number of letters, like `apple`. Print `middle: ` and its middle letter. Positions start at 0, so the middle is at `word.length() / 2`: for `apple` (5 letters) that is position 2, the letter `p`.',
    checks: ['apple :: in apple; expect middle: p', 'cat :: in cat; expect middle: a', 'abcdefg :: in abcdefg; expect middle: d', 'One letter :: in x; expect middle: x', 'Uses the length :: code /length\\s*\\(\\s*\\)|size\\s*\\(\\s*\\)/ Use the length of the word to find the middle.'],
  }),
  prog('n7-2', {
    title: 'Where is the letter?',
    goal: 'Read a word and then one letter, like `hello l`. If the letter is in the word, print `found at position ` and the position where it first appears (positions start at 0). If not, print `not found`.\n\n- `hello l` → `found at position 2`\n- `hello z` → `not found`\n\n`find` returns `string::npos` when it finds nothing.',
    checks: ['hello l :: in hello l; expect found at position 2; not not found', 'hello z :: in hello z; expect not found', 'banana a (the first a) :: in banana a; expect found at position 1; not not found', 'hello h (position 0) :: in hello h; expect found at position 0; not not found', 'Uses npos :: code /npos/ Compare the result of find with string::npos.'],
  }),
  prog('n7-3', {
    title: "Next year's date",
    goal: 'Read a date written as `dd/mm/yyyy`, like `25/12/2026` (one word). Print the day, the month and the year as numbers, then the same date one year later:\n\n```\nday: 25\nmonth: 12\nyear: 2026\nnext year: 25/12/2027\n```\n\nFor `01/02/2000` the day is the number `1`, but the next-year date keeps the text `01/02/`: `next year: 01/02/2001`. Use `substr`, `stoi` and `to_string`.',
    checks: ['25/12/2026 :: in 25/12/2026; expect day: 25; expect month: 12; expect year: 2026; expect next year: 25/12/2027', '01/02/2000 :: in 01/02/2000; expect day: 1\\n; expect month: 2\\n; expect year: 2000; expect next year: 01/02/2001', '31/01/1999 :: in 31/01/1999; expect day: 31; expect month: 1\\n; expect year: 1999; expect next year: 31/01/2000', 'Uses stoi :: code /stoi\\s*\\(/ Turn the text into numbers with stoi.', 'Uses to_string :: code /to_string\\s*\\(/ Build the new date with to_string(year + 1).'],
  }),
  prog('n7-4', {
    title: 'Make a username',
    goal: 'Read a first name, a last name (one word each) and a year of birth (a whole number), like `mona salem 2005`. The username is the first letter of the first name, then the last name, then the last two digits of the year. Print:\n\n```\nusername: msalem05\n```\n\n`to_string(2005)` is the text `2005`; take its last two characters with `substr`.',
    checks: ['mona salem 2005 :: in mona salem 2005; expect username: msalem05', 'omar ali 1999 :: in omar ali 1999; expect username: oali99', 'sara nabil 2010 :: in sara nabil 2010; expect username: snabil10', 'Uses to_string :: code /to_string\\s*\\(/ Turn the year into text with to_string.'],
  }),
  prog('n7-5', {
    title: 'Replace a word',
    goal: 'Read a line (it has spaces) that contains the word `bad` once. Print the same line with `bad` changed to `good`.\n\n- `this is bad` → `this is good`\n- `bad day` → `good day`\n\nFind where `bad` starts, then join: the text before it, then `good`, then the text after it (`bad` has 3 letters).',
    checks: ['this is bad :: in this is bad; expect this is good', 'bad day :: in bad day; expect good day', 'In the middle :: in not bad at all; expect not good at all', 'With a full stop :: in it is bad.; expect it is good.', 'Uses find :: code /find\\s*\\(/ Use find to know where bad starts.', 'Uses substr :: code /substr\\s*\\(/ Build the new line with substr.'],
  }),
];

/* ===================================================================== 8 · Programs with strings */
const t8: N[] = [
  prog('n8-1', {
    title: 'Is it a mobile number?',
    goal: 'Read a phone number as text (one word). It is valid when it has exactly 11 characters and starts with `01`. Print `valid` or `not valid`.\n\n- `01012345678` → `valid`\n- `0101234567` → `not valid` (10 characters)',
    checks: ['11 characters, starts with 01 :: in 01012345678; expect valid; not not valid', '10 characters :: in 0101234567; expect not valid', 'Starts with 02 :: in 02012345678; expect not valid', 'Starts with 011 :: in 01112345678; expect valid; not not valid', '12 characters :: in 010123456789; expect not valid', 'Uses the length :: code /length\\s*\\(\\s*\\)|size\\s*\\(\\s*\\)/ Check the length of the number.'],
  }),
  prog('n8-2', {
    title: 'File name and type',
    goal: 'Read a file name like `photo.jpg` (one word, at most one dot). Print the name and the extension, then the type:\n\n```\nname: photo\nextension: jpg\ntype: image\n```\n\nThe type is `image` for `jpg` and `png`, `music` for `mp3`, `C++ code` for `cpp`, and `other` for anything else. If there is no dot, print only `no extension`.',
    checks: ['photo.jpg :: in photo.jpg; expect name: photo; expect extension: jpg; expect type: image', 'logo.png :: in logo.png; expect name: logo; expect extension: png; expect type: image', 'song.mp3 :: in song.mp3; expect extension: mp3; expect type: music', 'main.cpp :: in main.cpp; expect name: main; expect type: C++ code', 'notes.txt :: in notes.txt; expect extension: txt; expect type: other', 'No dot :: in README; expect no extension; not name:', 'Uses find :: code /find\\s*\\(/ Find the dot with find.'],
  }),
  prog('n8-3', {
    title: 'Initials of three names',
    goal: 'Read a full name of three words on one line, like `Mona Ahmed Salem`. Print `initials: M.A.S.`: the first letter of each name, each one followed by a dot.\n\nThe first initial is `line[0]`. Take the rest of the line after the first space with `substr`: its first letter is the second initial, and the third initial comes after the space in the rest.',
    checks: ['Mona Ahmed Salem :: in Mona Ahmed Salem; expect initials: M.A.S.', 'Small letters stay small :: in omar ali hassan; expect initials: o.a.h.', 'Sara Nabil Ali :: in Sara Nabil Ali; expect initials: S.N.A.', 'Uses getline :: code /getline\\s*\\(\\s*cin/ Read the whole line with getline: it has spaces.'],
  }),
  prog('n8-4', {
    title: '24-hour time to 12-hour time',
    goal: 'Read a time in 24-hour form `hh:mm`, like `14:05`. Print it in 12-hour form with `AM` or `PM`:\n\n- `14:05` → `2:05 PM`\n- `00:30` → `12:30 AM`\n- `12:00` → `12:00 PM`\n- `09:15` → `9:15 AM`\n\nHours 0 to 11 are AM and 12 to 23 are PM. Hour 0 prints as 12; hours 13 to 23 lose 12.',
    checks: ['14:05 :: in 14:05; expect 2:05 PM', 'Midnight :: in 00:30; expect 12:30 AM', 'Noon :: in 12:00; expect 12:00 PM', 'Morning :: in 09:15; expect 9:15 AM; not 09:15', '23:59 :: in 23:59; expect 11:59 PM', 'Uses stoi :: code /stoi\\s*\\(/ Turn the hours into a number with stoi.'],
  }),
  prog('n8-5', {
    title: 'Is the password strong?',
    goal: 'Read a password (one word). Check these rules **in this order** and print the message of the first rule that applies:\n\n1. fewer than 8 characters → `too short`\n2. it contains `password` → `too easy`\n3. the first character is not a capital letter → `start with a capital letter`\n4. the last character is not a digit → `end with a digit`\n5. none of these → `strong`',
    checks: ['abc :: in abc; expect too short', 'mypassword1 :: in mypassword1; expect too easy', 'secret123 :: in secret123; expect start with a capital letter', 'Secret12x :: in Secret12x; expect end with a digit', 'Secret123 :: in Secret123; expect strong', 'Exactly 8 characters :: in Abcdefg1; expect strong; not too short'],
  }),
];

/* ===================================================================== 9 · Vectors and complex numbers */
const t9sheet: N[] = [
  prog('s-p26', {
    tag: 'Wk6 sheet',
    title: 'Program 26: is it a complex number?',
    goal: '**Lab sheet, Program 26:** Verify that a number entered by the user is a complex number.\n\nLecture 5 uses the format `a + bi` or `a - bi`: a number, a space, `+` or `-`, a space, then a number followed by `i` (the first number may have a minus sign). Read the whole line with `getline` (it has spaces). It is a complex number when:\n\n- there is something before the first space\n- after that space comes `+` or `-`, then a second space\n- the last part has more than one character and ends with `i`\n\nYou can assume that the numbers are numbers (Lecture 5). Print `complex number` or `not a complex number`.',
    checks: ['3 + 4i :: in 3 + 4i; expect complex number; not not a complex', '-2 - 5i :: in -2 - 5i; expect complex number; not not a complex', 'No i :: in 3 + 4; expect not a complex number', 'Not + or - :: in 3 * 4i; expect not a complex number', 'No spaces :: in 34i; expect not a complex number', 'No number before i :: in 3 + i; expect not a complex number', 'Decimals :: in 2.5 - 0.5i; expect complex number; not not a complex', 'Uses getline :: code /getline\\s*\\(\\s*cin/ Read the whole line with getline: it has spaces.'],
  }),
  prog('s-p27', {
    tag: 'Wk6 sheet',
    title: 'Program 27: the real and imaginary parts',
    goal: '**Lab sheet, Program 27:** Return the real and imaginary parts of a complex number entered by the user.\n\nThe user enters a complex number in the Lecture 5 format, like `3 + 4i` or `-2 - 5i` (the numbers can have decimals). Print:\n\n```\nreal part: 3\nimaginary part: 4\n```\n\nWith `-` in the middle the imaginary part is negative: `-2 - 5i` → `imaginary part: -5`. Use `stod` to turn the text into a number.',
    checks: ['3 + 4i :: in 3 + 4i; expect real part: 3; expect imaginary part: 4', '-2 - 5i :: in -2 - 5i; expect real part: -2; expect imaginary part: -5', 'Decimals :: in 1.5 - 0.5i; expect real part: 1.5; expect imaginary part: -0.5', 'Real part 0 :: in 0 + 7i; expect real part: 0; expect imaginary part: 7', 'Uses stod :: code /sto[dfi]\\s*\\(/ Turn the parts into numbers with stod.'],
  }),
  prog('s-p28', {
    tag: 'Wk6 sheet',
    title: 'Program 28: the complex conjugate',
    goal: '**Lab sheet, Program 28:** Generate the complex conjugate of a complex number entered by the user.\n\nThe conjugate of `a + bi` is `a - bi`, and the conjugate of `a - bi` is `a + bi`: only the sign in the middle changes. The user enters a number like `3 + 4i` (Lecture 5 format). Print:\n\n```\nconjugate: 3 - 4i\n```',
    checks: ['3 + 4i :: in 3 + 4i; expect conjugate: 3 - 4i', '-2 - 5i :: in -2 - 5i; expect conjugate: -2 + 5i', '0 + 1i :: in 0 + 1i; expect conjugate: 0 - 1i', 'Decimals :: in 1.5 - 2.5i; expect conjugate: 1.5 + 2.5i'],
  }),
  prog('s-p30', {
    tag: 'Wk6 sheet',
    title: 'Program 30: quaternion, real quaternion or pure quaternion',
    goal: '**Lab sheet, Program 30:** Check if a quaternion entered by the user is a quaternion, a real quaternion, or a pure quaternion.\n\nLecture 5: a quaternion is `q = a + bi + cj + dk`. It is **real** when b, c and d are 0 (`5 + 0i + 0j + 0k`) and **pure** when a is 0 (`0 + 1i + 2j + 3k`). The user enters the four parts with ` + ` between them, like `1 + 2i + 3j + 4k`. Print:\n\n- `not a quaternion` if the format is wrong (the signs must be `+`, and the parts must end with `i`, `j` and `k`, in that order)\n- otherwise `real quaternion` if b, c and d are 0\n- otherwise `pure quaternion` if a is 0\n- otherwise `quaternion`\n\nLecture 5 reads the line with `getline`. You can also read the seven parts (`1`, `+`, `2i`, …) with `cin >>` into seven strings.',
    checks: ['1 + 2i + 3j + 4k :: in 1 + 2i + 3j + 4k; expect quaternion; not real; not pure; not not a', 'Real :: in 5 + 0i + 0j + 0k; expect real quaternion', 'Pure :: in 0 + 1i + 2j + 3k; expect pure quaternion', 'i and j swapped :: in 1 + 2j + 3i + 4k; expect not a quaternion', 'Decimals :: in 2.5 + 0i + 1j + 0k; expect quaternion; not real; not pure; not not a', 'All zero is real :: in 0 + 0i + 0j + 0k; expect real quaternion', 'No k :: in 1 + 2i + 3j + 4; expect not a quaternion'],
    hints: ['A part like `2i` is a number followed by a letter: its number is `stod(b.substr(0, b.length() - 1))`.'],
  }),
];
const t9: N[] = [
  prog('n9-1', {
    title: 'The difference of two vectors',
    goal: 'Read two vectors, one per line, like `<5, 7>` and `<2, 3>`. Print their difference (the first minus the second) in the same format:\n\n```\ndifference: <3, 4>\n```',
    checks: ['<5, 7> - <2, 3> :: in <5, 7>\\n<2, 3>; expect difference: <3, 4>', '<1, 1> - <4, -2> :: in <1, 1>\\n<4, -2>; expect difference: <-3, 3>', '<0, 0> - <0, 0> :: in <0, 0>\\n<0, 0>; expect difference: <0, 0>', '<10, -3> - <-5, 2> :: in <10, -3>\\n<-5, 2>; expect difference: <15, -5>'],
  }),
  prog('n9-2', {
    title: 'Are the two vectors parallel?',
    goal: 'Read two vectors, one per line, like `<1, 2>` and `<2, 4>`. Two vectors are parallel when x1 × y2 − y1 × x2 = 0. Print `parallel` or `not parallel`.',
    checks: ['<1, 2> and <2, 4> :: in <1, 2>\\n<2, 4>; expect parallel; not not parallel', '<1, 2> and <2, 3> :: in <1, 2>\\n<2, 3>; expect not parallel', '<3, -6> and <-1, 2> :: in <3, -6>\\n<-1, 2>; expect parallel; not not parallel', '<1, 0> and <0, 1> :: in <1, 0>\\n<0, 1>; expect not parallel'],
  }),
  prog('n9-3', {
    title: 'Add two complex numbers',
    goal: 'Read two complex numbers, one per line, in the Lecture 5 format (`1 + 2i`, `3 - 5i`). Add the real parts together and the imaginary parts together. Print the sum in the same format:\n\n- `1 + 2i` and `3 + 4i` → `sum: 4 + 6i`\n- `1 + 2i` and `3 - 5i` → `sum: 4 - 3i`\n\nWhen the imaginary part of the sum is negative, print ` - ` and the number without its minus sign.',
    checks: ['1 + 2i and 3 + 4i :: in 1 + 2i\\n3 + 4i; expect sum: 4 + 6i', '1 + 2i and 3 - 5i :: in 1 + 2i\\n3 - 5i; expect sum: 4 - 3i', 'The sum is 0 :: in -2 - 1i\\n2 + 1i; expect sum: 0 + 0i', 'Decimals :: in 1.5 + 0.5i\\n1 - 2i; expect sum: 2.5 - 1.5i'],
  }),
  prog('n9-4', {
    title: 'The modulus of a complex number',
    goal: 'Read a complex number in the Lecture 5 format, like `3 + 4i`. Its modulus is √(a² + b²), the same as the modulus of the vector <a, b>. Print `modulus: ` and the modulus.',
    checks: ['3 + 4i :: in 3 + 4i; expect modulus: 5', '-6 - 8i :: in -6 - 8i; expect modulus: 10', '1 + 1i :: in 1 + 1i; expect modulus: 1.41421', '0 - 2i :: in 0 - 2i; expect modulus: 2', 'Uses sqrt :: code /sqrt\\s*\\(/ Use sqrt from cmath.'],
  }),
  prog('n9-5', {
    title: 'Is it a three-dimensional vector?',
    goal: 'Read a line. It is a three-dimensional vector when it starts with `<`, ends with `>`, and between them has exactly two commas, with something before, between and after them. Print `correct format` or `wrong format`.\n\n- `<1, 2, 3>` → `correct format`\n- `<1, 2>` → `wrong format`\n- `<1,,3>` → `wrong format`',
    checks: ['<1, 2, 3> :: in <1, 2, 3>; expect correct format', 'Only two numbers :: in <1, 2>; expect wrong format', 'No brackets :: in 1, 2, 3; expect wrong format', 'Nothing between the commas :: in <1,,3>; expect wrong format', 'Negative numbers :: in <-1, 0, 7>; expect correct format', 'No > at the end :: in <1, 2, 3; expect wrong format', 'Four numbers :: in <1, 2, 3, 4>; expect wrong format'],
  }),
];

/* ===================================================================== 10 · Sets of numbers and statistics */
const t10: N[] = [
  prog('n10-1', {
    title: 'The range of four numbers',
    goal: 'Read four numbers (they can have decimals). The range is the largest minus the smallest. Use `max` and `min` (from `algorithm`): `max(max(a, b), max(c, d))` is the largest of four. Print `range: ` and the range.',
    checks: ['3 9 1 7 :: in 3 9 1 7; expect range: 8', '-5 0 5 10 :: in -5 0 5 10; expect range: 15', 'All the same :: in 4 4 4 4; expect range: 0', 'Decimals :: in 2.5 1.5 3 0.5; expect range: 2.5', 'Uses max :: code /max\\s*\\(/ Use max from algorithm.', 'Uses min :: code /min\\s*\\(/ Use min from algorithm.'],
  }),
  prog('n10-2', {
    title: 'Average of the best three marks',
    goal: 'Read four marks (decimal numbers). Drop the lowest mark and print the average of the other three:\n\n```\naverage of the best three: 80\n```\n\n(for `70 80 90 60`).',
    checks: ['70 80 90 60 :: in 70 80 90 60; expect average of the best three: 80', 'All the same :: in 50 50 50 50; expect average of the best three: 50', 'The lowest is second :: in 100 0 90 80; expect average of the best three: 90', 'The lowest is first :: in 65 72 81 90; expect average of the best three: 81', 'A decimal average :: in 55 60 61 40; expect average of the best three: 58.6667'],
  }),
  prog('n10-3', {
    title: 'Coursework and exam',
    goal: 'Read a coursework mark and an exam mark (decimal numbers, out of 100). The final mark is 40% of the coursework plus 60% of the exam. Print `final mark: ` and the final mark, then `pass` if it is 50 or more, otherwise `fail`.',
    checks: ['80 and 60 :: in 80 60; expect final mark: 68; expect pass; not fail', '40 and 50 :: in 40 50; expect final mark: 46; expect fail; not pass', 'Exactly 50 :: in 50 50; expect final mark: 50; expect pass; not fail', '100 and 0 :: in 100 0; expect final mark: 40; expect fail; not pass', 'Decimals :: in 45.5 70; expect final mark: 60.2; expect pass; not fail'],
  }),
  prog('n10-4', {
    title: 'Closest to the average',
    goal: 'Read three numbers. Print their average, then the number closest to it:\n\n```\naverage: 5\nclosest to the average: 4\n```\n\n(for `2 4 9`: the distances are 3, 1 and 4). The distance is the difference without its minus sign: if it is negative, multiply it by -1. If two numbers are equally close, print the first one.',
    checks: ['2 4 9 :: in 2 4 9; expect average: 5; expect closest to the average: 4', '10 20 60 :: in 10 20 60; expect average: 30; expect closest to the average: 20', '1 2 3 :: in 1 2 3; expect average: 2; expect closest to the average: 2', 'All the same :: in 5 5 5; expect average: 5; expect closest to the average: 5', '0 1 8 :: in 0 1 8; expect average: 3; expect closest to the average: 1'],
  }),
  prog('n10-5', {
    title: 'The standard deviation of four numbers',
    goal: 'Programs 5 and 6, for four numbers. Read four numbers. Print the average, then the standard deviation: the square root of the average of the squared differences from the average.\n\n```\nthe average is: 4\nthe standard deviation is: 1.41421\n```\n\n(for `2 4 4 6`).',
    checks: ['2 4 4 6 :: in 2 4 4 6; expect the average is: 4; expect the standard deviation is: 1.41421', 'All the same :: in 1 1 1 1; expect the average is: 1; expect the standard deviation is: 0', '1 2 3 4 :: in 1 2 3 4; expect the average is: 2.5; expect the standard deviation is: 1.11803', '10 20 30 40 :: in 10 20 30 40; expect the average is: 25; expect the standard deviation is: 11.1803', 'Uses sqrt :: code /sqrt\\s*\\(/ Use sqrt from cmath.'],
  }),
];

/* ===================================================================== 5 · the Wk9 sheet's True/False questions */
const TF = (cond: string) => `if (${cond}) { cout << "True"; } else { cout << "False"; }`;
const TF_ASK = 'What is the value of the condition (True/False)? Here the `{ … }` of the sheet prints `True` or `False`: type what it prints.';
const t5sheet: N[] = [
  out('s-w9-q3a', 'Wk9 sheet', `**Wk9 sheet, question 3 a):** ${TF_ASK}`, `int age = 25;\nint score = 85;\n${TF('age >= 18 && score > 80')}`),
  out('s-w9-q3b', 'Wk9 sheet', `**Wk9 sheet, question 3 b):** ${TF_ASK} (\`&&\` is worked out before \`||\`.)`, `bool isAdmin = true;\nbool hasPassword = false;\nbool isGuest = false;\n${TF('isAdmin || hasPassword && isGuest')}`),
  out('s-w9-q3c1', 'Wk9 sheet', `**Wk9 sheet, question 3 c), the first if:** ${TF_ASK} (\`!x\` is worked out first.)`, `int x = 5;\n${TF('!x == 0')}`),
  out('s-w9-q3c2', 'Wk9 sheet', `**Wk9 sheet, question 3 c), the second if:** ${TF_ASK}`, `int x = 5;\n${TF('!(x == 0)')}`),
  out('s-w9-q3c3', 'Wk9 sheet', `**Wk9 sheet, question 3 c), the third if:** ${TF_ASK}`, `int x = 5;\n${TF('x != 0')}`),
];

/* ===================================================================== 11 · From flowchart and pseudocode to code */
const WATCH = 'Press ▶ to watch it run (or step one shape at a time), then type its code in the next exercise.';
const GRADES20 = '60 59 70 10 90 100 0 61 45 80 75 30 66 59.5 99 20 60 1 85 50';
const t11sheet: N[] = [
  flow('s-l6-e1', 'Lecture 6, Example 1: the flowchart', `Feet to centimetres. ${WATCH}`, ['float Lft = 0, Lcm = 0', 'Input Lft', 'Lcm = Lft * 30', 'Output "The length in cm is ", Lcm'], '5'),
  prog('s-l6-e1', {
    tag: 'Lecture 6',
    title: 'Example 1: feet to centimetres',
    goal: '**Lecture 6, Example 1:** Draw a flowchart to convert the length in feet to centimeter (1 foot = 30 cm). Write its corresponding code in C++.\n\nThe flowchart is above. Type its code, like the lecture: ask `Enter the length in feet: `, read the length (it can have decimals), and print `The length in cm is ` and the length in centimetres.',
    checks: ['5 feet :: in 5; expect The length in cm is 150', '2.5 feet :: in 2.5; expect The length in cm is 75', '0 feet :: in 0; expect The length in cm is 0', '1.2 feet :: in 1.2; expect The length in cm is 36'],
  }),
  flow('s-l6-e2', 'Lecture 6, Example 2: the flowchart', `The area of a rectangle. ${WATCH}`, ['float Width = 0, Length = 0, Area = 0', 'Input Width, Length', 'Area = Length * Width', 'Output "The area is ", Area'], '3 4'),
  prog('s-l6-e2', {
    tag: 'Lecture 6',
    title: 'Example 2: the area of a rectangle',
    goal: '**Lecture 6, Example 2:** Draw a flowchart that will read the two sides of a rectangle and calculate its area. Write its corresponding code in C++.\n\nAsk `Enter the width and length of rectangle: `, read the two sides and print `The area is ` and the area.',
    checks: ['3 and 4 :: in 3 4; expect The area is 12', '2.5 and 4 :: in 2.5 4; expect The area is 10', '7 and 7 :: in 7 7; expect The area is 49'],
  }),
  flow('s-l6-e3', 'Lecture 6, Example 3: the flowchart', `Single selection: one diamond, and nothing happens on No. ${WATCH}`, ['int Grade = 0', 'Input Grade', { if: 'Grade >= 60', yes: ['Output "Passed"'] }], '75'),
  prog('s-l6-e3', {
    tag: 'Lecture 6',
    title: 'Example 3: passed (single selection)',
    goal: '**Lecture 6, Example 3 (single selection):** Draw a flowchart that read a student grade and write "passed" if it is greater than or equal 60.\n\nAsk `Enter the grade: `, read a whole number and print `Passed` only when the grade is 60 or more.',
    checks: ['75 :: in 75; expect Passed', '60 is enough :: in 60; expect Passed', '59 prints nothing :: in 59; not Passed', 'Uses if :: code /if\\s*\\(/ Use an if.'],
  }),
  flow('s-l6-e4', 'Lecture 6, Example 4: the flowchart', `Double selection: Yes and No each do something. ${WATCH}`, ['float m1 = 0, m2 = 0, m3 = 0, m4 = 0, finalGrade = 0', 'Input m1, m2, m3, m4', 'finalGrade = (m1 + m2 + m3 + m4) / 4', { if: 'finalGrade >= 60', yes: ['Output "Passed"'], no: ['Output "Failed"'] }], '70 80 90 60'),
  prog('s-l6-e4', {
    tag: 'Lecture 6',
    title: 'Example 4: passed or failed (double selection)',
    goal: "**Lecture 6, Example 4 (double selection):** Draw a flowchart to determine a student's final grade and indicate whether it is passing or failing. The final grade is calculated as the average of four marks.\n\nLike the lecture's answer: ask `Enter the 4 marks: `, read four marks (decimals allowed); the final grade is their average; print `Passed` if it is 60 or more, otherwise `Failed`.",
    checks: ['Average 75 :: in 70 80 90 60; expect Passed; not Failed', 'Average 57.5 :: in 50 50 60 70; expect Failed; not Passed', 'Average exactly 60 :: in 60 60 60 60; expect Passed; not Failed', 'Average 50 :: in 100 0 100 0; expect Failed; not Passed', 'Uses else :: code /else/ Use if … else.'],
  }),
  flow('s-l6-e5', 'Lecture 6, Example 5: the flowchart', `Multiple selection: the diamonds are tested in order, and only one Output runs. ${WATCH}`, ['float Grade = 0', 'Input Grade', { if: 'Grade >= 90', yes: ['Output "A"'], no: [{ if: 'Grade >= 80', yes: ['Output "B"'], no: [{ if: 'Grade >= 70', yes: ['Output "C"'], no: [{ if: 'Grade >= 60', yes: ['Output "D"'], no: ['Output "F"'] }] }] }] }], '85'),
  prog('s-l6-e5', {
    tag: 'Lecture 6',
    title: 'Example 5: the letter grade (multiple selection)',
    goal: '**Lecture 6, Example 5 (multiple selection):** Reads a student grade and write the following: A for exam grades greater than or equal to 90, B for grades greater than or equal to 80, C for grades greater than or equal to 70, D for grades greater than or equal to 60, and F for all other grades.\n\nAsk `Enter the student grade: ` (decimals allowed) and print `Grade: ` and the letter.',
    checks: ['95 :: in 95; expect Grade: A', 'Exactly 90 :: in 90; expect Grade: A', '85 :: in 85; expect Grade: B', '75 :: in 75; expect Grade: C', '65 :: in 65; expect Grade: D', '59.5 :: in 59.5; expect Grade: F', '30 :: in 30; expect Grade: F', 'Uses else if :: code /else\\s+if/ Use if … else if … else.'],
  }),
  flow('s-l6-e6', 'Lecture 6, Example 6: the flowchart', `A loop: k starts at 1, the diamond tests k <= 4, and k = k + 1 goes back up. ${WATCH}`, ['int k = 1', { while: 'k <= 4', body: ['Output "Hello world"', 'k = k + 1'] }, 'Output "That\'s all!"']),
  prog('s-l6-e6', {
    tag: 'Lecture 6',
    title: 'Example 6: Hello world four times',
    goal: '**Lecture 6, Example 6:** Draw a flowchart that print the word "Hello" four times then print "That\'s all!"\n\nThe lecture\'s 3 steps: solve it for one case, find the statements to repeat, then add the 3 expressions around them (start `k = 1`, test `k <= 4`, update `k = k + 1`). Print exactly:\n\n```\nHello world\nHello world\nHello world\nHello world\nThat\'s all!\n```',
    checks: ["Four times, then That's all! :: exact Hello world\\nHello world\\nHello world\\nHello world\\nThat's all!\\n", A_LOOP],
  }),
  flow('s-l6-e7', 'Lecture 6, Example 7: the flowchart', `A loop that reads 20 grades, with a decision inside it. ${WATCH}`, ['int k = 1', 'float Grade = 0', { while: 'k <= 20', body: ['Input Grade', { if: 'Grade >= 60', yes: ['Output "Passed"'] }, 'k = k + 1'] }], GRADES20),
  prog('s-l6-e7', {
    tag: 'Lecture 6',
    title: 'Example 7: 20 grades',
    goal: '**Lecture 6, Example 7:** Reads 20 students\' grades, and write "passed" if a grade is greater than or equal 60.\n\nRead 20 grades (decimals allowed) in a loop. For each grade of 60 or more, print `Passed` on its own line. Print nothing else (no prompts).',
    checks: [`11 of 20 pass :: in ${GRADES20}; exact ${lines(11, 'Passed')}`, `All 20 pass :: in ${list(20, () => 100)}; exact ${lines(20, 'Passed')}`, `None pass :: in ${list(20, () => 0)}; not Passed`, A_LOOP],
  }),
  flow('s-l6-e8', 'Lecture 6, Example 8: the flowchart', `The same loop, but the user decides how many grades: k <= StudNo. ${WATCH}`, ['int StudNo = 0, k = 1', 'float Grade = 0', 'Input StudNo', { while: 'k <= StudNo', body: ['Input Grade', { if: 'Grade >= 60', yes: ['Output "Passed"'] }, 'k = k + 1'] }], '3 70 50 90'),
  prog('s-l6-e8', {
    tag: 'Lecture 6',
    title: 'Example 8: the user decides how many',
    goal: '**Lecture 6, Example 8:** Repeat Example 7, but let the user determine the number of students to read.\n\nFirst read the number of students, then that many grades. For each grade of 60 or more, print `Passed` on its own line. Print nothing else.',
    checks: ['3 students, 2 pass :: in 3 70 50 90; exact Passed\\nPassed\\n', '1 student, 59 :: in 1 59; not Passed', '5 students, all 60 :: in 5 60 60 60 60 60; exact Passed\\nPassed\\nPassed\\nPassed\\nPassed\\n', 'No students :: in 0; not Passed', A_LOOP],
  }),
  flow('s-l6-e9', 'Lecture 6, Example 9: the flowchart', `What changes each time is k; the value printed is M = 2 * k. ${WATCH}`, ['int k = 1, M = 0', 'Output "Table 2"', { while: 'k <= 12', body: ['M = 2 * k', 'Output M', 'k = k + 1'] }]),
  prog('s-l6-e9', {
    tag: 'Lecture 6',
    title: 'Example 9: table 2',
    goal: '**Lecture 6, Example 9:** Print Table 2 of multiplication, from 2x1 to 2x12.\n\nLike the pseudocode: print `Table 2`, then `M = 2 * k` for k from 1 to 12, one value per line:\n\n```\nTable 2\n2\n4\n…\n24\n```',
    checks: [`Table 2 :: exact Table 2\\n${list(12, (i) => 2 * (i + 1), '\\n')}\\n`, A_LOOP, 'Calculates 2 * k :: nocode /24/ Let the loop calculate the values: do not type them.'],
  }),
  flow('s-l6-e10', 'Lecture 6, Example 10: the flowchart', `An accumulator: sum starts at 0 and grows by each number. ${WATCH}`, ['int sum = 0, k = 1, Num = 0', { while: 'k <= 10', body: ['Input Num', 'sum = sum + Num', 'k = k + 1'] }, 'Output "sum = ", sum'], '1 2 3 4 5 6 7 8 9 10'),
  prog('s-l6-e10', {
    tag: 'Lecture 6',
    title: 'Example 10: the sum of 10 numbers',
    goal: '**Lecture 6, Example 10:** Read 10 numbers and find their summations.\n\nUse an accumulator variable `sum` that starts at 0. Print `sum = ` and the sum.',
    checks: ['1 to 10 :: in 1 2 3 4 5 6 7 8 9 10; expect sum = 55', 'Ten zeros :: in 0 0 0 0 0 0 0 0 0 0; expect sum = 0', 'With negatives :: in 5 -5 10 -10 1 2 3 4 5 6; expect sum = 21', A_LOOP],
  }),
];
const t11: N[] = [
  prog('n11-1', {
    title: 'Pseudocode to code: a discount',
    goal: 'Type the C++ code of this pseudocode (a price over 100 gets 10% off):\n\n```\nInput price\nif price > 100 then\n    price = price * 0.9\nPrint "to pay: ", price\n```\n\nThe price can have decimals.',
    checks: ['200 :: in 200; expect to pay: 180', 'Exactly 100: no discount :: in 100; expect to pay: 100', '50 :: in 50; expect to pay: 50', '150.5 :: in 150.5; expect to pay: 135.45'],
  }),
  flow('n11-2', 'Flowchart: cold, warm or hot', `Two diamonds: the second one is tested only when the first says No. ${WATCH}`, ['float t = 0', 'Input t', { if: 't < 15', yes: ['Output "cold"'], no: [{ if: 't < 25', yes: ['Output "warm"'], no: ['Output "hot"'] }] }], '20'),
  prog('n11-2', {
    title: 'Flowchart to code: cold, warm or hot',
    goal: 'Type the code of the flowchart above: read a temperature (it can have decimals) and print `cold` (below 15), `warm` (15 up to below 25) or `hot` (25 or more).',
    checks: ['10 :: in 10; expect cold', '15 is warm :: in 15; expect warm', '24.9 :: in 24.9; expect warm', '25 is hot :: in 25; expect hot', '30 :: in 30; expect hot'],
  }),
  prog('n11-3', {
    title: 'Pseudocode to code: squares',
    goal: 'Type the C++ code of this pseudocode:\n\n```\nRead n\nInitialize k = 1\nWhile k <= n\n    Print k * k\n    k = k + 1\nEnd while\n```\n\nPrint one value per line, and nothing else.',
    checks: ['n = 5 :: in 5; exact 1\\n4\\n9\\n16\\n25\\n', 'n = 1 :: in 1; exact 1\\n', 'n = 3 :: in 3; exact 1\\n4\\n9\\n', 'Uses while :: code /while\\s*\\(/ The pseudocode says While: use a while loop.'],
  }),
  flow('n11-4', 'Flowchart: count the negative numbers', `A counter inside a loop: count = count + 1 runs only on the Yes arrow. ${WATCH}`, ['int n = 0, k = 1, num = 0, count = 0', 'Input n', { while: 'k <= n', body: ['Input num', { if: 'num < 0', yes: ['count = count + 1'] }, 'k = k + 1'] }, 'Output "negatives: ", count'], '4 3 -1 -7 2'),
  prog('n11-4', {
    title: 'Flowchart to code: count the negative numbers',
    goal: 'Type the code of the flowchart above: read how many numbers, then the numbers (whole numbers). Print `negatives: ` and how many of them are below 0.',
    checks: ['5 numbers, 3 negative :: in 5 1 -2 3 -4 -5; expect negatives: 3', 'No negatives :: in 3 1 2 3; expect negatives: 0', 'One number :: in 1 -7; expect negatives: 1', 'No numbers :: in 0; expect negatives: 0', A_LOOP],
  }),
  flow('n11-5', 'Flowchart: the times table of n', `k goes from 1 to 10; each time, one line of the table. ${WATCH}`, ['int n = 0, k = 1', 'Input n', { while: 'k <= 10', body: ['Output n, " x ", k, " = ", n * k', 'k = k + 1'] }], '3'),
  prog('n11-5', {
    title: 'Flowchart to code: the times table of n',
    goal: 'Type the code of the flowchart above: read a whole number n and print its times table from 1 to 10, one line each:\n\n```\n3 x 1 = 3\n3 x 2 = 6\n…\n3 x 10 = 30\n```',
    checks: [`Table of 3 :: in 3; exact ${list(10, (i) => `3 x ${i + 1} = ${3 * (i + 1)}`, '\\n')}\\n`, `Table of 7 :: in 7; exact ${list(10, (i) => `7 x ${i + 1} = ${7 * (i + 1)}`, '\\n')}\\n`, `Table of 1 :: in 1; exact ${list(10, (i) => `1 x ${i + 1} = ${i + 1}`, '\\n')}\\n`, A_LOOP],
  }),
];

/* ===================================================================== 12 · while loops (Wk9 sheet) */
const FIFTY = list(50, (i) => i + 1);
/** Wk9 Programs 9–15: the sheet's words, then the details; Wk10 asks for them again with for */
const WK9: { p: number; title: string; sheet: string; how: string; checks: string[]; hints?: string[] }[] = [
  { p: 9, title: 'the numbers divisible by 5', sheet: 'Print the numbers that are divisible by 5, for the integers from 1 to 99.', how: 'One number per line: `5`, `10`, … `95`. A number is divisible by 5 when `n % 5 == 0`.',
    checks: [`5 to 95 :: exact ${list(19, (i) => 5 * (i + 1), '\\n')}\\n`, 'Lets the loop find them :: nocode /95/ Let the loop find the numbers: do not type them.'] },
  { p: 10, title: 'the sum and average of 50 integers', sheet: 'Ask the user for 50 integers. The program should then print the sum of the integers, and their average.', how: 'Print `sum: ` and `average: ` on two lines. Careful: `sum / 50` with two whole numbers drops the decimals; use `sum / 50.0`.',
    checks: [`1 to 50 :: in ${FIFTY}; expect sum: 1275; expect average: 25.5`, `Fifty 2s :: in ${list(50, () => 2)}; expect sum: 100; expect average: 2`, `-1 and 1, 25 times :: in ${list(50, (i) => (i % 2 ? 1 : -1))}; expect sum: 0; expect average: 0`] },
  { p: 11, title: 'the average of a set of values', sheet: 'Calculate the average value of set values. The user is asked first to enter the number of these values. Then the user is asked to enter these values, one by one. Finally, the program will print the average value.', how: 'The values can have decimals. Print `average: ` and the average.',
    checks: ['4 values :: in 4 10 20 30 40; expect average: 25', '3 values :: in 3 1 2 2; expect average: 1.66667', '1 value :: in 1 7; expect average: 7', 'Decimals :: in 2 2.5 3.5; expect average: 3'] },
  { p: 12, title: 'is N a prime?', sheet: 'Read a positive integer N and determine whether N is a prime.', how: 'A prime has exactly two divisors: 1 and itself (so 1 is not a prime). Try every divisor from 2 up to N − 1. Print `prime` or `not prime`.',
    checks: ['7 :: in 7; expect prime; not not prime', '9 :: in 9; expect not prime', '2 :: in 2; expect prime; not not prime', '15 :: in 15; expect not prime', '1 is not a prime :: in 1; expect not prime', '97 :: in 97; expect prime; not not prime'] },
  { p: 13, title: 'x to the power y, without cmath', sheet: 'Calculate the power of the two numbers x and y. This program does not use the `cmath` library.', how: 'Read x (it can have decimals) and y (a whole number, 0 or more). Start from 1 and multiply by x, y times. Print `2 to the power 3 is 8`.',
    checks: ['2 and 3 :: in 2 3; expect 2 to the power 3 is 8', 'Power 0 :: in 5 0; expect 5 to the power 0 is 1', '3 and 4 :: in 3 4; expect 3 to the power 4 is 81', 'Decimals :: in 1.5 2; expect 1.5 to the power 2 is 2.25', 'Negative x :: in -2 3; expect -2 to the power 3 is -8', 'No cmath :: nocode /pow\\s*\\(|cmath/ Do not use pow or cmath: multiply in a loop.'] },
  { p: 14, title: 'the alphabet in capital letters', sheet: 'Print to the user the English alphabet in capital letters.', how: "Print `ABCDEFGHIJKLMNOPQRSTUVWXYZ` on one line. Let a `char` go from `'A'` to `'Z'`: `c++` moves it to the next letter.",
    checks: ['A to Z :: exact ABCDEFGHIJKLMNOPQRSTUVWXYZ\\n', 'The loop makes the letters :: nocode /ABCDEF/ Let the loop make the letters: do not type the alphabet.'] },
  { p: 15, title: 'count the capital letters', sheet: 'Get from the user a string, then the program calculates the number of capital letters in this string.', how: "Read the whole line with `getline`. A capital letter is from `'A'` to `'Z'`. Print `capital letters: ` and the count.",
    checks: ['Hello World :: in Hello World; expect capital letters: 2', 'ABC def GHI :: in ABC def GHI; expect capital letters: 6', 'None :: in no capitals; expect capital letters: 0', 'With symbols :: in C++ Is FUN!; expect capital letters: 5'] },
];
const t12sheet: N[] = [
  ...WK9.map((q) => prog(`s-w9-p${q.p}`, { tag: 'Wk9 sheet', title: `Program ${q.p}: ${q.title}`, goal: `**Wk9 sheet, Program ${q.p} (using while loop):** ${q.sheet}\n\n${q.how}`, checks: [...q.checks, ...WHILE], hints: q.hints })),
  out('s-w9-q2', 'Wk9 sheet', '**Wk9 sheet, question 2:** Trace the following snippet of code and show the output (when n = 10). Type exactly what it prints.', 'int n, var;\n\ncin >> n; // Enter n = 10\nvar = 0;\n\nwhile (var < n)\n{\n    cout << var;\n    var = var * 3 + 2;\n}', '10'),
];
const t12: N[] = [
  prog('n12-1', {
    title: 'Count down',
    goal: 'Read a whole number n (1 or more). With a while loop, print n, n − 1, … down to 1, one per line, then `Go!`:\n\n```\n3\n2\n1\nGo!\n```',
    checks: ['From 3 :: in 3; exact 3\\n2\\n1\\nGo!\\n', 'From 1 :: in 1; exact 1\\nGo!\\n', 'From 5 :: in 5; exact 5\\n4\\n3\\n2\\n1\\nGo!\\n', 'Uses while :: code /while\\s*\\(/ Use a while loop.'],
  }),
  prog('n12-2', {
    title: 'The sum of the digits',
    goal: 'Read a positive whole number. Add up its digits with a while loop: `n % 10` is the last digit and `n / 10` removes it. Print `sum of digits: ` and the sum (for `12345` it is 15).',
    checks: ['12345 :: in 12345; expect sum of digits: 15', 'One digit :: in 7; expect sum of digits: 7', '1000 :: in 1000; expect sum of digits: 1', '99999 :: in 99999; expect sum of digits: 45', 'Uses while :: code /while\\s*\\(/ Use a while loop.'],
  }),
  prog('n12-3', {
    title: 'Add until 0',
    goal: 'Read whole numbers until the user enters `0`. Print `sum: ` and the sum of the numbers, then `count: ` and how many numbers were entered (not counting the 0).\n\n```\nsum: 10\ncount: 3\n```\n\n(for `5 3 2 0`).',
    checks: ['5 3 2 0 :: in 5 3 2 0; expect sum: 10; expect count: 3', 'Only 0 :: in 0; expect sum: 0; expect count: 0', 'With a negative :: in -4 4 10 0; expect sum: 10; expect count: 3', 'Uses while :: code /while\\s*\\(/ Use a while loop: you do not know how many numbers will come.'],
  }),
  prog('n12-4', {
    title: 'How many years to double the money?',
    goal: 'Read an amount of money and a yearly rate in percent (decimal numbers). Each year the money is multiplied by `1 + rate / 100`. With a while loop, count the years until the money is at least double the start. Print `years: ` and the count.',
    checks: ['1000 at 10% :: in 1000 10; expect years: 8', '500 at 100% :: in 500 100; expect years: 1', '100 at 7% :: in 100 7; expect years: 11', '200 at 50% :: in 200 50; expect years: 2', 'Uses while :: code /while\\s*\\(/ Use a while loop: you do not know how many years.'],
  }),
  prog('n12-5', {
    title: 'Reverse a number',
    goal: 'Read a positive whole number and build the number with its digits in reverse order: `reversed = reversed * 10 + n % 10`, then `n = n / 10`, while n is more than 0. Print `reversed: ` and the number (`1234` → `4321`, `1200` → `21`).',
    checks: ['1234 :: in 1234; expect reversed: 4321', 'One digit :: in 5; expect reversed: 5', 'Zeros at the end :: in 1200; expect reversed: 21', '90817 :: in 90817; expect reversed: 71809', 'Uses while :: code /while\\s*\\(/ Use a while loop.'],
  }),
];

/* ===================================================================== 13 · for loops (Wk10 sheet, Lecture 8) */
const ERRORS_NOTE = 'Find the error(s) in the following code segments and then correct them. (Note that: All these statements should print the word "hello" 5 times)';
const broken = (code: string) => `#include <iostream>\nusing namespace std;\n\nint main() {\n${code}\n    return 0;\n}\n`;
const HELLO5 = ['Prints hello 5 times :: exact hellohellohellohellohello'];
const t13sheet: N[] = [
  prog('s-w10-p16', {
    tag: 'Wk10 sheet',
    title: 'Program 16: reverse a text',
    goal: '**Wk10 sheet, Program 16 (using for loop):** Get from the user a text. Then, it reverses the order of characters inside the text (hold the reversed text in a variable to print it at the end).\n\nRead the whole line with `getline`. Build the reversed text in a `string` variable, then print it: `hello` → `olleh`.',
    checks: ['hello :: in hello; expect olleh', 'With spaces :: in C++ is fun; expect nuf si ++C', 'One letter :: in a; expect a', 'Two words :: in Mona Salem; expect melaS anoM', ...FOR],
  }),
  prog('s-w10-p17', {
    tag: 'Wk10 sheet',
    title: 'Program 17: invert the case',
    goal: '**Wk10 sheet, Program 17 (using for loop):** Get from the user a text. Then the program inverses the case of every letter in the text. If it is a capital letter, then inverse it to a small letter, and the reverse. Anything else will be kept as it is, then finally print the inversed text.\n\nUse the character codes (Lecture 4): a capital letter + 32 is its small letter, and a small letter − 32 is its capital.',
    checks: ['Hello World :: in Hello World; expect hELLO wORLD', 'Symbols stay :: in C++ Is FUN!; expect c++ iS fun!', 'Digits stay :: in abc123; expect ABC123', 'ZzZ :: in ZzZ; expect zZz', ...FOR, 'Character codes :: nocode /toupper|tolower/ Use the character codes (+ 32 and - 32), not toupper or tolower.'],
  }),
  ...WK9.map((q) => prog(`s-w10-r${q.p}`, { tag: 'Wk10 sheet', title: `Program ${q.p} again, with for: ${q.title}`, goal: `**Wk10 sheet:** Repeat the programs (9-15) using for loop instead of while. **Program ${q.p}:** ${q.sheet}\n\n${q.how}`, checks: [...q.checks, ...FOR], hints: q.hints })),
  ...([['a1', 'i', '1, 2, 3, 4, 5, 6, 7'], ['a2', 'ii', '3, 8, 13, 18, 23'], ['a3', 'iii', '20, 14, 8, 2, -4, -10'], ['a4', 'iv', '19, 27, 35, 43, 51']] as const).map(([id, n, seq]) => prog(`s-w10-${id}`, {
    tag: 'Wk10 sheet',
    title: `Sequence ${n}: ${seq}`,
    goal: `**Wk10 sheet, 2 a. ${n}:** Write for statements that print the following sequences of values: ${seq}.\n\nPrint them on one line with \`, \` between them (no comma after the last one, no full stop): \`${seq}\`. Find the start, the end and the step of the loop.`,
    checks: [`${seq} :: exact ${seq}\\n`, 'Uses for :: code /for\\s*\\(/ Use a for statement.'],
    hints: ['To put `, ` only between the values: print the value, then `if` it is not the last one, print `, `.'],
  })),
  ...([['b1', 'i', '    for i = 0; i < 5; i++\n        cout << "hello" ;'], ['b2', 'ii', '    for ( i = 0; i < 5; i++ ) ;\n        cout << "hello"'], ['b3', 'iii', '    for ( i = 0, i > 5; i++ )\n        cout << "hello" ;'], ['b4', 'iv', '    for ( i = 0; i <= 5; i++ )\n        cout << "hello" ;']] as const).map(([id, n, code]) => prog(`s-w10-${id}`, {
    tag: 'Wk10 sheet',
    title: `Find the errors ${n}`,
    goal: `**Wk10 sheet, 2 b. ${n}:** ${ERRORS_NOTE}\n\nThe code with the error(s) is in the editor. Correct it so it prints \`hellohellohellohellohello\` (keep \`cout << "hello" ;\` as it is). Press **Run** first: the messages help you find the errors.`,
    checks: HELLO5,
    starter: broken(code),
    hints: ['A variable must be declared before it is used: `int i` (before the loop, or inside the for: `for (int i = 0; …)`).'],
  })),
  out('s-w10-c', 'Wk10 sheet', '**Wk10 sheet, 2 c:** Trace the following code by showing the memory and output screen.\n\nType exactly what the output screen shows: it is all on one line, because there is no `\\n`.', 'int n = 10;\nint i, j;\n\nfor (i = 1, j = 0; i <= n; i++)\n{\n    j += i;\n    cout << "i = " << i << ", j = " << j;\n}'),
  prog('s-l8-e2', {
    tag: 'Lecture 8',
    title: 'Example 2: the sum from 1 to 100',
    goal: '**Lecture 8, Example 2:** Write the C++ code that gets the sum of numbers from 1 to 100.\n\nUse a for loop and a `sum` that starts at 0 ("Must be 0 to avoid garbage value"). Print `The sum is ` and the sum.',
    checks: ['1 to 100 :: expect The sum is 5050', 'Uses for :: code /for\\s*\\(/ Use a for loop.', 'The loop calculates :: nocode /5050/ Let the loop calculate the sum: do not type it.'],
  }),
  prog('s-l8-vary', {
    tag: 'Lecture 8',
    title: 'Varying the control variable',
    goal: '**Lecture 8, varying control variables:** Write three for statements: vary the control variable from 7 to 77 in steps of 7; from 20 to 2 in steps of -2; over the sequence of values 2, 5, 8, 11, 14, 17. Print each sequence on its own line, with a space after each value.',
    checks: ['7 to 77, steps of 7 :: expect 7 14 21 28 35 42 49 56 63 70 77', '20 to 2, steps of -2 :: expect 20 18 16 14 12 10 8 6 4 2', '2 to 17, steps of 3 :: expect 2 5 8 11 14 17', 'Three for statements :: code /for[\\s\\S]*for[\\s\\S]*for/ Use three for statements, one for each sequence.'],
  }),
  prog('s-l8-e3', {
    tag: 'Lecture 8',
    title: 'Example 3: the sum of the even numbers',
    goal: '**Lecture 8, Example 3:** Get the sum of even numbers from 1 to 100.\n\nStart at 2 and go up in steps of 2 (`i += 2`). Print `The sum is ` and the sum.',
    checks: ['2 + 4 + … + 100 :: expect The sum is 2550', 'Uses for :: code /for\\s*\\(/ Use a for loop.', 'The loop calculates :: nocode /2550/ Let the loop calculate the sum: do not type it.'],
  }),
  prog('s-l8-e4', {
    tag: 'Lecture 8',
    title: 'Example 4: sum only the even numbers',
    goal: '**Lecture 8, Example 4:** Ask the user to enter 10 numbers, and sum only the even numbers.\n\nA number is even when `number % 2 == 0`. Print `The sum is ` and the sum.',
    checks: ['1 to 10 :: in 1 2 3 4 5 6 7 8 9 10; expect The sum is 30', 'All odd :: in 1 3 5 7 9 11 13 15 17 19; expect The sum is 0', 'Negative and 0 :: in -2 -4 6 0 1 1 1 1 1 8; expect The sum is 8', 'Uses for :: code /for\\s*\\(/ Use a for loop.'],
  }),
  out('s-l8-stars', 'Lecture 8', '**Lecture 8:** What is the output?', 'int count;\n\nfor ( count = 0 ; count < 10 ; count++ )\n{\n    cout << "*" ;\n}'),
  out('s-l8-null', 'Lecture 8', '**Lecture 8:** What output from this loop? Look closely at the end of the `for` line.', 'int count;\n\nfor ( count = 0 ; count < 10 ; count++ );\n{\n    cout << "*" ;\n}'),
  out('s-l8-trace', 'Lecture 8', '**Lecture 8, trace:** Trace `sum` and `i`. What does it print? (There is no space after `is`.)', 'int sum = 0;\nint i;\nfor (i = 1; i <= 3 ; i++)\n{\n    sum = sum + i;\n}\ncout<<"The sum is"<< sum;'),
  prog('s-l8-e5', {
    tag: 'Lecture 8',
    title: 'Example 5: how many times a letter occurs',
    goal: "**Lecture 8, Example 5:** Write a C++ program that gets from the user a sentence s, and a letter c. The program prints out the number of the occurrence of the letter c in the sentence s.\n\nRead the sentence with `getline`, then the letter with `cin`. Print like the lecture: `The letter 'a' occurred: 3 times.`",
    checks: ["banana, a :: in banana\\na; expect The letter 'a' occurred: 3 times.", "hello world, l :: in hello world\\nl; expect The letter 'l' occurred: 3 times.", "C++ is cool, o :: in C++ is cool\\no; expect The letter 'o' occurred: 2 times.", "Not there :: in xyz\\na; expect The letter 'a' occurred: 0 times.", 'Uses for :: code /for\\s*\\(/ Go through the sentence with a for loop.'],
  }),
];
const t13: N[] = [
  prog('n13-1', {
    title: 'Factorial',
    goal: 'Read a whole number n from 0 to 12. Its factorial n! is 1 × 2 × … × n (and 0! is 1). Calculate it with a for loop and print `5! = 120`.',
    checks: ['5 :: in 5; expect 5! = 120', '0 :: in 0; expect 0! = 1', '1 :: in 1; expect 1! = 1', '10 :: in 10; expect 10! = 3628800', '12 :: in 12; expect 12! = 479001600', 'Uses for :: code /for\\s*\\(/ Use a for loop.'],
  }),
  prog('n13-2', {
    title: 'Count the vowels',
    goal: 'Read a line of text with `getline`. Count its vowels: `a`, `e`, `i`, `o`, `u`, small or capital. Print `vowels: ` and the count.',
    checks: ['Hello World :: in Hello World; expect vowels: 3', 'Capitals count too :: in AEIOU aeiou; expect vowels: 10', 'No vowels :: in rhythm; expect vowels: 0', 'C++ Is Fun :: in C++ Is Fun; expect vowels: 2', 'Uses for :: code /for\\s*\\(/ Go through the text with a for loop.'],
  }),
  prog('n13-3', {
    title: 'Is it a palindrome?',
    goal: 'Read one word. It is a palindrome when it reads the same backwards (`level`). Compare the first letter with the last, the second with the one before the last, and so on. Print `palindrome` or `not a palindrome`.',
    checks: ['racecar :: in racecar; expect palindrome; not not a', 'level :: in level; expect palindrome; not not a', 'hello :: in hello; expect not a palindrome', 'One letter :: in a; expect palindrome; not not a', 'ab :: in ab; expect not a palindrome', 'abba :: in abba; expect palindrome; not not a', 'Uses for :: code /for\\s*\\(/ Use a for loop.'],
  }),
  prog('n13-4', {
    title: 'Sum, average and largest of n numbers',
    goal: 'Read how many numbers (1 or more), then the numbers (they can have decimals). Print three lines:\n\n```\nsum: 20\naverage: 5\nlargest: 9\n```\n\n(for `4 3 9 1 7`). Careful with the largest: the numbers can all be negative, so start from the first number, not from 0.',
    checks: ['4 numbers :: in 4 3 9 1 7; expect sum: 20; expect average: 5; expect largest: 9', 'One number :: in 1 -5; expect sum: -5; expect average: -5; expect largest: -5', 'Decimals :: in 3 2.5 2.5 1; expect sum: 6; expect average: 2; expect largest: 2.5', 'All negative :: in 5 -1 -2 -3 -4 -5; expect sum: -15; expect average: -3; expect largest: -1', 'Uses for :: code /for\\s*\\(/ Use a for loop.'],
  }),
  prog('n13-5', {
    title: 'The Fibonacci numbers',
    goal: 'Read a whole number n (1 or more). Print the first n Fibonacci numbers on one line with `, ` between them. They start `0, 1`, and each next one is the sum of the two before it: `0, 1, 1, 2, 3, 5, 8`.',
    checks: ['n = 1 :: in 1; exact 0\\n', 'n = 2 :: in 2; exact 0, 1\\n', 'n = 7 :: in 7; exact 0, 1, 1, 2, 3, 5, 8\\n', 'n = 10 :: in 10; exact 0, 1, 1, 2, 3, 5, 8, 13, 21, 34\\n', 'Uses for :: code /for\\s*\\(/ Use a for loop.'],
  }),
];

/* ===================================================================== 14 · do..while, break, continue */
const t14sheet: N[] = [
  prog('s-l8-e1', {
    tag: 'Lecture 8',
    title: 'The password (do..while)',
    goal: '**Lecture 8, Example 1 (and Lecture 6, Example 11):** Let the user enter a password, if it is equal to "123", you welcome him. Otherwise, let him try to enter a new one. Write the C++ code using do..while statement.\n\nEach time, print `Enter the password: ` and read the password with `getline`. When it is `123`, print `Welcome!`. The body of a do..while runs at least once.',
    checks: ['123 at once :: in 123; expect Welcome!', 'Two wrong, then 123 :: in abc\\n999\\n123; expect Enter the password: Enter the password: Enter the password: Welcome!', 'Uses do..while :: code /do\\s*\\{/ Use a do..while loop.'],
  }),
  prog('s-l6-try', {
    tag: 'Lecture 6',
    title: 'The password: count the wrong tries',
    goal: '**Lecture 6, try to solve:** Same example, but you need to count how many times he entered his password wrong.\n\nAfter `Welcome!`, print `wrong tries: ` and the number of wrong passwords.',
    checks: ['Right at once :: in 123; expect Welcome!; expect wrong tries: 0', 'Two wrong :: in abc\\n999\\n123; expect Welcome!; expect wrong tries: 2', 'Four wrong :: in a\\nb\\nc\\nd\\n123; expect wrong tries: 4', 'Uses do..while :: code /do\\s*\\{/ Use a do..while loop.'],
  }),
  prog('s-l8-break', {
    tag: 'Lecture 8',
    title: 'break: leave the loop early',
    goal: '**Lecture 8, break example:** A for loop counts `i` from 1 to 10. When `i` is 7, it prints `Found 7! Breaking out of the loop early.` and leaves the loop with `break`. Otherwise it prints `Checking number: ` and `i`. After the loop it prints `The loop has ended.`',
    checks: [`The whole output :: exact ${list(6, (i) => `Checking number: ${i + 1}`, '\\n')}\\nFound 7! Breaking out of the loop early.\\nThe loop has ended.\\n`, 'Uses break :: code /break\\s*;/ Leave the loop with break;'],
  }),
  prog('s-l8-continue', {
    tag: 'Lecture 8',
    title: 'continue: skip one turn',
    goal: '**Lecture 8, continue example:** A for loop counts `i` from 1 to 10. When `i` is 7, it prints `Found 7! Skipping this number.` and jumps to the next turn with `continue`. Otherwise it prints `Processing number: ` and `i`. After the loop it prints `The loop has ended naturally.`',
    checks: [`The whole output :: exact ${list(6, (i) => `Processing number: ${i + 1}`, '\\n')}\\nFound 7! Skipping this number.\\n${list(3, (i) => `Processing number: ${i + 8}`, '\\n')}\\nThe loop has ended naturally.\\n`, 'Uses continue :: code /continue\\s*;/ Skip the rest of the turn with continue;'],
  }),
];
const t14: N[] = [
  prog('n14-1', {
    title: 'A number from 1 to 10',
    goal: 'Ask `Enter a number from 1 to 10: ` and read a whole number. With a do..while loop, ask again while the number is below 1 or above 10. Then print `you chose ` and the number.',
    checks: ['7 at once :: in 7; expect you chose 7', 'Three wrong first :: in 0 11 -3 5; expect you chose 5; not you chose 0', '10 is allowed :: in 10; expect you chose 10', 'Uses do..while :: code /do\\s*\\{/ Use a do..while loop.'],
  }),
  prog('n14-2', {
    title: 'Stop at the first negative',
    goal: 'Read up to 10 whole numbers with a for loop. Stop at the first negative number (`break`): it is not added. Print `sum: ` and the sum of the numbers before it.',
    checks: ['Stops at -1 :: in 1 2 3 -1; expect sum: 6', 'No negative :: in 5 5 5 5 5 5 5 5 5 5; expect sum: 50', 'Negative first :: in -4; expect sum: 0', 'Not added after it :: in 10 20 -5 30; expect sum: 30', 'Uses break :: code /break\\s*;/ Leave the loop with break;'],
  }),
  prog('n14-3', {
    title: 'Skip the multiples of 3',
    goal: 'Read a whole number n. Print the numbers from 1 to n, one per line, but skip the multiples of 3 with `continue`.',
    checks: ['n = 10 :: in 10; exact 1\\n2\\n4\\n5\\n7\\n8\\n10\\n', 'n = 3 :: in 3; exact 1\\n2\\n', 'n = 1 :: in 1; exact 1\\n', 'Uses continue :: code /continue\\s*;/ Skip with continue;'],
  }),
  prog('n14-4', {
    title: 'The first digit in a text',
    goal: "Read a line with `getline`. Find its first digit (`'0'` to `'9'`) with a for loop, and stop looking with `break`. Print `first digit: 7 at position 4`, or `no digit` if there is none.",
    checks: ['abc 7 and 9 :: in abc 7 and 9; expect first digit: 7 at position 4', 'No digit :: in no digits here; expect no digit', 'At the start :: in 2024 is here; expect first digit: 2 at position 0', 'At the end :: in x1; expect first digit: 1 at position 1', 'Uses break :: code /break\\s*;/ Stop the loop with break when you find it.'],
  }),
  prog('n14-5', {
    title: 'Guess the number',
    goal: 'The secret number is 7. With a do..while loop, read guesses until the guess is 7. After a wrong guess print `too low` or `too high`. At the end print `correct! tries: ` and the number of guesses.\n\n```\ntoo low\ntoo high\ncorrect! tries: 3\n```\n\n(for `3 9 7`).',
    checks: ['3, 9, 7 :: in 3 9 7; exact too low\\ntoo high\\ncorrect! tries: 3\\n', 'Right at once :: in 7; exact correct! tries: 1\\n', 'Seven tries :: in 1 2 3 4 5 6 7; exact too low\\ntoo low\\ntoo low\\ntoo low\\ntoo low\\ntoo low\\ncorrect! tries: 7\\n', 'Too high twice :: in 10 8 7; exact too high\\ntoo high\\ncorrect! tries: 3\\n', 'Uses do..while :: code /do\\s*\\{/ Use a do..while loop.'],
  }),
];

/* ===================================================================== 15 · Nested loops (Lecture 9) */
const NESTED = 'int i, j;\ncout << " i j\\n";\nfor (i = 1; i < 3; ++i) {\n    cout << "Outer\\t" << i << "\\n";\n    for (j = 0; j < i; ++j) {\n        cout << " Inner\\t\\t" << j << "\\n";\n    } /* end of inner loop */\n} /* end of outer loop */';
const TWO_LOOPS = 'Two loops, one inside the other :: code /for[\\s\\S]*for/ Use a loop inside a loop.';
const t15sheet: N[] = [
  prog('s-l9-e1', {
    tag: 'Lecture 9',
    title: 'Example 1: the sum of the first n natural numbers',
    goal: '**Lecture 9, Example 1:** Find the sum of first n Natural Numbers (positive integers such as 1, 2, 3, … n are known as natural numbers).\n\nAsk `Enter a positive integer: `, read `num`, add 1 to num with a for loop, and print `Sum = ` and the sum.',
    checks: ['10 :: in 10; expect Sum = 55', '1 :: in 1; expect Sum = 1', '100 :: in 100; expect Sum = 5050', '30 :: in 30; expect Sum = 465', 'Uses for :: code /for\\s*\\(/ Use a for loop.'],
  }),
  val('s-l9-t1', 'Lecture 9', '**Lecture 9, trace:** How many times is the **outer** loop executed?', NESTED, ['2', '2 times']),
  val('s-l9-t2', 'Lecture 9', '**Lecture 9, trace:** How many times is the **inner** loop executed, in all?', NESTED, ['3', '3 times']),
  val('s-l9-t3', 'Lecture 9', '**Lecture 9, trace:** What is the value of `i` after the outer loop terminates?', NESTED, ['3', 'i = 3', 'i=3']),
  prog('s-l9-e2', {
    tag: 'Lecture 9',
    title: "Example 2: Floyd's triangle",
    goal: "**Lecture 9, Example 2:** Write a C++ program that prints a dynamic sequential number triangle known as Floyd's Triangle for a given number of rows.\n\nRead the number of rows. Row 1 has 1 number, row 2 has 2 numbers, and so on, and the numbers keep counting up. Like the lecture, print each number followed by a space, and end each row with `endl`:\n\n```\n1\n2 3\n4 5 6\n```\n\n(for 3 rows).",
    checks: ['5 rows :: in 5; expect 1 \\n2 3 \\n4 5 6 \\n7 8 9 10 \\n11 12 13 14 15', '3 rows :: in 3; expect 1 \\n2 3 \\n4 5 6', '1 row :: in 1; expect 1; not 2', TWO_LOOPS],
  }),
  prog('s-l9-e3', {
    tag: 'Lecture 9',
    title: 'Example 3: a pyramid of stars',
    goal: '**Lecture 9, Example 3:** Write a C++ program using nested loops that prompts the user for a number of rows (or uses a fixed value of 5) and prints a centered pyramid pattern made of asterisks (*).\n\nRead the number of rows. Row i has `rows - i` spaces, then `2 * i - 1` stars:\n\n```\n  *\n ***\n*****\n```\n\n(for 3 rows).',
    checks: ['3 rows :: in 3; expect  *\\n ***\\n*****', '5 rows :: in 5; expect *\\n   ***\\n  *****\\n *******\\n*********', '1 row :: in 1; expect *; not **', TWO_LOOPS],
  }),
];
const t15: N[] = [
  prog('n15-1', {
    title: 'A rectangle of stars',
    goal: 'Read the number of rows and of columns. Print a rectangle of `*`: each row has one `*` for each column.\n\n```\n*****\n*****\n*****\n```\n\n(for `3 5`). Print nothing else.',
    checks: ['3 rows, 5 columns :: in 3 5; exact *****\\n*****\\n*****\\n', '1 by 1 :: in 1 1; exact *\\n', '2 rows, 4 columns :: in 2 4; exact ****\\n****\\n', TWO_LOOPS],
  }),
  prog('n15-2', {
    title: 'A right triangle of stars',
    goal: 'Read a whole number n. Print n rows: row 1 has one `*`, row 2 has two, and so on.\n\n```\n*\n**\n***\n****\n```\n\n(for 4). Print nothing else.',
    checks: ['n = 4 :: in 4; exact *\\n**\\n***\\n****\\n', 'n = 1 :: in 1; exact *\\n', 'n = 6 :: in 6; exact *\\n**\\n***\\n****\\n*****\\n******\\n', TWO_LOOPS],
  }),
  prog('n15-3', {
    title: 'The multiplication table, 1 to n',
    goal: 'Read a whole number n. Print an n × n table: the value in row i and column j is `i * j`. Print each value followed by a tab (`\\t`), and end each row with `endl`:\n\n```\n1\t2\t3\n2\t4\t6\n3\t6\t9\n```\n\n(for 3).',
    checks: ['n = 3 :: in 3; exact 1\\t2\\t3\\t\\n2\\t4\\t6\\t\\n3\\t6\\t9\\t\\n', 'n = 1 :: in 1; exact 1\\t\\n', `n = 5 :: in 5; exact ${list(5, (i) => list(5, (j) => `${(i + 1) * (j + 1)}\\t`, ''), '\\n')}\\n`, TWO_LOOPS],
  }),
  prog('n15-4', {
    title: 'A count-down triangle',
    goal: 'Read a whole number n. Row 1 counts down from n to 1, row 2 from n − 1 to 1, and so on, with one space between the numbers:\n\n```\n4 3 2 1\n3 2 1\n2 1\n1\n```\n\n(for 4). Print nothing else.',
    checks: ['n = 4 :: in 4; exact 4 3 2 1\\n3 2 1\\n2 1\\n1\\n', 'n = 1 :: in 1; exact 1\\n', 'n = 3 :: in 3; exact 3 2 1\\n2 1\\n1\\n', TWO_LOOPS],
  }),
  prog('n15-5', {
    title: 'The prime numbers up to n',
    goal: 'Read a whole number n. Print every prime number from 2 to n, one per line: an outer loop goes through the numbers, an inner loop tries their divisors. If there is none, print `no primes`.',
    checks: ['Up to 10 :: in 10; exact 2\\n3\\n5\\n7\\n', 'Up to 2 :: in 2; exact 2\\n', 'Up to 30 :: in 30; exact 2\\n3\\n5\\n7\\n11\\n13\\n17\\n19\\n23\\n29\\n', 'None :: in 1; exact no primes\\n', TWO_LOOPS],
  }),
];

/** lab-sheet and lecture questions that were not in Labs 1–3 yet, by topic */
export const SHEET_QUESTIONS: Partial<Record<Topic, N[]>> = { t4: t4sheet, t5: t5sheet, t9: t9sheet, t11: t11sheet, t12: t12sheet, t13: t13sheet, t14: t14sheet, t15: t15sheet };
/** the new questions, by topic (5 or more each) */
export const NEW_QUESTIONS: Partial<Record<Topic, N[]>> = { t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15 };

/* ===================================================================== Mixed concepts (easy → hard) */
export const MIXED: N[] = [
  prog('m-1', {
    title: 'The electricity bill',
    goal: 'Read the kWh used (a whole number). The first 100 kWh cost 0.5 each, the next 100 cost 0.75 each, and every kWh above 200 costs 1.2. If the bill is more than 200, add 10% tax. Print `bill: ` and the amount.\n\n- `150` → `bill: 87.5` (100 × 0.5 + 50 × 0.75)\n- `400` → `bill: 401.5` (365, then + 10%)',
    checks: ['80 :: in 80; expect bill: 40', '150 :: in 150; expect bill: 87.5', 'Exactly 200 :: in 200; expect bill: 125', '250 :: in 250; expect bill: 185', '300 (with tax) :: in 300; expect bill: 269.5', '400 (with tax) :: in 400; expect bill: 401.5'],
  }),
  prog('m-2', {
    title: 'The shopping bill',
    goal: 'Read how many items, then for each item its price (a decimal number) and its quantity (a whole number). Print `total: ` and the total. If the total is more than 500, print `discount: ` (10% of the total) and `to pay: ` (the total minus the discount); otherwise print only `to pay: ` and the total.',
    checks: ['350 :: in 2 100 2 50 3; expect total: 350; expect to pay: 350; not discount', '600 :: in 3 200 2 150 1 10 5; expect total: 600; expect discount: 60; expect to pay: 540', 'Exactly 500 :: in 1 500 1; expect total: 500; expect to pay: 500; not discount', 'Decimals :: in 2 12.5 4 99.99 10; expect total: 1049.9; expect discount: 104.99; expect to pay: 944.91', A_LOOP],
  }),
  prog('m-3', {
    title: 'Even and odd',
    goal: 'Read how many numbers, then the numbers (whole numbers). Print three lines: `even: ` and how many are even, `odd: ` and how many are odd, then `sum of the even numbers: ` and their sum.',
    checks: ['1 2 3 4 6 :: in 5 1 2 3 4 6; expect even: 3; expect odd: 2; expect sum of the even numbers: 12', 'All odd :: in 3 1 3 5; expect even: 0; expect odd: 3; expect sum of the even numbers: 0', 'Negative and 0 :: in 4 -2 -3 0 7; expect even: 2; expect odd: 2; expect sum of the even numbers: -2', A_LOOP],
  }),
  prog('m-4', {
    title: 'A Celsius to Fahrenheit table',
    goal: 'Read a start and an end (whole numbers, the start is not bigger than the end). Print the header `C`, a tab, `F`. Then one row for every 10 degrees from the start up to the end: C, a tab, and F = 1.8 × C + 32.\n\n```\nC\tF\n0\t32\n10\t50\n20\t68\n30\t86\n```\n\n(for `0 30`). Print nothing else.',
    checks: ['0 to 30 :: in 0 30; exact C\\tF\\n0\\t32\\n10\\t50\\n20\\t68\\n30\\t86\\n', '-10 to 10 :: in -10 10; exact C\\tF\\n-10\\t14\\n0\\t32\\n10\\t50\\n', '25 to 40 :: in 25 40; exact C\\tF\\n25\\t77\\n35\\t95\\n', A_LOOP],
  }),
  prog('m-5', {
    title: 'Count each kind of character',
    goal: 'Read a line with `getline`. Count its letters (small and capital), digits, spaces, and all other characters. Print four lines: `letters: `, `digits: `, `spaces: ` and `others: `, each with its count.',
    checks: ['Hello World 2026! :: in Hello World 2026!; expect letters: 10; expect digits: 4; expect spaces: 2; expect others: 1', 'abc :: in abc; expect letters: 3; expect digits: 0; expect spaces: 0; expect others: 0', '1 + 1 = 2 :: in 1 + 1 = 2; expect letters: 0; expect digits: 3; expect spaces: 4; expect others: 2', A_LOOP],
  }),
  prog('m-6', {
    title: 'Mark the answers',
    goal: 'Read the answer key (one word of letters, like `ABCDA`) and then the student\'s answers (a word of the same length). Print `score: ` and the score out of the number of questions (`score: 4/5`). Then print `wrong: ` and the numbers of the wrong questions (the first question is 1), with a space between them, or `wrong: none`.',
    checks: ['One wrong :: in ABCDA ABCDB; expect score: 4/5; expect wrong: 5', 'All right :: in AAAA AAAA; expect score: 4/4; expect wrong: none', 'All wrong :: in ABCD DCBA; expect score: 0/4; expect wrong: 1 2 3 4', 'Two wrong :: in ABCABC ABCCBA; expect score: 4/6; expect wrong: 4 6', A_LOOP],
  }),
  prog('m-7', {
    title: 'A word as a staircase',
    goal: 'Read one word. Print its beginnings, one per line, from one letter to the whole word:\n\n```\nC\nCo\nCod\nCode\n```\n\n(for `Code`). Use a loop and `substr`. Print nothing else.',
    checks: ['Code :: in Code; exact C\\nCo\\nCod\\nCode\\n', 'One letter :: in a; exact a\\n', 'hello :: in hello; exact h\\nhe\\nhel\\nhell\\nhello\\n', 'Uses substr :: code /substr\\s*\\(/ Take the beginnings with substr.', A_LOOP],
  }),
  prog('m-8', {
    title: 'Digits as words',
    goal: 'Read a whole number (0 or more). Print each of its digits as a word, with a space between the words: `405` → `four zero five`. `to_string` turns the number into text, so you can go through its digits.',
    checks: ['405 :: in 405; expect four zero five', '0 :: in 0; expect zero', 'Every digit :: in 1234567890; expect one two three four five six seven eight nine zero', '99 :: in 99; expect nine nine', A_LOOP],
  }),
  prog('m-9', {
    title: 'Is it a valid email? (with a loop)',
    goal: 'Read an email (one word). It is valid when: it has exactly one `@` (count them with a loop); there is something before the `@`; and after the `@` there is a `.` with something before it and after it. Print `valid` or `not valid`.\n\n- `mona@uni.edu` → `valid`\n- `mona@@uni.edu` → `not valid`',
    checks: ['mona@uni.edu :: in mona@uni.edu; expect valid; not not valid', 'Two @ :: in mona@@uni.edu; expect not valid', 'Nothing before @ :: in @uni.edu; expect not valid', 'No dot :: in mona@uni; expect not valid', 'Nothing after the dot :: in mona@uni.; expect not valid', 'Dots in the name :: in mona.salem@uni.edu.eg; expect valid; not not valid', 'Nothing before the dot :: in mona@.edu; expect not valid', A_LOOP],
  }),
  prog('m-10', {
    title: 'Perfect numbers',
    goal: 'Read a whole number n (2 or more). Add up its divisors that are smaller than n. Print `sum of divisors: ` and the sum, then `perfect` if the sum is n, otherwise `not perfect`. (6 is perfect: 1 + 2 + 3 = 6.)',
    checks: ['6 :: in 6; expect sum of divisors: 6; expect perfect; not not perfect', '28 :: in 28; expect sum of divisors: 28; expect perfect; not not perfect', '12 :: in 12; expect sum of divisors: 16; expect not perfect', 'A prime :: in 7; expect sum of divisors: 1; expect not perfect', '496 :: in 496; expect sum of divisors: 496; expect perfect; not not perfect', A_LOOP],
  }),
  prog('m-11', {
    title: 'Binary to decimal',
    goal: "Read a binary number as text, like `1011`. If a character is not `0` or `1`, print `not binary`. Otherwise print `decimal: ` and its value: start from 0, and for each character, `value = value * 2 + (c - '0')`.",
    checks: ['1011 :: in 1011; expect decimal: 11', '0 :: in 0; expect decimal: 0', '11111111 :: in 11111111; expect decimal: 255', 'A 2 in it :: in 1021; expect not binary; not decimal', '100000 :: in 100000; expect decimal: 32', A_LOOP],
  }),
  prog('m-12', {
    title: 'Decimal to binary',
    goal: 'Read a whole number (0 or more). Print `binary: ` and the number in binary. Build the text from the right: `binary = to_string(n % 2) + binary;` then `n = n / 2;`, while n is more than 0. The binary of 0 is `0`.',
    checks: ['11 :: in 11; expect binary: 1011', '0 :: in 0; expect binary: 0', '255 :: in 255; expect binary: 11111111', '32 :: in 32; expect binary: 100000', '1 :: in 1; expect binary: 1', 'Uses to_string :: code /to_string\\s*\\(/ Build the text with to_string(n % 2).', A_LOOP],
  }),
  prog('m-13', {
    title: 'The Caesar code for a line',
    goal: 'Read a line of text with `getline`, then a shift k (0 to 25) with `cin`. Move every letter k places forward in the alphabet: small letters stay small and capitals stay capitals, and after `z` it starts again at `a`. Every other character stays as it is. Print the new line.\n\n- `Hello, World!` and `3` → `Khoor, Zruog!`',
    checks: ['Hello, World! by 3 :: in Hello, World!\\n3; expect Khoor, Zruog!', 'Wrapping around :: in xyz XYZ\\n2; expect zab ZAB', 'A shift of 0 :: in abc\\n0; expect abc', 'Capitals and digits :: in Zebra 9\\n1; expect Afcsb 9', A_LOOP],
  }),
  prog('m-14', {
    title: 'The longest word',
    goal: 'Read a line of words with one space between them. Print `words: ` and the number of words, then `longest: ` and the longest word (if several have the same length, the first one). Go through the line letter by letter and build the current word.',
    checks: ['I love C++ programming :: in I love C++ programming; expect words: 4; expect longest: programming', 'One word :: in one; expect words: 1; expect longest: one', 'All the same length :: in aa bb cc; expect words: 3; expect longest: aa', 'The first of the longest :: in the cat sat on a mat; expect words: 6; expect longest: the', A_LOOP],
  }),
  prog('m-15', {
    title: 'A list of vectors',
    goal: 'The first line is how many vectors there are; then one vector per line, like `<3, 4>`. Read **every** line with `getline` (turn the first one into a number with `stoi`). Print `sum: ` and the sum of all the vectors, then `longest: ` and the vector with the biggest modulus (the first one if two are as long):\n\n```\nsum: <3, 6>\nlongest: <3, 4>\n```\n\n(for `<1, 2>`, `<3, 4>`, `<-1, 0>`).',
    checks: ['Three vectors :: in 3\\n<1, 2>\\n<3, 4>\\n<-1, 0>; expect sum: <3, 6>; expect longest: <3, 4>', 'One vector :: in 1\\n<0, 0>; expect sum: <0, 0>; expect longest: <0, 0>', 'As long: the first :: in 2\\n<6, 8>\\n<-10, 0>; expect sum: <-4, 8>; expect longest: <6, 8>', 'Four vectors :: in 4\\n<-5, -5>\\n<1, 1>\\n<0, 9>\\n<2, -2>; expect sum: <-2, 3>; expect longest: <0, 9>', A_LOOP],
  }),
];

/* ===================================================================== The 10 challenges */
const EXACTLY = 'Print exactly these lines and nothing else (no prompts): the checks compare the whole output.';
export const CHALLENGES: N[] = [
  prog('ch-1', {
    title: 'Challenge 1: the class results',
    goal: `The first line is the number of students n. Then n lines, each with a name (one word) and three marks (decimals allowed). For each student print the name, \`: \`, the average and the letter grade (Lecture 6, Example 5: A from 90, B from 80, C from 70, D from 60, else F). Then print \`class average: \` (the average of the averages), \`best: \` and the name of the best average (the first one if there is a tie), and \`passed: \` and how many averages are 60 or more.\n\nInput:\n\n\`\`\`\n3\nMona 90 80 85\nOmar 50 60 40\nSara 95 100 90\n\`\`\`\n\nOutput:\n\n\`\`\`\nMona: 85 B\nOmar: 50 F\nSara: 95 A\nclass average: 76.6667\nbest: Sara\npassed: 2\n\`\`\`\n\n${EXACTLY}`,
    checks: ['Three students :: in 3\\nMona 90 80 85\\nOmar 50 60 40\\nSara 95 100 90; exact Mona: 85 B\\nOmar: 50 F\\nSara: 95 A\\nclass average: 76.6667\\nbest: Sara\\npassed: 2\\n', 'One student, exactly 60 :: in 1\\nAli 60 60 60; exact Ali: 60 D\\nclass average: 60\\nbest: Ali\\npassed: 1\\n', 'A tie for the best :: in 4\\nHana 70 75 80\\nKarim 100 90 95\\nNour 59 59 59.5\\nYara 95 90 100; exact Hana: 75 C\\nKarim: 95 A\\nNour: 59.1667 F\\nYara: 95 A\\nclass average: 81.0417\\nbest: Karim\\npassed: 3\\n'],
    hints: ['Keep the best average so far and its name in two variables; update both only when a new average is bigger (`>`, not `>=`, so the first one stays on a tie).'],
  }),
  prog('ch-2', {
    title: 'Challenge 2: a strong password, step by step',
    goal: `Read passwords (one word each) until one is strong. A strong password has at least 8 characters, a capital letter, a small letter, a digit, and a symbol (any other character, like \`!\` or \`#\`). For each weak one, print \`weak: \` and what is missing, in this order, with \`, \` between: \`8 characters\`, \`a capital letter\`, \`a small letter\`, \`a digit\`, \`a symbol\`. For the strong one print \`strong after 3 tries\` (\`strong after 1 try\` for one).\n\nInput \`abc\`, \`Abcdefg1\`, \`Abcdefg1!\` (one per line):\n\n\`\`\`\nweak: 8 characters, a capital letter, a digit, a symbol\nweak: a symbol\nstrong after 3 tries\n\`\`\`\n\n${EXACTLY}`,
    checks: ['Three tries :: in abc\\nAbcdefg1\\nAbcdefg1!; exact weak: 8 characters, a capital letter, a digit, a symbol\\nweak: a symbol\\nstrong after 3 tries\\n', 'Strong at once :: in P@ssw0rd; exact strong after 1 try\\n', 'Missing letters :: in password\\nPASSWORD1\\nPassw0rd#; exact weak: a capital letter, a digit, a symbol\\nweak: a small letter, a symbol\\nstrong after 3 tries\\n'],
    hints: ['Use four bool variables (capital, small, digit, symbol) set in a loop over the characters, then build the text of what is missing with `+`.'],
  }),
  prog('ch-3', {
    title: 'Challenge 3: squeeze the letters',
    goal: `Read one word (letters only). Write every run of the same letter as the letter and how many times it repeats: \`aaabccdddd\` → \`a3b1c2d4\`. Print the code, then \`shorter\`, \`longer\` or \`same length\`: the code compared with the word.\n\n\`\`\`\na3b1c2d4\nshorter\n\`\`\`\n\n${EXACTLY}`,
    checks: ['aaabccdddd :: in aaabccdddd; exact a3b1c2d4\\nshorter\\n', 'abc :: in abc; exact a1b1c1\\nlonger\\n', 'aabb :: in aabb; exact a2b2\\nsame length\\n', 'Twelve z :: in zzzzzzzzzzzz; exact z12\\nshorter\\n', 'Uses to_string :: code /to_string\\s*\\(/ Turn each count into text with to_string.'],
  }),
  prog('ch-4', {
    title: 'Challenge 4: everything about a number',
    goal: `Read a whole number n (1 or more). Print six lines: \`digits: \` (how many digits), \`sum of digits: \`, \`reversed: \` (the number with its digits in reverse order), \`palindrome: yes\` or \`no\` (it reads the same backwards), \`prime: yes\` or \`no\`, and \`divisors: \` (how many divisors it has, 1 and n included).\n\n\`\`\`\ndigits: 3\nsum of digits: 6\nreversed: 321\npalindrome: no\nprime: no\ndivisors: 4\n\`\`\`\n\n(for \`123\`: its divisors are 1, 3, 41 and 123). \`reversed\` of \`1000\` is \`1\`. ${EXACTLY}`,
    checks: ['123 :: in 123; exact digits: 3\\nsum of digits: 6\\nreversed: 321\\npalindrome: no\\nprime: no\\ndivisors: 4\\n', '121 :: in 121; exact digits: 3\\nsum of digits: 4\\nreversed: 121\\npalindrome: yes\\nprime: no\\ndivisors: 3\\n', '7 :: in 7; exact digits: 1\\nsum of digits: 7\\nreversed: 7\\npalindrome: yes\\nprime: yes\\ndivisors: 2\\n', '1 is not a prime :: in 1; exact digits: 1\\nsum of digits: 1\\nreversed: 1\\npalindrome: yes\\nprime: no\\ndivisors: 1\\n', '1000 :: in 1000; exact digits: 4\\nsum of digits: 1\\nreversed: 1\\npalindrome: no\\nprime: no\\ndivisors: 16\\n'],
    hints: ['`to_string(n)` gives the digits as text: its length, its characters and its reverse. A number is prime when it has exactly 2 divisors.'],
  }),
  prog('ch-5', {
    title: 'Challenge 5: a calculator that keeps going',
    goal: `Read lines with \`getline\` until a line is \`q\`. Each line is a number, a space, an operator, a space and a number, like \`3 + 4\` (the numbers can have decimals). Print \`= \` and the result. The operators are \`+\`, \`-\`, \`*\`, \`/\` and \`^\` (the power: the second number is a whole number, 0 or more; multiply in a loop, no cmath). For \`/\` by 0 print \`error: division by 0\`; for any other operator print \`error: unknown operator\`. At the end print \`operations: \` and how many lines had a result.\n\n\`\`\`\n3 + 4      → = 7\n10 / 4     → = 2.5\n2 ^ 10     → = 1024\n5 / 0      → error: division by 0\n7 % 2      → error: unknown operator\nq          → operations: 3\n\`\`\`\n\n${EXACTLY}`,
    checks: ['Five lines :: in 3 + 4\\n10 / 4\\n2 ^ 10\\n5 / 0\\n7 % 2\\nq; exact = 7\\n= 2.5\\n= 1024\\nerror: division by 0\\nerror: unknown operator\\noperations: 3\\n', 'Decimals and negatives :: in 1.5 * 4\\n-2 - 3\\nq; exact = 6\\n= -5\\noperations: 2\\n', 'Only q :: in q; exact operations: 0\\n', 'No cmath :: nocode /pow\\s*\\(/ Work out ^ with a loop, not pow.'],
  }),
  prog('ch-6', {
    title: 'Challenge 6: the next day',
    goal: `Read dates written as \`dd/mm/yyyy\` (one word each) until the word \`end\`. For each date, print \`invalid\` if it is not a real date: the month must be 1 to 12, and the day from 1 to the days of that month (30 for months 4, 6, 9 and 11; February has 28, or 29 in a leap year; the others 31). Otherwise print \`next day: \` and the date of the next day, with two digits for the day and the month.\n\n\`\`\`\n28/02/2024  → next day: 29/02/2024\n28/02/2023  → next day: 01/03/2023\n31/12/2026  → next day: 01/01/2027\n31/04/2026  → invalid\n\`\`\`\n\nA leap year is divisible by 4 but not by 100, or divisible by 400. ${EXACTLY}`,
    checks: ['Six dates :: in 28/02/2024\\n28/02/2023\\n31/12/2026\\n31/04/2026\\n15/13/2026\\n30/06/2026\\nend; exact next day: 29/02/2024\\nnext day: 01/03/2023\\nnext day: 01/01/2027\\ninvalid\\ninvalid\\nnext day: 01/07/2026\\n', 'Leap years :: in 29/02/2023\\n29/02/2000\\n09/09/1999\\nend; exact invalid\\nnext day: 01/03/2000\\nnext day: 10/09/1999\\n', 'Only end :: in end; not next day; not invalid'],
  }),
  prog('ch-7', {
    title: 'Challenge 7: a text report',
    goal: `Read a line of text with \`getline\` (words with one space between them). Print five lines: \`words: \`, \`letters: \`, \`vowels: \` (a, e, i, o, u, small or capital), \`sentences: \` (how many \`.\`, \`!\` and \`?\`), and \`title case: \` and the text with the first letter of every word in capitals (the other letters do not change).\n\n\`\`\`\nwords: 6\nletters: 18\nvowels: 6\nsentences: 2\ntitle case: The Cat Sat. Then It Ran!\n\`\`\`\n\n(for \`the cat sat. then it ran!\`). ${EXACTLY}`,
    checks: ['Two sentences :: in the cat sat. then it ran!; exact words: 6\\nletters: 18\\nvowels: 6\\nsentences: 2\\ntitle case: The Cat Sat. Then It Ran!\\n', 'hello world :: in hello world; exact words: 2\\nletters: 10\\nvowels: 3\\nsentences: 0\\ntitle case: Hello World\\n', 'Capitals and symbols :: in C++ is FUN?; exact words: 3\\nletters: 6\\nvowels: 2\\nsentences: 1\\ntitle case: C++ Is FUN?\\n'],
    hints: ['A word starts where a character is not a space and it is the first character or the one before it is a space.'],
  }),
  prog('ch-8', {
    title: 'Challenge 8: a complex number calculator',
    goal: `Read operations until a line is \`q\`. Each operation is three lines (read them with \`getline\`): a complex number, an operator (\`+\`, \`-\` or \`*\`), and a second complex number, in the Lecture 5 format (\`1 + 2i\`, \`3 - 5i\`). A number is in the right format when it has at least 6 characters, a space, then \`+\` or \`-\` after that space, and it ends with \`i\`. If one of the two is not, print \`not a complex number\`. Otherwise print \`= \` and the result in the same format, then \`modulus: \` and its modulus. To multiply: (a + bi)(c + di) = (ac − bd) + (ad + bc)i.\n\n\`\`\`\n1 + 2i, +, 3 - 5i  →  = 4 - 3i\n                       modulus: 5\n2 + 3i, *, 4 - 1i  →  = 11 + 10i\n                       modulus: 14.8661\n\`\`\`\n\n${EXACTLY}`,
    checks: ['Add, then multiply :: in 1 + 2i\\n+\\n3 - 5i\\n2 + 3i\\n*\\n4 - 1i\\nq; exact = 4 - 3i\\nmodulus: 5\\n= 11 + 10i\\nmodulus: 14.8661\\n', 'Not a complex number :: in 3 + 4\\n-\\n1 + 1i\\nq; exact not a complex number\\n', 'Zero, and i times i :: in 5 - 2i\\n-\\n5 - 2i\\n0 + 1i\\n*\\n0 + 1i\\nq; exact = 0 + 0i\\nmodulus: 0\\n= -1 + 0i\\nmodulus: 1\\n'],
    hints: ['Without functions of your own, you write the reading of a complex number twice: once for each number.'],
  }),
  prog('ch-9', {
    title: 'Challenge 9: a bank statement',
    goal: `The first input is the starting balance. Then transactions until the word \`end\`: \`d 200\` is a deposit of 200 and \`w 50\` a withdrawal of 50 (amounts can have decimals). For each one print a line with the type, a tab, the amount, a tab, and the new balance. A withdrawal bigger than the balance is refused: print \`refused\` instead of the balance, and the balance does not change. At the end print \`deposits: \` and \`withdrawals: \` (how many were done) and \`balance: \`.\n\n\`\`\`\nd\t200\t1200\nw\t50\t1150\nw\t5000\trefused\nd\t0.5\t1150.5\ndeposits: 2\nwithdrawals: 1\nbalance: 1150.5\n\`\`\`\n\n(starting from 1000). ${EXACTLY}`,
    checks: ['Four transactions :: in 1000\\nd 200\\nw 50\\nw 5000\\nd 0.5\\nend; exact d\\t200\\t1200\\nw\\t50\\t1150\\nw\\t5000\\trefused\\nd\\t0.5\\t1150.5\\ndeposits: 2\\nwithdrawals: 1\\nbalance: 1150.5\\n', 'An empty account :: in 0\\nw 1\\nend; exact w\\t1\\trefused\\ndeposits: 0\\nwithdrawals: 0\\nbalance: 0\\n', 'Down to 0 is allowed :: in 50\\nw 50\\nd 25\\nw 25\\nend; exact w\\t50\\t0\\nd\\t25\\t25\\nw\\t25\\t0\\ndeposits: 1\\nwithdrawals: 2\\nbalance: 0\\n'],
  }),
  prog('ch-10', {
    title: 'Challenge 10: guess the word',
    goal: `The first input is the secret word (small letters). Then one guessed letter per line. After each guess print the word with a space between the letters, showing the letters guessed so far and \`_\` for the others. A letter that is not in the word is a miss. Stop when every letter is shown (print \`you win (misses: 1)\`) or after 6 misses (print \`you lose: the word was cat\`).\n\nInput \`code\`, then \`e\`, \`x\`, \`c\`, \`o\`, \`d\`:\n\n\`\`\`\n_ _ _ e\n_ _ _ e\nc _ _ e\nc o _ e\nc o d e\nyou win (misses: 1)\n\`\`\`\n\nKeep the guessed letters in a \`string\` and use \`find\` to know if a letter was guessed. ${EXACTLY}`,
    checks: ['Win with 1 miss :: in code\\ne\\nx\\nc\\no\\nd; exact _ _ _ e\\n_ _ _ e\\nc _ _ e\\nc o _ e\\nc o d e\\nyou win (misses: 1)\\n', 'Six misses :: in cat\\nx\\ny\\nz\\nq\\nw\\nv; exact _ _ _\\n_ _ _\\n_ _ _\\n_ _ _\\n_ _ _\\n_ _ _\\nyou lose: the word was cat\\n', 'One guess shows two letters :: in aa\\na; exact a a\\nyou win (misses: 0)\\n', 'Win with 2 misses :: in sun\\ns\\nz\\nu\\nk\\nn; exact s _ _\\ns _ _\\ns u _\\ns u _\\ns u n\\nyou win (misses: 2)\\n'],
  }),
];
