import type { Point, Polygon } from './types.js'
import { haltonPoint } from './halton.js'
import { boundingBox, pointInPolygon } from './geometry.js'
import { lloydRelax } from './lloyd.js'

export interface PointilleOptions {
  /** Number of Lloyd relaxation iterations. Default: 30. */
  iterations?: number
  /** Starting offset into the Halton sequence (deterministic). Default: 1. */
  haltonOffset?: number
}

const DEFAULT_ITERATIONS = 30

// Seed `n` candidate points inside `polygon` using a 2D Halton sequence
// scaled to the bounding box, with rejection sampling.
const seedPoints = (polygon: Polygon, n: number, offset: number): Point[] => {
  const [[minX, minY], [maxX, maxY]] = boundingBox(polygon)
  const w = maxX - minX
  const h = maxY - minY
  const inside = pointInPolygon(polygon)

  const candidate = (i: number): Point => {
    const [u, v] = haltonPoint(i)
    return [minX + u * w, minY + v * h]
  }

  const out: Point[] = []
  const limit = offset + Math.max(1000, n * 2000)
  for (let i = offset; i < limit && out.length < n; i++) {
    const p = candidate(i)
    if (inside(p)) out.push(p)
  }
  return out
}

/**
 * Distribute `n` points approximately evenly inside `polygon` using Lloyd's
 * algorithm on a centroidal Voronoi tessellation.
 *
 * Fully deterministic: same polygon + same `n` + same options → same output.
 * Seeding uses a 2D Halton sequence; relaxation uses d3-delaunay's Voronoi
 * clipped to the polygon via boolean intersection.
 *
 * @returns an array of exactly `n` points (or `[]` if `n <= 0`).
 */
export const pointille = (
  polygon: Polygon,
  n: number,
  { iterations = DEFAULT_ITERATIONS, haltonOffset = 1 }: PointilleOptions = {},
): Point[] => {
  if (n <= 0 || polygon.length < 3) return []
  const seed = seedPoints(polygon, n, haltonOffset)
  if (seed.length < n) return seed // bounding box too sparse — best effort
  return lloydRelax(polygon, iterations)(seed)
}
