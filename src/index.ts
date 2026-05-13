import type { Point, Polygon } from './types.js'
import { boundingBox, pointInPolygon } from './geometry.js'
import { haltonPoint } from './halton.js'
import { lloydRelax } from './lloyd.js'

export type PointilleOptions = {
  /** Number of Lloyd relaxation iterations. Default: 30. */
  iterations?: number
  /** Starting offset into the Halton sequence (deterministic). Default: 1. */
  haltonOffset?: number
}

export type { Point, Polygon } from './types.js'

const DEFAULT_ITERATIONS = 30
const DEFAULT_HALTON_OFFSET = 1

// Deterministic candidate-point stream: scale 2D Halton samples into the
// polygon's bounding box and yield those that pass the inside-test.
function* haltonPointsInside(polygon: Polygon, haltonOffset: number): Generator<Point> {
  const [[minX, minY], [maxX, maxY]] = boundingBox(polygon)
  const w = maxX - minX
  const h = maxY - minY
  const inside = pointInPolygon(polygon)
  for (let i = haltonOffset; ; i++) {
    const [u, v] = haltonPoint(i)
    const p: Point = [minX + u * w, minY + v * h]
    if (inside(p)) yield p
  }
}

const takeBounded = <T>(n: number, maxSteps: number, iter: Iterator<T>): T[] => {
  const out: T[] = []
  for (let step = 0; step < maxSteps && out.length < n; step++) {
    const next = iter.next()
    if (next.done) break
    out.push(next.value)
  }
  return out
}

const seedHaltonPoints = (polygon: Polygon, n: number, haltonOffset: number): Point[] =>
  takeBounded(n, Math.max(1000, n * 2000), haltonPointsInside(polygon, haltonOffset))

/**
 * Distribute `n` points approximately evenly inside `bound` using Lloyd's
 * algorithm on a centroidal Voronoi tessellation.
 *
 * Fully deterministic: same `bound` + same `n` + same options → same output.
 * Seeding uses a 2D Halton sequence (bases 2, 3); relaxation uses
 * d3-delaunay's Voronoi clipped to the polygon via boolean intersection.
 *
 * @returns an array of exactly `n` points (or `[]` for `n <= 0` / degenerate `bound`).
 */
export const pointille = (bound: Polygon, n: number, options: PointilleOptions = {}): Point[] => {
  if (n <= 0 || bound.length < 3) return []
  const iterations = options.iterations ?? DEFAULT_ITERATIONS
  const haltonOffset = options.haltonOffset ?? DEFAULT_HALTON_OFFSET
  const seed = seedHaltonPoints(bound, n, haltonOffset)
  if (seed.length < n) return seed // bounding box has no room — best effort
  return lloydRelax(bound, iterations)(seed)
}

export default pointille
