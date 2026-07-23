import type { Point, Polygon } from './types.js'
import { boundingBox, pointInPolygon, signedArea } from './geometry.js'

// The "safe region" for radius r is the set of points inside the polygon at
// distance >= r from its boundary — the valid centers for a circle of radius
// r that must lie fully inside. Membership testing is exact (min point-to-
// segment distance over all edges); only projection *into* the region is
// iterative, and callers backstop it with an exact final verification.

export const distanceToSegment = (p: Point, a: Point, b: Point): number => {
  const [px, py] = p
  const [ax, ay] = a
  const abx = b[0] - ax
  const aby = b[1] - ay
  const lenSq = abx * abx + aby * aby
  const t = lenSq === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * abx + (py - ay) * aby) / lenSq))
  return Math.hypot(px - (ax + t * abx), py - (ay + t * aby))
}

type BoundaryHit = {
  readonly point: Point
  readonly dist: number
  readonly edge: number
}

const nearestOnSegment = (p: Point, a: Point, b: Point): Point => {
  const [ax, ay] = a
  const abx = b[0] - ax
  const aby = b[1] - ay
  const lenSq = abx * abx + aby * aby
  const t = lenSq === 0 ? 0 : Math.min(1, Math.max(0, ((p[0] - ax) * abx + (p[1] - ay) * aby) / lenSq))
  return [ax + t * abx, ay + t * aby]
}

// Nearest point on the polygon's boundary. Ties break to the lowest edge
// index so results are deterministic.
export const nearestBoundaryPoint =
  (polygon: Polygon) =>
  (p: Point): BoundaryHit => {
    const n = polygon.length
    let best: BoundaryHit = { point: polygon[0] ?? [0, 0], dist: Infinity, edge: 0 }
    for (let i = 0; i < n; i++) {
      const a = polygon[i]!
      const b = polygon[(i + 1) % n]!
      const q = nearestOnSegment(p, a, b)
      const d = Math.hypot(p[0] - q[0], p[1] - q[1])
      if (d < best.dist) best = { point: q, dist: d, edge: i }
    }
    return best
  }

export const distanceToBoundary = (polygon: Polygon): ((p: Point) => number) => {
  const nearest = nearestBoundaryPoint(polygon)
  return (p) => nearest(p).dist
}

const MAX_CLAMP_ITERS = 24
// Expanding step ladder for the line search: in a wedge of half-angle θ the
// distance-to-boundary grows only at rate sin(θ) along the bisector, so the
// needed step can be far larger than the deficit; 2^8 covers θ down to ~0.2°.
const STEP_LADDER = [1, 2, 4, 8, 16, 32, 64, 128, 256]

// Push a point into the safe region for radius r. Each iterate moves along
// the combined direction away from every wall closer than r — the inward
// normal at a flat wall, the bisector inside a wedge — with an expanding
// line search on the step size (see STEP_LADDER). Stops when no step
// improves (e.g. necks narrower than 2r, where no local safe point exists)
// and returns the best iterate seen — callers verify the result rather than
// trusting it.
export const clampToSafeRegion = (polygon: Polygon, r: number): ((p: Point) => Point) => {
  const n = polygon.length
  const nearest = nearestBoundaryPoint(polygon)
  const inside = pointInPolygon(polygon)
  const orientation = signedArea(polygon) >= 0 ? 1 : -1
  const [[minX, minY], [maxX, maxY]] = boundingBox(polygon)
  const scale = Math.max(maxX - minX, maxY - minY, 1)
  const delta = 1e-12 * scale
  // Overshoot slightly so the constraint holds strictly under float error.
  const target = r * (1 + 1e-9)

  const inwardNormal = (edge: number): Point => {
    const a = polygon[edge]!
    const b = polygon[(edge + 1) % n]!
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len = Math.hypot(dx, dy)
    if (len < delta) return [0, 0]
    // CCW polygons keep the interior on the edge's left.
    return [(-dy / len) * orientation, (dx / len) * orientation]
  }

  // Combined escape direction: sum of unit vectors away from each wall
  // closer than r. Opposing near walls cancel to ~zero — correctly
  // signalling that no direction helps.
  const escapeDirection = (p: Point): Point => {
    let sx = 0
    let sy = 0
    for (let i = 0; i < n; i++) {
      const q = nearestOnSegment(p, polygon[i]!, polygon[(i + 1) % n]!)
      const d = Math.hypot(p[0] - q[0], p[1] - q[1])
      if (d >= r) continue
      if (d > delta) {
        sx += (p[0] - q[0]) / d
        sy += (p[1] - q[1]) / d
      } else {
        const [nx, ny] = inwardNormal(i)
        sx += nx
        sy += ny
      }
    }
    const len = Math.hypot(sx, sy)
    return len < 0.1 ? [0, 0] : [sx / len, sy / len]
  }

  return (p) => {
    let cur = p
    let curHit = nearest(cur)
    if (curHit.dist >= r && inside(cur)) return cur
    let best = cur
    let bestDist = inside(cur) ? curHit.dist : -Infinity
    for (let iter = 0; iter < MAX_CLAMP_ITERS; iter++) {
      if (!inside(cur)) {
        // Project just inside via the nearest feature, then continue.
        const { point: q, dist, edge } = curHit
        const [ux, uy] =
          dist > delta
            ? [(q[0] - cur[0]) / dist, (q[1] - cur[1]) / dist]
            : inwardNormal(edge)
        if (ux === 0 && uy === 0) break
        const entered: Point = [q[0] + target * ux, q[1] + target * uy]
        if (!inside(entered)) break
        cur = entered
        curHit = nearest(cur)
      } else {
        const [ux, uy] = escapeDirection(cur)
        if (ux === 0 && uy === 0) break
        const deficit = target - curHit.dist
        let stepped: Point | null = null
        let steppedDist = curHit.dist
        for (const mult of STEP_LADDER) {
          const t = deficit * mult
          const cand: Point = [cur[0] + t * ux, cur[1] + t * uy]
          if (!inside(cand)) continue
          const d = nearest(cand).dist
          if (d > steppedDist) {
            stepped = cand
            steppedDist = d
          }
        }
        if (stepped === null) break
        cur = stepped
        curHit = nearest(cur)
      }
      if (inside(cur) && curHit.dist > bestDist) {
        best = cur
        bestDist = curHit.dist
      }
      if (inside(cur) && curHit.dist >= r) return cur
    }
    return best
  }
}
