import { Metadata } from 'next'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import BillsFilters from '@/components/BillsFilters'
import { BillStepperCompact, getBillStage, getBillDead } from '@/components/BillStatusStepper'
import { legislatorSlug } from '@/lib/slugify'

export const metadata: Metadata = {
  title: 'Idaho Bills | Tally Idaho',
  description: 'Browse Idaho legislative bills by session, topic, chamber, and controversy. Track votes, sponsors, and outcomes.',
  alternates: { canonical: 'https://www.tallyidaho.com/bills' },
}

export const revalidate = 1800

interface Props {
  searchParams: Promise<{
    year?: string
    subject?: string
    chamber?: string
    controversial?: string
    status?: string
    sponsor?: string
    q?: string
    page?: string
    sort?: string
  }>
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = [1]
  if (current > 3) pages.push('...')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i)
  }
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
}

export default async function BillsPage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = createServerClient()

  const year = parseInt(params.year || '2026')
  const chamber = params.chamber || ''
  const subject = params.subject || ''
  const controversial = params.controversial === 'true'
  const status = params.status || ''
  const sponsorId = params.sponsor || ''
  const query = params.q || ''
  const page = parseInt(params.page || '1')
  const sort = params.sort || 'recent'
  const perPage = 25

  // Get session for this year
  const { data: session } = await supabase
    .from('sessions')
    .select('id, name, year_start')
    .eq('year_start', year)
    .single()

  // Parallel: subjects for filter dropdown + legislator IDs for sponsor dropdown
  const [{ data: subjectRows }, { data: legSessionRows }] = await Promise.all([
    supabase
      .from('bills')
      .select('subjects')
      .eq('session_id', session?.id || 0)
      .not('subjects', 'is', null)
      .limit(500),
    supabase
      .from('legislator_sessions')
      .select('legislator_id')
      .eq('session_id', session?.id || 0),
  ])

  const allSubjects = Array.from(
    new Set(
      (subjectRows || []).flatMap((r: any) => r.subjects || [])
    )
  ).sort() as string[]

  const legIds = (legSessionRows || []).map((r: any) => r.legislator_id).filter(Boolean)

  let legislators: any[] = []
  if (legIds.length > 0) {
    const { data: legRows } = await supabase
      .from('legislators')
      .select('id, name, role, party')
      .in('id', legIds)
      .in('role', ['Sen', 'Rep'])
      .order('name')
    legislators = legRows || []
  }

  // If sponsor filter active, resolve to bill IDs (two-step)
  let sponsorBillIds: string[] | null = null
  if (sponsorId) {
    const { data: sponsorRows } = await supabase
      .from('bill_sponsors')
      .select('bills(id)')
      .eq('legislator_id', sponsorId)
      .eq('sponsor_order', 1)
    sponsorBillIds = (sponsorRows || []).map((s: any) => s.bills?.id).filter(Boolean)
  }

  // Build query — filters first, then sort, then range
  let billsQuery = supabase
    .from('bills')
    .select(`
      id, bill_number, title, chamber,
      status, committee_name,
      is_controversial, controversy_reason,
      completed, last_action, last_action_date,
      subjects, plain_summary,
      bill_sponsors(sponsor_order, legislators(name, party, district)),
      roll_calls(yea_count, nay_count, passed)
    `, { count: 'exact' })
    .eq('session_id', session?.id || 0)

  if (chamber) billsQuery = billsQuery.eq('chamber', chamber)
  if (controversial) billsQuery = billsQuery.eq('is_controversial', true)
  if (query) billsQuery = billsQuery.or(`title.ilike.%${query}%,bill_number.ilike.%${query}%`)
  if (subject) billsQuery = billsQuery.contains('subjects', [subject])
  if (status === '1') billsQuery = billsQuery.eq('status', 1).eq('completed', false)
  else if (status === '2') billsQuery = billsQuery.eq('status', 2).eq('completed', false)
  else if (status === '3') billsQuery = billsQuery.eq('status', 3).eq('completed', false)
  else if (status === '4') billsQuery = billsQuery.eq('completed', true)
  else if (status === 'dead') {
    billsQuery = billsQuery.in('status', ['5', '6']).eq('completed', false)
  }
  else if (status === 'failed') {
    const { data: failedRcRows } = await supabase
      .from('roll_calls')
      .select('bills!inner(id)')
      .eq('passed', false)
      .eq('bills.session_id', session?.id || 0)
      .eq('bills.completed', false)
    const failedIds = [...new Set(((failedRcRows || []) as any[]).map(r => r.bills?.id).filter(Boolean))]
    billsQuery = failedIds.length > 0
      ? billsQuery.in('id', failedIds).eq('completed', false)
      : billsQuery.eq('id', '00000000-0000-0000-0000-000000000000')
  }
  if (sponsorBillIds !== null) {
    billsQuery = sponsorBillIds.length > 0
      ? billsQuery.in('id', sponsorBillIds)
      : billsQuery.eq('id', '00000000-0000-0000-0000-000000000000')
  }

  // Apply sort
  if (sort === 'bill_number') {
    billsQuery = billsQuery.order('bill_number', { ascending: true })
  } else if (sort === 'controversial') {
    billsQuery = billsQuery
      .order('is_controversial', { ascending: false })
      .order('last_action_date', { ascending: false })
  } else {
    // default: most recent activity
    billsQuery = billsQuery.order('last_action_date', { ascending: false })
  }

  billsQuery = billsQuery.range((page - 1) * perPage, page * perPage - 1)

  const { data: bills, count } = await billsQuery
  const totalPages = Math.ceil((count || 0) / perPage)

  // URL builder for server-side pagination links
  function filterUrl(overrides: Record<string, string | undefined>) {
    const next = { year: String(year), page: '1', ...params, ...overrides }
    const qs = Object.entries(next)
      .filter(([, v]) => v && v !== '' && v !== 'false')
      .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
      .join('&')
    return `/bills${qs ? `?${qs}` : ''}`
  }

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Idaho Bills — ${session?.name || `${year} Session`}`,
    description: `Browse all ${count?.toLocaleString()} Idaho legislative bills for the ${year} session.`,
    url: `https://www.tallyidaho.com/bills?year=${year}`,
    numberOfItems: count ?? 0,
    publisher: { '@type': 'Organization', name: 'Tally Idaho', url: 'https://www.tallyidaho.com' },
  }

  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
    <main className="max-w-7xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="mb-6">
        <nav className="text-xs text-slate-400 mb-3">
          <a href="/" className="hover:text-amber-600">Home</a>
          <span className="mx-2">›</span>
          <span className="text-slate-600">Bills</span>
        </nav>
        <h1 className="page-heading">Idaho Bills</h1>
        <p className="text-sm text-slate-500 mt-1">
          {count?.toLocaleString()} bill{count !== 1 ? 's' : ''} · {session?.name || `${year} Session`}
        </p>
      </div>

      {/* Filters — client component for search input */}
      <BillsFilters
        currentYear={year}
        currentChamber={chamber}
        currentSubject={subject}
        currentControversial={controversial}
        currentStatus={status}
        currentSponsor={sponsorId}
        currentQuery={query}
        currentSort={sort}
        subjects={allSubjects}
        legislators={legislators}
      />

      {/* Bills list */}
      <div className="space-y-2 mt-6">
        {(bills || []).map((bill: any) => {
          const sponsor = [...(bill.bill_sponsors || [])]
            .sort((a: any, b: any) => a.sponsor_order - b.sponsor_order)
            .find((s: any) => s.legislators)?.legislators

          const latestRc = bill.roll_calls?.[bill.roll_calls.length - 1]
          const yea = latestRc?.yea_count ?? 0
          const nay = latestRc?.nay_count ?? 0
          const total = yea + nay
          const yeaPct = total > 0 ? Math.round((yea / total) * 100) : 0

          const deadInfo = getBillDead(bill.status, bill.completed)

          const statusBorderLeft =
            bill.completed ? 'border-l-4 border-l-emerald-400' :
            deadInfo.dead ? 'border-l-4 border-l-slate-300' :
            bill.is_controversial && bill.controversy_reason === 'party_line' ? 'border-l-4 border-l-red-400' :
            bill.is_controversial ? 'border-l-4 border-l-orange-400' :
            (bill.status === '3' || bill.status === 3) ? 'border-l-4 border-l-blue-400' :
            (bill.status === '2' || bill.status === 2) ? 'border-l-4 border-l-amber-400' :
            ''

          return (
            <Link
              key={bill.id}
              href={`/bills/${year}/${bill.bill_number.toLowerCase()}`}
              className="block"
            >
              <div className={`rounded-xl bg-white border border-slate-200 ${statusBorderLeft} p-4 hover:border-amber-300 hover:shadow-sm transition-all`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
                        {bill.bill_number}
                      </span>
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full capitalize">
                        {bill.chamber}
                      </span>
                      {bill.is_controversial && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          bill.controversy_reason === 'party_line'
                            ? 'bg-red-50 text-red-600'
                            : 'bg-orange-50 text-orange-600'
                        }`}>
                          {bill.controversy_reason === 'party_line' ? 'PARTY LINE' : 'CLOSE VOTE'}
                        </span>
                      )}
                      {bill.completed && (
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          ✓ {bill.last_action?.toLowerCase().includes('law') ? 'Signed' : 'Completed'}
                        </span>
                      )}
                      {deadInfo.dead && (
                        <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                          ✗ {deadInfo.label}
                        </span>
                      )}
                      {bill.committee_name && !bill.completed && (
                        <span className="text-xs text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                          {bill.committee_name}
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-semibold text-slate-800 leading-snug">{bill.title}</p>

                    {bill.plain_summary && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {bill.plain_summary}
                      </p>
                    )}

                    {sponsor && (
                      <p className="text-xs text-slate-400 mt-1">
                        <Link
                          href={`/legislators/${legislatorSlug(sponsor.name)}`}
                          className="hover:text-amber-700 transition-colors"
                        >
                          {sponsor.name}
                        </Link>
                        {' · '}{sponsor.district}
                      </p>
                    )}
                    <BillStepperCompact
                      stage={getBillStage(bill.status, bill.completed, (bill.roll_calls?.length ?? 0) > 0)}
                      dead={deadInfo.dead}
                      deadLabel={deadInfo.label}
                    />
                  </div>

                  {latestRc && (
                    <div className="shrink-0 text-right w-28">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${yeaPct}%` }} />
                        </div>
                      </div>
                      <p className="text-xs text-slate-500">
                        <span className="text-emerald-600 font-bold">{yea}</span>
                        {' – '}
                        <span className="text-red-500 font-bold">{nay}</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Empty state */}
      {(bills || []).length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg mb-2">No bills found</p>
          <p className="text-sm">Try adjusting your filters.</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-10 flex-wrap">
          {page > 1 && (
            <Link
              href={filterUrl({ page: String(page - 1) })}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:border-amber-400 transition-colors"
            >
              ← Prev
            </Link>
          )}
          {getPageNumbers(page, totalPages).map((p, i) =>
            p === '...' ? (
              <span key={`ellipsis-${i}`} className="px-2 py-2 text-sm text-slate-400">…</span>
            ) : (
              <Link
                key={p}
                href={filterUrl({ page: String(p) })}
                className={`px-3 py-2 text-sm border rounded-lg transition-colors ${
                  p === page
                    ? 'bg-[#0f172a] text-white border-transparent'
                    : 'border-slate-300 hover:border-amber-400'
                }`}
              >
                {p}
              </Link>
            )
          )}
          {page < totalPages && (
            <Link
              href={filterUrl({ page: String(page + 1) })}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:border-amber-400 transition-colors"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </main>
    </>
  )
}
