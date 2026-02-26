/**
 * fetch-wikipedia.ts
 *
 * Fetches Wikipedia article summaries for Idaho legislators and stores them
 * in legislators.bio in Supabase.
 *
 * Usage:
 *   npx tsx scripts/fetch-wikipedia.ts            # all 2026 legislators
 *   npx tsx scripts/fetch-wikipedia.ts --dry-run  # preview, no DB writes
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const YEAR = 2026
const DRY_RUN = process.argv.includes('--dry-run')
const DELAY_MS = 300 // respectful of Wikipedia rate limits

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Keywords that indicate a Wikipedia article is about a politician / legislator
const RELEVANCE_KEYWORDS = [
  'idaho', 'legislat', 'senator', 'representative', 'politician', 'assembly',
  'house of', 'state senate', 'republican', 'democrat',
]

function isRelevant(text: string): boolean {
  const lower = text.toLowerCase()
  return RELEVANCE_KEYWORDS.some(k => lower.includes(k))
}

/** Check if a Wikipedia summary response is a valid legislator article */
function isValidArticle(data: any, name: string): boolean {
  // Reject disambiguation pages
  if (data.type === 'disambiguation') return false
  if (!data.extract) return false

  const extract = data.extract.toLowerCase()
  const desc = (data.description || '').toLowerCase()

  // Reject if it reads like a disambiguation list
  if (extract.includes('may refer to') || extract.includes('can refer to')) return false
  if (extract.includes('refer to:')) return false

  // Must mention Idaho or be clearly about a politician
  if (!isRelevant(extract) && !isRelevant(desc)) return false

  // Must be long enough to be useful
  if (data.extract.length < 80) return false

  // Both first and last name should appear in the article
  const parts = name.trim().split(/\s+/)
  const firstName = parts[0].toLowerCase()
  const lastName = parts[parts.length - 1].toLowerCase()
  const titleLower = (data.title || '').toLowerCase()
  const hasLastName = extract.includes(lastName) || titleLower.includes(lastName)
  const hasFirstName = extract.includes(firstName) || titleLower.includes(firstName)
  if (!hasLastName || !hasFirstName) return false

  return true
}

/**
 * Search Wikipedia for a legislator by name.
 * Returns the best matching article summary, or null if none found.
 */
async function searchWikipedia(name: string): Promise<{ extract: string; pageUrl: string } | null> {
  const encoded = encodeURIComponent(name)
  const headers = { 'User-Agent': 'TallyIdaho/1.0 (tallyidaho.com; civic data)' }

  // --- Strategy 1: direct lookup by "{name} (politician)" ---
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name + ' (politician)')}`,
      { headers }
    )
    if (res.ok) {
      const data = await res.json()
      if (isValidArticle(data, name)) {
        return { extract: cleanExtract(data.extract), pageUrl: data.content_urls?.desktop?.page || '' }
      }
    }
  } catch { /* try next */ }

  await delay(DELAY_MS)

  // --- Strategy 2: direct lookup by name ---
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
      { headers }
    )
    if (res.ok) {
      const data = await res.json()
      if (isValidArticle(data, name)) {
        return { extract: cleanExtract(data.extract), pageUrl: data.content_urls?.desktop?.page || '' }
      }
    }
  } catch { /* try next */ }

  await delay(DELAY_MS)

  // --- Strategy 3: search API with Idaho + legislator context ---
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}+Idaho+legislator&format=json&srlimit=3&origin=*`
    const res = await fetch(searchUrl, { headers })
    const data = await res.json()
    const hits = data.query?.search || []

    for (const hit of hits) {
      if (hit.title.toLowerCase().includes('disambiguation')) continue
      if (hit.title.toLowerCase().includes('list of')) continue
      if (!isRelevant(hit.snippet || '')) continue

      await delay(DELAY_MS)

      try {
        const summaryRes = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`,
          { headers }
        )
        if (summaryRes.ok) {
          const summary = await summaryRes.json()
          if (isValidArticle(summary, name)) {
            return { extract: cleanExtract(summary.extract), pageUrl: summary.content_urls?.desktop?.page || '' }
          }
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }

  return null
}

/** Trim Wikipedia extract to a readable length and clean up references */
function cleanExtract(text: string): string {
  // Remove citation markers like [1], [2]
  let clean = text.replace(/\[\d+\]/g, '').trim()
  // Trim to ~600 chars, ending at a sentence boundary
  if (clean.length > 600) {
    const cutoff = clean.lastIndexOf('. ', 600)
    clean = cutoff > 200 ? clean.slice(0, cutoff + 1) : clean.slice(0, 600) + '…'
  }
  return clean
}

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  Tally Idaho — Wikipedia Bio Fetcher')
  if (DRY_RUN) console.log('  DRY RUN — no DB writes')
  console.log('═══════════════════════════════════════════════════\n')

  // Get 2026 session legislators only
  const { data: sessionRow } = await supabase
    .from('sessions')
    .select('id')
    .eq('year_start', YEAR)
    .single()

  if (!sessionRow) { console.error('Session not found'); process.exit(1) }

  const { data: legSessions } = await supabase
    .from('legislator_sessions')
    .select('legislators(id, name, role, district, bio)')
    .eq('session_id', sessionRow.id)

  const legislators = (legSessions || [])
    .map((ls: any) => ls.legislators)
    .filter(Boolean)
    .filter((l: any) => (l.role === 'Sen' || l.role === 'Rep') && l.district)

  console.log(`Searching Wikipedia for ${legislators.length} legislators...\n`)

  let found = 0
  let alreadySet = 0
  let notFound = 0

  for (const leg of legislators) {
    // Skip if bio already set
    if (leg.bio) {
      alreadySet++
      process.stdout.write(`  ─ ${leg.name.padEnd(30)} already has bio\n`)
      continue
    }

    process.stdout.write(`  ? ${leg.name.padEnd(30)} `)

    const result = await searchWikipedia(leg.name)
    await delay(DELAY_MS)

    if (result) {
      process.stdout.write(`✓ found (${result.extract.length} chars)\n`)
      if (!DRY_RUN) {
        await supabase
          .from('legislators')
          .update({ bio: result.extract })
          .eq('id', leg.id)
      } else {
        console.log(`    Preview: "${result.extract.slice(0, 100)}..."`)
      }
      found++
    } else {
      process.stdout.write(`✗ not found\n`)
      notFound++
    }
  }

  console.log('\n═══════════════════════════════════════════════════')
  console.log(`  Found    : ${found}`)
  console.log(`  Skipped  : ${alreadySet}  (already set)`)
  console.log(`  Not found: ${notFound}`)
  console.log('═══════════════════════════════════════════════════')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
