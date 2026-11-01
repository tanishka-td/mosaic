import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { cellArea, cellToBoundary, cellToChildren, cellToLatLng, cellToParent, latLngToCell } from 'h3-js'
import { ArrowRight, ChevronDown, CircleHelp, Compass, LocateFixed, MapPin, Search, SlidersHorizontal, Sparkles, Store, Target, X } from 'lucide-react'
const MapView = lazy(() => import('./MapView'))
type MapCell = import('./MapView').MapCell
type MapGrid = import('./MapView').MapGrid

type BusinessKind = { label: string; tag: string; group: string }
type AreaSuggestion = { label: string; center: [number, number] }
type MaharashtraGeometry = { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] }
const businessKinds: BusinessKind[] = [
  { label: 'All mapped places', tag: '*', group: 'Overview' },
  { label: 'Café', tag: 'amenity:cafe', group: 'Food & drink' }, { label: 'Restaurant', tag: 'amenity:restaurant', group: 'Food & drink' },
  { label: 'Fast food', tag: 'amenity:fast_food', group: 'Food & drink' }, { label: 'Bar', tag: 'amenity:bar', group: 'Food & drink' },
  { label: 'Pub', tag: 'amenity:pub', group: 'Food & drink' }, { label: 'Ice cream shop', tag: 'shop:ice_cream', group: 'Food & drink' },
  { label: 'Bakery', tag: 'shop:bakery', group: 'Food & drink' }, { label: 'Butcher', tag: 'shop:butcher', group: 'Food & drink' },
  { label: 'Supermarket', tag: 'shop:supermarket', group: 'Shopping & retail' }, { label: 'Convenience store', tag: 'shop:convenience', group: 'Shopping & retail' },
  { label: 'Clothing store', tag: 'shop:clothes', group: 'Shopping & retail' }, { label: 'Shoes', tag: 'shop:shoes', group: 'Shopping & retail' },
  { label: 'Jewellery', tag: 'shop:jewelry', group: 'Shopping & retail' }, { label: 'Electronics', tag: 'shop:electronics', group: 'Shopping & retail' },
  { label: 'Mobile phone shop', tag: 'shop:mobile_phone', group: 'Shopping & retail' }, { label: 'Computer shop', tag: 'shop:computer', group: 'Shopping & retail' },
  { label: 'Furniture', tag: 'shop:furniture', group: 'Shopping & retail' }, { label: 'Hardware', tag: 'shop:hardware', group: 'Shopping & retail' },
  { label: 'Books', tag: 'shop:books', group: 'Shopping & retail' }, { label: 'Stationery', tag: 'shop:stationery', group: 'Shopping & retail' },
  { label: 'Cosmetics', tag: 'shop:cosmetics', group: 'Shopping & retail' }, { label: 'Sports equipment', tag: 'shop:sports', group: 'Shopping & retail' },
  { label: 'Toys', tag: 'shop:toys', group: 'Shopping & retail' }, { label: 'Pet supplies', tag: 'shop:pet', group: 'Shopping & retail' },
  { label: 'Florist', tag: 'shop:florist', group: 'Shopping & retail' }, { label: 'Department store', tag: 'shop:department_store', group: 'Shopping & retail' },
  { label: 'Pharmacy', tag: 'amenity:pharmacy', group: 'Health & care' }, { label: 'Clinic', tag: 'healthcare:clinic', group: 'Health & care' },
  { label: 'Hospital', tag: 'amenity:hospital', group: 'Health & care' }, { label: 'Doctor', tag: 'healthcare:doctor', group: 'Health & care' },
  { label: 'Dentist', tag: 'healthcare:dentist', group: 'Health & care' }, { label: 'Optician', tag: 'shop:optician', group: 'Health & care' },
  { label: 'Veterinary clinic', tag: 'healthcare:veterinary', group: 'Health & care' }, { label: 'Medical laboratory', tag: 'healthcare:sample_collection', group: 'Health & care' },
  { label: 'Hair salon', tag: 'shop:hairdresser', group: 'Personal & professional services' }, { label: 'Beauty salon', tag: 'shop:beauty', group: 'Personal & professional services' },
  { label: 'Laundry', tag: 'shop:laundry', group: 'Personal & professional services' }, { label: 'Tailor', tag: 'shop:tailor', group: 'Personal & professional services' },
  { label: 'Bank', tag: 'amenity:bank', group: 'Personal & professional services' }, { label: 'ATM', tag: 'amenity:atm', group: 'Personal & professional services' },
  { label: 'Lawyer', tag: 'office:lawyer', group: 'Personal & professional services' }, { label: 'Accountant', tag: 'office:accountant', group: 'Personal & professional services' },
  { label: 'Real estate agency', tag: 'office:estate_agent', group: 'Personal & professional services' }, { label: 'Insurance', tag: 'office:insurance', group: 'Personal & professional services' },
  { label: 'Coworking space', tag: 'amenity:coworking_space', group: 'Personal & professional services' }, { label: 'Travel agency', tag: 'shop:travel_agency', group: 'Personal & professional services' },
  { label: 'Car repair', tag: 'shop:car_repair', group: 'Vehicle services' }, { label: 'Fuel station', tag: 'amenity:fuel', group: 'Vehicle services' },
  { label: 'Car wash', tag: 'amenity:car_wash', group: 'Vehicle services' }, { label: 'Driving school', tag: 'amenity:driving_school', group: 'Vehicle services' },
  { label: 'Fitness centre', tag: 'leisure:fitness_centre', group: 'Education, sport & leisure' }, { label: 'Sports centre', tag: 'leisure:sports_centre', group: 'Education, sport & leisure' },
  { label: 'School', tag: 'amenity:school', group: 'Education, sport & leisure' }, { label: 'College', tag: 'amenity:college', group: 'Education, sport & leisure' },
  { label: 'University', tag: 'amenity:university', group: 'Education, sport & leisure' }, { label: 'Childcare', tag: 'amenity:childcare', group: 'Education, sport & leisure' },
  { label: 'Hotel', tag: 'tourism:hotel', group: 'Travel & hospitality' }, { label: 'Motel', tag: 'tourism:motel', group: 'Travel & hospitality' },
  { label: 'Guest house', tag: 'tourism:guest_house', group: 'Travel & hospitality' }, { label: 'Hostel', tag: 'tourism:hostel', group: 'Travel & hospitality' },
  { label: 'Cinema', tag: 'amenity:cinema', group: 'Travel & hospitality' }, { label: 'Museum', tag: 'tourism:museum', group: 'Travel & hospitality' },
  { label: 'Tourist attraction', tag: 'tourism:attraction', group: 'Travel & hospitality' }, { label: 'Post office', tag: 'amenity:post_office', group: 'Other services' },
  { label: 'Marketplace', tag: 'amenity:marketplace', group: 'Other services' }, { label: 'Office', tag: 'office:*', group: 'Other services' },
  { label: 'Workshop / craft', tag: 'craft:*', group: 'Other services' }, { label: 'Other shop', tag: 'shop:*', group: 'Other services' },
]
const radii = [3, 10, 25, 60, 150]
const radiusResolution = [6, 5, 4, 3, 2]
const radiusFocusZoom = [11, 10, 9, 8, 7]
const placeSearchEndpoint = 'https://photon.komoot.io/api/'
const maharashtraCenter: [number, number] = [76.0, 19.4]
const maharashtraName = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const cities: Record<string, [number, number]> = {
  'Mumbai, Maharashtra': [72.8777, 19.076], 'Pune, Maharashtra': [73.8567, 18.5204], 'Nagpur, Maharashtra': [79.0882, 21.1458], 'Nashik, Maharashtra': [73.7898, 19.9975],
  'Thane, Maharashtra': [72.9781, 19.2183], 'Navi Mumbai, Maharashtra': [73.0297, 19.033], 'Kolhapur, Maharashtra': [74.2433, 16.705], 'Solapur, Maharashtra': [75.9064, 17.6599],
  'Amravati, Maharashtra': [77.7567, 20.9374], 'Nanded, Maharashtra': [77.3, 19.15], 'Jalgaon, Maharashtra': [75.5626, 21.0077], 'Sangli, Maharashtra': [74.5647, 16.8524],
  'Satara, Maharashtra': [74.0183, 17.6805], 'Akola, Maharashtra': [77.0082, 20.7002], 'Ahmednagar, Maharashtra': [74.748, 19.0948], 'Chhatrapati Sambhajinagar, Maharashtra': [75.3433, 19.8762],
}

const formatCount = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))
const kmBetween = (a: [number, number], b: [number, number]) => {
  const rad = Math.PI / 180, dLat = (b[1] - a[1]) * rad, dLon = (b[0] - a[0]) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}
const insideRing = (point: [number, number], ring: number[][]) => {
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
const insideMaharashtra = (point: [number, number], geometry: MaharashtraGeometry) => {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polygons.some(polygon => insideRing(point, polygon[0]) && !polygon.slice(1).some(hole => insideRing(point, hole)))
}
const percentileRanks = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const ranks = new Map<number, number>()
  for (let start = 0; start < sorted.length;) {
    let end = start + 1
    while (end < sorted.length && sorted[end] === sorted[start]) end++
    ranks.set(sorted[start], sorted.length < 2 ? 0.5 : ((start + end - 1) / 2) / (sorted.length - 1))
    start = end
  }
  return ranks
}
const sumCounts = (items: Array<Record<string, number> | null | undefined>) => {
  const result: Record<string, number> = {}
  for (const item of items) for (const [key, value] of Object.entries(item ?? {})) result[key] = (result[key] ?? 0) + value
  return result
}
const countFor = (cell: MapCell, tag: string) => {
  if (tag === '*') return cell.properties.mappedPlaces ?? 0
  const expected = tag.toLowerCase()
  return Object.entries(cell.properties.businessCounts ?? {}).reduce((sum, [key, value]) => {
    const actual = key.toLowerCase()
    return sum + (expected.endsWith(':*') ? (actual.startsWith(expected.slice(0, -1)) ? value : 0) : (actual === expected ? value : 0))
  }, 0)
}
const hasTagCoverage = (metadata: Record<string, unknown> | undefined, tag: string) => {
  if (tag === '*') return true
  const totals = metadata?.businessTagTotals as Record<string, number> | undefined
  if (!totals) return false
  const expected = tag.toLowerCase()
  if (expected.endsWith(':*')) return Object.entries(totals).some(([key, count]) => key.toLowerCase().startsWith(expected.slice(0, -1)) && count > 0)
  return Object.entries(totals).some(([key, count]) => key.toLowerCase() === expected && count > 0)
}

function buildGrid(base: MapGrid, resolution: number): MapGrid {
  const baseResolution = Number(base.metadata.h3Resolution ?? 4)
  let features: MapCell[]
  if (resolution === baseResolution) {
    features = base.features.map(cell => ({ ...cell, properties: { ...cell.properties } }))
  } else if (resolution > baseResolution) {
    features = []
    for (const parent of base.features) {
      const children = cellToChildren(parent.id, resolution)
      for (const child of children) {
        const areaKm2 = cellArea(child, 'km2')
        const share = areaKm2 / parent.properties.areaKm2
        const [lat, lon] = cellToLatLng(child)
        const ring = cellToBoundary(child, true)
        ring.push(ring[0])
        features.push({
          type: 'Feature', id: child,
          geometry: { type: 'Polygon', coordinates: [ring] },
          properties: { ...parent.properties, h3: child, resolution, center: [lon, lat], areaKm2, population: parent.properties.population * share, populationDensity: parent.properties.populationDensity, mappedPlaces: (parent.properties.mappedPlaces ?? 0) * share, businessCounts: Object.fromEntries(Object.entries(parent.properties.businessCounts ?? {}).map(([key, value]) => [key, value * share])) },
        })
      }
    }
  } else {
    const groups = new Map<string, MapCell[]>()
    for (const child of base.features) {
      const parent = cellToParent(child.id, resolution)
      const group = groups.get(parent) ?? []
      group.push(child)
      groups.set(parent, group)
    }
    features = [...groups].map(([id, children]) => {
      const areaKm2 = children.reduce((sum, child) => sum + child.properties.areaKm2, 0)
      const population = children.reduce((sum, child) => sum + child.properties.population, 0)
      const [lat, lon] = cellToLatLng(id)
      const ring = cellToBoundary(id, true)
      ring.push(ring[0])
      const expected = cellToChildren(id, baseResolution).length
      const covered = children.filter(child => child.properties.businessCoverage === true).length === expected
      return {
        type: 'Feature' as const, id, geometry: { type: 'Polygon' as const, coordinates: [ring] },
        properties: { h3: id, resolution, center: [lon, lat] as [number, number], areaKm2, population, populationDensity: population / Math.max(areaKm2, 0.01), mappedPlaces: children.reduce((sum, child) => sum + (child.properties.mappedPlaces ?? 0), 0), businessCounts: sumCounts(children.map(child => child.properties.businessCounts)), businessCoverage: covered },
      }
    })
  }

  return { ...base, metadata: { ...base.metadata, h3Resolution: resolution, featureCount: features.length }, features }
}

function scoreGrid(base: MapGrid, category: string): MapGrid {
  const features = base.features
  const covered = features.filter(cell => cell.properties.businessCoverage === true)
  const demand = covered.map(cell => cell.properties.population / Math.max(cell.properties.areaKm2, 0.01))
  const supply = covered.map(cell => countFor(cell, category) / Math.max(cell.properties.areaKm2, 0.01))
  const demandRanks = percentileRanks(demand)
  const supplyRanks = percentileRanks(supply)
  const categoryCovered = hasTagCoverage(base.metadata, category)
  const scoredFeatures = features.map(cell => {
    const demandDensity = cell.properties.population / Math.max(cell.properties.areaKm2, 0.01)
    const supplyDensity = countFor(cell, category) / Math.max(cell.properties.areaKm2, 0.01)
    const score = categoryCovered && cell.properties.businessCoverage ? Math.round((0.6 * (demandRanks.get(demandDensity) ?? 0.5) + 0.4 * (1 - (supplyRanks.get(supplyDensity) ?? 0.5))) * 100) : undefined
    return { ...cell, properties: { ...cell.properties, populationDensity: demandDensity, businessCoverage: categoryCovered && cell.properties.businessCoverage, score } }
  })
  return { ...base, features: scoredFeatures }
}

export default function App() {
  const [category, setCategory] = useState(businessKinds[1].tag)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [locationSuggestions, setLocationSuggestions] = useState<AreaSuggestion[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [maharashtraGeometry, setMaharashtraGeometry] = useState<MaharashtraGeometry | null>(null)
  // The 25 km default keeps the Maharashtra market readable at source resolution.
  const [radiusIndex, setRadiusIndex] = useState(2)
  const [baseGrid, setBaseGrid] = useState<MapGrid | null>(null)
  const [selected, setSelected] = useState<MapCell | null>(null)
  const [pinnedCenter, setPinnedCenter] = useState<[number, number] | null>(null)
  const [focusLocation, setFocusLocation] = useState<{ center: [number, number]; zoom: number; nonce: number } | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [showLayers, setShowLayers] = useState(false)
  const [showBusinesses, setShowBusinesses] = useState(true)
  const [showBoundaries, setShowBoundaries] = useState(true)
  const [pinMode, setPinMode] = useState(false)
  const [pinError, setPinError] = useState('')
  const [dataError, setDataError] = useState(false)

  useEffect(() => {
    fetch('/data/maharashtra-hexes.json').then(response => { if (!response.ok) throw new Error('Maharashtra market grid unavailable'); return response.json() as Promise<MapGrid> }).then(data => {
      const normalized = { ...data, features: data.features.map(cell => ({ ...cell, properties: { ...cell.properties, populationDensity: cell.properties.population / Math.max(cell.properties.areaKm2, 0.01) } })) }
      setBaseGrid(normalized)
      const covered = normalized.features.filter(cell => cell.properties.businessCoverage === true)
      const discovery = [...(covered.length ? covered : normalized.features)].sort((a, b) => b.properties.population / b.properties.areaKm2 - a.properties.population / a.properties.areaKm2)[0]
      if (discovery) setSelected(discovery)
    }).catch(() => setDataError(true))
  }, [])

  useEffect(() => {
    fetch('/data/maharashtra-boundary.geojson').then(response => { if (!response.ok) throw new Error('Maharashtra boundary unavailable'); return response.json() }).then(data => {
      const geometry = data.features?.[0]?.geometry as MaharashtraGeometry | undefined
      if (geometry) setMaharashtraGeometry(geometry)
    }).catch(() => setMaharashtraGeometry(null))
  }, [])

  const resolution = radiusResolution[radiusIndex]
  const geometryGrid = useMemo(() => baseGrid ? buildGrid(baseGrid, resolution) : null, [baseGrid, resolution])
  const grid = useMemo(() => geometryGrid ? scoreGrid(geometryGrid, category) : null, [geometryGrid, category])
  const currentSelected = useMemo(() => {
    if (!grid || !selected) return null
    const center = selected.properties.center
    const exact = center ? grid.features.find(cell => cell.id === latLngToCell(center[1], center[0], resolution)) : undefined
    return exact ?? grid.features.reduce<MapCell | null>((best, cell) => {
      if (!center || !cell.properties.center) return best
      return !best || kmBetween(center, cell.properties.center) < kmBetween(center, best.properties.center!) ? cell : best
    }, null)
  }, [grid, resolution, selected])
  const selectedCenter = currentSelected?.properties.center ?? selected?.properties.center ?? null
  const radiusKm = radii[radiusIndex]
  const nearby = selectedCenter && grid ? grid.features.filter(cell => cell.properties.center && kmBetween(selectedCenter, cell.properties.center) <= radiusKm) : []
  const nearbyPopulation = nearby.reduce((sum, cell) => sum + cell.properties.population, 0)
  const coveredNearby = nearby.filter(cell => cell.properties.businessCoverage === true)
  const categoryCovered = hasTagCoverage(baseGrid?.metadata, category)
  const nearbyBusinesses = categoryCovered ? coveredNearby.reduce((sum, cell) => sum + countFor(cell, category), 0) : 0
  const selectedCovered = currentSelected?.properties.businessCoverage === true && categoryCovered
  const score = currentSelected?.properties.score
  const tier = score === undefined ? 'No business coverage' : score > 76 ? 'High relative signal' : score > 52 ? 'Worth exploring' : 'Emerging signal'
  const selectedKind = businessKinds.find(kind => kind.tag === category) ?? businessKinds[0]
  const cityNames = useMemo(() => Object.keys(cities), [])
  const suggestions = useMemo(() => cityNames.filter(city => city.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 7), [cityNames, query])
  useEffect(() => {
    const text = query.trim()
    setLocationSuggestions([])
    if (text.length < 3) { setSearchLoading(false); return }
    setSearchLoading(true)
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setSearchLoading(true)
      const params = new URLSearchParams({ q: text, countrycode: 'IN', bbox: '72,15,81,22', lang: 'en', limit: '10' })
      fetch(`${placeSearchEndpoint}?${params}`, { signal: controller.signal })
        .then(response => { if (!response.ok) throw new Error('Place search unavailable'); return response.json() })
        .then(payload => {
          const features = payload.features ?? []
          setLocationSuggestions(features.flatMap((feature: { properties?: { name?: string; city?: string; district?: string; state?: string; countrycode?: string }; geometry?: { coordinates?: [number, number] } }) => {
            const props = feature.properties ?? {}
            const center = feature.geometry?.coordinates
            if (!props.name || !center || (props.countrycode && props.countrycode.toUpperCase() !== 'IN') || (props.state && maharashtraName(props.state) !== 'maharashtra')) return []
            if (maharashtraGeometry ? !insideMaharashtra(center, maharashtraGeometry) : !props.state) return []
            const label = [props.name, props.district ?? props.city, props.state].filter((part, index, all) => part && all.indexOf(part) === index).join(', ')
            return [{ label, center }]
          }))
        }).catch(error => { if (error.name !== 'AbortError') setLocationSuggestions([]) })
        .finally(() => { if (!controller.signal.aborted) setSearchLoading(false) })
    }, 350)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [query, maharashtraGeometry])

  const chooseCoordinates = (name: string, center: [number, number]) => {
    setPinError('')
    setQuery(name)
    setLocationSuggestions([])
    setSearchOpen(false)
    setPinMode(false)
    setPinnedCenter(null)
    setFocusLocation({ center, zoom: radiusFocusZoom[radiusIndex], nonce: Date.now() })
    if (grid) {
      const id = latLngToCell(center[1], center[0], resolution)
      setSelected(grid.features.find(cell => cell.id === id) ?? grid.features.reduce<MapCell | null>((best, cell) => !cell.properties.center || !best || kmBetween(center, cell.properties.center) < kmBetween(center, best.properties.center!) ? cell : best, null))
    }
  }

  const selectPinnedLocation = (center: [number, number]) => {
    const id = latLngToCell(center[1], center[0], resolution)
    const cell = grid?.features.find(item => item.id === id)
    const isInsideState = maharashtraGeometry ? insideMaharashtra(center, maharashtraGeometry) : Boolean(cell)
    if (!grid || !isInsideState) {
      setPinError('Choose a point inside Maharashtra to explore this market.')
      return
    }
    setPinError('')
    setPinnedCenter(center)
    setPinMode(false)
    setSelected(cell ?? grid.features.reduce<MapCell | null>((best, item) => !item.properties.center || !best || kmBetween(center, item.properties.center) < kmBetween(center, best.properties.center!) ? item : best, null))
    setFocusLocation({ center, zoom: radiusFocusZoom[radiusIndex], nonce: Date.now() })
  }

  const togglePinMode = () => {
    setPinError('')
    setSearchOpen(false)
    setLocationSuggestions([])
    setPinMode(value => !value)
  }

  const handleSelectCell = (cell: MapCell) => {
    setPinnedCenter(null)
    setSelected(cell)
  }

  useEffect(() => {
    if (!pinMode) return
    const cancelPin = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setPinMode(false); setPinError('') }
    }
    window.addEventListener('keydown', cancelPin)
    return () => window.removeEventListener('keydown', cancelPin)
  }, [pinMode])

  const categoryGroups = [...new Set(businessKinds.map(kind => kind.group))]
  const displayedSuggestions: AreaSuggestion[] = locationSuggestions.length
    ? locationSuggestions
    : suggestions.map(label => ({ label, center: cities[label] }))

  return <main className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Mosaic home"><span className="brand-mark"><i/><i/><i/><i/></span><span>mosaic<span className="brand-period">.</span></span></a>
      <nav className="top-nav"><a className="active" href="#explore">Explore Maharashtra</a><a href="#how" onClick={event => { event.preventDefault(); setHelpOpen(true) }}>How it works</a></nav>
    </header>

    <section className="hero" id="top">
      <div className="hero-copy"><div className="eyebrow"><Sparkles size={13}/> MAHARASHTRA MARKET INTELLIGENCE</div>
        <h1>Find opportunity<br/>in the <em>bigger picture.</em></h1>
      </div>
      <div className="search-card">
        <label htmlFor="business-search">Choose a business type and search an area</label>
        <div className="search-row">
          <div className="category-picker"><Store size={17}/><select value={category} onChange={event => setCategory(event.target.value)} aria-label="Business type">{categoryGroups.map(group => <optgroup key={group} label={group}>{businessKinds.filter(kind => kind.group === group).map(kind => <option key={kind.tag} value={kind.tag}>{kind.label}</option>)}</optgroup>)}</select><ChevronDown size={15}/></div>
          <div className="search-wrap"><Search size={17}/><input id="business-search" value={query} onChange={event => { setQuery(event.target.value); setSearchOpen(true) }} onFocus={() => setSearchOpen(true)} placeholder="Search a Maharashtra city or area" />{query && <button className="clear-search" onClick={() => setQuery('')} aria-label="Clear search"><X size={14}/></button>}
            {searchOpen && query && <div className="suggestions">{displayedSuggestions.length ? displayedSuggestions.map((item, index) => <button key={`${item.label}-${index}`} onClick={() => chooseCoordinates(item.label, item.center)}><MapPin size={15}/>{item.label}</button>) : <div className="no-match">{searchLoading ? 'Searching Maharashtra places…' : 'No matching place. Try a Maharashtra city or pin the map.'}</div>}<div className="search-attribution">Place search: Photon · © OpenStreetMap contributors</div></div>}
          </div>
          <button className="explore-button" onClick={() => displayedSuggestions[0] && chooseCoordinates(displayedSuggestions[0].label, displayedSuggestions[0].center)}>Explore <ArrowRight size={16}/></button>
        </div>
        <div className="quick-picks"><span>Popular</span>{['amenity:cafe','amenity:restaurant','shop:supermarket','shop:clothes'].map(tag => { const kind = businessKinds.find(item => item.tag === tag)!; return <button key={tag} className={category === tag ? 'picked' : ''} onClick={() => setCategory(tag)}>{kind.label}</button> })}</div>
      </div>
    </section>

    <section className="discovery" id="explore">
      <div className="section-heading"><div><div className="eyebrow muted"><span className="pulse"/> MAHARASHTRA · {grid ? `${grid.features.length.toLocaleString('en-IN')} HEXAGONS` : 'LOADING'}</div><h2>Explore the market</h2></div><div className="mode-toggle"><button className="selected" onClick={() => { setPinnedCenter(null); setPinError(''); setPinMode(false); setFocusLocation({ center: maharashtraCenter, zoom: 5.5, nonce: Date.now() }) }}><span className="tiny-hex">⬡</span> Reset map</button><button onClick={togglePinMode} className={pinMode ? 'selected' : ''}><LocateFixed size={14}/>{pinMode ? 'Cancel pin' : 'Pin an area'}</button></div></div>
      <div className="workspace">
        <div className="map-card map-card-live">
          <div className="map-topline"><div className="map-location"><span className="india-flag">MH</span><span>{pinError || (pinnedCenter ? 'Pinned location' : currentSelected ? (selectedCovered ? 'Business-covered hexagon' : 'Selected hexagon') : 'Maharashtra')}</span></div><div className="map-controls"><button onClick={() => setShowLayers(!showLayers)} className={showLayers ? 'control-active' : ''}><SlidersHorizontal size={15}/> Layers</button></div></div>
          {showLayers && <div className="layer-menu"><strong>Map layers</strong><label><input type="checkbox" checked={showBusinesses} onChange={event => setShowBusinesses(event.target.checked)}/> Market hexagons</label><label><input type="checkbox" checked={showBoundaries} onChange={event => setShowBoundaries(event.target.checked)}/> Maharashtra boundary and label</label></div>}
          <div className="map-area map-area-live"><Suspense fallback={<div className="map-loading">Loading Maharashtra’s map…</div>}><MapView grid={grid} selectedCell={currentSelected?.id ?? null} onSelect={handleSelectCell} focusLocation={focusLocation} pinMode={pinMode} pinnedCenter={pinnedCenter} showBusinessLayer={showBusinesses} showBoundaries={showBoundaries} onPin={selectPinnedLocation}/></Suspense><div className="map-chip"><span className="live-dot"/> {selectedCovered ? `${selectedKind.label.toUpperCase()} · RELATIVE INDEX` : 'MAHARASHTRA MARKET GRID'} <span className="demo-tag">{selectedCovered ? 'SOURCED' : 'MAPPED DATA'}</span></div><div className={`map-hint ${pinMode ? 'pin-instruction' : ''}`}>{pinError || (pinMode ? 'Click inside Maharashtra to drop a pin · Esc to cancel' : 'Drag to pan · Scroll to zoom · Click a hexagon to inspect')}</div></div>
          <div className="map-legend"><span>Lower signal</span><div className="legend-gradient"/><span>Higher signal</span><button title="About this map" onClick={() => setHelpOpen(true)}><CircleHelp size={14}/></button></div>
        </div>
        <aside className="insight-column">
          <div key={currentSelected?.id ?? 'none'} className="insight-card featured insight-enter"><div className="card-overline"><span><Sparkles size={13}/> {selectedCovered ? 'MARKET CELL' : 'POPULATION GRID CELL'}</span></div><div className="place-heading"><div><div className="place-name">{currentSelected ? 'Selected area' : 'Choose a hexagon'}</div><div className="place-sub">{selectedKind.label} · {currentSelected ? `H3 resolution ${resolution}` : 'Select a map cell'}</div></div></div><div className="potential-row"><div><span className="potential-value">{selectedCovered ? score : '—'}</span><span className="potential-outof">{selectedCovered ? '/100' : ''}</span></div><span className="potential-pill"><span/> {tier}</span></div><div className="score-track"><span style={{width:`${selectedCovered ? score : 0}%`}}/></div><p className="score-caption">{selectedCovered ? `Relative comparison for ${selectedKind.label.toLowerCase()}: population density (60%) and inverse business density (40%).` : 'Population estimates are available. This area has no verified business coverage, so it is not ranked.'}</p><div className="divider"/><div className="metrics"><div><span className="metric-icon green"><Target size={15}/></span><span className="metric-name">Estimated residents · {radiusKm} km radius</span><strong>{formatCount(nearbyPopulation)}</strong></div><div><span className="metric-icon peach"><Store size={15}/></span><span className="metric-name">Mapped {selectedKind.label.toLowerCase()} · {categoryCovered ? `${coveredNearby.length} covered hexes` : 'category not in source snapshot'}</span><strong>{categoryCovered && coveredNearby.length ? formatCount(nearbyBusinesses) : 'Not sourced here'}</strong></div><div><span className="metric-icon blue"><Compass size={15}/></span><span className="metric-name">Hexagon size · H3 {resolution}</span><strong>{currentSelected ? `${currentSelected.properties.areaKm2.toFixed(1)} km²` : '—'}</strong></div></div><button className="save-button" onClick={() => currentSelected && setFocusLocation({ center: currentSelected.properties.center!, zoom: radiusFocusZoom[radiusIndex], nonce: Date.now() })}>Center selected area <ArrowRight size={15}/></button></div>
          <div className="radius-card"><div className="radius-title"><div><strong>Area radius &amp; hex size</strong><span>Adjusts the search area and map detail</span></div><span className="radius-value">{radiusKm} <small>km</small></span></div><input type="range" min="0" max={radii.length - 1} value={radiusIndex} onChange={event => setRadiusIndex(Number(event.target.value))} aria-label="Adjust area radius and hex size"/><div className="range-labels"><span>Local · smaller hexes</span><span>Regional · larger hexes</span></div></div>
        </aside>
      </div>
      <div className="bottom-note"><span><i className="note-dot"/> DATA NOTE</span><p>{dataError ? 'The Maharashtra market grid could not be loaded.' : 'Population is modeled; business counts reflect OpenStreetMap mapping and may be incomplete.'}</p><button onClick={() => setHelpOpen(!helpOpen)}>How it works <ArrowRight size={14}/></button></div>
      {helpOpen && <div className="how-panel" id="how"><button onClick={() => setHelpOpen(false)} className="close-how" aria-label="Close"><X size={16}/></button><strong>How Mosaic’s Maharashtra map works</strong><p>The map uses one English-language label set and shows Maharashtra market data only. The radius control also changes H3 resolution: smaller areas show finer hexagons, wider areas use larger hexagons. Fine cells allocate population and business counts proportionally from the source grid, so they are estimates rather than directly observed local counts. Business categories reflect what OpenStreetMap contributors have mapped.</p><p className="how-caveat">Population is modeled. Scores compare mapped business density with estimated population density inside Maharashtra; they are relative signals, not sales forecasts or a complete business census.</p></div>}
    </section>
    
  </main>
}
