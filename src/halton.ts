import * as R from 'ramda'
import type { Point } from './types.js'

// Single-coordinate Halton value for `index` in `base`.
// Deterministic, point-free-adjacent: an inner reducer over the
// base-b digit expansion of `index`.
const haltonAt = (base: number) => (index: number): number => {
  let f = 1
  let r = 0
  let i = index
  while (i > 0) {
    f = f / base
    r = r + f * (i % base)
    i = Math.floor(i / base)
  }
  return r
}

const halton2 = haltonAt(2)
const halton3 = haltonAt(3)

// One 2D Halton sample (bases 2, 3) at the given 1-based index.
export const haltonPoint = (index: number): Point => [halton2(index), halton3(index)]

// First `n` Halton points starting at `start` (default 1, since index 0 is the origin).
export const haltonSequence = (n: number, start = 1): Point[] =>
  R.times((i) => haltonPoint(i + start), n)
