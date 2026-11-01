import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, 'data/raw/india-pop-2025-1km.tif')
const itemUrl = 'https://api.stac.worldpop.org/collections/IND/items/ind_pop_2025_CN_1km_R2025A_UA_v1'
const metadataResponse = await fetch(itemUrl, { signal: AbortSignal.timeout(30_000) })
if (!metadataResponse.ok) throw new Error(`WorldPop STAC metadata failed: ${metadataResponse.status}`)
const item = await metadataResponse.json()
const assetUrl = item.assets?.data?.href
if (!assetUrl) throw new Error('WorldPop STAC item did not include the raster asset URL')

await mkdir(dirname(output), { recursive: true })
const response = await fetch(assetUrl, { signal: AbortSignal.timeout(180_000) })
if (!response.ok || !response.body) throw new Error(`WorldPop raster download failed: ${response.status}`)
await pipeline(Readable.fromWeb(response.body), createWriteStream(output))
console.log(`Saved ${item.id} (${item.assets.data.description}) to ${output}`)
