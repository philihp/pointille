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

describe('pointille with radius — balanced gaps', () => {
  const bigSquare: Polygon = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ]
  const bigTriangle: Polygon = [
    [0, 0],
    [10, 0],
    [5, 8.66],
  ]

  const gaps = (polygon: Polygon, n: number, r: number) => {
    const pts = pointille(polygon, n, { radius: r })
    const boundary = distanceToBoundary(polygon)
    const wallGaps = pts.map((p) => boundary(p) - r)
    const pairGap = minNearestNeighbour(pts) - 2 * r
    return { wallGaps, pairGap }
  }

  it('square n=4 r=1.1 reaches the analytic equilibrium (all gaps ≈ 1.87)', () => {
    // 2×2 grid equilibrium: 2·(2R − r) + 2R = 10 with r = 1.1 → R = 61/30,
    // uniform gap g = 2(R − r) ≈ 1.867 between circles and to every wall.
    const { wallGaps, pairGap } = gaps(bigSquare, 4, 1.1)
    for (const g of wallGaps) assert.ok(g > 1.55 && g < 2.2, `wall gap ${g.toFixed(3)}`)
    assert.ok(pairGap > 1.55 && pairGap < 2.2, `pair gap ${pairGap.toFixed(3)}`)
  })

  it('triangle n=4 r=1.1: no circle hugs the boundary', () => {
    // Before balancing, two circles sat 0.07 from the edge while the
    // smallest circle-to-circle gap was 0.51.
    const { wallGaps, pairGap } = gaps(bigTriangle, 4, 1.1)
    const minWall = Math.min(...wallGaps)
    assert.ok(minWall >= 0.5 * pairGap, `minWall=${minWall.toFixed(3)} pairGap=${pairGap.toFixed(3)}`)
    assert.ok(minWall > 0.3, `minWall=${minWall.toFixed(3)}`)
  })

  it('n=1 lands at the deepest interior point', () => {
    const [p] = pointille(unitSquare, 1, { radius: 0.2 })
    assert.ok(Math.hypot(p![0] - 0.5, p![1] - 0.5) < 0.05, `center at ${p!.join(',')}`)
  })
})

describe('pointille — degenerate polygons', () => {
  // "Triangle" with sides 5, 4, 1: 4 + 1 = 5, so the vertices are collinear
  // and the polygon has zero area.
  const degenerate541: Polygon = [
    [0, 0],
    [5, 0],
    [4, 0],
  ]

  it('radius 0 returns [] (no interior exists)', () => {
    assert.deepEqual(pointille(degenerate541, 5), [])
  })

  it('with a radius, throws PointilleFitError via the area pre-check', () => {
    assert.throws(() => pointille(degenerate541, 5, { radius: 0.1 }), PointilleFitError)
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
    const out = separate(big, { wallInset: r, pairDistance: 2 * r })([
      [5, 5],
      [6, 5],
    ])
    const check = verifyPacking(big, { wallInset: r, pairDistance: 2 * r }, out, 1e-9 * 10)
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
      separate(big, { wallInset: 0.5, pairDistance: 1 })([
        [5, 5],
        [5, 5],
        [5, 5],
      ])
    const a = run()
    assert.ok(verifyPacking(big, { wallInset: 0.5, pairDistance: 1 }, a, 1e-8).ok)
    assert.deepEqual(a, run())
  })
})
