'use client'

import Link from 'next/link'
import { useState } from 'react'

interface Vote {
  vote_value: string
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

export default function VoteTabs({ allVotes, keyVotes, year }: Props) {
  const [tab, setTab] = useState<'key' | 'all'>('key')

  const votes = tab === 'key' ? keyVotes : allVotes

  return (
    <section>
      {/* Tab bar */}
      <div className="flex gap-1 mb-3 bg-[#1e293b] rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('key')}
          className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
            tab === 'key'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Key Votes{keyVotes.length > 0 && ` (${keyVotes.length})`}
        </button>
        <button
          onClick={() => setTab('all')}
          className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
            tab === 'all'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All Votes{allVotes.length > 0 && ` (${allVotes.length})`}
        </button>
      </div>

      {votes.length === 0 ? (
        <p className="text-sm text-slate-400 italic py-4">
          {tab === 'key'
            ? 'No controversial votes recorded for this session.'
            : 'No votes recorded for this session.'}
        </p>
      ) : (
        <div className="space-y-2">
          {votes.map((v, i) => {
            const rc = v.roll_calls
            const bill = rc?.bills
            if (!bill) return null
            return (
              <Link
                key={i}
                href={`/bills/${year}/${bill.bill_number?.toLowerCase()}`}
                className="block"
              >
                <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3 hover:border-amber-300 transition-all group">
                  {/* Vote badge */}
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg shrink-0 min-w-[44px] text-center ${
                    v.vote_value === 'yea'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : v.vote_value === 'nay'
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {v.vote_value?.toUpperCase()}
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
