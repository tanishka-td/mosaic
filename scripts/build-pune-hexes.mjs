import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const inputPath = resolve(root, 'public/data/pune-places.geojson')
const outputPath = resolve(root, 'public/data/pune-hexes.json')
const partialPath = resolve(root, 'public/data/pune-hexes.partial.json')
const bbox = { west: 73.72, south: 18.40, east: 73.98, north: 18.64 }
const radiusKm = 2
const populationYear = 2025
const populationResolution = '100m'
const api = 'https://api.worldpop.org/v2'
const lat0 = (bbox.south + bbox.north) / 2
const kmPerDegreeLat = 111.32
const kmPerDegreeLon = 111.32 * Math.cos(lat0 * Math.PI / 180)
const width = (bbox.east - bbox.west) * kmPerDegreeLon
const height = (bbox.north - bbox.south) * kmPerDegreeLat

const placesFile = JSON.parse(await readFile(inputPath, 'utf8'))
const toLocal = ([lon, lat]) => [(lon - bbox.west) * kmPerDegreeLon, (lat - bbox.south) * kmPerDegreeLat]
const toGeo = ([x, y]) => [bbox.west + x / kmPerDegreeLon, bbox.south + y / kmPerDegreeLat]

function axialFor(x, y) {
  const qf = (2 / 3 * x) / radiusKm
  const rf = (-x / 3 + Math.sqrt(3) / 3 * y) / radiusKm
  let cx = qf, cz = rf, cy = -cx - cz
  let rx = Math.round(cx), ry = Math.round(cy), rz = Math.round(cz)
  const dx = Math.abs(rx - cx), dy = Math.abs(ry - cy), dz = Math.abs(rz - cz)
  if (dx > dy && dx > dz) rx = -ry - rz
  else if (dy > dz) ry = -rx - rz
  else rz = -rx - ry
  return [rx, rz]
}

function hex(q, r) {
  const cx = radiusKm * 1.5 * q
  const cy = radiusKm * Math.sqrt(3) * (r + q / 2)
  return Array.from({ length: 6 }, (_, i) => {
    const angle = Math.PI / 180 * (60 * i)
    return [cx + radiusKm * Math.cos(angle), cy + radiusKm * Math.sin(angle)]
  })
}

function clipEdge(points, inside, intersect) {
  const result = []
  for (let i = 0; i < points.length; i++) {
    const current = points[i]
    const previous = points[(i + points.length - 1) % points.length]
    const currentIn = inside(current)
    const previousIn = inside(previous)
    if (currentIn) {
      if (!previousIn) result.push(intersect(previous, current))
      result.push(current)
    } else if (previousIn) result.push(intersect(previous, current))
  }
  return result
}

function clipToBounds(points) {
  let p = points
  p = clipEdge(p, a => a[0] >= 0, (a, b) => [0, a[1] + (b[1] - a[1]) * (0 - a[0]) / (b[0] - a[0])])
  p = clipEdge(p, a => a[0] <= width, (a, b) => [width, a[1] + (b[1] - a[1]) * (width - a[0]) / (b[0] - a[0])])
  p = clipEdge(p, a => a[1] >= 0, (a, b) => [a[0] + (b[0] - a[0]) * (0 - a[1]) / (b[1] - a[1]), 0])
  p = clipEdge(p, a => a[1] <= height, (a, b) => [a[0] + (b[0] - a[0]) * (height - a[1]) / (b[1] - a[1]), height])
  const unique = []
  for (const point of p) {
    const previous = unique.at(-1)
    if (!previous || Math.hypot(point[0] - previous[0], point[1] - previous[1]) > 1e-8) unique.push(point)
  }
  if (unique.length > 2 && Math.hypot(unique[0][0] - unique.at(-1)[0], unique[0][1] - unique.at(-1)[1]) <= 1e-8) unique.pop()
  if (unique.length < 3) return []
  const area = Math.abs(unique.reduce((sum, point, i) => {
    const next = unique[(i + 1) % unique.length]
    return sum + point[0] * next[1] - next[0] * point[1]
  }, 0) / 2)
  return area > 1e-6 ? unique : []
}

const grid = new Map()
for (let q = -20; q <= 20; q++) {
  for (let r = -20; r <= 20; r++) {
    const clipped = clipToBounds(hex(q, r))
    if (clipped.length < 3) continue
    const centerLocal = clipped.reduce((a, p) => [a[0] + p[0] / clipped.length, a[1] + p[1] / clipped.length], [0, 0])
    const center = toGeo(centerLocal)
    grid.set(`${q}:${r}`, {
      id: `pune-2km-${q}-${r}`,
      q,
      r,
      resolutionKm: radiusKm,
      areaKm2: 0,
      center,
      population: null,
      places: { all: 0, cafes: 0, pharmacies: 0, salons: 0, groceries: 0, fitness: 0, tutoring: 0, restaurants: 0, otherBusinesses: 0 },
      polygon: [...clipped.map(toGeo), toGeo(clipped[0])],
    })
  }
}

for (const feature of placesFile.features) {
  const [lon, lat] = feature.geometry.coordinates
  if (lon < bbox.west || lon > bbox.east || lat < bbox.south || lat > bbox.north) continue
  const [q, r] = axialFor(...toLocal([lon, lat]))
  const cell = grid.get(`${q}:${r}`)
  if (!cell) continue
  const tags = feature.properties.tags ?? {}
  const amenity = tags.amenity
  const shop = tags.shop
  const leisure = tags.leisure
  const business = shop || tags.office || tags.craft || amenity === 'cafe' || amenity === 'pharmacy' || amenity === 'restaurant' || amenity === 'fast_food'
  if (business) cell.places.all++
  if (amenity === 'cafe' || shop === 'coffee') cell.places.cafes++
  if (amenity === 'pharmacy' || shop === 'chemist') cell.places.pharmacies++
  if (shop === 'hairdresser' || shop === 'beauty') cell.places.salons++
  if (['supermarket', 'convenience', 'grocery'].includes(shop)) cell.places.groceries++
  if (['fitness_centre', 'sports_centre'].includes(leisure)) cell.places.fitness++
  if (amenity === 'school' || tags.office === 'educational_institution') cell.places.tutoring++
  if (amenity === 'restaurant' || amenity === 'fast_food') cell.places.restaurants++
  if (business && !['cafe', 'pharmacy', 'restaurant', 'fast_food', 'school'].includes(amenity) && !['coffee', 'chemist', 'hairdresser', 'beauty', 'supermarket', 'convenience', 'grocery'].includes(shop) && !['fitness_centre', 'sports_centre'].includes(leisure)) cell.places.otherBusinesses++
}

const cells = [...grid.values()].filter(cell => cell.polygon.length >= 4)
try {
  const previous = JSON.parse(await readFile(partialPath, 'utf8'))
  for (const feature of previous.features ?? []) {
    const cell = cells.find(candidate => candidate.id === feature.id)
    if (cell && Number.isFinite(feature.properties.population)) {
      cell.population = feature.properties.population
      cell.areaKm2 = feature.properties.areaKm2
    }
  }
} catch {}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
async function requestWithRetry(url, init, label) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(45_000) })
      if (response.ok) return response
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 4) {
        throw new Error(`${label}: ${response.status} ${response.statusText}`)
      }
      const retryAfter = Number(response.headers.get('retry-after'))
      await delay(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 3000 * (attempt + 1))
    } catch (error) {
      if (attempt === 4) throw error
      await delay(3000 * (attempt + 1))
    }
  }
  throw new Error(`${label}: retries exhausted`)
}

async function savePartial() {
  const partial = {
    type: 'FeatureCollection',
    metadata: { name: 'Pune population task checkpoint', source: 'WorldPop Global 2', populationYear, populationResolution, resolutionKm: radiusKm },
    features: cells.filter(cell => Number.isFinite(cell.population)).map(cell => ({
      type: 'Feature', id: cell.id,
      geometry: { type: 'Polygon', coordinates: [cell.polygon] },
      properties: { q: cell.q, r: cell.r, center: cell.center, resolutionKm: cell.resolutionKm, areaKm2: cell.areaKm2, population: cell.population },
    })),
  }
  await writeFile(partialPath, `${JSON.stringify(partial)}\n`, 'utf8')
}

const runTask = async cell => {
  if (Number.isFinite(cell.population)) return cell
  const response = await requestWithRetry(`${api}/population`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      geojson: { type: 'Polygon', coordinates: [cell.polygon] },
      year: populationYear,
      resolution: populationResolution,
    }),
  }, `WorldPop submit failed for ${cell.id}`)
  const submitted = await response.json()
  if (!submitted.task_id) throw new Error(`WorldPop did not return a task ID for ${cell.id}: ${JSON.stringify(submitted)}`)
  for (let attempt = 0; attempt < 30; attempt++) {
    await delay(1800)
    const statusResponse = await requestWithRetry(`${api}/tasks/${submitted.task_id}`, {}, `WorldPop status failed for ${cell.id}`)
    const status = await statusResponse.json()
    if (status.status === 'success') {
      cell.population = status.result.total_population
      cell.areaKm2 = status.result.area_km2
      return cell
    }
    if (status.status === 'failure') throw new Error(`WorldPop failed for ${cell.id}: ${status.error ?? 'unknown error'}`)
  }
  throw new Error(`WorldPop task timed out for ${cell.id}`)
}

let completed = 0
let cursor = 0
const workers = Array.from({ length: 2 }, async () => {
  while (cursor < cells.length) {
    const cell = cells[cursor++]
    await runTask(cell)
    completed++
    if (completed % 5 === 0 || completed === cells.length) {
      await savePartial()
      console.log(`Population summaries: ${completed}/${cells.length}`)
    }
  }
})
await Promise.all(workers)

const result = {
  type: 'FeatureCollection',
  metadata: {
    name: 'Pune pilot opportunity grid',
    placesSource: 'OpenStreetMap contributors via Overpass API',
    placesLicense: 'ODbL 1.0',
    populationSource: 'WorldPop Global 2',
    populationYear,
    populationResolution,
    populationLicense: 'CC BY 4.0; cite WorldPop Global 2',
    retrievedAt: new Date().toISOString(),
    bbox: [bbox.west, bbox.south, bbox.east, bbox.north],
    resolutionKm: radiusKm,
    note: 'Mapped-place completeness varies; population values are modeled estimates. Cell opportunity scores are computed in the client from the displayed inputs.',
  },
  features: cells.map(cell => ({
    type: 'Feature',
    id: cell.id,
    geometry: { type: 'Polygon', coordinates: [cell.polygon] },
    properties: {
      q: cell.q,
      r: cell.r,
      center: cell.center,
      resolutionKm: cell.resolutionKm,
      areaKm2: cell.areaKm2,
      population: cell.population,
      places: cell.places,
    },
  })),
}

await writeFile(outputPath, `${JSON.stringify(result)}\n`, 'utf8')
await savePartial()
console.log(`Saved ${cells.length} population-backed hexagons to ${outputPath}`)
