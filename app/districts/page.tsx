import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Idaho Legislative Districts | Tally Idaho',
  description: 'Browse all 35 Idaho legislative districts. Find your senator and representatives by district number.',
}

export const revalidate = 86400

const DISTRICTS = Array.from({ length: 35 }, (_, i) => i + 1)

export default function DistrictsPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <nav className="text-xs text-slate-400 mb-6">
        <a href="/" className="hover:text-amber-600">Home</a>
        <span className="mx-2">›</span>
        <span className="text-slate-600">Districts</span>
      </nav>

      <h1 className="text-2xl font-bold text-slate-900 mb-2">Idaho Legislative Districts</h1>
      <p className="text-sm text-slate-500 mb-8">
        Idaho has 35 legislative districts. Each district elects 1 state senator and 2 state representatives.
      </p>

      <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
        {DISTRICTS.map(n => (
          <Link
            key={n}
            href={`/districts/${n}`}
            className="aspect-square flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-700 font-bold text-sm hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700 transition-all"
          >
            {n}
          </Link>
        ))}
      </div>

      <div className="mt-10 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-slate-600">
        <p className="font-semibold mb-1">Don&apos;t know your district?</p>
        <p>
          Enter your address on the{' '}
          <a href="/" className="text-amber-700 hover:underline">homepage</a>
          {' '}to look up your district and legislators.
        </p>
      </div>
    </main>
  )
}
