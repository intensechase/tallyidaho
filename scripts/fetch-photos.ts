/**
 * fetch-photos.ts
 *
 * Scrapes legislator headshot URLs from the Idaho Legislature membership pages
 * and stores them in legislators.photo_url in Supabase.
 * Only updates legislators active in the current session (YEAR).
 *
 * Usage:
 *   npx tsx scripts/fetch-photos.ts            # update DB
 *   npx tsx scripts/fetch-photos.ts --dry-run  # preview matches, no DB writes
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BASE = 'https://legislature.idaho.gov'
const YEAR = 2026
const DRY_RUN = process.argv.includes('--dry-run')

const MEMBERSHIP_URLS = [
  `${BASE}/senate/membership/`,
  `${BASE}/house/membership/`,
]

/** Fetch a page and extract all legislator photo URLs + last-name keys */
async function scrapeMembershipPage(url: string): Promise<{ name: string; photoUrl: string }[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'TallyIdaho/1.0 (tallyidaho.com; public data aggregator)' },
  })
  const html = await res.text()

  const results: { name: string; photoUrl: string }[] = []
  const seen = new Set<string>()

  // Match directory photo img tags:
  // src="/wp-content/uploads/sessioninfo/2026/directory/Adams6685.jpg"
  // Captures: [1] full src path, [2] name part (e.g. "Adams", "Den Hartog"), [3] numeric ID
  const imgRegex = /src="([^"]*\/sessioninfo\/\d+\/directory\/([^"]+?)(\d+)\.jpg)"/gi
  let match
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1]
    const namePart = match[2].trim() // e.g. "Adams" or "Den Hartog"
    const photoUrl = src.startsWith('http') ? src : `${BASE}${src}`

    if (seen.has(photoUrl)) continue
    seen.add(photoUrl)

    results.push({ name: namePart, photoUrl })
  }

  return results
}

/** Extract last name from a full or partial name string */
function lastName(name: string): string {
  return name.trim().split(/\s+/).pop()?.toLowerCase().replace(/[^a-z-]/g, '') || ''
}

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  Tally Idaho — Legislator Photo Importer')
  if (DRY_RUN) console.log('  DRY RUN — no DB writes')
  console.log('═══════════════════════════════════════════════════\n')

  // Fetch all photo entries from both pages
  const allPhotos: { name: string; photoUrl: string }[] = []
  for (const url of MEMBERSHIP_URLS) {
    console.log(`Scraping ${url}...`)
    const photos = await scrapeMembershipPage(url)
    console.log(`  Found ${photos.length} photos\n`)
    allPhotos.push(...photos)
  }

  if (allPhotos.length === 0) {
    console.error('No photos found — check scraping logic')
    process.exit(1)
  }

  // Fetch only legislators active in the current session
  const { data: sessionRow } = await supabase
    .from('sessions')
    .select('id')
    .eq('year_start', YEAR)
    .single()

  if (!sessionRow) {
    console.error(`No session found for year ${YEAR}`)
    process.exit(1)
  }

  const { data: legSessions, error } = await supabase
    .from('legislator_sessions')
    .select('legislators(id, name, role, district, photo_url)')
    .eq('session_id', sessionRow.id)

  if (error || !legSessions) {
    console.error('DB error:', error?.message)
    process.exit(1)
  }

  const legislators = legSessions
    .map((ls: any) => ls.legislators)
    .filter(Boolean)
    .filter((l: any) => (l.role === 'Sen' || l.role === 'Rep') && l.district)

  console.log(`Matching ${allPhotos.length} photos to ${legislators.length} active legislators...\n`)

  // Build a frequency map: last name → list of matching photos
  const photosByLastName = new Map<string, { name: string; photoUrl: string }[]>()
  for (const p of allPhotos) {
    const key = lastName(p.name)
    if (!photosByLastName.has(key)) photosByLastName.set(key, [])
    photosByLastName.get(key)!.push(p)
  }

  let updated = 0
  let skipped = 0
  let unmatched = 0
  let ambiguous = 0

  for (const leg of legislators) {
    const legLastName = lastName(leg.name)
    const candidates = photosByLastName.get(legLastName) || []

    if (candidates.length === 0) {
      unmatched++
      continue
    }

    // If multiple legislators share this last name, check how many photos match
    const siblingsWithSameLastName = legislators.filter(l => lastName(l.name) === legLastName)
    if (siblingsWithSameLastName.length > 1 && candidates.length < siblingsWithSameLastName.length) {
      // More legislators than photos → ambiguous, skip
      ambiguous++
      process.stdout.write(`  ? ${leg.name.padEnd(30)} → ambiguous (${siblingsWithSameLastName.length} legs, ${candidates.length} photo)\n`)
      continue
    }

    // Assign photo in order (senators first, then reps — matches website listing order)
    const siblingIndex = siblingsWithSameLastName.indexOf(leg)
    const match = candidates[siblingIndex] ?? candidates[0]

    if (leg.photo_url === match.photoUrl) {
      skipped++
      continue
    }

    process.stdout.write(`  ✓ ${leg.name.padEnd(30)} → ${match.photoUrl.split('/').pop()}\n`)
    if (!DRY_RUN) {
      await supabase.from('legislators').update({ photo_url: match.photoUrl }).eq('id', leg.id)
    }
    updated++
  }

  console.log('\n═══════════════════════════════════════════════════')
  console.log(`  Updated   : ${updated}`)
  console.log(`  Skipped   : ${skipped}  (already set)`)
  console.log(`  Ambiguous : ${ambiguous}  (multiple legs, one photo)`)
  console.log(`  Unmatched : ${unmatched}`)
  console.log('═══════════════════════════════════════════════════')

  if (unmatched > 0) {
    console.log('\nUnmatched legislators:')
    for (const leg of legislators) {
      const key = lastName(leg.name)
      if (!photosByLastName.has(key)) console.log(' ', leg.name)
    }
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
