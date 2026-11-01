import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { cellArea, cellToBoundary, cellToLatLng, latLngToCell, polygonToCells } from 'h3-js'

const resolution = 4
const root = process.cwd()
const boundaryPath = resolve(root, 'data/raw/india-adm1.geojson')
const populationHeaderPath = resolve(root, 'data/raw/india-pop-2025-1km.json')
const populationBinaryPath = resolve(root, 'data/raw/india-pop-2025-1km.f32')
const outputPath = resolve(root, 'data/raw/maharashtra-base-hexes.json')

const [boundaryFile, headerFile, binary] = await Promise.all([
  readFile(boundaryPath, 'utf8').then(JSON.parse),
  readFile(populationHeaderPath, 'utf8').then(JSON.parse),
  readFile(populationBinaryPath),
])
const state = boundaryFile.features?.find(feature => String(feature.properties?.shapeName ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase() === 'maharashtra')
const geometry = state?.geometry
if (!geometry || geometry.type !== 'MultiPolygon') throw new Error('Expected the Maharashtra ADM1 MultiPolygon')

const h3Cells = new Set()
for (const polygon of geometry.coordinates) {
  for (const cell of polygonToCells(polygon, resolution, true)) h3Cells.add(cell)
}

const { width, height, pixelScale, tiepoint, nodata } = headerFile
const [tieI, tieJ, , tieLon, tieLat] = tiepoint
const [scaleX, scaleY] = pixelScale
if (binary.length !== width * height * 4) throw new Error('Population float grid size does not match its metadata')

const view = new DataView(binary.buffer, binary.byteOffset, binary.byteLength)
const population = new Map([...h3Cells].map(cell => [cell, 0]))
let usedPixels = 0
for (let row = 0; row < height; row++) {
  const lat = tieLat - (row - tieJ + 0.5) * scaleY
  for (let col = 0; col < width; col++) {
    const value = view.getFloat32((row * width + col) * 4, true)
    if (!Number.isFinite(value) || value <= 0 || value === nodata) continue
    const lon = tieLon + (col - tieI + 0.5) * scaleX
    const cell = latLngToCell(lat, lon, resolution)
    if (!h3Cells.has(cell)) continue
    population.set(cell, population.get(cell) + value)
    usedPixels++
  }
}

const features = [...h3Cells].map(cell => {
  const ring = cellToBoundary(cell, true)
  ring.push(ring[0])
  const [centerLat, centerLon] = cellToLatLng(cell)
  const populationCount = population.get(cell)
  const areaKm2 = cellArea(cell, 'km2')
  return {
    type: 'Feature',
    id: cell,
    geometry: { type: 'Polygon', coordinates: [ring] },
    properties: {
      h3: cell,
      resolution,
      center: [centerLon, centerLat],
      areaKm2,
      population: populationCount,
      populationDensity: populationCount / areaKm2,
      businessCounts: null,
      businessCoverage: false,
    },
  }
})

const result = {
  type: 'FeatureCollection',
  metadata: {
    name: 'Maharashtra market opportunity grid',
    coverage: 'Maharashtra, India',
    h3Resolution: resolution,
    populationSource: headerFile.source,
    populationYear: 2025,
    populationResolution: '1 km',
    populationLicense: headerFile.license,
    boundarySource: boundaryFile.metadata,
    retrievedAt: new Date().toISOString(),
    featureCount: features.length,
    sourcePixelCountUsed: usedPixels,
    note: 'Maharashtra grid is ready for category-specific OSM business counts; population figures are modeled estimates aggregated to whole hexagons.',
  },
  features,
}
await writeFile(outputPath, `${JSON.stringify(result)}\n`, 'utf8')
console.log(`Saved ${features.length} Maharashtra H3 cells with population from ${usedPixels.toLocaleString()} raster pixels`)
