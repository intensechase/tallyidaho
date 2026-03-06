/**
 * Core sync logic for the Idaho 2026 session.
 * Imported by both the CLI script (scripts/sync-daily.ts) and the Vercel cron API route.
 * Does NOT import dotenv — callers are responsible for env vars being set.
 */

import { createClient } from '@supabase/supabase-js'
import { extractPdfText } from '../scripts/lib/pdf-extract'
import { getMasterListRaw, getBill, getRollCall } from '../scripts/lib/legiscan'
import { isCloseVote, isPartyLineVote, getControversyReason } from '../scripts/lib/controversy'
import { parseSop, matchSponsorName, splitSponsorNames } from './sop-sponsors'

const LEGIS_BASE = 'https://legislature.idaho.gov/wp-content/uploads/sessioninfo'
const LEGISCAN_SESSION_ID = 2246 // 2026 Idaho Regular Session

async function fetchBillText(year: number, billNumber: string): Promise<string | null> {
  try {
    const { PDFParse } = await import('pdf-parse' as any)
    const num = billNumber.replace(/\s+/g, '').toUpperCase()
    const res = await fetch(`${LEGIS_BASE}/${year}/legislation/${num}.pdf`)
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    const raw = result.text?.trim() ?? ''
    if (!raw || raw.length < 50) return null
    return raw
      .split('\n')
      .map((line: string) => line.replace(/^\s*\d{1,3}\s{1,4}/, '').trimEnd())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim() || null
  } catch {
    return null
  }
}

async function fetchRawSop(year: number, billNumber: string): Promise<string | null> {
  try {
    const num = billNumber.replace(/\s+/g, '').toUpperCase()
    const res = await fetch(`${LEGIS_BASE}/${year}/legislation/${num}SOP.pdf`)
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    const raw = await extractPdfText(buffer)
    return raw && raw.length >= 30 ? raw : null
  } catch {
    return null
  }
}

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

export interface SyncResult {
  billsUpdated: number
  billsAdded: number
  rollCallsAdded: number
  apiQueryCount: number
  skipped: boolean
}

export async function runSync({ dryRun = false }: { dryRun?: boolean } = {}): Promise<SyncResult> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let apiQueryCount = 0
  function counted<T>(fn: () => Promise<T>): Promise<T> {
    apiQueryCount++
    return fn()
  }

  const { data: sessionRow } = await supabase
    .from('sessions')
    .select('id, year_start')
    .eq('year_start', 2026)
    .single()

  if (!sessionRow) throw new Error('2026 session not found in DB')
  const sessionUUID = sessionRow.id

  const { data: existingBills } = await supabase
    .from('bills')
    .select('id, legiscan_bill_id, change_hash, plain_summary')
    .eq('session_id', sessionUUID)

  const existingMap = new Map<number, { uuid: string; hash: string | null; hasSOP: boolean }>()
  for (const b of existingBills || []) {
    existingMap.set(b.legiscan_bill_id, { uuid: b.id, hash: b.change_hash, hasSOP: !!b.plain_summary })
  }

  const masterList = await counted(() => getMasterListRaw(LEGISCAN_SESSION_ID))
  const masterBills = Object.values(masterList).filter(
    (v: any) => typeof v === 'object' && v.bill_id
  ) as any[]

  const toUpdate: any[] = []
  for (const mb of masterBills) {
    const existing = existingMap.get(mb.bill_id)
    if (!existing) toUpdate.push({ ...mb, isNew: true })
    else if (existing.hash !== mb.change_hash) toUpdate.push({ ...mb, isNew: false, existingUUID: existing.uuid })
  }

  if (toUpdate.length === 0) {
    return { billsUpdated: 0, billsAdded: 0, rollCallsAdded: 0, apiQueryCount, skipped: true }
  }

  const { data: legislators } = await supabase
    .from('legislators')
    .select('id, name, legiscan_people_id')
  const legMap = new Map<number, string>()
  const legList: { id: string; name: string }[] = []
  for (const l of legislators || []) {
    if (l.legiscan_people_id) legMap.set(l.legiscan_people_id, l.id)
    if (l.name && !l.name.includes('Committee')) legList.push({ id: l.id, name: l.name })
  }

  const { data: existingRollCalls } = await supabase
    .from('roll_calls')
    .select('legiscan_roll_call_id')
    .eq('session_id', sessionUUID)
  const existingRcIds = new Set((existingRollCalls || []).map((r: any) => r.legiscan_roll_call_id))

  let billsUpdated = 0
  let billsAdded = 0
  let rollCallsAdded = 0

  for (const mb of toUpdate) {
    const bill = await counted(() => getBill(mb.bill_id))
    const subjects = (bill.subjects || []).map((s: any) => s.subject_name)
    const lastAction = bill.history?.[bill.history.length - 1]?.action || null
    const billText = await fetchBillText(sessionRow.year_start, bill.bill_number)

    const hasSOP = existingMap.get(mb.bill_id)?.hasSOP ?? false
    const sopRaw = hasSOP ? null : await fetchRawSop(sessionRow.year_start, bill.bill_number)
    const sop = sopRaw ? parseSop(sopRaw) : null
    const sopSponsorNames = sop?.sponsorNames ?? []

    const billRow: Record<string, any> = {
      legiscan_bill_id: bill.bill_id,
      session_id: sessionUUID,
      bill_number: bill.bill_number,
      bill_type: bill.bill_type || null,
      chamber: parseChamber(bill.body || 'H'),
      title: bill.title,
      description: bill.description || null,
      status: String(bill.status || ''),
      status_date: bill.status_date || null,
      last_action: lastAction,
      last_action_date: bill.last_action_date || null,
      completed: bill.completed === 1 || Number(bill.status || 0) >= 4,
      legiscan_url: bill.url || null,
      state_url: bill.state_link || null,
      subjects,
      change_hash: bill.change_hash || null,
      bill_text: billText,
      updated_at: new Date().toISOString(),
      ...(sop?.bodyText && { plain_summary: sop.bodyText }),
      ...(sopSponsorNames.length && { sop_sponsor_names: sopSponsorNames }),
      ...(sop?.rsNumber && { rs_number: sop.rsNumber }),
      ...(sop?.fiscalNote && { fiscal_note: sop.fiscalNote }),
      ...(sop?.revisedAt && { sop_revised_at: sop.revisedAt }),
    }

    let billUUID = mb.existingUUID as string | undefined

    if (!dryRun) {
      const { data: upserted } = await supabase
        .from('bills')
        .upsert(billRow, { onConflict: 'legiscan_bill_id' })
        .select('id')
      billUUID = upserted?.[0]?.id ?? billUUID

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

      const hasLegiscanIndividual = bill.sponsors?.some((s: any) => !s.committee_sponsor)
      if (!hasLegiscanIndividual && sopSponsorNames.length > 0 && billUUID) {
        const expandedNames = sopSponsorNames.flatMap(n => splitSponsorNames(n))
        let order = 1
        for (const rawName of expandedNames) {
          const legUUID = matchSponsorName(rawName, legList)
          if (!legUUID) continue
          await supabase.from('bill_sponsors').upsert({
            bill_id: billUUID,
            legislator_id: legUUID,
            sponsor_order: order,
            sponsor_type: order === 1 ? 'primary' : 'cosponsor',
            committee_sponsor: false,
          }, { onConflict: 'bill_id,legislator_id' })
          order++
        }
      }
    }

    const newRollCalls = (bill.votes || []).filter((v: any) => !existingRcIds.has(v.roll_call_id))
    let controversyReason: string | null = null

    for (const rcRef of newRollCalls) {
      const rc = await counted(() => getRollCall(rcRef.roll_call_id))
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

      if (!dryRun && billUUID) {
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
            passed: rc.passed === 1 || (rc.nay === 0 && (rc.yea || 0) > 0),
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

    if (!dryRun && billUUID && controversyReason) {
      await supabase.from('bills').update({
        is_controversial: true,
        controversy_reason: controversyReason,
      }).eq('id', billUUID)
    }

    if (mb.isNew) billsAdded++
    else billsUpdated++
  }

  return { billsUpdated, billsAdded, rollCallsAdded, apiQueryCount, skipped: false }
}
