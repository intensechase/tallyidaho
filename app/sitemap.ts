import { MetadataRoute } from 'next'
import { createServerClient } from '@/lib/supabase/server'
import { legislatorSlug } from '@/lib/slugify'

const BASE = 'https://www.tallyidaho.com'

export const revalidate = 86400

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createServerClient()

  // Static pages + 35 districts
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE,                  lastModified: new Date(), changeFrequency: 'hourly',  priority: 1.0 },
    { url: `${BASE}/bills`,       lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE}/legislators`, lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE}/districts`,   lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/sessions`,    lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/committees`,  lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    ...Array.from({ length: 35 }, (_, i) => ({
      url: `${BASE}/districts/${i + 1}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ]

  // Session detail pages
  const { data: sessions } = await supabase
    .from('sessions')
    .select('year_start, sine_die')
    .order('year_start')

  const sessionPages: MetadataRoute.Sitemap = (sessions || []).map((s: any) => ({
    url: `${BASE}/sessions/${s.year_start}`,
    lastModified: new Date(),
    changeFrequency: s.sine_die ? 'yearly' : 'daily',
    priority: s.year_start === 2026 ? 0.8 : 0.5,
  }))

  // All legislators
  const { data: legislators } = await supabase
    .from('legislators')
    .select('name')
    .order('name')

  const legislatorPages: MetadataRoute.Sitemap = (legislators || [])
    .filter((l: any) => l.name)
    .map((l: any) => ({
      url: `${BASE}/legislators/${legislatorSlug(l.name)}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

  // All bills across all sessions — paginated to get past Supabase's 1000 row default
  const PAGE = 1000
  const billPages: MetadataRoute.Sitemap = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from('bills')
      .select('bill_number, last_action_date, sessions!inner(year_start)')
      .not('bill_number', 'is', null)
      .order('id')
      .range(offset, offset + PAGE - 1)

    if (error || !data || data.length === 0) break

    for (const b of data as any[]) {
      const year = b.sessions?.year_start
      if (!year) continue
      billPages.push({
        url: `${BASE}/bills/${year}/${b.bill_number.toLowerCase()}`,
        lastModified: b.last_action_date ? new Date(b.last_action_date) : new Date(`${year}-01-01`),
        changeFrequency: year === 2026 ? 'daily' : 'yearly',
        priority: year === 2026 ? 0.8 : 0.5,
      })
    }

    if (data.length < PAGE) break
    offset += PAGE
  }

  // All committees (distinct codes — canonical URL has no year param)
  const { data: committees } = await supabase
    .from('committees')
    .select('code')
    .order('code')

  const seenCodes = new Set<string>()
  const committeePages: MetadataRoute.Sitemap = []
  for (const c of (committees || []) as any[]) {
    if (!c.code || seenCodes.has(c.code)) continue
    seenCodes.add(c.code)
    committeePages.push({
      url: `${BASE}/committees/${c.code}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    })
  }

  return [...staticPages, ...sessionPages, ...legislatorPages, ...billPages, ...committeePages]
}
