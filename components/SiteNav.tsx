'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

const navLinks = [
  { href: '/bills', label: 'Bills' },
  { href: '/legislators', label: 'Legislators' },
  { href: '/districts', label: 'Districts' },
  { href: '/sessions', label: 'Sessions' },
]

export default function SiteNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/bills?q=${encodeURIComponent(query.trim())}`)
    }
  }

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

        {/* Search */}
        <form onSubmit={handleSearch} className="ml-auto hidden md:flex items-center">
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search bills or legislators…"
            className="font-outfit w-56 lg:w-72 text-sm bg-[#1e293b] text-slate-200 placeholder-slate-500 border border-slate-700 rounded-full px-4 py-1.5 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
          />
        </form>

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
          {navLinks.map(({ href, label }) => (
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
              placeholder="Search bills or legislators…"
              className="w-full text-sm bg-slate-800 text-slate-200 placeholder-slate-500 border border-slate-700 rounded-full px-4 py-2 focus:outline-none focus:border-amber-500"
            />
          </form>
        </div>
      )}
    </header>
  )
}
