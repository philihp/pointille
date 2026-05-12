import * as R from 'ramda'
import type { Point, Polygon } from './types.js'

const xOf = (p: Point): number => p[0]
const yOf = (p: Point): number => p[1]

// Single-reduce bounding box: one pass, no intermediate arrays.
type BBox = readonly [Point, Point]
const initBBox: BBox = [
  [Infinity, Infinity],
  [-Infinity, -Infinity],
]
const expandBBox = ([[lx, ly], [hx, hy]]: BBox, [x, y]: Point): BBox => [
  [Math.min(lx, x), Math.min(ly, y)],
  [Math.max(hx, x), Math.max(hy, y)],
]
export const boundingBox = (polygon: Polygon): BBox => R.reduce(expandBBox, initBBox, polygon)

// Ray-cast point-in-polygon. Manually curried so call sites that pre-bind the
// polygon (`const inside = pointInPolygon(poly)`) are cheap and well-typed.
export const pointInPolygon =
  (polygon: Polygon) =>
  ([x, y]: Point): boolean => {
    const n = polygon.length
    let inside = false
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [xi, yi] = polygon[i]!
      const [xj, yj] = polygon[j]!
      const crosses = yi > y !== yj > y
      if (!crosses) continue
      const xIntersect = ((xj - xi) * (y - yi)) / (yj - yi) + xi
      if (x < xIntersect) inside = !inside
    }
    return inside
  }

// Signed polygon area (shoelace). Positive for counter-clockwise rings.
export const signedArea = (polygon: Polygon): number => {
  const n = polygon.length
  if (n < 3) return 0
  let a = 0
  for (let i = 0; i < n; i++) {
    const [x0, y0] = polygon[i]!
    const [x1, y1] = polygon[(i + 1) % n]!
    a += x0 * y1 - x1 * y0
  }
  return a * 0.5
}

// Polygon centroid (area-weighted). Falls back to the vertex mean for
// degenerate (zero-area) inputs so we never return NaN.
export const polygonCentroid = (polygon: Polygon): Point => {
  const n = polygon.length
  if (n === 0) return [0, 0]
  if (n === 1) return polygon[0]!
  let a2 = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < n; i++) {
    const [x0, y0] = polygon[i]!
    const [x1, y1] = polygon[(i + 1) % n]!
    const cross = x0 * y1 - x1 * y0
    a2 += cross
    cx += (x0 + x1) * cross
    cy += (y0 + y1) * cross
  }
  if (Math.abs(a2) < 1e-12) {
    const sx = R.sum(R.map(xOf, polygon)) / n
    const sy = R.sum(R.map(yOf, polygon)) / n
    return [sx, sy]
  }
  const factor = 1 / (3 * a2)
  return [cx * factor, cy * factor]
}
