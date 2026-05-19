'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Map, { NavigationControl, Source, Layer } from 'react-map-gl/maplibre'
import { latLngToCell, cellToBoundary, cellToLatLng } from 'h3-js'
import 'maplibre-gl/dist/maplibre-gl.css'

interface UserLocation {
  lat: number
  lon: number
  city: string
}

interface HexWeather {
  hexId: string
  loading: boolean
  error: boolean
  intervals: { time: string; precipProbability: number; precipIntensity: number }[]
}

const H3_RESOLUTION = 8
const MAX_SELECTED = 5

function getViewportHexagons(bounds: {
  north: number
  south: number
  east: number
  west: number
}): string[] {
  const { north, south, east, west } = bounds
  const hexSet = new Set<string>()
  const steps = 40

  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      const lat = south + (north - south) * (i / steps)
      const lng = west + (east - west) * (j / steps)
      hexSet.add(latLngToCell(lat, lng, H3_RESOLUTION))
    }
  }

  return Array.from(hexSet)
}

function hexesToGeoJSON(
  hexIds: string[],
  selectedIds: Set<string>
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: hexIds.map(id => {
      const boundary = cellToBoundary(id)
      return {
        type: 'Feature',
        id,
        properties: { selected: selectedIds.has(id) },
        geometry: {
          type: 'Polygon',
          coordinates: [[...boundary.map(([lat, lng]) => [lng, lat]), [boundary[0][1], boundary[0][0]]]],
        },
      }
    }),
  }
}

export default function RainMap() {
  const mapRef = useRef<any>(null)
  const [location, setLocation] = useState<UserLocation | null>(null)
  const [loading, setLoading] = useState(true)
  const [hexIds, setHexIds] = useState<string[]>([])
  const [selectedHexes, setSelectedHexes] = useState<Set<string>>(new Set())
  const [hexWeather, setHexWeather] = useState<Record<string, HexWeather>>({})
  const [limitWarning, setLimitWarning] = useState(false)

  useEffect(() => {
    fetch('/api/location')
      .then(r => r.json())
      .then(data => { setLocation(data); setLoading(false) })
      .catch(() => { setLocation({ lat: 39.5, lon: -98.35, city: 'United States' }); setLoading(false) })
  }, [])

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('selectedHexes')
      if (saved) {
        const parsed: string[] = JSON.parse(saved)
        setSelectedHexes(new Set(parsed))
      }
    } catch {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Save to localStorage whenever selection changes
  useEffect(() => {
    try {
      localStorage.setItem('selectedHexes', JSON.stringify(Array.from(selectedHexes)))
    } catch {}
  }, [selectedHexes])

  const updateHexes = useCallback(() => {
    if (!mapRef.current) return
    const map = mapRef.current.getMap()
    const bounds = map.getBounds()
    const hexes = getViewportHexagons({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    })
    setHexIds(hexes)
  }, [])

  const fetchWeather = useCallback(async (hexId: string, lat: number, lon: number) => {
    setHexWeather(prev => ({
      ...prev,
      [hexId]: { hexId, loading: true, error: false, intervals: [] }
    }))

    try {
      const res = await fetch(`/api/nowcast?lat=${lat}&lon=${lon}`)
      const data = await res.json()
      setHexWeather(prev => ({
        ...prev,
        [hexId]: { hexId, loading: false, error: false, intervals: data.intervals }
      }))
    } catch {
      setHexWeather(prev => ({
        ...prev,
        [hexId]: { hexId, loading: false, error: true, intervals: [] }
      }))
    }
  }, [])

  const handleMapClick = useCallback((e: any) => {
    const { lng, lat } = e.lngLat
    const hexId = latLngToCell(lat, lng, H3_RESOLUTION)

    setSelectedHexes(prev => {
      if (prev.has(hexId)) {
        const next = new Set(prev)
        next.delete(hexId)
        setHexWeather(pw => { const n = { ...pw }; delete n[hexId]; return n })
        return next
      }

      if (prev.size >= MAX_SELECTED) {
        setLimitWarning(true)
        setTimeout(() => setLimitWarning(false), 2000)
        return prev
      }

      const next = new Set(prev)
      next.add(hexId)
      const [hLat, hLon] = cellToLatLng(hexId)
      fetchWeather(hexId, hLat, hLon)
      return next
    })
  }, [fetchWeather])

  const removeHex = useCallback((hexId: string) => {
    setSelectedHexes(prev => { const n = new Set(prev); n.delete(hexId); return n })
    setHexWeather(prev => { const n = { ...prev }; delete n[hexId]; return n })
  }, [])

  // Fetch weather for restored hexes once fetchWeather is ready
  useEffect(() => {
    if (selectedHexes.size === 0) return
    selectedHexes.forEach(hexId => {
      if (!hexWeather[hexId]) {
        const [lat, lon] = cellToLatLng(hexId)
        fetchWeather(hexId, lat, lon)
      }
    })
  }, [fetchWeather]) // eslint-disable-line react-hooks/exhaustive-deps

  const geoJSON = hexesToGeoJSON(hexIds, selectedHexes)

  const selectedCentroids = Array.from(selectedHexes).map(id => {
    const [lat, lon] = cellToLatLng(id)
    return { id, lat, lon }
  })

  if (loading) return (
    <div className="w-full h-screen flex items-center justify-center bg-gray-950 text-white">
      Locating...
    </div>
  )

  return (
    <div className="w-full h-screen relative">
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: location!.lon,
          latitude: location!.lat,
          zoom: location!.city === 'United States' ? 4 : 10,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="https://tiles.openfreemap.org/styles/dark"
        onClick={handleMapClick}
        onLoad={updateHexes}
        onMoveEnd={updateHexes}
        doubleClickZoom={false}
      >
        <NavigationControl position="top-right" />

        <Source id="hexes" type="geojson" data={geoJSON}>
          <Layer
            id="hex-fill"
            type="fill"
            paint={{
              'fill-color': [
                'case',
                ['==', ['get', 'selected'], true], '#3b82f6',
                'transparent'
              ],
              'fill-opacity': 0.35,
            }}
          />
          <Layer
            id="hex-stroke"
            type="line"
            paint={{
              'line-color': [
                'case',
                ['==', ['get', 'selected'], true], '#60a5fa',
                'rgba(255,255,255,0.08)'
              ],
              'line-width': 1,
            }}
          />
        </Source>
      </Map>

      {limitWarning && (
        <div style={{
          position: 'absolute',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(239,68,68,0.9)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: 8,
          fontSize: 13,
          zIndex: 20,
        }}>
          Max {MAX_SELECTED} zones allowed
        </div>
      )}

      {selectedCentroids.length === 0 && (
        <div style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          background: 'rgba(0,0,0,0.7)',
          color: 'rgba(255,255,255,0.5)',
          padding: '8px 14px',
          borderRadius: 8,
          fontSize: 12,
          zIndex: 10,
        }}>
          Zoom in and click hexagons to select zones
        </div>
      )}

      {selectedCentroids.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          background: 'rgba(0,0,0,0.85)',
          color: 'white',
          padding: '12px 16px',
          borderRadius: 10,
          fontSize: 13,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 10,
          maxWidth: 300,
          maxHeight: '60vh',
          overflowY: 'auto',
        }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
            {selectedCentroids.length}/{MAX_SELECTED} zones selected
          </span>

          {selectedCentroids.map((c, i) => {
            const wx = hexWeather[c.id]
            const maxProb = wx?.intervals?.length
              ? Math.max(...wx.intervals.map(iv => iv.precipProbability))
              : null
            const isRainy = maxProb !== null && maxProb >= 50

            return (
              <div key={c.id} style={{
                borderTop: i > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                paddingTop: i > 0 ? 8 : 0
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>Zone {i + 1}</span>
                  <button
                    onClick={() => removeHex(c.id)}
                    style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}
                  >
                    ✕
                  </button>
                </div>

                {wx?.loading && (
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Fetching...</div>
                )}

                {wx?.error && (
                  <div style={{ color: '#f87171', fontSize: 12 }}>Failed to load</div>
                )}

                {wx && !wx.loading && !wx.error && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {wx.intervals.map((iv, j) => (
                      <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                        <span>+{j + 1}h</span>
                        <span style={{ color: iv.precipProbability >= 50 ? '#f87171' : '#4ade80', fontWeight: 600 }}>
                          {iv.precipProbability}% rain
                        </span>
                      </div>
                    ))}
                    <div style={{ marginTop: 4, fontSize: 12, color: isRainy ? '#f87171' : '#4ade80', fontWeight: 600 }}>
                      {isRainy ? '🌧 Rain likely in 2h' : '☀️ Clear next 2h'}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}