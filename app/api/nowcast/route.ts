import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get('lat')
  const lon = searchParams.get('lon')

  if (!lat || !lon) {
    return NextResponse.json({ error: 'lat and lon required' }, { status: 400 })
  }

  const apiKey = process.env.TOMORROW_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  const url = `https://api.tomorrow.io/v4/weather/forecast?location=${lat},${lon}&timesteps=1h&apikey=${apiKey}`
  const res = await fetch(url)
  const data = await res.json()

  // Extract next 2 hours of precip probability
  const hourly = data.timelines?.hourly?.slice(0, 2) ?? []
  const intervals = hourly.map((h: any) => ({
    time: h.time,
    precipProbability: h.values.precipitationProbability,
    precipIntensity: h.values.precipitationIntensity,
  }))

  return NextResponse.json({ intervals })
}