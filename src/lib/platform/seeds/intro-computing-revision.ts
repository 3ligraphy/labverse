/**
 * Introduction to Computing (26CSCI01P, ICS prep year) — the Week 6 revision lab, before the Week 7 class test.
 * Lectures 1–5: program logic → C++, cout/cin/getline, types, operators, cmath/algorithm, ++, if/else (median),
 * characters/ASCII, strings (length, [ ], find, substr, npos), email & vector checks, and the Lecture 4 & 5 quiz.
 *
 * How it teaches (see the research notes in the PR): read before write (PRIMM: predict → run/step → investigate →
 * modify → make), the lecturer's program-logic steps as labels on every program, order-the-lines puzzles before
 * blank-page writing, a visible "machine" (memory boxes, keyboard buffer, console), short 5–10 minute segments
 * that each end in an action, hints that open one at a time, and no full solutions on the page.
 * Node ids are stable: progress is stored by them.
 */
import type { Flow } from '../core.ts';

type N = { id: string; type: string; data: Record<string, string> };

const chain = (nodes: N[]): Flow => ({
  nodes: nodes.map((n, i) => ({ id: n.id, type: n.type, x: 80 + (i % 2) * 40, y: 80 + i * 150, data: n.data })),
  edges: nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id })),
});
const part = (id: string, title: string, time: string): N => ({ id, type: 'part', data: { title, time } });
const task = (id: string, title: string, time: string, body: string): N => ({ id, type: 'task', data: { title, time, body } });
const text = (id: string, body: string): N => ({ id, type: 'text', data: { body } });
const callout = (id: string, tone: string, body: string): N => ({ id, type: 'callout', data: { tone, body } });
const visual = (id: string, visual: string, caption = '', start = ''): N => ({ id, type: 'cppvisual', data: { visual, caption, text: start } });
const predict = (id: string, question: string, code: string, options: string[], explain: string, input = '', trace = 'Yes'): N =>
  ({ id, type: 'cpppredict', data: { question, code, options: options.join('\n'), explain, input, trace } });
const cpp = (id: string, d: { title: string; goal: string; starter: string; checks: string[]; hints?: string[]; input?: string; paste?: 'Allowed' | 'Blocked' }): N =>
  ({ id, type: 'cpp', data: { title: d.title, goal: d.goal, starter: d.starter, checks: d.checks.join('\n'), hints: (d.hints ?? []).join('\n'), input: d.input ?? '', paste: d.paste ?? 'Allowed' } });
const parsons = (id: string, title: string, goal: string, code: string, input = ''): N => ({ id, type: 'parsons', data: { title, goal, code, input } });

/* ------------------------------------------------------------- programs */

export const PRODUCT_PROGRAM = String.raw`#include <iostream>
using namespace std;

int main() {

    int num1, num2, product;

    // say what you do
    cout << "Hello, I calculate the product of two numbers\n";

    // ask for input
    cout << "please enter two numbers: ";

    // read the input
    cin >> num1;
    cin >> num2;

    // do something with the input
    product = num1 * num2;

    // give the output
    cout << "the product is: " << product << "\n";

    // say goodbye
    cout << "Goodbye\n";

    return 0;
}
`;

const PRODUCT_LECTURE = String.raw`#include <iostream>
using namespace std;

int main() {
    int num1, num2, product;
    cout << "Hello, I calculate the product of two numbers\n";
    cout << "please enter two numbers: ";
    cin >> num1; cin >> num2;
    product = num1 * num2;
    cout << "the product is: "; cout << product; cout << "\n";
    cout << "Goodbye\n";
    return 0;
}
`;

const MAKE_SKELETON = (steps: string[]) => String.raw`#include <iostream>
using namespace std;

int main() {
` + steps.map((s) => `    // ${s}\n\n`).join('') + `    return 0;
}
`;

const UPPERCASE = String.raw`#include <iostream>
using namespace std;

int main() {
    char c;
    cout << "Hello, I convert lowercase to uppercase\n";
    cout << "please enter a lowercase character: ";
    cin >> c;
    cout << "The uppercase is: "; cout << (char)(c - 32); cout << "\n";
    return 0;
}
`;

const FOOTBALLER = String.raw`#include <iostream>
#include <string>
using namespace std;

int main() {
    string line, first, second;
    int sp_index;
    cout << "please enter a footballer's name,\n";
    cout << " and I will separate it into first and second name: ";
    getline(cin, line);
    sp_index = line.find(' ');
    first = line.substr(0, sp_index);
    second = line.substr(sp_index + 1);
    cout << "first name: "; cout << first; cout << "\n";
    cout << "second name: "; cout << second; cout << "\n";
    cout << "goodbye\n";
    return 0;
}
`;

const MEDIAN_NESTED = String.raw`#include <iostream>
using namespace std;

int main() {
    int num1, num2, num3;
    cout << "Please enter three numbers: ";
    cin >> num1; cin >> num2; cin >> num3;
    if (num1 < num2) {
        if (num3 > num2) { cout << "median is: " << num2 << "\n"; }
        else if (num3 < num1) { cout << "median is: " << num1 << "\n"; }
        else { cout << "median is: " << num3 << "\n"; }
    } else {
        if (num3 > num1) { cout << "median is: " << num1 << "\n"; }
        else if (num3 < num2) { cout << "median is: " << num2 << "\n"; }
        else { cout << "median is: " << num3 << "\n"; }
    }
    return 0;
}
`;

const MEDIAN_SIX = String.raw`#include <iostream>
using namespace std;

int main() {
    int num1, num2, num3;
    cout << "hello, I find the median of three numbers\n";
    cin >> num1; cin >> num2; cin >> num3;
    if (num1 < num2 and num2 < num3) { cout << "median is: " << num2 << "\n"; }
    if (num1 < num3 and num3 < num2) { cout << "median is: " << num3 << "\n"; }
    if (num2 < num1 and num1 < num3) { cout << "median is: " << num1 << "\n"; }
    if (num2 < num3 and num3 < num1) { cout << "median is: " << num3 << "\n"; }
    if (num3 < num1 and num1 < num2) { cout << "median is: " << num1 << "\n"; }
    if (num3 < num2 and num2 < num1) { cout << "median is: " << num2 << "\n"; }
    cout << "Goodbye\n";
    return 0;
}
`;

/* --------------------------------------------------------------- the lab */

/** predict ids whose correct option is exactly what the program prints (checked by tests/intro-computing.test.ts) */
export const OUTPUT_PREDICTS = ['c-assign', 'c-index', 'c-fn', 'warm-div', 'warm-char', 'warm-find', 'warm-if', 'io-print', 'type-cut', 'mem-swap', 'calc-mod', 'calc-cmath', 'calc-compound',
  'if-branch', 'ch-compare', 'str-basics', 'str-substr', 'gl-cin', 'em-substr', 'q4-2', 'q5-1', 'q5-2', 'q5-3', 'q5-4', 'q5-6', 'q5-7'];

export function introComputingRevisionLab(): Flow {
  return chain([
    { id: 'root', type: 'start', data: {
      title: 'Revision: from program logic to C++',
      description: 'Week 6 revision for the class test. Start with the words of C++ in pictures, then read, predict, step through and write real C++ in your browser — program logic, cout and cin, types, operators, if / else, characters and strings — and finish with the Lecture 4 & 5 quiz.',
      difficulty: 'Beginner',
      estimatedTime: '3 h',
      objectives: [
        'Explain the words of C++: library, main, variable, declaration, initialisation, data type, cout, cin, string, [ ], find',
        'Turn program logic into C++, one step at a time',
        'Use cout, cin and getline — and choose the right type for every value',
        'Predict what /, %, ++, round, ceil, floor, pow and max give',
        'Choose with if / else if / else (the median of three numbers)',
        'Use characters as numbers (ASCII) and strings: length, [ ], find, substr, npos',
        'Answer the Lecture 4 & 5 quiz questions with confidence',
      ].join('\n'),
    } },

    /* ------------------------------------ 0. start here: the words of C++ (20) */
    part('p0', 'Start here: the words of C++', '25 min'),
    text('p0-intro', 'Before any code: the words we use all the time — **library, main, variable, declaration, initialisation, data type, cout, cin, string, [ ], find** — and every function, operator and symbol from the lectures. Each word has a picture. Press, type and play with every one, and say out loud what you expect *before* you press. If a word is still new to you, this is the moment to ask.'),
    task('t0-1', 'A program, piece by piece', '5 min', 'Tap a line of the program (or a word in the list) and read what it is. Then press **✂ Remove it** to see exactly what Visual Studio says without it. TA: walk the class through it with **Next ▶**.'),
    visual('c-anatomy', 'A program, piece by piece', 'Every program in this module has these pieces. The error messages are the real ones you will meet in Visual Studio.'),
    task('t0-2', 'Why int main()?', '2 min', 'Press **▶ Run the program** and follow the chip: who starts main — and what does main hand back at the end? Then try **return 1**.'),
    visual('c-main', 'Why int main()?'),
    predict('c-main-q', 'What does `return 0;` at the end of main tell the computer?', '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hi";\n    return 0;\n}\n',
      ['Print 0 on the screen', '*The program finished without problems', 'Start main again', 'Wait for the user to press a key'],
      'main is an **int** function: when it ends it hands a whole number back to the computer. **0** means *all good*. Your program prints only `Hi` — the 0 is not printed.', '', 'No'),
    task('t0-3', 'Variables: declare, initialise, assign', '4 min', 'Press **▶ Next line** six times. Before each press, say what will happen to the boxes in memory.'),
    visual('c-variable', 'The life of a variable'),
    callout('c-words', 'TIP', '**Variable** — a named box in memory. **Declaration** — make the box: `int age;` **Initialisation** — make it *and* give its first value: `int age = 19;` **Assignment** — put a new value in a box that already exists: `age = 20;` (`=` means *store into*; `==` means *is it equal?*).'),
    predict('c-decl', 'Which line **declares** a variable **and initialises** it?', 'int age;\nint year = 2026;\nage = 19;\ncout << age;',
      ['`int age;`', '*`int year = 2026;`', '`age = 19;`', '`cout << age;`'],
      '`int age;` only **declares** — the box has no value yet. `int year = 2026;` declares **and** initialises in one line. `age = 19;` is an **assignment**: the box already exists. `cout` prints.', '', 'No'),
    predict('c-assign', 'What does this print?', 'int x = 5;\nx = 7;\ncout << x;', ['*7', '5', '57', 'An error'],
      '`=` stores the right side **into** the box on the left. The box holds one value, so 5 is replaced by 7.'),
    task('t0-4', 'Data types: what kind of box?', '3 min', 'Choose a value and compare the six boxes. Which ones keep it exactly, which ones change it, and which ones refuse it?'),
    visual('c-typebox', 'Data types: what is really stored'),
    predict('c-type', 'A student’s GPA is 3.75. Which variable keeps the **.75**?', 'int items = 3.75;\ndouble gpa = 3.75;\nchar grade = \'A\';\nbool passed = true;\ncout << items << " " << gpa;',
      ['`items` (int)', '*`gpa` (double)', '`grade` (char)', '`passed` (bool)'],
      'Only `float` and `double` keep decimals; an `int` cuts 3.75 down to 3 (run it: it prints `3 3.75`). `double` is the usual choice for decimals.', '', 'No'),
    task('t0-5', 'cout and cin: out and in', '3 min', 'Run it with one name, then with a full name such as *Mohamed Salah*. Then press **What if: cin << name ?**'),
    visual('c-flow', 'Keyboard → program → screen'),
    predict('c-io', 'The user types **Ali**. Which line stores it in `name`?', 'string name;\ncout << "Your name? ";\ncin >> name;\ncout << "Hi " << name;',
      ['`cout << "Your name? ";`', '*`cin >> name;`', '`cout << "Hi " << name;`', '`string name;`'],
      '`cin >>` takes from the keyboard and stores **into** `name` — the arrows point into the variable. `string name;` only makes the empty box; the two `cout` lines print.', 'Ali', 'Yes'),
    task('t0-6', 'Strings, [ ] and find', '2 min', 'A **string** is a row of characters, and every character has a position number that **starts at 0**. Press each button — say the answer first.'),
    visual('c-string', 'String explorer', '`s[i]` — the character at position i. `s.length()` — how many characters. `s.find(x)` — the position of the **first** x (or `npos` if there is none). `s.substr(start, length)` — a piece of the string.', 'Cairo'),
    predict('c-index', 'What does this print?', 'string city = "Cairo";\ncout << city[0] << city.find(\'r\');', ['*C3', 'C2', 'a3', 'C4'],
      'Positions start at **0**: C0 a1 i2 r3 o4. `city[0]` is the first character, `C`; `find(\'r\')` gives the position of the first `r`: 3.'),
    task('t0-tools', 'The toolbox: every function, operator and symbol', '5 min', 'Every function from the lectures — `sqrt`, `pow`, `round`, `floor`, `ceil`, `max`, `min`, `getline`, `length`, `[ ]`, `at`, `find`, `substr`, `npos`, `stoi`, `stod`, `to_string` — plus the operators and the special symbols. Pick a shelf, pick a tool, **predict** the answer, then press **▶ Run it**. Change the inputs and try to break it.'),
    visual('c-toolbox', 'The toolbox: every function, operator and symbol', 'A **function** is a machine: values go **in** through the `( )`, one answer comes **out**. Each shelf is a library — the `#include` it needs is shown on the card.'),
    predict('c-fn', 'What does this print?', 'cout << max(3, 7) << " " << sqrt(16) << " " << pow(2, 3) << " " << floor(4.9);', ['*7 4 8 4', '7 4 8 5', '3 4 6 4', '7 4.0 8.0 4'],
      '`max(3, 7)` is the bigger one: **7**. `sqrt(16)` is **4** (4 × 4 = 16). `pow(2, 3)` is 2 × 2 × 2 = **8**. `floor(4.9)` goes **down**: **4**. cout prints 4.0 as just `4`.'),
    task('t0-7', 'Your cheat sheet', '1 min', 'Every word from this part in one place. Keep it open for the rest of the lab — and for the class test revision.'),
    text('c-cheat', [
      '| Word | What it means | Example |',
      '|---|---|---|',
      '| **library** | a toolbox of ready-made code | `#include <iostream>` |',
      '| `using namespace std;` | lets you write `cout` instead of `std::cout` | |',
      '| `int main()` | where the program starts; hands back 0 when it finishes | `int main() { … return 0; }` |',
      '| `;` | the end of one instruction | `int age = 19;` |',
      '| `{ }` | a block: the body of main, of an if, of an else | |',
      '| `//` | a comment, for people only | `// read the input` |',
      '| **variable** | a named box in memory | `age` |',
      '| **data type** | what may go in the box | `int` `double` `float` `char` `string` `bool` |',
      '| **declaration** | make the box | `int age;` |',
      '| **initialisation** | make the box and give its first value | `int age = 19;` |',
      '| **assignment** `=` | store a new value (the old one is replaced) | `age = 20;` |',
      '| `==` | compare: is it equal? (true or false) | `if (age == 20)` |',
      '| `cout <<` | print to the screen | `cout << age;` |',
      '| `cin >>` | read one value from the keyboard (stops at a space) | `cin >> age;` |',
      '| `getline` | read the whole line, spaces included | `getline(cin, name);` |',
      '| **string** | text: a row of characters numbered from 0 | `string s = "Cairo";` |',
      '| `s[i]` | the character at position i | `s[0]` is `\'C\'` |',
      '| `s.length()` | how many characters | `5` |',
      '| `s.find(x)` | the position of the first x, or npos if there is none | `s.find(\'r\')` is `3` |',
      '| `s.substr(start, length)` | a piece of the string | `s.substr(1, 3)` is `"air"` |',
      '| `s.at(i)` | the same as `s[i]`, but it checks the position | `s.at(0)` is `\'C\'` |',
      '| `string::npos` | what `find` gives when there is no match | `if (s.find(\'z\') == string::npos)` |',
      '| `stoi(text)` · `stod(text)` | text → int · text → double | `stoi("42")` is `42` |',
      '| `to_string(n)` | number → text | `to_string(42) + "!"` is `"42!"` |',
      '| `sqrt(x)` | square root (`<cmath>`) | `sqrt(16)` is `4` |',
      '| `pow(x, y)` | x to the power y (`<cmath>`) | `pow(2, 3)` is `8` |',
      '| `round` · `floor` · `ceil` | nearest · down · up (`<cmath>`) | `round(2.5)` 3 · `floor(2.5)` 2 · `ceil(2.1)` 3 |',
      '| `max(a, b)` · `min(a, b)` | the bigger · the smaller (`<algorithm>`), both the same type | `max(3, 7)` is `7` |',
      '| `/` · `%` | divide (int / int cuts the decimals) · remainder | `7 / 2` is 3 · `7 % 2` is 1 |',
      '| `+=` `-=` `*=` `/=` `%=` | short for `x = x + …` | `x += 5;` |',
      '| `++` · `--` | add 1 · take away 1 | `x++;` |',
      '| `==` `!=` `<` `>` `<=` `>=` | compare: the answer is true (1) or false (0) | `if (a != b)` |',
      '| `and` `&&` · `or` `\\|\\|` | both must be true · at least one must be true | `if (x > 0 and x < 10)` |',
      '| `if` · `else if` · `else` | choose which block runs | `if (x > 0) { … } else { … }` |',
      '| `"\\n"` · `"\\t"` | new line · tab (inside the quotes) | `cout << "Hi\\n";` |',
      '| `/* … */` | a comment over many lines | |',
      '| `const` | a box whose value can never change | `const double PI = 3.14159;` |',
      '| `return 0;` | finish main: 0 means all good | |',
    ].join('\n')),

    /* ------------------------------------------------- 1. warm-up (10) */
    part('p1', 'Warm-up: where am I?', '10 min'),
    callout('p1-why', 'TIP', 'No marks here. Answer from memory **before** you run anything — that effort is exactly what makes it stick. Wrong answers are fine: they show us what to fix today.'),
    task('t1', 'Five quick questions', '10 min', 'One minute each. Lock in an answer, then run it to see if you were right.'),
    predict('warm-div', 'What does this print?', 'cout << 7 / 2;', ['*3', '3.5', '4', '3.0'],
      'Both 7 and 2 are **int**, so C++ does whole-number division and **cuts off** the decimals (it does not round). Part 5 shows why.'),
    predict('warm-cin', 'What does this line do?', 'int num1;\ncin >> num1;', ['*Waits for the user to type a number, then stores it in num1', 'Prints num1 on the screen', 'Creates num1 and sets it to 0', 'Compares what the user types with num1'],
      '`>>` points **into** the variable: the program stops, waits for the keyboard, and stores the number in `num1`.', '42', 'Yes'),
    predict('warm-char', 'What does this print?', "char c = 'A';\ncout << c + 1;", ['*66', 'B', 'A1', 'An error'],
      "A char is stored as a number: `'A'` is **65**. `c + 1` is char + int, which gives an **int** (66). To get `B`, cast it back: `(char)(c + 1)`."),
    predict('warm-find', 'What does this print?', 'string s = "hello";\ncout << s.find(\'l\');', ['*2', '3', '1', 'npos'],
      'Positions start at **0**: h0 e1 l2 l3 o4. `find` gives the **first** match.'),
    predict('warm-if', 'What does this print?', 'int x = 5;\nif (x > 3) cout << "big";\nelse cout << "small";', ['*big', 'small', 'bigsmall', 'Nothing'],
      'The condition `x > 3` is true, so only the `if` part runs; `else` is skipped.'),

    /* --------------------------------------------- 2. the recipe (15) */
    part('p2', 'The recipe: program logic → C++', '15 min'),
    text('p2-intro', 'Every program in Part 1 of the module follows the same logic (Lecture 1):\n\n**Say what you do → ask for input → read it → do something with it → give output → say goodbye → close.**\n\nWrite the logic first, in plain words. Then turn each line into code — and ask two questions on the way: *output it as what?* and *read it into what type?*'),
    task('t2-1', 'From logic to code', '5 min', 'Press **Translate**, then click any step to see its code again.'),
    visual('logic', 'Program logic → code', 'The “product of two numbers” program from Lecture 3.'),
    task('t2-2', 'Put the product program in order', '5 min', 'The comments are the program logic. Put the cards in the order the program must do them, then check — your order is run with the input `3 5`.'),
    parsons('order-product', 'The product program', 'Drag the cards into order. The **declaration** card is the one that answers *“read it into what type?”*', PRODUCT_PROGRAM, '3 5'),
    task('t2-3', 'Run it — then change it', '5 min', 'Press **⏭ Step** and watch each variable box fill. Then change the program so it adds instead of multiplies.'),
    cpp('modify-sum', {
      title: 'Product → sum',
      goal: 'Change the program so it calculates the **sum** of the two numbers and prints `the sum is: ` followed by the answer. Keep every step of the logic (hello, ask, read, calculate, output, goodbye).',
      starter: PRODUCT_LECTURE,
      input: '3 5',
      checks: [
        '3 + 5 :: in 3 5; expect sum is: 8',
        '10 + 20 :: in 10 20; expect sum is: 30',
        '-4 + 4 :: in -4 4; expect sum is: 0',
        'Still says goodbye :: in 1 1; expect Goodbye',
      ],
      hints: [
        'Only two lines need to change: the calculation and the text before the answer.',
        'Rename `product` to `sum` everywhere it appears (declaration, calculation, output) — or keep the name; C++ does not care, but readers do.',
      ],
    }),

    /* -------------------------------------- 3. cout, cin, variables (25) */
    part('p3', 'Talking to the user: cout, cin and variables', '25 min'),
    task('t3-1', 'cout sends out, cin takes in', '6 min', 'Change what the user types, run **cin**, then **cout**. Watch where every piece goes.'),
    visual('streams', 'cout & cin: data in and out'),
    callout('io-arrows', 'TIP', 'The arrows show where the data moves: `cout << x` sends x **out** to the screen; `cin >> x` takes the keyboard input **into** x. Swap them and Visual Studio refuses to build.'),
    predict('io-print', 'What exactly is printed?', 'cout << "Total:";\ncout << 5 + 3;\ncout << "\\n";', ['*Total:8', 'Total: 8', 'Total:5 + 3', '"Total:"8'],
      'cout prints **only what you write**: no space appears unless it is inside the quotes. `5 + 3` is calculated first, so 8 is printed. The quotes are not printed.'),
    task('t3-2', 'Which box fits?', '6 min', 'Every variable has a type, and the type decides what it can hold. Sort the values — the quotes and the decimal point are the clues.'),
    visual('types', 'Which box fits? (data types)'),
    predict('type-cut', 'What does this print?', 'int x = 3.9;\ncout << x;', ['*3', '3.9', '4', 'An error'],
      'An `int` keeps whole numbers only, so `3.9` is **cut** to 3 (not rounded). Visual Studio shows warning C4244 “possible loss of data”. Use `float` to keep decimals.'),
    task('t3-3', 'The memory machine', '8 min', 'A variable is one box with one value at a time. Predict, then **Step** through and watch the boxes.'),
    predict('mem-swap', 'The user types 4 and 9. What is printed?', 'int a, b;\ncin >> a >> b;\na = a + b;\nb = a - b;\na = a - b;\ncout << a << " " << b;', ['*9 4', '4 9', '13 4', '9 9'],
      'Step through it: a = 13 (4 + 9), then b = 13 − 9 = **4**, then a = 13 − 4 = **9**. The two values swapped. `=` copies the value on the right **once**, at that moment — it is not an equation that stays true.', '4 9'),
    predict('mem-uninit', 'What happens?', 'int total;\ntotal = total + 5;\ncout << total;', ['*The program stops: total is used before it has a value', '5', '0', 'total + 5'],
      '`int total;` makes a box but puts **nothing known** in it. Reading it is an error — Visual Studio stops with “Run-Time Check Failure #3”. Always give a value first: `int total = 0;`'),
    task('t3-4', 'Make: the average of two numbers', '5 min', 'No starter code this time — just the logic as comments. Type it yourself (pasting is off, as in the lab test).'),
    cpp('make-average', {
      title: 'Average of two numbers',
      goal: 'Write a program that asks for two numbers and prints `the average is: ` followed by their average.\n\n- `3 4` → **3.5**\n- `10 20` → **15**',
      starter: MAKE_SKELETON(['say what you do', 'ask for two numbers', 'read them — into what type?', 'calculate the average', 'give the output', 'say goodbye']),
      checks: [
        '3 and 4 :: in 3 4; expect average is: 3.5',
        '10 and 20 :: in 10 20; expect average is: 15',
        '1 and 2 :: in 1 2; expect average is: 1.5',
        'Keeps decimals :: code /\\b(float|double)\\b|\\d\\.\\d/ The average can have decimals — which type keeps them?',
      ],
      hints: [
        'The answer can be 3.5, so the variables need a type that keeps decimals: `float`.',
        'Brackets matter: `(num1 + num2) / 2`. Without them only num2 is divided (multiplication and division come before + and −).',
        'If you used `int`, `(3 + 4) / 2` is 3, not 3.5 — whole-number division cuts the decimals.',
      ],
      paste: 'Blocked',
    }),

    /* ---------------------------------------------- 4. calculating (20) */
    part('p4', 'Calculating: operators, cmath and ++', '20 min'),
    task('t4-1', 'Whole-number division and %', '5 min', 'Predict first, then move the sliders.'),
    visual('division', 'Whole-number division and %'),
    predict('calc-mod', 'What does this print?', 'cout << 17 % 5 << " " << 17 / 5;', ['*2 3', '3 2', '2 3.4', '3.4 2'],
      '17 ÷ 5 = 3 full groups of 5 (15) with **2** left over. `%` gives the leftover (2), `/` between ints gives the full groups (3).'),
    task('t4-2', 'cmath and algorithm', '5 min', 'Drag x along the number line. Where does each function land?'),
    visual('rounding', 'floor, ceil and round'),
    predict('calc-cmath', 'What does this print? (Lecture 3)', 'cout << floor(4.51) << " " << sqrt(25) << " " << pow(2, 3) << " " << max(2, 3);', ['*4 5 8 3', '5 5 8 3', '4.51 5 6 3', '4 5 9 2'],
      '`floor` goes down to 4. `sqrt(25)` is 5, `pow(2, 3)` is 2³ = 8 — cout prints 5 and 8, not 5.0. `max` gives the bigger value. Remember the includes: `<cmath>` for floor/sqrt/pow, `<algorithm>` for max/min.'),
    task('t4-3', 'x++ or ++x?', '6 min', 'Both add 1 to x. The difference is **when** the value is used.'),
    visual('increment', 'x++ or ++x?'),
    predict('calc-compound', 'What does this print? (Lecture 3)', 'int x = 3;\nx = x + 2;\nx += 4;\nx++;\nx -= 4;\nx *= 2;\ncout << x;', ['*12', '10', '14', '6'],
      '5 → 9 → 10 → 6 → **12**. `x += 4` means `x = x + 4`; `x *= 2` means `x = x * 2`. Step through it if you lost track.'),
    task('t4-4', 'Make: a circle', '4 min', 'Lecture 3 declared `const float pi = 3.14159;`. A const can never change — use it here.'),
    cpp('make-circle', {
      title: 'Area and circumference of a circle',
      goal: 'Ask for the radius of a circle, then print its **area** (π r²) and its **circumference** (2 π r). Use `const float pi = 3.14159;`.\n\n- radius `3` → area **28.2743**, circumference **18.8495**',
      starter: MAKE_SKELETON(['say what you do', 'ask for the radius', 'read it — into what type?', 'calculate the area and the circumference', 'give the output', 'say goodbye']),
      checks: [
        'Radius 3 :: in 3; expect 28.2743; expect 18.8495',
        'Radius 1.5 :: in 1.5; expect 7.06858; expect 9.42477',
        'pi is a const :: code /const\\s+(float|double)\\s+pi\\s*=\\s*3\\.14159/ Declare pi like Lecture 3: const float pi = 3.14159;',
      ],
      hints: [
        'The radius can be 1.5, so read it into a `float`.',
        'r² is `r * r` or `pow(r, 2)` (pow needs `#include <cmath>`).',
        'Print both answers, e.g. `cout << "area: " << area << "\\n";` — C++ prints 6 significant digits, like 28.2743.',
      ],
      paste: 'Blocked',
    }),

    /* --------------------------------------------- 5. choosing (25) */
    part('p5', 'Choosing: if / else (the median)', '25 min'),
    task('t5-1', 'Six cases — or three questions?', '8 min', 'Lecture 2 listed every order of three numbers. Then it found a shortcut: once you know `num1 < num2`, num3 can only go in one of **three** places.'),
    text('p5-cases', '| Order | Median |\n|---|---|\n| num1 < num2 < num3 | num2 |\n| num1 < num3 < num2 | num3 |\n| num2 < num1 < num3 | num1 |\n| num2 < num3 < num1 | num3 |\n| num3 < num1 < num2 | num1 |\n| num3 < num2 < num1 | num2 |'),
    visual('median', 'Median: where does num3 go?', 'Drag num3: left, middle or right? The highlighted line is the branch that runs.'),
    task('t5-2', 'Predict the branch', '7 min', 'Follow the conditions with your finger, then step through to check.'),
    predict('if-branch', 'The user types 5 2 9. What is printed?', MEDIAN_NESTED, ['*median is: 5', 'median is: 2', 'median is: 9', 'Nothing'],
      '`num1 < num2` is **false** (5 < 2), so the `else` part runs. There, `num3 > num1` (9 > 5) is true → the median is num1 = **5**. Only one branch of an if / else if / else chain ever runs.', '5 2 9'),
    predict('if-equal', 'Lecture 3 asked: what if the user types 2 2 2? This is the six-if version.', MEDIAN_SIX, ['*No median is printed — just hello and Goodbye', 'median is: 2', 'median is: 2 (three times)', 'The program crashes'],
      'Every test uses strict `<`, and `2 < 2` is false — so **none** of the six ifs is true. The nested version always prints a median, because its last `else` catches “everything else”. When you write conditions, test equal values too.', '2 2 2'),
    task('t5-3', 'Make: even or odd', '10 min', 'Combine `%` from Part 5 with an `if`.'),
    cpp('make-even', {
      title: 'Even or odd?',
      goal: 'Ask for a whole number. Print `the number is even` or `the number is odd`.\n\n- `4` → the number is even\n- `7` → the number is odd\n- try `0` and `-3` too',
      starter: MAKE_SKELETON(['say what you do', 'ask for a whole number', 'read it', 'decide: even or odd?', 'say goodbye']),
      checks: [
        '4 is even :: in 4; expect the number is even; not the number is odd',
        '7 is odd :: in 7; expect the number is odd; not the number is even',
        '0 is even :: in 0; expect the number is even; not the number is odd',
        '-3 is odd :: in -3; expect the number is odd; not the number is even',
        'Uses % and if :: code /%/ The remainder % tells you even or odd; code /\\bif\\b/ Use an if to choose',
      ],
      hints: [
        'A number is even when it divides by 2 with **nothing left over**.',
        '`n % 2` is the leftover. Compare it with `==` (two equals signs).',
        'If -3 fails: in C++, -3 % 2 is **-1**, not 1. Which test works for 3 and for -3?',
      ],
      paste: 'Blocked',
    }),

    /* ------------------------------------------ 6. characters (15) */
    part('p6', 'Characters are numbers', '15 min'),
    task('t6-1', 'The ASCII table', '7 min', 'Type a letter, press **c − 32**, and compare two characters.'),
    visual('ascii', 'Characters are numbers (ASCII)'),
    predict('ch-compare', 'What does this print?', 'if (\'B\' < \'a\') cout << "yes";\nelse cout << "no";', ['*yes', 'no', 'An error', 'B'],
      "Characters compare by their codes: 'B' is 66 and 'a' is 97, so `'B' < 'a'` is true. Every UPPER-case letter comes before every lower-case letter."),
    task('t6-2', 'Modify: upper → lower', '8 min', 'This is the Lecture 4 program. Make it go the other way.'),
    cpp('modify-lower', {
      title: 'Uppercase → lowercase',
      goal: 'Change the program so it converts an **UPPERCASE** letter to lowercase, and prints `The lowercase is: ` followed by the letter.\n\n- `A` → a\n- `M` → m',
      starter: UPPERCASE,
      input: 'A',
      checks: [
        'A → a :: in A; expect lowercase is: a',
        'M → m :: in M; expect lowercase is: m',
        'Z → z :: in Z; expect lowercase is: z',
        'Uses the ASCII trick :: nocode /tolower/ Use the ±32 trick from Lecture 4, not tolower',
      ],
      hints: [
        "Lowercase letters are 32 **more** than uppercase ('a' = 97, 'A' = 65).",
        'Without `(char)`, `c + 32` prints a number (97). The cast turns it back into a letter.',
      ],
    }),

    /* ---------------------------------------------- 7. strings (30) */
    part('p7', 'Strings: boxes in a row', '30 min'),
    task('t7-1', 'Positions, find and substr', '8 min', 'A string is a row of characters, numbered from **0**. Say each answer out loud before you press.'),
    visual('string', 'String explorer', '`substr(start, length)` takes a **length**, not an end position.', 'Introduction to Computing'),
    predict('str-basics', 'What does this print?', 'string s = "Mohamed Salah";\ncout << s.length() << " " << s[0] << " " << s.find(\' \');', ['*13 M 7', '12 M 7', '13 M 8', '13 o 7'],
      '13 characters (the space counts). `s[0]` is the **first** character. The space is at position 7: M0 o1 h2 a3 m4 e5 d6 ␣7.'),
    predict('str-substr', 'What does this print?', 'string s = "Liverpool";\ncout << s.substr(2, 4);', ['*verp', 'ver', 'iver', 'verpo'],
      'Start at position **2** (v), then take **4** characters: v e r p. The second number is how many, not where to stop.'),
    task('t7-2', 'cin >> or getline?', '6 min', 'Names have spaces. Watch what each one reads from the keyboard buffer.'),
    visual('getline', 'cin >> vs getline'),
    predict('gl-cin', 'The user types Mohamed Salah. What is printed?', 'string name;\ncin >> name;\ncout << "Hi " << name;', ['*Hi Mohamed', 'Hi Mohamed Salah', 'Hi Salah', 'Hi'],
      '`cin >>` stops at the first space. To read the whole line, use `getline(cin, name);`', 'Mohamed Salah'),
    task('t7-3', 'The footballer program — and Pele', '8 min', 'Lecture 4 asked: *what if there is no space, like “Pele”?* Run it with **Pele** first and look at the output.'),
    cpp('modify-pele', {
      title: 'Handle one-word names',
      goal: 'When the name has no space, print `Only one name: ` followed by the name — and do **not** print a first and second name.\n\n- `Mohamed Salah` → first name: Mohamed, second name: Salah (as before)\n- `Pele` → Only one name: Pele',
      starter: FOOTBALLER,
      input: 'Pele',
      checks: [
        'Mohamed Salah still works :: in Mohamed Salah; expect first name: Mohamed; expect second name: Salah',
        'Pele :: in Pele; expect Only one name: Pele; not second name',
        'Tests for npos :: code /npos/ find gives string::npos when there is no space — test for it',
      ],
      hints: [
        'Run it with Pele and step through: what is `sp_index`? (find returns npos, which becomes -1 in an int.)',
        "Decide **before** splitting: `if (line.find(' ') == string::npos) { … } else { … }`.",
        'Move the substr lines and the first/second output into the else part.',
      ],
    }),
    task('t7-4', 'Is it an email? Is it a vector?', '8 min', 'Lectures 4 and 5 check text step by step: each test only runs if the one before passed. Try the examples, then type your own.'),
    visual('email', 'Is it an email address?'),
    predict('em-substr', 'What does this print?', 'string e = "salma@bue.edu.eg";\nint at = e.find(\'@\');\ncout << e.substr(0, at);', ['*salma', 'salma@', 'bue.edu.eg', '@'],
      '`at` is 5. `substr(0, 5)` takes 5 characters from the start: s a l m a — the @ itself is at position 5, so it is not included.'),
    visual('vector', 'Is it a vector <x, y>?', 'Program 21 from Lecture 5.'),

    /* --------------------------------- 8. class-test practice (15) */
    part('p8', 'Class-test practice: the Lecture 4 & 5 quiz', '15 min'),
    callout('p8-how', 'IMPORTANT', 'These are the quiz questions from Lectures 4 and 5. Treat them like the test: answer **first**, then run or step through to check. If you get one wrong, find out why before you move on.'),
    task('t8-1', 'Lecture 4 quiz', '7 min', 'Seven questions on characters, strings and getline.'),
    predict('q4-1', 'Q1. What is wrong with this declaration?', 'char a = "a";', ['*"a" (double quotes) is a string; a char needs single quotes: \'a\'', 'A char variable can’t be called a', 'Nothing is wrong', 'char must be written Char'],
      'Double quotes make text (a string, even with one letter). A `char` holds **one** character in **single** quotes: `char a = \'a\';`. Press Run to see Visual Studio’s error (C2440).'),
    predict('q4-2', 'Q2. What is the output?', 'if (\'c\' > \'d\') { cout << "yes\\n"; } else { cout << "no\\n"; }', ['*no', 'yes', 'yes no', 'An error'],
      "'c' is 99 and 'd' is 100. 99 > 100 is false, so the else part prints **no**."),
    predict('q4-3', 'Q3. string s = "test"; — which instruction returns the length of s?', 'string s = "test";\ncout << s.length();', ['*s.length()', 'length(s)', 's.length', 's.find(length)'],
      'length is a **method** of the string: write the string, a dot, and brackets — `s.length()` (4). `s.size()` gives the same.'),
    predict('q4-4', 'Q4. string s = "University"; — which instruction returns \'v\'?', 'string s = "University";\ncout << s[3];', ['*s[3]', 's[4]', 's.find(\'v\')', 's.substr(3)'],
      'U0 n1 i2 **v3**. `s[3]` (or `s.at(3)`) is the character at position 3. `s.find(\'v\')` gives the **position** 3, not the character, and `s.substr(3)` gives the text "versity".'),
    predict('q4-5', 'Q5. string s = "Liverpool"; — which instruction returns "pool"?', 'string s = "Liverpool";\ncout << s.substr(5);', ['*s.substr(5)', 's.substr(4)', 's.substr(5, 3)', 's.find("pool")'],
      'L0 i1 v2 e3 r4 **p5** o6 o7 l8: "pool" starts at 5 and runs to the end, so `s.substr(5)` (or `s.substr(5, 4)`). `s.find("pool")` gives the position 5, not the text.'),
    predict('q4-6', 'Q6. I ask the user for a footballer’s name. Which instruction reads it into string s?', 'string s;\ngetline(cin, s);\ncout << s;', ['*getline(cin, s);', 'cin >> s;', 'cin << s;', 'getline(s);'],
      'A footballer’s name can have a space (Mohamed Salah). `cin >> s` stops at the space; `getline(cin, s)` reads the whole line.', 'Mohamed Salah'),
    predict('q4-7', 'Q7. Where is the top-level domain (TLD) in an email address?', 'string email = "gerard.mckee@bue.edu.eg";', ['*At the end, after the last dot (eg)', 'Before the @ (gerard.mckee)', 'Right after the @ (bue)', 'Everything after the @ (bue.edu.eg)'],
      'The TLD is the last part of the domain: **.eg** here (like .com or .org). In code: `email.substr(email.rfind(\'.\') + 1)`.', '', 'No'),
    task('t8-2', 'Lecture 5 quiz', '8 min', 'Seven questions on cmath, ++ and find.'),
    predict('q5-1', 'Q1. What does round(5.5) return?', 'cout << round(5.5);', ['*6', '5', '5.5', '6.0'],
      '`round` goes to the nearest whole number, and **.5 goes away from zero**, so 6. cout prints it as 6 (not 6.0).'),
    predict('q5-2', 'Q2. What does ceil(4.1) return?', 'cout << ceil(4.1);', ['*5', '4', '4.1', '4.5'],
      '`ceil` (ceiling) always goes **up** to the next whole number, even from 4.1.'),
    predict('q5-3', 'Q3. What is the final value of y?', 'int x = 4; int y = 2;\nx += y;\ny = x++;\ncout << y;', ['*6', '7', '2', '8'],
      'After `x += y`, x is 6. `x++` gives the **old** value (6) to y, and only then x becomes 7.'),
    predict('q5-4', 'Q4. What is the final value of y?', 'int x = 4; int y = 2;\nx += y;\ny = ++x;\ncout << y;', ['*7', '6', '2', '8'],
      '`++x` adds 1 **first** (x becomes 7), then gives the new value to y.'),
    predict('q5-5', 'Q5. Which string, typed by the user, makes this print 2? (The quiz wrote find(\'z\') — it needs s. in front.)', 'string s;\ncin >> s;\nint j = s.find(\'z\');\nif (j != std::string::npos) {\n    cout << "1\\n";\n} else {\n    cout << "2\\n";\n}', ['*hello', 'pizza', 'zero', 'z'],
      'It prints 2 when there is **no z** in the string, like **hello**: find gives `string::npos` (not found). pizza, zero and z all contain a z, so they print 1. Step through it with hello, then think about pizza.', 'hello'),
    predict('q5-6', 'Q6. What is j?', 'string line = "Introduction to Computing";\nint j = line.find(\'o\');\ncout << j;', ['*4', '10', '3', '14'],
      'I0 n1 t2 r3 **o4** — find stops at the **first** o.'),
    predict('q5-7', 'Q7. What is j?', 'string s, sub;\ns = "Introduction to Computing";\nsub = s.substr(14);\nint j = s.find(\'o\');\ncout << j;', ['*4', '0', '14', '1'],
      'The trap: `sub` is never used. `j` searches **s**, not sub, so it is still 4. (sub is "o Computing", where the first o is at 0.)'),

    /* ------------------------------------------------------- wrap-up */
    { id: 'wrap', type: 'checkpoint', data: { body: '**Before the class test (Week 7, Lectures 1–5):**\n\n- Redo every ✗ above — your answers and code are saved in this browser.\n- For each program in the lab lists, write the **logic first**, then the code, line by line.\n- In Visual Studio, type the code yourself: no copying, no AI (the lab rules).' } },
    { id: 'checkin', type: 'checkin', data: {} },
  ]);
}

export function introComputingModule(): Flow {
  return chain([
    { id: 'root', type: 'module', data: {
      code: '26CSCI01P',
      title: 'Introduction to Computing',
      term: '2026–2027 · Semester One',
      description: 'Program logic and C++ from the very first line: input and output, variables and types, operators, selection, characters and strings — learned by predicting, stepping through and writing real code in the browser.',
      color: '#4f8fd6',
      faculty: 'informatics-computer-science',
      leader: '',
      open: 'No',
      category: 'Core',
      years: 'Prep year',
      semester: 'Semester 1',
      specializations: '',
    } },
    { id: 'week-6', type: 'divider', data: { title: 'Week 6 · Revision' } },
    { id: 'lab-revision', type: 'lab', data: { slug: 'revision-week-6' } },
  ]);
}
