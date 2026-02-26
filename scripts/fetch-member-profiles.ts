/**
 * fetch-member-profiles.ts
 *
 * Scrapes Idaho Legislature membership pages to enrich legislator profiles with:
 *   - email
 *   - phone (statehouse)
 *   - occupation
 *   - leadership_title (e.g. "Majority Leader", "Speaker of the House")
 *   - legislature_bio (from modal popup on the page)
 *
 * Sources:
 *   https://legislature.idaho.gov/senate/membership/
 *   https://legislature.idaho.gov/house/membership/
 *
 * Usage:
 *   npx tsx scripts/fetch-member-profiles.ts            # update DB
 *   npx tsx scripts/fetch-member-profiles.ts --dry-run  # preview, no writes
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BASE = 'https://legislature.idaho.gov'
const DRY_RUN = process.argv.includes('--dry-run')

const MEMBERSHIP_URLS = [
  { url: `${BASE}/senate/membership/`, chamber: 'senate' },
  { url: `${BASE}/house/membership/`,  chamber: 'house'  },
]

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScrapedProfile {
  topicId: string
  rawName: string
  normalizedName: string
  email: string | null
  phone: string | null
  occupation: string | null
  leadershipTitle: string | null
  bio: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'TallyIdaho/1.0 (tallyidaho.com; public data aggregator)' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  return res.text()
}

/** Decode HTML entities (including &nbsp;) to plain text */
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Strip HTML tags, then decode entities */
function stripHtml(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, ' '))
}

/** Normalize a name for matching: decode entities, strip titles, lowercase */
function normalizeName(name: string): string {
  return decodeEntities(name)
    .replace(/^(Sen\.|Rep\.|Dr\.|Mr\.|Ms\.|Mrs\.)\s*/i, '')
    .replace(/["""]/g, '') // remove quote chars around nicknames
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

const LEADERSHIP_TITLES = [
  'President Pro Tempore',
  'Speaker of the House',
  'Speaker Pro Tempore',
  'Majority Leader',
  'Minority Leader',
  'Majority Whip',
  'Minority Whip',
  'Majority Caucus Chair',
  'Minority Caucus Chair',
  'Majority Caucus Vice Chair',
  'Minority Caucus Vice Chair',
  'Assistant Majority Leader',
  'Assistant Minority Leader',
]

function detectLeadershipTitle(text: string): string | null {
  for (const title of LEADERSHIP_TITLES) {
    if (text.toLowerCase().includes(title.toLowerCase())) return title
  }
  return null
}

/** True if a decoded name IS a leadership title (not a person's name) */
function isLeadershipTitleEntry(name: string): boolean {
  const n = name.trim().toLowerCase()
  return LEADERSHIP_TITLES.some(t => t.toLowerCase() === n)
}

// ── Parser ────────────────────────────────────────────────────────────────────

function parseMembers(html: string): ScrapedProfile[] {
  const profiles: ScrapedProfile[] = []

  // Split on directory photo img tags — each block = one member
  const photoRe = /src="[^"]*\/directory\/([^"\/]+?)(\d+)\.jpg"/gi
  const splitPoints: Array<{ index: number; topicId: string }> = []

  let m: RegExpExecArray | null
  while ((m = photoRe.exec(html)) !== null) {
    splitPoints.push({ index: m.index, topicId: m[2] })
  }

  for (let i = 0; i < splitPoints.length; i++) {
    const start = splitPoints[i].index
    const end = splitPoints[i + 1]?.index ?? html.length
    const block = html.slice(start, end)
    const { topicId } = splitPoints[i]

    // ── Name ──────────────────────────────────────────────────────────────────
    // First <strong> that doesn't contain an <a> tag
    const nameMatch = block.match(/<strong>(?!<a)([^<]+)<\/strong>/)
    if (!nameMatch) continue

    const rawName = decodeEntities(nameMatch[1]) // decode &nbsp; etc.
    const normalizedName = normalizeName(rawName)
    if (normalizedName.length < 2) continue

    // Skip entries whose "name" is actually a leadership title label
    if (isLeadershipTitleEntry(rawName)) continue

    // ── Plain text of entire block (for text-based extraction) ─────────────
    const plain = stripHtml(block)

    // ── Leadership title ──────────────────────────────────────────────────────
    const leadershipTitle = detectLeadershipTitle(plain)

    // ── Email ─────────────────────────────────────────────────────────────────
    const emailMatch = block.match(/href="mailto:([^"]+)"/)
    const email = emailMatch ? emailMatch[1].trim() : null

    // ── Statehouse phone ──────────────────────────────────────────────────────
    // Pattern: Statehouse <a href="tel:+12083321336">(208) 332-1336</a>
    const phoneMatch = block.match(/Statehouse[^<]*<a[^>]*href="tel:[^"]*">([^<]+)<\/a>/i)
    const phone = phoneMatch ? phoneMatch[1].trim() : null

    // ── Occupation ────────────────────────────────────────────────────────────
    // In the plain text: comes after "(Session Only)" and before "Committees:"
    let occupation: string | null = null
    const soIdx  = plain.toLowerCase().indexOf('(session only)')
    const cIdx   = plain.toLowerCase().indexOf('committees:')

    if (soIdx > -1 && cIdx > soIdx) {
      const between = plain
        .slice(soIdx + '(session only)'.length, cIdx)
        .replace(/subscribe to mailing list\(s\)/gi, '')
        .replace(/view bio/gi, '')
        .trim()
      if (between.length > 1 && between.length < 80) {
        occupation = between || null
      }
    }

    // ── Bio from modal popup ──────────────────────────────────────────────────
    // Filled in extractBios() below

    profiles.push({
      topicId,
      rawName,
      normalizedName,
      email,
      phone,
      occupation,
      leadershipTitle,
      bio: null,
    })
  }

  return profiles
}

/** Extract bio texts from modal popup divs in the page HTML */
function extractBios(html: string): Map<string, string> {
  const bios = new Map<string, string>()

  // Match: id="modal-popup-6685" ... up to next modal or </body>
  const modalRe = /id="modal-popup-(\d+)"[^>]*>([\s\S]*?)(?=id="modal-popup-\d+"|<\/body>|<script)/gi
  let m: RegExpExecArray | null
  while ((m = modalRe.exec(html)) !== null) {
    const topicId = m[1]
    let text = stripHtml(m[2])

    // The modal content sometimes starts with the email address or leadership title — strip those
    text = text
      .replace(/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\s*/i, '') // leading email
      .replace(new RegExp(`^(?:${LEADERSHIP_TITLES.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s*`, 'i'), '')
      .replace(/\bPrint\b/g, '')
      .replace(/\bDismiss\b/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (text.length > 30) bios.set(topicId, text)
  }

  return bios
}

// ── Name matching ─────────────────────────────────────────────────────────────

function matchLegislator(
  profile: ScrapedProfile,
  legislators: Array<{ id: string; name: string; chamber: string }>,
  chamber: string
): string | null {
  const { normalizedName, rawName } = profile

  // Prefer same-chamber, then fall back to all
  const ordered = [
    ...legislators.filter(l => l.chamber === chamber),
    ...legislators.filter(l => l.chamber !== chamber),
  ]

  // 1. Exact normalized match
  for (const leg of ordered) {
    if (normalizeName(leg.name) === normalizedName) return leg.id
  }

  // Extract parts from scraped name
  const parts = normalizedName.split(/\s+/).filter(Boolean)
  const last  = parts[parts.length - 1]
  const first = parts[0] || ''

  // Extract nickname from raw name (text inside "quotes")
  const nickMatch = rawName.match(/["""']([A-Za-z]+)["""']/)
  const nickname = nickMatch ? nickMatch[1].toLowerCase() : null

  // Candidates with matching last name
  const lastMatches = ordered.filter(l => {
    const lp = normalizeName(l.name).split(/\s+/)
    return lp[lp.length - 1] === last
  })

  if (lastMatches.length === 1) return lastMatches[0].id

  if (lastMatches.length > 1) {
    // Try first name match
    const firstHit = lastMatches.find(l => normalizeName(l.name).split(/\s+/)[0] === first)
    if (firstHit) return firstHit.id

    // Try nickname match (e.g., "Jim" Woodward → James Woodward)
    if (nickname) {
      const nickHit = lastMatches.find(l => {
        const fn = normalizeName(l.name).split(/\s+/)[0] || ''
        return fn === nickname || fn[0] === nickname[0]
      })
      if (nickHit) return nickHit.id
    }

    // Try first initial match
    const initialHit = lastMatches.find(l => normalizeName(l.name).split(/\s+/)[0]?.[0] === first[0])
    if (initialHit) return initialHit.id
  }

  return null
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  Tally Idaho — Member Profile Importer')
  if (DRY_RUN) console.log('  DRY RUN — no DB writes')
  console.log('═══════════════════════════════════════════════════\n')

  const { data: legislators, error: legErr } = await supabase
    .from('legislators')
    .select('id, name, chamber, email, phone, occupation, leadership_title')

  if (legErr || !legislators) {
    console.error('Failed to load legislators:', legErr?.message)
    process.exit(1)
  }

  console.log(`Loaded ${legislators.length} legislators from DB\n`)

  let totalUpdated = 0
  let totalUnmatched = 0

  for (const { url, chamber } of MEMBERSHIP_URLS) {
    console.log(`── ${chamber.toUpperCase()} ─────────────────────────────────`)
    console.log(`Fetching ${url}...`)

    const html = await fetchPage(url)
    const profiles = parseMembers(html)
    const bios = extractBios(html)

    console.log(`Scraped ${profiles.length} members, ${bios.size} bios found\n`)

    for (const p of profiles) {
      p.bio = bios.get(p.topicId) ?? null
    }

    for (const p of profiles) {
      const legId = matchLegislator(p, legislators, chamber)

      if (!legId) {
        totalUnmatched++
        console.log(`  ✗ No match: "${p.rawName}"`)
        continue
      }

      const leg = legislators.find(l => l.id === legId)!
      const changes: Record<string, string | null> = {}

      if (p.email     && p.email     !== (leg as any).email)            changes.email            = p.email
      if (p.phone     && p.phone     !== (leg as any).phone)            changes.phone            = p.phone
      if (p.occupation && p.occupation !== (leg as any).occupation)     changes.occupation       = p.occupation
      if (p.leadershipTitle && p.leadershipTitle !== (leg as any).leadership_title)
                                                                         changes.leadership_title = p.leadershipTitle
      if (p.bio)                                                         changes.legislature_bio  = p.bio

      if (Object.keys(changes).length === 0) {
        if (DRY_RUN) console.log(`  = ${leg.name.padEnd(30)} (no changes)`)
        continue
      }

      console.log(`  ✓ ${leg.name.padEnd(30)}`)
      for (const [k, v] of Object.entries(changes)) {
        const preview = String(v).slice(0, 70) + (String(v).length > 70 ? '…' : '')
        console.log(`      ${k}: ${preview}`)
      }

      if (!DRY_RUN) {
        const { error } = await supabase.from('legislators').update(changes).eq('id', legId)
        if (error) console.error(`      DB error: ${error.message}`)
        else totalUpdated++
      } else {
        totalUpdated++
      }
    }

    console.log()
  }

  console.log('═══════════════════════════════════════════════════')
  console.log(`  Updated   : ${totalUpdated}`)
  console.log(`  Unmatched : ${totalUnmatched}`)
  if (DRY_RUN) console.log('  (dry run — no changes written)')
  console.log('═══════════════════════════════════════════════════')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
