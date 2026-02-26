/**
 * check-committees-db.ts
 * Quick diagnostic: show what's in the committees/sessions tables.
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  // 1. Sessions
  const { data: sessions, error: sErr } = await supabase
    .from('sessions')
    .select('id, name, year_start')
    .order('year_start')

  console.log('\n── SESSIONS ─────────────────────────────────')
  if (sErr) console.error('Error:', sErr.message)
  else sessions?.forEach(s => console.log(`  ${s.year_start}  ${s.name}  (${s.id})`))

  // 2. Committees count per session
  console.log('\n── COMMITTEES ───────────────────────────────')
  const { data: committees, error: cErr } = await supabase
    .from('committees')
    .select('id, code, name, chamber, session_id')
    .order('name')

  if (cErr) { console.error('Error:', cErr.message); process.exit(1) }

  if (!committees || committees.length === 0) {
    console.log('  ⚠ NO COMMITTEES IN DB')
  } else {
    const bySession: Record<string, any[]> = {}
    for (const c of committees) {
      bySession[c.session_id] = bySession[c.session_id] || []
      bySession[c.session_id].push(c)
    }
    for (const [sid, cs] of Object.entries(bySession)) {
      const sess = sessions?.find(s => s.id === sid)
      console.log(`\n  Session ${sess?.year_start ?? sid} (${cs.length} committees):`)
      cs.slice(0, 5).forEach(c => console.log(`    [${c.chamber}] ${c.code} — ${c.name}`))
      if (cs.length > 5) console.log(`    ... and ${cs.length - 5} more`)
    }
  }

  // 3. Committee members count
  console.log('\n── COMMITTEE_MEMBERS ────────────────────────')
  const { count: memberCount, error: mErr } = await supabase
    .from('committee_members')
    .select('*', { count: 'exact', head: true })

  if (mErr) console.error('Error:', mErr.message)
  else console.log(`  Total rows: ${memberCount ?? 0}`)

  // 4. Test the exact query the page runs (year 2026)
  console.log('\n── PAGE QUERY TEST (year=2026) ──────────────')
  const { data: session2026 } = await supabase
    .from('sessions')
    .select('id, name, year_start')
    .eq('year_start', 2026)
    .single()

  if (!session2026) {
    console.log('  ⚠ No session found for year_start=2026')
  } else {
    console.log(`  Session: ${session2026.name} (${session2026.id})`)
    const { data: c2026, error: c2Err } = await supabase
      .from('committees')
      .select('id, code, name, chamber, committee_members(id)')
      .eq('session_id', session2026.id)
      .order('name')
    if (c2Err) console.error('  Query error:', c2Err.message)
    else console.log(`  Committees returned: ${c2026?.length ?? 0}`)
  }

  console.log()
}

main().catch(err => { console.error(err); process.exit(1) })
