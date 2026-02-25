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

  const billSelect = `
    id, bill_number, title, chamber,
    is_controversial, controversy_reason,
    completed, last_action, last_action_date,
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
      .select(billSelect)
      .eq('session_id', session.id)
      .eq('is_controversial', true)
      .order('last_action_date', { ascending: false })
      .limit(8),
    supabase
      .from('bills')
      .select(billSelect)
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
      <div className="bg-[#1e293b] border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6 md:gap-10 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-outfit text-2xl font-bold text-white">{stats.billsCount.toLocaleString()}</span>
            <span className="text-slate-400 text-xs leading-tight">bills<br />introduced</span>
          </div>
          <div className="h-6 w-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <span className="font-outfit text-2xl font-bold text-emerald-400">{stats.passedCount.toLocaleString()}</span>
            <span className="text-slate-400 text-xs leading-tight">signed<br />into law</span>
          </div>
          <div className="h-6 w-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <span className="font-outfit text-2xl font-bold text-amber-400">{stats.controversialCount.toLocaleString()}</span>
            <span className="text-slate-400 text-xs leading-tight">controversial<br />votes</span>
          </div>
          <span className="ml-auto text-xs text-slate-500 hidden md:block">
            {session.name}
          </span>
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
