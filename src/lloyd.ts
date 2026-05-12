import * as R from 'ramda'
import type { Point, Polygon } from './types.js'
import { voronoiCellCentroids } from './voronoi-centroid.js'

// Apply `f` to `x`, `n` times. The missing primitive in Ramda for
// "iterate a step function" — clearer than `reduce`-over-`range`.
export const iterate =
  <T>(n: number, f: (x: T) => T) =>
  (x: T): T =>
    R.range(0, n).reduce<T>((acc) => f(acc), x)

// One Lloyd relaxation step: each site moves to the centroid of its
// Voronoi cell clipped to the polygon.
export const lloydStep =
  (polygon: Polygon) =>
  (sites: ReadonlyArray<Point>): Point[] =>
    voronoiCellCentroids(sites, polygon)

// `lloydRelax(polygon, n)(seed)` runs n Lloyd steps.
export const lloydRelax = (polygon: Polygon, iterations: number): ((seed: Point[]) => Point[]) =>
  iterate<Point[]>(iterations, lloydStep(polygon))
