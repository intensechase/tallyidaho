'use client'

import { useState } from 'react'
import Link from 'next/link'

type Bill = {
  id: number
  bill_number: string
  title: string
  chamber: string
  is_controversial: boolean
  controversy_reason: string | null
  completed: boolean
  last_action: string | null
  bill_sponsors: Array<{
    sponsor_order: number
    legislators: { name: string; party: string; district: string } | null
  }>
  roll_calls: Array<{
    yea_count: number
    nay_count: number
    passed: boolean
  }>
}

function BillCard({ bill, year }: { bill: Bill; year: number }) {
  const sponsor = [...(bill.bill_sponsors || [])]
    .sort((a, b) => a.sponsor_order - b.sponsor_order)
    .find(s => s.legislators)?.legislators

  const latestRc = bill.roll_calls?.[bill.roll_calls.length - 1]
  const yea = latestRc?.yea_count ?? 0
  const nay = latestRc?.nay_count ?? 0
  const total = yea + nay
  const yeaPct = total > 0 ? Math.round((yea / total) * 100) : 0

  return (
    <Link href={`/bills/${year}/${bill.bill_number.toLowerCase()}`}>
      <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 hover:border-amber-300 hover:shadow-sm transition-all cursor-pointer">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              {bill.bill_number}
            </span>
            {bill.is_controversial && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                bill.controversy_reason === 'party_line'
                  ? 'bg-red-50 text-red-600'
                  : 'bg-orange-50 text-orange-600'
              }`}>
                {bill.controversy_reason === 'party_line' ? 'PARTY LINE' : 'CLOSE VOTE'}
              </span>
            )}
            {bill.completed && (
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                ✓ {bill.last_action?.toLowerCase().includes('law') ? 'Signed' : 'Completed'}
              </span>
            )}
          </div>
          {sponsor?.district && (
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
              {sponsor.district}
            </span>
          )}
        </div>

        <p className="text-slate-900 font-semibold text-sm leading-snug mb-3">{bill.title}</p>

        {latestRc && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-emerald-600 w-12 text-right">{yea} Yea</span>
            <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${yeaPct}%` }} />
            </div>
            <span className="text-xs font-bold text-red-500 w-10">{nay} Nay</span>
          </div>
        )}

        {sponsor && (
          <p className="text-xs text-slate-400">{sponsor.name}</p>
        )}
      </div>
    </Link>
  )
}

interface Props {
  controversialBills: Bill[]
  recentBills: Bill[]
  year: number
}

export default function HomepageTabs({ controversialBills, recentBills, year }: Props) {
  const [tab, setTab] = useState<'controversial' | 'recent'>('controversial')
  const bills = tab === 'controversial' ? controversialBills : recentBills

  return (
    <section className="max-w-7xl mx-auto px-4 py-8">
      {/* Tab bar — V3 style */}
      <div className="flex items-center gap-6 border-b-2 border-amber-500 mb-6 bg-[#1e293b] -mx-4 px-4 rounded-t-xl">
        <button
          onClick={() => setTab('controversial')}
          className={`text-xs font-extrabold tracking-widest py-2.5 transition-colors border-b-2 -mb-px ${
            tab === 'controversial'
              ? 'text-amber-400 border-amber-400'
              : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          ⚡ CONTROVERSIAL
        </button>
        <button
          onClick={() => setTab('recent')}
          className={`text-xs font-semibold tracking-wide py-2.5 transition-colors border-b-2 -mb-px ${
            tab === 'recent'
              ? 'text-amber-400 border-amber-400'
              : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          All Bills
        </button>
        <Link
          href={tab === 'controversial' ? `/bills?controversial=true&year=${year}` : `/bills?year=${year}`}
          className="ml-auto text-xs text-slate-400 hover:text-amber-400 transition-colors py-2.5"
        >
          View all →
        </Link>
      </div>

      {/* Bill cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {bills.map(bill => (
          <BillCard key={bill.id} bill={bill} year={year} />
        ))}
      </div>

      {bills.length === 0 && (
        <p className="text-center text-slate-400 py-8 text-sm">No bills found.</p>
      )}
    </section>
  )
}
