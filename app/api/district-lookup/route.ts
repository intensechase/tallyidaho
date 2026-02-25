import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Census Bureau Geocoder — public API, no key needed
const CENSUS_URL = 'https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress'

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  if (!address?.trim()) {
    return NextResponse.json({ error: 'Address is required.' }, { status: 400 })
  }

  // Call Census Geocoder
  const censusParams = new URLSearchParams({
    address: address.trim(),
    benchmark: 'Public_AR_Current',
    vintage: 'Current_Current',
    layers: '66,67', // 66 = SLD Upper (Senate), 67 = SLD Lower (House)
    format: 'json',
  })

  let districtNumber: number | null = null

  try {
    const res = await fetch(`${CENSUS_URL}?${censusParams}`, {
      headers: { 'User-Agent': 'TallyIdaho/1.0 (tallyidaho.com)' },
      next: { revalidate: 86400 }, // Cache geocode results for 24h
    })

    if (!res.ok) throw new Error('Census API error')
    const data = await res.json()

    const match = data?.result?.addressMatches?.[0]
    if (!match) {
      return NextResponse.json(
        { error: 'Address not found. Try including city and zip code (e.g. "123 Main St, Boise, ID 83702").' },
        { status: 404 }
      )
    }

    // Try upper chamber first (SLD Upper), fall back to lower
    const geographies = match.geographies || {}
    const upper = geographies['State Legislative Districts - Upper Chamber']?.[0]
    const lower = geographies['State Legislative Districts - Lower Chamber']?.[0]

    const districtStr = upper?.DISTRICT || lower?.DISTRICT
    if (!districtStr) {
      return NextResponse.json(
        { error: 'Could not determine legislative district. Are you sure this is an Idaho address?' },
        { status: 404 }
      )
    }

    districtNumber = parseInt(districtStr, 10)
  } catch {
    return NextResponse.json({ error: 'Geocoder unavailable. Please try again.' }, { status: 503 })
  }

  if (!districtNumber) {
    return NextResponse.json({ error: 'Could not determine legislative district.' }, { status: 404 })
  }

  // Look up legislators for this district (most recent session = 2026)
  const supabase = createServerClient()

  // Get the 2026 session
  const { data: session } = await supabase
    .from('sessions')
    .select('id')
    .eq('year_start', 2026)
    .single()

  if (!session) {
    return NextResponse.json({ error: 'Session data unavailable.' }, { status: 500 })
  }

  // Get legislators via legislator_sessions for 2026
  const { data: legSessions, error: dbError } = await supabase
    .from('legislator_sessions')
    .select('legislators(id, name, party, role, district)')
    .eq('session_id', session.id)
    .eq('district_number', districtNumber)

  if (dbError) {
    return NextResponse.json({ error: 'Database error.' }, { status: 500 })
  }

  const legislators = (legSessions || [])
    .map((ls: any) => ls.legislators)
    .filter(Boolean)
    .map((leg: any) => ({
      name: leg.name,
      party: leg.party,
      role: leg.role,
      district: leg.district,
      slug: leg.name.toLowerCase().replace(/\s+/g, '-'),
    }))
    // Senator first, then Representatives
    .sort((a: any, b: any) => {
      if (a.role === 'Senator' && b.role !== 'Senator') return -1
      if (b.role === 'Senator' && a.role !== 'Senator') return 1
      return a.name.localeCompare(b.name)
    })

  return NextResponse.json({ district: districtNumber, legislators })
}
