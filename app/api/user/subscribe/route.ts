import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function POST(req: NextRequest) {
  const { uuid, subscription } = await req.json()
  if (!uuid || !subscription) return NextResponse.json({ error: 'missing fields' }, { status: 400 })

  await redis.set(`user:${uuid}:sub`, JSON.stringify(subscription), { ex: 60 * 60 * 24 * 30 })

  // Track uuid in a set so cron can find all users
  await redis.sadd('users', uuid)

  return NextResponse.json({ ok: true })
}