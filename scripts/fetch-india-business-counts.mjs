import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { cellToLatLng, latLngToCell } from 'h3-js'

const root = process.cwd()
const endpoint = process.env.OVERPASS_URL ?? 'https://overpass.private.coffee/api/interpreter'
const outputPath = resolve(root, 'data/raw/maharashtra-base-hexes.json')
const browserGridPath = resolve(root, 'public/data/maharashtra-hexes.json')
const boundaryPath = resolve(root, 'public/data/maharashtra-boundary.geojson')
const forceRefresh = process.argv.includes('--refresh')
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
let savedGrid
try { savedGrid = JSON.parse(await readFile(outputPath, 'utf8')) }
catch { savedGrid = JSON.parse(await readFile(browserGridPath, 'utf8')) }
const grid = forceRefresh ? JSON.parse(JSON.stringify(savedGrid)) : savedGrid
const boundaries = JSON.parse(await readFile(boundaryPath, 'utf8'))
const cells = new Map(grid.features.map(feature => [feature.id, feature]))
const states = boundaries.features
if (!states.length) throw new Error('The Maharashtra boundary file is empty')
await mkdir(dirname(outputPath), { recursive: true })

function coordinatePairs(node, pairs = []) {
  if (!Array.isArray(node)) return pairs
  if (node.length >= 2 && typeof node[0] === 'number' && typeof node[1] === 'number') pairs.push(node)
  else for (const child of node) coordinatePairs(child, pairs)
  return pairs
}

function insideRing(point, ring) {
  const [x, y] = point
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const crosses = (yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / ((yj - yi) || Number.EPSILON) + xi
    if (crosses) inside = !inside
  }
  return inside
}

function insideState(lon, lat, geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  for (const polygon of polygons) {
    if (insideRing([lon, lat], polygon[0]) && !polygon.slice(1).some(hole => insideRing([lon, lat], hole))) return true
  }
  return false
}

function stateBox(state) {
  const points = coordinatePairs(state.geometry.coordinates)
  const xs = points.map(p => p[0]), ys = points.map(p => p[1])
  return [Math.min(...ys), Math.min(...xs), Math.max(...ys), Math.max(...xs)]
}

function countTags(feature, tags) {
  const target = feature.properties.businessCounts ?? (feature.properties.businessCounts = {})
  for (const [key, value] of tags) {
    if (['shop', 'office', 'craft', 'amenity', 'leisure', 'tourism', 'healthcare'].includes(key) && typeof value === 'string') {
      const tag = `${key}:${value}`
      target[tag] = (target[tag] ?? 0) + 1
    }
  }
  feature.properties.mappedPlaces = (feature.properties.mappedPlaces ?? 0) + 1
  feature.properties.businessCoverage = true
}

const statuses = { ...(grid.metadata.businessStateStatuses ?? {}) }
if (forceRefresh) {
  for (const feature of grid.features) {
    feature.properties.businessCounts = null
    feature.properties.mappedPlaces = 0
    feature.properties.businessCoverage = false
  }
  grid.metadata.businessStateStatuses = {}
  grid.metadata.businessCoverageStates = []
  grid.metadata.businessTagTotals = {}
  grid.metadata.businessFeatureCount = 0
}
let total = forceRefresh ? 0 : (grid.metadata.businessFeatureCount ?? 0)
const tagTotals = forceRefresh ? {} : { ...(grid.metadata.businessTagTotals ?? {}) }
let failed = 0
for (const state of states) {
  const stateName = String(state.properties.shapeName)
  const normalizedStatus = Object.entries(statuses).find(([name]) => name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase() === stateName.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase())?.[1]
  if (!forceRefresh && normalizedStatus === 'complete') {
    console.log(`${stateName}: already complete; skipping`)
    continue
  }
  const [minLat, minLon, maxLat, maxLon] = stateBox(state)
  const tileSize = 1.5
  const stateElements = new Map()
  const tiles = []
  for (let south = minLat; south < maxLat; south += tileSize) {
    for (let west = minLon; west < maxLon; west += tileSize) {
      tiles.push([south, west, Math.min(south + tileSize, maxLat), Math.min(west + tileSize, maxLon)])
    }
  }
  console.log(`Querying ${stateName} in ${tiles.length} bounded map tiles…`)
  let stateFailed = false
  for (let tileIndex = 0; tileIndex < tiles.length; tileIndex++) {
    const bboxText = tiles[tileIndex].map(n => n.toFixed(5)).join(',')
    const query = `[out:json][timeout:60][maxsize:134217728];
  (
    nwr["shop"](${bboxText});
    nwr["office"](${bboxText});
    nwr["craft"](${bboxText});
    nwr["amenity"](${bboxText});
    nwr["leisure"](${bboxText});
    nwr["tourism"](${bboxText});
    nwr["healthcare"](${bboxText});
  );
  out center tags;`
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8', 'user-agent': 'MosaicHackathon/0.1 (India business hex aggregation)' },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(90_000),
      })
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
      const payload = await response.json()
      if (payload.remark) throw new Error(payload.remark)
      for (const element of payload.elements ?? []) stateElements.set(`${element.type}/${element.id}`, element)
      if ((tileIndex + 1) % 10 === 0 || tileIndex + 1 === tiles.length) console.log(`${stateName}: fetched tile ${tileIndex + 1}/${tiles.length}`)
    } catch (error) {
      stateFailed = true
      console.warn(`${stateName}: tile ${tileIndex + 1}/${tiles.length} failed: ${error.message}`)
      break
    }
    await delay(1200)
  }
  let stateCount = 0
  if (stateFailed) stateElements.clear()
  for (const element of stateElements.values()) {
    const lat = element.lat ?? element.center?.lat
    const lon = element.lon ?? element.center?.lon
    if (typeof lat !== 'number' || typeof lon !== 'number' || !insideState(lon, lat, state.geometry)) continue
    const cell = cells.get(latLngToCell(lat, lon, grid.metadata.h3Resolution))
    if (!cell) continue
    const tags = Object.entries(element.tags ?? {}).filter(([, value]) => typeof value === 'string')
    countTags(cell, tags)
    for (const [key, value] of tags) {
      if (['shop', 'office', 'craft', 'amenity', 'leisure', 'tourism', 'healthcare'].includes(key)) {
        const tag = `${key}:${value}`
        tagTotals[tag] = (tagTotals[tag] ?? 0) + 1
      }
    }
    stateCount++
  }
  if (!stateFailed) {
    for (const feature of grid.features) {
      const center = feature.properties.center
      if (center && insideState(center[0], center[1], state.geometry)) {
        feature.properties.businessCounts ??= {}
        feature.properties.mappedPlaces ??= 0
        feature.properties.businessCoverage = true
      }
    }
    total += stateCount
    statuses[stateName] = 'complete'
    console.log(`${stateName}: aggregated ${stateCount.toLocaleString()} mapped features`)
  } else {
    statuses[stateName] = 'failed'
    failed++
    console.warn(`${stateName}: partial tile results discarded; retry this state later`)
  }
  if (stateFailed && forceRefresh) {
    console.warn('Refresh was incomplete; the previous saved Maharashtra snapshot was kept.')
    break
  }
  grid.metadata.businessSource = 'OpenStreetMap contributors via Overpass API'
  grid.metadata.businessSourceUrl = 'https://www.openstreetmap.org/copyright'
  grid.metadata.businessEndpoint = endpoint
  grid.metadata.businessLicense = 'Open Database License (ODbL) 1.0'
  grid.metadata.businessAttribution = '© OpenStreetMap contributors'
  grid.metadata.businessRetrievedAt = new Date().toISOString()
  grid.metadata.businessFeatureCount = total
  grid.metadata.businessStateStatuses = statuses
  grid.metadata.businessCoverageStates = Object.entries(statuses).filter(([, status]) => status === 'complete').map(([name]) => name)
  grid.metadata.businessTagTotals = tagTotals
  grid.metadata.note = 'Maharashtra population is modeled. Business categories are community-mapped and aggregated into H3 cells; coverage is limited to Maharashtra.'
  await writeFile(outputPath, `${JSON.stringify(grid)}\n`, 'utf8')
  await delay(1500)
}

if (failed && forceRefresh) {
  process.exitCode = 1
} else {
  await writeFile(outputPath, `${JSON.stringify(grid)}\n`, 'utf8')
  console.log(`Maharashtra OSM aggregation covers ${grid.metadata.businessCoverageStates?.length ?? 0}/1 state; ${total.toLocaleString()} mapped features.`)
}
if (failed) process.exitCode = 1
