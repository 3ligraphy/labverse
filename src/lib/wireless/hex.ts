/**
 * Hexagonal cell grids for the Sheet 2 cluster explorer, in axial coordinates (q, r) on pointy-top hexagons.
 * Direction (1, 0) is east and (0, 1) is south-east, 60° apart, so a vector (a, b) has squared length a² + ab + b²
 * in units of the neighbour spacing 2R′ = √3 R.
 *
 * The shift method "move i cells east, turn 60° counter-clockwise, move j cells" is the vector v₁ = (i + j, −j).
 * Its 60° rotation v₂ = (j, i) completes a lattice of co-channel cells with i² + ij + j² = N cells per lattice cell,
 * so two cells use the same channel set exactly when they differ by a whole combination of v₁ and v₂.
 */
import { clusterSize } from './core.ts';

export type Hex = { q: number; r: number };

export const DIRECTIONS: Hex[] = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 }, { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];
const mod = (a: number, n: number) => ((a % n) + n) % n;
export const add = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });
export const scale = (a: Hex, k: number): Hex => ({ q: a.q * k, r: a.r * k });
/** Rotate 60° (one step around the six directions). */
export const rotate = (a: Hex, steps = 1): Hex => {
  let h = a;
  for (let s = 0; s < mod(steps, 6); s++) h = { q: h.q + h.r, r: -h.q }; // east → north-east → …
  return h;
};
/** Number of hex steps between two cells. */
export const hexDistance = (a: Hex, b: Hex) => {
  const dq = a.q - b.q, dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
};
/** Straight-line distance in units of the neighbour spacing 2R′. */
export const euclid = (a: Hex) => Math.sqrt(a.q * a.q + a.q * a.r + a.r * a.r);
/** Centre of a cell in pixels for a hexagon of radius `size` (pointy-top, y down). */
export const toPixel = (h: Hex, size: number) => ({ x: size * Math.sqrt(3) * (h.q + h.r / 2), y: size * 1.5 * h.r });

/** Every cell within `rings` steps of the origin. */
export function grid(rings: number): Hex[] {
  const out: Hex[] = [];
  for (let q = -rings; q <= rings; q++)
    for (let r = Math.max(-rings, -q - rings); r <= Math.min(rings, -q + rings); r++) out.push({ q, r });
  return out;
}

/** The shift path and the co-channel lattice for (i, j). */
export function shiftVectors(i: number, j: number) {
  const v1 = add(scale(DIRECTIONS[0], i), scale(DIRECTIONS[1], j));
  return { v1, v2: rotate(v1, -1), turn: scale(DIRECTIONS[0], i) };
}

export type Tiling = {
  n: number;
  /** Channel-set number (0 = the centre cell's set) of a cell. */
  label: (h: Hex) => number;
  /** Which copy of the cluster a cell belongs to: equal for cells of one cluster. */
  copy: (h: Hex) => string;
  /** The six nearest co-channel cells of h. */
  firstTier: (h: Hex) => Hex[];
};

/**
 * Splits the plane into clusters of N = i² + ij + j² cells. The cluster around the origin holds, for each channel set,
 * the cell nearest the centre (ties go to the smaller angle), so it is as round as the lattice allows.
 */
export function tiling(i: number, j: number): Tiling {
  const n = clusterSize(i, j);
  const { v1, v2 } = shiftVectors(i, j);
  // Coefficients of h in the basis (v1, v2), times N: whole numbers, and a multiple of N exactly on the lattice.
  const det = v1.q * v2.r - v2.q * v1.r; // = n
  const coef = (h: Hex) => ({ a: h.q * v2.r - h.r * v2.q, b: h.r * v1.q - h.q * v1.r });
  const key = (h: Hex) => { const { a, b } = coef(h); return `${mod(a, det)},${mod(b, det)}`; };
  const angle = (h: Hex) => { const p = toPixel(h, 1); return mod(Math.atan2(p.y, p.x) + 1e-9, 2 * Math.PI); };
  const reps = new Map<string, Hex>();
  const candidates = grid(i + j + 1).sort((x, y) => euclid(x) - euclid(y) || angle(x) - angle(y));
  for (const h of candidates) if (!reps.has(key(h))) reps.set(key(h), h);
  const labels = new Map([...reps.keys()].map((k, index) => [k, index]));
  return {
    n,
    label: (h) => labels.get(key(h)) ?? 0,
    copy: (h) => {
      const rep = reps.get(key(h))!;
      const { a, b } = coef({ q: h.q - rep.q, r: h.r - rep.r });
      return `${a / det},${b / det}`;
    },
    firstTier: (h) => Array.from({ length: 6 }, (_, k) => add(h, rotate(v1, k))),
  };
}
