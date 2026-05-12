import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  boundingBox,
  pointInPolygon,
  polygonCentroid,
  signedArea,
} from '../geometry.js'
import type { Polygon } from '../types.js'

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

describe('boundingBox', () => {
  it('returns min/max corners', () => {
    assert.deepEqual(boundingBox(unitSquare), [
      [0, 0],
      [1, 1],
    ])
    assert.deepEqual(boundingBox(triangle), [
      [0, 0],
      [4, 3],
    ])
  })
})

describe('signedArea', () => {
  it('unit square area is 0.5 magnitude... wait, 1', () => {
    assert.equal(Math.abs(signedArea(unitSquare)), 1)
  })
  it('triangle area is base*height/2 = 6', () => {
    assert.equal(Math.abs(signedArea(triangle)), 6)
  })
  it('L-shape area is 3', () => {
    assert.equal(Math.abs(signedArea(lShape)), 3)
  })
})

describe('polygonCentroid', () => {
  it('unit square centroid is (0.5, 0.5)', () => {
    const [cx, cy] = polygonCentroid(unitSquare)
    assert.ok(Math.abs(cx - 0.5) < 1e-12)
    assert.ok(Math.abs(cy - 0.5) < 1e-12)
  })
  it('triangle centroid is the average of vertices', () => {
    const [cx, cy] = polygonCentroid(triangle)
    assert.ok(Math.abs(cx - 2) < 1e-12)
    assert.ok(Math.abs(cy - 1) < 1e-12)
  })
})

describe('pointInPolygon', () => {
  it('detects interior points of unit square', () => {
    assert.equal(pointInPolygon(unitSquare, [0.5, 0.5]), true)
    assert.equal(pointInPolygon(unitSquare, [0.01, 0.99]), true)
  })
  it('rejects exterior points of unit square', () => {
    assert.equal(pointInPolygon(unitSquare, [-0.1, 0.5]), false)
    assert.equal(pointInPolygon(unitSquare, [1.5, 0.5]), false)
    assert.equal(pointInPolygon(unitSquare, [0.5, 2]), false)
  })
  it('respects concavity of L-shape', () => {
    // Inside the leg.
    assert.equal(pointInPolygon(lShape, [0.5, 1.5]), true)
    assert.equal(pointInPolygon(lShape, [1.5, 0.5]), true)
    // In the notch (outside the L).
    assert.equal(pointInPolygon(lShape, [1.5, 1.5]), false)
  })
  it('is curried', () => {
    const isInside = pointInPolygon(unitSquare)
    assert.equal(isInside([0.5, 0.5]), true)
    assert.equal(isInside([2, 2]), false)
  })
})
