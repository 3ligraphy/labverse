/**
 * Introduction to Computing (26CSCI01P) — "Revision practice": questions only, from easy to hard, on everything in
 * Lectures 1–5, the Lecture 4 & 5 quiz and the lab programs (Wk2/Wk3/Wk6ProgramLogic). Every answer is typed:
 * a "Type the answer" (what the code prints, a value, or an input — checked exactly) or a C++ program (checked by
 * running it on several inputs). Only Part 1 content is used: sequence and selection, no loops. The lab is open any
 * time (no TA session needed) and every answer is tracked. Node ids are stable: progress is stored by them.
 */
import type { Flow } from '../core.ts';

type N = { id: string; type: string; data: Record<string, string> };

const chain = (nodes: N[]): Flow => ({
  nodes: nodes.map((n, i) => ({ id: n.id, type: n.type, x: 80 + (i % 2) * 40, y: 80 + i * 150, data: n.data })),
  edges: nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id })),
});
const part = (id: string, title: string, time: string): N => ({ id, type: 'part', data: { title, time } });
const task = (id: string, title: string, time: string, body: string): N => ({ id, type: 'task', data: { title, time, body } });
const answer = (id: string, mode: string, question: string, code: string, extra: { input?: string; answers?: string[] } = {}): N =>
  ({ id, type: 'cppanswer', data: { question, code, input: extra.input ?? '', mode, answers: (extra.answers ?? []).join('\n'), explain: '' } });
/** type exactly what the code prints (checked against the real output) */
const out = (id: string, question: string, code: string, input = '') => answer(id, 'What it prints (the output)', question, code, { input });
/** type a value (checked against the accepted forms) */
const val = (id: string, question: string, code: string, answers: string[]) => answer(id, 'A value', question, code, { answers });
/** type what the user types (the code runs with it and must print `expected`) */
const inp = (id: string, question: string, code: string, expected: string) => answer(id, 'What the user types (an input)', question, code, { answers: [expected] });

export const SKELETON = '#include <iostream>\nusing namespace std;\n\nint main() {\n\n    return 0;\n}\n';
/** Part 1 programs use sequence and selection only (Lecture 1) */
export const NO_LOOPS = 'Sequence and selection only :: nocode /\\b(for|while)\\s*\\(|\\bdo\\s*\\{/ Part 1 programs use only sequence and selection (if and else): no loops.';
const prog = (id: string, d: { title: string; goal: string; checks: string[]; starter?: string }): N =>
  ({ id, type: 'cpp', data: { title: d.title, goal: d.goal, starter: d.starter ?? SKELETON, input: '', checks: [...d.checks, NO_LOOPS].join('\n'), hints: '', paste: 'Blocked' } });

export function introComputingPracticeLab(): Flow {
  return chain([
    { id: 'root', type: 'start', data: {
      title: 'Revision practice: Lectures 1 to 5',
      description: 'Practice questions on Lectures 1 to 5 and the lab programs, from easy to hard. Type every answer and every program yourself. Each answer is checked straight away.',
      difficulty: 'Beginner',
      estimatedTime: '4 h',
      objectives: [
        'Read C++ code and say exactly what it prints',
        'Write programs with cout, cin, getline and the right data types',
        'Calculate with operators, cmath and algorithm',
        'Choose with if / else if / else',
        'Work with characters and strings: [ ], at, length, find, substr, npos, stoi, stod, to_string',
        'Write the lab programs: vectors, complex numbers, quaternions and sets of numbers',
      ].join('\n'),
      access: 'Open any time (no session, still tracked)',
    } },

    /* ---------------------------------------------------------------- 1. output (easy) */
    part('p1', 'Output with cout', '20 min'),
    task('t1-1', 'What does it print?', '8 min', 'Type **exactly** what each program prints: every character and every space. One line on the screen = one line in your answer.'),
    out('o-hello', 'What does this print?', 'cout << "Hello";\ncout << "World";'),
    out('o-lines', 'What does this print?', 'cout << "Hello\\n";\ncout << "World\\n";'),
    out('o-total', 'What does this print?', 'cout << "Total: " << 5 + 3 << "\\n";'),
    out('o-comments', 'What does this print?', '// cout << "A";\ncout << "B";\n/* cout << "C"; */\ncout << "D";'),
    out('o-numbers', 'What does this print?', 'cout << 7 << 8 << "\\n" << 9;'),
    task('t1-2', 'Write it', '12 min', 'Write each program from the start. Paste is off: type the code yourself.'),
    prog('w-hello', {
      title: 'Hello and goodbye',
      goal: 'Print exactly these two lines, and nothing else:\n\n```\nHello, I am your first program\nGoodbye\n```',
      checks: ['Prints exactly the two lines :: exact Hello, I am your first program\\nGoodbye\\n'],
    }),
    prog('w-tab', {
      title: 'A small table',
      goal: 'Print this table. Use `\\t` (a tab) between the two columns:\n\n```\nName\tAge\nMona\t19\n```',
      checks: ['Prints the table :: exact Name\\tAge\\nMona\\t19\\n', 'Uses \\t :: code /\\\\t/ Use \\t between the columns.'],
    }),

    /* ------------------------------------------------- 2. variables, types and assignment */
    part('p2', 'Variables, types and assignment', '25 min'),
    task('t2-1', 'Types', '6 min', 'Type exactly what each program prints.'),
    out('o-intdiv', 'What does this print?', 'int x = 7;\nint y = 2;\ncout << x / y;'),
    out('o-floatdiv', 'What does this print?', 'float a = 7;\ncout << a / 2;'),
    out('o-intcut', 'What does this print?', 'int n = 3.9;\ncout << n;'),
    out('o-charplus', 'What does this print?', "char c = 'A';\ncout << c + 1;"),
    task('t2-2', 'Assignment', '10 min', 'Type exactly what each program prints, or the value asked for.'),
    out('o-compound', 'What does this print? (one number per line)', 'int x = 3;\nx = x + 2;  cout << x << "\\n";\nx += 4;     cout << x << "\\n";\nx++;        cout << x << "\\n";\nx--;        cout << x << "\\n";\nx -= 4;     cout << x << "\\n";\nx *= 2;     cout << x << "\\n";\nx /= 2;     cout << x << "\\n";\nx %= 2;     cout << x << "\\n";'),
    val('v-postinc', 'What is the final value of **y**?', 'int x = 4; int y = 2;\nx += y;\ny = x++;', ['6']),
    val('v-preinc', 'What is the final value of **y**?', 'int x = 4; int y = 2;\nx += y;\ny = ++x;', ['7']),
    out('o-incexpr', 'What does this print?', 'int x = 5;\nint y = x++ + 2;\ncout << x << " " << y;'),
    task('t2-3', 'Fix it', '9 min', 'Each program does not build. Fix it so it builds and prints what it should. Keep the variable and its type.'),
    prog('w-fix-char', {
      title: 'Fix the declaration',
      goal: 'This program should print the letter `a`. Fix the declaration so it builds. `a` must stay a `char`.',
      starter: '#include <iostream>\nusing namespace std;\n\nint main() {\n    char a = "a";\n    cout << a << "\\n";\n    return 0;\n}\n',
      checks: ['Prints a :: expect a', 'a is a char :: code /char\\s+a\\s*=\\s*\'a\'\\s*;/ a must stay a char.'],
    }),
    prog('w-fix-const', {
      title: 'Fix the constant',
      goal: 'This program should print `3.14159`. Make it build. `pi` must stay `const float pi = 3.14159;`.',
      starter: '#include <iostream>\nusing namespace std;\n\nint main() {\n    const float pi = 3.14159;\n    pi = 3.14;\n    cout << pi << "\\n";\n    return 0;\n}\n',
      checks: ['Prints 3.14159 :: expect 3.14159', 'pi stays const :: code /const\\s+float\\s+pi\\s*=\\s*3\\.14159\\s*;/ Keep: const float pi = 3.14159;'],
    }),

    /* ------------------------------------------------- 3. calculating: cmath and algorithm */
    part('p3', 'Calculating: operators, cmath and algorithm', '35 min'),
    task('t3-1', 'Values', '10 min', 'Type the value, or exactly what the program prints.'),
    val('v-round', 'What does `round(5.5)` return?', 'cout << round(5.5);', ['6', '6.0']),
    val('v-ceil', 'What does `ceil(4.1)` return?', 'cout << ceil(4.1);', ['5', '5.0']),
    out('o-cmath', 'What does this print? (Lecture 3)', 'cout << max(2,3);\ncout << "\\n";\ncout << pow(2,3);\ncout << "\\n";\ncout << floor(4.51);\ncout << "\\n";\ncout << sqrt(25);\ncout << "\\n";\ncout << sqrt(pow(2,3));\ncout << "\\n";'),
    out('o-mod', 'What does this print?', 'cout << 17 % 5 << " " << 17 / 5 << " " << 17 / 5.0;'),
    out('o-rounding', 'What does this print?', 'cout << round(2.5) << " " << floor(-2.5) << " " << ceil(-2.5);'),
    out('o-minmax', 'What does this print?', 'cout << min(4, 9) << " " << max(-1, -7);'),
    task('t3-2', 'Programs 1, 2, 9, 11 and 12', '25 min', 'Write each program. Your program may say hello and goodbye, but it must print the line shown, exactly.'),
    prog('w-product', {
      title: 'Program 1: the product of two numbers',
      goal: 'The user enters two whole numbers. Print `the product is: ` and their product.\n\n- `3 5` → `the product is: 15`',
      checks: ['3 and 5 :: in 3 5; expect the product is: 15', '-2 and 4 :: in -2 4; expect the product is: -8', '0 and 9 :: in 0 9; expect the product is: 0'],
    }),
    prog('w-sum5', {
      title: 'Program 2: the sum of five numbers',
      goal: 'The user enters five whole numbers. Print `the sum is: ` and their sum.\n\n- `1 2 3 4 5` → `the sum is: 15`',
      checks: ['1 to 5 :: in 1 2 3 4 5; expect the sum is: 15', 'With negatives :: in 10 -5 0 7 8; expect the sum is: 20', 'Mostly zeros :: in 0 0 0 0 1; expect the sum is: 1'],
    }),
    prog('w-rect', {
      title: 'Program 9: the area of a rectangle',
      goal: 'The user enters the width and the height of a rectangle (they can have decimals). Print `the area is: ` and the area.\n\n- `2.5 4` → `the area is: 10`',
      checks: ['3 by 4 :: in 3 4; expect the area is: 12', '2.5 by 4 :: in 2.5 4; expect the area is: 10', '1.5 by 1.5 :: in 1.5 1.5; expect the area is: 2.25', 'Keeps decimals :: code /\\b(float|double)\\b/ The sides can have decimals: use float or double.'],
    }),
    prog('w-circle', {
      title: 'Program 12: the circumference of a circle',
      goal: 'The user enters the radius of a circle. Print `the circumference is: ` and the circumference (2 × pi × radius). Declare `const float pi = 3.14159;`.\n\n- `1` → `the circumference is: 6.28318`',
      checks: ['Radius 1 :: in 1; expect the circumference is: 6.28318', 'Radius 2.5 :: in 2.5; expect the circumference is: 15.708', 'Radius 0 :: in 0; expect the circumference is: 0', 'pi is a const :: code /const\\s+(float|double)\\s+pi\\s*=\\s*3\\.14159/ Declare const float pi = 3.14159;'],
    }),
    prog('w-hexagon', {
      title: 'Program 11: the area of a hexagon',
      goal: 'The user enters the length of a side of a regular hexagon. Print `the area is: ` and the area.\n\nThe area of a regular hexagon is (3 × √3 ÷ 2) × side × side.\n\n- `2` → `the area is: 10.3923`',
      checks: ['Side 2 :: in 2; expect the area is: 10.3923', 'Side 1 :: in 1; expect the area is: 2.59808', 'Side 3.5 :: in 3.5; expect the area is: 31.8264', 'Uses sqrt :: code /sqrt\\s*\\(/ Use sqrt from cmath for √3.'],
    }),

    /* ------------------------------------------------------------- 4. choosing: if / else */
    part('p4', 'Choosing: if / else', '35 min'),
    task('t4-1', 'Follow the conditions', '10 min', 'Type exactly what each program prints.'),
    out('o-charcmp', 'What does this print? (Lecture 4)', "if ('a' > 'b') cout << \"yes\\n\"; else cout << \"no\\n\";\nif ('a' == 'b') cout << \"yes\\n\"; else cout << \"no\\n\";\nif ('a' != 'b') cout << \"yes\\n\"; else cout << \"no\\n\";"),
    out('o-quiz-cd', 'What is the output of this statement?', "if ('c' > 'd') { cout << \"yes\\n\"; } else { cout << \"no\\n\"; }"),
    out('o-and', 'What does this print?', 'int x = 5;\nif (x > 3 and x < 10) cout << "in";\nelse cout << "out";'),
    out('o-elseif', 'What does this print?', 'int t = 25;\nif (t > 30) cout << "hot";\nelse if (t > 20) cout << "warm";\nelse cout << "cold";'),
    inp('i-median', 'Type three numbers the user could enter so that this program prints `median is: 7`.', 'int a, b, c;\ncin >> a >> b >> c;\nif (a < b) {\n    if (c > b) cout << "median is: " << b;\n    else if (c < a) cout << "median is: " << a;\n    else cout << "median is: " << c;\n} else {\n    if (c > a) cout << "median is: " << a;\n    else if (c < b) cout << "median is: " << b;\n    else cout << "median is: " << c;\n}', 'median is: 7'),
    task('t4-2', 'Program 7 and even or odd', '25 min', 'Write each program. Test it with equal numbers too.'),
    prog('w-median', {
      title: 'Program 7: the median of three numbers',
      goal: 'The user enters three whole numbers. Print `median is: ` and the median (the middle number). It must also work when some of the numbers are equal.\n\n- `5 2 9` → `median is: 5`\n- `2 2 5` → `median is: 2`',
      checks: [
        '1 2 3 :: in 1 2 3; expect median is: 2', '1 3 2 :: in 1 3 2; expect median is: 2', '2 1 3 :: in 2 1 3; expect median is: 2',
        '2 3 1 :: in 2 3 1; expect median is: 2', '3 1 2 :: in 3 1 2; expect median is: 2', '3 2 1 :: in 3 2 1; expect median is: 2',
        '5 2 9 :: in 5 2 9; expect median is: 5', 'Negative numbers :: in -1 -5 0; expect median is: -1',
        '2 2 2 :: in 2 2 2; expect median is: 2', '2 2 5 :: in 2 2 5; expect median is: 2', '5 2 2 :: in 5 2 2; expect median is: 2', '3 7 3 :: in 3 7 3; expect median is: 3',
        'Uses if / else :: code /\\bif\\b/ Choose the median with if and else.',
      ],
    }),
    prog('w-even', {
      title: 'Even or odd',
      goal: 'The user enters a whole number. Print `the number is even` or `the number is odd`.\n\n- `4` → `the number is even`\n- `7` → `the number is odd`',
      checks: [
        '4 :: in 4; expect the number is even; not the number is odd', '7 :: in 7; expect the number is odd; not the number is even',
        '0 :: in 0; expect the number is even; not the number is odd', '-3 :: in -3; expect the number is odd; not the number is even',
        '-8 :: in -8; expect the number is even; not the number is odd', 'Uses % :: code /%/ Use % (the remainder).',
      ],
    }),

    /* ------------------------------------------------------------------ 5. characters */
    part('p5', 'Characters', '25 min'),
    task('t5-1', 'Characters are numbers', '6 min', 'Type exactly what each program prints.'),
    out('o-char-b', 'What does this print?', "char c = 'b';\ncout << (char)(c - 32);"),
    out('o-char-cmp', 'What does this print?', "cout << ('B' < 'a') << \" \" << ('z' > 'Z');"),
    out('o-char-code', 'What does this print?', "char c = 'a';\nint n = c;\ncout << n << \" \" << (char)(n + 2);"),
    task('t5-2', 'Write it', '19 min', 'Write each program. Use what you learned in Lecture 4 about characters.'),
    prog('w-upper', {
      title: 'Lowercase to uppercase',
      goal: 'The user enters a lowercase letter. Print `The uppercase is: ` and the same letter in uppercase.\n\n- `a` → `The uppercase is: A`',
      checks: ['a :: in a; expect The uppercase is: A', 'm :: in m; expect The uppercase is: M', 'z :: in z; expect The uppercase is: Z', 'Uses the character codes :: nocode /toupper/ Use the character codes (Lecture 4), not toupper.'],
    }),
    prog('w-lower', {
      title: 'Uppercase to lowercase',
      goal: 'The user enters an uppercase letter. Print `The lowercase is: ` and the same letter in lowercase.\n\n- `Q` → `The lowercase is: q`',
      checks: ['A :: in A; expect The lowercase is: a', 'Q :: in Q; expect The lowercase is: q', 'Z :: in Z; expect The lowercase is: z', 'Uses the character codes :: nocode /tolower/ Use the character codes (Lecture 4), not tolower.'],
    }),
    prog('w-isdigit', {
      title: 'Is it a digit?',
      goal: 'The user enters one character. Print `is a digit` if it is one of 0 to 9, otherwise print `is not a digit`.\n\n- `7` → `is a digit`\n- `a` → `is not a digit`',
      checks: [
        '7 :: in 7; expect is a digit; not is not a digit', '0 :: in 0; expect is a digit; not is not a digit', '9 :: in 9; expect is a digit; not is not a digit',
        'a :: in a; expect is not a digit', '# :: in #; expect is not a digit', 'Compares characters :: nocode /isdigit/ Compare the characters yourself (Lecture 4), not isdigit.',
      ],
    }),

    /* --------------------------------------------------------------------- 6. strings */
    part('p6', 'Strings', '40 min'),
    task('t6-1', 'Read the string', '12 min', 'Type exactly what each program prints, or the value asked for.'),
    out('o-hello-ops', 'What does this print? (Lecture 4)', 'string s = "hello";\ncout << s.length() << " " << s.find(\'e\') << " " << s.find(\'l\') << " " << s.find("el");'),
    out('o-hello-idx', 'What does this print?', 'string s = "hello";\ncout << s[0] << s[3] << " " << s.substr(1, 3);'),
    out('o-liverpool', 'What does this print?', 'string s = "Liverpool";\ncout << s.substr(5) << " " << s.substr(0, 5);'),
    val('v-find-o', 'What is **j**?', 'string line = "Introduction to Computing";\nint j = line.find(\'o\');', ['4']),
    val('v-find-sub', 'What is **j**?', 'string s, sub;\ns = "Introduction to Computing";\nsub = s.substr(14);\nint j = s.find(\'o\');', ['4']),
    inp('i-npos', 'Type a string the user could enter so that this program prints `2`.', 'string s;\ncin >> s;\nint j = s.find(\'z\');\nif (j != std::string::npos) {\n    cout << "1\\n";\n} else {\n    cout << "2\\n";\n}', '2'),
    out('o-stoi', 'What does this print?', 'string a = "12";\nstring b = "30";\ncout << a + b << " " << stoi(a) + stoi(b);'),
    task('t6-2', 'Write it', '28 min', 'Write each program. The user types a word or a line of text.'),
    prog('w-length', {
      title: 'The length of a word',
      goal: 'The user enters a word. Print `the length is: ` and the number of characters in it.\n\n- `test` → `the length is: 4`',
      checks: ['test :: in test; expect the length is: 4', 'University :: in University; expect the length is: 10', 'a :: in a; expect the length is: 1', 'Uses length :: code /length\\s*\\(\\s*\\)|size\\s*\\(\\s*\\)/ Use the length of the string.'],
    }),
    prog('w-fourth', {
      title: 'The fourth character',
      goal: 'The user enters a word with at least 4 characters. Print `the fourth character is: ` and the character at position 3.\n\n- `University` → `the fourth character is: v`',
      checks: ['University :: in University; expect the fourth character is: v', 'Liverpool :: in Liverpool; expect the fourth character is: e', 'test :: in test; expect the fourth character is: t', 'Uses an index :: code /\\[\\s*3\\s*\\]|\\.at\\s*\\(\\s*3\\s*\\)/ Use the position: s[3] or s.at(3).'],
    }),
    prog('w-rest', {
      title: 'From position 5 to the end',
      goal: 'The user enters a word with more than 5 characters. Print `the rest is: ` and the part of the word from position 5 to the end.\n\n- `Liverpool` → `the rest is: pool`',
      checks: ['Liverpool :: in Liverpool; expect the rest is: pool', 'Introduction :: in Introduction; expect the rest is: duction', 'University :: in University; expect the rest is: rsity', 'Uses substr :: code /substr\\s*\\(/ Use substr.'],
    }),
    prog('w-getline', {
      title: 'A footballer’s name',
      goal: 'Ask the user for a footballer’s name (it can have a space). Print `You typed: ` and the whole name.\n\n- `Mohamed Salah` → `You typed: Mohamed Salah`',
      checks: ['Two names :: in Mohamed Salah; expect You typed: Mohamed Salah', 'One name :: in Pele; expect You typed: Pele', 'Three names :: in Ahmed Hassan Ali; expect You typed: Ahmed Hassan Ali', 'Reads the whole line :: code /getline\\s*\\(\\s*cin/ Read the whole line with getline.'],
    }),
    prog('w-stoi', {
      title: 'Text to a number',
      goal: 'Read a whole number into a **string** with getline. Change it to an int and print `the next number is: ` and the number + 1.\n\n- `42` → `the next number is: 43`',
      checks: ['42 :: in 42; expect the next number is: 43', '-1 :: in -1; expect the next number is: 0', '99 :: in 99; expect the next number is: 100', 'Reads text :: code /getline\\s*\\(/ Read the number as text with getline.', 'Uses stoi :: code /stoi\\s*\\(/ Change the text to an int with stoi.'],
    }),
    prog('w-tostring', {
      title: 'A number to text',
      goal: 'The user enters a whole number n. Make the text `n=` followed by the number (for example `n=42`) with `to_string`, and save it in a string. Then print two lines: `the text is: ` and the text, then `its length is: ` and its length.\n\n- `42` → `the text is: n=42` and `its length is: 4`',
      checks: ['42 :: in 42; expect the text is: n=42; expect its length is: 4', '7 :: in 7; expect the text is: n=7; expect its length is: 3', '1000 :: in 1000; expect the text is: n=1000; expect its length is: 6', 'Uses to_string :: code /to_string\\s*\\(/ Make the text with to_string.'],
    }),

    /* ----------------------------------------------- 7. string programs (programs 15–20) */
    part('p7', 'Programs with strings', '60 min'),
    task('t7-1', 'Is it there?', '20 min', 'Write each program. The user types one line of text: read it with getline.'),
    prog('w-hasdigit', {
      title: 'Does the string contain a digit? (Lecture 2)',
      goal: 'The user enters a line of text. Print `contains a digit` if it has at least one digit (0 to 9), otherwise print `no digit`.\n\n- `xab1cfgh` → `contains a digit`\n- `xabdcfgh` → `no digit`',
      checks: [
        'xab1cfgh :: in xab1cfgh; expect contains a digit; not no digit', 'xabdcfgh :: in xabdcfgh; expect no digit; not contains a digit',
        '9 :: in 9; expect contains a digit; not no digit', 'abc0 :: in abc0; expect contains a digit; not no digit',
        'Five 5 :: in Five 5; expect contains a digit; not no digit', 'Zero :: in Zero; expect no digit; not contains a digit', 'Uses find :: code /find\\s*\\(/ Look for each digit with find.',
      ],
    }),
    prog('w-dash', {
      title: 'Program 15: a negative number or a dash',
      goal: 'The user enters a line of text. Print `contains a dash` if it has a `-` (a dash, or the minus of a negative number), otherwise print `no dash`.\n\n- `-5` → `contains a dash`',
      checks: ['-5 :: in -5; expect contains a dash; not no dash', 'a-b :: in a-b; expect contains a dash; not no dash', 'It is -3 today :: in It is -3 today; expect contains a dash; not no dash', '45 :: in 45; expect no dash; not contains a dash', 'Uses find :: code /find\\s*\\(/ Use find.'],
    }),
    prog('w-question', {
      title: 'Program 18: a statement or a question',
      goal: 'The user enters a sentence that ends with `.` or `?`. Print `interrogative` if it is a question (it ends with `?`), otherwise print `declarative`.\n\n- `Is it raining?` → `interrogative`\n- `It is raining.` → `declarative`',
      checks: ['Is it raining? :: in Is it raining?; expect interrogative; not declarative', 'It is raining. :: in It is raining.; expect declarative; not interrogative', 'Who are you? :: in Who are you?; expect interrogative; not declarative', 'Hello. :: in Hello.; expect declarative; not interrogative', 'Looks at the last character :: code /length\\s*\\(\\s*\\)|size\\s*\\(\\s*\\)/ Use the length to find the last character.'],
    }),
    prog('w-words', {
      title: 'Program 19: more than one word',
      goal: 'The user enters a line (words are separated by one space). Print `multiple words` if it has more than one word, otherwise print `one word`.\n\n- `hello world` → `multiple words`',
      checks: ['hello world :: in hello world; expect multiple words; not one word', 'hello :: in hello; expect one word; not multiple words', 'a b c :: in a b c; expect multiple words; not one word', 'Reads the whole line :: code /getline\\s*\\(/ Read the whole line with getline.'],
    }),
    prog('w-three', {
      title: 'Program 20: at least three words',
      goal: 'The user enters a line (words are separated by one space). Print `at least three words` if it has three words or more, otherwise print `fewer than three words`.\n\n- `one two three` → `at least three words`\n- `one two` → `fewer than three words`',
      checks: ['one two three :: in one two three; expect at least three words; not fewer than three words', 'one two :: in one two; expect fewer than three words; not at least three words', 'one :: in one; expect fewer than three words; not at least three words', 'a b c d :: in a b c d; expect at least three words; not fewer than three words', 'Uses substr :: code /substr\\s*\\(/ Cut the line with substr.'],
    }),
    prog('w-decimal', {
      title: 'Program 16: a decimal number in a line of text',
      goal: 'The user enters a line of text with at most one `.` in it. A decimal number is a `.` with a digit just before it and a digit just after it, like `3.14`. Print `contains a decimal number` or `no decimal number`.\n\n- `pi is 3.14` → `contains a decimal number`\n- `end.` → `no decimal number`',
      checks: [
        'pi is 3.14 :: in pi is 3.14; expect contains a decimal number; not no decimal number', '2.5 :: in 2.5; expect contains a decimal number; not no decimal number',
        'end. :: in end.; expect no decimal number; not contains a decimal number', '.5 :: in .5; expect no decimal number; not contains a decimal number',
        '3. :: in 3.; expect no decimal number; not contains a decimal number', 'no dot :: in no dots here; expect no decimal number; not contains a decimal number',
      ],
    }),
    task('t7-2', 'Cut it up', '40 min', 'Write each program. Use find to find the position, substr to cut, and stoi when you need a number.'),
    prog('w-football', {
      title: 'Program 17: a win or a draw',
      goal: 'The user enters a football score as two numbers with a `-` between them, like `2-1`. Print `draw` if both teams scored the same, otherwise print `win`.\n\n- `2-1` → `win`\n- `1-1` → `draw`',
      checks: ['2-1 :: in 2-1; expect win; not draw', '1-1 :: in 1-1; expect draw; not win', '0-3 :: in 0-3; expect win; not draw', '3-3 :: in 3-3; expect draw; not win', '10-2 :: in 10-2; expect win; not draw', '2-12 :: in 2-12; expect win; not draw', 'Uses stoi :: code /stoi\\s*\\(/ Change the two scores to numbers with stoi.'],
    }),
    prog('w-names', {
      title: 'First and second name (and Pele)',
      goal: 'The user enters a footballer’s name. If it has a space, print `first name: ` and the first name, then `second name: ` and the second name. If it has no space (like `Pele`), print `Only one name: ` and the name.\n\n- `Mohamed Salah` → `first name: Mohamed` and `second name: Salah`\n- `Pele` → `Only one name: Pele`',
      checks: [
        'Mohamed Salah :: in Mohamed Salah; expect first name: Mohamed; expect second name: Salah', 'Lionel Messi :: in Lionel Messi; expect first name: Lionel; expect second name: Messi',
        'Pele :: in Pele; expect Only one name: Pele; not second name', 'Checks for npos :: code /npos/ When there is no space, find gives string::npos: check for it.',
      ],
    }),
    prog('w-email', {
      title: 'Is it an email address? (Lecture 4)',
      goal: 'The user enters a string. It is an email address when:\n\n1. it contains `@`, and\n2. there is something before the `@` and something after it, and\n3. the part after the `@` contains a `.`, and\n4. there is something before that `.` and something after it.\n\nPrint `is an email address` or `is not an email address`.',
      checks: [
        'gerard.mckee@bue.edu.eg :: in gerard.mckee@bue.edu.eg; expect is an email address; not is not an email address',
        'a@b.c :: in a@b.c; expect is an email address; not is not an email address',
        'www.bue.edu.eg :: in www.bue.edu.eg; expect is not an email address', '@ :: in @; expect is not an email address', 'gerard@ :: in gerard@; expect is not an email address',
        'gerard@. :: in gerard@.; expect is not an email address', 'gerard@somewhere :: in gerard@somewhere; expect is not an email address', 'grd@xyzabc :: in grd@xyzabc; expect is not an email address',
        '@bue.edu.eg :: in @bue.edu.eg; expect is not an email address', 'gerard@.eg :: in gerard@.eg; expect is not an email address', 'gerard@bue. :: in gerard@bue.; expect is not an email address',
      ],
    }),
    prog('w-tld', {
      title: 'The top-level domain',
      goal: 'The user enters an email address. The part after the `@` always has exactly two dots, like `bue.edu.eg`. Print `the TLD is: ` and the top-level domain (the part after the last dot).\n\n- `gerard.mckee@bue.edu.eg` → `the TLD is: eg`',
      checks: ['gerard.mckee@bue.edu.eg :: in gerard.mckee@bue.edu.eg; expect the TLD is: eg', 'student@cs.mit.edu :: in student@cs.mit.edu; expect the TLD is: edu', 'ali@mail.yahoo.com :: in ali@mail.yahoo.com; expect the TLD is: com', 'Uses find and substr :: nocode /rfind/ Use find and substr (Lecture 4).'],
    }),
    prog('w-edu', {
      title: 'The web site of an educational institution',
      goal: 'The user enters a web site address. Print `is educational` if it contains `.edu`, otherwise print `is not educational`.\n\n- `www.bue.edu.eg` → `is educational`',
      checks: ['www.bue.edu.eg :: in www.bue.edu.eg; expect is educational; not is not educational', 'mit.edu :: in mit.edu; expect is educational; not is not educational', 'www.google.com :: in www.google.com; expect is not educational', 'edu.com :: in edu.com; expect is not educational'],
    }),
    val('v-tld', 'Where is the top-level domain (TLD) in an email address? Type the TLD of `gerard.mckee@bue.edu.eg`.', '', ['eg', '.eg']),

    /* -------------------------------------------- 8. vectors (programs 21–25 and 29) */
    part('p8', 'Vectors', '45 min'),
    task('t8-1', 'Programs 21, 22 and 25', '20 min', 'A two-dimensional vector is typed like `<3, 4>`: `<`, a number, a comma, a number, `>`. There can be a space after the comma, so read the whole line with getline.'),
    prog('w-vector', {
      title: 'Program 21: is it a two-dimensional vector?',
      goal: 'The user enters a line. It is a two-dimensional vector when it contains `<`, then `>`, and between them a `,` with something on both sides of the comma. Print `correct format` or `wrong format`.\n\n- `<2, 3>` → `correct format`\n- `2,3>` → `wrong format`',
      checks: [
        '<2, 3> :: in <2, 3>; expect correct format; not wrong format', '<-2, 3> :: in <-2, 3>; expect correct format; not wrong format', '<2,-3> :: in <2,-3>; expect correct format; not wrong format',
        '2,3> :: in 2,3>; expect wrong format; not correct format', '<2 3> :: in <2 3>; expect wrong format; not correct format', '<, 3> :: in <, 3>; expect wrong format; not correct format',
        '<2,> :: in <2,>; expect wrong format; not correct format', '<2,3 :: in <2,3; expect wrong format; not correct format', 'Checks for npos :: code /npos/ Check what find gives when it does not find a character.',
      ],
    }),
    prog('w-modulus', {
      title: 'Program 22: the modulus of a two-dimensional vector',
      goal: 'The user enters a vector like `<3, 4>` (whole numbers). Print `the modulus is: ` and its modulus: √(x² + y²).\n\n- `<3, 4>` → `the modulus is: 5`',
      checks: ['<3, 4> :: in <3, 4>; expect the modulus is: 5', '<-6, 8> :: in <-6, 8>; expect the modulus is: 10', '<1, 1> :: in <1, 1>; expect the modulus is: 1.41421', '<0, 0> :: in <0, 0>; expect the modulus is: 0', 'Uses sqrt :: code /sqrt\\s*\\(/ Use sqrt from cmath.'],
    }),
    prog('w-norm3', {
      title: 'Program 25: the norm of a three-dimensional vector',
      goal: 'The user enters a vector like `<1, 2, 2>` (three whole numbers). Print `the norm is: ` and its norm: √(x² + y² + z²).\n\n- `<1, 2, 2>` → `the norm is: 3`',
      checks: ['<1, 2, 2> :: in <1, 2, 2>; expect the norm is: 3', '<2, 3, 6> :: in <2, 3, 6>; expect the norm is: 7', '<1, 1, 1> :: in <1, 1, 1>; expect the norm is: 1.73205', '<-2, 0, 0> :: in <-2, 0, 0>; expect the norm is: 2'],
    }),
    task('t8-2', 'Programs 23, 24 and 29', '25 min', 'The user enters two vectors, one on each line, like `<1, 2>` and then `<3, 4>`.'),
    prog('w-vecsum', {
      title: 'Program 23: the sum of two vectors',
      goal: 'Print `the sum is: ` and the sum as a vector, written like `<4, 6>` (a comma and a space between the numbers).\n\n- `<1, 2>` and `<3, 4>` → `the sum is: <4, 6>`',
      checks: ['<1, 2> + <3, 4> :: in <1, 2>\\n<3, 4>; expect the sum is: <4, 6>', '<-1, 5> + <1, -5> :: in <-1, 5>\\n<1, -5>; expect the sum is: <0, 0>', '<10, 20> + <5, 7> :: in <10, 20>\\n<5, 7>; expect the sum is: <15, 27>'],
    }),
    prog('w-dot', {
      title: 'Program 24: the dot product of two vectors',
      goal: 'Print `the dot product is: ` and x1 × x2 + y1 × y2.\n\n- `<1, 2>` and `<3, 4>` → `the dot product is: 11`',
      checks: ['<1, 2> . <3, 4> :: in <1, 2>\\n<3, 4>; expect the dot product is: 11', '<2, -1> . <1, 2> :: in <2, -1>\\n<1, 2>; expect the dot product is: 0', '<-3, 4> . <5, 6> :: in <-3, 4>\\n<5, 6>; expect the dot product is: 9'],
    }),
    prog('w-orth', {
      title: 'Program 29: are the two vectors orthogonal?',
      goal: 'Two vectors are orthogonal when their dot product is 0. Print `are orthogonal` or `are not orthogonal`.\n\n- `<1, 0>` and `<0, 1>` → `are orthogonal`',
      checks: ['<1, 0> and <0, 1> :: in <1, 0>\\n<0, 1>; expect are orthogonal; not are not orthogonal', '<1, 2> and <2, -1> :: in <1, 2>\\n<2, -1>; expect are orthogonal; not are not orthogonal', '<1, 2> and <3, 4> :: in <1, 2>\\n<3, 4>; expect are not orthogonal', '<-3, 4> and <4, 3> :: in <-3, 4>\\n<4, 3>; expect are orthogonal; not are not orthogonal'],
    }),

    /* -------------------------------- 9. complex numbers and quaternions (26–28 and 30) */
    part('p9', 'Complex numbers and quaternions', '45 min'),
    task('t9-1', 'Programs 26, 27 and 28', '25 min', 'A complex number is typed as `a + bi` or `a - bi`: a number, a space, `+` or `-`, a space, then a number followed by `i`. For example `3 + 4i` or `-3 - 4i`. Read the whole line with getline.'),
    prog('w-complex', {
      title: 'Program 26: is it a complex number?',
      goal: 'Print `is a complex number` if the line has that format, otherwise print `is not a complex number`.\n\n- `3 + 4i` → `is a complex number`\n- `3 + 4` → `is not a complex number`',
      checks: [
        '3 + 4i :: in 3 + 4i; expect is a complex number; not is not a complex number', '-3 - 4i :: in -3 - 4i; expect is a complex number; not is not a complex number',
        '12 - 7i :: in 12 - 7i; expect is a complex number; not is not a complex number', '3 + 4 :: in 3 + 4; expect is not a complex number',
        '3 * 4i :: in 3 * 4i; expect is not a complex number', '3+4i :: in 3+4i; expect is not a complex number', '3 + i :: in 3 + i; expect is not a complex number',
      ],
    }),
    prog('w-parts', {
      title: 'Program 27: the real and imaginary parts',
      goal: 'The user enters a complex number in the format above. Print `real part: ` and the real part, then `imaginary part: ` and the imaginary part (with its sign).\n\n- `3 + 4i` → `real part: 3` and `imaginary part: 4`\n- `-3 - 4i` → `real part: -3` and `imaginary part: -4`',
      checks: ['3 + 4i :: in 3 + 4i; expect real part: 3; expect imaginary part: 4', '-3 - 4i :: in -3 - 4i; expect real part: -3; expect imaginary part: -4', '5 + 12i :: in 5 + 12i; expect real part: 5; expect imaginary part: 12', '7 - 2i :: in 7 - 2i; expect real part: 7; expect imaginary part: -2'],
    }),
    prog('w-conj', {
      title: 'Program 28: the complex conjugate',
      goal: 'The conjugate of `a + bi` is `a - bi`, and the conjugate of `a - bi` is `a + bi`. Print `the conjugate is: ` and the conjugate in the same format.\n\n- `3 + 4i` → `the conjugate is: 3 - 4i`',
      checks: ['3 + 4i :: in 3 + 4i; expect the conjugate is: 3 - 4i', '-3 - 4i :: in -3 - 4i; expect the conjugate is: -3 + 4i', '5 + 12i :: in 5 + 12i; expect the conjugate is: 5 - 12i'],
    }),
    task('t9-2', 'Program 30', '20 min', 'A quaternion is typed as `a + bi + cj + dk`, with whole numbers (0 or more) and ` + ` between the parts, like `1 + 2i + 3j + 4k`.'),
    prog('w-quat', {
      title: 'Program 30: what kind of quaternion?',
      goal: 'It is a **real quaternion** when b, c and d are all 0, like `5 + 0i + 0j + 0k`. It is a **pure quaternion** when a is 0, like `0 + 2i + 3j + 4k`. Otherwise it is a general quaternion. Print `is a real quaternion`, `is a pure quaternion` or `is a quaternion`.',
      checks: [
        '1 + 2i + 3j + 4k :: in 1 + 2i + 3j + 4k; expect is a quaternion; not is a real quaternion; not is a pure quaternion',
        '5 + 0i + 0j + 0k :: in 5 + 0i + 0j + 0k; expect is a real quaternion; not is a pure quaternion',
        '0 + 2i + 3j + 4k :: in 0 + 2i + 3j + 4k; expect is a pure quaternion; not is a real quaternion',
        '7 + 0i + 1j + 0k :: in 7 + 0i + 1j + 0k; expect is a quaternion; not is a real quaternion; not is a pure quaternion',
        '12 + 0i + 0j + 0k :: in 12 + 0i + 0j + 0k; expect is a real quaternion; not is a pure quaternion',
      ],
    }),

    /* ----------------------------------- 10. sets of numbers (programs 3–6 and 8) */
    part('p10', 'Sets of numbers, without loops', '50 min'),
    task('t10-1', 'Programs 3 and 4', '25 min', 'In Part 1 there are no loops, so think: how can sequence and selection handle “the user first enters how many numbers”? The user enters a count from 1 to 5, then that many whole numbers.'),
    prog('w-setsum', {
      title: 'Program 3: the sum of a set of numbers',
      goal: 'The user first enters how many numbers (1 to 5), then the numbers. Print `the sum is: ` and their sum.\n\n- `3 1 2 3` → `the sum is: 6`',
      checks: ['3 numbers :: in 3 1 2 3; expect the sum is: 6', '5 numbers :: in 5 1 2 3 4 5; expect the sum is: 15', '1 number :: in 1 7; expect the sum is: 7', 'With a negative :: in 2 -4 10; expect the sum is: 6', '4 numbers :: in 4 10 20 30 40; expect the sum is: 100', 'Uses selection :: code /\\bif\\b/ Use if to read only as many numbers as the user said.'],
    }),
    prog('w-setavg', {
      title: 'Program 4: the average of a set of numbers',
      goal: 'The user first enters how many numbers (1 to 5), then the numbers. Print `the average is: ` and their average.\n\n- `2 3 4` → `the average is: 3.5`',
      checks: ['2 numbers :: in 2 3 4; expect the average is: 3.5', '3 numbers :: in 3 1 2 4; expect the average is: 2.33333', '1 number :: in 1 9; expect the average is: 9', '5 numbers :: in 5 1 2 3 4 5; expect the average is: 3', 'Uses selection :: code /\\bif\\b/ Use if to read only as many numbers as the user said.'],
    }),
    task('t10-2', 'Programs 5, 6 and 8', '25 min', 'The user enters three whole numbers. The standard deviation of three numbers a, b and c with average m is √(((a − m)² + (b − m)² + (c − m)²) ÷ 3).'),
    prog('w-sd', {
      title: 'Programs 5 and 6: the average and the standard deviation',
      goal: 'Print `the average is: ` and the average, then `the standard deviation is: ` and the standard deviation.\n\n- `2 4 6` → `the average is: 4` and `the standard deviation is: 1.63299`',
      checks: ['2 4 6 :: in 2 4 6; expect the average is: 4; expect the standard deviation is: 1.63299', '5 5 5 :: in 5 5 5; expect the average is: 5; expect the standard deviation is: 0', '1 2 3 :: in 1 2 3; expect the average is: 2; expect the standard deviation is: 0.816497', '1 2 4 :: in 1 2 4; expect the average is: 2.33333; expect the standard deviation is: 1.24722', 'Uses sqrt :: code /sqrt\\s*\\(/ Use sqrt from cmath.'],
    }),
    prog('w-stats3', {
      title: 'Program 8: the average, the standard deviation and the median',
      goal: 'Print three lines: `the average is: `, `the standard deviation is: ` and `the median is: `, each with its value.\n\n- `9 1 5` → `the average is: 5`, `the standard deviation is: 3.26599`, `the median is: 5`',
      checks: [
        '2 4 6 :: in 2 4 6; expect the average is: 4; expect the standard deviation is: 1.63299; expect the median is: 4',
        '9 1 5 :: in 9 1 5; expect the average is: 5; expect the standard deviation is: 3.26599; expect the median is: 5',
        '3 3 9 :: in 3 3 9; expect the average is: 5; expect the standard deviation is: 2.82843; expect the median is: 3',
        '7 2 7 :: in 7 2 7; expect the median is: 7',
      ],
    }),

    { id: 'wrap', type: 'checkpoint', data: { body: '**Before you finish:** go back to every question that is not ticked and try it again. Your answers and your code are saved in this browser.' } },
  ]);
}
