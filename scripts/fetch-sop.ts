/**
 * fetch-sop.ts
 *
 * Fetches Statement of Purpose PDFs from the Idaho Legislature website
 * and stores the extracted plain-text in bills.plain_summary.
 *
 * Source URL pattern:
 *   https://legislature.idaho.gov/wp-content/uploads/sessioninfo/{year}/legislation/{BILL_NUMBER}SOP.pdf
 *
 * Usage:
 *   npx tsx scripts/fetch-sop.ts            # all bills missing plain_summary
 *   npx tsx scripts/fetch-sop.ts --year 2026 # single session
 *   npx tsx scripts/fetch-sop.ts --bill H0489 --year 2026 # single bill
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { PDFParse } from 'pdf-parse'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SOP_BASE = 'https://legislature.idaho.gov/wp-content/uploads/sessioninfo'
const DELAY_MS = 400   // between requests — be polite to the state server
const BATCH    = 100   // bills per DB page

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const yearArg  = args.includes('--year')  ? parseInt(args[args.indexOf('--year')  + 1]) : null
const billArg  = args.includes('--bill')  ? args[args.indexOf('--bill')  + 1].toUpperCase() : null

// ── Helpers ──────────────────────────────────────────────────────────────────

function sopUrl(year: number, billNumber: string): string {
  // Ensure no spaces: "H 0001" → "H0001"
  const num = billNumber.replace(/\s+/g, '').toUpperCase()
  return `${SOP_BASE}/${year}/legislation/${num}SOP.pdf`
}

/** Extract SOP text from a PDF buffer. Returns null if image-based or unreadable. */
async function extractSOP(buffer: Buffer): Promise<string | null> {
  let raw: string
  try {
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    raw = result.text?.trim() ?? ''
  } catch {
    return null
  }
  if (!raw || raw.length < 30) return null

  // SOP section starts after "STATEMENT OF PURPOSE" and ends before "FISCAL NOTE"
  // Try with and without line breaks
  const sopRegex = /STATEMENT\s+OF\s+PURPOSE[\s\S]*?\n([\s\S]*?)(?:FISCAL\s+NOTE|^\s*$)/im
  const match = raw.match(sopRegex)

  let text = match?.[1]?.trim() || raw

  // Remove RS number lines like "RS 21234", "RS 21234C1", page headers, etc.
  text = text
    .split('\n')
    .filter((line: string) => {
      const t = line.trim()
      if (!t) return false
      if (/^RS\s*\d+/i.test(t)) return false
      if (/^STATEMENT\s+OF\s+PURPOSE/i.test(t)) return false
      if (/^FISCAL\s+NOTE/i.test(t)) return false
      if (/^Page\s+\d+/i.test(t)) return false
      return true
    })
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim()

  return text.length >= 30 ? text : null
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  let totalUpdated = 0
  let totalSkipped = 0   // 404 or no text extractable
  let totalFailed  = 0   // network/parse errors
  let offset = 0

  console.log('═══════════════════════════════════════════════════')
  console.log('  Tally Idaho — Statement of Purpose importer')
  if (yearArg) console.log(`  Session: ${yearArg}`)
  if (billArg) console.log(`  Bill:    ${billArg}`)
  console.log('═══════════════════════════════════════════════════\n')

  while (true) {
    // Build query
    let query = supabase
      .from('bills')
      .select('id, bill_number, sessions!inner(year_start)')
      .is('plain_summary', null)
      .not('bill_number', 'is', null)
      .order('id')
      .range(offset, offset + BATCH - 1)

    if (yearArg) query = query.eq('sessions.year_start', yearArg)
    if (billArg) query = query.eq('bill_number', billArg)

    const { data: bills, error } = await query
    if (error) { console.error('DB error:', error); break }
    if (!bills || bills.length === 0) break

    console.log(`Batch ${Math.floor(offset / BATCH) + 1} — ${bills.length} bills\n`)

    for (const bill of bills) {
      const year    = (bill.sessions as any).year_start as number
      const billNum = bill.bill_number.toUpperCase()
      const url     = sopUrl(year, billNum)

      process.stdout.write(`  ${billNum.padEnd(10)} (${year})  `)

      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'TallyIdaho/1.0 (tallyidaho.com; public data aggregator)' },
          signal: AbortSignal.timeout(15_000),
        })

        if (res.status === 404) {
          process.stdout.write('no PDF\n')
          totalSkipped++
          continue
        }

        if (!res.ok) {
          process.stdout.write(`HTTP ${res.status}\n`)
          totalFailed++
          continue
        }

        const buffer = Buffer.from(await res.arrayBuffer())
        const sop = await extractSOP(buffer)

        if (!sop) {
          process.stdout.write('image PDF — no extractable text\n')
          totalSkipped++
          continue
        }

        const { error: updateErr } = await supabase
          .from('bills')
          .update({ plain_summary: sop.slice(0, 2000) }) // cap at 2000 chars
          .eq('id', bill.id)

        if (updateErr) {
          process.stdout.write(`DB write error: ${updateErr.message}\n`)
          totalFailed++
        } else {
          process.stdout.write(`✓  "${sop.slice(0, 70)}..."\n`)
          totalUpdated++
        }

      } catch (err: any) {
        process.stdout.write(`error: ${err.message}\n`)
        totalFailed++
      }

      await delay(DELAY_MS)
    }

    offset += BATCH
    if (bills.length < BATCH) break

    console.log('\n— next batch in 2s —\n')
    await delay(2000)
  }

  console.log('\n═══════════════════════════════════════════════════')
  console.log(`  Updated : ${totalUpdated}`)
  console.log(`  Skipped : ${totalSkipped}  (no PDF or image-based)`)
  console.log(`  Failed  : ${totalFailed}`)
  console.log('═══════════════════════════════════════════════════')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
