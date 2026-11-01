import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = process.cwd()
const outputDir = resolve(root, 'data/raw')
const apiRoot = 'https://www.geoboundaries.org/api/current/gbOpen/IND'

await mkdir(outputDir, { recursive: true })

for (const level of ['ADM0', 'ADM1']) {
  const metadataResponse = await fetch(`${apiRoot}/${level}/`, { signal: AbortSignal.timeout(60_000) })
  if (!metadataResponse.ok) throw new Error(`geoBoundaries ${level} metadata failed: ${metadataResponse.status}`)
  const metadata = await metadataResponse.json()
  const geoJsonUrl = metadata.simplifiedGeometryGeoJSON || metadata.gjDownloadURL
  if (!geoJsonUrl) throw new Error(`geoBoundaries did not return a GeoJSON URL for ${level}`)
  const geoJsonResponse = await fetch(geoJsonUrl, { signal: AbortSignal.timeout(120_000) })
  if (!geoJsonResponse.ok) throw new Error(`geoBoundaries ${level} geometry failed: ${geoJsonResponse.status}`)
  const geometry = await geoJsonResponse.json()
  const output = {
    ...geometry,
    metadata: {
      provider: 'geoBoundaries',
      release: 'gbOpen',
      boundaryId: metadata.boundaryID,
      boundaryName: metadata.boundaryName,
      boundaryYear: metadata.boundaryYearRepresented ?? metadata.yearRepresented,
      source: metadata.source,
      license: 'CC BY 4.0; attribution required',
      attribution: 'geoBoundaries (gbOpen)',
      retrievedAt: new Date().toISOString(),
      sourceMetadataUrl: `${apiRoot}/${level}/`,
    },
  }
  await writeFile(resolve(outputDir, `india-${level.toLowerCase()}.geojson`), `${JSON.stringify(output)}\n`, 'utf8')
  console.log(`${level}: saved ${output.features?.length ?? 1} boundary feature(s)`)
}
