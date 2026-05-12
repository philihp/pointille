import * as R from 'ramda'
import type { Point, Polygon } from './types.js'

const xOf = (p: Point): number => p[0]
const yOf = (p: Point): number => p[1]

export const boundingBox = (polygon: Polygon): readonly [Point, Point] => {
  const xs = R.map(xOf, polygon)
  const ys = R.map(yOf, polygon)
  return [
    [Math.min(...xs), Math.min(...ys)],
    [Math.max(...xs), Math.max(...ys)],
  ]
}

// Ray-cast point-in-polygon. Standard crossing-number test.
// Loop is imperative for clarity and speed; the call site stays composable.
export const pointInPolygon = R.curry((polygon: Polygon, p: Point): boolean => {
  const [x, y] = p
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
})

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
