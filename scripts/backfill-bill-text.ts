/**
 * backfill-bill-text.ts
 *
 * Fetches and stores full bill text for all 2026 bills that are missing it.
 * Run once after adding the bill_text column to the bills table.
 *
 * Usage:
 *   npx tsx scripts/backfill-bill-text.ts            # all missing
 *   npx tsx scripts/backfill-bill-text.ts --dry-run  # preview only
 *   npx tsx scripts/backfill-bill-text.ts --bill H0700 # single bill
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { PDFParse } from 'pdf-parse'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DRY_RUN = process.argv.includes('--dry-run')
const billArg = process.argv.includes('--bill')
  ? process.argv[process.argv.indexOf('--bill') + 1].toUpperCase()
  : null

const LEGIS_BASE = 'https://legislature.idaho.gov/wp-content/uploads/sessioninfo'
const DELAY_MS = 400

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

async function fetchBillText(year: number, billNumber: string): Promise<string | null> {
  try {
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

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  Tally Idaho — Backfill Bill Text')
  if (DRY_RUN) console.log('  DRY RUN — no DB writes')
  console.log('═══════════════════════════════════════════════════\n')

  const { data: session } = await supabase
    .from('sessions')
    .select('id, year_start')
    .eq('year_start', 2026)
    .single()

  if (!session) { console.error('Session not found'); process.exit(1) }

  let query = supabase
    .from('bills')
    .select('id, bill_number, bill_text')
    .eq('session_id', session.id)
    .order('bill_number')

  if (billArg) {
    query = query.eq('bill_number', billArg) as any
  } else {
    query = query.is('bill_text', null) as any
  }

  const { data: bills } = await query
  if (!bills?.length) { console.log('No bills to process.'); return }

  console.log(`Processing ${bills.length} bills...\n`)

  let updated = 0, skipped = 0

  for (let i = 0; i < bills.length; i++) {
    const bill = bills[i]
    process.stdout.write(`  [${String(i + 1).padStart(3)}/${bills.length}] ${bill.bill_number.padEnd(8)} `)

    const text = await fetchBillText(session.year_start, bill.bill_number)
    await delay(DELAY_MS)

    if (!text) {
      console.log('— no text')
      skipped++
      continue
    }

    console.log(`✓ ${text.length} chars`)

    if (!DRY_RUN) {
      await supabase.from('bills').update({ bill_text: text }).eq('id', bill.id)
    }
    updated++
  }

  console.log('\n═══════════════════════════════════════════════════')
  console.log(`  Updated : ${updated}`)
  console.log(`  Skipped : ${skipped} (PDF unavailable or empty)`)
  if (DRY_RUN) console.log('  (dry run — no changes written)')
  console.log('═══════════════════════════════════════════════════')
}

main().catch(err => { console.error(err); process.exit(1) })
