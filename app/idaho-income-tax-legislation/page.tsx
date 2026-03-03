import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Idaho Laws That May Affect Your State Income Taxes | Tally Idaho',
  description: 'Recent Idaho legislation affecting state income tax rates, deductions, federal tax conformity, and exemptions. Plain-language summaries of HB 559 (2026), H0040 (2025), H0479 (2025), and HB 521 (2024).',
  alternates: { canonical: 'https://www.tallyidaho.com/idaho-income-tax-legislation' },
  openGraph: {
    title: 'Idaho Laws That May Affect Your State Income Taxes',
    description: 'Plain-language summaries of recent Idaho legislation affecting income tax rates, deductions, federal conformity, and exemptions.',
    url: 'https://www.tallyidaho.com/idaho-income-tax-legislation',
    siteName: 'Tally Idaho',
    type: 'article',
  },
}

export const revalidate = 86400

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Idaho Laws That May Affect Your State Income Taxes',
  description: 'Plain-language summaries of recent Idaho legislation affecting state income tax rates, deductions, federal tax conformity, and exemptions.',
  url: 'https://www.tallyidaho.com/idaho-income-tax-legislation',
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
  dateModified: '2026-02-06',
}

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.tallyidaho.com' },
    { '@type': 'ListItem', position: 2, name: 'Bills', item: 'https://www.tallyidaho.com/bills' },
    { '@type': 'ListItem', position: 3, name: 'Idaho Income Tax Legislation', item: 'https://www.tallyidaho.com/idaho-income-tax-legislation' },
  ],
}

export default function IdahoIncomeTaxLegislationPage() {
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
        <span className="text-slate-600">Idaho Income Tax Legislation</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 leading-snug mb-3">
          Idaho Laws That May Affect Your State Income Taxes
        </h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          Idaho has cut income tax rates, added new exemptions, and updated its alignment with the federal tax code — multiple times in recent years. Here&apos;s a plain-language breakdown of the laws most likely to affect what you owe on your Idaho state return.
        </p>
      </div>

      <div className="space-y-8 text-sm text-slate-600 leading-relaxed">

        {/* HB 559 (2026) */}
        <section>
          <h2 className="section-label mb-3">HB 559 (2026) — AFFECTS YOUR 2025 TAX RETURN</h2>
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="font-semibold text-slate-800 text-base leading-snug">
                  Idaho Federal Tax Conformity — Aligns With Federal Law for 2025
                </p>
                <p className="text-xs text-slate-400 mt-1">Signed into law · Retroactive to January 1, 2025</p>
              </div>
              <span className="shrink-0 bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                Signed into Law
              </span>
            </div>

            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
                <p className="font-semibold text-slate-700 text-xs uppercase tracking-wide mb-1">What it means for you</p>
                <p>
                  Every year Idaho passes a &ldquo;conformity bill&rdquo; to sync its tax code with changes to the federal Internal Revenue Code. This year&apos;s bill aligns Idaho with the federal &ldquo;One Big Beautiful Bill&rdquo; — with two important exceptions Idaho chose <span className="font-medium text-slate-700">not</span> to adopt:
                </p>
                <ul className="mt-2 space-y-2 list-disc list-inside text-slate-600">
                  <li>
                    <span className="font-medium text-slate-700">Bonus depreciation.</span>{' '}
                    Idaho is not conforming to the federal bonus depreciation rules — businesses cannot use the accelerated federal write-off on their Idaho return.
                  </li>
                  <li>
                    <span className="font-medium text-slate-700">R&amp;D expense amortization.</span>{' '}
                    Research and development expenses from 2022–2024 will continue their existing 5-year amortization schedule under Idaho law rather than switching to new federal rules.
                  </li>
                </ul>
                <p className="mt-2 text-slate-500 text-xs">
                  The bill also prevents businesses from claiming the same R&amp;E expenses as both a deduction and an Idaho tax credit — no double-dipping.
                </p>
              </div>
              <p>
                Passed <span className="font-medium text-slate-700">59–9 in the House</span> and <span className="font-medium text-slate-700">28–7 in the Senate</span>, largely along party lines. Sponsored by House Majority Leader <span className="font-medium text-slate-700">Rep. Mike Moyle (R)</span>.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <Link href="/bills/2026/H0559" className="text-amber-700 hover:underline font-medium text-xs">
                View full bill, votes &amp; sponsors →
              </Link>
            </div>
          </div>
        </section>

        {/* H0040 (2025) */}
        <section>
          <h2 className="section-label mb-3">H0040 (2025) — RATE CUT + NEW EXEMPTIONS</h2>
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="font-semibold text-slate-800 text-base leading-snug">
                  Income Tax Rate Cut, Military Exemption &amp; Precious Metals Capital Gains
                </p>
                <p className="text-xs text-slate-400 mt-1">Signed into law · Retroactive to January 1, 2025</p>
              </div>
              <span className="shrink-0 bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                Signed into Law
              </span>
            </div>

            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
                <p className="font-semibold text-slate-700 text-xs uppercase tracking-wide mb-1">What it means for you</p>
                <p>This law made three changes to Idaho income taxes, all retroactive to January 1, 2025:</p>
                <ul className="mt-2 space-y-2 list-disc list-inside text-slate-600">
                  <li>
                    <span className="font-medium text-slate-700">Income tax rate reduced.</span>{' '}
                    Idaho&apos;s individual income tax rate was lowered — meaning more of what you earn stays in your pocket on your 2025 return.
                  </li>
                  <li>
                    <span className="font-medium text-slate-700">Military benefits exempted.</span>{' '}
                    Certain military retirement and benefit payments are now excluded from Idaho taxable income — a meaningful change for Idaho&apos;s veteran community.
                  </li>
                  <li>
                    <span className="font-medium text-slate-700">Precious metals capital gains exempted.</span>{' '}
                    Profits from selling gold, silver, and other precious metals are no longer subject to Idaho capital gains tax.
                  </li>
                </ul>
              </div>
              <p>
                Passed <span className="font-medium text-slate-700">63–7 in the House</span> and <span className="font-medium text-slate-700">27–8 in the Senate</span>. Sponsored by <span className="font-medium text-slate-700">Sen. Doug Ricks (R)</span> and <span className="font-medium text-slate-700">Rep. Dori Healey (R)</span>.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <Link href="/bills/2025/H0040" className="text-amber-700 hover:underline font-medium text-xs">
                View full bill, votes &amp; sponsors →
              </Link>
            </div>
          </div>
        </section>

        {/* H0479 (2025) */}
        <section>
          <h2 className="section-label mb-3">H0479 (2025) — DEDUCTIONS &amp; CORPORATE RATES</h2>
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="font-semibold text-slate-800 text-base leading-snug">
                  Tax Deduction Revisions, Corporate Rate Adjustments &amp; Taxpayer Protections
                </p>
                <p className="text-xs text-slate-400 mt-1">Signed April 4, 2025 · Provisions effective Jan 1 – Jul 1, 2025</p>
              </div>
              <span className="shrink-0 bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                Signed into Law
              </span>
            </div>

            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
                <p className="font-semibold text-slate-700 text-xs uppercase tracking-wide mb-1">What it means for you</p>
                <p>
                  This follow-on bill refined and extended the changes made by H0040 earlier in the session. Key changes:
                </p>
                <ul className="mt-2 space-y-2 list-disc list-inside text-slate-600">
                  <li>
                    <span className="font-medium text-slate-700">Deduction rules updated.</span>{' '}
                    Adjusted which expenses individuals and businesses can deduct on their Idaho return, with some provisions retroactive to January 1, 2025.
                  </li>
                  <li>
                    <span className="font-medium text-slate-700">Corporate income tax rates revised.</span>{' '}
                    Adjustments to the rates that Idaho businesses pay on corporate income, effective July 1, 2025.
                  </li>
                  <li>
                    <span className="font-medium text-slate-700">Taxpayer protections added.</span>{' '}
                    New provisions giving Idaho taxpayers additional procedural protections in their dealings with the Idaho State Tax Commission.
                  </li>
                </ul>
              </div>
              <p>
                Passed <span className="font-medium text-slate-700">unanimously — 66–0 in the House</span> and <span className="font-medium text-slate-700">34–0 in the Senate</span>, with bipartisan support in both chambers.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <Link href="/bills/2025/H0479" className="text-amber-700 hover:underline font-medium text-xs">
                View full bill, votes &amp; sponsors →
              </Link>
            </div>
          </div>
        </section>

        {/* HB 521 (2024) — brief callout */}
        <section>
          <h2 className="section-label mb-3">HB 521 (2024) — PREVIOUS RATE CUT</h2>
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <p className="font-semibold text-slate-800 leading-snug">
              Income Tax Rate Cut: 5.8% → 5.695%
            </p>
            <p className="text-slate-500 text-xs">Enacted April 2, 2024 · Passed 61–6 House, 23–11 Senate</p>
            <p>
              The year before H0040, Idaho lawmakers cut the individual income tax rate from <span className="font-medium text-slate-700">5.8% to 5.695%</span> as part of a broader school facilities funding package. This was Idaho&apos;s third income tax cut in three years, continuing a consistent pattern of rate reduction by the Legislature.
            </p>
            <div className="pt-1 border-t border-slate-100">
              <Link href="/bills/2024/H0521" className="text-amber-700 hover:underline font-medium text-xs">
                View full bill, votes &amp; sponsors →
              </Link>
            </div>
          </div>
        </section>

        {/* The bigger picture */}
        <section>
          <h2 className="section-label mb-3">THE BIGGER PICTURE</h2>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-2">
            <p className="font-semibold text-slate-700">Idaho has cut income taxes multiple times since 2022.</p>
            <p className="text-slate-500">
              The Legislature has consistently reduced individual and corporate income tax rates over the past several sessions. If you haven&apos;t updated your Idaho withholding or estimated tax payments recently, these changes may affect what you owe — or what you get back — at the end of the year.
            </p>
          </div>
        </section>

        {/* Browse more */}
        <section>
          <h2 className="section-label mb-3">BROWSE ALL INCOME TAX BILLS</h2>
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <p>
              Use Tally Idaho to search the full record of Idaho tax legislation going back to 2016 — filter by keyword, year, or sponsor to see the complete history.
            </p>
            <div className="flex gap-3 flex-wrap pt-1">
              <Link
                href="/bills?q=income+tax"
                className="bg-[#0f172a] text-amber-400 text-xs font-bold px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
              >
                Search "income tax" bills
              </Link>
              <Link
                href="/bills?q=tax+credit"
                className="border border-slate-300 text-slate-700 text-xs font-semibold px-4 py-2 rounded-lg hover:border-amber-400 transition-colors"
              >
                Search "tax credit" bills
              </Link>
            </div>
          </div>
        </section>

        {/* Also see */}
        <section>
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
            <p className="font-semibold text-slate-700 text-xs uppercase tracking-wide">Also on Tally Idaho</p>
            <Link
              href="/idaho-property-tax-legislation"
              className="flex items-center gap-2 text-amber-700 hover:underline text-sm font-medium"
            >
              Idaho Laws That May Affect Your Property Taxes →
            </Link>
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
