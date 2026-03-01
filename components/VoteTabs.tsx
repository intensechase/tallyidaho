'use client'

import Link from 'next/link'
import { useState } from 'react'

interface Vote {
  vote: string
  roll_calls: {
    id: number
    date: string
    passed: boolean
    yea_count: number
    nay_count: number
    bills: {
      bill_number: string
      title: string
      session_id: string
      is_controversial: boolean
      controversy_reason: string | null
    } | null
  } | null
}

interface Props {
  allVotes: Vote[]
  keyVotes: Vote[]
  year: number
}

type VoteFilter = 'all' | 'yea' | 'nay' | 'absent'

export default function VoteTabs({ allVotes, keyVotes, year }: Props) {
  const [tab, setTab] = useState<'key' | 'all'>('key')
  const [voteFilter, setVoteFilter] = useState<VoteFilter>('all')

  const baseVotes = tab === 'key' ? keyVotes : allVotes

  const isAbsent = (v: Vote) => v.vote !== 'yea' && v.vote !== 'nay'
  const filtered = baseVotes.filter(v => {
    if (voteFilter === 'yea') return v.vote === 'yea'
    if (voteFilter === 'nay') return v.vote === 'nay'
    if (voteFilter === 'absent') return isAbsent(v)
    return true
  })

  const yeaCount    = baseVotes.filter(v => v.vote === 'yea').length
  const nayCount    = baseVotes.filter(v => v.vote === 'nay').length
  const absentCount = baseVotes.filter(isAbsent).length

  function switchTab(t: 'key' | 'all') {
    setTab(t)
    setVoteFilter('all')
  }

  return (
    <section>
      {/* Tab bar */}
      <div className="flex gap-1 mb-3 bg-[#1e293b] rounded-lg p-1 w-fit">
        <button
          onClick={() => switchTab('key')}
          className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
            tab === 'key'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Key Votes{keyVotes.length > 0 && ` (${keyVotes.length})`}
        </button>
        <button
          onClick={() => switchTab('all')}
          className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
            tab === 'all'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All Votes{allVotes.length > 0 && ` (${allVotes.length})`}
        </button>
      </div>

      {/* Filter chips — All Votes tab only */}
      {tab === 'all' && baseVotes.length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {(
            [
              { key: 'all',    label: `All (${baseVotes.length})`,  style: 'bg-slate-100 text-slate-600 border-slate-200' },
              { key: 'yea',    label: `✓ Yea (${yeaCount})`,        style: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
              { key: 'nay',    label: `✗ Nay (${nayCount})`,        style: 'bg-red-50 text-red-600 border-red-200' },
              ...(absentCount > 0
                ? [{ key: 'absent', label: `Absent (${absentCount})`, style: 'bg-amber-50 text-amber-700 border-amber-200' }]
                : []),
            ] as { key: VoteFilter; label: string; style: string }[]
          ).map(chip => (
            <button
              key={chip.key}
              onClick={() => setVoteFilter(chip.key)}
              className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-all ${
                voteFilter === chip.key
                  ? `${chip.style} ring-2 ring-offset-1 ring-current`
                  : `${chip.style} opacity-60 hover:opacity-100`
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-400 italic py-4">
          {tab === 'key'
            ? 'No controversial votes recorded for this session.'
            : voteFilter !== 'all'
            ? `No ${voteFilter} votes found.`
            : 'No votes recorded for this session.'}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((v, i) => {
            const rc = v.roll_calls
            const bill = rc?.bills
            if (!bill) return null
            const absent = isAbsent(v)
            return (
              <Link
                key={i}
                href={`/bills/${year}/${bill.bill_number?.toLowerCase()}`}
                className="block"
              >
                <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3 hover:border-amber-300 transition-all group">
                  {/* Vote badge */}
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg shrink-0 min-w-[44px] text-center ${
                    v.vote === 'yea'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : v.vote === 'nay'
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {absent ? 'ABSENT' : v.vote?.toUpperCase()}
                  </span>

                  {/* Bill info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-amber-600">{bill.bill_number}</p>
                    <p className="text-sm text-slate-700 truncate group-hover:text-amber-800 transition-colors">
                      {bill.title}
                    </p>
                  </div>

                  {/* Controversy badge */}
                  {bill.is_controversial && tab === 'all' && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                      bill.controversy_reason === 'party_line'
                        ? 'bg-red-50 text-red-500'
                        : 'bg-orange-50 text-orange-500'
                    }`}>
                      {bill.controversy_reason === 'party_line' ? 'PARTY LINE' : 'CLOSE'}
                    </span>
                  )}

                  {/* Pass/fail */}
                  <span className={`text-xs font-semibold shrink-0 ${rc?.passed ? 'text-emerald-600' : 'text-red-400'}`}>
                    {rc?.passed ? '✓' : '✗'}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
