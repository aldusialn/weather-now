import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import webpush from 'web-push'
import { cellToLatLng } from 'h3-js'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

async function getWeather(lat: number, lon: number) {
  const res = await fetch(
    `https://api.tomorrow.io/v4/weather/forecast?location=${lat},${lon}&timesteps=1h&apikey=${process.env.TOMORROW_API_KEY}`
  )
  const data = await res.json()
  const hourly = data.timelines?.hourly?.slice(0, 2) ?? []
  return hourly.map((h: any) => ({
    time: h.time,
    precipProbability: h.values.precipitationProbability,
  }))
}

export async function GET(req: NextRequest) {
  const isVercel = req.headers.get('x-vercel-cron') === '1'
  const isManual = req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`

  if (!isVercel && !isManual) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const uuids = await redis.smembers('users')

  for (const uuid of uuids) {
    const [hexesRaw, subRaw] = await Promise.all([
      redis.get(`user:${uuid}:hexes`),
      redis.get(`user:${uuid}:sub`),
    ])

    if (!hexesRaw || !subRaw) continue

    const hexIds: string[] = typeof hexesRaw === 'string' ? JSON.parse(hexesRaw) : hexesRaw as string[]
    const subscription = typeof subRaw === 'string' ? JSON.parse(subRaw) : subRaw

    if (!hexIds.length) continue

    let rainyCount = 0
    for (const hexId of hexIds) {
      const [lat, lon] = cellToLatLng(hexId)
      const intervals = await getWeather(lat, lon)
      const maxProb = Math.max(...intervals.map((iv: any) => iv.precipProbability))
      if (maxProb >= 50) rainyCount++
    }

    if (rainyCount === 0) continue

    try {
      await webpush.sendNotification(
        subscription,
        JSON.stringify({
          title: '🌧 Rain Alert',
          body: `Rain likely in ${rainyCount}/${hexIds.length} of your zones in the next 2 hours`,
        })
      )
    } catch (err: any) {
      if (err.statusCode === 410) {
        await redis.del(`user:${uuid}:sub`)
        await redis.del(`user:${uuid}:hexes`)
        await redis.srem('users', uuid)
      }
    }
  }

  return NextResponse.json({ ok: true })
}