// Run with: node --test tests/
// The practice lab must mark right and wrong exactly: every reference solution passes every check, every starter
// fails, typical wrong programs fail, and every typed answer matches what the code really prints.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileLab, sanitizeFlow, type Block } from '../src/lib/platform/core.ts';
import { introComputingPracticeLab } from '../src/lib/platform/seeds/intro-computing-practice.ts';
import { gradeCpp } from '../src/lab/cpp/grade.ts';
import { answerHash, checkAnswer, outputOf } from '../src/lab/cpp/answer.ts';

const KEY = 'intro-to-computing--revision-practice';
const flow = sanitizeFlow(introComputingPracticeLab(), 'lab');
assert.ok(flow.ok);
const lab = compileLab(flow.value, KEY);
const all = lab.blocks.flatMap((b) => (b.kind === 'task' ? [b, ...b.children] : [b]));
const progs = all.filter((b): b is Extract<Block, { kind: 'cpp' }> => b.kind === 'cpp');
const answers = all.filter((b): b is Extract<Block, { kind: 'cppanswer' }> => b.kind === 'cppanswer');
const prog = (id: string) => progs.find((p) => p.id === `${KEY}--${id}`)!;
const P = (body: string) => `#include <iostream>\n#include <string>\n#include <cmath>\nusing namespace std;\n\nint main() {\n${body}\n    return 0;\n}\n`;
const passes = (id: string, code: string) => {
  const r = gradeCpp(code, prog(id).checks);
  return { ok: !r.compileError && r.results.every((x) => x.pass), why: r.compileError?.message ?? r.results.filter((x) => !x.pass).map((x) => `${x.name}: ${x.message ?? ''}`).join(' | ') };
};

const VEC = (v: string) => `    int ${v}c = ${v}s.find(',');\n    int ${v}x = stoi(${v}s.substr(1, ${v}c - 1));\n    int ${v}y = stoi(${v}s.substr(${v}c + 1, ${v}s.find('>') - ${v}c - 1));`;
const MEDIAN = (out: string) => `    if (n1 < n2) {\n        if (n3 > n2) cout << "${out}" << n2 << "\\n";\n        else if (n3 < n1) cout << "${out}" << n1 << "\\n";\n        else cout << "${out}" << n3 << "\\n";\n    } else {\n        if (n3 > n1) cout << "${out}" << n1 << "\\n";\n        else if (n3 < n2) cout << "${out}" << n2 << "\\n";\n        else cout << "${out}" << n3 << "\\n";\n    }`;
const READ5 = ['    int n, x, sum = 0;', '    cin >> n;', ...[1, 2, 3, 4, 5].map((i) => `    if (n >= ${i}) { cin >> x; sum += x; }`)].join('\n');

/** one correct program per exercise — written only with Lecture 1–5 content */
const SOLUTIONS: Record<string, string> = {
  'w-hello': P('    cout << "Hello, I am your first program\\n";\n    cout << "Goodbye\\n";'),
  'w-tab': P('    cout << "Name\\tAge\\n";\n    cout << "Mona\\t19\\n";'),
  'w-fix-char': P("    char a = 'a';\n    cout << a << \"\\n\";"),
  'w-fix-const': P('    const float pi = 3.14159;\n    cout << pi << "\\n";'),
  'w-product': P('    int num1, num2, product;\n    cout << "Hello, I calculate the product of two numbers\\n";\n    cin >> num1; cin >> num2;\n    product = num1 * num2;\n    cout << "the product is: " << product << "\\n";\n    cout << "Goodbye\\n";'),
  'w-sum5': P('    int a, b, c, d, e;\n    cin >> a >> b >> c >> d >> e;\n    cout << "the sum is: " << a + b + c + d + e << "\\n";'),
  'w-rect': P('    float w, h;\n    cin >> w >> h;\n    cout << "the area is: " << w * h << "\\n";'),
  'w-circle': P('    const float pi = 3.14159;\n    float r;\n    cin >> r;\n    cout << "the circumference is: " << 2 * pi * r << "\\n";'),
  'w-hexagon': P('    float side;\n    cin >> side;\n    cout << "the area is: " << (3 * sqrt(3) / 2) * side * side << "\\n";'),
  'w-median': P(`    int n1, n2, n3;\n    cin >> n1 >> n2 >> n3;\n${MEDIAN('median is: ')}`),
  'w-even': P('    int n;\n    cin >> n;\n    if (n % 2 == 0) cout << "the number is even\\n";\n    else cout << "the number is odd\\n";'),
  'w-upper': P('    char c;\n    cin >> c;\n    cout << "The uppercase is: " << (char)(c - 32) << "\\n";'),
  'w-lower': P('    char c;\n    cin >> c;\n    cout << "The lowercase is: " << (char)(c + 32) << "\\n";'),
  'w-isdigit': P("    char c;\n    cin >> c;\n    if (c >= '0' and c <= '9') cout << \"is a digit\\n\";\n    else cout << \"is not a digit\\n\";"),
  'w-length': P('    string s;\n    cin >> s;\n    cout << "the length is: " << s.length() << "\\n";'),
  'w-fourth': P('    string s;\n    cin >> s;\n    cout << "the fourth character is: " << s[3] << "\\n";'),
  'w-rest': P('    string s;\n    cin >> s;\n    cout << "the rest is: " << s.substr(5) << "\\n";'),
  'w-getline': P('    string s;\n    cout << "please enter a footballer\'s name: ";\n    getline(cin, s);\n    cout << "You typed: " << s << "\\n";'),
  'w-stoi': P('    string t;\n    getline(cin, t);\n    int n = stoi(t);\n    cout << "the next number is: " << n + 1 << "\\n";'),
  'w-tostring': P('    int n;\n    cin >> n;\n    string t = "n=" + to_string(n);\n    cout << "the text is: " << t << "\\n";\n    cout << "its length is: " << t.length() << "\\n";'),
  'w-hasdigit': P(`    string s;\n    getline(cin, s);\n    if (${[...'0123456789'].map((d) => `s.find('${d}') != string::npos`).join(' or ')}) cout << "contains a digit\\n";\n    else cout << "no digit\\n";`),
  'w-dash': P("    string s;\n    getline(cin, s);\n    if (s.find('-') != string::npos) cout << \"contains a dash\\n\";\n    else cout << \"no dash\\n\";"),
  'w-question': P("    string s;\n    getline(cin, s);\n    if (s[s.length() - 1] == '?') cout << \"interrogative\\n\";\n    else cout << \"declarative\\n\";"),
  'w-words': P("    string s;\n    getline(cin, s);\n    if (s.find(' ') != string::npos) cout << \"multiple words\\n\";\n    else cout << \"one word\\n\";"),
  'w-three': P("    string s;\n    getline(cin, s);\n    int sp = s.find(' ');\n    if (sp == string::npos) cout << \"fewer than three words\\n\";\n    else {\n        string rest = s.substr(sp + 1);\n        if (rest.find(' ') != string::npos) cout << \"at least three words\\n\";\n        else cout << \"fewer than three words\\n\";\n    }"),
  'w-decimal': P("    string s;\n    getline(cin, s);\n    int d = s.find('.');\n    if (d != string::npos and d > 0 and d < s.length() - 1 and s[d - 1] >= '0' and s[d - 1] <= '9' and s[d + 1] >= '0' and s[d + 1] <= '9') cout << \"contains a decimal number\\n\";\n    else cout << \"no decimal number\\n\";"),
  'w-football': P("    string s;\n    getline(cin, s);\n    int dash = s.find('-');\n    int a = stoi(s.substr(0, dash));\n    int b = stoi(s.substr(dash + 1));\n    if (a == b) cout << \"draw\\n\";\n    else cout << \"win\\n\";"),
  'w-names': P("    string line;\n    getline(cin, line);\n    int sp = line.find(' ');\n    if (sp == string::npos) cout << \"Only one name: \" << line << \"\\n\";\n    else {\n        cout << \"first name: \" << line.substr(0, sp) << \"\\n\";\n        cout << \"second name: \" << line.substr(sp + 1) << \"\\n\";\n    }"),
  'w-email': P("    string s;\n    getline(cin, s);\n    int at = s.find('@');\n    if (at != string::npos) {\n        string before = s.substr(0, at);\n        string after = s.substr(at + 1);\n        if (before.length() > 0 and after.length() > 0) {\n            int dot = after.find('.');\n            if (dot != string::npos) {\n                if (after.substr(0, dot).length() > 0 and after.substr(dot + 1).length() > 0) cout << \"is an email address\\n\";\n                else cout << \"is not an email address\\n\";\n            } else cout << \"is not an email address\\n\";\n        } else cout << \"is not an email address\\n\";\n    } else cout << \"is not an email address\\n\";"),
  'w-tld': P("    string s;\n    getline(cin, s);\n    string domain = s.substr(s.find('@') + 1);\n    string rest = domain.substr(domain.find('.') + 1);\n    cout << \"the TLD is: \" << rest.substr(rest.find('.') + 1) << \"\\n\";"),
  'w-edu': P('    string s;\n    getline(cin, s);\n    if (s.find(".edu") != string::npos) cout << "is educational\\n";\n    else cout << "is not educational\\n";'),
  'w-vector': P("    string s;\n    getline(cin, s);\n    int l = s.find('<');\n    if (l != string::npos) {\n        int r = s.find('>');\n        if (r != string::npos) {\n            string inside = s.substr(l + 1, r - l - 1);\n            int c = inside.find(',');\n            if (c != string::npos) {\n                if (inside.substr(0, c).length() > 0 and inside.substr(c + 1).length() > 0) cout << \"correct format\\n\";\n                else cout << \"wrong format\\n\";\n            } else cout << \"wrong format\\n\";\n        } else cout << \"wrong format\\n\";\n    } else cout << \"wrong format\\n\";"),
  'w-modulus': P(`    string s;\n    getline(cin, s);\n${VEC('')}\n    cout << "the modulus is: " << sqrt(x * x + y * y) << "\\n";`),
  'w-norm3': P("    string s;\n    getline(cin, s);\n    int c1 = s.find(',');\n    string rest = s.substr(c1 + 1);\n    int c2 = rest.find(',');\n    int x = stoi(s.substr(1, c1 - 1));\n    int y = stoi(rest.substr(0, c2));\n    int z = stoi(rest.substr(c2 + 1, rest.find('>') - c2 - 1));\n    cout << \"the norm is: \" << sqrt(x * x + y * y + z * z) << \"\\n\";"),
  'w-vecsum': P(`    string as, bs;\n    getline(cin, as);\n    getline(cin, bs);\n${VEC('a')}\n${VEC('b')}\n    cout << "the sum is: <" << ax + bx << ", " << ay + by << ">\\n";`),
  'w-dot': P(`    string as, bs;\n    getline(cin, as);\n    getline(cin, bs);\n${VEC('a')}\n${VEC('b')}\n    cout << "the dot product is: " << ax * bx + ay * by << "\\n";`),
  'w-orth': P(`    string as, bs;\n    getline(cin, as);\n    getline(cin, bs);\n${VEC('a')}\n${VEC('b')}\n    if (ax * bx + ay * by == 0) cout << "are orthogonal\\n";\n    else cout << "are not orthogonal\\n";`),
  'w-banner': P('    cout << "*******\\n";\n    cout << "* C++ *\\n";\n    cout << "*******\\n";'),
  'w-avg2': P('    int a, b;\n    cin >> a >> b;\n    cout << "the average is: " << (a + b) / 2.0 << "\\n";'),
  'w-minmax': `#include <iostream>\n#include <algorithm>\nusing namespace std;\n\nint main() {\n    int a, b, c;\n    cin >> a >> b >> c;\n    cout << "the largest is: " << max(a, max(b, c)) << "\\n";\n    cout << "the smallest is: " << min(a, min(b, c)) << "\\n";\n    return 0;\n}\n`,
  'w-grade': P('    int m;\n    cin >> m;\n    if (m >= 85) cout << "grade: A\\n";\n    else if (m >= 70) cout << "grade: B\\n";\n    else if (m >= 50) cout << "grade: C\\n";\n    else cout << "grade: F\\n";'),
  'w-case': P("    char c;\n    cin >> c;\n    if (c >= 'A' and c <= 'Z') cout << \"uppercase\\n\";\n    else if (c >= 'a' and c <= 'z') cout << \"lowercase\\n\";\n    else cout << \"not a letter\\n\";"),
  'w-firstlast': P('    string s;\n    cin >> s;\n    cout << "first: " << s[0] << "\\n";\n    cout << "last: " << s[s.length() - 1] << "\\n";'),
  'w-initials': P("    string s;\n    getline(cin, s);\n    int sp = s.find(' ');\n    cout << \"initials: \" << s[0] << \".\" << s[sp + 1] << \".\\n\";"),
  'w-swapname': P("    string s;\n    getline(cin, s);\n    int sp = s.find(' ');\n    cout << \"the name is: \" << s.substr(sp + 1) << \", \" << s.substr(0, sp) << \"\\n\";"),
  'w-scale': P(`    string s;\n    getline(cin, s);\n    int k;\n    cin >> k;\n${VEC('')}\n    cout << "the result is: <" << k * x << ", " << k * y << ">\\n";`),
  'w-setmax': P('    int n, x, largest;\n    cin >> n;\n    cin >> largest;\n    if (n >= 2) { cin >> x; largest = max(largest, x); }\n    if (n >= 3) { cin >> x; largest = max(largest, x); }\n    if (n >= 4) { cin >> x; largest = max(largest, x); }\n    if (n >= 5) { cin >> x; largest = max(largest, x); }\n    cout << "the largest is: " << largest << "\\n";'),
  'w-setsum': P(`${READ5}\n    cout << "the sum is: " << sum << "\\n";`),
  'w-setavg': P(`${READ5}\n    cout << "the average is: " << (float)sum / n << "\\n";`),
  'w-sd': P('    float a, b, c;\n    cin >> a >> b >> c;\n    float m = (a + b + c) / 3;\n    float sd = sqrt((pow(a - m, 2) + pow(b - m, 2) + pow(c - m, 2)) / 3);\n    cout << "the average is: " << m << "\\n";\n    cout << "the standard deviation is: " << sd << "\\n";'),
  'w-stats3': P(`    float a, b, c;\n    cin >> a >> b >> c;\n    float m = (a + b + c) / 3;\n    float sd = sqrt((pow(a - m, 2) + pow(b - m, 2) + pow(c - m, 2)) / 3);\n    cout << "the average is: " << m << "\\n";\n    cout << "the standard deviation is: " << sd << "\\n";\n    float n1 = a, n2 = b, n3 = c;\n${MEDIAN('the median is: ')}`),
};

test('the lab: open any time, 10 parts from easy to hard, every item tracked, no warnings', () => {
  assert.deepEqual(lab.warnings, []);
  assert.equal(lab.meta.open, true);
  const parts = all.filter((b) => b.kind === 'part');
  assert.equal(parts.length, 10);
  assert.equal(parts[0].kind === 'part' && parts[0].title, 'Theory from the lectures');
  assert.ok(!all.some((b) => b.kind === 'part' && /complex|quaternion/i.test(b.title)), 'the complex numbers part was removed');
  assert.ok(progs.length >= 40 && answers.length >= 30, `${progs.length} programs, ${answers.length} typed answers`);
  assert.equal(Object.keys(lab.exercises).length, progs.length + answers.length);
  // questions only: no options to choose from, no explanations that give answers away
  assert.ok(!all.some((b) => b.kind === 'cpppredict' || b.kind === 'quiz'));
  for (const p of progs) assert.ok(p.paste === false, `${p.id} must block pasting`);
});

test('every program has a reference solution that passes every check', () => {
  for (const p of progs) {
    const id = p.id.slice(KEY.length + 2);
    assert.ok(SOLUTIONS[id], `no reference solution for ${id}`);
    const r = passes(id, SOLUTIONS[id]);
    assert.ok(r.ok, `${id}: ${r.why}`);
  }
});

test('every starter fails: nobody gets a tick for free', () => {
  for (const p of progs) {
    const r = gradeCpp(p.starter, p.checks);
    assert.ok(r.compileError || r.results.some((x) => !x.pass), `${p.id} passes with its starter`);
  }
});

test('typical wrong programs are marked wrong', () => {
  const wrong: [string, string][] = [
    // the six-if median from Lecture 3 prints nothing for 2 2 2
    ['w-median', P('    int n1, n2, n3;\n    cin >> n1 >> n2 >> n3;\n    if (n1 < n2 and n2 < n3) cout << "median is: " << n2;\n    if (n1 < n3 and n3 < n2) cout << "median is: " << n3;\n    if (n2 < n1 and n1 < n3) cout << "median is: " << n1;\n    if (n2 < n3 and n3 < n1) cout << "median is: " << n3;\n    if (n3 < n1 and n1 < n2) cout << "median is: " << n1;\n    if (n3 < n2 and n2 < n1) cout << "median is: " << n2;')],
    // int / int cuts the decimals
    ['w-setavg', P(`${READ5}\n    cout << "the average is: " << sum / n << "\\n";`)],
    ['w-rect', P('    int w, h;\n    cin >> w >> h;\n    cout << "the area is: " << w * h << "\\n";')],
    // not the Lecture 4 way
    ['w-upper', P('    char c;\n    cin >> c;\n    cout << "The uppercase is: " << (char)toupper(c) << "\\n";')],
    // a loop is not Part 1
    ['w-sum5', P('    int sum = 0, x;\n    for (int i = 0; i < 5; i++) { cin >> x; sum += x; }\n    cout << "the sum is: " << sum << "\\n";')],
    // -3 % 2 is -1 in C++
    ['w-even', P('    int n;\n    cin >> n;\n    if (n % 2 == 1) cout << "the number is odd\\n";\n    else cout << "the number is even\\n";')],
    // only looks for @
    ['w-email', P("    string s;\n    getline(cin, s);\n    if (s.find('@') != string::npos) cout << \"is an email address\\n\";\n    else cout << \"is not an email address\\n\";")],
    // cin >> stops at the space
    ['w-getline', P('    string s;\n    cin >> s;\n    cout << "You typed: " << s << "\\n";')],
    // no npos check: Pele breaks
    ['w-names', P("    string line;\n    getline(cin, line);\n    int sp = line.find(' ');\n    cout << \"first name: \" << line.substr(0, sp) << \"\\n\";\n    cout << \"second name: \" << line.substr(sp + 1) << \"\\n\";")],
    // printing both answers is not an answer
    ['w-football', P('    string s;\n    getline(cin, s);\n    cout << "win draw\\n";')],
    // int / int cuts the decimals
    ['w-avg2', P('    int a, b;\n    cin >> a >> b;\n    cout << "the average is: " << (a + b) / 2 << "\\n";')],
    // > instead of >= at the boundaries
    ['w-grade', P('    int m;\n    cin >> m;\n    if (m > 85) cout << "grade: A\\n";\n    else if (m > 70) cout << "grade: B\\n";\n    else if (m > 50) cout << "grade: C\\n";\n    else cout << "grade: F\\n";')],
    // 'A' to 'z' takes [ \ ] ^ _ ` as letters
    ['w-case', P("    char c;\n    cin >> c;\n    if (c >= 'A' and c <= 'z') cout << \"uppercase\\n\";\n    else cout << \"not a letter\\n\";")],
    // only checks < and >
    ['w-vector', P("    string s;\n    getline(cin, s);\n    if (s.find('<') != string::npos and s.find('>') != string::npos) cout << \"correct format\\n\";\n    else cout << \"wrong format\\n\";")],
  ];
  for (const [id, code] of wrong) assert.ok(!passes(id, code).ok, `${id}: a wrong program passes`);
});

test('typed answers: the code runs, values are right, inputs exist, and wrong answers are wrong', () => {
  const byId = (id: string) => answers.find((a) => a.id === `${KEY}--${id}`)!;
  for (const a of answers) {
    if (a.mode !== 'value' || a.code.trim()) assert.ok(outputOf(a.code, a.input).ok || a.mode === 'input', `${a.id} does not run`);
  }
  // values: the accepted answer is what the code really gives
  const valueOf: Record<string, string> = { 'v-postinc': 'cout << y;', 'v-preinc': 'cout << y;', 'v-find-o': 'cout << j;', 'v-find-sub': 'cout << j;', 'v-round': '', 'v-ceil': '', 'v-modmul': 'cout << x;', 'v-banana': 'cout << p;' };
  for (const [id, print] of Object.entries(valueOf)) {
    const q = byId(id);
    const r = outputOf(`${q.code}\n${print}`, '');
    assert.ok(r.ok && q.answers.includes(r.output.trim()), `${id}: accepted ${q.answers} but the code gives ${r.ok ? r.output : r.message}`);
  }
  const cfg = (id: string) => { const q = byId(id); return { id: q.id, mode: q.mode, code: q.code, input: q.input, hashes: q.answers.map((x) => answerHash(q.id, x, q.ignoreCase)), expected: q.answers[0] ?? '', ignoreCase: q.ignoreCase }; };
  assert.equal(checkAnswer(cfg('v-postinc'), '6').pass, true);
  assert.equal(checkAnswer(cfg('v-postinc'), '7').pass, false);
  assert.equal(checkAnswer(cfg('v-tld'), '.eg').pass, true);
  assert.equal(checkAnswer(cfg('v-tld'), 'edu').pass, false);
  // a C++ value keeps its case: the code gives eg, not EG
  assert.equal(checkAnswer(cfg('v-tld'), 'EG').pass, false);
  // theory: word answers from the lectures, capital letters do not count; everything else is still exact
  const theory = answers.filter((a) => a.id.startsWith(`${KEY}--th-`));
  assert.equal(theory.length, 27);
  for (const t of theory) assert.ok(t.mode === 'value' && t.ignoreCase && !t.code.trim(), `${t.id} must be a word answer without code`);
  assert.ok(answers.filter((a) => !a.id.startsWith(`${KEY}--th-`)).every((a) => !a.ignoreCase), 'only the theory questions ignore capitals');
  const right: [string, string][] = [
    ['th-logic', 'Program Logic'], ['th-close', 'Close'], ['th-selection', 'selection'], ['th-median', '6'], ['th-cases', '6'],
    ['th-tests', 'three'], ['th-iostream', '#include <iostream>'], ['th-cmath', 'cmath'], ['th-algorithm', '<algorithm>'],
    ['th-std', 'using namespace std;'], ['th-newline', '\\n'], ['th-newline', "'\\n'"], ['th-tab', '"\\t"'], ['th-const', 'const'],
    ['th-types', 'String'], ['th-ascii', 'ASCII'], ['th-ascii', 'ascii'], ['th-quotes', 'Single quotes'], ['th-32', '32'],
    ['th-index', '0'], ['th-npos', 'std::string::npos'], ['th-npos', 'npos'], ['th-getline', 'getline'], ['th-stoi', 'stoi'],
    ['th-stod', 'stod()'], ['th-tostring', 'to_string'], ['th-at', '@'], ['th-vector', '<x, y>'], ['th-vector-read', 'getline'],
    ['th-stoi-neg', '-23'],
  ];
  for (const [id, a] of right) assert.equal(checkAnswer(cfg(id), a).pass, true, `${id}: “${a}” should be right`);
  const wrongTheory: [string, string][] = [
    ['th-median', '5'], ['th-cases', '3'], ['th-tests', '6'], ['th-selection', 'iteration'], ['th-iostream', 'cmath'],
    ['th-cmath', 'algorithm'], ['th-algorithm', 'cmath'], ['th-newline', 'n'], ['th-newline', '\\t'], ['th-tab', '\\n'],
    ['th-quotes', 'double'], ['th-quotes', "''"], ['th-32', '65'], ['th-index', '1'], ['th-stoi', 'stod'], ['th-stod', 'stoi'],
    ['th-vector-read', 'cin'], ['th-stoi-neg', '23'], ['th-at', '.'],
  ];
  for (const [id, a] of wrongTheory) assert.equal(checkAnswer(cfg(id), a).pass, false, `${id}: “${a}” should be wrong`);
  // a theory question has no code to read again
  assert.equal(checkAnswer(cfg('th-median'), '5').message, 'Not correct. Try again.');
  assert.equal(checkAnswer(cfg('v-postinc'), '7').message, 'Not correct. Read the code again, line by line.');
  // outputs: exact, but spaces at line ends and the last newline don't count
  assert.equal(checkAnswer(cfg('o-lines'), 'Hello\nWorld').pass, true);
  assert.equal(checkAnswer(cfg('o-lines'), 'Hello\r\nWorld  \n').pass, true);
  assert.equal(checkAnswer(cfg('o-lines'), 'HelloWorld').pass, false);
  // only a space missing: right, with a warning that shows the real output
  assert.match(checkAnswer(cfg('o-total'), 'Total:8').warning ?? '', /check the spaces/i);
  assert.equal(checkAnswer(cfg('o-total'), 'Total: 9').pass, false);
  assert.equal(checkAnswer(cfg('o-compound'), '5\n9\n10\n9\n5\n10\n5\n1').pass, true);
  assert.equal(checkAnswer(cfg('o-assign-copy'), '8 8').pass, true);
  assert.equal(checkAnswer(cfg('o-assign-copy'), '8 3').pass, false);
  assert.equal(checkAnswer(cfg('o-nested'), 'D').pass, true);
  // inputs: the program runs with what the student typed
  assert.equal(checkAnswer(cfg('i-npos'), 'hello').pass, true);
  assert.equal(checkAnswer(cfg('i-npos'), 'pizza').pass, false);
  assert.equal(checkAnswer(cfg('i-median'), '1 7 9').pass, true);
  assert.equal(checkAnswer(cfg('i-median'), '7 7 7').pass, true);
  assert.equal(checkAnswer(cfg('i-median'), '1 2 3').pass, false);
  // accepted values never reach the page in plain text
  assert.notEqual(answerHash(byId('v-round').id, '6'), '6');
});
