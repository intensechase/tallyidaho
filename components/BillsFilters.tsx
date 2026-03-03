'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, useEffect } from 'react'

const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016]

interface Legislator {
  id: string
  name: string
  role: string
  party: string
}

interface Props {
  currentYear: number
  currentChamber: string
  currentSubject: string
  currentControversial: boolean
  currentQuery: string
  currentStatus: string
  currentSponsor: string
  currentSort: string
  subjects: string[]
  legislators: Legislator[]
}

export default function BillsFilters({
  currentYear,
  currentChamber,
  currentSubject,
  currentControversial,
  currentQuery,
  currentStatus,
  currentSponsor,
  currentSort,
  subjects,
  legislators,
}: Props) {
  function filterUrl(overrides: Record<string, string | undefined>) {
    const current: Record<string, string> = {
      year: String(currentYear),
      ...(currentChamber && { chamber: currentChamber }),
      ...(currentSubject && { subject: currentSubject }),
      ...(currentControversial && { controversial: 'true' }),
      ...(currentQuery && { q: currentQuery }),
      ...(currentStatus && { status: currentStatus }),
      ...(currentSponsor && { sponsor: currentSponsor }),
      ...(currentSort && currentSort !== 'recent' && { sort: currentSort }),
    }
    const next = { ...current, ...overrides, page: '1' }
    const qs = Object.entries(next)
      .filter(([, v]) => v && v !== '' && v !== 'false')
      .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
      .join('&')
    return `/bills${qs ? `?${qs}` : ''}`
  }
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [query, setQuery] = useState(currentQuery)

  const activeFilterCount = [
    currentChamber,
    currentControversial,
    currentSubject,
    currentStatus,
    currentSponsor,
    currentSort && currentSort !== 'recent' ? currentSort : '',
  ].filter(Boolean).length

  const [showFilters, setShowFilters] = useState(activeFilterCount > 0)
  useEffect(() => {
    if (activeFilterCount > 0) setShowFilters(true)
  }, [activeFilterCount])

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
          placeholder="Search titles or bill numbers (e.g. H0123)…"
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

      {/* Mobile filter toggle */}
      <div className="flex items-center gap-2 md:hidden">
        <button
          type="button"
          onClick={() => setShowFilters(v => !v)}
          className="flex items-center gap-1.5 text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white hover:border-slate-400 transition-colors"
        >
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
          <span className="text-slate-400 text-xs">{showFilters ? '▲' : '▼'}</span>
        </button>
      </div>

      {/* Filter chips */}
      <div className={`gap-2 flex-wrap text-sm ${showFilters ? 'flex' : 'hidden md:flex'}`}>

        {/* Year */}
        <select
          value={currentYear}
          onChange={e => navigate(filterUrl({ year: e.target.value, sponsor: undefined }))}
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

        {/* Status */}
        <select
          value={currentStatus}
          onChange={e => navigate(filterUrl({ status: e.target.value || undefined }))}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500 bg-white"
        >
          <option value="">All stages</option>
          <option value="1">Introduced</option>
          <option value="2">In Committee</option>
          <option value="3">Floor Vote</option>
          <option value="4">Enacted</option>
          <option value="failed">Failed vote</option>
          <option value="dead">Dead / Vetoed</option>
        </select>

        {/* Sponsor */}
        {legislators.length > 0 && (
          <select
            value={currentSponsor}
            onChange={e => navigate(filterUrl({ sponsor: e.target.value || undefined }))}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500 bg-white max-w-[180px]"
          >
            <option value="">Any sponsor</option>
            <optgroup label="Senate">
              {legislators.filter(l => l.role === 'Sen').map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </optgroup>
            <optgroup label="House">
              {legislators.filter(l => l.role === 'Rep').map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </optgroup>
          </select>
        )}

        {/* Controversial toggle */}
        <button
          onClick={() => navigate(filterUrl({ controversial: currentControversial ? undefined : 'true' }))}
          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
            currentControversial
              ? 'bg-amber-500 text-white border-transparent'
              : 'bg-white border-slate-300 text-slate-600 hover:border-amber-400'
          }`}
        >
          Controversial only
        </button>

        {/* Sort */}
        <select
          value={currentSort}
          onChange={e => navigate(filterUrl({ sort: e.target.value !== 'recent' ? e.target.value : undefined, page: '1' }))}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500 bg-white"
        >
          <option value="recent">Most Recent</option>
          <option value="bill_number">Bill #</option>
          <option value="controversial">Controversial First</option>
        </select>

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
        {(currentChamber || currentControversial || currentSubject || currentQuery || currentStatus || (currentSort && currentSort !== 'recent')) && (
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
