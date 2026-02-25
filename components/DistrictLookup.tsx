'use client'

import { useState } from 'react'
import Link from 'next/link'

type Legislator = {
  name: string
  party: string
  role: string
  district: string
  slug: string
}

type LookupResult = {
  district: number
  legislators: Legislator[]
}

export default function DistrictLookup() {
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<LookupResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!address.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch(`/api/district-lookup?address=${encodeURIComponent(address)}`)
      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error || 'Could not find your district. Try including your city and zip code.')
      } else {
        setResult(data)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="bg-slate-50 border-t border-slate-200 py-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="max-w-xl">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Find your legislators</h2>
          <p className="text-sm text-slate-500 mb-5">
            Enter your Idaho address to see your senator and representatives.
          </p>

          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="e.g. 700 W State St, Boise, ID 83702"
              className="flex-1 text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
            />
            <button
              type="submit"
              disabled={loading || !address.trim()}
              className="bg-[#0f172a] text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors shrink-0"
            >
              {loading ? 'Looking up…' : 'Search'}
            </button>
          </form>

          {error && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}

          {result && (
            <div className="mt-6">
              <p className="text-xs font-bold tracking-widest text-slate-400 mb-3">
                DISTRICT {result.district} LEGISLATORS
              </p>
              <div className="space-y-2">
                {result.legislators.map((leg, i) => (
                  <Link
                    key={i}
                    href={`/legislators/${leg.slug}`}
                    className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3 hover:border-amber-300 hover:shadow-sm transition-all"
                  >
                    <span className={`party-badge party-${leg.party.toLowerCase()} text-xs`}>
                      {leg.party}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{leg.name}</p>
                      <p className="text-xs text-slate-400">{leg.role} · District {result.district}</p>
                    </div>
                    <span className="ml-auto text-xs text-slate-400">View profile →</span>
                  </Link>
                ))}
              </div>
              <Link
                href={`/districts/${result.district}`}
                className="mt-3 inline-block text-sm text-amber-700 hover:underline"
              >
                View District {result.district} page →
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
