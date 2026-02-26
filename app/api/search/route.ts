import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ legislators: [], bills: [] })
  }

  const supabase = createServerClient()

  // Get current session id
  const { data: session } = await supabase
    .from('sessions')
    .select('id, year_start')
    .eq('year_start', 2026)
    .single()

  const [{ data: legislators }, { data: bills }] = await Promise.all([
    supabase
      .from('legislators')
      .select('name, party, role, district')
      .ilike('name', `%${q}%`)
      .not('district', 'is', null)
      .limit(5),
    session
      ? supabase
          .from('bills')
          .select('bill_number, title')
          .eq('session_id', session.id)
          .or(`title.ilike.%${q}%,bill_number.ilike.${q.toUpperCase()}%`)
          .limit(5)
      : { data: [] },
  ])

  return NextResponse.json(
    {
      legislators: (legislators || []).map((l) => ({
        name: l.name,
        party: l.party,
        role: l.role,
        district: l.district,
      })),
      bills: (bills || []).map((b: any) => ({
        bill_number: b.bill_number,
        title: b.title,
        year: session?.year_start ?? 2026,
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
