'use client'

import { useEffect, useState } from 'react'
import Map, { NavigationControl } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

interface UserLocation {
  lat: number
  lon: number
  city: string
}

export default function RainMap() {
  const [location, setLocation] = useState<UserLocation | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/location')
      .then(r => r.json())
      .then(data => {
        setLocation(data)
        setLoading(false)
      })
      .catch(() => {
        setLocation({ lat: 39.5, lon: -98.35, city: 'United States' })
        setLoading(false)
      })
  }, [])

  if (loading) return (
    <div className="w-full h-screen flex items-center justify-center bg-gray-950 text-white">
      Locating...
    </div>
  )

  return (
    <div className="w-full h-screen">
      <Map
        initialViewState={{
          longitude: location!.lon,
          latitude: location!.lat,
          zoom: location!.city === 'United States' ? 4 : 10,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="https://tiles.openfreemap.org/styles/dark"
      >
        <NavigationControl position="top-right" />
      </Map>
    </div>
  )
}