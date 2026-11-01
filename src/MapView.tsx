import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { Map as MapLibreMap } from 'maplibre-gl'

maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs')

export type MapCell = {
  type: 'Feature'
  id: string
  geometry: { type: 'Polygon'; coordinates: number[][][] }
  properties: {
    h3: string
    resolution: number
    areaKm2: number
    population: number
    populationDensity?: number
    businessCounts: Record<string, number> | null
    mappedPlaces?: number
    score?: number
    businessCoverage?: boolean
    center?: [number, number]
  }
}
export type MapGrid = { type: 'FeatureCollection'; metadata: Record<string, unknown>; features: MapCell[] }

type Props = {
  grid: MapGrid | null
  selectedCell: string | null
  onSelect: (cell: MapCell) => void
  focusLocation: { center: [number, number]; zoom: number; nonce: number } | null
  pinMode: boolean
  pinnedCenter: [number, number] | null
  showBusinessLayer: boolean
  showBoundaries: boolean
  onPin: (center: [number, number]) => void
}

// OpenFreeMap's Liberty style supplies the streets, localities, and city labels.
// Rewrite map labels to prefer an English name, then a Latin-script fallback.
const basemapStyle = 'https://tiles.openfreemap.org/styles/liberty'
const emptyGrid: MapGrid = { type: 'FeatureCollection', metadata: {}, features: [] }
const maharashtraLabel: Array<[string, number, number]> = [['MAHARASHTRA', 76.1, 19.6]]

export default function MapView({ grid, selectedCell, onSelect, focusLocation, pinMode, pinnedCenter, showBusinessLayer, showBoundaries, onPin }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const [ready, setReady] = useState(false)
  const [mapError, setMapError] = useState(false)
  const selectRef = useRef(onSelect)
  const pinRef = useRef(onPin)
  const pinModeRef = useRef(pinMode)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const gridRef = useRef(grid)
  const selectedRef = useRef<string | null>(null)
  selectRef.current = onSelect
  pinRef.current = onPin
  pinModeRef.current = pinMode
  gridRef.current = grid

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: basemapStyle,
      transformStyle: (_previous, next) => ({
        ...next,
        layers: next.layers.map(layer => {
          if (layer.type !== 'symbol' || !layer.layout || !('text-field' in layer.layout)) return layer
          return {
            ...layer,
            layout: {
              ...layer.layout,
              'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']],
            },
          }
        }),
      }),
      center: [76.0, 19.4], zoom: 5.5, minZoom: 4.4, maxZoom: 16,
      maxBounds: [[68, 8], [88, 29]], attributionControl: {},
      cooperativeGestures: false, dragPan: { linearity: 0.25, easing: t => 1 - Math.pow(1 - t, 2), maxSpeed: 1400, deceleration: 2500 }, scrollZoom: true, touchZoomRotate: true,
      fadeDuration: 180, renderWorldCopies: false,
      dragRotate: false, pitchWithRotate: false,
    })
    let styleDidLoad = false
    const basemapTimeout = window.setTimeout(() => {
      if (!styleDidLoad) setMapError(true)
    }, 15000)
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.on('style.load', () => {
      styleDidLoad = true
      window.clearTimeout(basemapTimeout)
      setMapError(false)
    })
    map.on('load', () => {
      window.clearTimeout(basemapTimeout)
      setMapError(false)
      setReady(true)
    })
    map.on('click', event => {
      if (pinModeRef.current) return
      const feature = map.queryRenderedFeatures(event.point, { layers: ['india-hex-fill'] })[0]
      if (!feature) return
      const h3 = String(feature.properties?.h3 ?? '')
      const selected = (gridRef.current ?? emptyGrid).features.find(cell => cell.id === h3 || cell.properties.h3 === h3)
      if (selected) selectRef.current(selected)
    })
    mapRef.current = map
    return () => { window.clearTimeout(basemapTimeout); map.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || map.getSource('india-hexes')) return
    map.addSource('india-hexes', { type: 'geojson', data: (gridRef.current ?? emptyGrid) as never, promoteId: 'h3', maxzoom: 8, buffer: 16, tolerance: 0.35 })
    const firstLabelLayer = map.getStyle().layers.find(layer => layer.type === 'symbol')?.id
    map.addLayer({
      id: 'india-hex-fill', type: 'fill', source: 'india-hexes',
      paint: {
        'fill-color': ['case', ['==', ['get', 'businessCoverage'], true], ['interpolate', ['linear'], ['get', 'score'], 0, '#c9d9a9', 40, '#a9c58f', 70, '#f0d28f', 100, '#df9b7c'], ['interpolate', ['linear'], ['get', 'populationDensity'], 0, '#dce6d2', 10, '#c9d9a9', 80, '#a9c58f', 500, '#ead39b', 1500, '#df9b7c']],
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 2, 0.68, 6, 0.62, 9, 0.48, 12, 0.3, 15, 0.16],
      },
    }, firstLabelLayer)
    map.addLayer({ id: 'india-hex-outline', type: 'line', source: 'india-hexes', paint: {
      'line-color': '#fffdf7',
      'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.8, 7, 0.9, 10, 0.75, 14, 0.55],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 2, 0.82, 8, 0.78, 11, 0.64, 14, 0.42],
    } }, firstLabelLayer)
    map.addSource('selected-hex', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addLayer({ id: 'selected-hex-outline', type: 'line', source: 'selected-hex', paint: { 'line-color': '#172b1e', 'line-width': 3.4, 'line-opacity': 1 } }, firstLabelLayer)
    map.on('mouseenter', 'india-hex-fill', () => { map.getCanvas().style.cursor = pinModeRef.current ? 'crosshair' : 'pointer' })
    map.on('mouseleave', 'india-hex-fill', () => { map.getCanvas().style.cursor = pinModeRef.current ? 'crosshair' : '' })
    map.addSource('maharashtra-boundary', { type: 'geojson', data: '/data/maharashtra-boundary.geojson' })
    map.addLayer({ id: 'maharashtra-boundary-line', type: 'line', source: 'maharashtra-boundary', paint: { 'line-color': '#536e58', 'line-width': 2, 'line-opacity': 0.9 } }, firstLabelLayer)
    const labels = maharashtraLabel.map(([name, lon, lat]) => {
      const element = document.createElement('div')
      element.className = 'map-state-label'
      element.textContent = name
      element.setAttribute('aria-hidden', 'true')
      return new maplibregl.Marker({ element, anchor: 'center' }).setLngLat([lon, lat]).addTo(map)
    })
    map.on('zoom', () => {
      const visible = map.getZoom() < 7.2
      for (const marker of labels) marker.getElement().style.display = visible ? '' : 'none'
    })
  }, [ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const source = map.getSource('india-hexes') as maplibregl.GeoJSONSource | undefined
    if (grid) source?.setData(grid as never)
  }, [grid, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    for (const id of ['india-hex-fill', 'india-hex-outline']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', showBusinessLayer ? 'visible' : 'none')
    if (map.getLayer('maharashtra-boundary-line')) map.setLayoutProperty('maharashtra-boundary-line', 'visibility', showBoundaries ? 'visible' : 'none')
  }, [showBusinessLayer, showBoundaries, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    if (selectedRef.current) map.setFeatureState({ source: 'india-hexes', id: selectedRef.current }, { selected: false })
    if (selectedCell) map.setFeatureState({ source: 'india-hexes', id: selectedCell }, { selected: true })
    selectedRef.current = selectedCell
    const selectedSource = map.getSource('selected-hex') as maplibregl.GeoJSONSource | undefined
    const feature = selectedCell ? grid?.features.find(cell => cell.id === selectedCell) : undefined
    selectedSource?.setData({ type: 'FeatureCollection', features: feature ? [feature] : [] } as never)
  }, [grid, ready, selectedCell])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    if (pinnedCenter) {
      if (!markerRef.current) markerRef.current = new maplibregl.Marker({ color: '#e06a48' }).setLngLat(pinnedCenter).addTo(map)
      else markerRef.current.setLngLat(pinnedCenter)
    } else if (markerRef.current) {
      markerRef.current.remove()
      markerRef.current = null
    }
  }, [pinnedCenter, ready])

  useEffect(() => {
    const map = mapRef.current
    if (map && ready && focusLocation) map.easeTo({ center: focusLocation.center, zoom: focusLocation.zoom, duration: 1100, easing: t => t * (2 - t), essential: true })
  }, [focusLocation?.nonce, ready])

  return <div className={`maplibre-shell ${pinMode ? 'pin-mode' : ''}`} onClickCapture={event => {
    if (!pinModeRef.current || (event.target as HTMLElement).closest('.maplibregl-ctrl')) return
    const map = mapRef.current
    if (!map) return
    event.preventDefault()
    event.stopPropagation()
    const bounds = event.currentTarget.getBoundingClientRect()
    const point = map.unproject([event.clientX - bounds.left, event.clientY - bounds.top])
    pinRef.current([point.lng, point.lat])
  }}><div ref={containerRef} className="maplibre-canvas" aria-label="Interactive English-language map of Maharashtra" />{!grid && <div className="map-loading">Loading Maharashtra’s market grid…</div>}{mapError && <div className="map-basemap-error">Street and locality detail needs an internet connection. Mosaic’s market grid is still available.</div>}</div>
}
