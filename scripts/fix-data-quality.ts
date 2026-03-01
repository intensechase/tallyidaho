/**
 * fix-data-quality.ts
 *
 * Fixes two known data quality issues:
 * 1. roll_calls with null vote_margin — recomputes from yea/nay/total counts
 * 2. bills with status=4 but completed=false — marks them completed
 *
 * Usage:
 *   npx tsx scripts/fix-data-quality.ts            # apply fixes
 *   npx tsx scripts/fix-data-quality.ts --dry-run  # preview only
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DRY_RUN = process.argv.includes('--dry-run')

async function fixVoteMargins() {
  console.log('── Fix 1: roll_calls with null vote_margin ──────────')

  const { data, error } = await supabase
    .from('roll_calls')
    .select('id, yea_count, nay_count, total_count')
    .is('vote_margin', null)

  if (error) { console.error(error.message); return }
  if (!data || data.length === 0) { console.log('  ✓ No null vote_margins found'); return }

  console.log(`  Found ${data.length} roll calls to fix`)

  let fixed = 0
  let skipped = 0

  // Batch update in chunks of 100
  const BATCH = 100
  for (let i = 0; i < data.length; i += BATCH) {
    const chunk = data.slice(i, i + BATCH)
    for (const rc of chunk) {
      const total = rc.total_count || 0
      if (total === 0) { skipped++; continue }
      const margin = parseFloat((Math.abs((rc.yea_count || 0) - (rc.nay_count || 0)) / total * 100).toFixed(2))

      if (!DRY_RUN) {
        const { error: e } = await supabase
          .from('roll_calls')
          .update({ vote_margin: margin })
          .eq('id', rc.id)
        if (e) { console.error(`    ✗ ${rc.id}: ${e.message}`); continue }
      }
      fixed++
    }
    if (!DRY_RUN) process.stdout.write(`\r  Updated ${Math.min(i + BATCH, data.length)} / ${data.length}...`)
  }

  console.log(`\n  ✓ ${DRY_RUN ? 'Would fix' : 'Fixed'} ${fixed} records (${skipped} skipped — total_count=0)`)
}

async function fixCompletedFlag() {
  console.log('\n── Fix 2: bills with status=4 but completed=false ───')

  const { data, error } = await supabase
    .from('bills')
    .select('id, bill_number, status, sessions!inner(year_start)')
    .eq('completed', false)
    .gte('status', '4')

  if (error) { console.error(error.message); return }
  if (!data || data.length === 0) { console.log('  ✓ No mismatched bills found'); return }

  console.log(`  Found ${data.length} bills to fix`)
  const sample = data.slice(0, 5)
  for (const b of sample as any[]) {
    console.log(`    ${b.sessions?.year_start} ${b.bill_number} — status=${b.status}`)
  }
  if (data.length > 5) console.log(`    ... and ${data.length - 5} more`)

  if (!DRY_RUN) {
    // Update in batches by ID list
    const ids = data.map((b: any) => b.id)
    const BATCH = 200
    let fixed = 0
    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = ids.slice(i, i + BATCH)
      const { error: e } = await supabase
        .from('bills')
        .update({ completed: true })
        .in('id', chunk)
      if (e) { console.error(`  ✗ Batch ${i}: ${e.message}`); continue }
      fixed += chunk.length
      process.stdout.write(`\r  Updated ${fixed} / ${ids.length}...`)
    }
    console.log(`\n  ✓ Fixed ${fixed} records`)
  } else {
    console.log(`  (dry run — no changes made)`)
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  Tally Idaho — Data Quality Fixes')
  if (DRY_RUN) console.log('  DRY RUN — no DB writes')
  console.log('═══════════════════════════════════════════════════\n')

  await fixVoteMargins()
  await fixCompletedFlag()

  console.log('\n═══════════════════════════════════════════════════')
  console.log('  Done.')
  console.log('═══════════════════════════════════════════════════')
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
