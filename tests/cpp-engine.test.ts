// The browser C++ of Introduction to Computing: every lecture program runs and prints what Visual Studio prints,
// every quiz answer is what C++ really gives, and the classic mistakes get the right, friendly error.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile, Machine, run, formatG } from '../src/lab/cpp/index.ts';

const main = (body: string, includes = '#include <iostream>\n#include <string>\n#include <cmath>\n#include <algorithm>\n') =>
  `${includes}using namespace std;\nint main() {\n${body}\n  return 0;\n}\n`;
const out = (src: string, input = '') => {
  const r = run(src, input);
  assert.equal(r.status, 'done', `expected the program to run: ${JSON.stringify(r.error)}`);
  return r.output;
};
const compileError = (src: string) => {
  const c = compile(src);
  assert.equal(c.ok, false, 'expected a compile error');
  return c.ok ? null : c.errors[0];
};

/* ----------------------------------------------------------- Lecture 3 */

const PRODUCT = `#include <iostream>
using namespace std;
int main () {
    int num1, num2, product;
    cout << "Hello, I calculate the product of two numbers\\n";
    cout << "please enter two numbers: ";
    cin >> num1; cin >> num2; // for example, 2 4
    product = num1 * num2;
    cout << "the product is: "; cout << product; cout << "\\n";
    cout << "Goodbye\\n";
    return 0;
}`;

test('Lecture 3: the product program', () => {
  assert.equal(out(PRODUCT, '3 5'), 'Hello, I calculate the product of two numbers\nplease enter two numbers: the product is: 15\nGoodbye\n');
  assert.match(out(PRODUCT, '3\n5\n'), /the product is: 15/);
});

test('Lecture 3: cmath and algorithm print like Visual Studio', () => {
  const src = `#include <iostream>
#include <cmath>
#include <algorithm>
using namespace std;
int main () {
    cout << max(2,3); cout << "\\n";
    cout << pow(2,3); cout << "\\n";
    cout << floor(4.51); cout << "\\n";
    cout << sqrt(25); cout << "\\n";
    cout << sqrt(pow(2,3)); cout << "\\n";
    return 0;
}`;
  assert.equal(out(src), '3\n8\n4\n5\n2.82843\n');
});

test('Lecture 3: assignment and compound assignment', () => {
  const steps = ['x = x + 2;', 'x += 4;', 'x++;', 'x--;', 'x-=4;', 'x*=2;', 'x/=2;', 'x%=2;'];
  const expected = [5, 9, 10, 9, 5, 10, 5, 1];
  const body = `int x = 3;\n${steps.map((s) => `${s} cout << x << " ";`).join('\n')}`;
  assert.equal(out(main(body)), `${expected.join(' ')} `);
});

const MEDIAN6 = `#include <iostream>
using namespace std;
int main () {
 int num1, num2, num3;
 cout << "hello, I find the median of three numbers\\n";
 cout << "Please enter three numbers: ";
 cin >> num1; cin >> num2; cin >> num3;
 if (num1 < num2 and num2 < num3) {cout << "median is: "; cout << num2; cout << "\\n";}
 if (num1 < num3 and num3 < num2) {cout << "median is: "; cout << num3; cout << "\\n";}
 if (num2 < num1 and num1 < num3) {cout << "median is: "; cout << num1; cout << "\\n";}
 if (num2 < num3 and num3 < num1) {cout << "median is: "; cout << num3; cout << "\\n";}
 if (num3 < num1 and num1 < num2) {cout << "median is: "; cout << num1; cout << "\\n";}
 if (num3 < num2 and num2 < num1) {cout << "median is: "; cout << num2; cout << "\\n";}
 cout << "I hope I have been helpful to you. Have a nice day. \\n Goodbye \\n";
 return 0;
}`;

const MEDIAN_NESTED = `#include <iostream>
using namespace std;
int main () {
    int num1, num2, num3;
    cout << "hello, I find the median of three numbers\\n";
    cout << "Please enter three numbers: ";
    cin >> num1; cin >> num2;
    if (num1 < num2)
    {
        cin >> num3;
        if (num3 > num2)
        {
            cout << "median is: "; cout << num2; cout << "\\n";
        }
        else if (num3 < num1)
        {
            cout << "median is: "; cout << num1; cout << "\\n";
        }
        else
        {
            cout << "median is: "; cout << num3; cout << "\\n";
        }
    }
    else
    {
        cin >> num3;
        if (num3 > num1)
        {
            cout << "median is: "; cout << num1; cout << "\\n";
        }
        else if (num3 < num2)
        {
            cout << "median is: "; cout << num2; cout << "\\n";
        }
        else
        {
            cout << "median is: "; cout << num3; cout << "\\n";
        }
    }
    cout << "I hope I have been helpful to you. Goodbye \\n";
    return 0;
}`;

test('Lecture 2/3: both median programs find the median of every order of 1 2 3', () => {
  for (const order of ['1 2 3', '1 3 2', '2 1 3', '2 3 1', '3 1 2', '3 2 1']) {
    assert.match(out(MEDIAN6, order), /median is: 2\n/, `six ifs: ${order}`);
    assert.match(out(MEDIAN_NESTED, order), /median is: 2\n/, `nested: ${order}`);
  }
});

test('Lecture 3 question: equal numbers (2 2 2, 2 2 5)', () => {
  // the six strict tests never match equal numbers: no median is printed at all
  assert.doesNotMatch(out(MEDIAN6, '2 2 2'), /median is/);
  assert.doesNotMatch(out(MEDIAN6, '2 2 5'), /median is/);
  // the nested version always prints one
  assert.match(out(MEDIAN_NESTED, '2 2 2'), /median is: 2/);
  assert.match(out(MEDIAN_NESTED, '2 2 5'), /median is: 2/);
});

/* ----------------------------------------------------------- Lecture 4 */

test('Lecture 4: chars — an option, comparisons, and lowercase to uppercase', () => {
  const option = `#include <iostream>
using namespace std;
int main () {
    char option;
    cout << "Please select an option (1, 2, 3): ";
    cin >> option;
    cout << "you selected: "; cout << option; cout << "\\n";
    return 0;
}`;
  assert.match(out(option, '3'), /you selected: 3\n/);
  const compare = main(`if ('a' > 'b') cout << "yes\\n"; else cout << "no\\n";
if ('a' == 'b') cout << "yes\\n"; else cout << "no\\n";
if ('a' != 'b') cout << "yes\\n"; else cout << "no\\n";`);
  assert.equal(out(compare), 'no\nno\nyes\n');
  const upper = main(`char c;
cin >> c;
cout << "The uppercase is: "; cout << (char) (c - 32) ; cout << "\\n";
cout << (c - 32) << "\\n";`);
  assert.equal(out(upper, 'a'), 'The uppercase is: A\n65\n');
});

test('Lecture 4: the string slide (s = "hello")', () => {
  assert.equal(out(main(`string s = "hello";
cout << s.length() << " " << s.find('e') << " " << s.find('l') << " " << s.find("el") << " " << s[0] << " " << s[3] << " " << s.substr(1,3);`)), '5 1 2 1 h l ell');
  const r = run(main('string s = "hello";\ncout << s[7];'));
  assert.equal(r.status, 'error');
  assert.match(String(r.error?.message), /string subscript out of range/);
  // the slide's at(2) and substr(1,3) without "s." don't compile — and the message says why
  assert.match(compileError(main('string s = "hello";\ncout << at(2);'))!.message, /must be called on a string/);
  assert.match(compileError(main('string s = "hello";\ncout << substr(1,3);'))!.hint!, /s\.substr/);
});

const FOOTBALLER = `#include <iostream>
#include <string>
using namespace std;
int main () {
    string line, first, second;
    int sp_index;
    cout << "please enter a footballer's name,\\n";
    cout << " and I will separate it into first and second name: ";
    getline(cin, line);
    sp_index = line.find(' ');
    first = line.substr(0,sp_index);
    second = line.substr(sp_index+1);
    cout << "first name: "; cout << first; cout << "\\n";
    cout << "second name: "; cout << second; cout << "\\n";
    cout << "goodbye\\n";
    return 0;
}`;

test('Lecture 4: the footballer program, and what really happens with “Pele”', () => {
  assert.match(out(FOOTBALLER, 'Mohamed Salah\n'), /first name: Mohamed\nsecond name: Salah\n/);
  // no space: find gives npos → sp_index = -1 → substr(0, npos) and substr(0): both names are "Pele"
  assert.match(out(FOOTBALLER, 'Pele\n'), /first name: Pele\nsecond name: Pele\n/);
  // the stepper shows sp_index = 7 for Mohamed Salah
  const c = compile(FOOTBALLER);
  assert.ok(c.ok);
  const m = new Machine(c.ok ? c.program : (null as never), { input: 'Mohamed Salah\n' });
  m.run();
  assert.equal(m.vars().find((v) => v.name === 'sp_index')?.value.v, 7);
});

test('getline vs cin >>: cin stops at the space; getline after cin reads the leftover newline', () => {
  assert.equal(out(main('string s; cin >> s; cout << "[" << s << "]";'), 'Mohamed Salah\n'), '[Mohamed]');
  assert.equal(out(main('string s; getline(cin, s); cout << "[" << s << "]";'), 'Mohamed Salah\n'), '[Mohamed Salah]');
  assert.equal(out(main('int age; string name; cin >> age; getline(cin, name); cout << age << "[" << name << "]";'), '20\nAli\n'), '20[]');
});

/* ----------------------------------------------------------- Lecture 5 */

test('Lecture 5: npos tells whether a character was found', () => {
  const src = `#include <iostream>
#include <string>
using namespace std;
int main () {
    string line="<2,3>";
    string line1="2,3>";
    if (line.find('<') != string::npos) { cout << "'<' present\\n"; }
    else { cout << "'<' not present\\n"; }
    if (line1.find('<') != std::string::npos) { cout << "'<' present\\n"; }
    else { cout << "'<' not present\\n"; }
    return 0;
}`;
  assert.equal(out(src), "'<' present\n'<' not present\n");
  assert.equal(out(main('string s = "abc"; cout << s.find(\'z\');')), '18446744073709551615');
  assert.equal(out(main('cout << stoi("-23") + 1 << " " << stod("2.5") * 2 << " " << to_string(42) + "!";')), '-22 5 42!');
});

/* ------------------------------------------------------- the quizzes */

test('Lecture 4 quiz', () => {
  // Q1 char a = "a";
  const q1 = compileError(main('char a = "a";'))!;
  assert.match(q1.message, /is text \(a string\), but a is a char/);
  assert.match(q1.hint!, /'a'/);
  // Q2
  assert.equal(out(main(`if ('c' > 'd') { cout << "yes\\n"; } else { cout << "no\\n"; }`)), 'no\n');
  // Q3 – Q5
  assert.equal(out(main('string s = "test"; cout << s.length();')), '4');
  assert.equal(out(main('string s = "University"; cout << s[3] << s.at(3);')), 'vv');
  assert.equal(out(main('string s = "Liverpool"; cout << s.substr(5) << " " << s.substr(5, 4);')), 'pool pool');
  // Q6 getline
  assert.equal(out(main('string s; getline(cin, s); cout << s;'), 'Mohamed Salah\n'), 'Mohamed Salah');
  // Q7 the TLD is after the last dot
  assert.equal(out(main('string e = "gerard.mckee@bue.edu.eg"; cout << e.substr(e.rfind(\'.\') + 1);')), 'eg');
});

test('Lecture 5 quiz', () => {
  assert.equal(out(main('cout << round(5.5) << " " << ceil(4.1);')), '6 5');
  assert.equal(out(main('int x = 4; int y = 2; x+=y; y=x++; cout << x << " " << y;')), '7 6');
  assert.equal(out(main('int x = 4; int y = 2; x+=y; y=++x; cout << x << " " << y;')), '7 7');
  // Q5 as written (find without "s.") does not compile; the intended code prints 2 for a string without z
  assert.match(compileError(main('string s; cin >> s; int j = find(\'z\');'))!.message, /must be called on a string/);
  const q5 = main(`string s; cin >> s; int j = s.find('z');
if (j != std::string::npos) { cout << "1\\n"; } else { cout << "2\\n"; }`);
  assert.equal(out(q5, 'hello'), '2\n');
  assert.equal(out(q5, 'pizza'), '1\n');
  // Q6, Q7
  assert.equal(out(main('string line = "Introduction to Computing"; int j = line.find(\'o\'); cout << j;')), '4');
  assert.equal(out(main('string s, sub; s = "Introduction to Computing"; sub = s.substr(14); int j = s.find(\'o\'); cout << j << "|" << sub;')), '4|o Computing');
});

/* ------------------------------------------------------ number format */

test('cout prints numbers like Visual Studio', () => {
  assert.equal(out(main('cout << 7/2 << " " << 7/2.0 << " " << 7%2 << " " << 1.0/3 << " " << 10/4*2 << " " << -7/2;')), '3 3.5 1 0.333333 4 -3');
  assert.equal(out(main('float x = 1.5; double big = 1000000.0; const float pi = 3.14159; cout << x << " " << big << " " << pi << " " << 2.0 << " " << 0.0001 << " " << 0.00001;')), '1.5 1e+06 3.14159 2 0.0001 1e-05');
  assert.equal(out(main("char c = 'A'; cout << c << c + 1 << (char)(c + 1) << true << (3 > 2);")), 'A66B11');
  assert.equal(formatG(123456789), '1.23457e+08');
  assert.equal(formatG(2.5), '2.5');
});

/* ------------------------------------------- mistakes that must teach */

test('compile errors explain the mistake in plain words', () => {
  const missing = compileError('#include <iostream>\nusing namespace std;\nint main() {\n  int x = 5\n  cout << x;\n  return 0;\n}')!;
  assert.match(missing.message, /Line 4 is missing a ;/);
  assert.equal(missing.line, 4);
  assert.match(compileError(main('cout << total;'))!.message, /“total” was not declared/);
  assert.match(compileError(main('int Num1 = 2; cout << num1;'))!.hint!, /case-sensitive: did you mean Num1/);
  assert.match(compileError(main('int x; cout >> x;'))!.message, /cout uses <</);
  assert.match(compileError(main('int x; cin << x;'))!.message, /cin uses >>/);
  assert.match(compileError(main('cout << “hello”;'))!.message, /Curly/);
  assert.match(compileError('#include <iostream>\nint main() {\n  cout << "hi";\n  return 0;\n}')!.hint!, /using namespace std/);
  assert.match(compileError(main('const float pi = 3.14; pi = 2.1;'))!.message, /const/);
  assert.match(compileError(main('string s = "hi"; cout << s.lenght();'))!.hint!, /length/);
  assert.match(compileError(main('cout << max(2, 3.5);'))!.hint!, /max\(2\.0, 3\.5\)/);
  assert.match(compileError(main('int x = "5";'))!.hint!, /Remove the quotes/);
  assert.match(compileError(main('string s = "a"; if (s == \'a\') cout << 1;'))!.hint!, /s\[0\] == 'a'/);
  assert.match(compileError(main('int x = 2; if (x > 1); { cout << x; }'))!.message, /; right after if/);
  assert.match(compileError(main('int x; int x;'))!.message, /declared twice/);
});

test('warnings: = in a condition, decimals cut off', () => {
  const c = compile(main('int x = 3.9; if (x = 5) cout << x;'));
  assert.ok(c.ok);
  assert.deepEqual(c.warnings.map((w) => w.code), ['C4244', 'C4706']);
  assert.equal(out(main('int x = 3.9; cout << x;')), '3');
});

test('runtime errors read like Visual Studio, with a hint', () => {
  const uninit = run(main('int x; cout << x + 1;'));
  assert.equal(uninit.status, 'error');
  assert.match(String(uninit.error?.message), /Run-Time Check Failure #3/);
  assert.match(String(run(main('int a = 5, b = 0; cout << a / b;')).error?.message), /division by zero/);
  assert.match(String(run(main('cout << stoi("abc");')).error?.message), /invalid_argument/);
  assert.match(String(run(main('string s = "hi"; cout << s.substr(5);')).error?.message), /out_of_range/);
  // cin with letters for an int: the variable becomes 0 and cin stops
  const bad = run(main('int a = 1, b = 1; cin >> a >> b; cout << a << b;'), 'abc 5');
  assert.equal(bad.output, '01');
});

test('the machine steps one line at a time and shows the variables', () => {
  const c = compile(main('int x = 3;\nx = x + 2;\ncout << x;'));
  assert.ok(c.ok);
  const m = new Machine(c.ok ? c.program : (null as never));
  m.step();
  assert.equal(m.line, 7);
  m.step();
  assert.equal(m.vars()[0].value.v, 3);
  m.step();
  assert.equal(m.vars()[0].value.v, 5);
  m.run();
  assert.equal(m.status, 'done');
  assert.equal(m.printed, '5');
});

test('interactive input: the program waits for the keyboard', () => {
  const c = compile(PRODUCT);
  assert.ok(c.ok);
  const m = new Machine(c.ok ? c.program : (null as never), { interactive: true });
  assert.equal(m.run(), 'input');
  m.feed('4 6');
  assert.equal(m.run(), 'done');
  assert.match(m.output, /please enter two numbers: 4 6\nthe product is: 24/);
});

test('loops run (for Part 2) and an endless loop is stopped', () => {
  assert.equal(out(main('int s = 0; for (int i = 1; i <= 5; i++) s += i; cout << s;')), '15');
  assert.match(String(run(main('int x = 0; while (x < 10) { x = x; }'), '', 5000).error?.message), /never stop/);
});
