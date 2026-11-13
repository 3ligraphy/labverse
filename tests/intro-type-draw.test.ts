// Lab 3 of Introduction to Computing ("Code and flowcharts: from zero to hero") must mark right and wrong exactly:
// every reference program passes every check and every starter fails; the class test answers are what the code
// really prints (the official answers); every reference flowchart passes its checks and every empty one fails.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileLab, compileModule, orderFlow, sanitizeFlow, type Block } from '../src/lib/platform/core.ts';
import { introComputingTypeDrawLab, CHARTS, FLOW_CHECKS, P } from '../src/lib/platform/seeds/intro-computing-type-draw.ts';
import { shippedState } from '../src/lib/platform/shipped.ts';
import { gradeCpp } from '../src/lab/cpp/grade.ts';
import { outputOf } from '../src/lab/cpp/answer.ts';
import { parseChart, type Chart } from '../src/lab/flow/chart.ts';
import { runChart } from '../src/lab/flow/run.ts';
import { checkChart } from '../src/lab/flow/check.ts';

const KEY = 'intro-to-computing--type-and-draw';
const flow = sanitizeFlow(introComputingTypeDrawLab(), 'lab');
assert.ok(flow.ok, flow.ok ? '' : flow.error);
const lab = compileLab(flow.value, KEY);
const all = lab.blocks.flatMap((b) => (b.kind === 'task' ? [b, ...b.children] : [b]));
const progs = all.filter((b): b is Extract<Block, { kind: 'cpp' }> => b.kind === 'cpp');
const answers = all.filter((b): b is Extract<Block, { kind: 'cppanswer' }> => b.kind === 'cppanswer');
const charts = all.filter((b): b is Extract<Block, { kind: 'flowchart' }> => b.kind === 'flowchart');
const byId = <T extends { id: string }>(list: T[], id: string) => { const x = list.find((b) => b.id === `${KEY}--${id}`); assert.ok(x, `${id} exists`); return x!; };
const chart = (src: string): Chart => { const r = parseChart(src); if (!r.ok) throw new Error(r.error); return r.value; };

const MEDIAN = (out: string) => `    if (n1 < n2) {\n        if (n3 > n2) cout << "${out}" << n2 << "\\n";\n        else if (n3 < n1) cout << "${out}" << n1 << "\\n";\n        else cout << "${out}" << n3 << "\\n";\n    } else {\n        if (n3 > n1) cout << "${out}" << n1 << "\\n";\n        else if (n3 < n2) cout << "${out}" << n2 << "\\n";\n        else cout << "${out}" << n3 << "\\n";\n    }`;
const VEC = (v: string) => `    int ${v}c = ${v}s.find(',');\n    int ${v}x = stoi(${v}s.substr(1, ${v}c - 1));\n    int ${v}y = stoi(${v}s.substr(${v}c + 1, ${v}s.find('>') - ${v}c - 1));`;
const ALL = ['iostream', 'string', 'cmath', 'algorithm'];

/** one correct program per exercise — only Lecture 1–5 content, no loops */
const SOLUTIONS: Record<string, string> = {
  'ct-q2a': P("    char b='a';\n    cout << b << \"\\n\";"),
  'ct-q2b': P('    cout << "enter a number: \\n";'),
  'ct-q2c': P('    const float pi = 3.14159;\n    cout << pi << "\\n";'),
  'ct-q2d': P('    int x=1, y=2, z;\n    z = min(max(x,y), 5);\n    cout << z << "\\n";', ['iostream', 'algorithm']),
  'ct-q5-code': P(`    string w1, w2;
    cin >> w1 >> w2;
    if (w1 == w2) cout << "same word\\n";
    else if (w1[0] != w2[0]) { if (w1[0] < w2[0]) cout << w1 << " comes first\\n"; else cout << w2 << " comes first\\n"; }
    else if (w1[1] != w2[1]) { if (w1[1] < w2[1]) cout << w1 << " comes first\\n"; else cout << w2 << " comes first\\n"; }
    else { if (w1[2] < w2[2]) cout << w1 << " comes first\\n"; else cout << w2 << " comes first\\n"; }`, ['iostream', 'string']),
  'ct-q6-code': P(`    string line;
    getline(cin, line);
    int words = 1;
    int c1 = line.find(',');
    if (c1 != string::npos) {
        words = 2;
        string r1 = line.substr(c1 + 1);
        int c2 = r1.find(',');
        if (c2 != string::npos) {
            words = 3;
            string r2 = r1.substr(c2 + 1);
            int c3 = r2.find(',');
            if (c3 != string::npos) {
                words = 4;
                string r3 = r2.substr(c3 + 1);
                if (r3.find(',') != string::npos) words = 5;
            }
        }
    }
    cout << "words: " << words << "\\n";`, ['iostream', 'string']),
  'ct-q7': P(`    string instring;
    int dot_index;
    cin >> instring;
    dot_index = instring.find('.');
    string intsubstr = instring.substr(0, dot_index);
    string decsubstr = instring.substr(dot_index + 1);
    cout << "sum of integer and decimal parts: " << stoi(intsubstr) + stoi(decsubstr) << "\\n";`, ['iostream', 'string']),
  'z-hello': P('    cout << "Hello, I am a C++ program\\n";\n    cout << "I was typed by hand\\n";\n    cout << "Goodbye\\n";'),
  'z-card': P('    cout << "Name:\\tMona Adel\\n";\n    cout << "ID:\\t240001\\n";\n    cout << "Module:\\tIntroduction to Computing\\n";'),
  'z-box': P('    cout << "+-----+\\n";\n    cout << "| C++ |\\n";\n    cout << "+-----+\\n";'),
  'v-types': P("    int age = 19;\n    float height = 1.75;\n    char grade = 'A';\n    string name = \"Mona Adel\";\n    cout << name << \" is \" << age << \" years old, \" << height << \" m tall, grade \" << grade << \"\\n\";", ['iostream', 'string']),
  'v-steps': P(['    int x = 3;', 'x = x + 2;', 'x += 4;', 'x++;', 'x--;', 'x -= 4;', 'x *= 2;', 'x /= 2;', 'x %= 2;'].map((s, i) => (i === 0 ? s : `    ${s}\n    cout << "x = " << x << "\\n";`)).join('\n')),
  'v-circle': P('    const float pi = 3.14159;\n    float r;\n    cin >> r;\n    cout << "circumference: " << 2 * pi * r << "\\n";\n    cout << "area: " << pi * r * r << "\\n";'),
  'i-three': P('    int a, b;\n    cin >> a >> b;\n    cout << "product: " << a * b << "\\n";\n    cout << "sum: " << a + b << "\\n";\n    cout << "difference: " << a - b << "\\n";'),
  'i-greet': P('    string name;\n    int age;\n    getline(cin, name);\n    cin >> age;\n    cout << "Hello " << name << ", next year you will be " << age + 1 << "\\n";', ['iostream', 'string']),
  'i-letter': P('    char c;\n    cin >> c;\n    cout << "uppercase: " << (char)(c - 32) << "\\n";\n    cout << "ASCII code: " << (int)c << "\\n";\n    cout << "next letter: " << (char)(c + 1) << "\\n";'),
  'c-time': P('    int t;\n    cin >> t;\n    int h = t / 3600;\n    t = t % 3600;\n    int m = t / 60;\n    int s = t % 60;\n    cout << h << " h " << m << " min " << s << " s\\n";'),
  'c-temp': P('    float C, F;\n    cin >> C >> F;\n    cout << "F = " << 1.8 * C + 32 << "\\n";\n    cout << "C = " << (F - 32) / 1.8 << "\\n";'),
  'c-avg': P('    int a, b, c, d, e;\n    cin >> a >> b >> c >> d >> e;\n    int sum = a + b + c + d + e;\n    cout << "sum = " << sum << "\\n";\n    cout << "average = " << sum / 5.0 << "\\n";'),
  'c-hexagon': P('    float s;\n    cin >> s;\n    float area = 3 * sqrt(3) / 2 * pow(s, 2);\n    cout << "area: " << area << "\\n";\n    cout << "rounded: " << round(area) << "\\n";\n    cout << "down: " << floor(area) << "\\n";\n    cout << "up: " << ceil(area) << "\\n";', ['iostream', 'cmath']),
  'c-maxmin': P('    int a, b, c;\n    cin >> a >> b >> c;\n    cout << "greatest: " << max(max(a, b), c) << "\\n";\n    cout << "smallest: " << min(min(a, b), c) << "\\n";', ['iostream', 'algorithm']),
  'c-modulus': P('    float x, y;\n    cin >> x >> y;\n    cout << "modulus: " << sqrt(x * x + y * y) << "\\n";', ['iostream', 'cmath']),
  'e-divide': P('    float a, b;\n    cin >> a >> b;\n    if (b == 0) cout << "unknown\\n";\n    else cout << "result: " << a / b << "\\n";'),
  'e-z': P("    float x, y;\n    cin >> x >> y;\n    if (x < 0) cout << \"x can't be negative\\n\";\n    if (y == 0) cout << \"y can't be zero\\n\";\n    if (x >= 0 and y != 0) cout << \"z = \" << x / y << \"\\n\";"),
  'e-greatest': P('    int a, b, c;\n    cin >> a >> b >> c;\n    if (a >= b and a >= c) cout << "greatest: " << a << "\\n";\n    else if (b >= c) cout << "greatest: " << b << "\\n";\n    else cout << "greatest: " << c << "\\n";'),
  'e-case': P("    char c;\n    cin >> c;\n    if (c >= 'a' and c <= 'z') cout << \"uppercase: \" << (char)(c - 32) << \"\\n\";\n    else if (c >= 'A' and c <= 'Z') cout << \"lowercase: \" << (char)(c + 32) << \"\\n\";\n    else if (c >= '0' and c <= '9') cout << \"a digit\\n\";\n    else cout << \"not a letter or digit\\n\";"),
  'e-score': P("    string s;\n    cin >> s;\n    int d = s.find('-');\n    int home = stoi(s.substr(0, d));\n    int away = stoi(s.substr(d + 1));\n    if (home > away) cout << \"home win\\n\";\n    else if (home < away) cout << \"away win\\n\";\n    else cout << \"draw\\n\";", ['iostream', 'string']),
  'e-sentence': P("    string line;\n    getline(cin, line);\n    char last = line[line.length() - 1];\n    if (last == '?') cout << \"interrogative\\n\";\n    else if (last == '.') cout << \"declarative\\n\";\n    else cout << \"no end mark\\n\";", ['iostream', 'string']),
  's-dash': P("    string line;\n    getline(cin, line);\n    int p = line.find('-');\n    if (p == string::npos) cout << \"no dash\\n\";\n    else if (p + 1 < line.length() and line[p + 1] >= '0' and line[p + 1] <= '9') cout << \"negative number\\n\";\n    else cout << \"dash\\n\";", ['iostream', 'string']),
  's-decimal': P("    string line;\n    getline(cin, line);\n    int p = line.find('.');\n    if (p != string::npos and p > 0 and p + 1 < line.length() and line[p - 1] >= '0' and line[p - 1] <= '9' and line[p + 1] >= '0' and line[p + 1] <= '9') cout << \"decimal number\\n\";\n    else cout << \"no decimal number\\n\";", ['iostream', 'string']),
  's-words': P("    string line;\n    getline(cin, line);\n    int p = line.find(' ');\n    if (p == string::npos) cout << \"one word\\n\";\n    else {\n        string rest = line.substr(p + 1);\n        if (rest.find(' ') == string::npos) cout << \"two words\\n\";\n        else cout << \"three or more words\\n\";\n    }", ['iostream', 'string']),
  's-name': P("    string line;\n    getline(cin, line);\n    int sp_index = line.find(' ');\n    if (sp_index == string::npos) cout << \"only one name: \" << line << \"\\n\";\n    else {\n        cout << \"first name: \" << line.substr(0, sp_index) << \"\\n\";\n        cout << \"second name: \" << line.substr(sp_index + 1) << \"\\n\";\n    }", ['iostream', 'string']),
  's-email': P(`    string s;
    cin >> s;
    int ok = 0;
    int at = s.find('@');
    if (at != string::npos) {
        string before = s.substr(0, at);
        string after = s.substr(at + 1);
        int dot = after.find('.');
        if (before.length() > 0 and after.length() > 0 and dot != string::npos) {
            if (after.substr(0, dot).length() > 0 and after.substr(dot + 1).length() > 0) ok = 1;
        }
    }
    if (ok == 1) cout << "email address: yes\\n";
    else cout << "email address: no\\n";`, ['iostream', 'string']),
  's-tld': P(`    string s;
    cin >> s;
    string domain = s.substr(s.find('@') + 1);
    string rest = domain.substr(domain.find('.') + 1);
    int d2 = rest.find('.');
    if (d2 == string::npos) cout << "TLD: " << rest << "\\n";
    else cout << "TLD: " << rest.substr(d2 + 1) << "\\n";`, ['iostream', 'string']),
  'h-median': P(`    int n1, n2, n3;\n    cin >> n1 >> n2 >> n3;\n${MEDIAN('median is: ')}`),
  'h-stats': P(`    int n1, n2, n3;
    cin >> n1 >> n2 >> n3;
    float avg = (n1 + n2 + n3) / 3.0;
    float sd = sqrt((pow(n1 - avg, 2) + pow(n2 - avg, 2) + pow(n3 - avg, 2)) / 3);
    cout << "average: " << avg << "\\n";
    cout << "standard deviation: " << sd << "\\n";
${MEDIAN('median: ')}`, ['iostream', 'cmath']),
  'h-vector': P(`    string line;
    getline(cin, line);
    int ok = 0;
    int lt = line.find('<');
    if (lt != string::npos) {
        int gt = line.find('>');
        if (gt != string::npos) {
            string inside = line.substr(lt + 1, gt - lt - 1);
            int c = inside.find(',');
            if (c != string::npos) {
                if (inside.substr(0, c).length() > 0 and inside.substr(c + 1).length() > 0) ok = 1;
            }
        }
    }
    if (ok == 1) cout << "correct format\\n";
    else cout << "wrong format\\n";`, ['iostream', 'string']),
  'h-vsum': P(`    string as, bs;\n    getline(cin, as);\n    getline(cin, bs);\n${VEC('a')}\n${VEC('b')}\n    cout << "<" << ax + bx << ", " << ay + by << ">\\n";`, ['iostream', 'string']),
  'h-dot': P(`    string as, bs;\n    getline(cin, as);\n    getline(cin, bs);\n${VEC('a')}\n${VEC('b')}\n    int dot = ax * bx + ay * by;\n    cout << "dot product: " << dot << "\\n";\n    if (dot == 0) cout << "orthogonal: yes\\n";\n    else cout << "orthogonal: no\\n";`, ['iostream', 'string']),
};

const printed = (code: string, input: string) => { const r = outputOf(code, input); return r.ok ? r.output.trim() : `ERROR: ${r.message}`; };
const passes = (id: string, code: string) => {
  const r = gradeCpp(code, byId(progs, id).checks);
  return { ok: !r.compileError && r.results.every((x) => x.pass), why: r.compileError?.message ?? r.results.filter((x) => !x.pass).map((x) => `${x.name}: ${x.message ?? ''}`).join(' | ') };
};

test('the lab compiles with no warnings: 11 parts, class test first, then code, then flowcharts', () => {
  assert.deepEqual(lab.warnings, []);
  const parts = lab.blocks.filter((b) => b.kind === 'part').map((b) => (b as { title: string }).title);
  assert.equal(parts.length, 11);
  assert.equal(parts[0], 'Class test answers');
  assert.match(parts[1], /Zero/);
  assert.match(parts[7], /Hero/);
  assert.match(parts[10], /Draw it yourself/);
});

test('every program has a reference solution that passes every check', () => {
  assert.deepEqual(progs.map((p) => p.id.replace(`${KEY}--`, '')).sort(), Object.keys(SOLUTIONS).sort(), 'one solution per program');
  for (const [id, code] of Object.entries(SOLUTIONS)) {
    const r = passes(id, code);
    assert.ok(r.ok, `${id}: ${r.why}`);
  }
});

test('every starter fails: nobody gets a tick for free', () => {
  for (const p of progs) assert.equal(passes(p.id.replace(`${KEY}--`, ''), p.starter).ok, false, `${p.id} starter passes`);
});

test('typical wrong programs are marked wrong', () => {
  assert.equal(passes('c-avg', SOLUTIONS['c-avg'].replace('sum / 5.0', 'sum / 5')).ok, false, 'int division loses the .2');
  assert.equal(passes('c-temp', SOLUTIONS['c-temp'].replace('(F - 32) / 1.8', 'F - 32 / 1.8')).ok, false, 'brackets matter');
  assert.equal(passes('e-greatest', SOLUTIONS['e-greatest'].replace('a >= b and a >= c', 'a > b')).ok, false);
  assert.equal(passes('s-name', SOLUTIONS['s-name'].replace('if (sp_index == string::npos) cout << "only one name: " << line << "\\n";\n    else {', '{')).ok, false, 'Pele must not crash');
  assert.equal(passes('c-maxmin', P('    int a, b, c;\n    cin >> a >> b >> c;\n    if (a > b) cout << "greatest: " << max(max(a, b), c) << "\\n";\n    cout << "smallest: " << min(min(a, b), c) << "\\n";', ['iostream', 'algorithm'])).ok, false, 'no if allowed');
  assert.equal(passes('ct-q2c', P('    float pi = 3.14159;\n    cout << pi << "\\n";')).ok, false, 'it must stay a const');
});

test('class test: the typed answers are the official answers, and what the code really prints', () => {
  const official: Record<string, string> = { 'ct-q3a': '17', 'ct-q3b': '10', 'ct-q3c': 'EDU', 'ct-q3d': 'EDU.EG', 'ct-q4x': '0', 'ct-q4y': '3' };
  for (const [id, want] of Object.entries(official)) {
    const a = byId(answers, id);
    assert.equal(a.mode, 'output');
    assert.equal(printed(a.code, a.input), want, id);
  }
  // Q1 asks for the value of y: run the same lines and print y
  for (const [id, want] of [['ct-q1a', '10'], ['ct-q1b', '11']] as const) {
    const a = byId(answers, id);
    assert.deepEqual(a.answers, [want]);
    assert.equal(printed(`${a.code}\ncout << y;`, ''), want);
  }
  assert.deepEqual(byId(answers, 'ct-q5').answers, ['coffee']);
  assert.deepEqual(byId(answers, 'ct-q6b').answers, ['5', 'five']);
  for (const a of answers) if (a.mode === 'output') assert.ok(printed(a.code, a.input).length > 0 && !printed(a.code, a.input).startsWith('ERROR'), `${a.id} prints something`);
});

const DRAWN: Record<string, string> = {
  ctof: CHARTS.ctof,
  seconds: CHARTS.seconds,
  greatest: CHARTS.greatest,
  divide: CHARTS.divide,
  fives: CHARTS.fives,
  prime: CHARTS.prime,
  zxy: CHARTS.zxy,
  fifty: `
s start 0,0 Start
p process 0,1 total = 0; k = 1
d decision 0,2 k <= 50?
i input 0,3 Input x
a process 0,4 total = total + x; k = k + 1
o1 output 1,3 Output "sum: ", total
o2 output 1,4 Output "average: ", total / 50.0
e end 1,5 End
s -> p -> d
d -yes-> i
d -no-> o1
i -> a -> d
o1 -> o2 -> e`,
  median: `
s start 0,0 Start
i input 0,1 Input num1, num2, num3
d decision 0,2 num1 < num2?
a1 decision 1,3 num3 > num2?
a2 decision 1,4 num3 < num1?
b1 decision -1,3 num3 > num1?
b2 decision -1,4 num3 < num2?
m1 output 2,4 Output "median is: ", num2
m2 output 2,5 Output "median is: ", num1
m3 output 1,5 Output "median is: ", num3
n1 output -2,4 Output "median is: ", num1
n2 output -2,5 Output "median is: ", num2
n3 output -1,5 Output "median is: ", num3
e end 0,6 End
s -> i -> d
d -yes-> a1
d -no-> b1
a1 -yes-> m1
a1 -no-> a2
a2 -yes-> m2
a2 -no-> m3
b1 -yes-> n1
b1 -no-> b2
b2 -yes-> n2
b2 -no-> n3
m1 -> e
m2 -> e
m3 -> e
n1 -> e
n2 -> e
n3 -> e`,
};

test('flowcharts: every chart to watch or read runs, and the read answers are what it prints', () => {
  const want: Record<string, string> = { 'f-trace-ctof': '77', 'f-trace-seconds': '1 h 2 min 5 s', 'f-trace-divide': 'unknown', 'f-trace-greatest': 'greatest: 9', 'f-trace-sum': 'sum = 10', 'f-trace-prime': 'not prime' };
  for (const c of charts.filter((x) => x.mode === 'show' || x.mode === 'trace')) {
    const r = runChart(c.chart, c.input);
    assert.ok(r.ok, `${c.id}: ${r.error?.message}`);
    const short = c.id.replace(`${KEY}--`, '');
    if (want[short]) assert.equal(r.output.trim(), want[short], short);
  }
});

test('flowcharts: every reference chart passes its checks; empty boxes and empty canvases fail', () => {
  for (const [name, src] of Object.entries(DRAWN)) {
    const res = checkChart(chart(src), (FLOW_CHECKS as Record<string, string[]>)[name].join('\n'));
    assert.ok(res.every((r) => r.pass), `${name}: ${res.filter((r) => !r.pass).map((r) => `${r.name}: ${r.message}`).join(' | ')}`);
  }
  for (const c of charts.filter((x) => x.mode === 'fill' || x.mode === 'draw')) {
    const res = checkChart(c.chart, c.checks);
    assert.ok(res.some((r) => !r.pass), `${c.id}: the starter chart must not pass`);
  }
  for (const c of charts.filter((x) => x.mode === 'fill')) {
    const blanks = c.chart.nodes.filter((n) => n.text === '?');
    assert.ok(blanks.length >= 2, `${c.id} has boxes to fill`);
  }
});

test('the module: three labs in order, all shown, and Lab 3 is the new one', () => {
  const s = shippedState().get('intro-to-computing')!;
  const order = orderFlow(s.module.flow, 'module').filter((n) => n.type === 'lab').map((n) => (n.data as { slug: string }).slug);
  assert.deepEqual(order, ['revision-week-6', 'revision-practice', 'type-and-draw']);
  assert.deepEqual(s.labs.map((l) => [l.slug, l.published]), [['revision-week-6', true], ['revision-practice', true], ['type-and-draw', true]]);
  assert.equal(compileModule(s.module.flow).meta.title, 'Introduction to Computing');
});
