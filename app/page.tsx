import { createServerClient } from '@/lib/supabase/server'
import HomepageTabs from '@/components/HomepageTabs'
import DistrictLookup from '@/components/DistrictLookup'

export const revalidate = 3600 // Refresh hourly

async function getHomepageData() {
  const supabase = createServerClient()

  const { data: session } = await supabase
    .from('sessions')
    .select('id, name, year_start')
    .eq('year_start', 2026)
    .single()

  if (!session) return null

  // Controversial bills get full detail for the expanded card
  const controversialBillSelect = `
    id, bill_number, title, description, plain_summary,
    chamber, is_controversial, controversy_reason,
    completed, last_action, last_action_date, state_url, subjects,
    bill_sponsors(
      sponsor_order, sponsor_type,
      legislators(name, party, role, district, chamber)
    ),
    roll_calls(yea_count, nay_count, passed, vote_margin, is_party_line)
  `

  // Compact cards for "All Bills" tab
  const recentBillSelect = `
    id, bill_number, title, chamber,
    is_controversial, controversy_reason,
    completed, last_action,
    bill_sponsors(sponsor_order, legislators(name, party, district)),
    roll_calls(yea_count, nay_count, passed)
  `

  const [
    { count: billsCount },
    { count: passedCount },
    { count: controversialCount },
    { data: controversialBills },
    { data: recentBills },
  ] = await Promise.all([
    supabase
      .from('bills')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id),
    supabase
      .from('bills')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id)
      .eq('completed', true),
    supabase
      .from('bills')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id)
      .eq('is_controversial', true),
    supabase
      .from('bills')
      .select(controversialBillSelect)
      .eq('session_id', session.id)
      .eq('is_controversial', true)
      .order('last_action_date', { ascending: false })
      .limit(6),
    supabase
      .from('bills')
      .select(recentBillSelect)
      .eq('session_id', session.id)
      .order('last_action_date', { ascending: false })
      .limit(8),
  ])

  return {
    session,
    stats: {
      billsCount: billsCount ?? 0,
      passedCount: passedCount ?? 0,
      controversialCount: controversialCount ?? 0,
    },
    controversialBills: (controversialBills as any[]) || [],
    recentBills: (recentBills as any[]) || [],
  }
}

export default async function HomePage() {
  const data = await getHomepageData()

  if (!data) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-slate-500">Data unavailable. Please check back shortly.</p>
      </main>
    )
  }

  const { session, stats, controversialBills, recentBills } = data

  return (
    <>
      {/* Session stats bar */}
      <div className="bg-[#1e293b] header-texture border-b border-slate-700/60">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-6 md:gap-12">
          <div className="stat-enter flex items-baseline gap-2">
            <span className="font-playfair text-3xl font-black text-white tabular-nums">{stats.billsCount.toLocaleString()}</span>
            <span className="text-slate-400 text-xs uppercase tracking-widest">Bills</span>
          </div>
          <div className="h-7 w-px bg-slate-700" />
          <div className="stat-enter flex items-baseline gap-2">
            <span className="font-playfair text-3xl font-black text-emerald-400 tabular-nums">{stats.passedCount.toLocaleString()}</span>
            <span className="text-slate-400 text-xs uppercase tracking-widest">Signed</span>
          </div>
          <div className="h-7 w-px bg-slate-700" />
          <div className="stat-enter flex items-baseline gap-2">
            <span className="font-playfair text-3xl font-black text-amber-400 tabular-nums">{stats.controversialCount.toLocaleString()}</span>
            <span className="text-slate-400 text-xs uppercase tracking-widest">Controversial</span>
          </div>
          <div className="ml-auto hidden md:flex flex-col items-end">
            <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">{session.name}</span>
            <span className="text-xs text-slate-600 mt-0.5">Updated daily</span>
          </div>
        </div>
      </div>

      {/* Bill tabs section */}
      <HomepageTabs
        controversialBills={controversialBills}
        recentBills={recentBills}
        year={session.year_start}
      />

      {/* District lookup */}
      <DistrictLookup />
    </>
  )
}
