import { NextRequest, NextResponse } from 'next/server'
import { runSync } from '@/lib/sync-engine'

// Allow up to 300s on Vercel Pro — active session days can process many bills
export const maxDuration = 300

export async function GET(req: NextRequest) {
  // Verify the request is from Vercel's cron system
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runSync({ dryRun: false })
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('[cron/sync] Sync failed:', err.message)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
