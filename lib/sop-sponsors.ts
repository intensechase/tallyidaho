/**
 * Idaho SOP (Statement of Purpose) PDF parser.
 * Extracts structured data from raw SOP text.
 */

export interface SopParsed {
  rsNumber: string | null       // e.g. "RS 22456"
  bodyText: string | null       // plain_summary text
  fiscalNote: string | null     // fiscal note body
  sponsorNames: string[]        // raw names from Contact section
  revisedAt: string | null      // e.g. "03/03/2026, 1:30 PM"
}

export function parseSop(rawText: string): SopParsed {
  if (!rawText) return { rsNumber: null, bodyText: null, fiscalNote: null, sponsorNames: [], revisedAt: null }

  // ── RS number ───────────────────────────────────────────────────────────
  // Appears near the top: "RS 22456" or "RS 22456C1"
  // Avoid matching RS numbers inside longer text by requiring word boundary
  const rsMatch = rawText.match(/\bRS\s+(\d{4,6}[A-Z\d]*)\b/i)
  const rsNumber = rsMatch ? `RS ${rsMatch[1].toUpperCase()}` : null

  // ── Body text (Statement of Purpose section) ────────────────────────────
  const sopBodyMatch = rawText.match(
    /STATEMENT\s+OF\s+PURPOSE[\s\S]*?\n([\s\S]*?)(?=FISCAL\s+NOTE)/im
  )
  let bodyText: string | null = null
  if (sopBodyMatch?.[1]) {
    const cleaned = sopBodyMatch[1]
      .split('\n')
      .map(l => l.trim())
      .filter(l => {
        if (!l) return false
        if (/^RS\s+\d/i.test(l)) return false
        if (/^[HS]\s*\d{4}/i.test(l)) return false   // bill number line
        if (/^STATEMENT\s+OF\s+PURPOSE/i.test(l)) return false
        if (/^Page\s+\d/i.test(l)) return false
        return true
      })
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
    bodyText = cleaned.length >= 30 ? cleaned.slice(0, 2000) : null
  }

  // ── Fiscal note ─────────────────────────────────────────────────────────
  const fnMatch = rawText.match(
    /FISCAL\s+NOTE\s+([\s\S]*?)(?=Contact:|DISCLAIMER:|Statement of Purpose)/im
  )
  let fiscalNote: string | null = null
  if (fnMatch?.[1]) {
    const cleaned = fnMatch[1]
      .split('\n')
      .map(l => l.trim())
      .filter(l => {
        if (!l) return false
        if (/^FISCAL\s+NOTE/i.test(l)) return false
        if (/^Page\s+\d/i.test(l)) return false
        return true
      })
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
    fiscalNote = cleaned.length >= 10 ? cleaned.slice(0, 1000) : null
  }

  // ── Sponsor names from Contact section ──────────────────────────────────
  const sponsorNames = extractSopSponsorNames(rawText)

  // ── Revised/introduced date ──────────────────────────────────────────────
  // Format: "SOP/FN REVISED: 03/03/2026, 1:30 PM" or "SOP/FN INT"
  const revisedMatch = rawText.match(/SOP\/FN\s+REVISED:\s*([^\n]+)/i)
  const revisedAt = revisedMatch ? revisedMatch[1].trim() : null

  return { rsNumber, bodyText, fiscalNote, sponsorNames, revisedAt }
}

/**
 * Extracts individual sponsor names from the Contact section of an SOP.
 * Returns names as they appear in the PDF (e.g. "Stephanie Jo Mickelsen").
 */
export function extractSopSponsorNames(rawText: string): string[] {
  const contactIdx = rawText.toLowerCase().indexOf('contact:')
  if (contactIdx === -1) return []

  const after = rawText.slice(contactIdx + 'contact:'.length)
  const lines = after.split('\n').map(l => l.trim())

  const sponsors: string[] = []
  for (const line of lines) {
    if (/^(Representative|Senator)\s+\S/i.test(line)) {
      const name = line.replace(/^(Representative|Senator)\s+/i, '').trim()
      if (name) sponsors.push(name)
    } else if (sponsors.length > 0) {
      // Stop at the first non-sponsor line after finding at least one
      break
    }
  }

  return sponsors
}

// Nickname/alias → canonical name as stored in DB
const NICKNAME_MAP: Record<string, string> = {
  'edward hill': 'ted hill',
  'edward h. hill': 'ted hill',
  'steven tanner': 'steve c. tanner',
  'steve tanner': 'steve c. tanner',
}

const TITLE_SUFFIXES = /senator|representative|sponsor|president|majority|minority|pro tempore|assistant/i

/**
 * Normalize a raw SOP name before matching:
 * - Strips ", Title" suffixes ("Mark Harris, Senate Majority Leader")
 * - Strips parenthetical district numbers ("Josh Tanner (14)")
 * - Applies nickname map ("Edward H. Hill" → "Ted Hill")
 */
function preprocessName(raw: string): string {
  let name = raw.trim()

  // Strip comma + title: "Van T. Burtenshaw, Sponsor" → "Van T. Burtenshaw"
  const commaIdx = name.indexOf(',')
  if (commaIdx !== -1) {
    const afterComma = name.slice(commaIdx + 1).trim()
    if (TITLE_SUFFIXES.test(afterComma)) {
      name = name.slice(0, commaIdx).trim()
    }
  }

  // Strip parenthetical: "Josh Tanner (14)" → "Josh Tanner"
  name = name.replace(/\s*\(\d+\)\s*$/, '').trim()

  // Apply nickname map
  const mapped = NICKNAME_MAP[name.toLowerCase()]
  if (mapped) name = mapped

  return name
}

/**
 * Attempts to match a raw SOP sponsor name to a legislator UUID.
 * Tries: preprocess → exact → strip middle → last name only → no-space last name.
 */
export function matchSponsorName(
  rawName: string,
  legislators: { id: string; name: string }[]
): string | null {
  const normalize = (s: string) => s.toLowerCase().trim()

  const name = preprocessName(rawName)

  // 1. Exact match
  const exact = legislators.find(l => normalize(l.name) === normalize(name))
  if (exact) return exact.id

  const parts = name.trim().split(/\s+/)

  // 2. Strip middle name/initial: "Stephanie Jo Mickelsen" → "Stephanie Mickelsen"
  if (parts.length >= 3) {
    const firstLast = `${parts[0]} ${parts[parts.length - 1]}`
    const stripped = legislators.find(l => normalize(l.name) === normalize(firstLast))
    if (stripped) return stripped.id
  }

  // 3. Last name only (only if unique among all legislators)
  const lastName = parts[parts.length - 1]
  const byLastName = legislators.filter(l => {
    const lParts = l.name.trim().split(/\s+/)
    return normalize(lParts[lParts.length - 1]) === normalize(lastName)
  })
  if (byLastName.length === 1) return byLastName[0].id

  // 4. Collapsed last name (handles "Van Orden" stored as "VanOrden")
  const collapsedLast = parts.slice(1).join('').toLowerCase()
  const byCollapsed = legislators.filter(l => {
    const lParts = l.name.trim().split(/\s+/)
    return lParts.slice(1).join('').toLowerCase() === collapsedLast
  })
  if (byCollapsed.length === 1) return byCollapsed[0].id

  // 5. Try reversed name ("Bernt Treg" → "Treg Bernt" → match "Treg A. Bernt")
  if (parts.length === 2) {
    const reversed = `${parts[1]} ${parts[0]}`
    const rev = legislators.find(l => normalize(l.name) === normalize(reversed))
    if (rev) return rev.id
    // Also try reversed with middle stripped
    const revByLast = legislators.filter(l => {
      const lParts = l.name.trim().split(/\s+/)
      return normalize(lParts[0]) === normalize(parts[1]) &&
             normalize(lParts[lParts.length - 1]) === normalize(parts[0])
    })
    if (revByLast.length === 1) return revByLast[0].id
  }

  return null
}

/**
 * Splits a raw name string that may contain multiple sponsors separated by commas
 * when neither segment is a title (e.g. "Don Hall, Grayson Stone").
 */
export function splitSponsorNames(raw: string): string[] {
  const commaIdx = raw.indexOf(',')
  if (commaIdx === -1) return [raw]
  const afterComma = raw.slice(commaIdx + 1).trim()
  // If after comma looks like a title, treat as single name (will be stripped in match)
  if (TITLE_SUFFIXES.test(afterComma)) return [raw]
  // Otherwise split into two names
  return [raw.slice(0, commaIdx).trim(), afterComma]
}
