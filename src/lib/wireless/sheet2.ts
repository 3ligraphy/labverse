/**
 * Wireless Networks · Week 4 Lab · Sheet 2 — the cellular concept: cells, clusters, frequency reuse and sectoring.
 * Every question, worked step and checked answer of the lab page comes from here.
 */
import { clusterSize, reuseRatio, shiftsFor, validClusterSizes } from './core.ts';

export type Practice = { label: string; answer: number; unit: string; tolerance?: number; hint: string };
export type Concept = { prompt: string; choices: { id: string; label: string }[]; answer: string; retry: string };
/** A cluster the hex explorer opens with: the shift (i, j) and what to draw. */
export type Explorer = { i: number; j: number; caption: string; triangle?: boolean; compare?: [number, number] };
export type Question = {
  id: string;
  part: string;
  title: string;
  topic: string;
  task: string;
  given?: string[];
  /** Ask for (i, j) with i² + ij + j² = shift. */
  shift?: number;
  explorer?: Explorer;
  concept?: Concept;
  practice?: Practice[];
  sectors?: boolean;
  sort?: { label: string; side: 'advantage' | 'disadvantage' }[];
  steps: { title: string; body: string }[];
  takeaway: string;
};

/** The three ideas the whole sheet uses, shown before question 1. */
export const keyIdeas = [
  { name: 'Reuse distance', formula: 'D = R √(3N)', note: 'R is the cell radius (centre to corner); N is the number of cells per cluster.' },
  { name: 'Reuse factor', formula: '1 / N', note: 'How often the same frequency set appears: once in every N cells.' },
  { name: 'Reuse ratio', formula: 'Q = D / R = √(3N)', note: 'Larger Q → co-channel cells farther apart → less interference, but fewer channels per cell.' },
] as const;

export const formulas = [
  ['Cluster size', 'N = i² + ij + j²', 'Valid number of cells per cluster.', 'i, j are whole numbers of cells'],
  ['Reuse distance', 'D = R √(3N)', 'Centre-to-centre distance between co-channel cells.', 'same unit as R'],
  ['Reuse ratio', 'Q = D / R = √(3N)', 'Co-channel separation in cell radii.', 'unitless'],
  ['Reuse factor', '1 / N', 'Rate at which the same frequency set is reused.', 'unitless'],
  ['Apothem', 'R′ = R cos 30° = (√3 / 2) R', 'Centre of a hexagon to the middle of an edge.', 'same unit as R'],
  ['Neighbour spacing', '2R′ = √3 R', 'Distance between the centres of two touching cells.', 'same unit as R'],
  ['Hexagon geometry', '(2R′)² = 3R²', 'Square of the neighbour spacing.', 'used in the proof'],
  ['Cosine law', 'c² = a² + b² − 2ab cos θ', 'Side of a triangle from two sides and the angle between them.', 'θ = 120° in the proof'],
  ['Cosine of 120°', 'cos 120° = −½', 'Turns −2ab cos θ into +ab.', 'exact value'],
  ['Shift method', 'move i cells → turn 60° → move j cells', 'Finds the nearest co-channel cell.', 'same shift from every cell'],
  ['Sectoring', '120° → 3 antennas · 60° → 6 antennas', 'Directional antennas per base station.', 'replaces one omni antenna'],
  ['Interference estimate', 'S/I ≈ (D/R)ⁿ / i₀', 'First-tier signal-to-interference ratio (beyond the sheet).', 'n = path-loss exponent; i₀ = interferers'],
] as const;

/** Every valid cluster size up to 37, with its shift and reuse ratio. */
export const clusterTable = validClusterSizes(37).map((n) => ({ n, shifts: shiftsFor(n), q: reuseRatio(n) }));

export const questions: Question[] = [
  {
    id: '1a', part: '1 (a)', topic: 'Cluster shape', title: 'Draw a cluster of 19 cells',
    task: 'Find the shift parameters i and j for a 19-cell cluster, then draw the cluster and locate its co-channel cells.',
    given: ['N = 19 cells per cluster', 'N = i² + ij + j²', 'i, j = 0, 1, 2, …'],
    shift: 19,
    explorer: { i: 3, j: 2, caption: 'Move 3 cells, turn 60°, move 2 cells: every co-channel cell is reached the same way.' },
    practice: [
      { label: 'Reuse ratio Q = D / R', answer: reuseRatio(19), unit: '× R', tolerance: .005, hint: 'Q = √(3N) = √57.' },
      { label: 'Reuse factor', answer: 1 / 19, unit: 'ratio', tolerance: .01, hint: 'Reuse factor = 1/N. A decimal is fine: 1/19 ≈ 0.0526.' },
    ],
    steps: [
      { title: 'Write the condition', body: 'A cluster tiles the plane only if <b>N = i² + ij + j²</b> for whole numbers i and j. So we need <b>i² + ij + j² = 19</b>.' },
      { title: 'Try j = 0 and j = 1', body: 'j = 0: i² = 19 → no whole number. j = 1: i² + i + 1 = 19 → i² + i = 18 → i ≈ 3.77, not whole.' },
      { title: 'Try j = 2', body: 'i² + 2i + 4 = 19 → i² + 2i − 15 = 0 → (i + 5)(i − 3) = 0 → <b>i = 3</b>. Check: 3² + 3·2 + 2² = 9 + 6 + 4 = <b>19 ✓</b>. So <b>i = 3, j = 2</b>.' },
      { title: 'Draw the cluster', body: 'Take a centre cell and the two rings around it: 1 + 6 + 12 = <b>19 cells</b>, a hexagon with rows of 3, 4, 5, 4 and 3 cells. Give each cell its own frequency set.' },
      { title: 'Place the co-channel cells', body: 'From any cell, move <b>3 cells</b> along a chain of hexagons, turn <b>60° counter-clockwise</b> and move <b>2 cells</b>. That cell reuses the same frequencies. Repeat in all six directions to find the six nearest co-channel cells.' },
      { title: 'Read off the reuse numbers', body: 'Q = D/R = √(3 × 19) = √57 = <b>7.55</b>, so co-channel cells are 7.55 cell radii apart. Reuse factor = <b>1/19 ≈ 0.0526</b>.' },
    ],
    takeaway: 'Only sizes that can be written as i² + ij + j² make clusters that repeat without gaps: 1, 3, 4, 7, 9, 12, 13, 16, 19, 21, …',
  },
  {
    id: '1b', part: '1 (b)', topic: 'Cluster shape', title: 'Draw a cluster of 28 cells',
    task: 'Find i and j for a 28-cell cluster and decide which cluster shapes are correct.',
    given: ['N = 28 cells per cluster', 'N = i² + ij + j²'],
    shift: 28,
    explorer: { i: 4, j: 2, caption: 'With i = 4, j = 2 every cell finds its co-channel partner with the same 4-then-2 shift.' },
    concept: {
      prompt: 'The solution shows a triangular arrangement of 28 cells and says it is not a valid cluster. Why?',
      choices: [
        { id: 'count', label: 'It does not contain 28 cells' },
        { id: 'shift', label: 'A shift that takes F0 to its next cluster makes another cell, like F2, land on a cell of its own cluster' },
        { id: 'angle', label: 'Clusters must always be drawn as hexagons' },
      ],
      answer: 'shift',
      retry: 'Not quite. Count is fine, and valid clusters can have several shapes. Think about what happens to the other cells when F0 is shifted.',
    },
    practice: [
      { label: 'Reuse ratio Q = D / R', answer: reuseRatio(28), unit: '× R', tolerance: .005, hint: 'Q = √(3 × 28) = √84.' },
      { label: 'Reuse factor', answer: 1 / 28, unit: 'ratio', tolerance: .01, hint: '1/28 as a decimal.' },
    ],
    steps: [
      { title: 'Solve for the shift', body: 'j = 0: i² = 28 → no. j = 1: i² + i − 27 = 0 → no whole root. j = 2: i² + 2i + 4 = 28 → i² + 2i − 24 = 0 → (i + 6)(i − 4) = 0 → <b>i = 4</b>. Check: 16 + 8 + 4 = <b>28 ✓</b>. So <b>i = 4, j = 2</b>.' },
      { title: 'More than one drawing works', body: 'The solution draws three different 28-cell shapes. Each is correct, because in each one <b>every</b> cell reaches its co-channel copy with the same shift: 4 cells, turn 60°, 2 cells.' },
      { title: 'Why the triangle fails', body: 'In the triangular arrangement there are 5 directions in which F0 could find the next cluster. But each of those shifts sends some <b>other</b> cell onto a cell of the <b>same</b> cluster: the second direction takes <b>F2 onto F18</b>, and so on. Then two cells of one cluster would share frequencies, so the triangle cannot tile the plane as a cluster.' },
      { title: 'The test for any shape', body: 'Shift the whole cluster by the (i, j) move. If it lands exactly on empty cells with no overlap and no gaps, in all six directions, the shape is a valid cluster.' },
      { title: 'Reuse numbers', body: 'Q = √84 = <b>9.17</b>; reuse factor = <b>1/28 ≈ 0.0357</b>. A larger cluster means more distance between co-channel cells but fewer channels in each cell.' },
    ],
    takeaway: 'Shape is free; the shift is not. A cluster is valid when the same i-then-j shift works for every one of its cells.',
  },
  {
    id: '1c', part: '1 (c)', topic: 'Alternative cluster', title: 'Another 19-cell cluster: does D change?',
    task: 'Draw an alternative 19-cell cluster and compare its reuse distance with the cluster in (a).',
    given: ['N = 19', 'Part (a): i = 3, j = 2', 'Take R = 1 km for the numbers'],
    explorer: { i: 2, j: 3, compare: [3, 2], caption: 'Swap between (3, 2) and (2, 3): the pattern is mirrored, the distance is not.' },
    concept: {
      prompt: 'If you use i = 2, j = 3 instead of i = 3, j = 2, what happens to the reuse distance?',
      choices: [
        { id: 'bigger', label: 'It becomes larger' },
        { id: 'same', label: 'It stays the same: D depends only on N' },
        { id: 'smaller', label: 'It becomes smaller' },
      ],
      answer: 'same',
      retry: 'Try again: compute N for both shifts, then look at D = R√(3N).',
    },
    practice: [
      { label: 'N for i = 2, j = 3', answer: clusterSize(2, 3), unit: 'cells', tolerance: 0, hint: '2² + 2·3 + 3².' },
      { label: 'Reuse distance D (R = 1 km)', answer: reuseRatio(19), unit: 'km', tolerance: .005, hint: 'D = R√(3N) with N = 19.' },
    ],
    steps: [
      { title: 'Swap the shift parameters', body: 'With <b>i = 2, j = 3</b>: N = 2² + 2·3 + 3² = 4 + 6 + 9 = <b>19</b>. It is still a 19-cell cluster.' },
      { title: 'What the drawing looks like', body: 'Moving 2 cells, turning 60° and moving 3 cells is the mirror image of the 3-then-2 move. The alternative cluster turns out to be <b>the same cluster seen from a different angle</b>.' },
      { title: 'Compare the reuse distance', body: 'D = R√(3N) depends only on N. Both clusters have N = 19, so D = √57 R = <b>7.55 R</b> (7.55 km for R = 1 km), the <b>same</b> reuse distance as part (a).' },
    ],
    takeaway: '(i, j) and (j, i) give mirror-image patterns with the same N, so the same reuse distance.',
  },
  {
    id: '2', part: '2', topic: 'Proof', title: 'Prove that N = i² + ij + j²',
    task: 'Using the hexagon geometry and the reuse distance D = R√(3N), show that the number of cells per cluster is N = i² + ij + j².',
    given: ['R = radius (centre to corner)', 'R′ = apothem (centre to edge)', 'i, j = cells moved in each direction', 'D = R√(3N)'],
    explorer: { i: 1, j: 2, triangle: true, caption: 'C1 → C2 is i steps, C2 → C1 is j steps, and the angle at C2 is 120°. D closes the triangle.' },
    concept: {
      prompt: 'In the triangle C1 → C2 → C1 (the sheet’s figure), what is the angle between the i-side and the j-side at C2?',
      choices: [{ id: '60', label: '60°' }, { id: '90', label: '90°' }, { id: '120', label: '120°' }],
      answer: '120',
      retry: 'Try again: you turn 60° at C2, so the inside angle of the triangle is 180° − 60°.',
    },
    practice: [
      { label: 'Neighbour spacing 2R′ for R = 1 km', answer: Math.sqrt(3), unit: 'km', tolerance: .005, hint: 'R′ = R cos 30° = (√3/2)R, so 2R′ = √3 R.' },
      { label: 'cos 120°', answer: -.5, unit: 'value', tolerance: .001, hint: 'cos 120° = −cos 60°.' },
      { label: 'D² / (2R′)² for i = 3, j = 2', answer: clusterSize(3, 2), unit: 'ratio', tolerance: 0, hint: 'D² = (2R′)²(i² + j² + ij).' },
    ],
    steps: [
      { title: 'Set up the triangle', body: 'Neighbouring cell centres are <b>2R′</b> apart. Going from C1 to C2 is i cells, <b>i(2R′)</b>; going on to the co-channel C1 is j cells, <b>j(2R′)</b>. The angle between these two sides is <b>120°</b>, and the third side is the reuse distance <b>D</b>.' },
      { title: 'Apply the cosine law', body: 'D² = (i(2R′))² + (j(2R′))² − 2·i(2R′)·j(2R′)·cos 120°.' },
      { title: 'Take the common factor', body: 'cos 120° = −½, so the last term becomes +ij(2R′)². Then D² = (i² + j²)(2R′)² + ij(2R′)² = <b>(2R′)²(i² + j² + ij)</b>.' },
      { title: 'Use D = R√(3N)', body: 'Squaring gives D² = 3N · R². Therefore <b>3N · R² = (2R′)²(i² + j² + ij)</b>.' },
      { title: 'Use the hexagon geometry', body: 'R′ = R cos 30° = (√3/2)R, so 2R′ = √3 R and <b>(2R′)² = 3R²</b>.' },
      { title: 'Conclude', body: 'N · 3 · R² = 3 · R²(i² + j² + ij). Divide both sides by 3R²: <b>N = i² + j² + ij</b> ∎' },
    ],
    takeaway: 'Two cell-steps and a 120° angle: the cosine law turns the shift (i, j) into D, and D = R√(3N) turns D into N.',
  },
  {
    id: '3', part: '3', topic: 'Sectoring', title: 'Cell sectoring: what, why, and the cost',
    task: 'Explain cell sectoring and give its advantages and disadvantages.',
    sectors: true,
    sort: [
      { label: 'Reduces co-channel interference', side: 'advantage' },
      { label: 'Increases capacity', side: 'advantage' },
      { label: 'Allows a smaller cluster size', side: 'advantage' },
      { label: 'More freedom in assigning channels', side: 'advantage' },
      { label: 'More antennas at each base station', side: 'disadvantage' },
      { label: 'Loss in traffic (channels split between sectors)', side: 'disadvantage' },
    ],
    steps: [
      { title: 'What sectoring is', body: 'To overcome limits such as <b>co-channel interference</b>, the <b>omnidirectional</b> antenna at the base station (BS) is replaced by <b>several directional antennas</b>, each covering one sector of the cell.' },
      { title: 'Common layouts', body: '<b>360°</b>: one omni antenna, one cell. <b>120°</b>: three sectors, three antennas. <b>60°</b>: six sectors, six antennas. Each sector uses its own share of the cell’s channels.' },
      { title: 'Advantages', body: '<b>Reduces interference</b>, which <b>increases capacity</b>. It <b>enables a smaller cluster size</b> and gives <b>additional freedom in assigning channels</b>.' },
      { title: 'Disadvantages', body: '<b>More antennas</b> at each BS, and a <b>loss in traffic</b>: the channels are split between sectors, so each sector carries less traffic than the whole cell could with all channels pooled.' },
    ],
    takeaway: 'Sectoring trades extra antennas and some trunking efficiency for less interference, so a smaller cluster and more capacity.',
  },
];
