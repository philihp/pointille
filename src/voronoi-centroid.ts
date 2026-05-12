import { Delaunay } from 'd3-delaunay'
import polygonClipping from 'polygon-clipping'
import * as R from 'ramda'
import type { Point, Polygon } from './types.js'
import { boundingBox, polygonCentroid, signedArea } from './geometry.js'

// polygon-clipping wants closed rings (first === last) of [x,y] pairs,
// wrapped twice (multipolygon → polygon → ring).
const toMultiPoly = (poly: Polygon): [number, number][][][] => {
  const ring = poly.map(([x, y]) => [x, y] as [number, number])
  if (ring.length > 0) {
    const first = ring[0]!
    const last = ring[ring.length - 1]!
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]])
  }
  return [[ring]]
}

const ringWithoutClose = (ring: ReadonlyArray<readonly [number, number]>): Point[] => {
  if (ring.length < 2) return ring.map(([x, y]) => [x, y] as Point)
  const first = ring[0]!
  const last = ring[ring.length - 1]!
  const closed = first[0] === last[0] && first[1] === last[1]
  const trimmed = closed ? ring.slice(0, -1) : ring
  return trimmed.map(([x, y]) => [x, y] as Point)
}

// Area-weighted centroid across multiple disjoint pieces.
const weightedCentroid = (rings: ReadonlyArray<Polygon>, fallback: Point): Point => {
  const pairs = R.map((ring: Polygon) => {
    const a = Math.abs(signedArea(ring))
    const c = polygonCentroid(ring)
    return [a, c] as const
  }, rings)
  const totalArea = R.sum(R.map(([a]) => a, pairs))
  if (totalArea < 1e-12) return fallback
  const sx = R.sum(R.map(([a, c]) => a * c[0], pairs)) / totalArea
  const sy = R.sum(R.map(([a, c]) => a * c[1], pairs)) / totalArea
  return [sx, sy]
}

// For each Voronoi site, compute the centroid of (its cell ∩ clipPolygon).
// If a site has no overlap with the polygon (shouldn't happen for interior
// sites), the site itself is returned so the iteration remains stable.
export const voronoiCellCentroids = (
  sites: ReadonlyArray<Point>,
  clipPolygon: Polygon,
): Point[] => {
  if (sites.length === 0) return []
  const [[minX, minY], [maxX, maxY]] = boundingBox(clipPolygon)
  const w = maxX - minX
  const h = maxY - minY
  const pad = Math.max(w, h, 1) * 2
  const flat = Float64Array.from(sites.flatMap(([x, y]) => [x, y]))
  const delaunay = new Delaunay(flat)
  const voronoi = delaunay.voronoi([minX - pad, minY - pad, maxX + pad, maxY + pad])
  const clipMP = toMultiPoly(clipPolygon)

  return sites.map((site, i): Point => {
    const cell = voronoi.cellPolygon(i)
    if (!cell || cell.length < 3) return site
    const cellMP: [number, number][][][] = [[cell.map(([x, y]) => [x, y] as [number, number])]]
    const inter = polygonClipping.intersection(cellMP, clipMP)
    if (inter.length === 0) return site
    // inter is MultiPolygon: take outer ring of each piece (ignore holes for centroid use).
    const outerRings = inter.map((poly) => ringWithoutClose(poly[0] ?? []))
    return weightedCentroid(outerRings.filter((r) => r.length >= 3), site)
  })
}
