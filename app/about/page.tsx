import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About Tally Idaho | Nonpartisan Idaho Legislature Tracker',
  description: 'Tally Idaho is a free, nonpartisan civic tool for Idaho voters to track bills, legislators, and votes in the Idaho Legislature. No spin.',
}

export const revalidate = 86400

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home',  item: 'https://www.tallyidaho.com' },
    { '@type': 'ListItem', position: 2, name: 'About', item: 'https://www.tallyidaho.com/about' },
  ],
}

export default function AboutPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      {/* Breadcrumb */}
      <nav className="text-xs text-slate-400 mb-6">
        <Link href="/" className="hover:text-amber-600">Home</Link>
        <span className="mx-2">›</span>
        <span className="text-slate-600">About</span>
      </nav>

      {/* Header */}
      <div className="mb-10">
        <Link href="/" className="inline-flex flex-col leading-none mb-6">
          <span className="font-outfit font-light text-[0.55rem] text-amber-500 tracking-[0.55em] uppercase">Tally</span>
          <span className="font-playfair font-black text-[2rem] text-slate-900 tracking-tight leading-none -mt-0.5">IDAHO</span>
          <span className="font-outfit font-light text-[0.5rem] text-slate-400 tracking-[0.2em] uppercase mt-0.5">Legislative Tracker</span>
        </Link>
        <p className="text-xl font-semibold text-slate-700 leading-snug">
          Every vote counted. Every voice heard.
        </p>
      </div>

      <div className="space-y-10 text-sm text-slate-600 leading-relaxed">

        {/* Mission */}
        <section>
          <h2 className="section-label mb-3">OUR MISSION</h2>
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <p>
              Tally Idaho is a free, nonpartisan civic tool built for Idaho voters. We believe that
              public legislative data should be genuinely public — easy to find, easy to read, and
              easy to act on.
            </p>
            <p>
              The Idaho Legislature casts thousands of votes each session. Many of those votes affect
              your taxes, your schools, your healthcare, and your community. Tally Idaho makes it
              simple to see exactly how your representatives voted — and hold them accountable.
            </p>
            <p>
              We have no political agenda. We don't endorse candidates or parties. We present the
              data as it is, and let you draw your own conclusions.
            </p>
          </div>
        </section>

        {/* What we track */}
        <section>
          <h2 className="section-label mb-3">WHAT WE TRACK</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: '📄', title: 'Bills', body: 'Every bill introduced in the Idaho Legislature since 2016 — titles, sponsors, status, and full text links.' },
              { icon: '🗳️', title: 'Votes', body: 'Every recorded roll call vote. See how each legislator voted on every bill, every time.' },
              { icon: '👤', title: 'Legislators', body: 'All 105 current legislators — party, district, committee memberships, contact info, and voting record.' },
              { icon: '🏛️', title: 'Committees', body: 'All standing committees, their members, and the bills they have considered.' },
              { icon: '🗺️', title: 'Districts', body: 'All 35 legislative districts — who represents each district and how they vote.' },
              { icon: '📅', title: 'Sessions', body: 'Every legislative session from 2016 to present, including special sessions.' },
            ].map(f => (
              <div key={f.title} className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-lg mb-1">{f.icon}</p>
                <p className="font-semibold text-slate-800 mb-1">{f.title}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Principles */}
        <section>
          <h2 className="section-label mb-3">OUR PRINCIPLES</h2>
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {[
              { label: 'Free, always', body: 'Tally Idaho will never charge for access to public legislative data.' },
              { label: 'Nonpartisan', body: 'We do not favor any party, candidate, or ideology. Our controversial bill flags are based on objective vote patterns — not editorial judgment.' },
              { label: 'No spin', body: 'We present data as it is. Bill summaries come directly from the Idaho Legislature\'s official statements of purpose.' },
              { label: 'Open data', body: 'Legislative data is provided by LegiScan under Creative Commons CC BY 4.0 and sourced from the Idaho Legislature\'s official records.' },
            ].map(p => (
              <div key={p.label} className="px-5 py-4">
                <p className="font-semibold text-slate-800 text-sm mb-0.5">{p.label}</p>
                <p className="text-slate-500 text-xs leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Data sources */}
        <section>
          <h2 className="section-label mb-3">DATA SOURCES</h2>
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <p>
              Bill and vote data is sourced from{' '}
              <a href="https://legiscan.com" target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:underline font-medium">
                LegiScan
              </a>
              , a nonpartisan legislative tracking service, under the{' '}
              <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:underline">
                Creative Commons CC BY 4.0
              </a>{' '}
              license.
            </p>
            <p>
              Legislator profiles, committee rosters, and daily calendars are sourced directly from the{' '}
              <a href="https://legislature.idaho.gov" target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:underline font-medium">
                Idaho Legislature's official website
              </a>
              .
            </p>
            <p>
              Data is updated daily. There may be a short delay between official legislative action
              and when changes appear on Tally Idaho.
            </p>
          </div>
        </section>

        {/* Contact / feedback */}
        <section>
          <h2 className="section-label mb-3">CONTACT & FEEDBACK</h2>
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <p>
              Tally Idaho is an independent civic project. We are not affiliated with the Idaho
              Legislature, any political party, or any government agency.
            </p>
            <p>
              Found an error? Have a suggestion? We want to hear from you. Reach us at{' '}
              <a href="mailto:hello@tallyidaho.com" className="text-amber-700 hover:underline font-medium">
                hello@tallyidaho.com
              </a>
              .
            </p>
          </div>
        </section>

      </div>

      {/* CTA */}
      <div className="mt-12 flex gap-3 flex-wrap">
        <Link href="/bills" className="bg-[#0f172a] text-amber-400 text-sm font-bold px-5 py-2.5 rounded-lg hover:bg-slate-800 transition-colors">
          Browse Bills
        </Link>
        <Link href="/idaho-legislative-process" className="border border-slate-300 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-lg hover:border-amber-400 transition-colors">
          How Idaho Laws Are Made →
        </Link>
      </div>

    </main>
  )
}
