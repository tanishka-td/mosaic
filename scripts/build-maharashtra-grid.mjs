import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = process.cwd()
const normalize = value => String(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const boundaryPaths = [resolve(root, 'data/raw/india-adm1.geojson'), resolve(root, 'public/data/maharashtra-boundary.geojson')]
const sourceGridPaths = [resolve(root, 'data/raw/maharashtra-base-hexes.json'), resolve(root, 'public/data/maharashtra-hexes.json')]
const outputDir = resolve(root, 'public/data')

async function readFirstAvailable(paths) {
  let lastError
  for (const path of paths) {
    try { return JSON.parse(await readFile(path, 'utf8')) }
    catch (error) { lastError = error }
  }
  throw lastError
}

const [boundaries, sourceGrid] = await Promise.all([readFirstAvailable(boundaryPaths), readFirstAvailable(sourceGridPaths)])
const state = boundaries.features.find(feature => normalize(feature.properties?.shapeName) === 'maharashtra')
if (!state) throw new Error('Maharashtra was not found in the ADM1 boundary file')

const features = sourceGrid.features.filter(feature => feature.properties?.businessCoverage === true)
if (!features.length) throw new Error('No complete Maharashtra business cells were found in the source grid')
const { sourcePixelCountUsed: _allIndiaPixelCount, ...sourceMetadata } = sourceGrid.metadata

const grid = {
  ...sourceGrid,
  metadata: {
    ...sourceMetadata,
    name: 'Maharashtra market opportunity grid',
    coverage: 'Maharashtra, India',
    featureCount: features.length,
    businessStateStatuses: { Maharashtra: 'complete' },
    businessCoverageStates: ['Maharashtra'],
    note: 'Maharashtra-only view. Population is modeled; business data is mapped in OpenStreetMap and is not a complete official business registry. Fine H3 cells allocate source counts proportionally.',
  },
  features,
}
const boundary = {
  type: 'FeatureCollection',
  metadata: { ...boundaries.metadata, state: 'Maharashtra', stateCode: state.properties?.shapeISO },
  features: [state],
}

await mkdir(outputDir, { recursive: true })
await Promise.all([
  writeFile(resolve(outputDir, 'maharashtra-hexes.json'), `${JSON.stringify(grid)}\n`, 'utf8'),
  writeFile(resolve(outputDir, 'maharashtra-boundary.geojson'), `${JSON.stringify(boundary)}\n`, 'utf8'),
])
console.log(`Built Maharashtra grid with ${features.length} sourced H3 cells and one state boundary`)
