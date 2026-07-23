// Visual demo: distributes {4,5,6,7} points in each of {triangle, square,
// pentagon} and writes an HTML page with an SVG per combination, arranged
// as a 3-column × 5-row table.
//
// Run with: npm run test:demo
import { Delaunay } from 'd3-delaunay'
import polygonClipping from 'polygon-clipping'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pointille, type Point, type Polygon } from '../src/index.js'
import { boundingBox } from '../src/geometry.js'

// ---------- shapes ----------
const triangle: Polygon = [
  [0, 0],
  [10, 0],
  [5, 8.66],
]

const square: Polygon = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
]

const pentagon: Polygon = Array.from({ length: 5 }, (_, i) => {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5
  return [5 + 5 * Math.cos(angle), 5 + 5 * Math.sin(angle)] as Point
})

// Concave L-shape, 10 units across with 5-unit-wide arms.
const lShape: Polygon = [
  [0, 0],
  [10, 0],
  [10, 5],
  [5, 5],
  [5, 10],
  [0, 10],
]

const shapes: ReadonlyArray<{ name: string; polygon: Polygon }> = [
  { name: 'Triangle', polygon: triangle },
  { name: 'Square', polygon: square },
  { name: 'Pentagon', polygon: pentagon },
]

const counts = [4, 5, 6, 7]

// Radius demo: same shapes plus the concave L, points drawn as true-size
// circles so containment and non-overlap are visually checkable.
const radiusShapes: ReadonlyArray<{ name: string; polygon: Polygon }> = [
  ...shapes,
  { name: 'L-shape', polygon: lShape },
]

const radiusRows: ReadonlyArray<{ n: number; radius: number }> = [
  { n: 4, radius: 1.1 },
  { n: 6, radius: 0.9 },
  { n: 8, radius: 0.7 },
]

// ---------- Voronoi cells clipped to polygon (for the visualization) ----------
const toMultiPoly = (poly: Polygon): [number, number][][][] => {
  const ring = poly.map(([x, y]) => [x, y] as [number, number])
  if (ring.length > 0) {
    const f = ring[0]!
    const l = ring[ring.length - 1]!
    if (f[0] !== l[0] || f[1] !== l[1]) ring.push([f[0], f[1]])
  }
  return [[ring]]
}

const clippedVoronoiCells = (sites: ReadonlyArray<Point>, polygon: Polygon): Point[][] => {
  if (sites.length === 0) return []
  const [[minX, minY], [maxX, maxY]] = boundingBox(polygon)
  const pad = Math.max(maxX - minX, maxY - minY, 1) * 2
  const flat = Float64Array.from(sites.flatMap(([x, y]) => [x, y]))
  const delaunay = new Delaunay(flat)
  const voronoi = delaunay.voronoi([minX - pad, minY - pad, maxX + pad, maxY + pad])
  const clipMP = toMultiPoly(polygon)
  return sites.map((_, i) => {
    const cell = voronoi.cellPolygon(i)
    if (!cell || cell.length < 3) return []
    const cellMP: [number, number][][][] = [[cell.map(([x, y]) => [x, y] as [number, number])]]
    const inter = polygonClipping.intersection(cellMP, clipMP)
    if (inter.length === 0) return []
    // Take outer ring of first piece (cells from interior sites are connected).
    const outer = inter[0]?.[0] ?? []
    return outer.slice(0, Math.max(0, outer.length - 1)).map(([x, y]) => [x, y] as Point)
  })
}

// ---------- SVG rendering ----------
const VB = 220 // viewBox size in px
const PAD = 14

const fitTransform = (polygon: Polygon) => {
  const [[minX, minY], [maxX, maxY]] = boundingBox(polygon)
  const w = maxX - minX
  const h = maxY - minY
  const scale = Math.min((VB - 2 * PAD) / w, (VB - 2 * PAD) / h)
  const offX = (VB - w * scale) / 2 - minX * scale
  const offY = (VB - h * scale) / 2 - minY * scale
  // SVG y-axis points down; flip to keep math conventions visually right-side-up.
  const project = ([x, y]: Point): [number, number] => [x * scale + offX, VB - (y * scale + offY)]
  return { project, scale }
}

const polygonToPath = (poly: Polygon, project: (p: Point) => [number, number]): string => {
  if (poly.length === 0) return ''
  const [hx, hy] = project(poly[0]!)
  const rest = poly
    .slice(1)
    .map((p) => {
      const [x, y] = project(p)
      return `L${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
  return `M${hx.toFixed(2)},${hy.toFixed(2)} ${rest} Z`
}

const buildSvg = (polygon: Polygon, n: number, radius = 0): string => {
  const points = pointille(polygon, n, { radius })
  const cells = clippedVoronoiCells(points, polygon)
  const { project, scale } = fitTransform(polygon)
  const cellPaths = cells
    .filter((c) => c.length >= 3)
    .map((c) => `<path d="${polygonToPath(c, project)}" />`)
    .join('')
  const boundary = polygonToPath(polygon, project)
  const dots = points
    .map((p) => {
      const [x, y] = project(p)
      // With a radius, draw circles at true size (plus a center dot); the
      // hardcoded 4px dot is only for dimensionless points.
      if (radius > 0) {
        const r = (radius * scale).toFixed(2)
        return `<circle class="disc" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r}" /><circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="2" />`
      }
      return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="4" />`
    })
    .join('')
  const label = radius > 0 ? `${n} circles of radius ${radius} in polygon` : `${n} points in polygon`
  return `<svg viewBox="0 0 ${VB} ${VB}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">
  <style>
    .bg { fill: #fff; }
    .cells path { fill: rgba(80, 110, 200, 0.06); stroke: #b6bdcd; stroke-width: 0.6; }
    .boundary { fill: none; stroke: #1a1a1a; stroke-width: 1.4; stroke-linejoin: round; }
    .sites circle { fill: #c2410c; stroke: #fff; stroke-width: 1; }
    .sites circle.disc { fill: rgba(194, 65, 12, 0.25); stroke: #c2410c; stroke-width: 1.2; }
  </style>
  <rect class="bg" width="100%" height="100%" />
  <g class="cells">${cellPaths}</g>
  <path class="boundary" d="${boundary}" />
  <g class="sites">${dots}</g>
</svg>`
}

// ---------- HTML assembly ----------
const headerRow = `<tr>${shapes.map((s) => `<th>${s.name}</th>`).join('')}</tr>`

const bodyRows = counts
  .map((n) => {
    const cells = shapes
      .map(
        ({ polygon }) =>
          `<td><div class="cell"><span class="label">n = ${n}</span>${buildSvg(polygon, n)}</div></td>`,
      )
      .join('')
    return `<tr>${cells}</tr>`
  })
  .join('\n')

const radiusHeaderRow = `<tr>${radiusShapes.map((s) => `<th>${s.name}</th>`).join('')}</tr>`

const radiusBodyRows = radiusRows
  .map(({ n, radius }) => {
    const cells = radiusShapes
      .map(
        ({ polygon }) =>
          `<td><div class="cell"><span class="label">n = ${n}, r = ${radius}</span>${buildSvg(polygon, n, radius)}</div></td>`,
      )
      .join('')
    return `<tr>${cells}</tr>`
  })
  .join('\n')

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>pointille — demo</title>
  <style>
    :root {
      --bg: #fafaf7;
      --fg: #1a1a1a;
      --muted: #777;
      --line: #c8c8c0;
      --cell: rgba(80, 110, 200, 0.06);
      --cellEdge: #b6bdcd;
      --boundary: #1a1a1a;
      --site: #c2410c;
    }
    html, body { background: var(--bg); color: var(--fg); }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      margin: 0; padding: 32px;
    }
    h1 { font-size: 20px; font-weight: 600; margin: 0 0 4px; }
    p.sub { color: var(--muted); margin: 0 0 24px; font-size: 13px; }
    table { border-collapse: collapse; margin: 0 auto; }
    th, td { padding: 6px; text-align: center; vertical-align: top; }
    th { font-weight: 600; font-size: 14px; color: var(--fg); border-bottom: 1px solid var(--line); }
    .cell {
      position: relative;
      width: 220px; height: 220px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fff;
      box-sizing: content-box;
    }
    .cell .label {
      position: absolute; top: 6px; left: 8px;
      font-size: 11px; color: var(--muted);
      font-variant-numeric: tabular-nums;
    }
    svg { display: block; width: 100%; height: 100%; }
    svg .cells path {
      fill: var(--cell);
      stroke: var(--cellEdge);
      stroke-width: 0.6;
    }
    svg .boundary {
      fill: none;
      stroke: var(--boundary);
      stroke-width: 1.4;
      stroke-linejoin: round;
    }
    svg .sites circle {
      fill: var(--site);
      stroke: #fff;
      stroke-width: 1;
    }
  </style>
</head>
<body>
  <h1>pointille</h1>
  <p class="sub">Centroidal Voronoi distribution. Rows: n = 4, 5, 6, 7. Columns: triangle, square, pentagon. Faint cells show each point's Voronoi region clipped to the polygon.</p>
  <table>
    <thead>${headerRow}</thead>
    <tbody>
${bodyRows}
    </tbody>
  </table>
  <h1 style="margin-top: 40px;">with radius</h1>
  <p class="sub">Points as circles: every circle stays fully inside the polygon and no two circles overlap (<code>pointille(polygon, n, { radius })</code>).</p>
  <table>
    <thead>${radiusHeaderRow}</thead>
    <tbody>
${radiusBodyRows}
    </tbody>
  </table>
</body>
</html>`

// ---------- write & report ----------
const dir = mkdtempSync(join(tmpdir(), 'pointille-demo-'))
const outPath = join(dir, 'index.html')
writeFileSync(outPath, html, 'utf8')

// Also emit standalone per-combo SVGs into docs/demo/ for use in README.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const docsDir = join(repoRoot, 'docs', 'demo')
mkdirSync(docsDir, { recursive: true })
const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-')
for (const { name, polygon } of shapes) {
  for (const n of counts) {
    writeFileSync(join(docsDir, `${slug(name)}-n${n}.svg`), buildSvg(polygon, n), 'utf8')
  }
}
for (const { name, polygon } of radiusShapes) {
  for (const { n, radius } of radiusRows) {
    const file = `${slug(name)}-n${n}-r${String(radius).replace('.', '_')}.svg`
    writeFileSync(join(docsDir, file), buildSvg(polygon, n, radius), 'utf8')
  }
}

console.log(`Wrote demo to: ${outPath}`)
console.log(`Wrote per-combo SVGs to: ${docsDir}`)
console.log(`Open the HTML with: open '${outPath}'  (macOS)  or  xdg-open '${outPath}'  (Linux)`)
