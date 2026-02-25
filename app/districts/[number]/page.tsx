import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'

interface Props {
  params: Promise<{ number: string }>
}

async function getDistrictData(districtNum: number) {
  const supabase = createServerClient()

  // Get 2026 session
  const { data: session } = await supabase
    .from('sessions')
    .select('id, name, year_start')
    .eq('year_start', 2026)
    .single()

  if (!session) return null

  // Get legislators for this district via legislator_sessions
  const { data: legSessions } = await supabase
    .from('legislator_sessions')
    .select('legislators(id, name, party, role, district, chamber, photo_url)')
    .eq('session_id', session.id)
    .eq('district_number', districtNum)

  const legislators = (legSessions || [])
    .map((ls: any) => ls.legislators)
    .filter(Boolean)
    .sort((a: any, b: any) => {
      if (a.role === 'Senator' && b.role !== 'Senator') return -1
      if (b.role === 'Senator' && a.role !== 'Senator') return 1
      return a.name.localeCompare(b.name)
    })

  if (legislators.length === 0) return null

  const legIds = legislators.map((l: any) => l.id)

  // Bills sponsored by district legislators this session
  const { data: sponsorships } = await supabase
    .from('bill_sponsors')
    .select('sponsor_order, legislators(name), bills(id, bill_number, title, is_controversial, controversy_reason, completed, last_action, session_id, roll_calls(yea_count, nay_count, passed))')
    .in('legislator_id', legIds)
    .eq('sponsor_order', 1) // primary sponsors only

  const bills = (sponsorships || [])
    .map((s: any) => ({ ...s.bills, sponsor_name: s.legislators?.name }))
    .filter((b: any) => b?.session_id === session.id)
    .sort((a: any, b: any) => (a.bill_number || '').localeCompare(b.bill_number || ''))

  // Controversial votes involving district legislators
  const { data: controversialVotes } = await supabase
    .from('legislator_votes')
    .select('vote_value, legislator_id, legislators(name, party), roll_calls(id, date, passed, bills(bill_number, title, session_id, is_controversial, controversy_reason))')
    .in('legislator_id', legIds)
    .order('id', { ascending: false })
    .limit(100)

  const controversialRollCalls = new Map<string, any>()
  for (const v of (controversialVotes || [])) {
    const rc = v.roll_calls as any
    const bill = rc?.bills
    if (!bill?.is_controversial || bill.session_id !== session.id) continue
    if (!controversialRollCalls.has(bill.bill_number)) {
      controversialRollCalls.set(bill.bill_number, { bill, votes: [], date: rc.date, passed: rc.passed })
    }
    controversialRollCalls.get(bill.bill_number).votes.push({
      name: (v.legislators as any)?.name,
      party: (v.legislators as any)?.party,
      vote_value: v.vote_value,
    })
  }

  return {
    session,
    legislators,
    bills,
    controversialVotes: Array.from(controversialRollCalls.values()).slice(0, 10),
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { number } = await params
  const n = parseInt(number)

  return {
    title: `Idaho District ${n} — Legislators & Bills | Tally Idaho`,
    description: `Idaho Legislative District ${n}: 1 senator and 2 representatives. See their bills, voting records, and controversial votes on Tally Idaho.`,
    alternates: {
      canonical: `https://tallyidaho.com/districts/${n}`,
    },
  }
}

export async function generateStaticParams() {
  return Array.from({ length: 35 }, (_, i) => ({ number: String(i + 1) }))
}

export const revalidate = 86400

export default async function DistrictPage({ params }: Props) {
  const { number } = await params
  const n = parseInt(number)

  if (isNaN(n) || n < 1 || n > 35) notFound()

  const data = await getDistrictData(n)
  if (!data) notFound()

  const { session, legislators, bills, controversialVotes } = data

  const senator = legislators.find((l: any) => l.role === 'Senator')
  const reps = legislators.filter((l: any) => l.role !== 'Senator')

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">

      {/* Breadcrumb */}
      <nav className="text-xs text-slate-400 mb-6">
        <a href="/" className="hover:text-amber-600">Home</a>
        <span className="mx-2">›</span>
        <a href="/districts" className="hover:text-amber-600">Districts</a>
        <span className="mx-2">›</span>
        <span className="text-slate-600">District {n}</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">District {n}</h1>
        <p className="text-sm text-slate-500">{session.name} · {legislators.length} legislators</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-8">

          {/* Controversial votes */}
          {controversialVotes.length > 0 && (
            <section>
              <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-3">HOW DISTRICT {n} VOTED — CONTROVERSIAL BILLS</h2>
              <div className="space-y-3">
                {controversialVotes.map((item: any, i: number) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <Link href={`/bills/${session.year_start}/${item.bill.bill_number?.toLowerCase()}`}>
                          <span className="text-xs font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full hover:bg-amber-100 transition-colors">
                            {item.bill.bill_number}
                          </span>
                        </Link>
                        <p className="text-sm font-semibold text-slate-800 mt-1 leading-snug">{item.bill.title}</p>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        item.bill.controversy_reason === 'party_line' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'
                      }`}>
                        {item.bill.controversy_reason === 'party_line' ? 'PARTY LINE' : 'CLOSE VOTE'}
                      </span>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      {item.votes.map((v: any, j: number) => (
                        <div key={j} className="flex items-center gap-1.5 text-xs">
                          <span className={`party-badge party-${v.party?.toLowerCase()} text-xs`}>{v.party}</span>
                          <span className="text-slate-600">{v.name}</span>
                          <span className={`font-bold ${v.vote_value === 'yea' ? 'text-emerald-600' : v.vote_value === 'nay' ? 'text-red-500' : 'text-slate-400'}`}>
                            {v.vote_value?.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className={`text-xs font-semibold mt-2 ${item.passed ? 'text-emerald-600' : 'text-red-500'}`}>
                      {item.passed ? '✓ Bill passed' : '✗ Bill failed'}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Bills from district */}
          {bills.length > 0 && (
            <section>
              <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-3">BILLS FROM DISTRICT {n} ({bills.length})</h2>
              <div className="space-y-2">
                {bills.map((bill: any) => {
                  const latestRc = bill.roll_calls?.[bill.roll_calls.length - 1]
                  const yea = latestRc?.yea_count ?? 0
                  const nay = latestRc?.nay_count ?? 0
                  return (
                    <Link key={bill.id} href={`/bills/${session.year_start}/${bill.bill_number?.toLowerCase()}`} className="block">
                      <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3 hover:border-amber-300 transition-all">
                        <span className="text-xs font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
                          {bill.bill_number}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 truncate">{bill.title}</p>
                          {bill.sponsor_name && (
                            <p className="text-xs text-slate-400">{bill.sponsor_name}</p>
                          )}
                        </div>
                        {latestRc && (
                          <span className="text-xs text-slate-500 shrink-0">
                            <span className="text-emerald-600 font-bold">{yea}</span>–<span className="text-red-500 font-bold">{nay}</span>
                          </span>
                        )}
                        {bill.completed && (
                          <span className="text-xs text-emerald-600 font-semibold">✓</span>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}
        </div>

        {/* Legislators sidebar */}
        <div className="space-y-4">
          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-3">LEGISLATORS</h2>

            {senator && (
              <div className="mb-4">
                <p className="text-xs text-slate-400 mb-2">SENATOR</p>
                <LegCard leg={senator} />
              </div>
            )}

            {reps.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-2">REPRESENTATIVES</p>
                <div className="space-y-2">
                  {reps.map((leg: any) => <LegCard key={leg.id} leg={leg} />)}
                </div>
              </div>
            )}
          </section>

          <div className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="font-semibold text-slate-500 mb-1">District map coming soon</p>
            <p>Geographic boundary visualization will be added in a future update.</p>
          </div>
        </div>
      </div>
    </main>
  )
}

function LegCard({ leg }: { leg: any }) {
  const slug = leg.name.toLowerCase().replace(/\s+/g, '-')
  return (
    <Link href={`/legislators/${slug}`}>
      <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 transition-colors">
        <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
          {leg.photo_url
            ? <img src={leg.photo_url} alt={leg.name} className="w-full h-full object-cover" />
            : <span className={`party-badge party-${leg.party?.toLowerCase()} w-6 h-6 text-xs`}>{leg.party}</span>
          }
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">{leg.name}</p>
          <p className="text-xs text-slate-400">{leg.role}</p>
        </div>
        <span className="ml-auto text-xs text-slate-400">→</span>
      </div>
    </Link>
  )
}
