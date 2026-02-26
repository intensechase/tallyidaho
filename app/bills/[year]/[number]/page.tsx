import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { legislatorSlug } from '@/lib/slugify'
import { BillStepperFull, getBillStage } from '@/components/BillStatusStepper'

interface Props {
  params: Promise<{ year: string; number: string }>
}

// Fetch bill data — used by both generateMetadata and the page
async function getBill(year: string, number: string) {
  const supabase = createServerClient()

  const { data: bill } = await supabase
    .from('bills')
    .select(`
      *,
      sessions!inner(year_start, name),
      bill_sponsors(
        sponsor_type,
        sponsor_order,
        legislators(name, party, role, district, chamber)
      ),
      roll_calls(
        id, date, chamber, yea_count, nay_count, absent_count,
        nv_count, total_count, passed, vote_margin, is_party_line,
        description,
        legislator_votes(
          vote,
          legislators(id, name, party, role, district)
        )
      )
    `)
    .eq('bill_number', number.toUpperCase())
    .eq('sessions.year_start', parseInt(year))
    .single()

  return bill
}

// Dynamic SEO metadata — Google will index each bill by number, title, sponsors
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { year, number } = await params
  const bill = await getBill(year, number)

  if (!bill) {
    return { title: 'Bill Not Found | Tally Idaho' }
  }

  const primarySponsor = bill.bill_sponsors
    ?.sort((a: any, b: any) => a.sponsor_order - b.sponsor_order)
    .find((s: any) => !s.legislators?.name?.includes('Committee'))
    ?.legislators

  const latestRollCall = bill.roll_calls?.[bill.roll_calls.length - 1]
  const voteStr = latestRollCall
    ? `Vote: ${latestRollCall.yea_count} Yea, ${latestRollCall.nay_count} Nay.`
    : ''

  const sponsorStr = primarySponsor
    ? `Sponsored by ${primarySponsor.name} (${primarySponsor.party}).`
    : ''

  const description = bill.plain_summary
    || `${bill.title}. ${sponsorStr} ${voteStr} Track Idaho ${number} (${year} Regular Session) on Tally Idaho.`

  return {
    title: `${number.toUpperCase()} (${year}) — ${bill.title} | Tally Idaho`,
    description: description.slice(0, 160),
    keywords: [
      `Idaho ${number}`,
      `${number} ${year}`,
      `Idaho legislature ${year}`,
      `Idaho ${bill.bill_number}`,
      ...(bill.subjects || []),
      primarySponsor?.name,
    ].filter(Boolean).join(', '),
    openGraph: {
      title: `Idaho ${number.toUpperCase()} (${year}) | Tally Idaho`,
      description: description.slice(0, 160),
      url: `https://www.tallyidaho.com/bills/${year}/${number}`,
      siteName: 'Tally Idaho',
      type: 'article',
    },
    alternates: {
      canonical: `https://www.tallyidaho.com/bills/${year}/${number.toUpperCase()}`,
    },
  }
}

// Revalidate hourly during active session
export const revalidate = 3600

export default async function BillPage({ params }: Props) {
  const { year, number } = await params
  const bill = await getBill(year, number)

  if (!bill) notFound()

  const sponsors = (bill.bill_sponsors || [])
    .sort((a: any, b: any) => a.sponsor_order - b.sponsor_order)
    .filter((s: any) => s.legislators?.name && !s.legislators.name.includes('Committee'))

  const rollCalls = bill.roll_calls || []

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">

      {/* Breadcrumb */}
      <nav className="text-xs text-slate-400 mb-4">
        <a href="/" className="hover:text-amber-600">Home</a>
        <span className="mx-2">›</span>
        <a href="/bills" className="hover:text-amber-600">Bills</a>
        <span className="mx-2">›</span>
        <a href={`/bills/${year}`} className="hover:text-amber-600">{year}</a>
        <span className="mx-2">›</span>
        <span className="text-slate-600">{bill.bill_number}</span>
      </nav>

      {/* Bill header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className="text-sm font-bold bg-[#0f172a] text-amber-400 px-3 py-1 rounded">
            {bill.bill_number}
          </span>
          {bill.is_controversial && (
            <span className="text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-full">
              ⚡ {bill.controversy_reason === 'party_line' ? 'PARTY LINE' : bill.controversy_reason === 'close_vote' ? 'CLOSE VOTE' : 'CONTROVERSIAL'}
            </span>
          )}
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
            {(bill.sessions as any)?.name}
          </span>
          {bill.completed && (
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
              ✓ {bill.last_action?.toLowerCase().includes('law') ? 'Signed into law' : 'Completed'}
            </span>
          )}
        </div>

        <h1 className="font-oswald text-2xl font-bold text-slate-900 leading-snug mb-1 tracking-tight">
          {bill.title}
        </h1>

        {bill.description && bill.description !== bill.title && (
          <p className="text-sm text-slate-500 leading-relaxed mb-2">{bill.description}</p>
        )}

        {bill.subjects?.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {bill.subjects.map((s: string) => (
              <span key={s} className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Status pipeline */}
      <div className="mb-6">
        <BillStepperFull stage={getBillStage(bill.status, bill.completed)} />
        {bill.committee_name && getBillStage(bill.status, bill.completed) <= 3 && (
          <p className="text-center text-xs text-slate-500 mt-2">
            {getBillStage(bill.status, bill.completed) === 2 ? 'Committee:' : 'Via committee:'}{' '}
            {bill.committee_code
              ? <a href={`/committees/${bill.committee_code}?year=${year}`} className="font-semibold text-amber-700 hover:underline">{bill.committee_name}</a>
              : <span className="font-semibold text-slate-700">{bill.committee_name}</span>
            }
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Main content */}
        <div className="md:col-span-2 space-y-6">

          {/* Statement of Purpose */}
          {bill.plain_summary && (
            <section>
              <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-2">STATEMENT OF PURPOSE</h2>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-slate-700 text-sm leading-relaxed">{bill.plain_summary}</p>
              </div>
            </section>
          )}

          {/* Roll calls + full voting record */}
          {rollCalls.length > 0 && (
            <section>
              <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-3">HOW THEY VOTED</h2>
              <div className="space-y-6">
                {rollCalls.map((rc: any) => {
                  const total = rc.yea_count + rc.nay_count
                  const yeaPct = total > 0 ? Math.round(rc.yea_count / total * 100) : 0
                  const margin = rc.vote_margin ?? Math.abs(rc.yea_count - rc.nay_count)

                  const votes: any[] = rc.legislator_votes || []
                  const yeas = votes
                    .filter((v: any) => v.vote === 'yea')
                    .sort((a: any, b: any) => a.legislators?.name?.localeCompare(b.legislators?.name))
                  const nays = votes
                    .filter((v: any) => v.vote === 'nay')
                    .sort((a: any, b: any) => a.legislators?.name?.localeCompare(b.legislators?.name))
                  const abstains = votes.filter((v: any) => v.vote !== 'yea' && v.vote !== 'nay')

                  const rYea = yeas.filter((v: any) => v.legislators?.party === 'R').length
                  const dYea = yeas.filter((v: any) => v.legislators?.party === 'D').length
                  const rNay = nays.filter((v: any) => v.legislators?.party === 'R').length
                  const dNay = nays.filter((v: any) => v.legislators?.party === 'D').length
                  const partySplitRows = [
                    { label: 'Republican', yea: rYea, nay: rNay, dot: 'bg-red-500' },
                    { label: 'Democrat',   yea: dYea, nay: dNay, dot: 'bg-blue-500' },
                  ].filter(p => p.yea + p.nay > 0)

                  return (
                    <div key={rc.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                      {/* Roll call header */}
                      <div className="bg-slate-50 px-4 py-3 flex items-center justify-between border-b border-slate-200">
                        <div>
                          <span className="text-sm font-bold text-slate-700 capitalize">{rc.chamber} Chamber</span>
                          {rc.date && (
                            <span className="text-xs text-slate-400 ml-2">
                              · {new Date(rc.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          )}
                          {rc.description && (
                            <p className="text-xs text-slate-500 mt-0.5">{rc.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {(rc.is_party_line || rc.vote_margin < 10) && (
                            <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                              ⚡ {rc.is_party_line ? 'Party-line' : 'Close vote'}
                            </span>
                          )}
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${rc.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                            {rc.passed ? '✓ Passed' : '✗ Failed'}
                          </span>
                        </div>
                      </div>

                      {/* Vote bar */}
                      <div className="px-4 py-3 border-b border-slate-100">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-emerald-600 w-14 text-right tabular-nums">{rc.yea_count} Yea</span>
                          <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="vote-bar-fill h-full bg-emerald-500 rounded-full"
                              style={{ '--bar-pct': `${yeaPct}%` } as React.CSSProperties}
                            />
                          </div>
                          <span className="text-sm font-bold text-red-500 w-14 tabular-nums">{rc.nay_count} Nay</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-400">
                          <span>{rc.absent_count > 0 ? `${rc.absent_count} absent` : ''}</span>
                          <span>{margin > 0 ? `${rc.passed ? 'Passed' : 'Failed'} by ${margin} vote${margin !== 1 ? 's' : ''}` : ''}</span>
                        </div>
                      </div>

                      {/* Party breakdown */}
                      {partySplitRows.length > 0 && (
                        <div className="px-4 py-3 border-b border-slate-100 space-y-1.5">
                          {partySplitRows.map(p => {
                            const total = p.yea + p.nay
                            const pct = total > 0 ? Math.round(p.yea / total * 100) : 0
                            return (
                              <div key={p.label} className="flex items-center gap-2 text-xs">
                                <span className={`w-2 h-2 rounded-full ${p.dot} shrink-0`} />
                                <span className="text-slate-500 w-20 shrink-0">{p.label}</span>
                                <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-emerald-600 font-semibold w-12 text-right tabular-nums">{p.yea} yea</span>
                                <span className="text-slate-300 mx-0.5">/</span>
                                <span className="text-red-500 font-semibold w-10 tabular-nums">{p.nay} nay</span>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Legislator votes grid */}
                      {votes.length > 0 && (
                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Yea column */}
                          <div>
                            <p className="text-xs font-bold tracking-widest text-emerald-600 mb-2">YEA ({yeas.length})</p>
                            <div className="space-y-1">
                              {yeas.map((v: any, i: number) => {
                                const leg = v.legislators
                                if (!leg) return null
                                const slug = legislatorSlug(leg.name)
                                return (
                                  <a key={i} href={`/legislators/${slug}`} className="flex items-center gap-2 group">
                                    <span className={`party-badge party-${leg.party?.toLowerCase()} shrink-0`}>{leg.party}</span>
                                    <span className="text-xs text-slate-700 group-hover:text-amber-700 transition-colors truncate">
                                      {leg.name}
                                    </span>
                                    <span className="text-xs text-slate-400 shrink-0 ml-auto">{leg.district}</span>
                                  </a>
                                )
                              })}
                            </div>
                          </div>

                          {/* Nay column */}
                          <div>
                            <p className="text-xs font-bold tracking-widest text-red-500 mb-2">NAY ({nays.length})</p>
                            <div className="space-y-1">
                              {nays.map((v: any, i: number) => {
                                const leg = v.legislators
                                if (!leg) return null
                                const slug = legislatorSlug(leg.name)
                                return (
                                  <a key={i} href={`/legislators/${slug}`} className="flex items-center gap-2 group">
                                    <span className={`party-badge party-${leg.party?.toLowerCase()} shrink-0`}>{leg.party}</span>
                                    <span className="text-xs text-slate-700 group-hover:text-amber-700 transition-colors truncate">
                                      {leg.name}
                                    </span>
                                    <span className="text-xs text-slate-400 shrink-0 ml-auto">{leg.district}</span>
                                  </a>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Absent/NV */}
                      {abstains.length > 0 && (
                        <div className="px-4 pb-4 border-t border-slate-100 pt-3">
                          <p className="text-xs font-bold tracking-widest text-slate-400 mb-2">ABSENT / NOT VOTING ({abstains.length})</p>
                          <div className="flex flex-wrap gap-2">
                            {abstains.map((v: any, i: number) => {
                              const leg = v.legislators
                              if (!leg) return null
                              const slug = legislatorSlug(leg.name)
                              return (
                                <a key={i} href={`/legislators/${slug}`} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-amber-700">
                                  <span className={`party-badge party-${leg.party?.toLowerCase()}`}>{leg.party}</span>
                                  {leg.name}
                                </a>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Bill history */}
          {bill.last_action && (
            <section>
              <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-2">LATEST ACTION</h2>
              <p className="text-sm text-slate-600">{bill.last_action}</p>
              {bill.last_action_date && (
                <p className="text-xs text-slate-400 mt-1">
                  {new Date(bill.last_action_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </section>
          )}

        </div>

        {/* Sidebar */}
        <div className="space-y-4">

          {/* Sponsors */}
          {sponsors.length > 0 && (
            <section className="bg-white border border-slate-200 rounded-xl p-4">
              <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-3">SPONSORS</h2>
              <div className="space-y-2">
                {sponsors.map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center text-white ${s.legislators.party === 'R' ? 'bg-red-500' : s.legislators.party === 'D' ? 'bg-blue-500' : 'bg-slate-400'}`}>
                      {s.legislators.party}
                    </span>
                    <div>
                      <a href={`/legislators/${legislatorSlug(s.legislators.name)}`} className="text-sm font-semibold text-slate-800 hover:text-amber-700">
                        {s.legislators.name}
                      </a>
                      <p className="text-xs text-slate-400">{s.legislators.role} · {s.legislators.district}</p>
                    </div>
                    {i === 0 && <span className="ml-auto text-xs text-slate-400">Primary</span>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Quick facts */}
          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-3">BILL INFO</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Session</dt>
                <dd className="font-semibold text-slate-700">{year}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Chamber</dt>
                <dd className="font-semibold text-slate-700 capitalize">{bill.chamber}</dd>
              </div>
              {(bill as any).committee_name && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500 shrink-0">Committee</dt>
                  <dd className="font-semibold text-slate-700 text-right">
                    {(bill as any).committee_code
                      ? (
                        <a
                          href={`/committees/${(bill as any).committee_code}?year=${year}`}
                          className="text-amber-700 hover:underline"
                        >
                          {(bill as any).committee_name}
                        </a>
                      )
                      : (bill as any).committee_name
                    }
                  </dd>
                </div>
              )}
              {(bill as any).status_date && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Status date</dt>
                  <dd className="font-semibold text-slate-700">
                    {new Date((bill as any).status_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {/* Documents */}
          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-3">DOCUMENTS</h2>
            <div className="space-y-2">
              <a
                href={`https://legislature.idaho.gov/wp-content/uploads/sessioninfo/${year}/legislation/${bill.bill_number.replace(/\s+/g, '').toUpperCase()}.pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-amber-700 hover:underline flex items-center gap-1"
              >
                Bill Text (PDF) ↗
              </a>
              <a
                href={`https://legislature.idaho.gov/wp-content/uploads/sessioninfo/${year}/legislation/${bill.bill_number.replace(/\s+/g, '').toUpperCase()}SOP.pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-amber-700 hover:underline flex items-center gap-1"
              >
                Statement of Purpose (PDF) ↗
              </a>
            </div>
          </section>

          {/* External links */}
          {bill.state_url && (
            <section className="bg-white border border-slate-200 rounded-xl p-4">
              <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-3">LINKS</h2>
              <a
                href={bill.state_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-amber-700 hover:underline flex items-center gap-1"
              >
                View on Idaho Legislature ↗
              </a>
            </section>
          )}

        </div>
      </div>
    </main>
  )
}
