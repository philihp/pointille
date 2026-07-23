import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  clampToSafeRegion,
  distanceToBoundary,
  distanceToSegment,
  nearestBoundaryPoint,
} from '../safe-region.js'
import { pointInPolygon } from '../geometry.js'
import { lShape, unitSquare } from './fixtures.js'

describe('distanceToSegment', () => {
  it('projects onto the segment interior', () => {
    assert.equal(distanceToSegment([0.5, 1], [0, 0], [1, 0]), 1)
  })
  it('clamps to the nearest endpoint', () => {
    assert.equal(distanceToSegment([-3, 4], [0, 0], [1, 0]), 5)
  })
  it('handles degenerate (point) segments', () => {
    assert.equal(distanceToSegment([3, 4], [0, 0], [0, 0]), 5)
  })
})

describe('distanceToBoundary', () => {
  it('center of the unit square is 0.5 from the boundary', () => {
    assert.ok(Math.abs(distanceToBoundary(unitSquare)([0.5, 0.5]) - 0.5) < 1e-12)
  })
  it('near an edge, distance is to that edge', () => {
    assert.ok(Math.abs(distanceToBoundary(unitSquare)([0.5, 0.1]) - 0.1) < 1e-12)
  })
  it('in the L-shape notch, distance is to the nearer incident edge', () => {
    // [1.3, 1.4] lies in the notch outside the polygon; the nearest boundary
    // feature is the vertical edge x = 1 (distance 0.3), closer than the
    // horizontal edge y = 1 (distance 0.4) or the corner vertex (0.5).
    const d = distanceToBoundary(lShape)([1.3, 1.4])
    assert.ok(Math.abs(d - 0.3) < 1e-12)
  })
  it('inside near the reflex corner, distance is to an incident edge', () => {
    // [1.2, 0.8] is inside the bottom arm; nearest is the edge y = 1.
    const d = distanceToBoundary(lShape)([1.2, 0.8])
    assert.ok(Math.abs(d - 0.2) < 1e-12)
  })
})

describe('nearestBoundaryPoint', () => {
  it('returns the projection point and edge index', () => {
    const hit = nearestBoundaryPoint(unitSquare)([0.5, 0.1])
    assert.equal(hit.edge, 0)
    assert.ok(Math.abs(hit.point[0] - 0.5) < 1e-12)
    assert.ok(Math.abs(hit.point[1]) < 1e-12)
  })
})

describe('clampToSafeRegion', () => {
  it('leaves already-safe points bit-identical', () => {
    const p = [0.5, 0.5] as const
    assert.equal(clampToSafeRegion(unitSquare, 0.2)(p), p)
  })
  it('pushes a point near an edge inward to distance >= r', () => {
    const clamped = clampToSafeRegion(unitSquare, 0.2)([0.5, 0.05])
    assert.ok(distanceToBoundary(unitSquare)(clamped) >= 0.2)
    assert.ok(pointInPolygon(unitSquare, clamped))
  })
  it('resolves a corner (two edges) via alternating projection', () => {
    const clamped = clampToSafeRegion(unitSquare, 0.2)([0.03, 0.05])
    assert.ok(distanceToBoundary(unitSquare)(clamped) >= 0.2)
  })
  it('pushes away from the L-shape reflex corner', () => {
    const r = 0.25
    const clamped = clampToSafeRegion(lShape, r)([1.1, 1.15])
    assert.ok(distanceToBoundary(lShape)(clamped) >= r)
    assert.ok(pointInPolygon(lShape, clamped))
  })
  it('is deterministic', () => {
    const clamp = clampToSafeRegion(lShape, 0.2)
    assert.deepEqual(clamp([1.05, 1.1]), clamp([1.05, 1.1]))
  })
})
