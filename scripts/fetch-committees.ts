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

/** Strip HTML tags and decode basic entities */
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Strip legislator title prefixes (Sen., Rep., Dr., etc.) and normalize */
function normalizeLegName(name: string): string {
  return name
    .replace(/^(Sen\.|Rep\.|Dr\.|Mr\.|Ms\.|Mrs\.)\s*/i, '')
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
 * The Idaho Legislature committee pages typically show a table of members
 * with name (linked to their profile), role/title, and district.
 *
 * Example HTML patterns:
 *   <td><a href="/senate/membership/...">Sen. John Smith</a></td>
 *   <td>Chair</td>
 *   <td>SD-001</td>
 */
async function scrapeCommitteeMembers(committeeUrl: string): Promise<ParsedMember[]> {
  const html = await fetchPage(committeeUrl)
  const members: ParsedMember[] = []

  // Strategy 1: find legislator profile links with nearby role text
  // Links to legislator profiles: /senate/membership/... or /house/membership/...
  // Or /sessioninfo/{year}/committees/... for older page formats
  const memberSections: Array<{ name: string; role: string }> = []

  // Look for table rows — try to parse the member table
  // Pattern: find <tr> blocks containing a legislator link
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let trMatch: RegExpExecArray | null
  while ((trMatch = trRe.exec(html)) !== null) {
    const row = trMatch[1]

    // Extract all <td> cell texts from this row
    const cells: string[] = []
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi
    let tdMatch: RegExpExecArray | null
    while ((tdMatch = tdRe.exec(row)) !== null) {
      cells.push(stripHtml(tdMatch[1]))
    }

    if (cells.length < 2) continue

    // Look for a row where one cell looks like a person's name and another like a role
    const roleKeywords = /^(chair|vice\s+chair|member|co-chair|ranking\s+member)$/i

    let name = ''
    let role = 'Member'

    for (const cell of cells) {
      if (roleKeywords.test(cell.trim())) {
        // Normalize role
        const lc = cell.trim().toLowerCase()
        if (lc === 'chair') role = 'Chair'
        else if (lc.includes('vice')) role = 'Vice Chair'
        else if (lc.includes('co-chair')) role = 'Co-Chair'
        else role = 'Member'
      } else if (cell.length > 3 && cell.length < 50 && /[A-Z]/.test(cell)) {
        // Likely a person's name — has mixed case, reasonable length
        // Exclude cells that are clearly not names (district codes, numbers, etc.)
        if (!/^(SD-|HD-|District|District\s+\d|^\d+$)/.test(cell)) {
          name = cell
        }
      }
    }

    if (name && !members.some(m => m.fullName === name)) {
      memberSections.push({ name, role })
    }
  }

  // Strategy 2: find links to legislator pages if no table rows found
  if (memberSections.length === 0) {
    const legLinkRe = /href="([^"]*\/(senate|house)\/(?:membership|members?)\/[^"]+)">([^<]+)<\/a>/gi
    let linkMatch: RegExpExecArray | null
    while ((linkMatch = legLinkRe.exec(html)) !== null) {
      const rawName = stripHtml(linkMatch[3])
      if (rawName.length < 3) continue

      // Try to find the role near this link (within 200 chars before/after)
      const contextStart = Math.max(0, linkMatch.index - 200)
      const context = html.slice(contextStart, linkMatch.index + 200)
      let role = 'Member'
      if (/Chair(?!\s+Vice)/i.test(context)) role = 'Chair'
      else if (/Vice\s+Chair/i.test(context)) role = 'Vice Chair'

      memberSections.push({ name: rawName, role })
    }
  }

  // Deduplicate and build final list
  const seen = new Set<string>()
  for (const { name, role } of memberSections) {
    const norm = normalizeLegName(name)
    if (!seen.has(norm)) {
      seen.add(norm)
      members.push({ fullName: name, normalizedName: norm, role })
    }
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
