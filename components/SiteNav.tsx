'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { legislatorSlug } from '@/lib/slugify'

const navLinks = [
  { href: '/bills', label: 'Bills' },
  { href: '/legislators', label: 'Legislators' },
  { href: '/districts', label: 'Districts' },
  { href: '/committees', label: 'Committees' },
  { href: '/sessions', label: 'Sessions' },
]

interface SearchResult {
  legislators: Array<{ name: string; party: string; role: string; district: string }>
  bills: Array<{ bill_number: string; title: string; year: number }>
}

export default function SiteNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [results, setResults] = useState<SearchResult | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced search on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (query.trim().length < 2) {
      setResults(null)
      setShowDropdown(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        const data: SearchResult = await res.json()
        setResults(data)
        setShowDropdown(true)
      } catch {
        // silently ignore fetch errors
      } finally {
        setLoading(false)
      }
    }, 280)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) {
      setShowDropdown(false)
      router.push(`/bills?q=${encodeURIComponent(query.trim())}`)
    }
  }

  function navigateToAllBills() {
    setShowDropdown(false)
    setQuery('')
    setMenuOpen(false)
    router.push(`/bills?q=${encodeURIComponent(query.trim())}`)
  }

  function handleResultClick() {
    setShowDropdown(false)
    setQuery('')
    setMenuOpen(false)
  }

  const hasLegislators = (results?.legislators.length ?? 0) > 0
  const hasBills = (results?.bills.length ?? 0) > 0
  const hasAny = hasLegislators || hasBills

  return (
    <header className="bg-[#0f172a] header-texture sticky top-0 z-50 border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">

        {/* Logo */}
        <Link href="/" className="logo-hover shrink-0 leading-none flex flex-col">
          <span className="font-outfit font-light text-[0.55rem] text-amber-500 tracking-[0.55em] uppercase">Tally</span>
          <span className="font-playfair font-black text-[1.45rem] text-white tracking-tight leading-none -mt-0.5">IDAHO</span>
          <span className="font-outfit font-light text-[0.45rem] text-slate-600 tracking-[0.2em] uppercase mt-0.5">Legislative Tracker</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 ml-4 font-outfit">
          {navLinks.map(({ href, label }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1 text-sm transition-colors relative ${
                  isActive
                    ? 'text-amber-400 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-amber-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </nav>

        {/* FAQ link */}
        <Link
          href="/faq"
          className={`hidden md:block text-xs transition-colors shrink-0 ${
            pathname === '/faq' ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          FAQ
        </Link>

        {/* Search with typeahead */}
        <div ref={searchWrapRef} className="ml-auto hidden md:block relative">
          <form onSubmit={handleSearch}>
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => { if (results && query.trim().length >= 2) setShowDropdown(true) }}
              onKeyDown={e => { if (e.key === 'Escape') setShowDropdown(false) }}
              placeholder="Search bills or legislators…"
              className="font-outfit w-56 lg:w-72 text-sm bg-[#1e293b] text-slate-200 placeholder-slate-500 border border-slate-700 rounded-full px-4 py-1.5 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              autoComplete="off"
            />
          </form>

          {/* Dropdown */}
          {showDropdown && query.trim().length >= 2 && (
            <div className="absolute top-full right-0 mt-2 w-80 lg:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">

              {loading && (
                <div className="px-4 py-3 text-sm text-slate-400">Searching…</div>
              )}

              {!loading && !hasAny && (
                <div className="px-4 py-3 text-sm text-slate-400">No results for "{query}"</div>
              )}

              {!loading && hasLegislators && (
                <div>
                  <div className="px-3 pt-3 pb-1.5 text-[10px] font-bold tracking-widest text-slate-400">
                    LEGISLATORS
                  </div>
                  {results!.legislators.map((leg) => (
                    <Link
                      key={leg.name}
                      href={`/legislators/${legislatorSlug(leg.name)}`}
                      onClick={handleResultClick}
                      className="flex items-center gap-2.5 px-3 py-2 hover:bg-amber-50 transition-colors group"
                    >
                      <span className={`text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full shrink-0 ${
                        leg.party === 'R' ? 'bg-red-500' :
                        leg.party === 'D' ? 'bg-blue-500' : 'bg-slate-400'
                      }`}>
                        {leg.party}
                      </span>
                      <span className="text-sm font-semibold text-slate-800 flex-1 group-hover:text-amber-800">
                        {leg.name}
                      </span>
                      <span className="text-xs text-slate-400 shrink-0">
                        {leg.role === 'Sen' ? 'Sen.' : 'Rep.'} · {leg.district}
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {!loading && hasBills && (
                <div className={hasLegislators ? 'border-t border-slate-100' : ''}>
                  <div className="px-3 pt-3 pb-1.5 text-[10px] font-bold tracking-widest text-slate-400">
                    BILLS
                  </div>
                  {results!.bills.map((bill) => (
                    <Link
                      key={bill.bill_number}
                      href={`/bills/${bill.year}/${bill.bill_number.toLowerCase()}`}
                      onClick={handleResultClick}
                      className="flex items-center gap-2.5 px-3 py-2 hover:bg-amber-50 transition-colors"
                    >
                      <span className="text-xs font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full shrink-0">
                        {bill.bill_number}
                      </span>
                      <span className="text-sm text-slate-700 truncate">{bill.title}</span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Footer: search all bills */}
              <div className="border-t border-slate-100">
                <button
                  onClick={navigateToAllBills}
                  className="w-full px-3 py-2.5 text-sm text-amber-700 hover:bg-amber-50 text-left transition-colors flex items-center gap-2"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                  Search all bills for "{query}"
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden ml-auto text-slate-400 hover:text-white p-1"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Toggle menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {menuOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            }
          </svg>
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden bg-[#1e293b] border-t border-slate-800 px-4 py-3 space-y-1 font-outfit">
          {[...navLinks, { href: '/faq', label: 'FAQ' }].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="block px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
            >
              {label}
            </Link>
          ))}
          <form onSubmit={handleSearch} className="mt-3">
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => { if (results && query.trim().length >= 2) setShowDropdown(true) }}
              onKeyDown={e => { if (e.key === 'Escape') setShowDropdown(false) }}
              placeholder="Search bills or legislators…"
              className="w-full text-sm bg-slate-800 text-slate-200 placeholder-slate-500 border border-slate-700 rounded-full px-4 py-2 focus:outline-none focus:border-amber-500"
            />
          </form>

          {/* Mobile search results */}
          {showDropdown && query.trim().length >= 2 && (
            <div className="mt-2 bg-white rounded-xl border border-slate-600 overflow-hidden">
              {loading && (
                <div className="px-4 py-3 text-sm text-slate-400">Searching…</div>
              )}
              {!loading && !hasAny && (
                <div className="px-4 py-3 text-sm text-slate-400">No results for &ldquo;{query}&rdquo;</div>
              )}
              {!loading && hasLegislators && (
                <div>
                  <div className="px-3 pt-3 pb-1.5 text-[10px] font-bold tracking-widest text-slate-400">LEGISLATORS</div>
                  {results!.legislators.map((leg) => (
                    <Link key={leg.name} href={`/legislators/${legislatorSlug(leg.name)}`} onClick={handleResultClick}
                      className="flex items-center gap-2.5 px-3 py-2 hover:bg-amber-50 transition-colors group">
                      <span className={`text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full shrink-0 ${
                        leg.party === 'R' ? 'bg-red-500' : leg.party === 'D' ? 'bg-blue-500' : 'bg-slate-400'
                      }`}>{leg.party}</span>
                      <span className="text-sm font-semibold text-slate-800 flex-1 group-hover:text-amber-800">{leg.name}</span>
                      <span className="text-xs text-slate-400 shrink-0">{leg.role === 'Sen' ? 'Sen.' : 'Rep.'} · {leg.district}</span>
                    </Link>
                  ))}
                </div>
              )}
              {!loading && hasBills && (
                <div className={hasLegislators ? 'border-t border-slate-100' : ''}>
                  <div className="px-3 pt-3 pb-1.5 text-[10px] font-bold tracking-widest text-slate-400">BILLS</div>
                  {results!.bills.map((bill) => (
                    <Link key={bill.bill_number} href={`/bills/${bill.year}/${bill.bill_number.toLowerCase()}`} onClick={handleResultClick}
                      className="flex items-center gap-2.5 px-3 py-2 hover:bg-amber-50 transition-colors">
                      <span className="text-xs font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full shrink-0">{bill.bill_number}</span>
                      <span className="text-sm text-slate-700 truncate">{bill.title}</span>
                    </Link>
                  ))}
                </div>
              )}
              <div className="border-t border-slate-100">
                <button onClick={navigateToAllBills}
                  className="w-full px-3 py-2.5 text-sm text-amber-700 hover:bg-amber-50 text-left transition-colors flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                  Search all bills for &ldquo;{query}&rdquo;
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  )
}
