import { MetadataRoute } from 'next'
import { createServerClient } from '@/lib/supabase/server'

const BASE = 'https://tallyidaho.com'

export const revalidate = 86400

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createServerClient()

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), changeFrequency: 'hourly', priority: 1.0 },
    { url: `${BASE}/bills`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/legislators`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/districts`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/sessions`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    // All 35 districts
    ...Array.from({ length: 35 }, (_, i) => ({
      url: `${BASE}/districts/${i + 1}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ]

  // All bills — fetch bill_number + year from sessions join
  const { data: bills } = await supabase
    .from('bills')
    .select('bill_number, sessions(year_start)')
    .order('id')

  const billPages: MetadataRoute.Sitemap = (bills || []).map((b: any) => ({
    url: `${BASE}/bills/${b.sessions?.year_start}/${b.bill_number?.toLowerCase()}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  // All legislators
  const { data: legislators } = await supabase
    .from('legislators')
    .select('name')

  const legislatorPages: MetadataRoute.Sitemap = (legislators || []).map((l: any) => ({
    url: `${BASE}/legislators/${l.name.toLowerCase().replace(/\s+/g, '-')}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  return [...staticPages, ...billPages, ...legislatorPages]
}
