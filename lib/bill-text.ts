/**
 * bill-text.ts
 *
 * Fetches and parses the full bill text PDF from the Idaho Legislature website.
 * Used on bill detail pages to surface indexed content for SEO.
 *
 * PDF URL pattern:
 *   https://legislature.idaho.gov/wp-content/uploads/sessioninfo/{year}/legislation/{BILL_NUMBER}.pdf
 */

const BASE = 'https://legislature.idaho.gov/wp-content/uploads/sessioninfo'

/**
 * Fetch and extract plain text from a bill PDF.
 * Returns null if the PDF is unavailable or unreadable.
 * Cached by Next.js fetch cache for 24 hours.
 */
export async function fetchBillText(
  year: string | number,
  billNumber: string
): Promise<string | null> {
  try {
    const num = billNumber.replace(/\s+/g, '').toUpperCase()
    const url = `${BASE}/${year}/legislation/${num}.pdf`

    const res = await fetch(url, { next: { revalidate: 86400 } })
    if (!res.ok) return null

    const buffer = Buffer.from(await res.arrayBuffer())

    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    const raw = result.text?.trim() ?? ''

    if (!raw || raw.length < 50) return null

    // Strip leading line numbers (Idaho bills number each line: "  1  AN ACT")
    // and collapse excessive blank lines
    const cleaned = raw
      .split('\n')
      .map((line: string) => line.replace(/^\s*\d{1,3}\s{1,4}/, '').trimEnd())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    return cleaned || null
  } catch {
    return null
  }
}
