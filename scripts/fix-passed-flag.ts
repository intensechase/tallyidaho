/**
 * fix-passed-flag.ts
 *
 * Fixes roll_calls where passed=false but nay_count=0 and yea_count>0.
 * This is a LegiScan data quality issue — unanimous votes incorrectly flagged as failed.
 *
 * Usage:
 *   npx tsx scripts/fix-passed-flag.ts            # apply fixes
 *   npx tsx scripts/fix-passed-flag.ts --dry-run  # preview only
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  console.log('Checking for roll calls with passed=false but nay_count=0...\n')
  if (DRY_RUN) console.log('DRY RUN — no DB writes\n')

  const { data, error } = await supabase
    .from('roll_calls')
    .select('id, yea_count, nay_count, passed, bills!inner(bill_number, sessions!inner(year_start))')
    .eq('passed', false)
    .eq('nay_count', 0)
    .gt('yea_count', 0)

  if (error) {
    console.error('Query failed:', error.message)
    process.exit(1)
  }

  if (!data || data.length === 0) {
    console.log('No bad records found — all good.')
    return
  }

  console.log(`Found ${data.length} roll call(s) to fix:\n`)

  for (const rc of data as any[]) {
    const billNum = rc.bills?.bill_number ?? '???'
    const year = rc.bills?.sessions?.year_start ?? '???'
    console.log(`  ${year} ${billNum.padEnd(10)} — ${rc.yea_count} yea / ${rc.nay_count} nay → setting passed=true`)

    if (!DRY_RUN) {
      const { error: updateError } = await supabase
        .from('roll_calls')
        .update({ passed: true })
        .eq('id', rc.id)

      if (updateError) {
        console.error(`    ✗ Failed to update: ${updateError.message}`)
      } else {
        console.log(`    ✓ Fixed`)
      }
    }
  }

  if (!DRY_RUN) {
    console.log('\nDone.')
  } else {
    console.log('\n(dry run — no changes made)')
  }
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
