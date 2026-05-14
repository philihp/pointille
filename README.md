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

### Options

```ts
pointille(polygon, n, {
  iterations: 30,    // Lloyd relaxation steps. Default: 30.
  seed: 1,           // Starting index into the Halton seed sequence. Default: 1.
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
