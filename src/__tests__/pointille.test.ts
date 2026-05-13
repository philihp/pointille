import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { pointille } from '../pointille.js'
import { pointInPolygon } from '../geometry.js'
import type { Point, Polygon } from '../types.js'

const unitSquare: Polygon = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
]

const triangle: Polygon = [
  [0, 0],
  [4, 0],
  [2, 3],
]

// L-shaped concave polygon.
const lShape: Polygon = [
  [0, 0],
  [2, 0],
  [2, 1],
  [1, 1],
  [1, 2],
  [0, 2],
]

// 32-gon approximation of the unit circle.
const circleApprox = (n = 32): Polygon =>
  Array.from({ length: n }, (_, i) => {
    const t = (i / n) * 2 * Math.PI
    return [Math.cos(t), Math.sin(t)] as Point
  })

const distance = (a: Point, b: Point): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1])

const minNearestNeighbour = (points: ReadonlyArray<Point>): number => {
  let best = Infinity
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = distance(points[i]!, points[j]!)
      if (d < best) best = d
    }
  }
  return best
}

const meanNearestNeighbour = (points: ReadonlyArray<Point>): number => {
  if (points.length < 2) return 0
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    let best = Infinity
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue
      const d = distance(points[i]!, points[j]!)
      if (d < best) best = d
    }
    sum += best
  }
  return sum / points.length
}

describe('pointille — counts and edges', () => {
  it('returns [] for n = 0', () => {
    assert.deepEqual(pointille(unitSquare, 0), [])
  })
  it('returns [] for negative n', () => {
    assert.deepEqual(pointille(unitSquare, -3), [])
  })
  it('returns [] for a degenerate polygon (< 3 vertices)', () => {
    assert.deepEqual(
      pointille(
        [
          [0, 0],
          [1, 1],
        ],
        5,
      ),
      [],
    )
  })
  it('returns exactly n points for n = 1', () => {
    const out = pointille(unitSquare, 1)
    assert.equal(out.length, 1)
  })
  it('returns exactly n points for n = 25 in a square', () => {
    assert.equal(pointille(unitSquare, 25).length, 25)
  })
  it('returns exactly n points for n = 30 in a triangle', () => {
    assert.equal(pointille(triangle, 30).length, 30)
  })
  it('returns exactly n points for n = 20 in a concave L-shape', () => {
    assert.equal(pointille(lShape, 20).length, 20)
  })
})

describe('pointille — containment', () => {
  it('all points lie inside the unit square (n=25)', () => {
    const pts = pointille(unitSquare, 25)
    for (const p of pts)
      assert.ok(pointInPolygon(unitSquare, p), `outside: ${p.join(',')}`)
  })

  it('all points lie inside the triangle (n=30)', () => {
    const pts = pointille(triangle, 30)
    for (const p of pts)
      assert.ok(pointInPolygon(triangle, p), `outside: ${p.join(',')}`)
  })

  it('all points lie inside the concave L-shape (n=20)', () => {
    const pts = pointille(lShape, 20)
    for (const p of pts)
      assert.ok(pointInPolygon(lShape, p), `outside: ${p.join(',')}`)
  })

  it('all points lie inside a circle-approximation (n=40)', () => {
    const circle = circleApprox(64)
    const pts = pointille(circle, 40)
    for (const p of pts)
      assert.ok(pointInPolygon(circle, p), `outside: ${p.join(',')}`)
  })
})

describe('pointille — determinism', () => {
  it('same inputs → same outputs (square)', () => {
    const a = pointille(unitSquare, 25)
    const b = pointille(unitSquare, 25)
    assert.deepEqual(a, b)
  })
  it('same inputs → same outputs (concave)', () => {
    const a = pointille(lShape, 15)
    const b = pointille(lShape, 15)
    assert.deepEqual(a, b)
  })
  it('different haltonOffset gives a different layout', () => {
    const a = pointille(unitSquare, 10, { haltonOffset: 1 })
    const b = pointille(unitSquare, 10, { haltonOffset: 100 })
    assert.notDeepEqual(a, b)
  })
})

describe('pointille — distribution quality', () => {
  it('square: nearest-neighbour spacing is non-trivial after relaxation', () => {
    const n = 25
    const pts = pointille(unitSquare, n)
    // For a uniform packing of 25 points in a unit square the ideal grid
    // spacing is 1/sqrt(25) = 0.2. We require min NN >= 0.6 * ideal — i.e.
    // no two points have collapsed onto one another.
    const ideal = 1 / Math.sqrt(n)
    const minNN = minNearestNeighbour(pts)
    assert.ok(
      minNN > 0.6 * ideal,
      `minNN=${minNN.toFixed(4)} ideal=${ideal.toFixed(4)}`,
    )
  })

  it('square: min NN distance is close to mean NN distance (uniformity)', () => {
    const pts = pointille(unitSquare, 36)
    const minNN = minNearestNeighbour(pts)
    const meanNN = meanNearestNeighbour(pts)
    // Min should be at least 60% of mean — i.e. not heavily clustered.
    assert.ok(
      minNN / meanNN > 0.6,
      `minNN/meanNN=${(minNN / meanNN).toFixed(3)}`,
    )
  })

  it('circle: minimum spacing is reasonable', () => {
    const circle = circleApprox(64)
    const n = 30
    const pts = pointille(circle, n)
    // Approximate "ideal" spacing for n points in a disc of area π is
    // sqrt(π/n). Require min NN >= 0.45 * ideal.
    const ideal = Math.sqrt(Math.PI / n)
    const minNN = minNearestNeighbour(pts)
    assert.ok(
      minNN > 0.45 * ideal,
      `minNN=${minNN.toFixed(4)} ideal=${ideal.toFixed(4)}`,
    )
  })
})
