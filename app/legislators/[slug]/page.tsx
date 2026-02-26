import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { legislatorSlug } from '@/lib/slugify'
import Link from 'next/link'
import VoteTabs from '@/components/VoteTabs'

interface Props {
  params: Promise<{ slug: string }>
}

// Geographic area descriptions per district (same as districts page)
const DISTRICT_AREAS: Record<number, string> = {
  1:  'Boundary & Bonner Co.',
  2:  'Coeur d\'Alene',
  3:  'Coeur d\'Alene',
  4:  'Post Falls',
  5:  'Hayden',
  6:  'Moscow · Latah Co.',
  7:  'Moscow · Latah Co.',
  8:  'Lewiston',
  9:  'Grangeville',
  10: 'Lewiston',
  11: 'Twin Falls',
  12: 'Twin Falls · Cassia Co.',
  13: 'Sun Valley · Blaine Co.',
  14: 'Twin Falls East',
  15: 'Gooding · Lincoln Co.',
  16: 'Burley · Cassia Co.',
  17: 'Pocatello',
  18: 'Pocatello',
  19: 'Soda Springs · SE Idaho',
  20: 'Idaho Falls',
  21: 'Idaho Falls',
  22: 'Idaho Falls',
  23: 'Rigby · Jefferson Co.',
  24: 'Rexburg · Madison Co.',
  25: 'Blackfoot · Bingham Co.',
  26: 'Nampa',
  27: 'Caldwell',
  28: 'Nampa & Meridian',
  29: 'West Boise',
  30: 'North Boise',
  31: 'Boise',
  32: 'East Boise',
  33: 'SE Boise',
  34: 'Meridian & Eagle',
  35: 'Mountain Home · Elmore Co.',
}

async function getLegislator(slug: string) {
  const supabase = createServerClient()

  // Fetch all legislators and match by normalized name
  const { data: legislators } = await supabase
    .from('legislators')
    .select('id, name, party, role, district, chamber, photo_url')

  if (!legislators) return null

  const leg = legislators.find(l => legislatorSlug(l.name) === slug)
  if (!leg) return null

  // Count terms served (sessions this legislator appears in)
  const { count: termsServed } = await supabase
    .from('legislator_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('legislator_id', leg.id)

  // Get 2026 session
  const { data: session } = await supabase
    .from('sessions')
    .select('id, name, year_start')
    .eq('year_start', 2026)
    .single()

  if (!session) {
    return { leg, termsServed: termsServed ?? 0, bills: [], votes: [], session: null, voteStats: null }
  }

  // Bills sponsored this session
  const { data: sponsorships } = await supabase
    .from('bill_sponsors')
    .select('sponsor_order, sponsor_type, bills(id, bill_number, title, status, is_controversial, controversy_reason, completed, last_action, session_id, roll_calls(yea_count, nay_count, passed))')
    .eq('legislator_id', leg.id)
    .order('sponsor_order')

  const bills = (sponsorships || [])
    .map((s: any) => ({ ...s.bills, sponsor_order: s.sponsor_order, sponsor_type: s.sponsor_type }))
    .filter((b: any) => b?.session_id === session.id)
    .sort((a: any, b: any) => a.sponsor_order - b.sponsor_order)

  // Voting record this session (limit 200 for all votes)
  const { data: votes } = await supabase
    .from('legislator_votes')
    .select('vote, roll_calls(id, date, chamber, passed, yea_count, nay_count, bills(bill_number, title, session_id, is_controversial, controversy_reason))')
    .eq('legislator_id', leg.id)
    .order('id', { ascending: false })
    .limit(200)

  const sessionVotes = (votes || []).filter(
    (v: any) => v.roll_calls?.bills?.session_id === session.id
  )

  // Vote breakdown stats
  const yeaCount = sessionVotes.filter((v: any) => v.vote === 'yea').length
  const nayCount = sessionVotes.filter((v: any) => v.vote === 'nay').length
  const absentCount = sessionVotes.filter((v: any) => v.vote !== 'yea' && v.vote !== 'nay').length
  const totalVotes = sessionVotes.length

  return {
    leg,
    termsServed: termsServed ?? 0,
    bills,
    votes: sessionVotes,
    session,
    voteStats: { yea: yeaCount, nay: nayCount, absent: absentCount, total: totalVotes },
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const data = await getLegislator(slug)

  if (!data) return { title: 'Legislator Not Found | Tally Idaho' }
  const { leg } = data

  const partyFull = leg.party === 'R' ? 'Republican' : leg.party === 'D' ? 'Democrat' : 'Independent'
  const roleFull = leg.role === 'Sen' ? 'Senator' : 'Representative'
  const distNum = parseInt(leg.district?.replace(/\D/g, '') || '0')

  return {
    title: `${leg.name} — Idaho ${roleFull} | Tally Idaho`,
    description: `${leg.name} is a ${partyFull} Idaho ${roleFull} representing District ${distNum}. View their voting record, bills sponsored, and party-line vote statistics on Tally Idaho.`,
    openGraph: {
      title: `${leg.name} (${leg.party}) · District ${distNum}`,
      type: 'profile',
      images: leg.photo_url ? [{ url: leg.photo_url, alt: leg.name }] : [],
    },
    alternates: {
      canonical: `https://www.tallyidaho.com/legislators/${slug}`,
    },
  }
}

export const revalidate = 86400

export default async function LegislatorPage({ params }: Props) {
  const { slug } = await params
  const data = await getLegislator(slug)

  if (!data) notFound()

  const { leg, termsServed, bills, votes, session, voteStats } = data

  const primaryBills = bills.filter((b: any) => b.sponsor_order === 1)
  const coBills = bills.filter((b: any) => b.sponsor_order > 1)
  const distNum = parseInt(leg.district?.replace(/\D/g, '') || '0')
  const geoArea = DISTRICT_AREAS[distNum] || ''

  const partyFull = leg.party === 'R' ? 'Republican' : leg.party === 'D' ? 'Democrat' : 'Independent'
  const roleFull = leg.role === 'Sen' ? 'Senator' : 'Representative'
  const partyAccent = leg.party === 'R' ? 'bg-red-500' : leg.party === 'D' ? 'bg-blue-500' : 'bg-slate-400'
  const partyText = leg.party === 'R' ? 'text-red-700 bg-red-50 border-red-200' : leg.party === 'D' ? 'text-blue-700 bg-blue-50 border-blue-200' : 'text-slate-600 bg-slate-100 border-slate-200'

  // Separate key votes (controversial) from all votes
  const keyVotes = votes.filter((v: any) => v.roll_calls?.bills?.is_controversial)
  const termLabel = termsServed === 1 ? '1st term' : `${termsServed} terms`

  const chamberPath = leg.chamber === 'senate' ? 'senate' : 'house'

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">

      {/* Breadcrumb */}
      <nav className="text-xs text-slate-400 mb-6">
        <Link href="/" className="hover:text-amber-600">Home</Link>
        <span className="mx-2">›</span>
        <Link href="/legislators" className="hover:text-amber-600">Legislators</Link>
        <span className="mx-2">›</span>
        <span className="text-slate-600">{leg.name}</span>
      </nav>

      {/* ── Hero header ──────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-8">
        {/* Party accent bar */}
        <div className={`h-1.5 ${partyAccent}`} />

        <div className="p-6">
          <div className="flex items-start gap-6">

            {/* Photo */}
            <div className="w-28 h-28 md:w-32 md:h-32 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
              {leg.photo_url
                ? <img
                    src={leg.photo_url}
                    alt={leg.name}
                    className="w-full h-full object-cover object-top"
                  />
                : <span className={`party-badge party-${leg.party?.toLowerCase()} text-2xl w-full h-full flex items-center justify-center`}>
                    {leg.party}
                  </span>
              }
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pt-1">
              {/* Badges row */}
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className={`text-xs font-bold border px-2 py-0.5 rounded-full ${partyText}`}>
                  {partyFull}
                </span>
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {roleFull}
                </span>
                <Link
                  href={`/districts/${distNum}`}
                  className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full hover:bg-amber-100 transition-colors"
                >
                  District {distNum}
                </Link>
              </div>

              {/* Name */}
              <h1 className="font-playfair text-2xl md:text-3xl font-black text-slate-900 leading-tight mb-1">
                {leg.name}
              </h1>

              {/* Location + terms */}
              <p className="text-sm text-slate-500">
                {geoArea && <span>{geoArea} · </span>}
                Idaho {leg.chamber === 'senate' ? 'Senate' : 'House'} · {termLabel}
              </p>

            </div>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Main column */}
        <div className="md:col-span-2 space-y-8">

          {/* Bills sponsored */}
          {primaryBills.length > 0 && (
            <section>
              <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-3">
                BILLS SPONSORED ({primaryBills.length})
              </h2>
              <div className="space-y-2">
                {primaryBills.map((bill: any) => (
                  <BillRow key={bill.id} bill={bill} year={session?.year_start || 2026} />
                ))}
              </div>
            </section>
          )}

          {coBills.length > 0 && (
            <section>
              <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-3">
                CO-SPONSORED ({coBills.length})
              </h2>
              <div className="space-y-2">
                {coBills.map((bill: any) => (
                  <BillRow key={bill.id} bill={bill} year={session?.year_start || 2026} />
                ))}
              </div>
            </section>
          )}

          {primaryBills.length === 0 && coBills.length === 0 && (
            <section>
              <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-3">BILLS SPONSORED</h2>
              <p className="text-sm text-slate-400 italic">No bills sponsored in the 2026 session yet.</p>
            </section>
          )}

          {/* Voting record tabs */}
          <section>
            <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-3">VOTING RECORD</h2>
            <VoteTabs
              allVotes={votes as any}
              keyVotes={keyVotes as any}
              year={session?.year_start || 2026}
            />
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">

          {/* Vote breakdown */}
          {voteStats && voteStats.total > 0 && (
            <section className="bg-white border border-slate-200 rounded-xl p-4">
              <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-4">
                {session?.year_start || 2026} VOTES
              </h2>

              <div className="space-y-3">
                <VoteBar label="YEA" count={voteStats.yea} total={voteStats.total} color="emerald" />
                <VoteBar label="NAY" count={voteStats.nay} total={voteStats.total} color="red" />
                {voteStats.absent > 0 && (
                  <VoteBar label="ABSENT" count={voteStats.absent} total={voteStats.total} color="slate" />
                )}
              </div>

              <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100">
                {voteStats.total} total votes recorded
              </p>
            </section>
          )}

          {/* Stats */}
          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-3">STATS</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-slate-500">Bills sponsored</dt>
                <dd className="text-xl font-bold text-slate-800">{primaryBills.length}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Co-sponsored</dt>
                <dd className="text-xl font-bold text-slate-800">{coBills.length}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Terms in office</dt>
                <dd className="text-xl font-bold text-slate-800">{termsServed}</dd>
              </div>
            </dl>
          </section>

          {/* Links */}
          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-3">LINKS</h2>
            <div className="space-y-2 text-sm">
              <Link
                href={`/districts/${distNum}`}
                className="flex items-center justify-between text-slate-700 hover:text-amber-700 transition-colors"
              >
                <span>View District {distNum}</span>
                <span className="text-slate-400">→</span>
              </Link>
              <a
                href={`https://legislature.idaho.gov/${chamberPath}/membership/`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between text-slate-700 hover:text-amber-700 transition-colors"
              >
                <span>Official Legislature page</span>
                <span className="text-slate-400">↗</span>
              </a>
            </div>
          </section>

        </div>
      </div>
    </main>
  )
}

// ── Vote breakdown bar ──────────────────────────────────────────────────────
function VoteBar({ label, count, total, color }: {
  label: string
  count: number
  total: number
  color: 'emerald' | 'red' | 'slate'
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  const barColor =
    color === 'emerald' ? 'bg-emerald-500' :
    color === 'red' ? 'bg-red-400' : 'bg-slate-300'
  const textColor =
    color === 'emerald' ? 'text-emerald-700' :
    color === 'red' ? 'text-red-600' : 'text-slate-500'

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-slate-600">{label}</span>
        <span className={`text-xs font-bold ${textColor}`}>{pct}% <span className="font-normal text-slate-400">({count})</span></span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── Bill row ────────────────────────────────────────────────────────────────
function BillRow({ bill, year }: { bill: any; year: number }) {
  const latestRc = bill.roll_calls?.[bill.roll_calls.length - 1]
  const yea = latestRc?.yea_count ?? 0
  const nay = latestRc?.nay_count ?? 0

  // Status chip: 1=Introduced, 2=In Committee, 3=Passed, 4=Enacted/Signed
  const statusLabel =
    bill.completed ? 'Enacted' :
    bill.status === '4' || bill.status === 4 ? 'Enacted' :
    bill.status === '3' || bill.status === 3 ? 'Passed' :
    bill.status === '2' || bill.status === 2 ? 'In Committee' :
    'Introduced'
  const statusStyle =
    bill.completed || bill.status === '4' || bill.status === 4 ? 'bg-emerald-50 text-emerald-700' :
    bill.status === '3' || bill.status === 3 ? 'bg-blue-50 text-blue-600' :
    bill.status === '2' || bill.status === 2 ? 'bg-amber-50 text-amber-700' :
    'bg-slate-100 text-slate-500'

  return (
    <Link href={`/bills/${year}/${bill.bill_number?.toLowerCase()}`} className="block">
      <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3 hover:border-amber-300 transition-all group">
        <span className="text-xs font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
          {bill.bill_number}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-700 truncate group-hover:text-amber-800 transition-colors">
            {bill.title}
          </p>
        </div>
        {bill.is_controversial && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
            bill.controversy_reason === 'party_line' ? 'bg-red-50 text-red-500' : 'bg-orange-50 text-orange-500'
          }`}>
            {bill.controversy_reason === 'party_line' ? 'PARTY LINE' : 'CLOSE'}
          </span>
        )}
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${statusStyle}`}>
          {statusLabel}
        </span>
        {latestRc && (
          <span className="text-xs text-slate-400 shrink-0">
            <span className="text-emerald-600 font-bold">{yea}</span>–<span className="text-red-500 font-bold">{nay}</span>
          </span>
        )}
      </div>
    </Link>
  )
}
