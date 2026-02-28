import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory rate limiter for /api/ routes.
// Protects Supabase from being hammered. Resets per edge cold start —
// not globally shared across instances, but effective against most abuse.
const rateMap = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS = 60_000 // 1 minute window
const API_LIMIT = 30     // max requests per IP per window

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/api/')) {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      'unknown'

    const now = Date.now()
    const entry = rateMap.get(ip)

    if (!entry || entry.resetAt < now) {
      rateMap.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    } else {
      entry.count++
      if (entry.count > API_LIMIT) {
        return new NextResponse('Too Many Requests', {
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Limit': String(API_LIMIT),
            'X-RateLimit-Remaining': '0',
          },
        })
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
