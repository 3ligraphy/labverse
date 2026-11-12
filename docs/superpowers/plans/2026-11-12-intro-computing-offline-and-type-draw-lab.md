# Intro to Computing: works without the database + "Type it, then draw it" lab — Plan

**Why (TA, 2026-11-12):** the production database (Neon) is over its free quota, so every database read fails: builder
modules show "Module not found", sign-in and admin are down. The TA asked to (1) bring Intro to Computing back
"temporarily", and (2) add a very detailed lab, only from the lecture files (Lectures 1–5, the Lecture 4 & 5 quiz,
Wk6ProgramLogic, Wk8ProgramLogic): lots of visuals, typed C++ programs in three levels (easy, medium, hard — each made
harder after review), then flowchart questions. Focus: typing code and making flowcharts. Admin cannot come back from
code: sign-in reads the database (told the TA).

**Rules:** plain direct English, no stories/metaphors; content only from the lecture files (exception: the standard
flowchart shapes, needed because Wk8 asks students to draw flowcharts); C++ programs use sequence and selection only
(no loop lessons in the files); loops appear in flowcharts only (Wk8 5–7). No complex numbers / quaternions (the TA
removed them before). Paste is blocked in programs. Node ids are stable (progress is stored by them).

## Task 1 — Shipped modules without the database
- `src/lib/platform/shipped.ts` (pure): `shippedState(seeds = shippedSeeds()): Map<string, { module: ModuleRow; labs: LabRow[] }>`
  replays create / update / extend / patch / publish exactly like `PlatformStore.applySeeds`.
- `server.ts`: `loadModule` and `moduleCards` use it when the store is missing or a query throws.
- Test `tests/shipped-modules.test.ts`: Intro to Computing has revision-practice published and revision-week-6 hidden,
  the @10 patch is applied, AI for Coding has lab-01; an extend seed appends its labs and module nodes.
- Ship alone (restores the module on production now).

## Task 2 — Flowchart engine (`src/lab/flow/`)
- `chart.ts`: types `Shape = 'terminal' | 'io' | 'process' | 'decision'`, `FNode { id, shape, text, x, y }`,
  `FEdge { from, to, label?: 'yes' | 'no' }`, `Chart { nodes, edges }`; text DSL `parseChart(src)` / `chartToText(c)`.
- `run.ts`: `runChart(chart, input: string, opts?) → { ok, output, steps: string[] (node ids), vars, error? }`.
  Statements: `input a, b` (read), `output "text", expr` (print), `x = expr` (assign, `;` separates), decision `expr`
  (`=` means `==` there, `?` allowed, `and`/`or`/`not`, `≠ ≤ ≥ <>`, `mod`); int/int is integer division like C++;
  numbers print like cout (6 significant digits). Plain-English errors: no Start, two Starts, a shape without an arrow
  out, a decision without Yes/No, unknown variable, bad text, input ran out, 5000 steps (loop never ends).
- `check.ts`: `checkChart(chart, checksText)` reuses the C++ check line syntax (`name :: in …; expect …; not …`) plus
  structure steps `uses decision`, `uses loop`.
- Tests `tests/flowchart.test.ts` (TDD).

## Task 3 — Flowchart widgets + builder node
- Node type `flowchart` (kit cpp) in `core.ts`: fields title, goal, mode (Show / Read it and type the output / Fill the
  boxes / Draw it yourself), chart (DSL), input, bank (fill), checks, answer (trace, optional).
- `src/lab/flow/ui.ts`: SVG renderer, Run with step highlight + variables + screen; trace (typed answer), fill (a
  select in each empty box), draw (palette, drag, edit text, connect by dragging the handle, Yes/No labels, delete,
  undo-free simple editor saved in localStorage); `mountFlowchart(host, cfg, track)`; CppBlock/LabBlock/mount wiring.
- Test: the node compiles (blocks + exercises), the fallback chart for trace answers equals the run output.

## Task 4 — The lab `type-and-draw` (extend seed `intro-to-computing@11`)
Parts: 1 Easy programs (8) · 2 Medium programs (9) · 3 Hard programs (9) · 4 Flowcharts: shapes and reading
(visual runs + 7 trace) · 5 Fill the boxes (7) · 6 Draw it yourself (9, Wk8 1–8 + median). Visuals from the C++ kit
before each group. Test `tests/intro-type-draw.test.ts`: every reference program passes every check, every starter
fails, typical wrong programs fail; every flowchart reference passes, every starter fails, trace answers match runs.

## Task 5 — Verify and ship
`npm test`, `astro check`, build; local browser with the database switched off (fallback) and on; push; live check
`/intro-to-computing` and the new lab on production.
