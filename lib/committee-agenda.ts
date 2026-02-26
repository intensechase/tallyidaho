/**
 * committee-agenda.ts
 *
 * Fetches and parses Idaho Legislature committee agendas:
 *   https://legislature.idaho.gov/sessioninfo/agenda/sagenda/  (Senate)
 *   https://legislature.idaho.gov/sessioninfo/agenda/hagenda/  (House + Joint)
 *
 * Each committee block contains a 3-column table:
 *   [RS_NUMBER / BILL_NUMBER / ITEM_TYPE | description | presenter]
 *
 * RS items are draft bills ("routing slips") reviewed in committee before
 * formal introduction. Bills listed are existing bills scheduled for hearing.
 */

import { createServerClient } from '@/lib/supabase/server'

export interface AgendaItem {
  type: 'rs' | 'bill' | 'other'
  number: string         // "RS 33066" or "S 1326"
  topic: string          // description/subject
  presenter: string      // "Sen. Galloway"
  href: string | null    // internal link if bill matched in DB; null for RS
}

export interface CommitteeAgenda {
  code: string           // "hrev" — matches our committees table
  name: string           // "House Revenue & Taxation"
  chamber: 'senate' | 'house' | 'joint'
  date: string           // "Feb 26"
  time: string           // "8:30 am"
  room: string           // "EW42"
  willNotMeet: boolean
  items: AgendaItem[]
  videoUrl: string | null  // insession.idaho.gov mp4 link (available after meeting)
}

export interface AgendaCalendar {
  committees: CommitteeAgenda[]
  date: string
}

const SENATE_URL = 'https://legislature.idaho.gov/sessioninfo/agenda/sagenda/'
const HOUSE_URL  = 'https://legislature.idaho.gov/sessioninfo/agenda/hagenda/'

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8216;/g, '\u2018')
    .replace(/&#8217;/g, '\u2019')
    .replace(/&#8220;/g, '\u201c')
    .replace(/&#8221;/g, '\u201d')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#038;/g, '&')
}

const MONTH_NUM: Record<string, string> = {
  January:'01', February:'02', March:'03', April:'04',
  May:'05', June:'06', July:'07', August:'08',
  September:'09', October:'10', November:'11', December:'12',
}

/**
 * Build a speculative insession.idaho.gov video URL for a committee meeting.
 * URL pattern: https://insession.idaho.gov/IIS/{year}/{Chamber}/Committee/{Name}/{YYMMDD}_{abbr}_{HHMM}{AM|PM}-Meeting.mp4
 */
function buildVideoUrl(
  name: string,
  chamber: 'senate' | 'house' | 'joint',
  code: string,
  date: string,
  time: string,
  year: number,
): string | null {
  // Strip chamber prefix: "House Revenue & Taxation" → "Revenue & Taxation"
  const shortName = name
    .replace(/^House\s+/i, '')
    .replace(/^Senate\s+/i, '')
    .replace(/^Joint\s+/i, '')

  // Date "Feb 26" → "260226"
  const dateM = date.match(/(\w+)\s+(\d+)/)
  if (!dateM) return null
  const monthNum = MONTH_NUM[dateM[1]]
  if (!monthNum) return null
  const dayNum = dateM[2].padStart(2, '0')
  const yy = String(year).slice(2)
  const dateStr = `${yy}${monthNum}${dayNum}`

  // Time "8:30 am" → "0830AM", "1:30 pm" → "0130PM"
  const timeM = time.match(/(\d+):(\d+)\s*(am|pm)/i)
  if (!timeM) return null
  const h = String(parseInt(timeM[1])).padStart(2, '0')
  const m = timeM[2]
  const ap = timeM[3].toUpperCase()
  const timeStr = `${h}${m}${ap}`

  const chamberPath = chamber === 'senate' ? 'Senate' : chamber === 'house' ? 'House' : 'Joint'
  const filename = `${dateStr}_${code}_${timeStr}-Meeting.mp4`

  return `https://insession.idaho.gov/IIS/${year}/${chamberPath}/Committee/${encodeURIComponent(shortName)}/${filename}`
}

/** Normalize bill number: "S 1326" → "S1326", "HB 10" → "H0010" */
function normalizeBillNumber(raw: string): string {
  const m = raw.trim().match(/^([A-Z]{1,4})\s+(\d+)$/)
  if (!m) return raw.replace(/\s+/g, '')
  const [, prefix, num] = m
  return prefix.length === 1
    ? prefix + num.padStart(4, '0')
    : prefix + num.padStart(3, '0')
}

function parseAgendaPage(html: string): CommitteeAgenda[] {
  const decoded = decodeEntities(html)
  const committees: CommitteeAgenda[] = []

  // Split into committee blocks by calendarHeader
  const blocks = decoded.split(/class="calendarHeader"/)

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i]

    // Extract date: <div class="date">Feb <span class="blah">26</span></div>
    const dateM = block.match(/class="date">([A-Za-z]+)\s*<span[^>]*>(\d+)<\/span>/)
    const date = dateM ? `${dateM[1].trim()} ${dateM[2]}` : ''

    // Extract committee code from abbr div
    const abbrM = block.match(/class="abbr">([^<]+)</)
    const code = abbrM?.[1]?.trim().toLowerCase() || ''

    const chamber: 'senate' | 'house' | 'joint' =
      code.startsWith('s') ? 'senate' :
      code.startsWith('j') ? 'joint' : 'house'

    // Will not meet?
    const willNotMeet = /Will not meet/i.test(block.substring(0, 600))

    // Extract time and room from inlineHeader h3
    let time = ''
    let room = ''
    const inlineM = block.match(/class="inlineHeader"[^>]*>([\s\S]*?)<\/h3>/)
    if (inlineM) {
      const raw = inlineM[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .trim()
      const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
      time = lines[0] || ''
      room = lines[1]?.replace(/^Room\s*/i, '') || ''
    }

    // Extract committee name from h2 > a
    const nameM = block.match(/<h2[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/)
    const name = nameM
      ? nameM[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
      : code

    // Find table rows in the accordion card-body
    // The tbody we want contains agenda items (not the XHTML testimony notice)
    const items: AgendaItem[] = []

    // Extract all <tbody>...</tbody> blocks in this committee section
    const tbodyRe = /<tbody>([\s\S]*?)<\/tbody>/g
    let tbodyM: RegExpExecArray | null
    while ((tbodyM = tbodyRe.exec(block)) !== null) {
      const tbodyContent = tbodyM[1]
      // Skip the XHTML-style testimony notice bodies (they use <row><entry> not <tr><td>)
      if (tbodyContent.includes('<row>')) continue

      const flat = tbodyContent
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/tr>/gi, '\n===ROW===\n')
        .replace(/<\/td>/gi, '\n---TD---\n')
        .replace(/<\/th>/gi, '\n---TD---\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\r/g, '')

      for (const row of flat.split('===ROW===')) {
        const cells = row
          .split('---TD---')
          .map(c => c.trim().replace(/\s+/g, ' '))
          .filter(c => c.length > 0)

        if (cells.length < 2) continue

        const col0 = cells[0]
        const col1 = cells[1] || ''
        const col2 = cells[2] || ''

        // Skip header/label rows
        if (/^(SUBJECT|DESCRIPTION|MINUTES|PRESENTATION|GUBERNATORIAL|APPOINTMENT)/i.test(col0)) continue
        // Skip rows with no number pattern
        if (!col0.match(/^[A-Z]{1,4}\s+\d/)) continue

        // RS item
        if (/^RS\s+\d/i.test(col0)) {
          items.push({ type: 'rs', number: col0, topic: col1, presenter: col2, href: null })
          continue
        }

        // Bill item (will get href populated later)
        if (/^[A-Z]{1,4}\s+\d{2,4}/.test(col0)) {
          items.push({ type: 'bill', number: col0, topic: col1, presenter: col2, href: null })
          continue
        }
      }
    }

    // Only include committees that have agenda items (skip empty / will-not-meet)
    if (items.length > 0 && !willNotMeet) {
      const videoUrl = buildVideoUrl(name, chamber, code, date, time, 2026)
      committees.push({ code, name, chamber, date, time, room, willNotMeet, items, videoUrl })
    }
  }

  return committees
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 1800 },
    })
    clearTimeout(timer)
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

export async function fetchCommitteeAgenda(): Promise<AgendaCalendar> {
  const [senateHtml, houseHtml] = await Promise.all([
    fetchPage(SENATE_URL),
    fetchPage(HOUSE_URL),
  ])

  const senateCmtes = senateHtml ? parseAgendaPage(senateHtml) : []
  const houseCmtes  = houseHtml  ? parseAgendaPage(houseHtml)  : []

  // Deduplicate (joint committees appear on both pages)
  const seen = new Set<string>()
  const allCmtes: CommitteeAgenda[] = []
  for (const c of [...senateCmtes, ...houseCmtes]) {
    const key = `${c.code}-${c.date}-${c.time}`
    if (!seen.has(key)) {
      seen.add(key)
      allCmtes.push(c)
    }
  }

  // Collect all bill numbers (not RS) to cross-reference with DB
  const billNumbers: string[] = []
  for (const cmte of allCmtes) {
    for (const item of cmte.items) {
      if (item.type === 'bill') {
        billNumbers.push(normalizeBillNumber(item.number))
      }
    }
  }

  const hrefMap = new Map<string, string>()
  if (billNumbers.length > 0) {
    try {
      const supabase = createServerClient()
      const { data: session } = await supabase
        .from('sessions')
        .select('id, year_start')
        .eq('year_start', 2026)
        .single()

      if (session) {
        const { data: dbBills } = await supabase
          .from('bills')
          .select('bill_number')
          .eq('session_id', session.id)
          .in('bill_number', billNumbers)

        for (const b of dbBills || []) {
          hrefMap.set(
            b.bill_number,
            `/bills/${session.year_start}/${b.bill_number.toLowerCase()}`
          )
        }
      }
    } catch {
      // silently continue
    }
  }

  // Attach hrefs to bill items
  for (const cmte of allCmtes) {
    for (const item of cmte.items) {
      if (item.type === 'bill') {
        const normalized = normalizeBillNumber(item.number)
        item.href = hrefMap.get(normalized) ?? null
      }
    }
  }

  // Use the earliest date found as the "calendar date"
  const date = allCmtes[0]?.date || ''

  return { committees: allCmtes, date }
}
