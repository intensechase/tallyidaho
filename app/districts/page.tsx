import { Metadata } from 'next'
import { createServerClient } from '@/lib/supabase/server'
import { legislatorSlug } from '@/lib/slugify'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Idaho Legislative Districts | Tally Idaho',
  description: 'Browse all 35 Idaho legislative districts. See your senator and representatives, their party, and the area they represent.',
}

export const revalidate = 86400

// Approximate geographic description per district
const DISTRICT_AREAS: Record<number, string> = {
  1:  'Boundary & Bonner Counties',
  2:  'Coeur d\'Alene · Kootenai Co.',
  3:  'Coeur d\'Alene · Kootenai Co.',
  4:  'Post Falls · Kootenai Co.',
  5:  'Hayden · Kootenai Co.',
  6:  'Moscow · Latah & Benewah',
  7:  'Moscow · Latah Co.',
  8:  'Lewiston · Nez Perce Co.',
  9:  'Grangeville · Idaho & Adams Co.',
  10: 'Lewiston · Nez Perce & Latah',
  11: 'Twin Falls',
  12: 'Twin Falls & Cassia Co.',
  13: 'Sun Valley · Blaine & Camas',
  14: 'Twin Falls East',
  15: 'Gooding · Lincoln & Minidoka',
  16: 'Burley · Cassia & Minidoka',
  17: 'Pocatello · Bannock Co.',
  18: 'Pocatello · Bannock Co.',
  19: 'Soda Springs · SE Idaho',
  20: 'Idaho Falls · Bonneville Co.',
  21: 'Idaho Falls · Bonneville Co.',
  22: 'Idaho Falls · Bonneville Co.',
  23: 'Rigby · Jefferson & Clark Co.',
  24: 'Rexburg · Madison Co.',
  25: 'Blackfoot · Bingham Co.',
  26: 'Nampa · Canyon Co.',
  27: 'Caldwell · Canyon Co.',
  28: 'Nampa & Meridian · Canyon Co.',
  29: 'West Boise · Ada Co.',
  30: 'North Boise · Ada Co.',
  31: 'Boise · Ada Co.',
  32: 'East Boise · Ada Co.',
  33: 'SE Boise · Ada Co.',
  34: 'Meridian & Eagle · Ada Co.',
  35: 'Mountain Home · Elmore & Ada',
}

export default async function DistrictsPage() {
  const supabase = createServerClient()

  const { data: session } = await supabase
    .from('sessions')
    .select('id')
    .eq('year_start', 2026)
    .single()

  const { data: legSessions } = await supabase
    .from('legislator_sessions')
    .select('legislators(id, name, party, role, district, photo_url)')
    .eq('session_id', session?.id || 0)

  // Group by district number, filter out committees
  const byDistrict: Record<number, any[]> = {}
  for (let i = 1; i <= 35; i++) byDistrict[i] = []

  ;(legSessions || []).forEach((ls: any) => {
    const leg = ls.legislators
    if (!leg) return
    if ((leg.role !== 'Sen' && leg.role !== 'Rep') || !leg.district) return
    const distNum = parseInt(leg.district?.replace(/\D/g, '') || '0')
    if (distNum >= 1 && distNum <= 35) byDistrict[distNum].push(leg)
  })

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <nav className="text-xs text-slate-400 mb-4">
        <Link href="/" className="hover:text-amber-600">Home</Link>
        <span className="mx-2">›</span>
        <span className="text-slate-600">Districts</span>
      </nav>

      <div className="mb-8">
        <h1 className="font-oswald text-4xl font-bold tracking-tight text-slate-900">Idaho Legislative Districts</h1>
        <p className="text-sm text-slate-500 mt-2">
          35 districts · each elects 1 senator and 2 representatives
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 35 }, (_, i) => i + 1).map(n => {
          const legs = byDistrict[n]
          const senator = legs.find((l: any) => l.role === 'Sen')
          const reps = legs.filter((l: any) => l.role === 'Rep')
          const area = DISTRICT_AREAS[n] || ''

          return (
            <Link key={n} href={`/districts/${n}`}>
              <div className="bg-white border border-slate-200 rounded-xl p-4 hover:border-amber-300 hover:shadow-sm transition-all h-full">

                {/* District header */}
                <div className="mb-3">
                  <div className="flex items-baseline gap-2">
                    <span className="font-oswald text-3xl font-bold text-slate-900 leading-none tracking-tight">
                      {n}
                    </span>
                    <span className="font-oswald text-xs font-semibold text-amber-500 tracking-widest uppercase leading-none">
                      District
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{area}</p>
                </div>

                {/* Legislators */}
                <div className="space-y-2">
                  {senator && (
                    <LegRow leg={senator} label="Sen" />
                  )}
                  {reps.map((rep: any) => (
                    <LegRow key={rep.id} leg={rep} label="Rep" />
                  ))}
                  {legs.length === 0 && (
                    <p className="text-xs text-slate-300 italic">No data</p>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      <div className="mt-10 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-slate-600">
        <p className="font-semibold mb-1">Don&apos;t know your district?</p>
        <p>
          Enter your address on the{' '}
          <Link href="/" className="text-amber-700 hover:underline">homepage</Link>
          {' '}to look up your district and legislators instantly.
        </p>
      </div>
    </main>
  )
}

function LegRow({ leg, label }: { leg: any; label: string }) {
  const partyColor =
    leg.party === 'R' ? 'bg-red-500' :
    leg.party === 'D' ? 'bg-blue-500' : 'bg-slate-400'

  return (
    <div className="flex items-center gap-2">
      <span className={`text-[10px] font-bold text-white ${partyColor} rounded-full w-5 h-5 flex items-center justify-center shrink-0`}>
        {leg.party}
      </span>
      <span className="text-xs text-slate-400 w-6 shrink-0">{label}</span>
      <span className="text-xs font-semibold text-slate-800 truncate">{leg.name}</span>
    </div>
  )
}
