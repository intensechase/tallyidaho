import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy | Tally Idaho',
  description: 'Tally Idaho privacy policy. We collect no personal data and never sell your information.',
  alternates: { canonical: 'https://www.tallyidaho.com/privacy' },
}

export const revalidate = 86400

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10">

      {/* Breadcrumb */}
      <nav className="text-xs text-slate-400 mb-6">
        <Link href="/" className="hover:text-amber-600">Home</Link>
        <span className="mx-2">›</span>
        <span className="text-slate-600">Privacy Policy</span>
      </nav>

      <div className="mb-10">
        <h1 className="page-heading mb-2">Privacy Policy</h1>
        <p className="text-xs text-slate-400">Last updated: February 2026</p>
      </div>

      <div className="space-y-8 text-sm text-slate-600 leading-relaxed">

        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-3">THE SHORT VERSION</h2>
          <p>
            Tally Idaho does not collect personal information, does not require an account,
            and does not sell or share data with third parties.
            We use Google Analytics to understand how people use the site in aggregate.
          </p>
        </section>

        <section>
          <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-3">INFORMATION WE COLLECT</h2>
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {[
              {
                label: 'No account required',
                body: 'Tally Idaho has no user accounts, login, or registration. We do not collect your name, email address, or any identifying information.',
              },
              {
                label: 'Analytics (Google Analytics 4)',
                body: 'We use Google Analytics 4 to collect anonymous, aggregated data about how visitors use the site — including pages visited, time spent, and general geographic region (country/state). This data does not identify you personally. You can opt out by using a browser extension like uBlock Origin or the Google Analytics opt-out add-on.',
              },
              {
                label: 'Server logs',
                body: 'Our hosting provider (Vercel) automatically records standard web server logs, including IP addresses, browser type, and pages requested. These logs are used for security and performance monitoring and are not shared.',
              },
              {
                label: 'Cookies',
                body: 'We do not set any first-party cookies. Google Analytics may set its own cookies (\_ga, \_gid) to distinguish visitors. These are analytics-only and contain no personal information.',
              },
            ].map(item => (
              <div key={item.label} className="px-5 py-4">
                <p className="font-semibold text-slate-800 text-sm mb-0.5">{item.label}</p>
                <p className="text-slate-500 text-xs leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-3">DATA SOURCES</h2>
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <p>
              All legislative data displayed on Tally Idaho is public information sourced from{' '}
              <a href="https://legiscan.com" target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:underline font-medium">LegiScan</a>{' '}
              (under{' '}
              <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:underline">CC BY 4.0</a>)
              and the{' '}
              <a href="https://legislature.idaho.gov" target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:underline font-medium">Idaho Legislature's official website</a>.
              Legislator names, photos, and contact information are public records.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-3">THIRD PARTIES</h2>
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <p>
              We do not sell, rent, or share any data with third parties for advertising or marketing purposes.
              The only third-party service with access to site usage data is Google Analytics.
              Google's privacy policy is available at{' '}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:underline">policies.google.com/privacy</a>.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-3">CONTACT</h2>
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <p>
              Questions about this policy? Reach us at{' '}
              <a href="mailto:hello@tallyidaho.com" className="text-amber-700 hover:underline font-medium">
                hello@tallyidaho.com
              </a>.
            </p>
          </div>
        </section>

      </div>

    </main>
  )
}
