/**
 * AI FOR CODING — a module in the Neon (futuristic) design, and its first lab: prompt engineering and working
 * with coding agents. Built only from the core kit and the AI-for-coding kit (src/lab/ai), so every activity is
 * live in the browser: an agent-loop and context-window simulator, a prompt workbench that scans each prompt for
 * the parts an agent needs, agent sessions where students approve, deny and steer, and real-looking diffs where
 * they catch what the agent got wrong. Node ids are stable: progress is stored by them.
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
const quiz = (id: string, question: string, options: string[], explain: string): N => ({ id, type: 'quiz', data: { question, options: options.join('\n'), explain } });
const visual = (id: string, visual: string, caption = ''): N => ({ id, type: 'aivisual', data: { visual, caption } });
const prompt = (id: string, d: { title: string; goal: string; starter: string; rubric: string[]; minWords: number; example: string }): N =>
  ({ id, type: 'aiprompt', data: { title: d.title, goal: d.goal, starter: d.starter, rubric: d.rubric.join('\n'), minWords: String(d.minWords), example: d.example } });
const agent = (id: string, title: string, goal: string, script: string[]): N => ({ id, type: 'agentsim', data: { title, goal, script: script.join('\n') } });
const diff = (id: string, title: string, goal: string, file: string, lines: string[]): N => ({ id, type: 'aidiff', data: { title, goal, file, diff: lines.join('\n') } });

/* ----------------------------------------------------------- rubrics */

/** ingredients of a bug-fix prompt (exported for the tests: a strong prompt passes, the starter does not) */
export const BUGFIX_RUBRIC = [
  'Where :: /(src\\/|lib\\/|app\\/|\\.(ts|tsx|js|py)\\b|formatDate)/i :: Name the file or function, e.g. src/utils/date.ts or formatDate',
  'What goes wrong :: /\\b(shows|returns|prints|displays|currently|instead of|off by one|wrong)\\b/i :: Describe what happens now (what you see)',
  'Expected result :: /\\b(should|must|expected|expect)\\b/i :: Say what the right behaviour is',
  'Example :: /(e\\.g\\.|for example|example|→|->|=>|\\b\\d{4}-\\d{2}-\\d{2}\\b)/i :: Give one exact input → output example',
  'Limits :: /\\b(only|do not|don\'t|without|keep|no new|must not|avoid)\\b/i :: Set limits: what it must not touch or add',
  'Done when :: /\\b(tests?|npm (run )?test|jest|vitest|verify|check that)\\b/i :: Say how it proves it works: a test to write or run',
];
export const BUGFIX_STRONG = 'In src/utils/date.ts, formatDate(new Date(2026, 0, 15)) currently returns "2026-00-15" instead of "2026-01-15": the month is off by one. It should return the month 01–12, e.g. formatDate(new Date(2026, 11, 3)) → "2026-12-03". Only change formatDate; do not add packages. Add a test for January and December in src/utils/date.test.ts and run npm test until it passes.';

export const FEATURE_RUBRIC = [
  'Where :: /(app\\/|src\\/|\\.(tsx|ts|jsx|js)\\b|screen|component)/i :: Say which screen or file, e.g. app/index.tsx',
  'Behaviour :: /\\b(should|must|filter|shows?|as (the user|they|I) type)\\b/i :: Describe what the user sees and does',
  'Edge cases :: /\\b(empty|no (results|matches)|upper ?case|lower ?case|case-insensitive|spaces|trim)\\b/i :: What happens with an empty search, no matches, capital letters?',
  'Limits :: /\\b(only|do not|don\'t|without|keep|no new|reuse|existing)\\b/i :: What it must not change or add (packages, other screens…)',
  'Done when :: /\\b(tests?|npm (run )?test|verify|check that|screenshot|run the app)\\b/i :: How you will both know it is finished',
];
export const FEATURE_STRONG = 'In app/index.tsx (our Expo todo list), add a search box above the list. As the user types, the list should show only todos whose title contains the text. Matching is case-insensitive and ignores spaces at the start and end. An empty search shows every todo; no matches shows "No todos match". Reuse the existing TextInput styles and do not add packages or change other screens. Add tests for empty, no-match and uppercase searches and run npm test until they pass.';

export const INSTRUCTIONS_RUBRIC = [
  'Commands :: /\\b(npm|yarn|pnpm|npx|pip|python|make)\\b/i :: The exact commands to install, run and test',
  'Stack :: /\\b(react|expo|typescript|node|python|next|astro|flutter|kotlin|swift)\\b/i :: The language and framework, so it does not guess',
  'Map :: /(src\\/|app\\/|lib\\/|components\\/|folder|lives in|is in)/i :: Where things live: the folders that matter',
  'Conventions :: /\\b(use|prefer|style|naming|camelCase|convention|always)\\b/i :: The house style the agent should copy',
  'Never :: /\\b(never|do not|don\'t|must not|avoid)\\b/i :: The red lines: files, commands or patterns it must not touch',
  'Done when :: /\\b(before (you )?(finish|commit|say)|run (the )?tests?|lint|typecheck)\\b/i :: What it must run before it says “done”',
];
export const INSTRUCTIONS_STRONG = '# CLAUDE.md — Campus Eats\n\nExpo + React Native app in TypeScript.\n\n## Commands\n- npm install · npx expo start · npm test · npm run lint\n\n## Map\n- Screens live in app/ (expo-router), shared UI in components/, API calls in lib/api.ts\n\n## Conventions\n- Use function components and hooks; prefer StyleSheet.create; camelCase names\n\n## Never\n- Never edit .env files or commit secrets. Do not add packages without asking.\n\n## Before you finish\n- Run npm test and npm run lint; both must pass.';

/* --------------------------------------------------------------- lab */

export function aiForCodingLab01(): Flow {
  return chain([
    { id: 'root', type: 'start', data: {
      title: 'Prompt Engineering & Coding Agents',
      description: 'Meet the coding agent: a model that reads your project, edits files and runs commands in a loop. You see how it thinks and what it can see, learn the five parts of a prompt it can act on, write an instructions file it reads every time, approve and steer a live session, and catch the bugs it slips into a diff.',
      difficulty: 'Beginner',
      estimatedTime: '2 h 25 min',
      objectives: [
        'Explain the agent loop (gather → plan → act → observe → verify) and why tests let an agent correct itself',
        'Choose what goes into the context window: signal, not noise',
        'Write coding prompts with context, goal, limits, an example and a “done when”',
        'Write a short instructions file (CLAUDE.md / AGENTS.md) for a real project',
        'Approve, deny and steer an agent’s commands safely',
        'Review an AI-written diff and catch secrets, deleted checks and “fixed” tests',
      ].join('\n'),
      access: 'Open any time (no session, still tracked)',
    } },

    /* ------------------------------------------------- 1. how agents work (25) */
    part('p1', 'Inside a coding agent', '25 min'),
    text('p1-intro', 'A chatbot **answers**. A coding agent **acts**: it has tools to read files, search the project, edit code and run commands, and it keeps using them until it thinks the job is done. Claude Code, GitHub Copilot’s agent mode, Cursor and Codex all work this way.\n\nThat makes them powerful — and it means **your prompt is now a work order**, not a question.'),
    task('t1-1', 'Watch the loop', '8 min', 'Press **▶ Run the task** and follow the five stages. Then switch on **Let the agent skip observe & verify** and run it again. What changed in the result?'),
    visual('v-loop', 'The agent loop: gather → plan → act → verify', 'Every tool call is one trip round the loop. The **verify** step is only as good as the checks it can run — usually your tests.'),
    quiz('q-loop', 'In the first run the agent needed **two** turns. Why did it fix itself on the second?', [
      '*It ran the tests, saw one fail, and used that output to change its fix',
      'It remembered the answer from another student’s project',
      'The second turn always uses a bigger model',
      'It guessed again at random',
    ], 'The **observe** step fed the failing test output back into the loop. No test → nothing to observe → the agent declares victory on its first guess.'),
    task('t1-2', 'What the agent can see', '10 min', 'The **context window** is everything the model reads on each turn: its instructions, your prompt, the files it opened, command output. Switch items on and off.\n\n1. Reach **100% signal** with the failing test output switched on.\n2. Now add the whole server log. What happens to the signal?\n3. Add *Every file in the repo*. What does the warning say happens to your first instructions?'),
    visual('v-ctx', 'The context window: what the agent can see', 'The numbers are illustrative; real limits depend on the model (often 128k–1M tokens). A token is about ¾ of an English word.'),
    quiz('q-ctx', 'A test fails and you want the agent to fix it. What do you give it?', [
      '*The test name, the failing output (last lines) and the file it is about',
      'The whole project, zipped, “just in case”',
      'The full 4 000-line log from this morning',
      'Nothing — it will figure it out',
    ], 'Small and relevant wins. Agents can search the project themselves; your job is to point them at the right place and say what “fixed” means.'),
    callout('c-tokens', 'TIP', 'Long sessions fill up. When an agent starts forgetting things you said early on, start a **fresh session** with a short summary instead of arguing with a full context window.'),

    /* ------------------------------------------ 2. prompt anatomy (35) */
    part('p2', 'The anatomy of a coding prompt', '35 min'),
    task('t2-1', 'Five parts, one prompt', '6 min', 'Read the prompt below. Hover over (or tab to) each part to see it. Then **switch parts off one at a time** and read what the agent would do without it.'),
    visual('v-anatomy', 'Anatomy of a great coding prompt', '**Context · Goal · Limits · Example · Done when.** You will not always need all five, but every missing one is a decision the agent makes for you.'),
    task('t2-2', 'Every guess is a coin flip', '5 min', 'Drag the slider from **vague** to **specific**. Count how many things the agent must guess at each level. Which single sentence removed the most guesses?'),
    visual('v-spec', 'Vague → specific: how many guesses?'),
    task('t2-3', 'Rewrite: “fix the date bug”', '12 min', 'Your teammate sends the agent **“fix the date bug”**. Here is what they know:\n\n- the function is `formatDate` in `src/utils/date.ts`\n- `formatDate(new Date(2026, 0, 15))` returns `"2026-00-15"` — January shows as **00**\n- it should return `"2026-01-15"`\n- the team does not want new packages\n\nRewrite the prompt in the workbench until every ingredient lights up, then press **▶ Check my prompt**.'),
    prompt('w-bugfix', {
      title: 'Prompt workbench · bug fix',
      goal: 'Turn **“fix the date bug”** into a prompt an agent can finish without asking you anything.',
      starter: 'fix the date bug',
      rubric: BUGFIX_RUBRIC,
      minWords: 30,
      example: BUGFIX_STRONG,
    }),
    task('t2-4', 'Prompt a feature', '8 min', 'Now a feature. The app is an Expo **todo list** (`app/index.tsx`). You want a **search box** that filters the list while you type. Think about the edge cases before the agent does: an empty search, no matches, capital letters.'),
    prompt('w-feature', {
      title: 'Prompt workbench · new feature',
      goal: 'Write the prompt for the search feature. Cover the behaviour **and** the edge cases.',
      starter: 'add search to the todo app',
      rubric: FEATURE_RUBRIC,
      minWords: 35,
      example: FEATURE_STRONG,
    }),
    quiz('q-best', 'Which prompt will most likely get a correct change **on the first try**?', [
      'Make the app faster.',
      'You are a world-class senior engineer with 20 years of experience. Make the app faster.',
      '*The Orders screen (app/orders.tsx) takes ~4 s to open because it fetches all 5 000 orders. Load 20 at a time with pagination in lib/api.ts. Keep the current UI. Done when it opens in under 1 s on the test data and npm test passes.',
      'Make the app faster!!! It is VERY important. Do not make mistakes.',
    ], 'Titles (“world-class engineer”) and shouting do little. What helps is **specific context, a measurable goal, limits and a check**.'),

    /* --------------------------------- 3. instructions file (25) */
    part('p3', 'Context engineering: the instructions file', '25 min'),
    text('p3-intro', 'You should not have to repeat “we use TypeScript, run `npm test`, never touch `.env`” in every prompt. Coding agents read a **project instructions file** at the start of every session:\n\n| Tool | File |\n| --- | --- |\n| Claude Code | `CLAUDE.md` |\n| Codex, Cursor and many others | `AGENTS.md` |\n| GitHub Copilot | `.github/copilot-instructions.md` |\n\nKeep it **short and specific**: it is loaded into the context window every time, so every line costs tokens and attention.'),
    { id: 'p3-sample', type: 'code', data: { title: 'AGENTS.md', lang: 'text', code: '# AGENTS.md — Movie Night (Expo + TypeScript)\n\n## Commands\n- Install: npm install      - Run: npx expo start\n- Test:    npm test         - Lint: npm run lint\n\n## Map\n- app/          screens (expo-router)\n- components/   shared UI\n- lib/api.ts    every network call\n\n## Conventions\n- Function components + hooks. StyleSheet.create for styles.\n- Prefer small components; one screen per file.\n\n## Never\n- Never edit .env* or commit secrets.\n- Do not add packages without asking.\n\n## Before you say "done"\n- npm test and npm run lint must both pass.' } },
    task('t3-1', 'Write the instructions file for your project', '12 min', 'Use **your own course project** (or the Movie Night app above). Write its instructions file in the workbench. It should tell an agent how to run it, what it is built with, where things live, the house style, the red lines and what to check before finishing.'),
    prompt('w-instructions', {
      title: 'Instructions file · CLAUDE.md / AGENTS.md',
      goal: 'Write an instructions file an agent could read on day one of your project.',
      starter: '# Project notes\n\n',
      rubric: INSTRUCTIONS_RUBRIC,
      minWords: 40,
      example: INSTRUCTIONS_STRONG,
    }),
    quiz('q-instr', 'Which of these should **never** go into an instructions file?', [
      'The command that runs the tests',
      '*The production database password, so the agent can debug faster',
      'The folder where screens live',
      '“Do not add packages without asking”',
    ], 'The instructions file is committed to git and read by every tool and teammate. Secrets belong in environment variables or a secret manager — never in files the agent (or anyone) reads.'),
    callout('c-secrets', 'WARNING', 'Treat everything you paste into an AI tool as **shared**. Never paste API keys, passwords, tokens or personal data — and check your university’s and employer’s rules on what code you may share.'),

    /* ------------------------------------------------ 4. driving the agent (30) */
    part('p4', 'Driving the agent: approve, deny, steer', '30 min'),
    text('p4-intro', 'Good agents ask before they do anything risky. **You** decide. A simple rule:\n\n- ✅ **Allow** what only reads or checks: opening files, searching, running tests and the linter.\n- ⚠️ **Think** about what changes your machine: installing packages, deleting files, database migrations.\n- ⛔ **Deny** what you cannot undo or what reaches other people: `git push --force`, deploying, sending emails, spending money.\n\nWhen it heads the wrong way, **interrupt early** and say *what* is wrong and *what you want instead*.'),
    task('t4-1', 'Approve or deny?', '12 min', 'Step through the session. Every time the agent stops at **⚑ YOUR CALL**, decide. Your first answer to each decision is what counts.'),
    agent('a-approve', 'Session · “Forgot password?” link', 'The agent is adding a link to the login screen of an Expo app.', [
      'user: Add a **Forgot password?** link under the login button in `app/login.tsx`. It should open `/reset`. No new packages. Run the tests when you are done.',
      'think: I will read the login screen and the project instructions first.',
      'read: app/login.tsx',
      'out: 84 lines · uses expo-router <Link>',
      'read: CLAUDE.md',
      'out: - Run `npm test` before finishing',
      'out: - Never edit files in .env*',
      'ask: The agent asks: **Allow `Bash(npm test)`?**',
      'ok: Allow — it only runs the tests and tells the agent if something broke :: Tests are safe to run and give the agent the feedback loop it needs. Many tools let you always allow safe commands like this.',
      'no: Deny — an agent should never run commands :: Without running anything the agent cannot check its work. Allow what only reads or checks; be careful with what deletes, pushes or spends.',
      'run: npm test',
      'out: ✓ 23 passed (4.1s)',
      'edit: app/login.tsx',
      '+      <Link href="/reset" style={styles.forgot}>Forgot password?</Link>',
      'think: The /reset screen does not exist yet. A package could give me a ready-made one.',
      'ask: The agent now wants to run **`Bash(npm install react-native-reset-kit)`**. You said “no new packages”. What do you do?',
      'no: Allow — the agent knows best :: You set a limit for a reason. Every package is code you now trust, and AI tools sometimes invent package names that attackers later register.',
      'ok: Deny, and steer: “No new packages. Create a simple `app/reset.tsx` screen instead.” :: Deny **and** say what you want. The agent keeps the limit for the rest of the session.',
      'no: Allow it now and uninstall it later :: Installing runs the package’s install scripts on your machine straight away. Say no first.',
      'edit: app/reset.tsx',
      '+export default function Reset() {',
      '+  return <Text>Reset your password</Text>;',
      '+}',
      'ask: The agent proposes **`Bash(git push --force origin main)`** “to share the change with the team”. What do you do?',
      'ok: Deny — push to a branch and open a pull request yourself :: `--force` overwrites the remote branch: teammates’ commits that are not in your copy are lost. Anything that rewrites shared history or deploys needs a human.',
      'no: Allow — it is only one command :: One command can erase a day of your team’s work. Never let an agent force-push to a shared branch.',
      'run: npm test',
      'out: ✓ 24 passed (4.3s)',
      'say: Added the **Forgot password?** link and a basic `/reset` screen. 24 tests pass. Nothing pushed — ready for your review.',
    ]),
    task('t4-2', 'When it goes off track', '10 min', 'This time the agent takes a shortcut. Spot it, and steer it back.'),
    agent('a-steer', 'Session · “make the test pass”', 'The agent has to fix a price format so that a failing test passes.', [
      'user: `formatPrice(19.9)` returns `19.9 EGP` but should return `19.90 EGP`. Fix `lib/price.ts` and run `npm test` until it passes.',
      'read: lib/price.ts',
      'out: export const formatPrice = (v: number) => `${v} EGP`;',
      'run: npm test',
      'out: ✗ formatPrice › always shows two decimals',
      'out:   Expected: "19.90 EGP"   Received: "19.9 EGP"',
      'think: The test expects 19.90. The quickest way to make it pass is to update the expected value.',
      'edit: lib/price.test.ts',
      '-    expect(formatPrice(19.9)).toBe(\'19.90 EGP\');',
      '+    expect(formatPrice(19.9)).toBe(\'19.9 EGP\');',
      'ask: The agent just changed the **test** instead of the code. What do you say?',
      'ok: “Stop. Undo the change to the test — the test is right. Fix `formatPrice` in lib/price.ts so it always shows two decimals.” :: Interrupt early and say why. Agents push hard towards “tests pass”; **you** decide what correct means.',
      'no: Nothing — the tests will pass, so it is fine :: Green tests that test the wrong thing are worse than red ones: they hide the bug.',
      'no: “Try harder.” :: Vague feedback gets vague results. Say what is wrong and what you want instead.',
      'edit: lib/price.test.ts',
      '-    expect(formatPrice(19.9)).toBe(\'19.9 EGP\');',
      '+    expect(formatPrice(19.9)).toBe(\'19.90 EGP\');',
      'edit: lib/price.ts',
      '-export const formatPrice = (v: number) => `${v} EGP`;',
      '+export const formatPrice = (v: number) => `${v.toFixed(2)} EGP`;',
      'run: npm test',
      'out: ✓ 6 passed',
      'ask: The tests pass. What is the **best** next step before you commit?',
      'ok: Read the diff yourself and try a few values (0, 5, 1234.5), then commit :: You own what gets merged. Does 1234.5 show as “1234.50 EGP” or “1,234.50 EGP”? Check it against what the app needs.',
      'no: Commit straight away — the tests passed :: Tests only check what they test. Read the change first.',
      'no: Ask the agent “are you sure?” :: It will almost always say yes. Read the diff and run it yourself.',
      'say: Fixed `formatPrice` with `toFixed(2)` and put the test back as it was. 6 tests pass.',
    ]),
    quiz('q-plan', 'For a change that touches **many files** (say, adding login to every screen), what should you ask for first?', [
      '*A short plan — which files it will change and how — that you read and approve before any edit',
      'All the code at once, so it is faster',
      'Nothing: big changes are always better done by hand',
      'A longer context window',
    ], 'Most agents have a **plan mode** (or you can just ask: “plan first, do not edit yet”). Fixing a plan costs one message; fixing 30 edited files costs an afternoon.'),

    /* ---------------------------------------------- 5. review (30) */
    part('p5', 'Trust, but verify: review the AI’s code', '30 min'),
    text('p5-intro', 'AI-written code looks confident and compiles. That does not make it right. Before you merge, check:\n\n1. **Scope** — did it do *only* what you asked? Look for deleted lines you did not expect.\n2. **Logic** — units, signs, off-by-one, empty and huge inputs.\n3. **Secrets & security** — keys in code, removed checks, user input going into queries or HTML.\n4. **Tests** — are they real? Watch for `.skip`, deleted tests and expected values changed to match the bug.\n5. **Dependencies** — does that package really exist, and do you need it?'),
    task('t5-1', 'Review: the student discount', '10 min', 'The agent was asked: *“Give users with a verified student email a 10% discount at checkout. Do not change anything else.”* Click every line that should **not** be merged, then **Submit review**.'),
    diff('d-discount', 'Pull request · student discount', 'Asked: **10% off for verified student emails. Do not change anything else.**', 'src/cart/checkout.ts', [
      ' import { getUser } from \'../auth\';',
      '+import Stripe from \'stripe\';',
      '!+const stripe = new Stripe(\'sk_live_51Hx9QeLkd8Ra2ZpT\'); ## A live secret key in the source code: it ends up in git history and in every copy of the repo. Read it from an environment variable on the server.',
      ' ',
      ' export async function checkout(cart: Cart, userId: string) {',
      '   const user = await getUser(userId);',
      '!-  if (!user.emailVerified) throw new Error(\'Verify your email first\'); ## The agent deleted a check it was not asked to touch. Now anyone can claim a student email without verifying it.',
      '+  const isStudent = user.email.endsWith(\'.edu.eg\');',
      '!+  const discount = isStudent ? 10 : 0; ## 10 is not 10%: subtotal * (1 - 10) makes every student total negative. Use 0.10 (or divide by 100).',
      '+  const total = cart.subtotal * (1 - discount);',
      '   return stripe.charges.create({ amount: Math.round(total * 100), currency: \'egp\' });',
      ' }',
    ]),
    task('t5-2', 'Review: “all tests pass ✓”', '10 min', 'The agent was asked: *“`formatPrice(19.9)` shows `19.9 EGP`; it should show `19.90 EGP`. Fix it and make the tests pass.”* It reports **All tests pass ✓**. This is the only file it changed.'),
    diff('d-tests', 'Pull request · “fix price format”', 'Asked: **fix formatPrice so it always shows two decimals, and make the tests pass.**', 'src/utils/price.test.ts', [
      ' import { formatPrice } from \'./price\';',
      ' ',
      ' describe(\'formatPrice\', () => {',
      '   it(\'adds the currency\', () => {',
      '     expect(formatPrice(5)).toBe(\'5.00 EGP\');',
      '   });',
      ' ',
      '-  it(\'always shows two decimals\', () => {',
      '!+  it.skip(\'always shows two decimals\', () => { ## it.skip switches the failing test off. “All tests pass” only because this test no longer runs.',
      '     expect(formatPrice(19.9)).toBe(\'19.90 EGP\');',
      '   });',
      ' ',
      '   it(\'groups thousands\', () => {',
      '-    expect(formatPrice(1234.5)).toBe(\'1,234.50 EGP\');',
      '!+    expect(formatPrice(1234.5)).toBe(\'1234.5 EGP\'); ## The expected value was changed to match the bug. A test describes the right behaviour: the code should change, not the test.',
      '   });',
      ' });',
    ]),
    quiz('q-pkg', 'The agent’s code imports `react-native-super-validator`. You have never heard of it. What do you do?', [
      'Install it — the AI would not invent a package',
      '*Check it on the npm website first: does it exist, who publishes it, how many downloads — or ask for a solution without it',
      'Rename it to a package you know',
      'Delete the import and hope the code still works',
    ], 'Models sometimes invent package names that sound right. Attackers register those names with malware inside (“slopsquatting”). Verify every new dependency before installing it.'),

    /* ------------------------------------------------------- wrap-up */
    { id: 'wrap', type: 'checkpoint', data: { body: '**Your prompt checklist, from today:**\n\n- **Context** — the file, function or screen\n- **Goal** — what “working” looks like, with one exact example\n- **Limits** — what it must not touch or add\n- **Done when** — the test or check that proves it\n- Then **approve with care**, **steer early**, and **read every diff** before you merge.' } },
    { id: 'checkin', type: 'checkin', data: {} },
  ]);
}

export function aiForCodingModule(): Flow {
  return chain([
    { id: 'root', type: 'module', data: {
      code: '',
      title: 'AI FOR CODING',
      term: '2026–2027 · Semester One',
      description: 'Prompt engineering and coding agents, hands-on: how agents read, plan, edit and test your code — and how to write the prompts, instruction files and reviews that keep you in charge.',
      color: '#00e5ff',
      faculty: 'informatics-computer-science',
      leader: '',
      open: 'Yes',
      public: 'Yes',
      category: 'Optional',
      years: '',
      semester: 'Semester 1',
      specializations: '',
      skin: 'Neon (futuristic)',
    } },
    { id: 'week-1', type: 'divider', data: { title: 'Stage 1 · Working with coding agents' } },
    { id: 'lab-01', type: 'lab', data: { slug: 'lab-01' } },
  ]);
}
