import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || ''

  // In dev, ip will be 127.0.0.1 — fallback to a default
  const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === ''

  if (isLocal) {
    return NextResponse.json({ lat: 39.5, lon: -98.35, city: 'United States' })
  }

  const res = await fetch(`http://ip-api.com/json/${ip}?fields=lat,lon,city,status`)
  const data = await res.json()

  if (data.status !== 'success') {
    return NextResponse.json({ lat: 39.5, lon: -98.35, city: 'United States' })
  }

  return NextResponse.json({ lat: data.lat, lon: data.lon, city: data.city })
}