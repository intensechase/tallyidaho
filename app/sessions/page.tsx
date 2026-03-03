import { Metadata } from 'next'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Idaho Legislative Sessions | Tally Idaho',
  description: 'Browse Idaho legislative sessions from 2016 to present. View bills, votes, and activity for each session.',
  alternates: { canonical: 'https://www.tallyidaho.com/sessions' },
}

export const revalidate = 86400

export default async function SessionsPage() {
  const supabase = createServerClient()

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, name, year_start, year_end, sine_die, is_special, is_current')
    .order('year_start', { ascending: false })

  // Get bill counts + enacted counts per session
  const countsBySession: Record<string, { total: number; enacted: number }> = {}
  await Promise.all(
    (sessions || []).map(async (s: any) => {
      const [{ count: total }, { count: enacted }] = await Promise.all([
        supabase.from('bills').select('*', { count: 'exact', head: true }).eq('session_id', s.id),
        supabase.from('bills').select('*', { count: 'exact', head: true }).eq('session_id', s.id).eq('completed', true),
      ])
      countsBySession[s.id] = { total: total ?? 0, enacted: enacted ?? 0 }
    })
  )

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">

      <nav className="text-xs text-slate-400 mb-6">
        <a href="/" className="hover:text-amber-600">Home</a>
        <span className="mx-2">›</span>
        <span className="text-slate-600">Sessions</span>
      </nav>

      <h1 className="page-heading mb-2">Idaho Legislative Sessions</h1>
      <p className="text-sm text-slate-500 mb-8">
        All sessions tracked from 2016 to present — regular and special sessions.
      </p>

      <div className="space-y-3">
        {(sessions || []).map((s: any) => {
          const { total: billCount, enacted: enactedCount } = countsBySession[s.id] || { total: 0, enacted: 0 }
          const isCurrent = s.is_current && !s.sine_die

          return (
            <Link
              key={s.id}
              href={`/sessions/${s.year_start}`}
              className="block"
            >
              <div className="bg-white border border-slate-200 rounded-xl p-4 hover:border-amber-300 hover:shadow-sm transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-800">{s.name}</span>
                      {isCurrent && (
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          LIVE
                        </span>
                      )}
                      {s.is_special && (
                        <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                          SPECIAL
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">
                      {billCount.toLocaleString()} bills
                      {enactedCount > 0 && (
                        <span> · <span className="text-emerald-600 font-medium">{enactedCount.toLocaleString()} enacted</span></span>
                      )}
                      {s.sine_die ? ' · Adjourned' : ' · In progress'}
                    </p>
                  </div>
                  <span className="text-2xl font-bold text-slate-200 font-playfair">{s.year_start}</span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </main>
  )
}
