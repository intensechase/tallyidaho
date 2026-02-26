/**
 * assign-bill-committees.ts
 *
 * Parses bills.last_action to extract committee assignments, then updates:
 *   bills.committee_name  — raw text extracted from last_action
 *   bills.committee_id    — FK to committees table (if matched)
 *   bills.committee_code  — committee code string (denormalized for linking)
 *
 * Only runs against 2025 and 2026 sessions (where committees are populated).
 *
 * Usage:
 *   npx tsx scripts/assign-bill-committees.ts            # update DB
 *   npx tsx scripts/assign-bill-committees.ts --dry-run  # preview, no writes
 *   npx tsx scripts/assign-bill-committees.ts --year 2026
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
const YEARS = yearArg ? [yearArg] : [2025, 2026]
const BATCH = 500

// ── Regex patterns for extracting committee from last_action ─────────────────
//
// Handles:
//   "referred to: Health & Welfare"
//   "ref'd to: Health & Welfare"
//   "ref to: Health & Welfare"
//   "refd to: Health & Welfare"
//   "to: Health & Welfare" (after motion)
//
const COMMITTEE_RE =
  /(?:ref(?:er)?(?:red)?'?(?:d)?\s+to:|refe?r?r?ed?\s+to:|ref'd\s+to:)\s*([^;,\n\r(]{3,60})/i

// Fallback: "to committee" / "to the Health & Welfare committee"
const COMMITTEE_FALLBACK_RE =
  /\bto\s+(?:the\s+)?([A-Z][^;,(]{3,50?}?)\s+(?:committee|cmte)/i

/** Normalize a committee name for lookup comparison */
function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s*[&,]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
}

/** Extract committee name text from last_action */
function extractCommitteeName(lastAction: string): string | null {
  if (!lastAction) return null

  let m = COMMITTEE_RE.exec(lastAction)
  if (m) return m[1].trim()

  m = COMMITTEE_FALLBACK_RE.exec(lastAction)
  if (m) return m[1].trim()

  return null
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  Tally Idaho — Bill Committee Assignment')
  if (DRY_RUN) console.log('  DRY RUN — no DB writes')
  console.log(`  Years: ${YEARS.join(', ')}`)
  console.log('═══════════════════════════════════════════════════\n')

  let totalBills = 0
  let totalExtracted = 0
  let totalMatched = 0
  let totalUpdated = 0

  for (const year of YEARS) {
    console.log(`\n── ${year} ────────────────────────────────────────────`)

    // Get session
    const { data: session } = await supabase
      .from('sessions')
      .select('id, name')
      .eq('year_start', year)
      .single()

    if (!session) {
      console.warn(`  No session for year ${year}, skipping`)
      continue
    }

    // Load all committees for this session
    const { data: committees, error: cErr } = await supabase
      .from('committees')
      .select('id, code, short_name, name')
      .eq('session_id', session.id)

    if (cErr || !committees || committees.length === 0) {
      console.warn(`  No committees found for ${year} — run fetch-committees.ts first`)
      continue
    }

    console.log(`  Loaded ${committees.length} committees`)

    // Build normalized lookup: normalized_short_name → committee
    const committeeMap = new Map<string, typeof committees[0]>()
    for (const c of committees) {
      committeeMap.set(normalize(c.short_name), c)
      committeeMap.set(normalize(c.name), c)
      // Also index common abbreviations
      committeeMap.set(normalize(c.short_name.replace(/\s+and\s+/i, ' & ')), c)
    }

    // Paginate through all bills for this session
    let offset = 0
    let hasMore = true
    let yearBills = 0
    let yearExtracted = 0
    let yearMatched = 0

    while (hasMore) {
      const { data: bills, error: bErr } = await supabase
        .from('bills')
        .select('id, bill_number, last_action, committee_name, committee_id')
        .eq('session_id', session.id)
        .range(offset, offset + BATCH - 1)

      if (bErr) { console.error(`  DB error: ${bErr.message}`); break }
      if (!bills || bills.length === 0) { hasMore = false; break }

      offset += bills.length
      if (bills.length < BATCH) hasMore = false

      const updates: Array<{
        id: string
        committee_name: string | null
        committee_id: string | null
        committee_code: string | null
      }> = []

      for (const bill of bills) {
        yearBills++
        if (!bill.last_action) continue

        const rawName = extractCommitteeName(bill.last_action)
        if (!rawName) continue
        yearExtracted++

        // Try to match to a committee
        const normRaw = normalize(rawName)
        let matched = committeeMap.get(normRaw)

        // Fuzzy fallback: substring match
        if (!matched) {
          for (const [key, c] of committeeMap.entries()) {
            if (normRaw.includes(key) || key.includes(normRaw)) {
              matched = c
              break
            }
          }
        }

        if (matched) yearMatched++

        // Only update if something changed
        const newName = rawName
        const newId = matched?.id ?? null
        const newCode = matched?.code ?? null

        const noChange =
          bill.committee_name === newName &&
          bill.committee_id === newId

        if (!noChange) {
          updates.push({
            id: bill.id,
            committee_name: newName,
            committee_id: newId,
            committee_code: newCode,
          })
        }
      }

      if (DRY_RUN) {
        // Show preview
        for (const u of updates.slice(0, 5)) {
          const bill = bills.find(b => b.id === u.id)
          console.log(
            `  ${bill?.bill_number?.padEnd(8)} → "${u.committee_name}" ${u.committee_code ? `[${u.committee_code}]` : '(no match)'}`
          )
        }
        if (updates.length > 5) console.log(`  ... and ${updates.length - 5} more`)
      } else {
        // Batch update using individual updates (Supabase doesn't support bulk upsert well without PK conflicts)
        for (const u of updates) {
          await supabase
            .from('bills')
            .update({
              committee_name: u.committee_name,
              committee_id: u.committee_id,
              committee_code: u.committee_code,
            })
            .eq('id', u.id)
        }
        totalUpdated += updates.length
      }

      process.stdout.write(
        `  Processed ${offset} bills... (extracted: ${yearExtracted}, matched: ${yearMatched})\r`
      )
    }

    process.stdout.write('\n')
    console.log(`  Bills     : ${yearBills}`)
    console.log(`  Extracted : ${yearExtracted}  (last_action had committee text)`)
    console.log(`  Matched   : ${yearMatched}  (committee found in DB)`)

    totalBills += yearBills
    totalExtracted += yearExtracted
    totalMatched += yearMatched
  }

  console.log('\n═══════════════════════════════════════════════════')
  console.log(`  Total bills    : ${totalBills}`)
  console.log(`  With committee : ${totalExtracted}  (${totalBills > 0 ? Math.round(totalExtracted / totalBills * 100) : 0}%)`)
  console.log(`  DB matched     : ${totalMatched}  (${totalExtracted > 0 ? Math.round(totalMatched / totalExtracted * 100) : 0}% of extracted)`)
  if (!DRY_RUN) console.log(`  Updated rows   : ${totalUpdated}`)
  if (DRY_RUN) console.log('  (dry run — no changes written)')
  console.log('═══════════════════════════════════════════════════')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
