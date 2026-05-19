import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function POST(req: NextRequest) {
  const { uuid, hexIds } = await req.json()
  if (!uuid || !hexIds) return NextResponse.json({ error: 'missing fields' }, { status: 400 })

  const TTL = 60 * 60 * 24 * 30

  await Promise.all([
    redis.set(`user:${uuid}:hexes`, JSON.stringify(hexIds), { ex: TTL }),
    redis.set(`user:${uuid}:lastSeen`, Date.now().toString(), { ex: TTL }),
    redis.sadd('users', uuid),
  ])

  return NextResponse.json({ ok: true })
}