'use client'

import { useState } from 'react'

interface Voter {
  name: string
  party: string
  district: string
  slug: string
}

interface Props {
  yeas: Voter[]
  nays: Voter[]
  abstains: Voter[]
}

export default function VoteNamesToggle({ yeas, nays, abstains }: Props) {
  const [open, setOpen] = useState(false)
  const total = yeas.length + nays.length

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-2.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-between border-t border-slate-100"
      >
        <span>{open ? 'Hide individual votes' : `Show all ${total} voter names`}</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          {/* YEA / NAY grid */}
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold tracking-widest text-emerald-600 mb-2">YEA ({yeas.length})</p>
              <div className="space-y-1">
                {yeas.map((v, i) => (
                  <a key={i} href={`/legislators/${v.slug}`} className="flex items-center gap-2 group">
                    <span className={`party-badge party-${v.party?.toLowerCase()} shrink-0`}>{v.party}</span>
                    <span className="text-xs text-slate-700 group-hover:text-amber-700 transition-colors truncate">{v.name}</span>
                    <span className="text-xs text-slate-400 shrink-0 ml-auto">{v.district}</span>
                  </a>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold tracking-widest text-red-500 mb-2">NAY ({nays.length})</p>
              <div className="space-y-1">
                {nays.map((v, i) => (
                  <a key={i} href={`/legislators/${v.slug}`} className="flex items-center gap-2 group">
                    <span className={`party-badge party-${v.party?.toLowerCase()} shrink-0`}>{v.party}</span>
                    <span className="text-xs text-slate-700 group-hover:text-amber-700 transition-colors truncate">{v.name}</span>
                    <span className="text-xs text-slate-400 shrink-0 ml-auto">{v.district}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Absent / NV */}
          {abstains.length > 0 && (
            <div className="px-4 pb-4 border-t border-slate-100 pt-3">
              <p className="text-xs font-bold tracking-widest text-slate-400 mb-2">
                ABSENT / NOT VOTING ({abstains.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {abstains.map((v, i) => (
                  <a key={i} href={`/legislators/${v.slug}`} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-amber-700">
                    <span className={`party-badge party-${v.party?.toLowerCase()}`}>{v.party}</span>
                    {v.name}
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
