/**
 * backfill-bill-committees.ts
 *
 * Fetches each bill from the LegiScan API and uses bill.committee.name to
 * assign the correct committee. Far more accurate than parsing last_action text
 * because LegiScan provides the committee directly.
 *
 * Usage:
 *   npx tsx scripts/backfill-bill-committees.ts            # update DB
 *   npx tsx scripts/backfill-bill-committees.ts --dry-run  # preview only
 *   npx tsx scripts/backfill-bill-committees.ts --year 2026
 *
 * ~500ms per bill due to LegiScan rate limiting. 465 bills ≈ 4 minutes.
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DRY_RUN = process.argv.includes('--dry-run')
const yearArg = process.argv.includes('--year')
  ? parseInt(process.argv[process.argv.indexOf('--year') + 1])
  : null
const YEARS = yearArg ? [yearArg] : [2026]

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

async function legiScanGetBill(billId: number): Promise<any> {
  const url = new URL('https://api.legiscan.com/')
  url.searchParams.set('key', process.env.LEGISCAN_API_KEY!)
  url.searchParams.set('op', 'getBill')
  url.searchParams.set('id', String(billId))
  const res = await fetch(url.toString())
  const json = await res.json()
  if (json.status !== 'OK') throw new Error(`LegiScan error: ${JSON.stringify(json)}`)
  return json.bill
}

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+&\s+/g, ' ')        // "Revenue & Taxation" → "Revenue Taxation"
    .replace(/\s+and\s+/g, ' ')      // "Revenue and Taxation" → "Revenue Taxation"
    .replace(/[,]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
}

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  Tally Idaho — Backfill Bill Committees (LegiScan)')
  if (DRY_RUN) console.log('  DRY RUN — no DB writes')
  console.log(`  Years: ${YEARS.join(', ')}`)
  console.log('═══════════════════════════════════════════════════\n')

  let totalUpdated = 0
  let totalSkipped = 0
  let totalNoMatch = 0

  for (const year of YEARS) {
    console.log(`\n── ${year} ────────────────────────────────────────────`)

    const { data: session } = await supabase
      .from('sessions')
      .select('id, name')
      .eq('year_start', year)
      .single()

    if (!session) { console.warn(`  No session for ${year}`); continue }

    // Load committees for this session → normalized name map
    const { data: committees } = await supabase
      .from('committees')
      .select('id, code, name, short_name')
      .eq('session_id', session.id)

    if (!committees?.length) {
      console.warn(`  No committees found — run fetch-committees.ts first`)
      continue
    }

    const cmteMap = new Map<string, typeof committees[0]>()
    for (const c of committees) {
      cmteMap.set(normalize(c.short_name), c)
      cmteMap.set(normalize(c.name), c)
    }
    console.log(`  Loaded ${committees.length} committees`)

    // Load all bills with a legiscan_bill_id
    const { data: bills } = await supabase
      .from('bills')
      .select('id, bill_number, legiscan_bill_id, committee_id')
      .eq('session_id', session.id)
      .not('legiscan_bill_id', 'is', null)
      .order('bill_number')

    if (!bills?.length) { console.warn('  No bills found'); continue }
    console.log(`  Processing ${bills.length} bills...\n`)

    let i = 0
    for (const bill of bills) {
      i++
      process.stdout.write(`  [${String(i).padStart(3)}/${bills.length}] ${bill.bill_number.padEnd(8)} `)

      try {
        const lsBill = await legiScanGetBill(bill.legiscan_bill_id)
        await delay(500)

        const lsCommittee = lsBill.committee
        if (!lsCommittee?.name) {
          console.log('— no committee in LegiScan')
          totalSkipped++
          continue
        }

        const normName = normalize(lsCommittee.name)
        let matched = cmteMap.get(normName)

        // Fuzzy fallback: substring match
        if (!matched) {
          for (const [key, c] of cmteMap.entries()) {
            if (normName.includes(key) || key.includes(normName)) {
              matched = c
              break
            }
          }
        }

        if (!matched) {
          console.log(`— no DB match for "${lsCommittee.name}"`)
          totalNoMatch++
          continue
        }

        // Skip if already correctly assigned
        if (bill.committee_id === matched.id) {
          console.log(`✓ already set → ${matched.code}`)
          totalSkipped++
          continue
        }

        console.log(`→ ${matched.code} (${lsCommittee.name})`)

        if (!DRY_RUN) {
          await supabase
            .from('bills')
            .update({
              committee_id: matched.id,
              committee_name: lsCommittee.name,
              committee_code: matched.code,
            })
            .eq('id', bill.id)
        }
        totalUpdated++

      } catch (err: any) {
        console.log(`— API error: ${err.message}`)
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════')
  console.log(`  Updated  : ${totalUpdated}`)
  console.log(`  Skipped  : ${totalSkipped} (already set or no LS data)`)
  console.log(`  No match : ${totalNoMatch} (LegiScan committee not in DB)`)
  if (DRY_RUN) console.log('  (dry run — no changes written)')
  console.log('═══════════════════════════════════════════════════')
}

main().catch(err => { console.error(err); process.exit(1) })
