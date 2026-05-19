import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function POST(req: NextRequest) {
  const { uuid, hexIds } = await req.json()
  if (!uuid || !hexIds) return NextResponse.json({ error: 'missing fields' }, { status: 400 })

  await redis.set(`user:${uuid}:hexes`, JSON.stringify(hexIds), { ex: 60 * 60 * 24 * 30 })

  return NextResponse.json({ ok: true })
}