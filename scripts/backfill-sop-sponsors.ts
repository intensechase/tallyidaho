/**
 * Backfills SOP data for all bills missing individual sponsors:
 * rs_number, fiscal_note, sop_revised_at, sop_sponsor_names, and bill_sponsors rows.
 *
 * Usage: npx tsx scripts/backfill-sop-sponsors.ts [--dry-run]
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { extractPdfText } from './lib/pdf-extract'
import { parseSop, matchSponsorName, splitSponsorNames } from '../lib/sop-sponsors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const LEGIS_BASE = 'https://legislature.idaho.gov/wp-content/uploads/sessioninfo'
const DRY_RUN = process.argv.includes('--dry-run')
const REPROCESS = process.argv.includes('--reprocess')

async function fetchRawSop(year: number, billNumber: string): Promise<string | null> {
  try {
    const num = billNumber.replace(/\s+/g, '').toUpperCase()
    const res = await fetch(`${LEGIS_BASE}/${year}/legislation/${num}SOP.pdf`)
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    return extractPdfText(buffer)
  } catch {
    return null
  }
}

async function main() {
  console.log(`\nBackfill SOP Data${DRY_RUN ? ' (DRY RUN)' : ''}`)
  console.log('='.repeat(50))

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, year_start, name')
    .gte('year_start', 2025)
    .order('year_start')

  const { data: legislators } = await supabase
    .from('legislators')
    .select('id, name')
    .not('name', 'ilike', '%Committee%')

  const legList = legislators ?? []

  let totalBills = 0
  let sopParsed = 0
  let sponsorsInserted = 0
  let rsFound = 0
  let fiscalNoteFound = 0
  const unmatched: { bill: string; name: string }[] = []

  for (const session of sessions ?? []) {
    console.log(`\nSession: ${session.name}`)

    const { data: allBills } = await supabase
      .from('bills')
      .select('id, bill_number')
      .eq('session_id', session.id)

    for (const bill of allBills ?? []) {
      totalBills++

      // Check if already has individual sponsors
      const { data: existingSponsors } = await supabase
        .from('bill_sponsors')
        .select('committee_sponsor')
        .eq('bill_id', bill.id)

      const hasIndividual = existingSponsors?.some(s => !s.committee_sponsor)
      if (hasIndividual && !REPROCESS) continue

      const raw = await fetchRawSop(session.year_start, bill.bill_number)
      if (!raw) continue

      const sop = parseSop(raw)
      sopParsed++

      const update: Record<string, any> = {}
      if (sop.sponsorNames.length > 0) update.sop_sponsor_names = sop.sponsorNames
      if (sop.rsNumber) { update.rs_number = sop.rsNumber; rsFound++ }
      if (sop.fiscalNote) { update.fiscal_note = sop.fiscalNote; fiscalNoteFound++ }
      if (sop.revisedAt) update.sop_revised_at = sop.revisedAt

      if (!DRY_RUN && Object.keys(update).length > 0) {
        await supabase.from('bills').update(update).eq('id', bill.id)
      }

      // Match sponsor names to legislators
      // Split multi-name entries before matching (e.g. "Don Hall, Grayson Stone")
      const expandedNames = sop.sponsorNames.flatMap(n => splitSponsorNames(n))

      let order = 1
      for (const rawName of expandedNames) {
        const legId = matchSponsorName(rawName, legList)
        if (!legId) {
          unmatched.push({ bill: bill.bill_number, name: rawName })
          continue
        }

        if (!DRY_RUN) {
          await supabase.from('bill_sponsors').upsert({
            bill_id: bill.id,
            legislator_id: legId,
            sponsor_order: order,
            sponsor_type: order === 1 ? 'primary' : 'cosponsor',
            committee_sponsor: false,
          }, { onConflict: 'bill_id,legislator_id' })
        }

        console.log(`  + ${bill.bill_number} → ${rawName}`)
        sponsorsInserted++
        order++
      }
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log(`Total bills:          ${totalBills}`)
  console.log(`SOPs parsed:          ${sopParsed}`)
  console.log(`RS numbers found:     ${rsFound}`)
  console.log(`Fiscal notes found:   ${fiscalNoteFound}`)
  console.log(`Sponsors inserted:    ${sponsorsInserted}`)
  console.log(`Unmatched names:      ${unmatched.length}`)

  if (unmatched.length > 0) {
    console.log('\nUnmatched (manual review needed):')
    for (const u of unmatched) console.log(`  ${u.bill}: "${u.name}"`)
  }
}

main().catch(e => { console.error(e.message); process.exit(1) })
