import { NextResponse } from 'next/server'
import { fetchFloorCalendar } from '@/lib/floor-calendar'
import type { FloorCalendar } from '@/lib/floor-calendar'

let cache: { data: FloorCalendar; ts: number } | null = null
const TTL = 90_000 // 90 seconds

export async function GET() {
  if (cache && Date.now() - cache.ts < TTL) {
    return NextResponse.json(cache.data)
  }
  try {
    const data = await fetchFloorCalendar()
    cache = { data, ts: Date.now() }
    return NextResponse.json(data)
  } catch {
    // Return empty calendar on error; don't blow away a warm cache
    const fallback: FloorCalendar = { senate: [], house: [], date: '', legislativeDay: null }
    return NextResponse.json(fallback)
  }
}
