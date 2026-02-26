import { Metadata } from 'next'
import { createServerClient } from '@/lib/supabase/server'
import { legislatorSlug } from '@/lib/slugify'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Idaho Legislators | Tally Idaho',
  description: 'Browse Idaho state legislators — senators and representatives. View voting records, bills sponsored, and party-line vote statistics.',
}

export const revalidate = 86400

interface Props {
  searchParams: Promise<{ chamber?: string; party?: string; year?: string }>
}

export default async function LegislatorsPage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = createServerClient()

  const year = parseInt(params.year || '2026')
  const chamber = params.chamber || ''
  const party = params.party || ''

  // Get session
  const { data: session } = await supabase
    .from('sessions')
    .select('id, name')
    .eq('year_start', year)
    .single()

  // Get legislators for this session via legislator_sessions
  let query = supabase
    .from('legislator_sessions')
    .select('legislators(id, name, party, role, district, chamber, photo_url)')
    .eq('session_id', session?.id || 0)

  const { data: legSessions } = await query

  let legislators = (legSessions || [])
    .map((ls: any) => ls.legislators)
    .filter(Boolean)
    // Remove committee entries — real legislators have a role of Senator or Representative
    .filter((l: any) => l.role === 'Senator' || l.role === 'Representative')

  // Filter client-side (Supabase nested filter can be complex)
  if (chamber) legislators = legislators.filter((l: any) => l.chamber === chamber)
  if (party) legislators = legislators.filter((l: any) => l.party === party)

  // Sort: Senator before Rep, then alphabetically within district
  legislators.sort((a: any, b: any) => {
    const distA = parseInt(a.district?.replace(/\D/g, '') || '0')
    const distB = parseInt(b.district?.replace(/\D/g, '') || '0')
    if (distA !== distB) return distA - distB
    if (a.role === 'Senator' && b.role !== 'Senator') return -1
    if (b.role === 'Senator' && a.role !== 'Senator') return 1
    return a.name.localeCompare(b.name)
  })

  const senators = legislators.filter((l: any) => l.role === 'Senator')
  const reps = legislators.filter((l: any) => l.role !== 'Senator')

  const filterUrl = (overrides: Record<string, string | undefined>) => {
    const next = { year: String(year), chamber, party, ...overrides }
    const qs = Object.entries(next)
      .filter(([, v]) => v && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
      .join('&')
    return `/legislators${qs ? `?${qs}` : ''}`
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">

      <div className="mb-6">
        <nav className="text-xs text-slate-400 mb-3">
          <a href="/" className="hover:text-amber-600">Home</a>
          <span className="mx-2">›</span>
          <span className="text-slate-600">Legislators</span>
        </nav>
        <h1 className="text-2xl font-bold text-slate-900">Idaho Legislators</h1>
        <p className="text-sm text-slate-500 mt-1">
          {legislators.length} legislators · {session?.name || `${year} Session`}
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap mb-8 text-sm">
        {/* Chamber */}
        <div className="flex gap-1">
          {(['', 'senate', 'house'] as const).map(c => (
            <Link
              key={c}
              href={filterUrl({ chamber: c || undefined })}
              className={`px-3 py-1.5 rounded-lg border transition-colors ${
                (chamber === c) || (c === '' && !chamber)
                  ? 'bg-[#0f172a] text-white border-transparent'
                  : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400'
              }`}
            >
              {c === '' ? 'All' : c === 'senate' ? 'Senate' : 'House'}
            </Link>
          ))}
        </div>

        {/* Party */}
        <div className="flex gap-1">
          {(['', 'R', 'D', 'I'] as const).map(p => (
            <Link
              key={p}
              href={filterUrl({ party: p || undefined })}
              className={`px-3 py-1.5 rounded-lg border transition-colors ${
                party === p || (p === '' && !party)
                  ? 'bg-[#0f172a] text-white border-transparent'
                  : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400'
              }`}
            >
              {p === '' ? 'All parties' : p === 'R' ? 'Republican' : p === 'D' ? 'Democrat' : 'Independent'}
            </Link>
          ))}
        </div>
      </div>

      {/* Senate section */}
      {(!chamber || chamber === 'senate') && senators.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-4">SENATE ({senators.length})</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {senators.map((leg: any) => (
              <LegislatorCard key={leg.id} leg={leg} />
            ))}
          </div>
        </section>
      )}

      {/* House section */}
      {(!chamber || chamber === 'house') && reps.length > 0 && (
        <section>
          <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-4">HOUSE OF REPRESENTATIVES ({reps.length})</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {reps.map((leg: any) => (
              <LegislatorCard key={leg.id} leg={leg} />
            ))}
          </div>
        </section>
      )}

      {legislators.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <p>No legislators found for these filters.</p>
        </div>
      )}
    </main>
  )
}

function LegislatorCard({ leg }: { leg: any }) {
  const slug = legislatorSlug(leg.name)
  const distNum = parseInt(leg.district?.replace(/\D/g, '') || '0') || ''

  return (
    <Link href={`/legislators/${slug}`}>
      <div className="bg-white border border-slate-200 rounded-xl p-3 hover:border-amber-300 hover:shadow-sm transition-all text-center">
        {/* Photo or placeholder */}
        <div className="w-14 h-14 rounded-full bg-slate-100 mx-auto mb-2 overflow-hidden flex items-center justify-center">
          {leg.photo_url
            ? <img src={leg.photo_url} alt={leg.name} className="w-full h-full object-cover" />
            : <span className={`party-badge party-${leg.party?.toLowerCase()} text-sm w-10 h-10`}>{leg.party}</span>
          }
        </div>
        <p className="text-xs font-semibold text-slate-800 leading-tight">{leg.name}</p>
        <p className="text-xs text-slate-400 mt-0.5">Dist. {distNum}</p>
        <p className="text-xs text-slate-400">{leg.role === 'Senator' ? 'Sen.' : 'Rep.'}</p>
      </div>
    </Link>
  )
}
