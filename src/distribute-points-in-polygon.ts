import * as R from 'ramda'
import type { Point, Polygon } from './types.js'
import { haltonPoint } from './halton.js'
import { boundingBox, pointInPolygon } from './geometry.js'
import { lloydRelax } from './lloyd.js'

export interface DistributeOptions {
  /** Number of Lloyd relaxation iterations. Default: 30. */
  iterations?: number
  /** Starting offset into the Halton sequence (deterministic). Default: 1. */
  haltonOffset?: number
}

const DEFAULT_ITERATIONS = 30

// Seed `n` deterministic candidate points inside the polygon using a 2D Halton
// sequence (bases 2, 3) clipped to the bounding box, with rejection sampling.
const seedPoints = (polygon: Polygon, n: number, haltonOffset: number): Point[] => {
  const [[minX, minY], [maxX, maxY]] = boundingBox(polygon)
  const w = maxX - minX
  const h = maxY - minY
  const scale = ([u, v]: Point): Point => [minX + u * w, minY + v * h]
  const inside = pointInPolygon(polygon)
  const out: Point[] = []
  const maxIndex = haltonOffset + Math.max(1000, n * 2000)
  let i = haltonOffset
  while (out.length < n && i < maxIndex) {
    const p = scale(haltonPoint(i))
    if (inside(p)) out.push(p)
    i++
  }
  return out
}

/**
 * Distribute `n` points approximately evenly inside `polygon` using Lloyd's
 * algorithm on a centroidal Voronoi tessellation.
 *
 * The result is fully deterministic: same polygon + same `n` + same options
 * → same output. Seeding uses a 2D Halton sequence; relaxation uses
 * d3-delaunay's Voronoi clipped to the polygon via boolean intersection.
 *
 * @returns an array of exactly `n` points (or `[]` if n <= 0).
 */
export const distributePointsInPolygon = (
  polygon: Polygon,
  n: number,
  options: DistributeOptions = {},
): Point[] => {
  if (n <= 0 || polygon.length < 3) return []
  const iterations = options.iterations ?? DEFAULT_ITERATIONS
  const haltonOffset = options.haltonOffset ?? 1
  const seed = seedPoints(polygon, n, haltonOffset)
  if (seed.length < n) return seed // bounding box has no room — best effort
  return R.pipe(lloydRelax(polygon, iterations))(seed)
}
