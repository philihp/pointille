import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { pointille, PointilleFitError } from '../index.js'
import { distanceToBoundary } from '../safe-region.js'
import { separate, verifyPacking } from '../separate.js'
import type { Polygon } from '../types.js'
import { circleApprox, lShape, minNearestNeighbour, triangle, unitSquare } from './fixtures.js'

const EPS_FRACTION = 1e-6 // asserted slack, scale-relative

const assertPacking = (polygon: Polygon, n: number, r: number, scale: number) => {
  const pts = pointille(polygon, n, { radius: r })
  const eps = EPS_FRACTION * scale
  assert.equal(pts.length, n)
  const boundary = distanceToBoundary(polygon)
  for (const p of pts) {
    assert.ok(boundary(p) >= r - eps, `boundary distance ${boundary(p)} < ${r} at ${p.join(',')}`)
  }
  if (n > 1) {
    const minNN = minNearestNeighbour(pts)
    assert.ok(minNN >= 2 * r - eps, `min center distance ${minNN} < ${2 * r}`)
  }
  return pts
}

describe('pointille with radius — containment and no overlap', () => {
  it('unit square, n=9, r=0.1', () => {
    assertPacking(unitSquare, 9, 0.1, 1)
  })
  it('triangle, n=10, r=0.15', () => {
    assertPacking(triangle, 10, 0.15, 4)
  })
  it('circle approximation, n=20, r=0.08', () => {
    assertPacking(circleApprox(64), 20, 0.08, 2)
  })
  it('concave L-shape, n=6, r=0.15', () => {
    assertPacking(lShape, 6, 0.15, 2)
  })
  it('tight but feasible: unit square, n=9, r=0.15 (~64% density)', () => {
    assertPacking(unitSquare, 9, 0.15, 1)
  })
  it('n=1 returns a single properly-inset point', () => {
    assertPacking(unitSquare, 1, 0.3, 1)
  })
})

describe('pointille with radius — determinism', () => {
  it('same inputs → same outputs', () => {
    const a = pointille(unitSquare, 9, { radius: 0.1 })
    const b = pointille(unitSquare, 9, { radius: 0.1 })
    assert.deepEqual(a, b)
  })
  it('different seed gives a different layout', () => {
    const a = pointille(unitSquare, 9, { radius: 0.1, seed: 1 })
    const b = pointille(unitSquare, 9, { radius: 0.1, seed: 100 })
    assert.notDeepEqual(a, b)
  })
})

describe('pointille with radius — backward compatibility', () => {
  it('radius: 0 is identical to omitting the option', () => {
    assert.deepEqual(pointille(unitSquare, 25, { radius: 0 }), pointille(unitSquare, 25))
  })
})

describe('pointille with radius — infeasible inputs throw', () => {
  it('total circle area exceeding polygon area (area pre-check)', () => {
    assert.throws(() => pointille(unitSquare, 10, { radius: 0.3 }), PointilleFitError)
  })
  it('radius larger than the polygon inradius (empty safe region)', () => {
    // Passes the area pre-check (π·0.36 ≈ 1.13 < 3) but the L's arms are
    // only 1 wide, so no center can be 0.6 from the boundary.
    assert.throws(() => pointille(lShape, 1, { radius: 0.6 }), PointilleFitError)
  })
  it('negative radius throws RangeError', () => {
    assert.throws(() => pointille(unitSquare, 5, { radius: -1 }), RangeError)
  })
  it('NaN radius throws RangeError', () => {
    assert.throws(() => pointille(unitSquare, 5, { radius: NaN }), RangeError)
  })
})

describe('separate — direct', () => {
  it('pushes two overlapping circles apart', () => {
    const big: Polygon = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]
    const r = 1
    const out = separate(big, r)([
      [5, 5],
      [6, 5],
    ])
    const check = verifyPacking(big, r, out, 1e-9 * 10)
    assert.ok(check.ok, `minPairwise=${check.minPairwise} minBoundary=${check.minBoundary}`)
  })
  it('resolves coincident points deterministically', () => {
    const big: Polygon = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]
    const run = () =>
      separate(big, 0.5)([
        [5, 5],
        [5, 5],
        [5, 5],
      ])
    const a = run()
    assert.ok(verifyPacking(big, 0.5, a, 1e-8).ok)
    assert.deepEqual(a, run())
  })
})
