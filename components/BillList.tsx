'use client'

import { useState } from 'react'
import Link from 'next/link'

const INITIAL_COUNT = 5

interface Bill {
  id: string
  bill_number: string
  title: string
  status: string | number
  completed: boolean
  is_controversial?: boolean
  controversy_reason?: string
  roll_calls?: { yea_count: number; nay_count: number; passed: boolean }[]
}

function BillRow({ bill, year }: { bill: Bill; year: number }) {
  const latestRc = bill.roll_calls?.[bill.roll_calls.length - 1]
  const yea = latestRc?.yea_count ?? 0
  const nay = latestRc?.nay_count ?? 0

  const statusLabel =
    bill.completed ? 'Enacted' :
    bill.status === '4' || bill.status === 4 ? 'Enacted' :
    bill.status === '3' || bill.status === 3 ? 'Passed' :
    bill.status === '2' || bill.status === 2 ? 'In Committee' :
    'Introduced'
  const statusStyle =
    bill.completed || bill.status === '4' || bill.status === 4 ? 'bg-emerald-50 text-emerald-700' :
    bill.status === '3' || bill.status === 3 ? 'bg-blue-50 text-blue-600' :
    bill.status === '2' || bill.status === 2 ? 'bg-amber-50 text-amber-700' :
    'bg-slate-100 text-slate-500'

  return (
    <Link href={`/bills/${year}/${bill.bill_number?.toLowerCase()}`} className="block">
      <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3 hover:border-amber-300 transition-all group">
        <span className="text-xs font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
          {bill.bill_number}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-700 truncate group-hover:text-amber-800 transition-colors">
            {bill.title}
          </p>
        </div>
        {bill.is_controversial && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
            bill.controversy_reason === 'party_line' ? 'bg-red-50 text-red-500' : 'bg-orange-50 text-orange-500'
          }`}>
            {bill.controversy_reason === 'party_line' ? 'PARTY LINE' : 'CLOSE'}
          </span>
        )}
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${statusStyle}`}>
          {statusLabel}
        </span>
        {latestRc && (
          <span className="text-xs text-slate-400 shrink-0">
            <span className="text-emerald-600 font-bold">{yea}</span>–<span className="text-red-500 font-bold">{nay}</span>
          </span>
        )}
      </div>
    </Link>
  )
}

export default function BillList({ bills, year }: { bills: Bill[]; year: number }) {
  const [expanded, setExpanded] = useState(false)
  const shouldTruncate = bills.length > INITIAL_COUNT + 1
  const visible = shouldTruncate && !expanded ? bills.slice(0, INITIAL_COUNT) : bills
  const hiddenCount = bills.length - INITIAL_COUNT

  return (
    <div className="space-y-2">
      {visible.map(bill => (
        <BillRow key={bill.id} bill={bill} year={year} />
      ))}
      {shouldTruncate && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full text-center text-sm text-amber-600 hover:text-amber-700 font-medium py-2 border border-dashed border-amber-200 rounded-xl hover:border-amber-400 transition-colors"
        >
          Show {hiddenCount} more →
        </button>
      )}
    </div>
  )
}
