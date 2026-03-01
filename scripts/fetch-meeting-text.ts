/**
 * fetch-meeting-text.ts
 *
 * Pre-populates agenda_text and minutes_text for committee meetings.
 * Fetches PDFs and parses them using pdf-parse (Node.js context only).
 *
 * Usage:
 *   npx tsx scripts/fetch-meeting-text.ts               # all meetings, agenda + minutes
 *   npx tsx scripts/fetch-meeting-text.ts --type agenda  # agenda only
 *   npx tsx scripts/fetch-meeting-text.ts --type minutes # minutes only
 *   npx tsx scripts/fetch-meeting-text.ts --code SAGA    # single committee
 *   npx tsx scripts/fetch-meeting-text.ts --dry-run      # preview only
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { PDFParse } from 'pdf-parse'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DRY_RUN  = process.argv.includes('--dry-run')
const DELAY_MS = 300

const typeArg = process.argv.includes('--type')
  ? process.argv[process.argv.indexOf('--type') + 1] as 'agenda' | 'minutes'
  : null

const codeArg = process.argv.includes('--code')
  ? process.argv[process.argv.indexOf('--code') + 1].toUpperCase()
  : null

const TYPES: Array<'agenda' | 'minutes'> = typeArg ? [typeArg] : ['agenda', 'minutes']

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function parsePdf(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TallyIdaho/1.0 (tallyidaho.com; public data aggregator)' },
    })
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    const text = result.text?.trim() ?? ''
    return text.length >= 10 ? text : null
  } catch {
    return null
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  Tally Idaho — Meeting Text Populator')
  if (DRY_RUN) console.log('  DRY RUN — no DB writes')
  console.log(`  Types: ${TYPES.join(', ')}`)
  if (codeArg) console.log(`  Code: ${codeArg}`)
  console.log('═══════════════════════════════════════════════════\n')

  for (const type of TYPES) {
    const urlField  = type === 'agenda' ? 'agenda_url'  : 'minutes_url'
    const textField = type === 'agenda' ? 'agenda_text' : 'minutes_text'

    console.log(`\n── ${type.toUpperCase()} ──────────────────────────────────────`)

    // Query meetings that have a URL but no cached text yet
    let query = supabase
      .from('committee_meetings')
      .select(`id, ${urlField}, ${textField}, committees(code, short_name)`)
      .not(urlField, 'is', null)
      .is(textField, null)
      .order('date', { ascending: false })

    if (codeArg) {
      // Join through committees to filter by code — use a subquery via RPC or just fetch all and filter
      // Simpler: fetch all and filter client-side for single committee runs
    }

    const { data: meetings, error } = await query

    if (error) {
      console.error(`DB error: ${error.message}`)
      continue
    }

    let rows = meetings ?? []

    // Filter by committee code if requested
    if (codeArg) {
      rows = rows.filter((m: any) => m.committees?.code === codeArg)
    }

    console.log(`Found ${rows.length} meetings needing ${type} text\n`)

    let done = 0
    let failed = 0

    for (const meeting of rows) {
      const committee = (meeting as any).committees
      const url = (meeting as any)[urlField] as string
      const label = `[${committee?.code ?? '?'}] ${meeting.id.slice(0, 8)}`

      process.stdout.write(`  ${label} — fetching ${type}...`)
      await delay(DELAY_MS)

      const text = await parsePdf(url)
      if (!text) {
        console.log(' ✗ failed')
        failed++
        continue
      }

      if (DRY_RUN) {
        console.log(` ✓ ${text.length} chars (dry run)`)
        done++
        continue
      }

      const { error: uErr } = await supabase
        .from('committee_meetings')
        .update({ [textField]: text })
        .eq('id', meeting.id)

      if (uErr) {
        console.log(` ✗ DB error: ${uErr.message}`)
        failed++
      } else {
        console.log(` ✓ ${text.length} chars`)
        done++
      }
    }

    console.log(`\n  Done: ${done}  Failed: ${failed}`)
  }

  console.log('\n═══════════════════════════════════════════════════')
  if (DRY_RUN) console.log('  (dry run — no changes written)')
  console.log('═══════════════════════════════════════════════════')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
