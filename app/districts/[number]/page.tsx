import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { legislatorSlug } from '@/lib/slugify'
import Link from 'next/link'

interface Props {
  params: Promise<{ number: string }>
}

// Geographic description per district — sourced from Idaho Legislature membership page
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

async function getDistrictData(districtNum: number) {
  const supabase = createServerClient()

  const { data: session } = await supabase
    .from('sessions')
    .select('id, name, year_start')
    .eq('year_start', 2026)
    .single()

  if (!session) return null

  const padded = String(districtNum).padStart(3, '0')
  const { data: legSessions } = await supabase
    .from('legislator_sessions')
    .select('legislators(id, name, party, role, district, chamber, photo_url, bio)')
    .eq('session_id', session.id)
    .or(`district.eq.SD-${padded},district.like.HD-${padded}%`)

  const legislators = (legSessions || [])
    .map((ls: any) => ls.legislators)
    .filter(Boolean)
    .sort((a: any, b: any) => {
      if (a.role === 'Sen' && b.role !== 'Sen') return -1
      if (b.role === 'Sen' && a.role !== 'Sen') return 1
      return a.name.localeCompare(b.name)
    })

  if (legislators.length === 0) return null

  const legIds = legislators.map((l: any) => l.id)

  // Vote stats per legislator
  const { data: allVotes } = await supabase
    .from('legislator_votes')
    .select('legislator_id, vote')
    .in('legislator_id', legIds)

  const voteStats: Record<string, { yea: number; nay: number; absent: number }> = {}
  for (const v of (allVotes || [])) {
    if (!voteStats[v.legislator_id]) voteStats[v.legislator_id] = { yea: 0, nay: 0, absent: 0 }
    const vt = (v.vote as string)?.toLowerCase()
    if (vt === 'yea') voteStats[v.legislator_id].yea++
    else if (vt === 'nay') voteStats[v.legislator_id].nay++
    else voteStats[v.legislator_id].absent++
  }

  // Bills sponsored by district legislators this session
  const { data: sponsorships } = await supabase
    .from('bill_sponsors')
    .select('legislator_id, legislators(name), bills(id, bill_number, title, status, is_controversial, controversy_reason, completed, last_action, session_id, roll_calls(yea_count, nay_count, passed))')
    .in('legislator_id', legIds)
    .eq('sponsor_order', 1)

  const bills = (sponsorships || [])
    .map((s: any) => ({ ...s.bills, sponsor_name: s.legislators?.name, legislator_id: s.legislator_id }))
    .filter((b: any) => b?.session_id === session.id)
    .sort((a: any, b: any) => (a.bill_number || '').localeCompare(b.bill_number || ''))

  // Controversial votes involving district legislators
  const { data: controversialVotes } = await supabase
    .from('legislator_votes')
    .select('vote, legislator_id, legislators(name, party), roll_calls(id, date, passed, bills(bill_number, title, session_id, is_controversial, controversy_reason))')
    .in('legislator_id', legIds)
    .order('id', { ascending: false })
    .limit(150)

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
      vote: v.vote,
    })
  }

  return {
    session,
    legislators,
    bills,
    controversialVotes: Array.from(controversialRollCalls.values()).slice(0, 10),
    voteStats,
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { number } = await params
  const n = parseInt(number)
  const area = DISTRICT_AREAS[n] || ''
  const [city, county] = area ? area.split(' · ').map(s => s.trim()) : ['', '']
  const locationStr = city && county ? `${city}, ${county}` : area
  return {
    title: `Idaho District ${n}${area ? ` — ${area}` : ''} | Tally Idaho`,
    description: locationStr
      ? `Idaho Legislative District ${n} represents ${locationStr}. See your senator and representatives' bills, voting records, and key votes on Tally Idaho.`
      : `Idaho Legislative District ${n}: 1 senator and 2 representatives. See their bills, voting records, and key votes on Tally Idaho.`,
    alternates: { canonical: `https://www.tallyidaho.com/districts/${n}` },
  }
}

export async function generateStaticParams() {
  return Array.from({ length: 35 }, (_, i) => ({ number: String(i + 1) }))
}

export const revalidate = 3600

function billStatusLabel(bill: any): string {
  if (bill.completed) return 'Enacted'
  const s = Number(bill.status)
  if (s === 4) return 'Enacted'
  if (s === 3) return 'Passed'
  if (s === 2) return 'In Committee'
  return 'Introduced'
}

function billStatusColor(label: string): string {
  if (label === 'Enacted') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (label === 'Passed') return 'bg-blue-50 text-blue-700 border-blue-200'
  if (label === 'In Committee') return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-slate-50 text-slate-500 border-slate-200'
}

export default async function DistrictPage({ params }: Props) {
  const { number } = await params
  const n = parseInt(number)

  if (isNaN(n) || n < 1 || n > 35) notFound()

  const data = await getDistrictData(n)
  if (!data) notFound()

  const { session, legislators, bills, controversialVotes, voteStats } = data

  const senator = legislators.find((l: any) => l.role === 'Sen')
  const reps = legislators.filter((l: any) => l.role !== 'Sen')
  const area = DISTRICT_AREAS[n] || ''

  const partyCount = legislators.reduce((acc: Record<string, number>, l: any) => {
    acc[l.party] = (acc[l.party] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const enactedCount = bills.filter((b: any) => billStatusLabel(b) === 'Enacted').length
  const passedCount  = bills.filter((b: any) => billStatusLabel(b) === 'Passed').length

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',      item: 'https://www.tallyidaho.com' },
      { '@type': 'ListItem', position: 2, name: 'Districts', item: 'https://www.tallyidaho.com/districts' },
      { '@type': 'ListItem', position: 3, name: `District ${n}`, item: `https://www.tallyidaho.com/districts/${n}` },
    ],
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      {/* Breadcrumb */}
      <nav className="text-xs text-slate-400 mb-6">
        <Link href="/" className="hover:text-amber-600">Home</Link>
        <span className="mx-2">›</span>
        <Link href="/districts" className="hover:text-amber-600">Districts</Link>
        <span className="mx-2">›</span>
        <span className="text-slate-600">District {n}</span>
      </nav>

      {/* Hero */}
      <div className="bg-[#0f172a] rounded-2xl px-8 py-7 mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-3 mb-1">
            <span className="font-oswald text-lg font-semibold text-amber-400/60 tracking-widest uppercase">District</span>
            <span className="font-oswald text-6xl font-bold text-amber-400 leading-none">{n}</span>
          </div>
          {area && <p className="text-slate-300 text-sm mt-1">{area}</p>}
          <p className="text-slate-500 text-xs mt-1">{session.name}</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:text-right">
          {Object.entries(partyCount).sort().map(([party, count]) => (
            <span key={party} className={`text-xs font-bold px-3 py-1 rounded-full ${
              party === 'R' ? 'bg-red-500/20 text-red-300' :
              party === 'D' ? 'bg-blue-500/20 text-blue-300' :
              'bg-slate-500/20 text-slate-300'
            }`}>
              {count} {party === 'R' ? 'Republican' : party === 'D' ? 'Democrat' : 'Independent'}{count > 1 ? 's' : ''}
            </span>
          ))}
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/5 text-slate-300">
            {bills.length} bill{bills.length !== 1 ? 's' : ''} sponsored
          </span>
          {(enactedCount + passedCount) > 0 && (
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300">
              {enactedCount + passedCount} passed
            </span>
          )}
        </div>
      </div>

      {/* Legislator cards */}
      <section className="mb-10">
        <h2 className="font-oswald text-xs font-semibold tracking-widest text-slate-400 uppercase mb-4">Your Legislators</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {legislators.map((leg: any) => {
            const stats = voteStats[leg.id] || { yea: 0, nay: 0, absent: 0 }
            const total = stats.yea + stats.nay + stats.absent
            const yeaPct = total ? Math.round((stats.yea / total) * 100) : 0
            const legBills = bills.filter((b: any) => b.legislator_id === leg.id)
            const partyColor = leg.party === 'R' ? 'bg-red-500' : leg.party === 'D' ? 'bg-blue-500' : 'bg-slate-400'
            return (
              <Link key={leg.id} href={`/legislators/${legislatorSlug(leg.name)}`}>
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-amber-300 hover:shadow-sm transition-all h-full flex flex-col">
                  {/* Party accent bar */}
                  <div className={`h-1 w-full ${partyColor}`} />
                  <div className="p-4 flex flex-col flex-1">
                    {/* Photo + name */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-14 h-14 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                        {leg.photo_url
                          ? <img src={leg.photo_url} alt={leg.name} className="w-full h-full object-cover object-top" />
                          : <div className={`w-full h-full flex items-center justify-center ${partyColor}`}>
                              <span className="text-white font-bold text-lg">{leg.name[0]}</span>
                            </div>
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 text-sm leading-tight">{leg.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {leg.role === 'Sen' ? 'Senator' : 'Representative'} · {leg.party === 'R' ? 'Republican' : leg.party === 'D' ? 'Democrat' : leg.party}
                        </p>
                        <p className="text-xs text-slate-400">{leg.district}</p>
                      </div>
                    </div>

                    {/* Bio */}
                    {leg.bio && (
                      <p className="text-xs text-slate-500 leading-relaxed mb-3 line-clamp-3">{leg.bio}</p>
                    )}

                    {/* Stats */}
                    <div className="mt-auto pt-3 border-t border-slate-100 flex gap-4 text-xs text-slate-500">
                      {total > 0 && (
                        <div>
                          <span className="text-emerald-600 font-bold">{yeaPct}%</span> yea rate
                        </div>
                      )}
                      {legBills.length > 0 && (
                        <div>
                          <span className="text-amber-600 font-bold">{legBills.length}</span> bill{legBills.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
        <div className="md:col-span-3 space-y-8">

          {/* Controversial votes */}
          {controversialVotes.length > 0 && (
            <section>
              <h2 className="font-oswald text-xs font-semibold tracking-widest text-slate-400 uppercase mb-4">
                Key Votes — District {n}
              </h2>
              <div className="space-y-3">
                {controversialVotes.map((item: any, i: number) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Link href={`/bills/${session.year_start}/${item.bill.bill_number?.toLowerCase()}`}>
                            <span className="text-xs font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full hover:bg-amber-100 transition-colors">
                              {item.bill.bill_number}
                            </span>
                          </Link>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            item.bill.controversy_reason === 'party_line'
                              ? 'bg-red-50 text-red-600'
                              : 'bg-orange-50 text-orange-600'
                          }`}>
                            {item.bill.controversy_reason === 'party_line' ? 'PARTY LINE' : 'CLOSE VOTE'}
                          </span>
                          <span className={`text-xs font-semibold ${item.passed ? 'text-emerald-600' : 'text-red-500'}`}>
                            {item.passed ? '✓ Passed' : '✗ Failed'}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-800 leading-snug">{item.bill.title}</p>
                      </div>
                    </div>
                    <div className="flex gap-4 flex-wrap">
                      {item.votes.map((v: any, j: number) => (
                        <div key={j} className="flex items-center gap-1.5 text-xs">
                          <span className={`party-badge party-${v.party?.toLowerCase()}`}>{v.party}</span>
                          <span className="text-slate-600">{v.name}</span>
                          <span className={`font-bold ${v.vote === 'yea' ? 'text-emerald-600' : v.vote === 'nay' ? 'text-red-500' : 'text-slate-400'}`}>
                            {v.vote?.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Bills sidebar */}
        <div className="md:col-span-2">
          {bills.length > 0 && (
            <section>
              <h2 className="font-oswald text-xs font-semibold tracking-widest text-slate-400 uppercase mb-4">
                Bills Sponsored ({bills.length})
              </h2>
              <div className="space-y-2">
                {bills.map((bill: any) => {
                  const statusLabel = billStatusLabel(bill)
                  const statusColor = billStatusColor(statusLabel)
                  return (
                    <Link key={bill.id} href={`/bills/${session.year_start}/${bill.bill_number?.toLowerCase()}`} className="block">
                      <div className="bg-white border border-slate-200 rounded-xl p-3 hover:border-amber-300 transition-all">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="text-xs font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
                            {bill.bill_number}
                          </span>
                          <span className={`text-[10px] font-bold border px-1.5 py-0.5 rounded-full shrink-0 ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 leading-snug">{bill.title}</p>
                        {bill.sponsor_name && (
                          <p className="text-[10px] text-slate-400 mt-1">{bill.sponsor_name}</p>
                        )}
                        {bill.last_action && (
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate">{bill.last_action}</p>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  )
}
