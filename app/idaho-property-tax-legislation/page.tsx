import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Idaho Laws That May Affect Your Property Taxes | Tally Idaho',
  description: 'Recent Idaho legislation affecting property tax assessments, homestead exemptions, and school levies. Plain-language summaries of HB 354 (2025) and HB 521 (2024).',
  alternates: { canonical: 'https://www.tallyidaho.com/idaho-property-tax-legislation' },
  openGraph: {
    title: 'Idaho Laws That May Affect Your Property Taxes',
    description: 'Plain-language summaries of recent Idaho legislation affecting property tax assessments, homestead exemptions, and school levies.',
    url: 'https://www.tallyidaho.com/idaho-property-tax-legislation',
    siteName: 'Tally Idaho',
    type: 'article',
  },
}

export const revalidate = 86400

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Idaho Laws That May Affect Your Property Taxes',
  description: 'Plain-language summaries of recent Idaho legislation affecting property tax assessments, homestead exemptions, and school levies.',
  url: 'https://www.tallyidaho.com/idaho-property-tax-legislation',
  author: {
    '@type': 'Organization',
    name: 'Tally Idaho',
    url: 'https://www.tallyidaho.com',
  },
  publisher: {
    '@type': 'Organization',
    name: 'Tally Idaho',
    url: 'https://www.tallyidaho.com',
  },
  dateModified: '2026-01-01',
}

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.tallyidaho.com' },
    { '@type': 'ListItem', position: 2, name: 'Bills', item: 'https://www.tallyidaho.com/bills' },
    { '@type': 'ListItem', position: 3, name: 'Idaho Property Tax Legislation', item: 'https://www.tallyidaho.com/idaho-property-tax-legislation' },
  ],
}

export default function IdahoPropertyTaxLegislationPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      {/* Breadcrumb */}
      <nav className="text-xs text-slate-400 mb-6">
        <Link href="/" className="hover:text-amber-600">Home</Link>
        <span className="mx-2">›</span>
        <Link href="/bills" className="hover:text-amber-600">Bills</Link>
        <span className="mx-2">›</span>
        <span className="text-slate-600">Idaho Property Tax Legislation</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 leading-snug mb-3">
          Idaho Laws That May Affect Your Property Taxes
        </h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          Idaho legislators regularly pass laws that change how property is assessed, which exemptions homeowners qualify for, and how school levies are funded — all of which can affect your annual tax bill. Below are two recent laws every Idaho property owner should know about.
        </p>
      </div>

      <div className="space-y-8 text-sm text-slate-600 leading-relaxed">

        {/* HB 354 (2025) */}
        <section>
          <h2 className="section-label mb-3">HB 354 (2025) — IN EFFECT NOW</h2>
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="font-semibold text-slate-800 text-base leading-snug">
                  Homestead Exemption &amp; Property Assessment Changes
                </p>
                <p className="text-xs text-slate-400 mt-1">Signed March 28, 2025 · Effective January 1, 2026</p>
              </div>
              <span className="shrink-0 bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                Signed into Law
              </span>
            </div>

            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
                <p className="font-semibold text-slate-700 text-xs uppercase tracking-wide mb-1">What it means for you</p>
                <p>
                  This law changed two things that directly affect how much Idaho property owners pay in taxes:
                </p>
                <ul className="mt-2 space-y-2 list-disc list-inside text-slate-600">
                  <li>
                    <span className="font-medium text-slate-700">How your home value is assessed.</span>{' '}
                    The rules county assessors follow when determining your property&apos;s market value were revised. Your taxable value — and therefore your bill — flows from this number.
                  </li>
                  <li>
                    <span className="font-medium text-slate-700">Homestead exemption rules updated.</span>{' '}
                    Idaho&apos;s homestead exemption reduces the assessed value of your primary residence (up to 50%, subject to a cap), which directly lowers your property tax bill. This law adjusted the provisions governing that exemption.
                  </li>
                </ul>
              </div>
              <p>
                The bill passed with unanimous support — <span className="font-medium text-slate-700">69–0 in the House</span> and <span className="font-medium text-slate-700">34–0 in the Senate</span> — and became effective January 1, 2026, meaning it is already shaping property tax calculations for this year.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center gap-4 flex-wrap">
              <Link
                href="/bills/2025/H0354"
                className="text-amber-700 hover:underline font-medium text-xs"
              >
                View full bill, votes &amp; sponsors →
              </Link>
              <span className="text-slate-300 text-xs hidden sm:inline">|</span>
              <span className="text-xs text-slate-400">Sponsors: Rep. Jeff Ehlers &amp; Rep. John Shirts</span>
            </div>
          </div>
        </section>

        {/* HB 521 (2024) */}
        <section>
          <h2 className="section-label mb-3">HB 521 (2024) — SCHOOL LEVIES &amp; PROPERTY TAX</h2>
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="font-semibold text-slate-800 text-base leading-snug">
                  $125M School Facilities Fund — Shifting School Costs Off Property Tax
                </p>
                <p className="text-xs text-slate-400 mt-1">Enacted April 2, 2024</p>
              </div>
              <span className="shrink-0 bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                Signed into Law
              </span>
            </div>

            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
                <p className="font-semibold text-slate-700 text-xs uppercase tracking-wide mb-1">What it means for you</p>
                <p>
                  School bond and levy elections are historically one of the biggest drivers of local property tax bills. This law attempts to reduce that pressure by funding school construction and renovation at the state level instead:
                </p>
                <ul className="mt-2 space-y-2 list-disc list-inside text-slate-600">
                  <li>
                    <span className="font-medium text-slate-700">$125 million per year</span> in state sales tax revenue dedicated to a new School Modernization Facilities Fund — money that previously would have had to come from local property tax levies.
                  </li>
                  <li>
                    <span className="font-medium text-slate-700">Income tax cut</span> from 5.8% to 5.695% as part of the same package.
                  </li>
                </ul>
              </div>
              <p>
                The bill passed <span className="font-medium text-slate-700">61–6 in the House</span> and <span className="font-medium text-slate-700">23–11 in the Senate</span>. It had broader support from Republicans and some Democratic crossover votes.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <Link
                href="/bills/2024/H0521"
                className="text-amber-700 hover:underline font-medium text-xs"
              >
                View full bill, votes &amp; sponsors →
              </Link>
            </div>
          </div>
        </section>

        {/* Browse more */}
        <section>
          <h2 className="section-label mb-3">BROWSE ALL PROPERTY TAX BILLS</h2>
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <p>
              These are two of the most significant recent laws, but Idaho legislators consider property tax-related bills every session. Use Tally Idaho to search the full record — filter by keyword, year, or sponsor.
            </p>
            <div className="flex gap-3 flex-wrap pt-1">
              <Link
                href="/bills?q=property+tax"
                className="bg-[#0f172a] text-amber-400 text-xs font-bold px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
              >
                Search "property tax" bills
              </Link>
              <Link
                href="/bills?q=homestead+exemption"
                className="border border-slate-300 text-slate-700 text-xs font-semibold px-4 py-2 rounded-lg hover:border-amber-400 transition-colors"
              >
                Search "homestead exemption"
              </Link>
            </div>
          </div>
        </section>

        {/* About the data */}
        <section>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 text-xs text-slate-500 space-y-1">
            <p>
              Bill data is sourced from{' '}
              <a href="https://legiscan.com" target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:underline font-medium">
                LegiScan
              </a>{' '}
              and the Idaho Legislature&apos;s official records under Creative Commons CC BY 4.0. Tally Idaho is a nonpartisan civic project — we present the data as it is, without editorial spin.
            </p>
            <p>
              <Link href="/about" className="text-amber-700 hover:underline">About Tally Idaho</Link>
              {' · '}
              <Link href="/idaho-legislative-process" className="text-amber-700 hover:underline">How Idaho laws are made</Link>
            </p>
          </div>
        </section>

      </div>
    </main>
  )
}
