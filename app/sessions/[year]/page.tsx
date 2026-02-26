import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { legislatorSlug } from '@/lib/slugify'
import { getBillStage, BillStepperCompact } from '@/components/BillStatusStepper'

export const revalidate = 3600

interface Props {
  params: Promise<{ year: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { year } = await params
  return {
    title: `${year} Idaho Legislative Session | Tally Idaho`,
    description: `Browse bills, votes, top sponsors, and key activity from the ${year} Idaho Regular Session.`,
  }
}

async function getSessionData(year: number) {
  const supabase = createServerClient()

  const { data: session } = await supabase
    .from('sessions')
    .select('id, name, year_start, year_end, sine_die, special')
    .eq('year_start', year)
    .single()

  if (!session) return null

  const [
    { count: billsCount },
    { count: enactedCount },
    { count: inCommitteeCount },
    { count: controversialCount },
    { data: recentBills },
    { data: controversialBills },
    { data: primarySponsors },
  ] = await Promise.all([
    supabase.from('bills').select('*', { count: 'exact', head: true }).eq('session_id', session.id),
    supabase.from('bills').select('*', { count: 'exact', head: true }).eq('session_id', session.id).eq('completed', true),
    supabase.from('bills').select('*', { count: 'exact', head: true }).eq('session_id', session.id).eq('status', '2').eq('completed', false),
    supabase.from('bills').select('*', { count: 'exact', head: true }).eq('session_id', session.id).eq('is_controversial', true),
    supabase
      .from('bills')
      .select('id, bill_number, title, chamber, status, completed, last_action_date, committee_name, bill_sponsors(sponsor_order, legislators(name, party, district))')
      .eq('session_id', session.id)
      .order('last_action_date', { ascending: false })
      .limit(6),
    supabase
      .from('bills')
      .select('id, bill_number, title, chamber, status, completed, controversy_reason, roll_calls(yea_count, nay_count, passed)')
      .eq('session_id', session.id)
      .eq('is_controversial', true)
      .order('last_action_date', { ascending: false })
      .limit(6),
    supabase
      .from('bill_sponsors')
      .select('legislators(id, name, party, role, district), bills!inner(session_id)')
      .eq('sponsor_order', 1)
      .eq('bills.session_id', session.id),
  ])

  // Aggregate top sponsors
  const sponsorCounts: Record<string, { leg: any; count: number }> = {}
  for (const row of (primarySponsors || []) as any[]) {
    const leg = row.legislators
    if (!leg?.id) continue
    if (!sponsorCounts[leg.id]) sponsorCounts[leg.id] = { leg, count: 0 }
    sponsorCounts[leg.id].count++
  }
  const topSponsors = Object.values(sponsorCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    session,
    stats: {
      billsCount: billsCount ?? 0,
      enactedCount: enactedCount ?? 0,
      inCommitteeCount: inCommitteeCount ?? 0,
      controversialCount: controversialCount ?? 0,
    },
    recentBills: (recentBills as any[]) || [],
    controversialBills: (controversialBills as any[]) || [],
    topSponsors,
  }
}

export default async function SessionPage({ params }: Props) {
  const { year } = await params
  const data = await getSessionData(parseInt(year))
  if (!data) notFound()

  const { session, stats, recentBills, controversialBills, topSponsors } = data
  const isCurrent = !session.sine_die

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">

      {/* Breadcrumb */}
      <nav className="text-xs text-slate-400 mb-4">
        <Link href="/" className="hover:text-amber-600">Home</Link>
        <span className="mx-2">›</span>
        <Link href="/sessions" className="hover:text-amber-600">Sessions</Link>
        <span className="mx-2">›</span>
        <span className="text-slate-600">{year}</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <h1 className="font-playfair text-3xl font-black text-slate-900">{session.name}</h1>
          {isCurrent && (
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
              LIVE
            </span>
          )}
          {session.special && (
            <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-1 rounded-full">
              SPECIAL SESSION
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500">
          {isCurrent ? 'Session in progress' : 'Session adjourned'} · Updated daily from LegiScan
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        {[
          { label: 'Bills', value: stats.billsCount, color: 'text-slate-800' },
          { label: 'In Committee', value: stats.inCommitteeCount, color: 'text-amber-600' },
          { label: 'Enacted', value: stats.enactedCount, color: 'text-emerald-600' },
          { label: 'Controversial', value: stats.controversialCount, color: 'text-red-500' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-center">
            <p className={`font-playfair text-3xl font-black tabular-nums ${s.color}`}>
              {s.value.toLocaleString()}
            </p>
            <p className="text-xs text-slate-400 uppercase tracking-widest mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left: bills */}
        <div className="lg:col-span-2 space-y-8">

          {/* Recent activity */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold tracking-widest text-slate-400">RECENT ACTIVITY</h2>
              <Link href={`/bills?year=${year}`} className="text-xs text-amber-700 hover:underline">
                View all {stats.billsCount.toLocaleString()} bills →
              </Link>
            </div>
            <div className="space-y-2">
              {recentBills.map((bill: any) => {
                const primarySponsor = (bill.bill_sponsors || [])
                  .sort((a: any, b: any) => a.sponsor_order - b.sponsor_order)[0]?.legislators
                return (
                  <Link key={bill.id} href={`/bills/${year}/${bill.bill_number.toLowerCase()}`}>
                    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-amber-300 hover:shadow-sm transition-all">
                      <div className="flex items-start gap-3">
                        <span className="text-xs font-bold bg-[#0f172a] text-amber-400 px-2 py-0.5 rounded shrink-0 mt-0.5">
                          {bill.bill_number}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">{bill.title}</p>
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            {primarySponsor && (
                              <span className="text-xs text-slate-500">
                                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${primarySponsor.party === 'R' ? 'bg-red-400' : 'bg-blue-400'}`} />
                                {primarySponsor.name}
                              </span>
                            )}
                            <BillStepperCompact stage={getBillStage(bill.status, bill.completed)} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>

          {/* Controversial bills */}
          {controversialBills.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold tracking-widest text-slate-400">CONTROVERSIAL BILLS</h2>
                <Link href={`/bills?year=${year}&controversial=true`} className="text-xs text-amber-700 hover:underline">
                  View all {stats.controversialCount} →
                </Link>
              </div>
              <div className="space-y-2">
                {controversialBills.map((bill: any) => {
                  const rc = bill.roll_calls?.[bill.roll_calls.length - 1]
                  return (
                    <Link key={bill.id} href={`/bills/${year}/${bill.bill_number.toLowerCase()}`}>
                      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-amber-300 hover:shadow-sm transition-all">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <span className="text-xs font-bold bg-[#0f172a] text-amber-400 px-2 py-0.5 rounded shrink-0 mt-0.5">
                              {bill.bill_number}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">{bill.title}</p>
                              <span className="inline-block mt-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                                ⚡ {bill.controversy_reason === 'party_line' ? 'Party-line' : bill.controversy_reason === 'close_vote' ? 'Close vote' : 'Controversial'}
                              </span>
                            </div>
                          </div>
                          {rc && (
                            <div className="text-right shrink-0">
                              <p className="text-xs font-bold text-emerald-600 tabular-nums">{rc.yea_count} yea</p>
                              <p className="text-xs font-bold text-red-500 tabular-nums">{rc.nay_count} nay</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

        </div>

        {/* Right sidebar: top sponsors */}
        <div>
          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-4">TOP SPONSORS</h2>
            <div className="space-y-3">
              {topSponsors.map(({ leg, count }, i) => (
                <Link
                  key={leg.id}
                  href={`/legislators/${legislatorSlug(leg.name)}`}
                  className="flex items-center gap-2.5 group"
                >
                  <span className="text-xs text-slate-300 w-4 text-right shrink-0 tabular-nums">{i + 1}</span>
                  <span className={`text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full shrink-0 ${
                    leg.party === 'R' ? 'bg-red-500' :
                    leg.party === 'D' ? 'bg-blue-500' : 'bg-slate-400'
                  }`}>{leg.party}</span>
                  <span className="text-sm text-slate-700 group-hover:text-amber-700 transition-colors flex-1 leading-tight">
                    {leg.name}
                  </span>
                  <span className="text-xs font-bold text-slate-400 shrink-0 tabular-nums">{count}</span>
                </Link>
              ))}
              {topSponsors.length === 0 && (
                <p className="text-xs text-slate-400">No sponsor data available.</p>
              )}
            </div>
          </section>

          {/* Quick links */}
          <div className="mt-4 bg-white border border-slate-200 rounded-xl p-4 space-y-2">
            <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-3">EXPLORE {year}</h2>
            {[
              { href: `/bills?year=${year}`, label: 'All bills' },
              { href: `/bills?year=${year}&controversial=true`, label: 'Controversial bills' },
              { href: `/legislators?year=${year}`, label: 'Legislators' },
              { href: `/committees`, label: 'Committees' },
            ].map(({ href, label }) => (
              <Link key={href} href={href} className="flex items-center justify-between text-sm text-amber-700 hover:underline py-0.5">
                {label}
                <span className="text-slate-300">→</span>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </main>
  )
}
