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
   * two circles overlap (centers at least `2 * radius` apart). Throws
   * {@link PointilleFitError} when `n` circles of this radius cannot fit.
   * Default: 0 (dimensionless points, identical to omitting the option).
   */
  radius?: number
}

export type { Point, Polygon } from './types.js'
export { PointilleFitError } from './errors.js'

const DEFAULT_ITERATIONS = 30
const DEFAULT_SEED = 1

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
  const accept = (p: Point): boolean => inside(p) && boundary(p) >= radius
  const points = seedPoints(bound, n, seed, accept)
  if (points.length < n) {
    throw new PointilleFitError(
      `found only ${points.length} of ${n} seed centers at distance >= ${radius} from the ` +
        `boundary — the safe region is too small or empty; reduce radius or n`,
    )
  }

  const relaxed = lloydRelax(bound, iterations, clampToSafeRegion(bound, radius))(points)
  return separate(bound, radius)(relaxed)
}

export default pointille
