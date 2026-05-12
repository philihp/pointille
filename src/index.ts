import { distributePointsInPolygon, type DistributeOptions } from './distribute-points-in-polygon.js'
import type { Point } from './types.js'

const pointille = (bound: Point[], n: number, options?: DistributeOptions): Point[] =>
  distributePointsInPolygon(bound, n, options)

export default pointille
