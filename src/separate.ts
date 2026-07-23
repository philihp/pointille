import { Delaunay } from 'd3-delaunay'
import type { Point, Polygon } from './types.js'
import { boundingBox } from './geometry.js'
import { clampToSafeRegion, distanceToBoundary } from './safe-region.js'
import { PointilleFitError } from './errors.js'

export type PackingCheck = {
  readonly ok: boolean
  readonly minPairwise: number
  readonly minBoundary: number
}

// Exact O(n²) check of both packing constraints. This is what makes the
// guarantee hard: the iterative clamp/separation heuristics only ever
// terminate through this.
export const verifyPacking = (
  polygon: Polygon,
  r: number,
  points: ReadonlyArray<Point>,
  epsilon: number,
): PackingCheck => {
  const boundary = distanceToBoundary(polygon)
  let minPairwise = Infinity
  let minBoundary = Infinity
  for (let i = 0; i < points.length; i++) {
    const d = boundary(points[i]!)
    if (d < minBoundary) minBoundary = d
    for (let j = i + 1; j < points.length; j++) {
      const [ax, ay] = points[i]!
      const [bx, by] = points[j]!
      const dd = Math.hypot(ax - bx, ay - by)
      if (dd < minPairwise) minPairwise = dd
    }
  }
  return {
    ok: minPairwise >= 2 * r - epsilon && minBoundary >= r - epsilon,
    minPairwise,
    minBoundary,
  }
}

const BETA = 0.7
const MAX_SEPARATION_STEPS = 256
const GOLDEN_ANGLE = 2.399963229728653

// Deterministic overlap resolution. Each sub-step finds close pairs via the
// Delaunay graph (which always contains every point's nearest neighbour, so
// violating pairs cannot hide from repeated sub-steps), accumulates damped
// symmetric push-apart displacements, applies them all at once (Jacobi —
// order-independent beyond the fixed i < j summation order), and clamps
// moved points back into the safe region.
export const separate = (polygon: Polygon, r: number): ((points: ReadonlyArray<Point>) => Point[]) => {
  const clamp = clampToSafeRegion(polygon, r)
  const [[minX, minY], [maxX, maxY]] = boundingBox(polygon)
  const scale = Math.max(maxX - minX, maxY - minY, 1)
  const epsilon = 1e-9 * scale
  const delta = 1e-12 * scale

  return (points) => {
    let pts: Point[] = points.map(clamp)
    for (let step = 0; step < MAX_SEPARATION_STEPS; step++) {
      const check = verifyPacking(polygon, r, pts, epsilon)
      if (check.ok) return pts
      if (pts.length < 2) break // single point out of reach of the clamp

      const flat = Float64Array.from(pts.flatMap(([x, y]) => [x, y]))
      const delaunay = new Delaunay(flat)
      const dx = new Float64Array(pts.length)
      const dy = new Float64Array(pts.length)
      let pushed = false
      const pushPair = (i: number, j: number): void => {
        const [ax, ay] = pts[i]!
        const [bx, by] = pts[j]!
        const d = Math.hypot(ax - bx, ay - by)
        if (d >= 2 * r) return
        pushed = true
        const push = (BETA * (2 * r - d)) / 2
        let ux: number
        let uy: number
        if (d > delta) {
          ux = (ax - bx) / d
          uy = (ay - by) / d
        } else {
          // Coincident points: deterministic fallback direction.
          ux = Math.cos(i * GOLDEN_ANGLE)
          uy = Math.sin(i * GOLDEN_ANGLE)
        }
        dx[i]! += push * ux
        dy[i]! += push * uy
        dx[j]! -= push * ux
        dy[j]! -= push * uy
      }
      for (let i = 0; i < pts.length; i++) {
        for (const j of delaunay.neighbors(i)) {
          if (j > i) pushPair(i, j)
        }
      }
      // Degenerate triangulations (coincident/collinear points) can report no
      // neighbours even though violations exist; fall back to all pairs.
      if (!pushed) {
        for (let i = 0; i < pts.length; i++) {
          for (let j = i + 1; j < pts.length; j++) pushPair(i, j)
        }
      }
      pts = pts.map((p, i) =>
        dx[i] === 0 && dy[i] === 0 ? p : clamp([p[0] + dx[i]!, p[1] + dy[i]!]),
      )
    }
    const { minPairwise, minBoundary } = verifyPacking(polygon, r, pts, epsilon)
    throw new PointilleFitError(
      `could not arrange ${pts.length} non-overlapping circles of radius ${r} inside the polygon ` +
        `(min center distance ${minPairwise.toFixed(6)} < ${2 * r}, or min boundary distance ` +
        `${minBoundary.toFixed(6)} < ${r}); the packing is too tight — reduce radius or n`,
    )
  }
}
