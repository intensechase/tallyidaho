/**
 * sync-daily.ts
 *
 * Incremental daily sync for the active Idaho 2026 session.
 * Uses getMasterListRaw to detect changed bills, then fetches only those.
 *
 * Usage:
 *   npx tsx scripts/sync-daily.ts            # sync changed bills
 *   npx tsx scripts/sync-daily.ts --dry-run  # preview only, no DB writes
 *
 * API budget: ~1 + N_changed + N_new_rollcalls calls per run (well under 30k/month)
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { getMasterListRaw, getBill, getRollCall } from './lib/legiscan'
import { isCloseVote, isPartyLineVote, getControversyReason } from './lib/controversy'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const LEGISCAN_SESSION_ID = 2246 // 2026 Idaho Regular Session
const DRY_RUN = process.argv.includes('--dry-run')

function mapVote(voteCode: number): string {
  switch (voteCode) {
    case 1: return 'yea'
    case 2: return 'nay'
    case 3: return 'absent'
    default: return 'not_voting'
  }
}

function parseChamber(code: string): string {
  return code === 'H' ? 'house' : 'senate'
}

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  Tally Idaho — Daily Sync (2026 Session)')
  if (DRY_RUN) console.log('  DRY RUN — no DB writes')
  console.log('═══════════════════════════════════════════════════\n')

  // Get our internal session UUID
  const { data: sessionRow } = await supabase
    .from('sessions')
    .select('id, year_start')
    .eq('legiscan_session_id', LEGISCAN_SESSION_ID)
    .single()

  if (!sessionRow) {
    console.error('Session not found in DB. Run import-session.ts first.')
    process.exit(1)
  }
  const sessionUUID = sessionRow.id

  // Get all existing bills' change_hash from DB
  const { data: existingBills } = await supabase
    .from('bills')
    .select('id, legiscan_bill_id, change_hash')
    .eq('session_id', sessionUUID)

  const existingMap = new Map<number, { uuid: string; hash: string | null }>()
  for (const b of existingBills || []) {
    existingMap.set(b.legiscan_bill_id, { uuid: b.id, hash: b.change_hash })
  }
  console.log(`DB has ${existingMap.size} bills for this session`)

  // Get master list from LegiScan
  console.log('Fetching master list from LegiScan...')
  const masterList = await getMasterListRaw(LEGISCAN_SESSION_ID)

  // Extract bill entries (skip the 'session' metadata key)
  const masterBills = Object.values(masterList).filter(
    (v: any) => typeof v === 'object' && v.bill_id
  ) as any[]

  console.log(`LegiScan reports ${masterBills.length} bills in session\n`)

  // Find changed + new bills
  const toUpdate: any[] = []
  for (const mb of masterBills) {
    const existing = existingMap.get(mb.bill_id)
    if (!existing) {
      toUpdate.push({ ...mb, isNew: true })
    } else if (existing.hash !== mb.change_hash) {
      toUpdate.push({ ...mb, isNew: false, existingUUID: existing.uuid })
    }
  }

  console.log(`Found ${toUpdate.length} changed/new bills to sync`)
  if (toUpdate.length === 0) {
    console.log('\n✓ All bills up to date — nothing to sync')
    return
  }

  // Build legislator people_id → UUID map
  const { data: legislators } = await supabase
    .from('legislators')
    .select('id, legiscan_people_id')
  const legMap = new Map<number, string>()
  for (const l of legislators || []) {
    if (l.legiscan_people_id) legMap.set(l.legiscan_people_id, l.id)
  }

  // Get existing roll_call IDs to avoid re-fetching
  const { data: existingRollCalls } = await supabase
    .from('roll_calls')
    .select('legiscan_roll_call_id')
    .eq('session_id', sessionUUID)
  const existingRcIds = new Set((existingRollCalls || []).map((r: any) => r.legiscan_roll_call_id))

  let billsUpdated = 0
  let billsAdded = 0
  let rollCallsAdded = 0

  for (const mb of toUpdate) {
    process.stdout.write(`  ${mb.isNew ? '+ NEW' : '~ UPD'} ${mb.number?.padEnd(10)} `)

    // Fetch full bill data
    const bill = await getBill(mb.bill_id)
    const subjects = (bill.subjects || []).map((s: any) => s.subject_name)
    const chamberCode = parseChamber(bill.body || 'H')
    const lastAction = bill.history?.[bill.history.length - 1]?.action || null

    const billRow = {
      legiscan_bill_id: bill.bill_id,
      session_id: sessionUUID,
      bill_number: bill.bill_number,
      bill_type: bill.bill_type || null,
      chamber: chamberCode,
      title: bill.title,
      description: bill.description || null,
      status: String(bill.status || ''),
      status_date: bill.status_date || null,
      last_action: lastAction,
      last_action_date: bill.last_action_date || null,
      completed: bill.completed === 1,
      legiscan_url: bill.url || null,
      state_url: bill.state_link || null,
      subjects,
      change_hash: bill.change_hash || null,
      updated_at: new Date().toISOString(),
    }

    let billUUID = mb.existingUUID as string | undefined

    if (!DRY_RUN) {
      const { data: upserted } = await supabase
        .from('bills')
        .upsert(billRow, { onConflict: 'legiscan_bill_id' })
        .select('id')
      billUUID = upserted?.[0]?.id ?? billUUID

      // Upsert sponsors
      if (bill.sponsors?.length && billUUID) {
        for (const sponsor of bill.sponsors) {
          if (sponsor.committee_sponsor) continue
          const legUUID = legMap.get(sponsor.people_id)
          if (!legUUID) continue
          await supabase.from('bill_sponsors').upsert({
            bill_id: billUUID,
            legislator_id: legUUID,
            sponsor_order: sponsor.sponsor_order,
            sponsor_type: sponsor.sponsor_order === 1 ? 'primary' : 'cosponsor',
            committee_sponsor: false,
          }, { onConflict: 'bill_id,legislator_id' })
        }
      }
    }

    // Process new roll calls
    const newRollCalls = (bill.votes || []).filter(
      (v: any) => !existingRcIds.has(v.roll_call_id)
    )

    let controversyReason: string | null = null

    for (const rcRef of newRollCalls) {
      process.stdout.write('.')
      const rc = await getRollCall(rcRef.roll_call_id)

      const votes = (rc.votes || []).map((v: any) => ({
        people_id: v.people_id,
        legislator_uuid: legMap.get(v.people_id),
        vote: mapVote(v.vote_id),
        party: v.party || '',
      }))

      const yeaCount = rc.yea || 0
      const nayCount = rc.nay || 0
      const absentCount = rc.absent || 0
      const nvCount = rc.nv || 0
      const totalCount = yeaCount + nayCount + absentCount + nvCount
      const voteMargin = totalCount > 0 ? Math.abs(yeaCount - nayCount) / totalCount * 100 : 0

      const isClose = isCloseVote(yeaCount, nayCount, totalCount)
      const isPartyLine = isPartyLineVote(votes)
      const reason = getControversyReason(isClose, isPartyLine)
      if (reason) controversyReason = reason

      if (!DRY_RUN && billUUID) {
        const { data: rcUpserted } = await supabase
          .from('roll_calls')
          .upsert({
            legiscan_roll_call_id: rc.roll_call_id,
            bill_id: billUUID,
            session_id: sessionUUID,
            date: rc.date || null,
            description: rc.desc || null,
            chamber: parseChamber(rc.chamber || 'H'),
            yea_count: yeaCount,
            nay_count: nayCount,
            absent_count: absentCount,
            nv_count: nvCount,
            total_count: totalCount,
            passed: rc.passed === 1,
            vote_margin: parseFloat(voteMargin.toFixed(2)),
            is_party_line: isPartyLine,
          }, { onConflict: 'legiscan_roll_call_id' })
          .select('id')

        if (rcUpserted?.[0]) {
          existingRcIds.add(rc.roll_call_id)
          rollCallsAdded++

          const voteRows = votes
            .filter((v: any) => v.legislator_uuid)
            .map((v: any) => ({
              roll_call_id: rcUpserted[0].id,
              legislator_id: v.legislator_uuid,
              vote: v.vote,
            }))

          if (voteRows.length > 0) {
            await supabase.from('legislator_votes').upsert(voteRows, {
              onConflict: 'roll_call_id,legislator_id',
            })
          }
        }
      }
    }

    // Update controversy flags if any new roll call was controversial
    if (!DRY_RUN && billUUID && controversyReason) {
      await supabase.from('bills').update({
        is_controversial: true,
        controversy_reason: controversyReason,
      }).eq('id', billUUID)
    }

    process.stdout.write(` ✓\n`)
    if (mb.isNew) billsAdded++
    else billsUpdated++
  }

  console.log('\n═══════════════════════════════════════════════════')
  console.log(`  Bills updated : ${billsUpdated}`)
  console.log(`  Bills added   : ${billsAdded}`)
  console.log(`  Roll calls    : ${rollCallsAdded}`)
  console.log('═══════════════════════════════════════════════════')
}

main().catch(err => {
  console.error('\nSync failed:', err.message)
  process.exit(1)
})
