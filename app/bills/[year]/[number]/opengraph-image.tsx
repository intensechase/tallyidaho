import { ImageResponse } from 'next/og'
import { createServerClient } from '@/lib/supabase/server'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({
  params,
}: {
  params: Promise<{ year: string; number: string }>
}) {
  const { year, number } = await params

  const supabase = createServerClient()
  const { data: bill } = await supabase
    .from('bills')
    .select('bill_number, title, completed, is_controversial, controversy_reason, sessions!inner(year_start), roll_calls(yea_count, nay_count, passed)')
    .eq('bill_number', number.toUpperCase())
    .eq('sessions.year_start', parseInt(year))
    .maybeSingle()

  const rollCalls: any[] = (bill as any)?.roll_calls || []
  const latestRc = rollCalls[rollCalls.length - 1]
  const hasVote = latestRc && (latestRc.yea_count > 0 || latestRc.nay_count > 0)

  // Effective passed — same logic as the page
  const effectivePassed = latestRc?.passed || (latestRc?.yea_count > 0 && latestRc?.nay_count === 0)

  const title = bill?.title || 'Idaho Legislature Bill'
  const displayTitle = title.length > 100 ? title.slice(0, 97) + '…' : title
  const billNum = bill?.bill_number || number.toUpperCase()

  const isControversial = bill?.is_controversial
  const controversyLabel =
    bill?.controversy_reason === 'party_line' ? 'PARTY LINE' :
    bill?.controversy_reason === 'close_vote' ? 'CLOSE VOTE' :
    isControversial ? 'CONTROVERSIAL' : null

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
        {/* Amber top bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, backgroundColor: '#d97706', display: 'flex' }} />

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 44 }}>
          <span style={{ color: '#d97706', fontSize: 15, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase' }}>
            TALLY IDAHO
          </span>
          <span style={{ color: '#334155', fontSize: 14 }}>tallyidaho.com</span>
        </div>

        {/* Bill number */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
          <span style={{
            color: '#f59e0b',
            fontSize: 72,
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}>
            {billNum}
          </span>
          {controversyLabel && (
            <span style={{
              backgroundColor: bill?.controversy_reason === 'party_line' ? '#7f1d1d' : '#7c2d12',
              color: bill?.controversy_reason === 'party_line' ? '#fca5a5' : '#fdba74',
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.1em',
              padding: '4px 12px',
              borderRadius: 6,
              alignSelf: 'flex-end',
              marginBottom: 10,
            }}>
              ⚡ {controversyLabel}
            </span>
          )}
        </div>

        {/* Title */}
        <div style={{
          color: '#f1f5f9',
          fontSize: 30,
          fontWeight: 600,
          lineHeight: 1.35,
          flex: 1,
        }}>
          {displayTitle}
        </div>

        {/* Bottom divider + stats */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid #1e293b',
          paddingTop: 28,
          marginTop: 28,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {hasVote ? (
              <>
                <span style={{ color: '#4ade80', fontSize: 24, fontWeight: 700 }}>
                  {latestRc.yea_count} YEA
                </span>
                <span style={{ color: '#334155', fontSize: 20 }}>·</span>
                <span style={{ color: '#f87171', fontSize: 24, fontWeight: 700 }}>
                  {latestRc.nay_count} NAY
                </span>
                <span style={{ color: '#334155', fontSize: 20 }}>·</span>
                <span style={{
                  color: effectivePassed ? '#4ade80' : '#f87171',
                  fontSize: 20,
                  fontWeight: 700,
                }}>
                  {effectivePassed ? '✓ PASSED' : '✗ FAILED'}
                </span>
              </>
            ) : bill?.completed ? (
              <span style={{ color: '#4ade80', fontSize: 20, fontWeight: 700 }}>✓ ENACTED</span>
            ) : (
              <span style={{ color: '#64748b', fontSize: 18 }}>No floor vote recorded</span>
            )}
          </div>
          <span style={{ color: '#475569', fontSize: 16 }}>
            {year} Idaho Regular Session
          </span>
        </div>
      </div>
    ),
    { ...size }
  )
}
