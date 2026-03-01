/**
 * fetch-committee-meetings.ts
 *
 * Fetches meeting records from Idaho Legislature standing committee pages
 * and upserts them into the committee_meetings table.
 *
 * Usage:
 *   npx tsx scripts/fetch-committee-meetings.ts              # all committees, 2026
 *   npx tsx scripts/fetch-committee-meetings.ts --code SAGA  # single committee
 *   npx tsx scripts/fetch-committee-meetings.ts --dry-run    # preview only
 *   npx tsx scripts/fetch-committee-meetings.ts --year 2025  # different year
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BASE = 'https://legislature.idaho.gov'
const DELAY_MS = 200
const DRY_RUN = process.argv.includes('--dry-run')

const yearArg = process.argv.includes('--year')
  ? parseInt(process.argv[process.argv.indexOf('--year') + 1])
  : 2026

const codeArg = process.argv.includes('--code')
  ? process.argv[process.argv.indexOf('--code') + 1].toUpperCase()
  : null

// ── Video URL builder ─────────────────────────────────────────────────────────

/**
 * Build a speculative insession.idaho.gov video URL for a committee meeting.
 * Pattern: https://insession.idaho.gov/IIS/{year}/{Chamber}/Committee/{Name}/{YYMMDD}_{code}_{HHMM}{AM|PM}-Meeting.mp4
 */
function buildVideoUrl(
  name: string,
  chamber: string,
  code: string,
  date: string,   // ISO "2026-01-22"
  time: string,   // "8:00 AM"
  year: number,
): string | null {
  // Strip chamber prefix from name
  const shortName = name
    .replace(/^House\s+/i, '')
    .replace(/^Senate\s+/i, '')
    .replace(/^Joint\s+/i, '')

  // ISO date → YYMMDD
  const [y, m, d] = date.split('-')
  const dateStr = `${y.slice(2)}${m}${d}`

  // "8:00 AM" → "0800AM"
  const timeM = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (!timeM) return null
  const hh = timeM[1].padStart(2, '0')
  const mm = timeM[2]
  const ap = timeM[3].toUpperCase()
  const timeStr = `${hh}${mm}${ap}`

  const chamberPath = chamber === 'senate' ? 'Senate'
    : chamber === 'house' ? 'House'
    : 'Joint'

  return `https://insession.idaho.gov/IIS/${year}/${chamberPath}/Committee/${encodeURIComponent(shortName)}/${dateStr}_${code.toLowerCase()}_${timeStr}-Meeting.mp4`
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParsedMeeting {
  date: string                              // ISO "2026-01-22"
  time: string | null                       // "8:00 AM"
  room: string | null
  status: 'met' | 'will_not_meet' | 'scheduled'
  agendaUrl: string | null
  minutesUrl: string | null
  videoUrl: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TallyIdaho/1.0 (tallyidaho.com; public data aggregator)' },
    })
    if (!res.ok) return null
    return res.text()
  } catch {
    return null
  }
}

// Month abbreviation map (handles both "Jan." and "January")
const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

/**
 * Parse "Tue., Jan. 22, 2026" or "January 22, 2026" → "2026-01-22"
 */
function parseDate(raw: string): string | null {
  // Match month (abbreviated or full) + day + year
  const m = raw.match(/\b([A-Za-z]{3,}\.?)\s+(\d{1,2})[,\s]+(\d{4})\b/)
  if (!m) return null
  const monthKey = m[1].replace(/\.$/, '').toLowerCase().slice(0, 3)
  const month = MONTHS[monthKey]
  if (!month) return null
  return `${m[3]}-${month}-${m[2].padStart(2, '0')}`
}

/**
 * Parse "8:00 A.M." or "8:00 AM" or "8:00 am" → "8:00 AM"
 */
function parseTime(raw: string): string | null {
  const m = raw.match(/\b(\d{1,2}:\d{2})\s*([AaPp]\.?[Mm]\.?)\b/)
  if (!m) return null
  const ap = m[2].replace(/\./g, '').toUpperCase()
  return `${m[1]} ${ap}`
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractHref(cellHtml: string): string | null {
  const m = cellHtml.match(/href="([^"]+)"/i)
  if (!m) return null
  // Decode HTML entities that appear in href attributes (e.g. &#038; → &, &amp; → &)
  return m[1]
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/&amp;/g, '&')
}

function absoluteUrl(href: string | null): string | null {
  if (!href) return null
  if (href.startsWith('http')) return href
  if (href.startsWith('/')) return BASE + href
  return null
}

/**
 * Parse the committee meeting record from the standing committee page HTML.
 *
 * Idaho Legislature pages use a WordPress Visual Composer div-based layout,
 * NOT a real <table>. Each meeting row is:
 *   <div class="meetings-table hcode-inner-row">
 *     col0: Date + optional time  (e.g. "Tue., Jan. 22, 2026 8:00 A.M.")
 *     col1: Agenda PDF link
 *     col2: Status text ("Will not meet", "Amended #1", or blank)
 *     col3: Minutes PDF link (or "Will not meet")
 *     col4: Meeting Materials (attachments)
 *     col5: Audio/Video Archive (insession.idaho.gov link)
 *
 * Cell content is inside: class="meetings-table"><p>CONTENT</p>
 */
function parseMeetings(html: string): ParsedMeeting[] {
  const meetings: ParsedMeeting[] = []

  // Split on row boundaries — each "hcode-inner-row" is one meeting row
  const rows = html.split('hcode-inner-row')

  for (let i = 1; i < rows.length; i++) {
    const rowHtml = rows[i]

    // Extract cell HTML from innermost .meetings-table <p> tags
    const cellMatches = Array.from(
      rowHtml.matchAll(/class="meetings-table"><p>([\s\S]*?)<\/p>/g)
    )
    if (cellMatches.length < 2) continue

    const cells = cellMatches.map(m => m[1].trim())

    // Col 0: Date + optional time
    const col0Text = stripHtml(cells[0])
    const date = parseDate(col0Text)
    if (!date) continue  // skip header row and non-meeting divs

    const time = parseTime(col0Text)

    // Room: sometimes appended to date text (e.g. "... 8:00 A.M. WW54")
    const roomM = col0Text.match(/\bRoom\s+([A-Z]{1,3}\d{2,3}[A-Z]?|\d{2,3}[A-Z]?)\b/i)
    const room = roomM ? roomM[1] : null

    // Col 1: Agenda PDF link
    const agendaUrl = absoluteUrl(extractHref(cells[1] ?? ''))

    // Col 2: Status text
    const col2Text = stripHtml(cells[2] ?? '')
    const willNotMeet = /will\s+not\s+meet/i.test(col0Text + ' ' + col2Text)

    // Col 3: Minutes PDF link
    const minutesUrl = absoluteUrl(extractHref(cells[3] ?? ''))

    // Col 4+: scan for insession.idaho.gov video link
    let videoUrl: string | null = null
    for (let c = 4; c < cells.length; c++) {
      const href = extractHref(cells[c] ?? '')
      if (href?.includes('insession')) {
        videoUrl = href
        break
      }
    }

    // Determine status
    let status: 'met' | 'will_not_meet' | 'scheduled'
    if (willNotMeet) {
      status = 'will_not_meet'
    } else if (minutesUrl || videoUrl) {
      status = 'met'
    } else {
      const today = new Date().toISOString().slice(0, 10)
      status = date < today ? 'met' : 'scheduled'
    }

    meetings.push({ date, time, room, status, agendaUrl, minutesUrl, videoUrl })
  }

  return meetings
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  Tally Idaho — Committee Meetings Importer')
  if (DRY_RUN) console.log('  DRY RUN — no DB writes')
  console.log(`  Year: ${yearArg}`)
  if (codeArg) console.log(`  Code: ${codeArg}`)
  console.log('═══════════════════════════════════════════════════\n')

  // Get session
  const { data: session } = await supabase
    .from('sessions')
    .select('id, name, year_start')
    .eq('year_start', yearArg)
    .single()

  if (!session) {
    console.error(`No session found for year ${yearArg}`)
    process.exit(1)
  }

  console.log(`Session: ${session.name}\n`)

  // Load committees
  let committeeQuery = supabase
    .from('committees')
    .select('id, code, name, short_name, chamber')
    .eq('session_id', session.id)
    .order('code')

  if (codeArg) {
    committeeQuery = (committeeQuery as any).eq('code', codeArg)
  }

  const { data: committees, error: cErr } = await committeeQuery

  if (cErr || !committees?.length) {
    console.error(`No committees found: ${cErr?.message || 'empty result'}`)
    process.exit(1)
  }

  console.log(`Processing ${committees.length} committee(s)...\n`)

  let totalMeetings = 0
  let totalUpserted = 0

  for (const committee of committees) {
    const url = `${BASE}/sessioninfo/${yearArg}/standingcommittees/${committee.code}/`
    console.log(`[${committee.code}] ${committee.short_name}`)

    await delay(DELAY_MS)

    const html = await fetchPage(url)
    if (!html) {
      console.warn(`  ✗ Failed to fetch ${url}`)
      continue
    }

    const meetings = parseMeetings(html)
    console.log(`  Found ${meetings.length} meetings`)

    if (DRY_RUN) {
      for (const m of meetings) {
        const vid = m.videoUrl ?? (m.time && m.status !== 'will_not_meet'
          ? buildVideoUrl(committee.name, committee.chamber, committee.code, m.date, m.time, yearArg)
          : null)
        console.log(
          `    ${m.date} ${m.time ?? ''} [${m.status}]` +
          ` agenda=${!!m.agendaUrl} minutes=${!!m.minutesUrl} video=${!!vid}`
        )
      }
      totalMeetings += meetings.length
      continue
    }

    if (meetings.length === 0) continue

    // Upsert — handle null time (some all-day or will-not-meet entries)
    // The unique constraint is (committee_id, date, time); use a sentinel for null time
    const rows = meetings.map(m => {
      // Build speculative video URL if not found on the page
      const videoUrl = m.videoUrl ?? (
        m.time && m.status !== 'will_not_meet'
          ? buildVideoUrl(committee.name, committee.chamber, committee.code, m.date, m.time, yearArg)
          : null
      )
      return {
        committee_id: committee.id,
        date: m.date,
        time: m.time ?? '00:00 AM',   // sentinel so UNIQUE constraint works
        room: m.room,
        status: m.status,
        agenda_url: m.agendaUrl,
        minutes_url: m.minutesUrl,
        video_url: videoUrl,
        synced_at: new Date().toISOString(),
      }
    })

    const { error: uErr } = await supabase
      .from('committee_meetings')
      .upsert(rows, { onConflict: 'committee_id,date,time' })

    if (uErr) {
      console.error(`  ✗ DB error: ${uErr.message}`)
    } else {
      console.log(`  ✓ Upserted ${rows.length} meetings`)
      totalUpserted += rows.length
    }

    totalMeetings += meetings.length
  }

  console.log('\n═══════════════════════════════════════════════════')
  console.log(`  Total meetings found : ${totalMeetings}`)
  if (!DRY_RUN) console.log(`  Upserted to DB       : ${totalUpserted}`)
  if (DRY_RUN) console.log('  (dry run — no changes written)')
  console.log('═══════════════════════════════════════════════════')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
