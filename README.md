# pointille

Distribute `n` points approximately evenly inside a polygon — deterministically — via Lloyd's algorithm on a centroidal Voronoi tessellation (CVT). Named after the Pointillist painters, who were solving much the same problem by hand.

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

### Options

```ts
pointille(polygon, n, {
  iterations: 30,    // Lloyd relaxation steps. Default: 30.
  haltonOffset: 1,   // Starting index into the Halton seed sequence. Default: 1.
})
```

Changing `haltonOffset` is the canonical way to get a different — but still deterministic — layout for the same `(polygon, n)` pair.

## Algorithm

1. **Seed.** Generate `n` candidate points inside the polygon's bounding box using a 2D Halton sequence (bases 2 and 3) and reject any falling outside the polygon. Halton is a low-discrepancy quasi-random sequence: no PRNG state, fully deterministic, well-spread.
2. **Relax.** Iterate Lloyd's algorithm:
    - Compute a Voronoi diagram of the current sites with [`d3-delaunay`](https://github.com/d3/d3-delaunay).
    - Clip each Voronoi cell to the polygon via [`polygon-clipping`](https://github.com/mfogel/polygon-clipping) (handles concave polygons and disjoint clip results correctly).
    - Move each site to the area-weighted centroid of its clipped cell.
3. Stop after `iterations` steps (default 30). The result is a centroidal Voronoi tessellation: each cell's site is at its own centroid, which gives the visual "even distribution" property.

The function is **pure and deterministic**: same inputs → byte-identical outputs.

## Why not just a grid?

A grid is even, but it (a) doesn't conform to arbitrary polygon shapes, (b) requires a row/column count that may not match `n`, and (c) looks artificial. Lloyd-relaxed CVT points are even *and* conform to the boundary.

## Development

```sh
npm install
npm test         # node --test on src/__tests__/*.test.ts via tsx
npm run build    # tsup (ESM + CJS + .d.ts)
npm run test:demo
```

### Notes on conventions

The repo structure mirrors `openskill.js` (ESM-first, `tsup` build, dual-emit `exports` map, `src/__tests__/` colocated tests, kebab-case files, Ramda in runtime deps). One deliberate departure: `openskill.js` uses Jest, but this package uses Node's built-in test runner (`node:test`) — pure stdlib, no test framework dependency. Tests run through [`tsx`](https://github.com/privatenumber/tsx) so we can `import` TypeScript directly without a separate compile step.

## License

MIT
