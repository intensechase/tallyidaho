import { ImageResponse } from 'next/og'
import { createServerClient } from '@/lib/supabase/server'
import { legislatorSlug } from '@/lib/slugify'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const DISTRICT_AREAS: Record<number, string> = {
  1:  'Sandpoint · Bonner & Boundary Counties',
  2:  'Kellogg · Shoshone & Benewah Counties',
  3:  'Hayden · Kootenai County',
  4:  'Coeur d\'Alene · Kootenai County',
  5:  'Coeur d\'Alene · Kootenai County',
  6:  'Moscow · Latah County',
  7:  'Lewiston · Nez Perce & Idaho Counties',
  8:  'Mountain Home · Elmore County',
  9:  'New Plymouth · Payette & Washington Counties',
  10: 'Middleton · Canyon County',
  11: 'Caldwell · Canyon County',
  12: 'Nampa · Canyon County',
  13: 'Nampa · Canyon County',
  14: 'Eagle · Ada County',
  15: 'Boise · Ada County',
  16: 'Boise · Ada County',
  17: 'Boise · Ada County',
  18: 'Boise · Ada County',
  19: 'Boise · Ada County',
  20: 'Meridian · Ada County',
  21: 'Meridian · Ada County',
  22: 'Meridian · Ada County',
  23: 'Nampa · Canyon & Ada Counties',
  24: 'Twin Falls · Twin Falls County',
  25: 'Twin Falls · Twin Falls County',
  26: 'Hailey · Blaine County',
  27: 'Rupert · Minidoka County',
  28: 'Pocatello · Bannock County',
  29: 'Pocatello · Bannock County',
  30: 'Blackfoot · Bingham County',
  31: 'Rigby · Jefferson County',
  32: 'Idaho Falls · Bonneville County',
  33: 'Idaho Falls · Bonneville County',
  34: 'Rexburg · Madison County',
  35: 'Soda Springs · Caribou County',
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const supabase = createServerClient()

  // Get legislator
  const { data: legislators } = await supabase
    .from('legislators')
    .select('id, name, party, role, district')
    .not('district', 'is', null)

  const leg = (legislators || []).find(l => legislatorSlug(l.name) === slug)
  if (!leg) {
    // Fallback default image
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif' }}>
          <span style={{ color: '#d97706', fontSize: 48, fontWeight: 900 }}>TALLY IDAHO</span>
        </div>
      ),
      { ...size }
    )
  }

  // Get 2026 session stats
  const { data: session } = await supabase.from('sessions').select('id').eq('year_start', 2026).single()

  let billCount = 0
  let yeaPct: number | null = null

  if (session) {
    const [{ count }, { data: votes }] = await Promise.all([
      supabase.from('bill_sponsors').select('*', { count: 'exact', head: true })
        .eq('legislator_id', leg.id).eq('sponsor_order', 1),
      supabase.from('legislator_votes').select('vote')
        .eq('legislator_id', leg.id).limit(500),
    ])
    billCount = count ?? 0

    const v = votes || []
    const yeas = v.filter((x: any) => x.vote === 'yea').length
    const total = v.length
    yeaPct = total > 10 ? Math.round((yeas / total) * 100) : null
  }

  const distNum = parseInt(leg.district?.replace(/\D/g, '') || '0')
  const area = DISTRICT_AREAS[distNum] || ''
  const [city] = area ? area.split(' · ') : ['']
  const partyFull = leg.party === 'R' ? 'Republican' : leg.party === 'D' ? 'Democrat' : 'Independent'
  const roleFull = leg.role === 'Sen' ? 'Senator' : 'Representative'
  const partyBg = leg.party === 'R' ? '#7f1d1d' : leg.party === 'D' ? '#1e3a5f' : '#1e293b'
  const partyAccent = leg.party === 'R' ? '#ef4444' : leg.party === 'D' ? '#3b82f6' : '#64748b'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#0f172a',
          display: 'flex',
          flexDirection: 'column',
          padding: '56px 72px',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        {/* Party accent top bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, backgroundColor: partyAccent, display: 'flex' }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 56 }}>
          <span style={{ color: '#d97706', fontSize: 15, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase' }}>
            TALLY IDAHO
          </span>
          <span style={{ color: '#334155', fontSize: 14 }}>tallyidaho.com</span>
        </div>

        {/* Party badge + role */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <span style={{
            backgroundColor: partyBg,
            color: partyAccent,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.1em',
            padding: '4px 12px',
            borderRadius: 6,
          }}>
            {partyFull.toUpperCase()}
          </span>
          <span style={{ color: '#64748b', fontSize: 16 }}>
            Idaho {roleFull} · District {distNum}
          </span>
        </div>

        {/* Name */}
        <div style={{
          color: '#f8fafc',
          fontSize: 62,
          fontWeight: 900,
          lineHeight: 1.05,
          letterSpacing: '-0.02em',
          flex: 1,
        }}>
          {leg.name}
        </div>

        {/* Location */}
        {city && (
          <div style={{ color: '#64748b', fontSize: 20, marginBottom: 32 }}>
            {area}
          </div>
        )}

        {/* Stats row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 40,
          borderTop: '1px solid #1e293b',
          paddingTop: 28,
        }}>
          {billCount > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: '#f59e0b', fontSize: 32, fontWeight: 900, lineHeight: 1 }}>{billCount}</span>
              <span style={{ color: '#475569', fontSize: 14, marginTop: 4 }}>Bills Sponsored</span>
            </div>
          )}
          {yeaPct !== null && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: '#4ade80', fontSize: 32, fontWeight: 900, lineHeight: 1 }}>{yeaPct}%</span>
              <span style={{ color: '#475569', fontSize: 14, marginTop: 4 }}>Yea Rate</span>
            </div>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ color: '#334155', fontSize: 15 }}>2026 Idaho Legislature</span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
