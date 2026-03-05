/**
 * floor-calendar.ts
 *
 * Fetches and parses Idaho Legislature floor reading calendars:
 *   https://legislature.idaho.gov/sessioninfo/agenda/scal/  (Senate)
 *   https://legislature.idaho.gov/sessioninfo/agenda/hcal/  (House)
 *
 * Each calendar lists bills organized by reading stage:
 *   Senate: "BILLS ON SECOND READING" / "BILLS ON THIRD READING" (in 10th/14th Order)
 *   House:  "SECOND READING" / "THIRD READING" / "GENERAL ORDERS"
 *
 * Each bill row has 3 cells:
 *   [Senator/Representative Name(district)] [bill_number] [by SPONSOR – TOPIC – description]
 */

import { createServerClient } from '@/lib/supabase/server'

export interface FloorBill {
  rawNumber: string           // "S 1269"
  billNumber: string          // "S1269" normalized
  floorSponsor: string        // "Senator Nichols"
  floorDistrict: number | null  // 10
  sponsor: string             // "RESOURCES AND ENVIRONMENT COMMITTEE"
  topic: string               // "CLOUD SEEDING"
  description: string         // "Amends and adds to existing law..."
  reading: 'second' | 'third' | 'general'
  href: string | null         // "/bills/2026/s1269" if matched in DB
  // Vote result — populated after vote is recorded in DB
  votePassed: boolean | null
  voteYea: number | null
  voteNay: number | null
}

export interface FloorCalendar {
  senate: FloorBill[]
  house: FloorBill[]
  date: string
  legislativeDay: number | null
}

const SENATE_URL = 'https://legislature.idaho.gov/sessioninfo/agenda/scal/'
const HOUSE_URL  = 'https://legislature.idaho.gov/sessioninfo/agenda/hcal/'

/** Convert "S 1269" → "S1269", "H 781" → "H0781", "HCR 24" → "HCR024" */
function normalizeBillNumber(raw: string): string {
  const m = raw.trim().match(/^([A-Z]{1,4})\s+(\d+)$/)
  if (!m) return raw.replace(/\s+/g, '')
  const [, prefix, num] = m
  // Single-letter prefixes (S, H) get 4-digit padding; multi-letter don't
  return prefix.length === 1
    ? prefix + num.padStart(4, '0')
    : prefix + num.padStart(3, '0')
}

/** Decode common HTML entities */
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

type ParsedBill = Omit<FloorBill, 'href' | 'votePassed' | 'voteYea' | 'voteNay'>

function parseFloorPage(html: string): {
  bills: ParsedBill[]
  date: string
  legislativeDay: number | null
} {
  const decoded = decodeEntities(html)

  const flat = decoded
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/tr>/gi, '\n===ROW===\n')
    .replace(/<\/td>/gi, '\n---TD---\n')
    .replace(/<\/th>/gi, '\n---TD---\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\r/g, '')

  const rows = flat.split('===ROW===')

  let date = ''
  let legislativeDay: number | null = null
  let currentReading: 'second' | 'third' | 'general' = 'second'
  const bills: ParsedBill[] = []

  for (const row of rows) {
    const cells = row
      .split('---TD---')
      .map(c => c.trim().replace(/\s+/g, ' '))
      .filter(c => c.length > 0)

    const rowText = cells.join(' ')

    // Extract date and legislative day from header rows
    const dateM = rowText.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/)
    if (dateM && !date) date = dateM[0]
    const dayM = rowText.match(/(\d+)(?:st|nd|rd|th)\s+Legislative\s+Day/i)
    if (dayM && !legislativeDay) legislativeDay = parseInt(dayM[1])

    // Detect section headers — update current reading stage
    // Senate: "BILLS ON THIRD READING" / "BILLS ON SECOND READING" / "14TH ORDER" (≈ General Orders)
    // House:  "THIRD READING" / "SECOND READING" / "GENERAL ORDERS"
    if (/THIRD\s+READING|BILLS\s+ON\s+THIRD/i.test(rowText)) { currentReading = 'third'; continue }
    if (/SECOND\s+READING|BILLS\s+ON\s+SECOND/i.test(rowText)) { currentReading = 'second'; continue }
    if (/GENERAL\s+ORDERS|14TH\s+ORDER/i.test(rowText)) { currentReading = 'general'; continue }

    // Skip rows with no bill number pattern
    const billMatch = rowText.match(/\b([A-Z]{1,4})\s+(\d{2,4})\b/)
    if (!billMatch) continue

    // Senate format: [Sponsor Name(district)] [Bill #] [by COMMITTEE – TOPIC – description]
    // House format:  [Bill #] [Sponsor(district)] [by COMMITTEE – TOPIC – description]
    // Search the entire row for the bill number cell and 'by ...' description cell
    // rather than assuming they are adjacent.

    let billNumberRaw: string | null = null
    let descCell: string | null = null
    let legCell: string | null = null
    let billIdx = -1

    for (let i = 0; i < cells.length; i++) {
      const c = cells[i]
      const m = c.match(/^([A-Z]{1,4})\s+(\d{2,4})/)
      if (m && c.replace(/[A-Z0-9\s]/g, '').length < 5) {
        billNumberRaw = m[0].trim()
        billIdx = i
        break
      }
    }

    if (!billNumberRaw) continue

    // Find 'by ...' description cell anywhere in the row
    let descIdx = -1
    for (let j = 0; j < cells.length; j++) {
      if (cells[j].startsWith('by ')) { descIdx = j; descCell = cells[j]; break }
    }

    if (!descCell) continue

    // Determine legCell based on relative positions:
    //   House: bill at 0, leg at 1, desc at 2 → legCell = cells[billIdx + 1]
    //   Senate: leg at 0, bill at 1, desc at 2 → legCell = cells[billIdx - 1]
    if (descIdx === billIdx + 2) {
      legCell = cells[billIdx + 1]
    } else if (billIdx > 0) {
      legCell = cells[billIdx - 1]
    }

    const billNumber = normalizeBillNumber(billNumberRaw)

    // Parse legislator: "Senator Nichols(10)" or "Representative Smith(18A)"
    let floorSponsor = ''
    let floorDistrict: number | null = null
    if (legCell) {
      const legM = legCell.match(/(Senator|Representative)\s+([A-Za-z\s]+?)\s*\((\d+)/)
      if (legM) {
        floorSponsor = `${legM[1]} ${legM[2].trim()}`
        floorDistrict = parseInt(legM[3])
      } else {
        floorSponsor = legCell.trim()
      }
    }

    // Parse "by SPONSOR – TOPIC – description"
    const withoutBy = descCell.startsWith('by ') ? descCell.slice(3).trim() : descCell
    const enDash = ' \u2013 '
    const parts = withoutBy.split(enDash)

    const sponsor = parts[0]?.trim() || ''
    const topic = parts[1]?.trim() || ''
    const description = parts.slice(2).join(enDash).trim()

    bills.push({
      rawNumber: billNumberRaw,
      billNumber,
      floorSponsor,
      floorDistrict,
      sponsor: sponsor.replace(/\s+/g, ' '),
      topic: topic.replace(/\s+/g, ' '),
      description: description.replace(/\s+/g, ' '),
      reading: currentReading,
    })
  }

  return { bills, date, legislativeDay }
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(timer)
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

export async function fetchFloorCalendar(): Promise<FloorCalendar> {
  const [senateHtml, houseHtml] = await Promise.all([
    fetchPage(SENATE_URL),
    fetchPage(HOUSE_URL),
  ])

  const { bills: senateBills, date: senateDate, legislativeDay } =
    senateHtml ? parseFloorPage(senateHtml) : { bills: [], date: '', legislativeDay: null }

  const { bills: houseBills, date: houseDate } =
    houseHtml ? parseFloorPage(houseHtml) : { bills: [], date: '' }

  const date = senateDate || houseDate || ''

  // Cross-reference all bill numbers against DB
  const allBillNumbers = [
    ...senateBills.map(b => b.billNumber),
    ...houseBills.map(b => b.billNumber),
  ]

  const hrefMap = new Map<string, string>()
  const voteMap = new Map<string, { passed: boolean; yea: number; nay: number }>()

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
          .select('bill_number, roll_calls(passed, yea_count, nay_count, date)')
          .eq('session_id', session.id)
          .in('bill_number', allBillNumbers)

        for (const b of dbBills || []) {
          hrefMap.set(b.bill_number, `/bills/${session.year_start}/${b.bill_number.toLowerCase()}`)
          // Pick the most recent roll call
          const rcs: any[] = (b as any).roll_calls || []
          if (rcs.length > 0) {
            const latest = rcs.sort((a: any, b: any) =>
              (b.date || '').localeCompare(a.date || '')
            )[0]
            voteMap.set(b.bill_number, {
              passed: latest.passed,
              yea: latest.yea_count ?? 0,
              nay: latest.nay_count ?? 0,
            })
          }
        }
      }
    } catch {
      // silently continue with no hrefs or vote data
    }
  }

  const toFloor = (b: Omit<FloorBill, 'href' | 'votePassed' | 'voteYea' | 'voteNay'>): FloorBill => {
    const result = voteMap.get(b.billNumber) ?? null
    return {
      ...b,
      href: hrefMap.get(b.billNumber) ?? null,
      votePassed: result?.passed ?? null,
      voteYea: result?.yea ?? null,
      voteNay: result?.nay ?? null,
    }
  }

  return {
    senate: senateBills.map(toFloor),
    house: houseBills.map(toFloor),
    date,
    legislativeDay,
  }
}
