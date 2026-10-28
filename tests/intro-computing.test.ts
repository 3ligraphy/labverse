// Introduction to Computing — the Week 6 revision lab. Its answer keys are checked by running the code on the
// browser C++ engine, every exercise has a reference solution (kept here, never shipped to the page) that
// passes its checks while the starter does not, and the lab is tracked like every other lab.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileLab, compileModule, nodesOfKits, sanitizeFlow, type Block } from '../src/lib/platform/core.ts';
import { introComputingModule, introComputingRevisionLab, OUTPUT_PREDICTS, PRODUCT_PROGRAM } from '../src/lib/platform/seeds/intro-computing-revision.ts';
import { compile, Machine, run } from '../src/lab/cpp/index.ts';
import { gradeCpp } from '../src/lab/cpp/grade.ts';
import { labStructure } from '../src/lib/progress/core.ts';
import { shippedSeeds } from '../src/lib/platform/seeds/index.ts';

const KEY = 'intro-to-computing--revision-week-6';
const lab = compileLab(introComputingRevisionLab(), KEY);
const all = (blocks: Block[]): Block[] => blocks.flatMap((b) => (b.kind === 'task' ? [b, ...all(b.children)] : [b]));
const blocks = all(lab.blocks);
const predicts = blocks.filter((b): b is Extract<Block, { kind: 'cpppredict' }> => b.kind === 'cpppredict');
const exercises = blocks.filter((b): b is Extract<Block, { kind: 'cpp' }> => b.kind === 'cpp');
const wrap = (code: string) => (/\bmain\s*\(/.test(code) ? code : `#include <iostream>\n#include <string>\n#include <cmath>\n#include <algorithm>\nusing namespace std;\nint main() {\n${code}\nreturn 0;\n}\n`);

test('the lab and module compile cleanly, fit about 3 hours (with the Start here part) and use the C++ kit', () => {
  assert.deepEqual(lab.warnings, []);
  const parts = lab.blocks.filter((b) => b.kind === 'part') as Extract<Block, { kind: 'part' }>[];
  assert.equal(parts.length, 9);
  assert.equal(parts[0].title, 'Start here: the words of C++');
  const minutes = parts.reduce((a, p) => a + parseInt(p.time), 0);
  assert.ok(minutes >= 150 && minutes <= 180, `${minutes} minutes`);
  assert.equal(lab.meta.estimatedTime, minutes % 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes / 60} h`);
  assert.ok(lab.hasCheckin);
  assert.ok(sanitizeFlow(introComputingRevisionLab(), 'lab').ok);
  const mod = compileModule(introComputingModule());
  assert.equal(mod.meta.code, '26CSCI01P');
  assert.equal(mod.meta.years, 'Prep year');
  assert.equal(mod.meta.faculty, 'informatics-computer-science');
  assert.deepEqual(mod.items, [{ kind: 'week', title: 'Week 6 · Revision' }, { kind: 'lab', slug: 'revision-week-6' }]);
  const kit = new Set(nodesOfKits(['cpp']));
  for (const n of introComputingRevisionLab().nodes) if (n.type !== 'start') assert.ok(kit.has(n.type as never), `${n.type} is in the C++ palette`);
});

test('every graded item is tracked: progress and the live class view see each check, prediction and puzzle', () => {
  const structure = labStructure(KEY, 'Revision', lab.outline, (id) => {
    const ex = lab.exercises[id];
    return ex ? { title: ex.title, checks: ex.checks.length } : null;
  });
  const graded = blocks.filter((b) => b.kind === 'cpppredict' || b.kind === 'parsons' || (b.kind === 'cpp' && b.checks.length)).length;
  assert.equal(structure.exercises.length, graded);
  assert.ok(structure.tasks.length >= 20);
  // the 14 quiz questions are all there
  assert.equal(predicts.filter((p) => /^q[45]-\d$/.test(p.id.split('--').pop()!)).length, 14);
});

test('answer keys are right: the correct option is what the program really prints, and no wrong option is', () => {
  for (const id of OUTPUT_PREDICTS) {
    const p = predicts.find((x) => x.id === `${KEY}--${id}`);
    assert.ok(p, `${id} exists`);
    const r = run(wrap(p.code), p.input ? `${p.input}\n` : '');
    assert.equal(r.status, 'done', `${id}: ${JSON.stringify(r.error)}`);
    const out = r.output.replace(/\s+$/, '');
    const right = p.options.find((o) => o.correct)!.text;
    assert.ok(out.endsWith(right), `${id}: printed “${out}”, key says “${right}”`);
    for (const o of p.options.filter((x) => !x.correct)) assert.notEqual(out, o.text, `${id}: a wrong option matches the output`);
  }
});

test('every predict program runs — except the two that must fail (char a = "a"; reading total before it has a value)', () => {
  for (const p of predicts) {
    const name = p.id.split('--').pop();
    const r = run(wrap(p.code), p.input ? `${p.input}\n` : '');
    if (name === 'q4-1') { assert.equal(r.status, 'compile-error'); assert.match(String(r.error?.message), /char/); continue; }
    if (name === 'mem-uninit') { assert.equal(r.status, 'error'); assert.match(String(r.error?.message), /Run-Time Check Failure #3/); continue; }
    assert.equal(r.status, 'done', `${name}: ${JSON.stringify(r.error)}`);
    assert.equal(p.options.filter((o) => o.correct).length, 1, `${name} has one right answer`);
  }
  // Q5: hello prints 2, the distractors print 1
  const q5 = predicts.find((p) => p.id.endsWith('--q5-5'))!;
  for (const [typed, want] of [['hello', '2'], ['pizza', '1'], ['zero', '1'], ['z', '1']]) assert.equal(run(wrap(q5.code), `${typed}\n`).output.trim(), want);
});

const SOLUTIONS: Record<string, string> = {
  'modify-sum': `#include <iostream>
using namespace std;
int main() {
    int num1, num2, sum;
    cout << "Hello, I calculate the sum of two numbers\\n";
    cout << "please enter two numbers: ";
    cin >> num1; cin >> num2;
    sum = num1 + num2;
    cout << "the sum is: "; cout << sum; cout << "\\n";
    cout << "Goodbye\\n";
    return 0;
}`,
  'make-average': `#include <iostream>
using namespace std;
int main() {
    float num1, num2, average;
    cout << "I calculate the average of two numbers\\n";
    cout << "please enter two numbers: ";
    cin >> num1 >> num2;
    average = (num1 + num2) / 2;
    cout << "the average is: " << average << "\\n";
    cout << "Goodbye\\n";
    return 0;
}`,
  'make-circle': `#include <iostream>
#include <cmath>
using namespace std;
int main() {
    const float pi = 3.14159;
    float r;
    cout << "I calculate the area and circumference of a circle\\n";
    cout << "please enter the radius: ";
    cin >> r;
    float area = pi * pow(r, 2);
    float circumference = 2 * pi * r;
    cout << "area: " << area << "\\n";
    cout << "circumference: " << circumference << "\\n";
    cout << "Goodbye\\n";
    return 0;
}`,
  'make-even': `#include <iostream>
using namespace std;
int main() {
    int n;
    cout << "I tell you whether a number is even or odd\\n";
    cout << "please enter a whole number: ";
    cin >> n;
    if (n % 2 == 0) cout << "the number is even\\n";
    else cout << "the number is odd\\n";
    cout << "Goodbye\\n";
    return 0;
}`,
  'modify-lower': `#include <iostream>
using namespace std;
int main() {
    char c;
    cout << "Hello, I convert uppercase to lowercase\\n";
    cout << "please enter an uppercase character: ";
    cin >> c;
    cout << "The lowercase is: "; cout << (char)(c + 32); cout << "\\n";
    return 0;
}`,
  'modify-pele': `#include <iostream>
#include <string>
using namespace std;
int main() {
    string line, first, second;
    int sp_index;
    cout << "please enter a footballer's name: ";
    getline(cin, line);
    if (line.find(' ') == string::npos) {
        cout << "Only one name: " << line << "\\n";
    } else {
        sp_index = line.find(' ');
        first = line.substr(0, sp_index);
        second = line.substr(sp_index + 1);
        cout << "first name: " << first << "\\n";
        cout << "second name: " << second << "\\n";
    }
    cout << "goodbye\\n";
    return 0;
}`,
};

for (const ex of exercises) {
  const name = ex.id.split('--').pop()!;
  test(`exercise ${name}: the starter builds but does not pass; the reference solution passes every check`, () => {
    assert.ok(ex.checks.length >= 3, 'at least three checks');
    assert.ok(compile(ex.starter).ok, 'the starter builds');
    const start = gradeCpp(ex.starter, ex.checks);
    assert.ok(start.results.some((r) => !r.pass), 'the starter is not already a solution');
    const sol = SOLUTIONS[name];
    assert.ok(sol, 'has a reference solution');
    const out = gradeCpp(sol, ex.checks);
    assert.deepEqual(out.results.filter((r) => !r.pass), [], JSON.stringify(out, null, 1));
    assert.ok(ex.hints.length >= 2, 'has hints');
  });
}

test('typical wrong answers get the right feedback', () => {
  const avg = exercises.find((e) => e.id.endsWith('--make-average'))!;
  const intAvg = SOLUTIONS['make-average'].replace('float num1, num2, average;', 'int num1, num2, average;');
  const r1 = gradeCpp(intAvg, avg.checks);
  assert.ok(r1.results.find((r) => r.name === '3 and 4')!.pass === false, 'int average of 3 and 4 is 3, not 3.5');
  const noBrackets = SOLUTIONS['make-average'].replace('(num1 + num2) / 2', 'num1 + num2 / 2');
  assert.equal(gradeCpp(noBrackets, avg.checks).results[0].pass, false, 'forgot the brackets');
  const even = exercises.find((e) => e.id.endsWith('--make-even'))!;
  const eqOne = SOLUTIONS['make-even'].replace('if (n % 2 == 0) cout << "the number is even\\n";\n    else cout << "the number is odd\\n";', 'if (n % 2 == 1) cout << "the number is odd\\n";\n    else cout << "the number is even\\n";');
  assert.notEqual(eqOne, SOLUTIONS['make-even']);
  const r2 = gradeCpp(eqOne, even.checks);
  assert.equal(r2.results.find((r) => r.name === '-3 is odd')!.pass, false, '== 1 fails for -3');
  const pele = exercises.find((e) => e.id.endsWith('--modify-pele'))!;
  const lecture = gradeCpp(pele.starter, pele.checks);
  assert.equal(lecture.results.find((r) => r.name === 'Pele')!.pass, false, 'the lecture program prints Pele twice');
});

test('the order-the-lines puzzle: 7 cards between a fixed top and bottom, and the program it makes is right', async () => {
  const { splitCards } = await import('../src/lab/cpp/ui/puzzles.ts').catch(() => ({ splitCards: null as never }));
  if (splitCards) {
    const { head, cards, tail } = splitCards(PRODUCT_PROGRAM);
    assert.equal(cards.length, 7);
    assert.match(head.join('\n'), /int main\(\) \{/);
    assert.match(tail.join('\n'), /return 0;/);
  }
  const c = compile(PRODUCT_PROGRAM);
  assert.ok(c.ok);
  const m = new Machine(c.ok ? c.program : (null as never), { input: '3 5\n' });
  m.run();
  assert.match(m.printed, /the product is: 15/);
});

test('the site ships the module itself: one seed, published content, only the C++ components', () => {
  const seeds = shippedSeeds();
  assert.equal(new Set(seeds.map((s) => s.id)).size, seeds.length, 'seed ids are unique');
  // @1 created the module; @2 only rewrites the live lab (it never creates anything)
  assert.deepEqual(seeds.map((s) => [s.id, Boolean(s.update)]), [['intro-to-computing@1', false], ['intro-to-computing@2', true]]);
  assert.ok(seeds[1].labs[0].flow.nodes.some((n) => n.id === 'p0'), 'the update carries the Start here part');
  const intro = seeds.find((s) => s.module.slug === 'intro-to-computing');
  assert.ok(intro, 'Introduction to Computing is shipped');
  assert.equal(intro.module.title, 'Introduction to Computing');
  assert.deepEqual(intro.labs.map((l) => l.slug), ['revision-week-6']);
  assert.ok(intro.module.labNodes.includes('cpp') && !intro.module.labNodes.includes('exercise'));
  // the lab on the module canvas is the one that ships
  assert.ok(compileModule(intro.module.flow).items.some((i) => i.kind === 'lab' && i.slug === 'revision-week-6'));
  assert.deepEqual(compileLab(intro.labs[0].flow, 'intro-to-computing--revision-week-6').warnings, []);
});
