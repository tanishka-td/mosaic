import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = resolve(root, 'public/data')
const outputFile = resolve(outputDir, 'pune-places.geojson')
const bbox = '18.40,73.72,18.64,73.98' // south, west, north, east; central Pune pilot extent
const endpoint = process.env.OVERPASS_URL ?? 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'

// Include business and public-service tags so the same source can support
// different user-selected business categories and surrounding context.
const query = `[out:json][timeout:45];
(
  nwr["shop"](${bbox});
  nwr["amenity"](${bbox});
  nwr["office"](${bbox});
  nwr["craft"](${bbox});
  nwr["leisure"~"fitness_centre|sports_centre"](${bbox});
);
out center tags;`

const response = await fetch(endpoint, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
  body: new URLSearchParams({ data: query }),
  signal: AbortSignal.timeout(90_000),
})

if (!response.ok) {
  const retryAfter = response.headers.get('retry-after')
  throw new Error(`Overpass request failed (${response.status} ${response.statusText})${retryAfter ? `; retry after ${retryAfter}` : ''}. Try again later or set OVERPASS_URL to an approved Overpass endpoint.`)
}

const payload = await response.json()
const retrievedAt = new Date().toISOString()
const features = (payload.elements ?? []).flatMap(element => {
  const lat = element.lat ?? element.center?.lat
  const lon = element.lon ?? element.center?.lon
  if (typeof lat !== 'number' || typeof lon !== 'number') return []
  return [{
    type: 'Feature',
    id: `osm-${element.type}-${element.id}`,
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: { osmType: element.type, osmId: element.id, tags: element.tags ?? {} },
  }]
})

const collection = {
  type: 'FeatureCollection',
  metadata: {
    name: 'Pune pilot business and amenity places',
    source: 'OpenStreetMap contributors via Overpass API',
    endpoint,
    sourceUrl: 'https://www.openstreetmap.org/copyright',
    license: 'Open Database License (ODbL) 1.0',
    attribution: '© OpenStreetMap contributors',
    retrievedAt,
    bbox: [73.72, 18.40, 73.98, 18.64],
    note: 'Community-mapped features; completeness varies by location and category.',
  },
  features,
}

await mkdir(outputDir, { recursive: true })
await writeFile(outputFile, `${JSON.stringify(collection)}\n`, 'utf8')
console.log(`Saved ${features.length} mapped places to ${outputFile}`)
