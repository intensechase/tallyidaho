import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'

interface Props {
  params: Promise<{ slug: string }>
}

async function getLegislator(slug: string) {
  const supabase = createServerClient()

  // Slug is lowercased name with hyphens — we need to reverse it to query
  // Strategy: fetch all legislators and match by normalized name
  const { data: legislators } = await supabase
    .from('legislators')
    .select('id, name, party, role, district, chamber, photo_url, bio')

  if (!legislators) return null

  const leg = legislators.find(
    l => l.name.toLowerCase().replace(/\s+/g, '-') === slug
  )

  if (!leg) return null

  // Get 2026 session ID
  const { data: session } = await supabase
    .from('sessions')
    .select('id, name, year_start')
    .eq('year_start', 2026)
    .single()

  if (!session) return { leg, bills: [], votes: [], session: null, stats: { totalVotes: 0, partyLineVotes: 0 } }

  // Bills sponsored by this legislator this session
  const { data: sponsorships } = await supabase
    .from('bill_sponsors')
    .select('sponsor_order, sponsor_type, bills(id, bill_number, title, is_controversial, controversy_reason, completed, last_action, session_id, roll_calls(yea_count, nay_count, passed))')
    .eq('legislator_id', leg.id)
    .order('sponsor_order')

  const bills = (sponsorships || [])
    .map((s: any) => ({ ...s.bills, sponsor_order: s.sponsor_order, sponsor_type: s.sponsor_type }))
    .filter((b: any) => b?.session_id === session.id)
    .sort((a: any, b: any) => a.sponsor_order - b.sponsor_order)

  // Voting record this session
  const { data: votes } = await supabase
    .from('legislator_votes')
    .select('vote_value, roll_calls(id, date, chamber, description, passed, yea_count, nay_count, bills(bill_number, title, session_id, is_controversial, controversy_reason))')
    .eq('legislator_id', leg.id)
    .order('id', { ascending: false })
    .limit(50)

  const sessionVotes = (votes || []).filter(
    (v: any) => v.roll_calls?.bills?.session_id === session.id
  )

  // Party-line vote stats
  const totalVotes = sessionVotes.length
  const partyLineVotes = sessionVotes.filter(
    (v: any) => v.roll_calls?.bills?.is_controversial &&
    v.roll_calls?.bills?.controversy_reason === 'party_line'
  ).length

  return {
    leg,
    bills,
    votes: sessionVotes,
    session,
    stats: { totalVotes, partyLineVotes },
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const data = await getLegislator(slug)

  if (!data) return { title: 'Legislator Not Found | Tally Idaho' }
  const { leg } = data

  return {
    title: `${leg.name} — Idaho ${leg.role} | Tally Idaho`,
    description: `${leg.name} is an Idaho ${leg.role} representing ${leg.district}. View their voting record, bills sponsored, and party-line vote statistics on Tally Idaho.`,
    openGraph: {
      title: `${leg.name} (${leg.party}) · ${leg.district}`,
      type: 'profile',
    },
    alternates: {
      canonical: `https://tallyidaho.com/legislators/${slug}`,
    },
  }
}

export const revalidate = 86400

export default async function LegislatorPage({ params }: Props) {
  const { slug } = await params
  const data = await getLegislator(slug)

  if (!data) notFound()

  const { leg, bills, votes, session, stats } = data

  const primaryBills = bills.filter((b: any) => b.sponsor_order === 1)
  const coBills = bills.filter((b: any) => b.sponsor_order > 1)
  const distNum = leg.district?.replace(/\D/g, '') || ''

  const partyLinePct = stats && stats.totalVotes > 0
    ? Math.round((stats.partyLineVotes / stats.totalVotes) * 100)
    : null

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">

      {/* Breadcrumb */}
      <nav className="text-xs text-slate-400 mb-6">
        <a href="/" className="hover:text-amber-600">Home</a>
        <span className="mx-2">›</span>
        <a href="/legislators" className="hover:text-amber-600">Legislators</a>
        <span className="mx-2">›</span>
        <span className="text-slate-600">{leg.name}</span>
      </nav>

      {/* Profile header */}
      <div className="flex items-start gap-6 mb-8">
        <div className="w-20 h-20 rounded-full bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
          {leg.photo_url
            ? <img src={leg.photo_url} alt={leg.name} className="w-full h-full object-cover" />
            : <span className={`party-badge party-${leg.party?.toLowerCase()} w-14 h-14 text-xl`}>{leg.party}</span>
          }
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`party-badge party-${leg.party?.toLowerCase()} text-xs`}>{leg.party}</span>
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full capitalize">{leg.chamber}</span>
            <Link
              href={`/districts/${distNum}`}
              className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full hover:bg-amber-100"
            >
              District {distNum}
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{leg.name}</h1>
          <p className="text-slate-500 text-sm">{leg.role} · Idaho {leg.chamber === 'senate' ? 'Senate' : 'House of Representatives'}</p>
          {leg.bio && <p className="text-sm text-slate-600 mt-2 leading-relaxed">{leg.bio}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-8">

          {/* Bills sponsored */}
          {primaryBills.length > 0 && (
            <section>
              <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-3">BILLS SPONSORED ({primaryBills.length})</h2>
              <div className="space-y-2">
                {primaryBills.map((bill: any) => (
                  <BillRow key={bill.id} bill={bill} year={session?.year_start || 2026} />
                ))}
              </div>
            </section>
          )}

          {coBills.length > 0 && (
            <section>
              <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-3">CO-SPONSORED ({coBills.length})</h2>
              <div className="space-y-2">
                {coBills.map((bill: any) => (
                  <BillRow key={bill.id} bill={bill} year={session?.year_start || 2026} />
                ))}
              </div>
            </section>
          )}

          {/* Voting record */}
          {votes.length > 0 && (
            <section>
              <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-3">RECENT VOTES</h2>
              <div className="space-y-2">
                {votes.slice(0, 20).map((v: any, i: number) => {
                  const rc = v.roll_calls
                  const bill = rc?.bills
                  if (!bill) return null
                  return (
                    <Link
                      key={i}
                      href={`/bills/${session?.year_start || 2026}/${bill.bill_number?.toLowerCase()}`}
                      className="block"
                    >
                      <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3 hover:border-amber-300 transition-all">
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg shrink-0 ${
                          v.vote_value === 'yea' ? 'bg-emerald-50 text-emerald-700' :
                          v.vote_value === 'nay' ? 'bg-red-50 text-red-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {v.vote_value?.toUpperCase()}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-amber-600">{bill.bill_number}</p>
                          <p className="text-sm text-slate-700 truncate">{bill.title}</p>
                        </div>
                        <span className={`text-xs font-semibold shrink-0 ${rc.passed ? 'text-emerald-600' : 'text-red-500'}`}>
                          {rc.passed ? '✓ Passed' : '✗ Failed'}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}
        </div>

        {/* Stats sidebar */}
        <div className="space-y-4">
          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-3">2026 STATS</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-slate-500 text-xs mb-0.5">Bills sponsored</dt>
                <dd className="font-bold text-slate-800 text-xl">{primaryBills.length}</dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs mb-0.5">Total votes cast</dt>
                <dd className="font-bold text-slate-800 text-xl">{stats.totalVotes}</dd>
              </div>
              {partyLinePct !== null && stats.partyLineVotes > 0 && (
                <div>
                  <dt className="text-slate-500 text-xs mb-0.5">Party-line involvement</dt>
                  <dd className="font-bold text-amber-600 text-xl">{partyLinePct}%</dd>
                  <dd className="text-xs text-slate-400">{stats.partyLineVotes} party-line vote{stats.partyLineVotes !== 1 ? 's' : ''}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-3">DISTRICT</h2>
            <Link
              href={`/districts/${distNum}`}
              className="text-sm text-amber-700 hover:underline"
            >
              View District {distNum} →
            </Link>
          </section>
        </div>
      </div>
    </main>
  )
}

function BillRow({ bill, year }: { bill: any; year: number }) {
  const latestRc = bill.roll_calls?.[bill.roll_calls.length - 1]
  const yea = latestRc?.yea_count ?? 0
  const nay = latestRc?.nay_count ?? 0

  return (
    <Link href={`/bills/${year}/${bill.bill_number?.toLowerCase()}`} className="block">
      <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3 hover:border-amber-300 transition-all">
        <span className="text-xs font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
          {bill.bill_number}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-700 truncate">{bill.title}</p>
        </div>
        {bill.is_controversial && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
            bill.controversy_reason === 'party_line' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'
          }`}>
            ⚡
          </span>
        )}
        {latestRc && (
          <span className="text-xs text-slate-500 shrink-0">
            <span className="text-emerald-600 font-bold">{yea}</span>–<span className="text-red-500 font-bold">{nay}</span>
          </span>
        )}
        {bill.completed && (
          <span className="text-xs text-emerald-600 font-semibold shrink-0">✓</span>
        )}
      </div>
    </Link>
  )
}
