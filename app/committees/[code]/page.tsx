import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { legislatorSlug } from '@/lib/slugify'
import Link from 'next/link'
import MeetingRecord, { MeetingRow } from '@/components/MeetingRecord'

interface Props {
  params: Promise<{ code: string }>
  searchParams: Promise<{ year?: string }>
}

async function getCommitteeData(code: string, year: number) {
  const supabase = createServerClient()

  const { data: session } = await supabase
    .from('sessions')
    .select('id, name, year_start')
    .eq('year_start', year)
    .single()

  if (!session) return null

  const { data: committee } = await supabase
    .from('committees')
    .select(`
      id, code, name, short_name, chamber,
      committee_members(
        member_role,
        legislators(id, name, party, role, district, photo_url)
      )
    `)
    .eq('code', code.toUpperCase())
    .eq('session_id', session.id)
    .single()

  if (!committee) return null

  // Primary: bills explicitly assigned to this committee
  const { data: assignedBills } = await supabase
    .from('bills')
    .select('bill_number, title, status, completed, last_action, last_action_date')
    .eq('session_id', session.id)
    .eq('committee_id', committee.id)
    .order('last_action_date', { ascending: false })
    .limit(200)

  // Secondary: bills whose last_action text mentions the committee name
  // Catches "reported out", "presented to", "voted out of" etc.
  const searchName = committee.short_name || committee.name || ''
  const { data: textBills } = searchName
    ? await supabase
        .from('bills')
        .select('bill_number, title, status, completed, last_action, last_action_date')
        .eq('session_id', session.id)
        .ilike('last_action', `%${searchName}%`)
        .order('last_action_date', { ascending: false })
        .limit(200)
    : { data: [] }

  // Merge and deduplicate by bill_number
  const seen = new Set<string>()
  const bills: any[] = []
  for (const b of [...(assignedBills || []), ...(textBills || [])]) {
    if (!seen.has(b.bill_number)) {
      seen.add(b.bill_number)
      bills.push(b)
    }
  }
  bills.sort((a, b) =>
    (b.last_action_date || '').localeCompare(a.last_action_date || '')
  )

  const { data: meetings } = await supabase
    .from('committee_meetings')
    .select('id, date, time, room, status, agenda_url, minutes_url, video_url, agenda_text, minutes_text')
    .eq('committee_id', committee.id)
    .order('date', { ascending: false })

  return { session, committee, bills, meetings: (meetings ?? []) as MeetingRow[] }
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { code } = await params
  const { year: yearParam } = await searchParams
  const year = parseInt(yearParam || '2026')
  const data = await getCommitteeData(code, year)
  if (!data) return { title: 'Committee Not Found | Tally Idaho' }
  const { committee } = data
  return {
    title: `${committee.name} (${year}) | Tally Idaho`,
    description: `Members and bills for the Idaho ${committee.name} committee, ${year} session.`,
    alternates: { canonical: `https://www.tallyidaho.com/committees/${code.toUpperCase()}` },
  }
}

export const revalidate = 300

/** Derive how this bill relates to the committee from last_action text */
function committeeRelation(bill: any): { label: string; color: string } {
  const action = (bill.last_action || '').toLowerCase()
  if (bill.completed || Number(bill.status) === 4)
    return { label: 'Enacted', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  if (/do\s+not\s+pass|failed\s+committee|without\s+recommendation/i.test(action))
    return { label: 'Failed committee', color: 'bg-red-50 text-red-600 border-red-200' }
  if (/do\s+pass|reported\s+out|voted\s+out|print\s+ordered/i.test(action))
    return { label: 'Voted out', color: 'bg-blue-50 text-blue-700 border-blue-200' }
  if (/referred\s+to|assigned\s+to/i.test(action))
    return { label: 'Referred', color: 'bg-amber-50 text-amber-700 border-amber-200' }
  if (Number(bill.status) === 3)
    return { label: 'Passed chamber', color: 'bg-blue-50 text-blue-700 border-blue-200' }
  return { label: 'In committee', color: 'bg-slate-50 text-slate-500 border-slate-200' }
}

export default async function CommitteeDetailPage({ params, searchParams }: Props) {
  const { code } = await params
  const { year: yearParam } = await searchParams
  const year = parseInt(yearParam || '2026')

  const data = await getCommitteeData(code, year)
  if (!data) notFound()

  const { session, committee, bills, meetings } = data

  // Sort members: Chair first, then Vice Chair, then Members
  const roleOrder: Record<string, number> = { Chair: 0, 'Vice Chair': 1, 'Co-Chair': 1 }
  const members = (committee.committee_members || [])
    .filter((m: any) => m.legislators)
    .sort((a: any, b: any) => {
      const ra = roleOrder[a.member_role] ?? 2
      const rb = roleOrder[b.member_role] ?? 2
      if (ra !== rb) return ra - rb
      return (a.legislators?.name || '').localeCompare(b.legislators?.name || '')
    })

  const chamberLabel = committee.chamber === 'senate' ? 'Senate'
    : committee.chamber === 'house' ? 'House'
    : 'Joint'

  const chamberBadgeColor = committee.chamber === 'senate'
    ? 'bg-blue-50 text-blue-700 border border-blue-200'
    : committee.chamber === 'house'
    ? 'bg-amber-50 text-amber-700 border border-amber-200'
    : 'bg-slate-50 text-slate-600 border border-slate-200'

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',       item: 'https://www.tallyidaho.com' },
      { '@type': 'ListItem', position: 2, name: 'Committees', item: 'https://www.tallyidaho.com/committees' },
      { '@type': 'ListItem', position: 3, name: committee.short_name || committee.name, item: `https://www.tallyidaho.com/committees/${code.toUpperCase()}` },
    ],
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      {/* Breadcrumb */}
      <nav className="text-xs text-slate-400 mb-4">
        <Link href="/" className="hover:text-amber-600">Home</Link>
        <span className="mx-2">›</span>
        <Link href={`/committees?year=${year}`} className="hover:text-amber-600">Committees</Link>
        <span className="mx-2">›</span>
        <span className="text-slate-600">{committee.short_name}</span>
      </nav>

      {/* Hero */}
      <div className="bg-[#0f172a] rounded-2xl px-8 py-7 mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${chamberBadgeColor}`}>
                {chamberLabel}
              </span>
              <span className="text-xs text-slate-500 font-mono">{committee.code}</span>
            </div>
            <h1 className="font-oswald text-3xl font-bold text-white leading-tight tracking-tight uppercase">
              {committee.short_name}
            </h1>
            <p className="text-slate-400 text-sm mt-1">{session.name}</p>
          </div>
          <div className="flex flex-col gap-1 text-right shrink-0">
            <span className="text-xs text-slate-400">{members.length} member{members.length !== 1 ? 's' : ''}</span>
            {bills.length > 0 && (
              <span className="text-xs text-amber-400">{bills.length} bill{bills.length !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
      </div>

      {/* Year tabs */}
      <div className="flex gap-1 mb-8">
        {[2025, 2026].map(y => (
          <Link key={y} href={`/committees/${code.toUpperCase()}?year=${y}`}>
            <span className={`inline-block px-4 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
              year === y
                ? 'bg-[#0f172a] text-white border-transparent'
                : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400'
            }`}>
              {y}
            </span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-8">

        {/* Members */}
        <div className="md:col-span-3">
          <h2 className="section-label mb-4">MEMBERS</h2>

          {members.length === 0 ? (
            <p className="text-sm text-slate-400">No member data available.</p>
          ) : (
            <div className="space-y-2">
              {members.map((m: any, i: number) => {
                const leg = m.legislators
                const slug = legislatorSlug(leg.name)
                const partyColor =
                  leg.party === 'R' ? 'bg-red-500' :
                  leg.party === 'D' ? 'bg-blue-500' : 'bg-slate-400'
                const isChair = m.member_role === 'Chair' || m.member_role === 'Co-Chair'
                const isVice = m.member_role === 'Vice Chair'

                return (
                  <Link key={i} href={`/legislators/${slug}`}>
                    <div className={`bg-white border rounded-xl p-3 hover:border-amber-300 hover:shadow-sm transition-all flex items-center gap-3 ${
                      isChair ? 'border-amber-300' : 'border-slate-200'
                    }`}>
                      {/* Photo */}
                      <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden shrink-0">
                        {leg.photo_url
                          ? <img src={leg.photo_url} alt={leg.name} loading="lazy" className="w-full h-full object-cover object-top" />
                          : <div className={`w-full h-full flex items-center justify-center ${partyColor}`}>
                              <span className="text-white font-bold text-sm">{leg.name[0]}</span>
                            </div>
                        }
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[9px] font-bold text-white ${partyColor} rounded-full px-1.5 py-0.5`}>{leg.party}</span>
                          <span className="text-[10px] text-slate-400">
                            {leg.role === 'Sen' ? 'Sen.' : 'Rep.'} · {leg.district}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-800 truncate">{leg.name}</p>
                      </div>

                      {/* Role badge */}
                      {(isChair || isVice) && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          isChair
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-50 text-slate-500 border border-slate-200'
                        }`}>
                          {m.member_role}
                        </span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Bills */}
        <div className="md:col-span-2">
          <h2 className="section-label mb-4">
            BILLS REFERRED ({bills.length})
          </h2>

          {bills.length === 0 ? (
            <p className="text-sm text-slate-400">No bills found for this committee.</p>
          ) : (
            <div className="space-y-2">
              {bills.map((bill: any) => {
                const { label, color } = committeeRelation(bill)
                return (
                  <Link
                    key={bill.bill_number}
                    href={`/bills/${session.year_start}/${bill.bill_number.toLowerCase()}`}
                    className="block"
                  >
                    <div className="bg-white border border-slate-200 rounded-xl p-3 hover:border-amber-300 transition-all">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-xs font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
                          {bill.bill_number}
                        </span>
                        <span className={`text-[10px] font-bold border px-1.5 py-0.5 rounded-full shrink-0 ${color}`}>
                          {label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 leading-snug">{bill.title}</p>
                      {bill.last_action_date && (
                        <p className="text-[10px] text-slate-400 mt-1">
                          {new Date(bill.last_action_date).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric'
                          })}
                        </p>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* Meeting Record */}
      {meetings.length > 0 && (
        <div className="mt-12">
          <h2 className="section-label mb-6">MEETING RECORD</h2>
          <MeetingRecord meetings={meetings} year={year} />
        </div>
      )}

    </main>
  )
}
