import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { haltonPoint, haltonSequence } from '../halton.js'

describe('halton', () => {
  it('haltonPoint(1) returns the canonical first values', () => {
    const [u, v] = haltonPoint(1)
    // Halton bases 2, 3 at index 1: 1/2 and 1/3.
    assert.equal(u, 0.5)
    assert.ok(Math.abs(v - 1 / 3) < 1e-12)
  })

  it('all values lie in [0, 1)', () => {
    const seq = haltonSequence(200)
    for (const [u, v] of seq) {
      assert.ok(u >= 0 && u < 1, `u=${u}`)
      assert.ok(v >= 0 && v < 1, `v=${v}`)
    }
  })

  it('is deterministic', () => {
    assert.deepEqual(haltonSequence(50), haltonSequence(50))
  })

  it('produces distinct points', () => {
    const seq = haltonSequence(100)
    const keys = new Set(seq.map(([u, v]) => `${u},${v}`))
    assert.equal(keys.size, 100)
  })
})
