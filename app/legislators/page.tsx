import { Metadata } from 'next'
import { createServerClient } from '@/lib/supabase/server'
import { legislatorSlug } from '@/lib/slugify'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Idaho Legislators | Tally Idaho',
  description: 'Browse all Idaho state legislators by district. View senators and representatives, their party, voting records, and bills sponsored.',
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

  const { data: session } = await supabase
    .from('sessions')
    .select('id, name')
    .eq('year_start', year)
    .single()

  const { data: legSessions } = await supabase
    .from('legislator_sessions')
    .select('legislators(id, name, party, role, district, chamber, photo_url)')
    .eq('session_id', session?.id || 0)

  const all = (legSessions || [])
    .map((ls: any) => ls.legislators)
    .filter(Boolean)
    .filter((l: any) => (l.role === 'Sen' || l.role === 'Rep') && l.district)

  // Apply filters
  let filtered = all
  if (chamber) filtered = filtered.filter((l: any) => l.chamber?.toLowerCase() === chamber)
  if (party)   filtered = filtered.filter((l: any) => l.party === party)

  // Group by district number for the by-district view
  const byDistrict: Record<number, { senator?: any; reps: any[] }> = {}
  for (let i = 1; i <= 35; i++) byDistrict[i] = { reps: [] }

  all.forEach((l: any) => {
    const n = parseInt(l.district?.replace(/\D/g, '') || '0')
    if (n < 1 || n > 35) return
    if (l.role === 'Sen') byDistrict[n].senator = l
    else byDistrict[n].reps.push(l)
  })

  // Are we in filtered mode (chamber or party selected)?
  const isFiltered = !!(chamber || party)

  // For filtered grid: sort by district then role
  filtered.sort((a: any, b: any) => {
    const da = parseInt(a.district?.replace(/\D/g, '') || '0')
    const db = parseInt(b.district?.replace(/\D/g, '') || '0')
    if (da !== db) return da - db
    if (a.role === 'Sen') return -1
    if (b.role === 'Sen') return 1
    return a.name.localeCompare(b.name)
  })

  function filterUrl(overrides: Record<string, string | undefined>) {
    const next = { year: String(year), chamber, party, ...overrides }
    const qs = Object.entries(next)
      .filter(([, v]) => v && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
      .join('&')
    return `/legislators${qs ? `?${qs}` : ''}`
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">

      <nav className="text-xs text-slate-400 mb-4">
        <Link href="/" className="hover:text-amber-600">Home</Link>
        <span className="mx-2">›</span>
        <span className="text-slate-600">Legislators</span>
      </nav>

      <div className="mb-6">
        <h1 className="font-playfair text-3xl font-black text-slate-900">Idaho Legislators</h1>
        <p className="text-sm text-slate-500 mt-1">
          {isFiltered ? `${filtered.length} legislators` : '105 legislators across 35 districts'} · {session?.name || `${year} Session`}
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap mb-8 text-sm">
        <div className="flex gap-1">
          {(['', 'senate', 'house'] as const).map(c => (
            <Link key={c} href={filterUrl({ chamber: c || undefined, party: party || undefined })}>
              <span className={`inline-block px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                chamber === c || (c === '' && !chamber)
                  ? 'bg-[#0f172a] text-white border-transparent'
                  : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400'
              }`}>
                {c === '' ? 'All' : c === 'senate' ? 'Senate' : 'House'}
              </span>
            </Link>
          ))}
        </div>
        <div className="flex gap-1">
          {(['', 'R', 'D', 'I'] as const).map(p => (
            <Link key={p} href={filterUrl({ party: p || undefined, chamber: chamber || undefined })}>
              <span className={`inline-block px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                party === p || (p === '' && !party)
                  ? 'bg-[#0f172a] text-white border-transparent'
                  : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400'
              }`}>
                {p === '' ? 'All parties' : p === 'R' ? 'Republican' : p === 'D' ? 'Democrat' : 'Independent'}
              </span>
            </Link>
          ))}
        </div>
        {isFiltered && (
          <Link href="/legislators" className="text-xs text-slate-400 hover:text-red-500 transition-colors ml-1">
            ✕ Clear
          </Link>
        )}
      </div>

      {/* ── By-district view (default) ── */}
      {!isFiltered && (
        <div className="space-y-2">
          {Array.from({ length: 35 }, (_, i) => i + 1).map(n => {
            const { senator, reps } = byDistrict[n]
            return (
              <div key={n} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-stretch">

                  {/* District number */}
                  <Link href={`/districts/${n}`} className="flex items-center justify-center w-14 shrink-0 bg-slate-50 border-r border-slate-100 hover:bg-amber-50 transition-colors">
                    <span className="font-playfair font-black text-xl text-slate-700">{n}</span>
                  </Link>

                  {/* Legislators */}
                  <div className="flex flex-1 divide-x divide-slate-100">
                    {/* Senator */}
                    <div className="flex-1 min-w-0">
                      {senator
                        ? <LegCell leg={senator} role="Sen" />
                        : <EmptyCell label="Sen" />
                      }
                    </div>
                    {/* Rep 1 */}
                    <div className="flex-1 min-w-0">
                      {reps[0]
                        ? <LegCell leg={reps[0]} role="Rep" />
                        : <EmptyCell label="Rep" />
                      }
                    </div>
                    {/* Rep 2 */}
                    <div className="flex-1 min-w-0">
                      {reps[1]
                        ? <LegCell leg={reps[1]} role="Rep" />
                        : <EmptyCell label="Rep" />
                      }
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Filtered grid view ── */}
      {isFiltered && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map((leg: any) => (
            <LegCard key={leg.id} leg={leg} />
          ))}
          {filtered.length === 0 && (
            <p className="col-span-5 text-center py-16 text-slate-400">No legislators found.</p>
          )}
        </div>
      )}
    </main>
  )
}

// ── Row cell for the by-district view ──────────────────────────────────────
function LegCell({ leg, role }: { leg: any; role: string }) {
  const slug = legislatorSlug(leg.name)
  const partyColor =
    leg.party === 'R' ? 'bg-red-500' :
    leg.party === 'D' ? 'bg-blue-500' : 'bg-slate-400'

  return (
    <Link href={`/legislators/${slug}`} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-amber-50 transition-colors h-full group">
      {/* Photo */}
      <div className="w-9 h-9 rounded-full bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
        {leg.photo_url
          ? <img src={leg.photo_url} alt={leg.name} className="w-full h-full object-cover" />
          : <span className={`text-[10px] font-bold text-white ${partyColor} w-full h-full flex items-center justify-center`}>{leg.party}</span>
        }
      </div>
      {/* Info */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`text-[9px] font-bold text-white ${partyColor} rounded-full px-1.5 py-0.5 shrink-0`}>{leg.party}</span>
          <span className="text-[10px] text-slate-400">{role}</span>
        </div>
        <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-amber-700 transition-colors leading-tight">
          {leg.name}
        </p>
      </div>
    </Link>
  )
}

function EmptyCell({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 h-full opacity-30">
      <div className="w-9 h-9 rounded-full bg-slate-100 shrink-0" />
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  )
}

// ── Card for filtered grid view ─────────────────────────────────────────────
function LegCard({ leg }: { leg: any }) {
  const slug = legislatorSlug(leg.name)
  const distNum = parseInt(leg.district?.replace(/\D/g, '') || '0')
  const partyColor =
    leg.party === 'R' ? 'bg-red-500' :
    leg.party === 'D' ? 'bg-blue-500' : 'bg-slate-400'

  return (
    <Link href={`/legislators/${slug}`}>
      <div className="bg-white border border-slate-200 rounded-xl p-3 hover:border-amber-300 hover:shadow-sm transition-all text-center">
        <div className="w-16 h-16 rounded-full bg-slate-100 mx-auto mb-2 overflow-hidden flex items-center justify-center">
          {leg.photo_url
            ? <img src={leg.photo_url} alt={leg.name} className="w-full h-full object-cover" />
            : <span className={`text-sm font-bold text-white ${partyColor} w-full h-full flex items-center justify-center`}>{leg.party}</span>
          }
        </div>
        <p className="text-xs font-semibold text-slate-800 leading-snug">{leg.name}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {leg.role === 'Sen' ? 'Sen.' : 'Rep.'} · Dist. {distNum}
        </p>
      </div>
    </Link>
  )
}
