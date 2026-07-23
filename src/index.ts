import type { Point, Polygon } from './types.js'
import { boundingBox, pointInPolygon, signedArea } from './geometry.js'
import { haltonPoint } from './halton.js'
import { lloydRelax } from './lloyd.js'
import { clampToSafeRegion, distanceToBoundary } from './safe-region.js'
import { separate } from './separate.js'
import { PointilleFitError } from './errors.js'

export type PointilleOptions = {
  /** Number of Lloyd relaxation iterations. Default: 30. */
  iterations?: number
  /** Starting offset into the Halton sequence (deterministic). Default: 1. */
  seed?: number
  /**
   * Radius of a circle centered on each returned point. When > 0, the result
   * is guaranteed to satisfy two hard constraints: every circle lies fully
   * inside the polygon (center at least `radius` from the boundary) and no
   * two circles overlap (centers at least `2 * radius` apart). Placement is
   * balanced: the layout maximizes an equal breathing gap, so the space
   * between circles matches the space between each circle and the polygon
   * edge instead of circles hugging the boundary. Throws
   * {@link PointilleFitError} when `n` circles of this radius cannot fit.
   * Default: 0 (dimensionless points, identical to omitting the option).
   */
  radius?: number
}

export type { Point, Polygon } from './types.js'
export { PointilleFitError } from './errors.js'

const DEFAULT_ITERATIONS = 30
const DEFAULT_SEED = 1
const BISECTION_STEPS = 18

// Deterministic candidate-point scan: scale 2D Halton samples into the
// polygon's bounding box and collect those that pass the acceptance test.
// The candidate budget bounds the scan even when `accept` can never pass
// (e.g. an empty safe region), so seeding always terminates.
const seedPoints = (
  polygon: Polygon,
  n: number,
  seed: number,
  accept: (p: Point) => boolean,
): Point[] => {
  const [[minX, minY], [maxX, maxY]] = boundingBox(polygon)
  const w = maxX - minX
  const h = maxY - minY
  const maxCandidates = Math.max(1000, n * 2000)
  const out: Point[] = []
  for (let k = 0; k < maxCandidates && out.length < n; k++) {
    const [u, v] = haltonPoint(seed + k)
    const p: Point = [minX + u * w, minY + v * h]
    if (accept(p)) out.push(p)
  }
  return out
}

/**
 * Distribute `n` points approximately evenly inside `bound` using Lloyd's
 * algorithm on a centroidal Voronoi tessellation.
 *
 * Fully deterministic: same `bound` + same `n` + same options → same output.
 * Seeding uses a 2D Halton sequence (bases 2, 3); relaxation uses
 * d3-delaunay's Voronoi clipped to the polygon via boolean intersection.
 *
 * With `options.radius > 0` the points are treated as circle centers: every
 * circle is guaranteed to lie fully inside the polygon and no two circles
 * overlap (still deterministically). When the circles provably or practically
 * cannot fit, a {@link PointilleFitError} is thrown with guidance to reduce
 * `radius` or `n`.
 *
 * @returns an array of exactly `n` points (or `[]` for `n <= 0` / degenerate `bound`).
 */
export const pointille = (bound: Polygon, n: number, options: PointilleOptions = {}): Point[] => {
  if (n <= 0 || bound.length < 3) return []
  const iterations = options.iterations ?? DEFAULT_ITERATIONS
  const seed = options.seed ?? DEFAULT_SEED
  const radius = options.radius ?? 0
  if (!Number.isFinite(radius) || radius < 0) {
    throw new RangeError(`radius must be a finite number >= 0, got ${radius}`)
  }

  if (radius === 0) {
    const points = seedPoints(bound, n, seed, pointInPolygon(bound))
    if (points.length < n) return points // bounding box has no room — best effort
    return lloydRelax(bound, iterations)(points)
  }

  // Circles of area n·πr² cannot exceed the polygon's area. (Practical
  // packings top out well below this — roughly 55–65% area coverage.)
  const area = Math.abs(signedArea(bound))
  if (n * Math.PI * radius * radius > area) {
    throw new PointilleFitError(
      `${n} circles of radius ${radius} have total area ${(n * Math.PI * radius * radius).toFixed(6)}, ` +
        `which exceeds the polygon's area ${area.toFixed(6)} — reduce radius or n`,
    )
  }

  const inside = pointInPolygon(bound)
  const boundary = distanceToBoundary(bound)

  // Solve the packing for an effective radius R: centers pairwise >= 2R and
  // >= 2R - r from the boundary. At R = r these are exactly the base
  // guarantees; larger R adds equal breathing room between circles and
  // against the wall (surface gap g = 2(R - r) in both cases), which is what
  // makes the layout look balanced. Returns null when infeasible.
  const solve = (R: number, lloydIterations: number): Point[] | null => {
    const wallInset = 2 * R - radius
    const accept = (p: Point): boolean => inside(p) && boundary(p) >= wallInset
    const seeds = seedPoints(bound, n, seed, accept)
    if (seeds.length < n) return null
    const relaxed = lloydRelax(bound, lloydIterations, clampToSafeRegion(bound, wallInset))(seeds)
    try {
      return separate(bound, { wallInset, pairDistance: 2 * R })(relaxed)
    } catch (e) {
      if (e instanceof PointilleFitError) return null
      throw e
    }
  }

  // Baseline at R = r — the hard minimum. Diagnose its failure modes with
  // descriptive errors before searching for a more spacious layout.
  const baseline = solve(radius, iterations)
  if (baseline === null) {
    const accept = (p: Point): boolean => inside(p) && boundary(p) >= radius
    const seeds = seedPoints(bound, n, seed, accept)
    if (seeds.length < n) {
      throw new PointilleFitError(
        `found only ${seeds.length} of ${n} seed centers at distance >= ${radius} from the ` +
          `boundary — the safe region is too small or empty; reduce radius or n`,
      )
    }
    throw new PointilleFitError(
      `could not arrange ${n} non-overlapping circles of radius ${radius} inside the polygon; ` +
        `the packing is too tight — reduce radius or n`,
    )
  }

  // Bisect for the largest feasible effective radius. Upper bound from the
  // area (n·πR² <= area) and from the deepest point observed in a
  // deterministic candidate scan (the wall constraint 2R - r <= dmax).
  let dmax = 0
  const dmaxBudget = Math.max(1000, n * 2000)
  const [[minX, minY], [maxX, maxY]] = boundingBox(bound)
  for (let k = 0; k < dmaxBudget; k++) {
    const [u, v] = haltonPoint(seed + k)
    const p: Point = [minX + u * (maxX - minX), minY + v * (maxY - minY)]
    if (inside(p)) {
      const d = boundary(p)
      if (d > dmax) dmax = d
    }
  }
  const hi = Math.max(radius, Math.min(Math.sqrt(area / (n * Math.PI)), (dmax + radius) / 2))

  const probeIterations = Math.min(iterations, 10)
  let lo = radius
  let hiBound = hi
  let bestR = radius
  let best: Point[] = baseline
  for (let step = 0; step < BISECTION_STEPS; step++) {
    const mid = (lo + hiBound) / 2
    const attempt = solve(mid, probeIterations)
    if (attempt !== null) {
      lo = mid
      bestR = mid
      best = attempt
    } else {
      hiBound = mid
    }
  }

  // Final polish: re-solve at the best R with the full iteration budget for
  // the smoothest layout; the probe result is a verified fallback.
  if (bestR > radius) {
    const polished = solve(bestR, iterations)
    if (polished !== null) return polished
  }
  return best
}

export default pointille
