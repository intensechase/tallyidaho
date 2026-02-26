/**
 * fetch-committees.ts
 *
 * Scrapes Idaho Legislature standing committee pages for 2025 and 2026,
 * then upserts committee rosters (name, code, chamber, members) into Supabase.
 *
 * Usage:
 *   npx tsx scripts/fetch-committees.ts            # import both years
 *   npx tsx scripts/fetch-committees.ts --dry-run  # preview, no DB writes
 *   npx tsx scripts/fetch-committees.ts --year 2026
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BASE = 'https://legislature.idaho.gov'
const DELAY_MS = 300
const DRY_RUN = process.argv.includes('--dry-run')

const yearArg = process.argv.includes('--year')
  ? parseInt(process.argv[process.argv.indexOf('--year') + 1])
  : null
const YEARS = yearArg ? [yearArg] : [2025, 2026]

// ── Types ────────────────────────────────────────────────────────────────────

interface ParsedCommittee {
  code: string
  name: string
  shortName: string
  chamber: string
  url: string
}

interface ParsedMember {
  fullName: string       // as scraped
  normalizedName: string // lowercase, no prefix
  role: string           // Chair / Vice Chair / Member
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'TallyIdaho/1.0 (tallyidaho.com; public data aggregator)' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  return res.text()
}

/** Decode HTML entities (including &nbsp;) */
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Strip HTML tags and decode entities */
function stripHtml(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, ' '))
}

/** Strip legislator title prefixes (Sen., Rep., Dr., etc.) and normalize */
function normalizeLegName(name: string): string {
  return decodeEntities(name)
    .replace(/^(Sen\.|Rep\.|Dr\.|Mr\.|Ms\.|Mrs\.)\s*/i, '')
    .replace(/["""]/g, '')
    .trim()
    .toLowerCase()
}

/** Infer chamber from committee name or code */
function inferChamber(name: string, code: string): string {
  const n = name.toLowerCase()
  if (n.startsWith('senate') || code.startsWith('S')) return 'senate'
  if (n.startsWith('house') || code.startsWith('H')) return 'house'
  if (n.startsWith('joint') || code.startsWith('J')) return 'joint'
  return 'unknown'
}

/** Strip chamber prefix from committee name to get short name */
function shortName(name: string): string {
  return name
    .replace(/^Senate\s+/i, '')
    .replace(/^House\s+/i, '')
    .replace(/^Joint\s+/i, '')
    .trim()
}

// ── Scraping ─────────────────────────────────────────────────────────────────

/**
 * Fetch the standing committees index page and extract all committee links.
 * Expects links like: href="/sessioninfo/2026/standingcommittees/SHHS/"
 */
async function scrapeCommitteeIndex(year: number): Promise<ParsedCommittee[]> {
  const url = `${BASE}/sessioninfo/${year}/standingcommittees/`
  const html = await fetchPage(url)

  const committees: ParsedCommittee[] = []
  const seen = new Set<string>()

  // Match committee links: /sessioninfo/{year}/standingcommittees/{CODE}/
  const linkRe = /href="([^"]*\/standingcommittees\/([A-Z0-9]+)\/?)"/gi
  let m: RegExpExecArray | null
  while ((m = linkRe.exec(html)) !== null) {
    const href = m[1]
    const code = m[2].toUpperCase()
    if (seen.has(code)) continue
    seen.add(code)

    // Get the link text as committee name
    // Look for the text between this href and the next closing </a>
    const afterHref = html.slice(m.index)
    const linkTextMatch = afterHref.match(/>([\s\S]*?)<\/a>/)
    const name = linkTextMatch ? stripHtml(linkTextMatch[1]) : code

    if (!name || name.length < 3) continue

    const fullUrl = href.startsWith('http') ? href : `${BASE}${href}`
    const chamber = inferChamber(name, code)
    committees.push({
      code,
      name,
      shortName: shortName(name),
      chamber,
      url: fullUrl,
    })
  }

  return committees
}

/**
 * Fetch a committee detail page and extract its members.
 *
 * Idaho Legislature committee pages use the same photo-block layout as
 * the membership pages. Each member block starts with their directory photo
 * and contains a link to their legislator profile with the role appended.
 *
 * Example structure (per member block):
 *   <img src="...Nichols5380.jpg">
 *   <a href="/legislators/membership/2026/id5380">Sen. Tammy Nichols</a>, Chair
 *   District 10 | phone | email
 */
async function scrapeCommitteeMembers(committeeUrl: string): Promise<ParsedMember[]> {
  const html = await fetchPage(committeeUrl)
  const members: ParsedMember[] = []

  // Split into per-member blocks using directory photo as anchor
  const photoRe = /src="[^"]*\/directory\/([^"\/]+?)(\d+)\.jpg"/gi
  const splitPoints: Array<{ index: number; topicId: string }> = []

  let m: RegExpExecArray | null
  while ((m = photoRe.exec(html)) !== null) {
    splitPoints.push({ index: m.index, topicId: m[2] })
  }

  const seen = new Set<string>()

  for (let i = 0; i < splitPoints.length; i++) {
    const start = splitPoints[i].index
    const end = splitPoints[i + 1]?.index ?? html.length
    const block = html.slice(start, end)

    // Find the member profile link — href="/legislators/membership/{year}/id{N}"
    // The link text contains the name (with "Sen." / "Rep." prefix)
    const nameLinkRe = /href="[^"]*\/legislators\/membership\/[^"]*">([^<]+)<\/a>/i
    const nameMatch = nameLinkRe.exec(block)
    if (!nameMatch) continue

    const rawName = decodeEntities(nameMatch[1])
    const normalizedName = normalizeLegName(rawName)
    if (normalizedName.length < 2 || seen.has(normalizedName)) continue
    seen.add(normalizedName)

    // Role: look for ", Chair" / ", Vice Chair" in text immediately after the link
    const afterLink = stripHtml(block.slice(block.indexOf(nameMatch[0]) + nameMatch[0].length, block.indexOf(nameMatch[0]) + nameMatch[0].length + 150))
    let role = 'Member'
    if (/Vice\s*Chair/i.test(afterLink))           role = 'Vice Chair'
    else if (/Co-?Chair/i.test(afterLink))          role = 'Co-Chair'
    else if (/\bChair\b/i.test(afterLink))          role = 'Chair'

    // Fallback: check broader block text (first 300 chars)
    if (role === 'Member') {
      const blockPlain = stripHtml(block.slice(0, 300))
      if (/Vice\s*Chair/i.test(blockPlain))         role = 'Vice Chair'
      else if (/Co-?Chair/i.test(blockPlain))        role = 'Co-Chair'
      else if (/\bChair\b/i.test(blockPlain))        role = 'Chair'
    }

    members.push({ fullName: rawName, normalizedName, role })
  }

  return members
}

// ── Name matching ─────────────────────────────────────────────────────────────

/**
 * Match a scraped name against the legislators table.
 * Uses a flexible matching: last name + first initial.
 */
function matchLegislator(
  scraped: ParsedMember,
  legislators: Array<{ id: string; name: string }>
): string | null {
  // Exact normalized match
  for (const leg of legislators) {
    if (leg.name.toLowerCase() === scraped.normalizedName) return leg.id
  }

  // Last name match
  const scrapedParts = scraped.normalizedName.split(/\s+/)
  const scrapedLast = scrapedParts[scrapedParts.length - 1]
  const scrapedFirst = scrapedParts[0]?.[0] || '' // first initial

  const lastMatches = legislators.filter(leg => {
    const parts = leg.name.toLowerCase().split(/\s+/)
    return parts[parts.length - 1] === scrapedLast
  })

  if (lastMatches.length === 1) return lastMatches[0].id

  // Multiple last name matches — try first initial
  if (lastMatches.length > 1 && scrapedFirst) {
    const firstInitialMatches = lastMatches.filter(leg => {
      const fn = leg.name.toLowerCase().split(/\s+/)[0]?.[0] || ''
      return fn === scrapedFirst
    })
    if (firstInitialMatches.length === 1) return firstInitialMatches[0].id
  }

  return null
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  Tally Idaho — Committee Importer')
  if (DRY_RUN) console.log('  DRY RUN — no DB writes')
  console.log(`  Years: ${YEARS.join(', ')}`)
  console.log('═══════════════════════════════════════════════════\n')

  let totalCommittees = 0
  let totalMembers = 0
  let totalUnmatched = 0

  for (const year of YEARS) {
    console.log(`\n── ${year} ────────────────────────────────────────────`)

    // Get session ID
    const { data: session } = await supabase
      .from('sessions')
      .select('id, name')
      .eq('year_start', year)
      .single()

    if (!session) {
      console.warn(`  No session found for year ${year}, skipping`)
      continue
    }

    console.log(`  Session: ${session.name} (${session.id})`)

    // Fetch all legislators in this session for name matching
    const { data: legSessions } = await supabase
      .from('legislator_sessions')
      .select('legislators(id, name, role, district)')
      .eq('session_id', session.id)

    const legislators = (legSessions || [])
      .map((ls: any) => ls.legislators)
      .filter(Boolean)
      .filter((l: any) => l.role === 'Sen' || l.role === 'Rep')

    console.log(`  Legislators in session: ${legislators.length}`)

    // Scrape the committee index
    console.log(`\n  Fetching committee index...`)
    const committees = await scrapeCommitteeIndex(year)
    console.log(`  Found ${committees.length} committees\n`)

    if (committees.length === 0) {
      console.warn('  No committees found — check URL pattern')
      continue
    }

    // Process each committee
    for (const committee of committees) {
      console.log(`  [${committee.code}] ${committee.name}`)

      await delay(DELAY_MS)

      let members: ParsedMember[] = []
      try {
        members = await scrapeCommitteeMembers(committee.url)
      } catch (err: any) {
        console.warn(`    ✗ Failed to fetch members: ${err.message}`)
        continue
      }

      console.log(`    Members scraped: ${members.length}`)

      // Match to legislators
      const matched: Array<{ legislatorId: string; role: string; name: string }> = []
      const unmatched: string[] = []

      for (const m of members) {
        const legId = matchLegislator(m, legislators)
        if (legId) {
          matched.push({ legislatorId: legId, role: m.role, name: m.fullName })
        } else {
          unmatched.push(m.fullName)
        }
      }

      if (unmatched.length > 0) {
        console.log(`    ⚠ Unmatched (${unmatched.length}): ${unmatched.join(', ')}`)
        totalUnmatched += unmatched.length
      }

      console.log(`    Matched: ${matched.length}/${members.length}`)

      if (!DRY_RUN) {
        // Upsert committee
        const { data: committeeRow, error: cErr } = await supabase
          .from('committees')
          .upsert(
            {
              code: committee.code,
              name: committee.name,
              short_name: committee.shortName,
              chamber: committee.chamber,
              session_id: session.id,
            },
            { onConflict: 'code,session_id' }
          )
          .select('id')
          .single()

        if (cErr || !committeeRow) {
          console.error(`    ✗ DB error upserting committee: ${cErr?.message}`)
          continue
        }

        const committeeId = committeeRow.id

        // Delete existing members (clean re-import)
        await supabase.from('committee_members').delete().eq('committee_id', committeeId)

        // Insert members
        if (matched.length > 0) {
          const memberRows = matched.map(m => ({
            committee_id: committeeId,
            legislator_id: m.legislatorId,
            member_role: m.role,
          }))
          const { error: mErr } = await supabase.from('committee_members').insert(memberRows)
          if (mErr) console.error(`    ✗ DB error inserting members: ${mErr.message}`)
        }

        console.log(`    ✓ Saved to DB`)
      }

      totalCommittees++
      totalMembers += matched.length
    }
  }

  console.log('\n═══════════════════════════════════════════════════')
  console.log(`  Committees : ${totalCommittees}`)
  console.log(`  Members    : ${totalMembers}`)
  console.log(`  Unmatched  : ${totalUnmatched}`)
  if (DRY_RUN) console.log('  (dry run — no changes written)')
  console.log('═══════════════════════════════════════════════════')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
