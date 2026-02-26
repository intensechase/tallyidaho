/** Consistent legislator slug: "Bruce D. Skaug" → "bruce-d-skaug" */
export function legislatorSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\./g, '')        // remove dots (middle initials)
    .replace(/[^a-z0-9\s-]/g, '') // remove other special chars
    .trim()
    .replace(/\s+/g, '-')
}
