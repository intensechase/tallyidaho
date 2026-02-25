import { MetadataRoute } from 'next'
import { createServerClient } from '@/lib/supabase/server'

const BASE = 'https://tallyidaho.com'

const YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]

export const revalidate = 86400

export async function generateSitemaps() {
  return [{ id: 0 }, ...YEARS.map(y => ({ id: y }))]
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const supabase = createServerClient()

  // ── Sitemap 0: static pages + districts + legislators ─────────────────
  if (id === 0) {
    const staticPages: MetadataRoute.Sitemap = [
      { url: BASE,                  lastModified: new Date(), changeFrequency: 'hourly',  priority: 1.0 },
      { url: `${BASE}/bills`,       lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
      { url: `${BASE}/legislators`, lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
      { url: `${BASE}/districts`,   lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
      { url: `${BASE}/sessions`,    lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
      ...Array.from({ length: 35 }, (_, i) => ({
        url: `${BASE}/districts/${i + 1}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
    ]

    const { data: legislators } = await supabase
      .from('legislators')
      .select('name, updated_at')
      .order('name')

    const legislatorPages: MetadataRoute.Sitemap = (legislators || [])
      .filter((l: any) => l.name)
      .map((l: any) => ({
        url: `${BASE}/legislators/${l.name.toLowerCase().replace(/\s+/g, '-')}`,
        lastModified: l.updated_at ? new Date(l.updated_at) : new Date('2026-01-01'),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }))

    return [...staticPages, ...legislatorPages]
  }

  // ── Sitemaps 2016–2026: bills for that year with real lastModified ─────
  const year = id
  const isActive = year === 2026
  const PAGE = 1000
  const bills: MetadataRoute.Sitemap = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from('bills')
      .select('bill_number, last_action_date, sessions!inner(year_start)')
      .eq('sessions.year_start', year)
      .not('bill_number', 'is', null)
      .order('id')
      .range(offset, offset + PAGE - 1)

    if (error || !data || data.length === 0) break

    for (const b of data as any[]) {
      bills.push({
        url: `${BASE}/bills/${year}/${b.bill_number.toLowerCase()}`,
        // Use actual last action date so Google knows what really changed
        lastModified: b.last_action_date
          ? new Date(b.last_action_date)
          : new Date(`${year}-01-01`),
        changeFrequency: isActive ? 'daily' : 'yearly',
        priority: isActive ? 0.8 : 0.5,
      })
    }

    if (data.length < PAGE) break
    offset += PAGE
  }

  return bills
}
