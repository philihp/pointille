import { Delaunay } from 'd3-delaunay'
import polygonClipping from 'polygon-clipping'
import type { Point, Polygon } from './types.js'
import { boundingBox, polygonCentroid, signedArea } from './geometry.js'

type Ring = ReadonlyArray<readonly [number, number]>

// polygon-clipping wants closed rings (first === last), nested as
// multipolygon → polygon → ring.
const toClosedRing = (poly: Polygon): [number, number][] => {
  const ring: [number, number][] = poly.map(([x, y]) => [x, y])
  if (ring.length === 0) return ring
  const [fx, fy] = ring[0]!
  const [lx, ly] = ring[ring.length - 1]!
  if (fx !== lx || fy !== ly) ring.push([fx, fy])
  return ring
}

const openRing = (ring: Ring): Point[] => {
  if (ring.length < 2) return ring.map(([x, y]) => [x, y])
  const [fx, fy] = ring[0]!
  const [lx, ly] = ring[ring.length - 1]!
  const closed = fx === lx && fy === ly
  return (closed ? ring.slice(0, -1) : ring).map(([x, y]) => [x, y])
}

type Moment = readonly [area: number, mx: number, my: number]

const ringMoment = (ring: Polygon): Moment => {
  const area = Math.abs(signedArea(ring))
  const [cx, cy] = polygonCentroid(ring)
  return [area, area * cx, area * cy]
}

const addMoments = ([a0, x0, y0]: Moment, [a1, x1, y1]: Moment): Moment => [
  a0 + a1,
  x0 + x1,
  y0 + y1,
]

const ZERO_MOMENT: Moment = [0, 0, 0]

// Area-weighted centroid across disjoint pieces (e.g. when a Voronoi cell's
// intersection with the clip polygon yields multiple components).
const weightedCentroid = (
  rings: ReadonlyArray<Polygon>,
  fallback: Point,
): Point => {
  const [area, mx, my] = rings.reduce<Moment>(
    (acc, ring) => addMoments(acc, ringMoment(ring)),
    ZERO_MOMENT,
  )
  return area < 1e-12 ? fallback : [mx / area, my / area]
}

// For each Voronoi site, compute the centroid of (its cell ∩ clipPolygon).
// Falls back to the site itself when there is no overlap, so callers can
// iterate (e.g. Lloyd's relaxation) without special-casing empty cells.
export const voronoiCellCentroids = (
  sites: ReadonlyArray<Point>,
  clipPolygon: Polygon,
): Point[] => {
  if (sites.length === 0) return []

  const [[minX, minY], [maxX, maxY]] = boundingBox(clipPolygon)
  const pad = Math.max(maxX - minX, maxY - minY, 1) * 2
  const flat = Float64Array.from(sites.flatMap(([x, y]) => [x, y]))
  const voronoi = new Delaunay(flat).voronoi([
    minX - pad,
    minY - pad,
    maxX + pad,
    maxY + pad,
  ])
  const clipMP = [[toClosedRing(clipPolygon)]]

  return sites.map((site, i): Point => {
    const cell = voronoi.cellPolygon(i)
    if (!cell || cell.length < 3) return site

    const pieces = polygonClipping.intersection(
      [[cell as [number, number][]]],
      clipMP,
    )
    if (pieces.length === 0) return site

    // Each piece is a polygon [outerRing, ...holes]; we only need outers.
    const outers = pieces
      .map((piece) => openRing(piece[0] ?? []))
      .filter((ring) => ring.length >= 3)

    return weightedCentroid(outers, site)
  })
}
