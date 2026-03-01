/**
 * check-data-quality.ts
 *
 * Audits the DB for known categories of data issues.
 * Read-only — no writes.
 *
 * Usage:
 *   npx tsx scripts/check-data-quality.ts
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

let issues = 0

function report(label: string, rows: any[], detail?: (r: any) => string) {
  if (rows.length === 0) {
    console.log(`  ✓ ${label}`)
    return
  }
  issues += rows.length
  console.log(`  ✗ ${label} — ${rows.length} record(s)`)
  const show = rows.slice(0, 5)
  for (const r of show) {
    console.log(`      ${detail ? detail(r) : JSON.stringify(r)}`)
  }
  if (rows.length > 5) console.log(`      ... and ${rows.length - 5} more`)
}

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  Tally Idaho — Data Quality Audit')
  console.log('═══════════════════════════════════════════════════\n')

  // ── Roll calls ───────────────────────────────────────────────

  console.log('ROLL CALLS')

  // passed=true but nay > yea (inverse of the LegiScan bug we fixed)
  const { data: passedButNayWins } = await supabase
    .from('roll_calls')
    .select('id, yea_count, nay_count, passed, bills!inner(bill_number, sessions!inner(year_start))')
    .eq('passed', true)
    .filter('nay_count', 'gt', 0)
  report(
    'passed=true but nay > yea',
    (passedButNayWins || []).filter((r: any) => r.nay_count > r.yea_count),
    r => `${r.bills?.sessions?.year_start} ${r.bills?.bill_number} — ${r.yea_count} yea / ${r.nay_count} nay`
  )

  // total_count doesn't match yea+nay+absent+nv
  const { data: allRcs } = await supabase
    .from('roll_calls')
    .select('id, yea_count, nay_count, absent_count, nv_count, total_count, vote_margin, bills!inner(bill_number, sessions!inner(year_start))')
  const badTotals = (allRcs || []).filter((r: any) => {
    const computed = (r.yea_count || 0) + (r.nay_count || 0) + (r.absent_count || 0) + (r.nv_count || 0)
    return r.total_count !== null && Math.abs(computed - r.total_count) > 1
  })
  report(
    'total_count mismatches yea+nay+absent+nv',
    badTotals,
    r => {
      const computed = (r.yea_count || 0) + (r.nay_count || 0) + (r.absent_count || 0) + (r.nv_count || 0)
      return `${r.bills?.sessions?.year_start} ${r.bills?.bill_number} — stored total=${r.total_count}, computed=${computed}`
    }
  )

  // vote_margin stored value doesn't match computed
  const badMargins = (allRcs || []).filter((r: any) => {
    if (r.total_count == null || r.total_count === 0) return false
    const computed = parseFloat((Math.abs((r.yea_count || 0) - (r.nay_count || 0)) / r.total_count * 100).toFixed(2))
    return Math.abs((r.vote_margin || 0) - computed) > 1.0 // allow 1% rounding tolerance
  })
  report(
    'vote_margin mismatch (>1% off)',
    badMargins,
    r => {
      const computed = parseFloat((Math.abs((r.yea_count || 0) - (r.nay_count || 0)) / r.total_count * 100).toFixed(2))
      return `${r.bills?.sessions?.year_start} ${r.bills?.bill_number} — stored=${r.vote_margin}, computed=${computed}`
    }
  )

  // roll calls with zero total votes
  const { data: emptyRcs } = await supabase
    .from('roll_calls')
    .select('id, yea_count, nay_count, total_count, bills!inner(bill_number, sessions!inner(year_start))')
    .eq('yea_count', 0)
    .eq('nay_count', 0)
  report(
    'roll calls with 0 yea and 0 nay',
    (emptyRcs || []),
    r => `${r.bills?.sessions?.year_start} ${r.bills?.bill_number}`
  )

  console.log()

  // ── Bills ────────────────────────────────────────────────────

  console.log('BILLS')

  // status=4 or completed=true but not both
  const { data: bills4 } = await supabase
    .from('bills')
    .select('id, bill_number, status, completed, sessions!inner(year_start)')
    .or('status.eq.4,completed.eq.true')
  const mismatchedCompletion = (bills4 || []).filter((b: any) => {
    const s = Number(b.status || 0)
    return (s >= 4) !== b.completed
  })
  report(
    'status≥4 / completed mismatch',
    mismatchedCompletion,
    b => `${b.sessions?.year_start} ${b.bill_number} — status=${b.status}, completed=${b.completed}`
  )

  // bills with future last_action_date
  const today = new Date().toISOString().split('T')[0]
  const { data: futureDates } = await supabase
    .from('bills')
    .select('id, bill_number, last_action_date, sessions!inner(year_start)')
    .gt('last_action_date', today)
  report(
    'bills with future last_action_date',
    futureDates || [],
    b => `${b.sessions?.year_start} ${b.bill_number} — ${b.last_action_date}`
  )

  // bills with null bill_number
  const { data: nullNumbers } = await supabase
    .from('bills')
    .select('id, bill_number, sessions!inner(year_start)')
    .is('bill_number', null)
  report('bills with null bill_number', nullNumbers || [])

  // is_controversial=true but no controversy_reason
  const { data: missingReason } = await supabase
    .from('bills')
    .select('id, bill_number, sessions!inner(year_start)')
    .eq('is_controversial', true)
    .is('controversy_reason', null)
  report(
    'is_controversial=true with no controversy_reason',
    missingReason || [],
    b => `${b.sessions?.year_start} ${b.bill_number}`
  )

  console.log()

  // ── Legislators ──────────────────────────────────────────────

  console.log('LEGISLATORS')

  const { data: legislators } = await supabase
    .from('legislators')
    .select('id, name, party, role, district, chamber')
    .not('district', 'is', null) // active legislators only (not the committee placeholders)

  // missing party
  report(
    'active legislators with no party',
    (legislators || []).filter((l: any) => !l.party),
    l => `${l.name} — district=${l.district}`
  )

  // unexpected party values
  const knownParties = new Set(['R', 'D', 'I', 'L', 'G'])
  report(
    'unexpected party values',
    (legislators || []).filter((l: any) => l.party && !knownParties.has(l.party)),
    l => `${l.name} — party="${l.party}"`
  )

  // unexpected role values
  const knownRoles = new Set(['Rep', 'Sen'])
  report(
    'unexpected role values',
    (legislators || []).filter((l: any) => l.role && !knownRoles.has(l.role)),
    l => `${l.name} — role="${l.role}"`
  )

  console.log()

  // ── Orphaned records ─────────────────────────────────────────

  console.log('ORPHANED RECORDS')

  // legislator_votes with no matching legislator
  const { count: orphanVotes } = await supabase
    .from('legislator_votes')
    .select('id', { count: 'exact', head: true })
    .is('legislator_id', null)
  report('legislator_votes with null legislator_id', orphanVotes ? [{ count: orphanVotes }] : [], r => `${r.count} votes`)

  // bill_sponsors with no matching legislator
  const { count: orphanSponsors } = await supabase
    .from('bill_sponsors')
    .select('id', { count: 'exact', head: true })
    .is('legislator_id', null)
  report('bill_sponsors with null legislator_id', orphanSponsors ? [{ count: orphanSponsors }] : [], r => `${r.count} sponsors`)

  // ─────────────────────────────────────────────────────────────

  console.log()
  console.log('═══════════════════════════════════════════════════')
  console.log(`  Total issues found: ${issues}`)
  console.log('═══════════════════════════════════════════════════')
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
