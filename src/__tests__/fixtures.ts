import type { Point, Polygon } from '../types.js'

export const unitSquare: Polygon = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
]

export const triangle: Polygon = [
  [0, 0],
  [4, 0],
  [2, 3],
]

// L-shaped concave polygon.
export const lShape: Polygon = [
  [0, 0],
  [2, 0],
  [2, 1],
  [1, 1],
  [1, 2],
  [0, 2],
]

// n-gon approximation of the unit circle.
export const circleApprox = (n = 32): Polygon =>
  Array.from({ length: n }, (_, i) => {
    const t = (i / n) * 2 * Math.PI
    return [Math.cos(t), Math.sin(t)] as Point
  })

export const distance = (a: Point, b: Point): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1])

export const minNearestNeighbour = (points: ReadonlyArray<Point>): number => {
  let best = Infinity
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = distance(points[i]!, points[j]!)
      if (d < best) best = d
    }
  }
  return best
}
