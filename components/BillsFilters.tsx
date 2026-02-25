'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016]

interface Props {
  currentYear: number
  currentChamber: string
  currentSubject: string
  currentControversial: boolean
  currentQuery: string
  subjects: string[]
  filterUrl: (overrides: Record<string, string | undefined>) => string
}

export default function BillsFilters({
  currentYear,
  currentChamber,
  currentSubject,
  currentControversial,
  currentQuery,
  subjects,
  filterUrl,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [query, setQuery] = useState(currentQuery)

  function navigate(url: string) {
    startTransition(() => router.push(url))
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    navigate(filterUrl({ q: query || undefined }))
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search bill titles…"
          className="flex-1 text-sm border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
        />
        <button
          type="submit"
          className="bg-[#0f172a] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          Search
        </button>
        {currentQuery && (
          <button
            type="button"
            onClick={() => { setQuery(''); navigate(filterUrl({ q: undefined })) }}
            className="text-sm text-slate-500 hover:text-slate-800 px-2"
          >
            ✕ Clear
          </button>
        )}
      </form>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap text-sm">

        {/* Year */}
        <select
          value={currentYear}
          onChange={e => navigate(filterUrl({ year: e.target.value }))}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500 bg-white"
        >
          {YEARS.map(y => (
            <option key={y} value={y}>{y} Session</option>
          ))}
        </select>

        {/* Chamber */}
        <div className="flex gap-1">
          {(['', 'house', 'senate'] as const).map(c => (
            <button
              key={c}
              onClick={() => navigate(filterUrl({ chamber: c || undefined }))}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                currentChamber === c
                  ? 'bg-[#0f172a] text-white border-transparent'
                  : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400'
              }`}
            >
              {c === '' ? 'Both' : c === 'house' ? 'House' : 'Senate'}
            </button>
          ))}
        </div>

        {/* Controversial toggle */}
        <button
          onClick={() => navigate(filterUrl({ controversial: currentControversial ? undefined : 'true' }))}
          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
            currentControversial
              ? 'bg-amber-500 text-white border-transparent'
              : 'bg-white border-slate-300 text-slate-600 hover:border-amber-400'
          }`}
        >
          ⚡ Controversial only
        </button>

        {/* Subject */}
        {subjects.length > 0 && (
          <select
            value={currentSubject}
            onChange={e => navigate(filterUrl({ subject: e.target.value || undefined }))}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500 bg-white max-w-[200px]"
          >
            <option value="">All topics</option>
            {subjects.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}

        {/* Active filter count */}
        {(currentChamber || currentControversial || currentSubject || currentQuery) && (
          <a
            href="/bills"
            className="text-xs text-slate-400 hover:text-red-500 transition-colors ml-2"
          >
            ✕ Clear all filters
          </a>
        )}
      </div>
    </div>
  )
}
