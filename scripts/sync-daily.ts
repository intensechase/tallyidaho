/**
 * CLI wrapper for the daily sync.
 * Loads .env for local development, then delegates to lib/sync-engine.ts.
 *
 * Usage:
 *   npx tsx scripts/sync-daily.ts            # sync changed bills
 *   npx tsx scripts/sync-daily.ts --dry-run  # preview only, no DB writes
 */

import 'dotenv/config'
import { runSync } from '../lib/sync-engine'

const dryRun = process.argv.includes('--dry-run')

console.log('═══════════════════════════════════════════════════')
console.log('  Tally Idaho — Daily Sync (2026 Session)')
if (dryRun) console.log('  DRY RUN — no DB writes')
console.log('═══════════════════════════════════════════════════\n')

runSync({ dryRun })
  .then(result => {
    if (result.skipped) {
      console.log('✓ All bills up to date — nothing to sync')
    } else {
      console.log('\n═══════════════════════════════════════════════════')
      console.log(`  Bills updated : ${result.billsUpdated}`)
      console.log(`  Bills added   : ${result.billsAdded}`)
      console.log(`  Roll calls    : ${result.rollCallsAdded}`)
      console.log('───────────────────────────────────────────────────')
      console.log(`  API queries   : ${result.apiQueryCount} this run`)
      const monthlyEst = result.apiQueryCount * 30
      console.log(`  ~Monthly est. : ${monthlyEst.toLocaleString()} / 30,000 (${Math.round(monthlyEst / 300)}%)`)
      if (monthlyEst > 24000) console.log('  ⚠ WARNING: projected usage exceeds 80% of free tier')
    }
    console.log('═══════════════════════════════════════════════════')
    process.exit(0)
  })
  .catch(err => {
    console.error('\nSync failed:', err.message)
    process.exit(1)
  })
