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

/** Strip HTML tags and decode common entities */
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#\d+;/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Normalize a name for matching: lowercase, remove prefixes */
function normalizeName(name: string): string {
  return name
    .replace(/^(Sen\.|Rep\.|Dr\.|Mr\.|Ms\.|Mrs\.)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Parse "2nd term", "7th term" → 2, 7 */
function parseTerms(text: string): number | null {
  const m = text.match(/(\d+)(?:st|nd|rd|th)\s+term/i)
  return m ? parseInt(m[1]) : null
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

// ── Parser ────────────────────────────────────────────────────────────────────

function parseMembers(html: string): ScrapedProfile[] {
  const profiles: ScrapedProfile[] = []

  // Each member block is anchored by their directory photo:
  //   src="/wp-content/uploads/sessioninfo/2026/directory/Adams6685.jpg"
  // The numeric suffix (6685) is the topic_id, used for modal and subscribe links.

  // Split HTML into blocks by photo img tags
  const photoRe = /src="[^"]*\/directory\/([^"\/]+?)(\d+)\.jpg"/gi
  const splitPoints: Array<{ index: number; topicId: string; namePart: string }> = []

  let m: RegExpExecArray | null
  while ((m = photoRe.exec(html)) !== null) {
    splitPoints.push({
      index: m.index,
      topicId: m[2],
      namePart: m[1].trim(), // e.g. "Adams" or "Den Hartog"
    })
  }

  for (let i = 0; i < splitPoints.length; i++) {
    const start = splitPoints[i].index
    const end = splitPoints[i + 1]?.index ?? html.length
    const block = html.slice(start, end)
    const { topicId } = splitPoints[i]

    // ── Name ──────────────────────────────────────────────────────────────────
    // First <strong> after photo that contains a name (not an email link)
    const nameMatch = block.match(/<strong>(?!<a)([^<]+)<\/strong>/)
    if (!nameMatch) continue
    const rawName = nameMatch[1].replace(/\s+/g, ' ').trim()
    const normalizedName = normalizeName(rawName)
    if (normalizedName.length < 2) continue

    // ── Leadership title ──────────────────────────────────────────────────────
    // Check the block text for known leadership titles
    const blockText = stripHtml(block)
    const leadershipTitle = detectLeadershipTitle(blockText)

    // ── Email ─────────────────────────────────────────────────────────────────
    const emailMatch = block.match(/href="mailto:([^"]+)"/)
    const email = emailMatch ? emailMatch[1].trim() : null

    // ── Statehouse phone ──────────────────────────────────────────────────────
    // Pattern: Statehouse <a href="tel:+12083321336">(208) 332-1336</a>
    const phoneMatch = block.match(/Statehouse[^<]*<a[^>]*href="tel:[^"]*">([^<]+)<\/a>/i)
    const phone = phoneMatch ? phoneMatch[1].trim() : null

    // ── Terms (current) ───────────────────────────────────────────────────────
    // "2nd term", "7th term" — first occurrence
    // (we don't store this separately since the DB already counts terms via legislator_sessions)

    // ── Occupation ────────────────────────────────────────────────────────────
    // Appears as plain text after the statehouse phone line and before "Committees:"
    // Strategy: find the section between statehouse phone and "Committees:"
    let occupation: string | null = null

    const committeesIdx = block.toLowerCase().indexOf('<strong>committees')
    const phoneIdx = phoneMatch ? block.indexOf(phoneMatch[0]) : -1

    if (phoneIdx > -1 && committeesIdx > phoneIdx) {
      // Extract text between end of phone line and committees header
      const afterPhone = block.slice(phoneIdx + phoneMatch![0].length, committeesIdx)
      const lines = stripHtml(afterPhone)
        .split(/[\n\r]+/)
        .map(l => l.trim())
        .filter(l => l.length > 1 && !/^\(session only\)/i.test(l) && !/^subscribe/i.test(l) && !/^\d{5}$/.test(l))

      // First non-empty line that isn't a phone number or zip is the occupation
      const occupationLine = lines.find(l =>
        l.length > 2 &&
        !/^\(?\d{3}\)?[\s-]\d{3}[-\s]\d{4}$/.test(l) && // not a phone number
        !/^\d{5}(-\d{4})?$/.test(l) &&                   // not a zip
        !/^(ID|MT|WY|OR|NV|UT)\s+\d/.test(l)             // not "ID 83706"
      )
      occupation = occupationLine || null
    }

    // Fallback: look for occupation between email and district link
    if (!occupation) {
      // After the Committees header, try to find text lines that look like a job title
      const districtIdx = block.indexOf('/legislators/membership/')
      const emailEnd = emailMatch ? block.indexOf(emailMatch[0]) + emailMatch[0].length : -1
      if (emailEnd > -1 && districtIdx > emailEnd) {
        const midSection = stripHtml(block.slice(emailEnd, districtIdx))
        const candidate = midSection.trim().split(/\s{2,}/).find(l =>
          l.length > 2 && !/District/i.test(l)
        )
        if (candidate) occupation = candidate.trim()
      }
    }

    // ── Bio from modal popup ──────────────────────────────────────────────────
    // The bio is in a modal div: id="modal-popup-{topicId}"
    // We'll extract it from the full HTML separately (see extractBios below)
    // For now just record null — it gets filled in extractBios()

    profiles.push({
      topicId,
      rawName,
      normalizedName,
      email,
      phone,
      occupation: occupation?.length ? occupation : null,
      leadershipTitle,
      bio: null, // filled below
    })
  }

  return profiles
}

/** Extract bio texts from modal popup divs in the page HTML */
function extractBios(html: string): Map<string, string> {
  const bios = new Map<string, string>()

  // Match: <div id="modal-popup-6685" ...>...</div>
  // Modal content ends before the next modal or end of page
  // Try a few common wrapper patterns
  const modalRe = /id="modal-popup-(\d+)"[^>]*>([\s\S]*?)(?=id="modal-popup-\d+"|<\/body>|<script)/gi
  let m: RegExpExecArray | null
  while ((m = modalRe.exec(html)) !== null) {
    const topicId = m[1]
    const content = m[2]

    // Strip HTML and clean up
    let text = stripHtml(content)

    // Remove "Print" / button artifacts
    text = text
      .replace(/\bPrint\b/g, '')
      .replace(/\bDismiss\b/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (text.length > 30) {
      bios.set(topicId, text)
    }
  }

  return bios
}

// ── Name matching ─────────────────────────────────────────────────────────────

function matchLegislator(
  normalized: string,
  legislators: Array<{ id: string; name: string; chamber: string }>,
  chamber: string
): string | null {
  // Prefer same-chamber match
  const sameChamber = legislators.filter(l => l.chamber === chamber)
  const all = [...sameChamber, ...legislators.filter(l => l.chamber !== chamber)]

  for (const leg of all) {
    if (normalizeName(leg.name) === normalized) return leg.id
  }

  // Last name + first initial
  const parts = normalized.split(/\s+/)
  const last = parts[parts.length - 1]
  const firstInitial = parts[0]?.[0] || ''

  const lastMatches = all.filter(l => {
    const lp = normalizeName(l.name).split(/\s+/)
    return lp[lp.length - 1] === last
  })

  if (lastMatches.length === 1) return lastMatches[0].id
  if (lastMatches.length > 1 && firstInitial) {
    const hit = lastMatches.find(l => normalizeName(l.name).split(/\s+/)[0]?.[0] === firstInitial)
    if (hit) return hit.id
  }

  return null
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  Tally Idaho — Member Profile Importer')
  if (DRY_RUN) console.log('  DRY RUN — no DB writes')
  console.log('═══════════════════════════════════════════════════\n')

  // Load all legislators from DB
  const { data: legislators, error: legErr } = await supabase
    .from('legislators')
    .select('id, name, chamber, email, occupation, leadership_title, phone')

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

    // Attach bios to profiles
    for (const p of profiles) {
      p.bio = bios.get(p.topicId) ?? null
    }

    for (const p of profiles) {
      const legId = matchLegislator(p.normalizedName, legislators, chamber)

      if (!legId) {
        totalUnmatched++
        console.log(`  ✗ No match: "${p.rawName}"`)
        continue
      }

      const leg = legislators.find(l => l.id === legId)!

      const changes: Record<string, string | null> = {}
      if (p.email && p.email !== leg.email) changes.email = p.email
      if (p.phone && p.phone !== leg.phone) changes.phone = p.phone
      if (p.occupation && p.occupation !== (leg as any).occupation) changes.occupation = p.occupation
      if (p.leadershipTitle && p.leadershipTitle !== (leg as any).leadership_title)
        changes.leadership_title = p.leadershipTitle
      if (p.bio) changes.legislature_bio = p.bio

      const changeCount = Object.keys(changes).length
      if (changeCount === 0) {
        console.log(`  = ${leg.name.padEnd(30)} (no changes)`)
        continue
      }

      console.log(`  ✓ ${leg.name.padEnd(30)}`)
      for (const [k, v] of Object.entries(changes)) {
        const preview = String(v).slice(0, 60) + (String(v).length > 60 ? '…' : '')
        console.log(`      ${k}: ${preview}`)
      }

      if (!DRY_RUN) {
        const { error } = await supabase
          .from('legislators')
          .update(changes)
          .eq('id', legId)

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
