import { Metadata } from 'next'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Idaho Legislative Committees | Tally Idaho',
  description: 'Browse Idaho Senate and House standing committees for 2025 and 2026. View committee membership rosters and assigned bills.',
  alternates: { canonical: 'https://www.tallyidaho.com/committees' },
}

export const revalidate = 300

interface Props {
  searchParams: Promise<{ year?: string }>
}

export default async function CommitteesPage({ searchParams }: Props) {
  const params = await searchParams
  const year = parseInt(params.year || '2026')
  const supabase = createServerClient()

  // Get session
  const { data: session } = await supabase
    .from('sessions')
    .select('id, name')
    .eq('year_start', year)
    .single()

  // Get all committees with their members
  const { data: committees } = session
    ? await supabase
        .from('committees')
        .select('id, code, name, short_name, chamber, committee_members(legislator_id)')
        .eq('session_id', session.id)
        .order('name')
    : { data: [] }

  const allCommittees = committees || []
  const senateCommittees = allCommittees.filter((c: any) => c.chamber === 'senate')
  const houseCommittees = allCommittees.filter((c: any) => c.chamber === 'house')
  const jointCommittees = allCommittees.filter((c: any) => c.chamber === 'joint' || c.chamber === 'unknown')

  function yearUrl(y: number) {
    return `/committees?year=${y}`
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">

      {/* Breadcrumb */}
      <nav className="text-xs text-slate-400 mb-4">
        <Link href="/" className="hover:text-amber-600">Home</Link>
        <span className="mx-2">›</span>
        <span className="text-slate-600">Committees</span>
      </nav>

      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-heading">Idaho Legislative Committees</h1>
          <p className="text-sm text-slate-500 mt-1">
            Standing committees · {session?.name || `${year} Session`}
          </p>
        </div>

        {/* Year tabs */}
        <div className="flex gap-1">
          {[2025, 2026].map(y => (
            <Link key={y} href={yearUrl(y)}>
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
      </div>

      {allCommittees.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <p className="text-lg mb-2">No committee data yet.</p>
          <p className="text-sm">Run <code className="bg-slate-100 px-1 rounded">npx tsx scripts/fetch-committees.ts</code> to import committee rosters.</p>
        </div>
      ) : (
        <div className="space-y-10">

          {/* Senate */}
          {senateCommittees.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="section-heading">Senate Committees</h2>
                <span className="text-xs text-slate-400">{senateCommittees.length} committees</span>
              </div>
              <CommitteeGrid committees={senateCommittees} year={year} />
            </section>
          )}

          {/* House */}
          {houseCommittees.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="section-heading">House Committees</h2>
                <span className="text-xs text-slate-400">{houseCommittees.length} committees</span>
              </div>
              <CommitteeGrid committees={houseCommittees} year={year} />
            </section>
          )}

          {/* Joint / other */}
          {jointCommittees.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="section-heading">Joint Committees</h2>
                <span className="text-xs text-slate-400">{jointCommittees.length} committees</span>
              </div>
              <CommitteeGrid committees={jointCommittees} year={year} />
            </section>
          )}

        </div>
      )}
    </main>
  )
}

function CommitteeGrid({
  committees,
  year,
}: {
  committees: any[]
  year: number
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {committees.map((c: any) => {
        const memberCount = (c.committee_members || []).length
        const chamberColor = c.chamber === 'senate'
          ? 'bg-blue-50 text-blue-700 border-blue-200'
          : c.chamber === 'house'
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-slate-50 text-slate-600 border-slate-200'

        return (
          <Link key={c.id} href={`/committees/${c.code}?year=${year}`}>
            <div className="bg-white border border-slate-200 rounded-xl p-4 hover:border-amber-300 hover:shadow-sm transition-all h-full flex flex-col">
              <h3 className="font-oswald text-base font-bold text-slate-800 leading-snug mb-auto tracking-tight uppercase">
                {c.short_name}
              </h3>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 text-xs text-slate-400">
                <span>{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
                <span className={`font-mono text-[10px] font-bold border px-1.5 py-0.5 rounded ${chamberColor}`}>
                  {c.code}
                </span>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
