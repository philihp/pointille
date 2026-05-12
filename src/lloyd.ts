import * as R from 'ramda'
import type { Point, Polygon } from './types.js'
import { voronoiCellCentroids } from './voronoi-centroid.js'

// One Lloyd relaxation step: each site moves to the centroid of its
// Voronoi cell clipped to the polygon.
export const lloydStep =
  (polygon: Polygon) =>
  (sites: ReadonlyArray<Point>): Point[] =>
    voronoiCellCentroids(sites, polygon)

// A curried iterator: `lloydRelax(polygon, n)(seed)` runs n Lloyd steps.
export const lloydRelax =
  (polygon: Polygon, iterations: number) =>
  (seed: ReadonlyArray<Point>): Point[] =>
    R.reduce(
      (acc: Point[]) => lloydStep(polygon)(acc),
      [...seed] as Point[],
      R.range(0, iterations),
    )
