/**
 * daily-introductions.ts
 *
 * Fetches and parses Idaho Legislature new bill introduction calendars:
 *   https://legislature.idaho.gov/sessioninfo/agenda/scal1/  (Senate)
 *   https://legislature.idaho.gov/sessioninfo/agenda/hcal1/  (House)
 *
 * Each calendar page is an HTML table with rows:
 *   [bill_number_cell, description_cell]
 * where description is "by SPONSOR – TOPIC – Full description text"
 */

import { createServerClient } from '@/lib/supabase/server'

export interface DailyBill {
  rawNumber: string    // "S 1342"
  billNumber: string   // "S1342" normalized
  topic: string        // "EGGS"
  sponsor: string      // "JUDICIARY AND RULES COMMITTEE" or "RUBEL"
  description: string  // "Amends and adds to existing law..."
  href: string | null  // "/bills/2026/s1342" if matched in DB
}

export interface DailyIntroductions {
  senate: DailyBill[]
  house: DailyBill[]
  date: string          // "February 26, 2026"
  legislativeDay: number | null
}

const SENATE_URL = 'https://legislature.idaho.gov/sessioninfo/agenda/scal1/'
const HOUSE_URL  = 'https://legislature.idaho.gov/sessioninfo/agenda/hcal1/'

/** Convert "S 1342" → "S1342", "H 781" → "H0781", "SR 116" → "SR116" */
function normalizeBillNumber(raw: string): string {
  const m = raw.trim().match(/^(SR?|HR?)\s+(\d+)$/)
  if (!m) return raw.replace(/\s+/g, '')
  const [, prefix, num] = m
  return prefix.length === 1
    ? prefix + num.padStart(4, '0')
    : prefix + num
}

/** Decode common HTML entities */
function decodeEntities(s: string): string {
  return s
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8216;/g, '\u2018')
    .replace(/&#8217;/g, '\u2019')
    .replace(/&#8220;/g, '\u201c')
    .replace(/&#8221;/g, '\u201d')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
}

/**
 * Parse calendar HTML into an array of raw bill rows.
 * Returns { bills, date, legislativeDay }
 */
function parseCalendar(html: string, prefix: 'S' | 'H'): {
  bills: Array<{ rawNumber: string; billNumber: string; sponsor: string; topic: string; description: string }>
  date: string
  legislativeDay: number | null
} {
  const decoded = decodeEntities(html)

  // Convert to flat text with row and cell delimiters
  const flat = decoded
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/tr>/gi, '\n===ROW===\n')
    .replace(/<\/td>/gi, '\n---TD---\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\r/g, '')

  const rows = flat.split('===ROW===')

  // Extract date and legislative day from header rows
  let date = ''
  let legislativeDay: number | null = null
  for (const row of rows) {
    const text = row.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
    // "February 26, 2026"
    const dateM = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/)
    if (dateM && !date) date = dateM[0]
    // "46th Legislative Day"
    const dayM = text.match(/(\d+)(?:st|nd|rd|th)\s+Legislative\s+Day/i)
    if (dayM && !legislativeDay) legislativeDay = parseInt(dayM[1])
  }

  // Parse bill rows
  const billPrefix = prefix === 'S' ? /^SR?\s+\d{3,4}$/ : /^HR?\s+\d{3,4}$/
  const bills: ReturnType<typeof parseCalendar>['bills'] = []

  for (const row of rows) {
    const cells = row
      .split('---TD---')
      .map(c => c.trim().replace(/\s+/g, ' '))
      .filter(c => c.length > 0)

    // Find the cell that looks like a bill number
    let billNumberRaw: string | null = null
    let descCell: string | null = null

    for (let i = 0; i < cells.length; i++) {
      if (billPrefix.test(cells[i].trim())) {
        billNumberRaw = cells[i].trim()
        descCell = cells[i + 1]?.trim() || null
        break
      }
    }

    if (!billNumberRaw || !descCell || !descCell.startsWith('by ')) continue

    // Parse "by SPONSOR – TOPIC – description"
    const withoutBy = descCell.slice(3).trim()
    const enDash = ' \u2013 '
    const parts = withoutBy.split(enDash)

    const sponsor = parts[0]?.trim() || ''
    const topic = parts[1]?.trim() || ''
    const description = parts.slice(2).join(enDash).trim()

    bills.push({
      rawNumber: billNumberRaw,
      billNumber: normalizeBillNumber(billNumberRaw),
      sponsor: sponsor.replace(/\s+/g, ' '),
      topic: topic.replace(/\s+/g, ' '),
      description: description.replace(/\s+/g, ' '),
    })
  }

  return { bills, date, legislativeDay }
}

/** Fetch one calendar page with a timeout */
async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 3600 },
    })
    clearTimeout(timer)
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

/** Fetch + parse both calendars, cross-reference with DB, return DailyIntroductions */
export async function fetchDailyIntroductions(): Promise<DailyIntroductions> {
  const [senateHtml, houseHtml] = await Promise.all([
    fetchPage(SENATE_URL),
    fetchPage(HOUSE_URL),
  ])

  const { bills: senateParsed, date: senateDate, legislativeDay: senateDay } =
    senateHtml ? parseCalendar(senateHtml, 'S') : { bills: [], date: '', legislativeDay: null }

  const { bills: houseParsed, date: houseDate } =
    houseHtml ? parseCalendar(houseHtml, 'H') : { bills: [], date: '' }

  const date = senateDate || houseDate || ''
  const legislativeDay = senateDay

  // Cross-reference all bill numbers against DB to get hrefs
  const allBillNumbers = [
    ...senateParsed.map(b => b.billNumber),
    ...houseParsed.map(b => b.billNumber),
  ]

  const hrefMap = new Map<string, string>()

  if (allBillNumbers.length > 0) {
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
          .in('bill_number', allBillNumbers)

        for (const b of dbBills || []) {
          hrefMap.set(b.bill_number, `/bills/${session.year_start}/${b.bill_number.toLowerCase()}`)
        }
      }
    } catch {
      // silently continue with no hrefs
    }
  }

  const toDaily = (b: typeof senateParsed[0]): DailyBill => ({
    ...b,
    href: hrefMap.get(b.billNumber) ?? null,
  })

  return {
    senate: senateParsed.map(toDaily),
    house: houseParsed.map(toDaily),
    date,
    legislativeDay,
  }
}
