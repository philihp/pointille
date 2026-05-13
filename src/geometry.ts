import type { Point, Polygon } from './types.js'

// Axis-aligned bounding box as [min, max] corners.
export const boundingBox = (polygon: Polygon): readonly [Point, Point] => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of polygon) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return [
    [minX, minY],
    [maxX, maxY],
  ]
}

// Ray-cast point-in-polygon (crossing-number test). Manually curried so call
// sites can pre-bind the polygon and pipe candidate points through.
const pointInPolygonImpl = (polygon: Polygon, p: Point): boolean => {
  const [x, y] = p
  const n = polygon.length
  let inside = false
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i]!
    const [xj, yj] = polygon[j]!
    if (yi > y === yj > y) continue
    const xIntersect = ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (x < xIntersect) inside = !inside
  }
  return inside
}

export function pointInPolygon(polygon: Polygon): (p: Point) => boolean
export function pointInPolygon(polygon: Polygon, p: Point): boolean
export function pointInPolygon(
  polygon: Polygon,
  p?: Point,
): boolean | ((p: Point) => boolean) {
  if (p === undefined) return (q: Point) => pointInPolygonImpl(polygon, q)
  return pointInPolygonImpl(polygon, p)
}

// Shoelace formula. Positive for counter-clockwise rings, negative for clockwise.
export const signedArea = (polygon: Polygon): number => {
  const n = polygon.length
  if (n < 3) return 0
  let sum = 0
  for (let i = 0; i < n; i++) {
    const [x0, y0] = polygon[i]!
    const [x1, y1] = polygon[(i + 1) % n]!
    sum += x0 * y1 - x1 * y0
  }
  return sum / 2
}

// Area-weighted centroid. Falls back to the vertex mean for degenerate
// (zero-area) rings so we never return NaN.
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
    let sx = 0
    let sy = 0
    for (const [x, y] of polygon) {
      sx += x
      sy += y
    }
    return [sx / n, sy / n]
  }

  const k = 1 / (3 * a2)
  return [cx * k, cy * k]
}
