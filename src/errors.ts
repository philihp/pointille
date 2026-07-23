/**
 * Thrown when `n` circles of the requested radius cannot be arranged inside
 * the polygon — either provably (total circle area exceeds the polygon's
 * area, or no valid center positions exist) or practically (the packing is
 * too tight for the solver to converge).
 */
export class PointilleFitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PointilleFitError'
  }
}
