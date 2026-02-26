import { Metadata } from 'next'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import BillsFilters from '@/components/BillsFilters'
import { BillStepperCompact, getBillStage } from '@/components/BillStatusStepper'
import { legislatorSlug } from '@/lib/slugify'

export const metadata: Metadata = {
  title: 'Idaho Bills | Tally Idaho',
  description: 'Browse Idaho legislative bills by session, topic, chamber, and controversy. Track votes, sponsors, and outcomes.',
}

export const revalidate = 3600

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
  }>
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

  // Build query
  let billsQuery = supabase
    .from('bills')
    .select(`
      id, bill_number, title, chamber,
      status, committee_name,
      is_controversial, controversy_reason,
      completed, last_action, last_action_date,
      subjects,
      bill_sponsors(sponsor_order, legislators(name, party, district)),
      roll_calls(yea_count, nay_count, passed)
    `, { count: 'exact' })
    .eq('session_id', session?.id || 0)
    .order('bill_number', { ascending: true })
    .range((page - 1) * perPage, page * perPage - 1)

  if (chamber) billsQuery = billsQuery.eq('chamber', chamber)
  if (controversial) billsQuery = billsQuery.eq('is_controversial', true)
  if (query) billsQuery = billsQuery.or(`title.ilike.%${query}%,bill_number.ilike.%${query}%`)
  if (subject) billsQuery = billsQuery.contains('subjects', [subject])
  if (status === '1') billsQuery = billsQuery.eq('status', 1).eq('completed', false)
  else if (status === '2') billsQuery = billsQuery.eq('status', 2).eq('completed', false)
  else if (status === '3') billsQuery = billsQuery.eq('status', 3).eq('completed', false)
  else if (status === '4') billsQuery = billsQuery.eq('completed', true)
  if (sponsorBillIds !== null) {
    billsQuery = sponsorBillIds.length > 0
      ? billsQuery.in('id', sponsorBillIds)
      : billsQuery.eq('id', '00000000-0000-0000-0000-000000000000')
  }

  const { data: bills, count } = await billsQuery
  const totalPages = Math.ceil((count || 0) / perPage)

  // URL builder for server-side pagination links only (not passed to client components)
  function filterUrl(overrides: Record<string, string | undefined>) {
    const next = { year: String(year), ...params, ...overrides, page: '1' }
    const qs = Object.entries(next)
      .filter(([, v]) => v && v !== '' && v !== 'false')
      .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
      .join('&')
    return `/bills${qs ? `?${qs}` : ''}`
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="mb-6">
        <nav className="text-xs text-slate-400 mb-3">
          <a href="/" className="hover:text-amber-600">Home</a>
          <span className="mx-2">›</span>
          <span className="text-slate-600">Bills</span>
        </nav>
        <h1 className="text-2xl font-bold text-slate-900">Idaho Bills</h1>
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

          return (
            <Link
              key={bill.id}
              href={`/bills/${year}/${bill.bill_number.toLowerCase()}`}
              className="block"
            >
              <div className="rounded-xl bg-white border border-slate-200 p-4 hover:border-amber-300 hover:shadow-sm transition-all">
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
                      {bill.committee_name && !bill.completed && (
                        <span className="text-xs text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                          {bill.committee_name}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-800 leading-snug">{bill.title}</p>
                    {sponsor && (
                      <p className="text-xs text-slate-400 mt-1">
                        <Link
                          href={`/legislators/${legislatorSlug(sponsor.name)}`}
                          onClick={e => e.stopPropagation()}
                          className="hover:text-amber-700 transition-colors"
                        >
                          {sponsor.name}
                        </Link>
                        {' · '}{sponsor.district}
                      </p>
                    )}
                    <BillStepperCompact stage={getBillStage(bill.status, bill.completed)} />
                  </div>

                  {latestRc && (
                    <div className="shrink-0 text-right w-28">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
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
        <div className="flex items-center justify-center gap-2 mt-10">
          {page > 1 && (
            <Link
              href={filterUrl({ page: String(page - 1) })}
              className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:border-amber-400 transition-colors"
            >
              ← Previous
            </Link>
          )}
          <span className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={filterUrl({ page: String(page + 1) })}
              className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:border-amber-400 transition-colors"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </main>
  )
}
