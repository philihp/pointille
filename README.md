# pointille

Distribute `n` points approximately evenly inside a polygon — deterministically — via Lloyd's algorithm on a centroidal Voronoi tessellation (CVT). Named after [pointillé](https://en.wikipedia.org/wiki/Pointillé), the decorative pattern used in jewelry.

|     | Triangle | Square | Pentagon |
| --- | :---: | :---: | :---: |
| **n = 4** | <img src="https://raw.githubusercontent.com/philihp/pointille/main/docs/demo/triangle-n4.svg" width="160" alt="4 points in a triangle" /> | <img src="https://raw.githubusercontent.com/philihp/pointille/main/docs/demo/square-n4.svg" width="160" alt="4 points in a square" /> | <img src="https://raw.githubusercontent.com/philihp/pointille/main/docs/demo/pentagon-n4.svg" width="160" alt="4 points in a pentagon" /> |
| **n = 5** | <img src="https://raw.githubusercontent.com/philihp/pointille/main/docs/demo/triangle-n5.svg" width="160" alt="5 points in a triangle" /> | <img src="https://raw.githubusercontent.com/philihp/pointille/main/docs/demo/square-n5.svg" width="160" alt="5 points in a square" /> | <img src="https://raw.githubusercontent.com/philihp/pointille/main/docs/demo/pentagon-n5.svg" width="160" alt="5 points in a pentagon" /> |
| **n = 6** | <img src="https://raw.githubusercontent.com/philihp/pointille/main/docs/demo/triangle-n6.svg" width="160" alt="6 points in a triangle" /> | <img src="https://raw.githubusercontent.com/philihp/pointille/main/docs/demo/square-n6.svg" width="160" alt="6 points in a square" /> | <img src="https://raw.githubusercontent.com/philihp/pointille/main/docs/demo/pentagon-n6.svg" width="160" alt="6 points in a pentagon" /> |
| **n = 7** | <img src="https://raw.githubusercontent.com/philihp/pointille/main/docs/demo/triangle-n7.svg" width="160" alt="7 points in a triangle" /> | <img src="https://raw.githubusercontent.com/philihp/pointille/main/docs/demo/square-n7.svg" width="160" alt="7 points in a square" /> | <img src="https://raw.githubusercontent.com/philihp/pointille/main/docs/demo/pentagon-n7.svg" width="160" alt="7 points in a pentagon" /> |

Faint cells show each point's Voronoi region clipped to the polygon. Regenerate with `npm run test:demo`.

## Install

```sh
npm install pointille
```

## Usage

```ts
import { pointille } from 'pointille'

const unitSquare = [
  [0, 0], [1, 0], [1, 1], [0, 1],
] as const

const points = pointille(unitSquare, 25)
// => 25 [x, y] tuples, all inside the square, roughly evenly spaced.
```

A `Point` is a `readonly [number, number]` tuple. A `Polygon` is an ordered ring of points (no need to close it — the first vertex is implicitly connected to the last).

### Concave polygons

Cells are clipped against the input polygon, so concave shapes work too. No points leak into the missing corner, and density along each arm stays roughly equal:

```ts
const lShape = [
  [0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2],
] as const

const points = pointille(lShape, 40)
```

### Circles with a radius

Pass `radius` to treat each point as the center of a circle. The result then carries two hard guarantees: every circle lies fully inside the polygon (centers at least `radius` from the boundary), and no two circles overlap (centers at least `2 * radius` apart) — still fully deterministic.

```ts
const centers = pointille(unitSquare, 9, { radius: 0.1 })
// => 9 centers; each circle of radius 0.1 fits inside the square,
//    and no two circles overlap.
```

|     | Triangle | Square | Pentagon | L-shape |
| --- | :---: | :---: | :---: | :---: |
| **n = 4, r = 1.1** | <img src="https://raw.githubusercontent.com/philihp/pointille/main/docs/demo/triangle-n4-r1_1.svg" width="160" alt="4 circles in a triangle" /> | <img src="https://raw.githubusercontent.com/philihp/pointille/main/docs/demo/square-n4-r1_1.svg" width="160" alt="4 circles in a square" /> | <img src="https://raw.githubusercontent.com/philihp/pointille/main/docs/demo/pentagon-n4-r1_1.svg" width="160" alt="4 circles in a pentagon" /> | <img src="https://raw.githubusercontent.com/philihp/pointille/main/docs/demo/l-shape-n4-r1_1.svg" width="160" alt="4 circles in an L-shape" /> |
| **n = 8, r = 0.7** | <img src="https://raw.githubusercontent.com/philihp/pointille/main/docs/demo/triangle-n8-r0_7.svg" width="160" alt="8 circles in a triangle" /> | <img src="https://raw.githubusercontent.com/philihp/pointille/main/docs/demo/square-n8-r0_7.svg" width="160" alt="8 circles in a square" /> | <img src="https://raw.githubusercontent.com/philihp/pointille/main/docs/demo/pentagon-n8-r0_7.svg" width="160" alt="8 circles in a pentagon" /> | <img src="https://raw.githubusercontent.com/philihp/pointille/main/docs/demo/l-shape-n8-r0_7.svg" width="160" alt="8 circles in an L-shape" /> |

When `n` circles of the requested radius cannot fit — provably (total circle area exceeds the polygon's area, or the radius exceeds the polygon's inradius) or practically (the packing is too tight to converge) — `pointille` throws a `PointilleFitError` with a message suggesting a smaller `radius` or `n`. Packings up to roughly 55–65% area coverage are practical; corridors narrower than `2 * radius` are unusable regardless of total area.

```ts
import { pointille, PointilleFitError } from 'pointille'

try {
  pointille(unitSquare, 10, { radius: 0.3 }) // 10·π·0.3² ≈ 2.83 > 1
} catch (e) {
  if (e instanceof PointilleFitError) console.log(e.message)
}
```

### Options

```ts
pointille(polygon, n, {
  iterations: 30,    // Lloyd relaxation steps. Default: 30.
  seed: 1,           // Starting index into the Halton seed sequence. Default: 1.
  radius: 0,         // Circle radius per point; 0 = dimensionless. Default: 0.
})
```

Changing `seed` is the canonical way to get a different — but still deterministic — layout for the same `(polygon, n)` pair.

## Algorithm

1. **Seed.** Generate `n` candidate points inside the polygon's bounding box using a 2D Halton sequence (pairing Van der Corput sequences in bases 2 and 3) and reject any falling outside the polygon. Halton is a low-discrepancy quasi-random sequence: no PRNG state, fully deterministic, well-spread.
2. **Relax.** Iterate Lloyd's algorithm:
    - Compute a Voronoi diagram of the current sites with [`d3-delaunay`](https://github.com/d3/d3-delaunay).
    - Clip each Voronoi cell to the polygon via [`polygon-clipping`](https://github.com/mfogel/polygon-clipping) so that we handle concave polygons.
    - Move each site to the area-weighted centroid of its clipped cell.
3. Stop after `iterations` steps (default 30). The result is a centroidal Voronoi tessellation: each cell's site is at its own centroid, which gives the visual "even distribution" property.
4. **(With `radius`.)** Seeds are restricted to the *safe region* — points at least `radius` from the boundary — and after each Lloyd step centers are clamped back into it. A final separation pass then resolves any remaining overlaps: close pairs (found via the Delaunay graph) are pushed apart symmetrically, re-clamped, and the result is verified exactly against both constraints before being returned.

The function is **pure and deterministic**: same inputs → byte-identical outputs.

## Why not Poisson-disk sampling?

[Poisson-disk sampling](https://www.jasondavies.com/poisson-disc/) is the usual go-to for "evenly spread but not gridded" points and is faster, with a more organic feel. A CVT layout looks more intentionally spaced, with a more crystalline quality — pick whichever matches the look you want.

## Development

```sh
npm install
npm test         # node --test on src/__tests__/*.test.ts via tsx
npm run build    # tsup (ESM + CJS + .d.ts)
npm run test:demo
```

## License

MIT
