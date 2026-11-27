/**
 * Intro to Computing · Lab 4 — the questions that are not copied from Labs 1–3: the lab-sheet and lecture questions
 * (their own words) and the new ones. Each program is checked by running it (`in …; expect …`); the reference
 * solutions live in tests/support/ultimate-solutions.ts. Only lecture content: no arrays, no functions of your own.
 */
type N = { id: string; type: string; data: Record<string, string> };
type Topic = 't1' | 't2' | 't3' | 't4' | 't5' | 't6' | 't7' | 't8' | 't9' | 't10' | 't11' | 't12' | 't13' | 't14' | 't15';

export const SKELETON = '#include <iostream>\nusing namespace std;\n\nint main() {\n\n    return 0;\n}\n';

/** a program to type (paste blocked), checked on several inputs */
export const prog = (id: string, d: { title: string; goal: string; checks: string[]; starter?: string; hints?: string[] }): N =>
  ({ id, type: 'cpp', data: { title: d.title, goal: d.goal, starter: d.starter ?? SKELETON, input: '', checks: d.checks.join('\n'), hints: (d.hints ?? []).join('\n'), paste: 'Blocked' } });

const answer = (id: string, mode: string, question: string, code: string, answers: string[] = [], input = ''): N =>
  ({ id, type: 'cppanswer', data: { question, code, input, mode, answers: answers.join('\n'), caps: 'Count', explain: '' } });
/** type exactly what the code prints (checked against the real output) */
export const out = (id: string, question: string, code: string, input = '') => answer(id, 'What it prints (the output)', question, code, [], input);
/** type a value (checked against the accepted forms) */
export const val = (id: string, question: string, code: string, answers: string[]) => answer(id, 'A value', question, code, answers);

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
    title: 'Program 10: the area of an isosceles triangle',
    goal: '**Lab sheet, Program 10:** Calculate the area of an isosceles triangle, where the user enters the base and one of the two equal angles of the triangle.\n\nAdded constraints (the sheet asks you to add them): the angle is in degrees. Use `const float pi = 3.14159;`. The height is `(base / 2) * tan(angle * pi / 180)` and the area is `base * height / 2`. `tan` comes from `cmath` and works in radians. Print `area: ` and the area.',
    checks: ['Base 10, angle 45 :: in 10 45; expect area: 25', 'Base 6, angle 60 :: in 6 60; expect area: 15.5884', 'Base 4, angle 30 :: in 4 30; expect area: 2.3094', 'Uses tan :: code /tan\\s*\\(/ The height needs tan( ) from cmath.'],
    hints: ['`#include <cmath>` gives you `tan`. Turn degrees into radians: `angle * pi / 180`.'],
  }),
  prog('s-p13', {
    title: 'Program 13: the area of a parallelogram (two sides)',
    goal: '**Lab sheet, Program 13:** Calculate the area of a parallelogram, where the user enters the lengths of the long and short sides of the parallelogram.\n\nAdded constraint: two sides are not enough — the user also enters the angle between them, in degrees. The area is `long * short * sin(angle * pi / 180)` with `const float pi = 3.14159;`. Print `area: ` and the area.',
    checks: ['8, 5 and 30 degrees :: in 8 5 30; expect area: 20', '10, 4 and 90 degrees :: in 10 4 90; expect area: 40', '6, 6 and 45 degrees :: in 6 6 45; expect area: 25.4558', 'Uses sin :: code /sin\\s*\\(/ The area needs sin( ) from cmath.'],
  }),
  prog('s-p14', {
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
    title: 'Program 26: is it a complex number?',
    goal: '**Lab sheet, Program 26:** Verify that a number entered by the user is a complex number.\n\nLecture 5 uses the format `a + bi` or `a - bi`: a number, a space, `+` or `-`, a space, then a number followed by `i` (the first number may have a minus sign). Read the whole line with `getline` (it has spaces). It is a complex number when:\n\n- there is something before the first space\n- after that space comes `+` or `-`, then a second space\n- the last part has more than one character and ends with `i`\n\nYou can assume that the numbers are numbers (Lecture 5). Print `complex number` or `not a complex number`.',
    checks: ['3 + 4i :: in 3 + 4i; expect complex number; not not a complex', '-2 - 5i :: in -2 - 5i; expect complex number; not not a complex', 'No i :: in 3 + 4; expect not a complex number', 'Not + or - :: in 3 * 4i; expect not a complex number', 'No spaces :: in 34i; expect not a complex number', 'No number before i :: in 3 + i; expect not a complex number', 'Decimals :: in 2.5 - 0.5i; expect complex number; not not a complex', 'Uses getline :: code /getline\\s*\\(\\s*cin/ Read the whole line with getline: it has spaces.'],
  }),
  prog('s-p27', {
    title: 'Program 27: the real and imaginary parts',
    goal: '**Lab sheet, Program 27:** Return the real and imaginary parts of a complex number entered by the user.\n\nThe user enters a complex number in the Lecture 5 format, like `3 + 4i` or `-2 - 5i` (the numbers can have decimals). Print:\n\n```\nreal part: 3\nimaginary part: 4\n```\n\nWith `-` in the middle the imaginary part is negative: `-2 - 5i` → `imaginary part: -5`. Use `stod` to turn the text into a number.',
    checks: ['3 + 4i :: in 3 + 4i; expect real part: 3; expect imaginary part: 4', '-2 - 5i :: in -2 - 5i; expect real part: -2; expect imaginary part: -5', 'Decimals :: in 1.5 - 0.5i; expect real part: 1.5; expect imaginary part: -0.5', 'Real part 0 :: in 0 + 7i; expect real part: 0; expect imaginary part: 7', 'Uses stod :: code /sto[dfi]\\s*\\(/ Turn the parts into numbers with stod.'],
  }),
  prog('s-p28', {
    title: 'Program 28: the complex conjugate',
    goal: '**Lab sheet, Program 28:** Generate the complex conjugate of a complex number entered by the user.\n\nThe conjugate of `a + bi` is `a - bi`, and the conjugate of `a - bi` is `a + bi`: only the sign in the middle changes. The user enters a number like `3 + 4i` (Lecture 5 format). Print:\n\n```\nconjugate: 3 - 4i\n```',
    checks: ['3 + 4i :: in 3 + 4i; expect conjugate: 3 - 4i', '-2 - 5i :: in -2 - 5i; expect conjugate: -2 + 5i', '0 + 1i :: in 0 + 1i; expect conjugate: 0 - 1i', 'Decimals :: in 1.5 - 2.5i; expect conjugate: 1.5 + 2.5i'],
  }),
  prog('s-p30', {
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

/** lab-sheet and lecture questions that were not in Labs 1–3 yet, by topic */
export const SHEET_QUESTIONS: Partial<Record<Topic, N[]>> = { t4: t4sheet, t9: t9sheet };
/** the new questions, by topic (5 or more each) */
export const NEW_QUESTIONS: Partial<Record<Topic, N[]>> = { t1, t2, t3, t4, t5, t6, t7, t8, t9, t10 };
export const MIXED: N[] = [];
export const CHALLENGES: N[] = [];
