/**
 * fetch-wikipedia.ts
 *
 * Fetches full Wikipedia intro sections for Idaho legislators and stores them
 * in legislators.bio + legislators.wiki_url in Supabase.
 *
 * Usage:
 *   npx tsx scripts/fetch-wikipedia.ts              # skip already-set bios
 *   npx tsx scripts/fetch-wikipedia.ts --overwrite  # re-fetch all (longer bios)
 *   npx tsx scripts/fetch-wikipedia.ts --dry-run    # preview, no DB writes
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const YEAR = 2026
const DRY_RUN = process.argv.includes('--dry-run')
const OVERWRITE = process.argv.includes('--overwrite')
const DELAY_MS = 350

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const RELEVANCE_KEYWORDS = [
  'idaho', 'legislat', 'senator', 'representative', 'politician', 'assembly',
  'house of', 'state senate', 'republican', 'democrat',
]

function isRelevant(text: string): boolean {
  const lower = text.toLowerCase()
  return RELEVANCE_KEYWORDS.some(k => lower.includes(k))
}

/** Validate that a REST summary response is about the right legislator */
function isValidArticle(data: any, name: string): boolean {
  if (data.type === 'disambiguation') return false
  if (!data.extract) return false

  const extract = data.extract.toLowerCase()
  const desc = (data.description || '').toLowerCase()

  if (extract.includes('may refer to') || extract.includes('can refer to')) return false
  if (extract.includes('refer to:')) return false
  if (!isRelevant(extract) && !isRelevant(desc)) return false
  if (data.extract.length < 80) return false

  const parts = name.trim().split(/\s+/)
  const firstName = parts[0].toLowerCase()
  const lastName = parts[parts.length - 1].toLowerCase()
  const titleLower = (data.title || '').toLowerCase()
  const hasLastName = extract.includes(lastName) || titleLower.includes(lastName)
  const hasFirstName = extract.includes(firstName) || titleLower.includes(firstName)
  if (!hasLastName || !hasFirstName) return false

  return true
}

/** Fetch the full intro section (all paragraphs before first heading) from MediaWiki */
async function getFullIntro(title: string): Promise<string | null> {
  const headers = { 'User-Agent': 'TallyIdaho/1.0 (tallyidaho.com; civic data)' }
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=extracts&exintro&explaintext&format=json&redirects=1`
    const res = await fetch(url, { headers })
    const data = await res.json()
    const pages = data.query?.pages || {}
    const page = Object.values(pages)[0] as any
    if (!page || page.missing !== undefined) return null
    return (page.extract as string) || null
  } catch {
    return null
  }
}

/**
 * Find the Wikipedia article for a legislator via 3 strategies.
 * Returns the validated article title + page URL, or null.
 */
async function findWikipediaArticle(name: string): Promise<{ title: string; pageUrl: string } | null> {
  const encoded = encodeURIComponent(name)
  const headers = { 'User-Agent': 'TallyIdaho/1.0 (tallyidaho.com; civic data)' }

  // Strategy 1: "{name} (politician)"
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name + ' (politician)')}`,
      { headers }
    )
    if (res.ok) {
      const data = await res.json()
      if (isValidArticle(data, name)) {
        return { title: data.title, pageUrl: data.content_urls?.desktop?.page || '' }
      }
    }
  } catch { /* try next */ }

  await delay(DELAY_MS)

  // Strategy 2: direct name lookup
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
      { headers }
    )
    if (res.ok) {
      const data = await res.json()
      if (isValidArticle(data, name)) {
        return { title: data.title, pageUrl: data.content_urls?.desktop?.page || '' }
      }
    }
  } catch { /* try next */ }

  await delay(DELAY_MS)

  // Strategy 3: search API
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
            return { title: summary.title, pageUrl: summary.content_urls?.desktop?.page || '' }
          }
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }

  return null
}

/** Clean and trim the bio text */
function cleanExtract(text: string): string {
  let clean = text
    .replace(/\[\d+\]/g, '')       // remove [1] citation markers
    .replace(/\n{3,}/g, '\n\n')    // collapse excess newlines
    .trim()

  // Trim to ~1200 chars at a sentence boundary
  if (clean.length > 1200) {
    const cutoff = clean.lastIndexOf('. ', 1200)
    clean = cutoff > 300 ? clean.slice(0, cutoff + 1) : clean.slice(0, 1200) + '…'
  }
  return clean
}

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  Tally Idaho — Wikipedia Bio Fetcher (Full Intro)')
  if (DRY_RUN) console.log('  DRY RUN — no DB writes')
  if (OVERWRITE) console.log('  OVERWRITE MODE — re-fetching all legislators')
  console.log('═══════════════════════════════════════════════════\n')

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

  console.log(`Processing ${legislators.length} legislators...\n`)

  let found = 0
  let skipped = 0
  let notFound = 0

  for (const leg of legislators) {
    if (!OVERWRITE && leg.bio) {
      skipped++
      process.stdout.write(`  ─ ${leg.name.padEnd(30)} skipped (already set)\n`)
      continue
    }

    process.stdout.write(`  ? ${leg.name.padEnd(30)} `)

    const article = await findWikipediaArticle(leg.name)
    await delay(DELAY_MS)

    if (!article) {
      process.stdout.write(`✗ not found\n`)
      notFound++
      continue
    }

    // Fetch full intro from MediaWiki API (more text than REST summary)
    const fullIntro = await getFullIntro(article.title)
    await delay(DELAY_MS)

    const bio = fullIntro ? cleanExtract(fullIntro) : null
    if (!bio || bio.length < 80) {
      process.stdout.write(`✗ intro too short\n`)
      notFound++
      continue
    }

    process.stdout.write(`✓ ${bio.length} chars  ${article.pageUrl ? '🔗' : ''}\n`)

    if (!DRY_RUN) {
      await supabase
        .from('legislators')
        .update({ bio, wiki_url: article.pageUrl || null })
        .eq('id', leg.id)
    } else {
      console.log(`    Preview: "${bio.slice(0, 120)}..."`)
      console.log(`    URL: ${article.pageUrl}`)
    }
    found++
  }

  console.log('\n═══════════════════════════════════════════════════')
  console.log(`  Updated  : ${found}`)
  console.log(`  Skipped  : ${skipped}  (already set)`)
  console.log(`  Not found: ${notFound}`)
  console.log('═══════════════════════════════════════════════════')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
