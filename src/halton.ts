import type { Point } from './types.js'

// Van der Corput sequence: reflect `index` around the radix point in `base`.
// E.g. for base 2, index 5 (binary 101) → 0.101 = 0.625.
const vanDerCorput =
  (base: number) =>
  (index: number): number => {
    let f = 1 / base
    let result = 0
    for (let i = index; i > 0; i = Math.floor(i / base)) {
      result += f * (i % base)
      f /= base
    }
    return result
  }

const halton2 = vanDerCorput(2)
const halton3 = vanDerCorput(3)

// One 2D Halton sample (bases 2, 3) at the given 1-based index.
export const haltonPoint = (index: number): Point => [
  halton2(index),
  halton3(index),
]

// First `n` Halton points starting at `start` (default 1; index 0 is the origin).
export const haltonSequence = (n: number, start = 1): Point[] =>
  Array.from({ length: n }, (_, i) => haltonPoint(i + start))
