import type { Metadata } from 'next'
import { Playfair_Display, Outfit, Oswald } from 'next/font/google'
import './globals.css'
import SiteNav from '@/components/SiteNav'
import Link from 'next/link'
import { GoogleAnalytics } from '@next/third-parties/google'

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  variable: '--font-playfair',
})

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-outfit',
})

const oswald = Oswald({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-oswald',
})

export const metadata: Metadata = {
  title: {
    default: 'Tally Idaho — Idaho Legislature Tracker',
    template: '%s | Tally Idaho',
  },
  description: 'Track Idaho legislators, bills, and votes. Nonpartisan public data from the Idaho Legislature, updated daily.',
  keywords: 'Idaho legislature, Idaho bills, Idaho legislators, Idaho voting record, Idaho politics, Idaho 2026 session',
  openGraph: {
    siteName: 'Tally Idaho',
    type: 'website',
    url: 'https://tallyidaho.com',
  },
  metadataBase: new URL('https://tallyidaho.com'),
}

const footerLinks = [
  { href: '/bills', label: 'Bills' },
  { href: '/legislators', label: 'Legislators' },
  { href: '/districts', label: 'Districts' },
  { href: '/sessions', label: 'Sessions' },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${outfit.variable} ${oswald.variable}`}>
      <body className="font-outfit antialiased bg-white text-slate-900">
        <SiteNav />
        {children}
        <footer className="bg-[#0f172a] text-slate-400 mt-20">
          <div className="max-w-7xl mx-auto px-4 py-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">

              {/* Brand */}
              <div className="col-span-2 md:col-span-1">
                <Link href="/" className="inline-flex flex-col leading-none mb-3">
                  <span className="font-outfit font-light text-[0.55rem] text-amber-500 tracking-[0.55em] uppercase">Tally</span>
                  <span className="font-playfair font-black text-[1.45rem] text-white tracking-tight leading-none -mt-0.5">IDAHO</span>
                  <span className="font-outfit font-light text-[0.45rem] text-slate-600 tracking-[0.2em] uppercase mt-0.5">Legislative Tracker</span>
                </Link>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Nonpartisan civic data for Idaho voters.<br />
                  Every vote counted. Every voice heard.
                </p>
              </div>

              {/* Browse */}
              <div>
                <p className="text-xs font-bold tracking-widest text-slate-500 mb-3 font-outfit">BROWSE</p>
                <nav className="space-y-2">
                  {footerLinks.map(({ href, label }) => (
                    <Link key={href} href={href} className="block text-sm hover:text-white transition-colors">
                      {label}
                    </Link>
                  ))}
                </nav>
              </div>

              {/* Data sources */}
              <div>
                <p className="text-xs font-bold tracking-widest text-slate-500 mb-3 font-outfit">DATA SOURCES</p>
                <nav className="space-y-2">
                  <a
                    href="https://legiscan.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm hover:text-white transition-colors"
                  >
                    LegiScan
                  </a>
                  <a
                    href="https://legislature.idaho.gov"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm hover:text-white transition-colors"
                  >
                    Idaho Legislature
                  </a>
                </nav>
              </div>

            </div>

            <div className="border-t border-slate-800 pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-slate-600">
              <p>© {new Date().getFullYear()} Tally Idaho. Public data. No ads. No affiliation.</p>
              <p>
                Legislative data provided by{' '}
                <a
                  href="https://legiscan.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-white underline"
                >
                  LegiScan
                </a>{' '}
                under{' '}
                <a
                  href="https://creativecommons.org/licenses/by/4.0/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-white underline"
                >
                  CC BY 4.0
                </a>
                .
              </p>
            </div>
          </div>
        </footer>
        <GoogleAnalytics gaId="G-7PX3W7S4Y8" />
      </body>
    </html>
  )
}
