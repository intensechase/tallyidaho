'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { FloorBill, FloorCalendar } from '@/lib/floor-calendar'

// ── Slim floor bill card ───────────────────────────────────────────────
function FloorBillCard({ bill, year }: { bill: FloorBill; year: number }) {
  const hasResult = bill.votePassed !== null
  const stateUrl = `https://legislature.idaho.gov/sessioninfo/${year}/legislation/${bill.billNumber}/`

  const borderClass = hasResult
    ? bill.votePassed
      ? 'border border-l-4 border-emerald-300'
      : 'border border-l-4 border-red-300'
    : 'border border-slate-200 hover:border-slate-300'

  const inner = (
    <div className={`bg-white rounded-lg p-3 transition-all hover:shadow-sm ${borderClass}`}>
      <div className="flex items-start gap-2 mb-1">
        <span className="text-xs font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0 mt-0.5">
          {bill.rawNumber}
        </span>
        {bill.topic && (
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide truncate flex-1 mt-0.5">
            {bill.topic}
          </span>
        )}
        {hasResult && (
          <span className={`text-xs font-black shrink-0 tabular-nums whitespace-nowrap ${bill.votePassed ? 'text-emerald-600' : 'text-red-500'}`}>
            {bill.votePassed ? '✓' : '✗'} {bill.voteYea}–{bill.voteNay}
          </span>
        )}
      </div>
      {bill.floorSponsor && (
        <p className="text-[10px] text-slate-400 mb-1 truncate">
          {bill.floorSponsor}{bill.floorDistrict ? ` · Dist. ${bill.floorDistrict}` : ''}
        </p>
      )}
      {bill.description && (
        <p className="text-xs text-slate-700 leading-snug line-clamp-2">
          {bill.description}
        </p>
      )}
    </div>
  )

  if (bill.href) return <Link href={bill.href} className="block">{inner}</Link>
  return <a href={stateUrl} target="_blank" rel="noopener noreferrer" className="block">{inner}</a>
}

// ── Chamber column (Senate or House) ──────────────────────────────────
function ChamberColumn({ bills, chamber, year }: {
  bills: FloorBill[]
  chamber: 'senate' | 'house'
  year: number
}) {
  const isSenate = chamber === 'senate'

  const thirdReading = bills
    .filter(b => b.reading === 'third')
    .sort((a, b) => (b.votePassed !== null ? 1 : 0) - (a.votePassed !== null ? 1 : 0))
  const secondReading = bills.filter(b => b.reading === 'second')
  const generalOrders = bills.filter(b => b.reading === 'general')

  const hasThird   = thirdReading.length > 0
  const hasSecond  = secondReading.length > 0
  const hasGeneral = generalOrders.length > 0

  return (
    <div className="flex flex-col">
      <div className={`px-4 py-2.5 rounded-t-lg flex items-center gap-2 ${isSenate ? 'bg-blue-600' : 'bg-amber-500'}`}>
        <span className="text-xs font-extrabold tracking-widest text-white uppercase">
          {isSenate ? 'Senate' : 'House'}
        </span>
        {bills.length > 0 && (
          <span className="ml-auto text-[10px] font-semibold text-white/70">
            {bills.length} bill{bills.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className={`border-x border-b rounded-b-lg p-3 flex-1 ${isSenate ? 'border-blue-100' : 'border-amber-100'}`}>
        {bills.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-6 text-center">No bills scheduled.</p>
        ) : (
          <div className="space-y-1">

            {hasThird && (
              <details className="group">
                <summary className="list-none marker:hidden [&::-webkit-details-marker]:hidden cursor-pointer">
                  <div className={`flex items-center gap-1.5 py-2 px-2 rounded-lg transition-colors ${isSenate ? 'hover:bg-blue-50' : 'hover:bg-amber-50'}`}>
                    <span
                      className={`text-xs font-extrabold tracking-widest uppercase shrink-0 ${isSenate ? 'text-blue-600' : 'text-amber-600'}`}
                      title="Third Reading — final floor vote on whether to pass the bill"
                    >
                      <span className="group-open:hidden">▶</span>
                      <span className="hidden group-open:inline">▼</span>
                      {' '}Third Reading
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${isSenate ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                      {thirdReading.length}
                    </span>
                    <span className="group-open:hidden flex items-center gap-1 flex-wrap overflow-hidden">
                      {thirdReading.slice(0, 4).map(b => (
                        <span key={b.billNumber} className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          {b.rawNumber}
                        </span>
                      ))}
                      {thirdReading.length > 4 && (
                        <span className="text-[10px] text-slate-400">+{thirdReading.length - 4}</span>
                      )}
                    </span>
                  </div>
                </summary>
                <div className="space-y-2 pb-1">
                  {thirdReading.map(b => (
                    <FloorBillCard key={b.billNumber} bill={b} year={year} />
                  ))}
                </div>
              </details>
            )}

            {hasSecond && (
              <details className="group">
                <summary className="list-none marker:hidden [&::-webkit-details-marker]:hidden cursor-pointer">
                  <div className={`flex items-center gap-1.5 py-2 ${hasThird ? 'border-t border-slate-100' : 'pt-1'}`}>
                    <span
                      className="text-[10px] font-bold tracking-widest text-slate-500 uppercase group-open:text-slate-700"
                      title="Second Reading — bills introduced for floor consideration or amendment"
                    >
                      <span className="group-open:hidden">▶</span>
                      <span className="hidden group-open:inline">▼</span>
                      {' '}Second Reading ({secondReading.length})
                    </span>
                  </div>
                </summary>
                <div className="space-y-2 pb-1">
                  {secondReading.map(b => (
                    <FloorBillCard key={b.billNumber} bill={b} year={year} />
                  ))}
                </div>
              </details>
            )}

            {hasGeneral && (
              <details className="group">
                <summary className="list-none marker:hidden [&::-webkit-details-marker]:hidden cursor-pointer">
                  <div className={`flex items-center gap-1.5 py-2 ${(hasThird || hasSecond) ? 'border-t border-slate-100' : ''}`}>
                    <span
                      className="text-[10px] font-bold tracking-widest text-slate-500 uppercase group-open:text-slate-700"
                      title="General Orders — bills debated and amended in committee of the whole; typically precede a final vote"
                    >
                      <span className="group-open:hidden">▶</span>
                      <span className="hidden group-open:inline">▼</span>
                      {' '}General Orders ({generalOrders.length})
                    </span>
                  </div>
                </summary>
                <div className="space-y-2 pb-1">
                  {generalOrders.map(b => (
                    <FloorBillCard key={b.billNumber} bill={b} year={year} />
                  ))}
                </div>
              </details>
            )}

          </div>
        )}
      </div>
    </div>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────
function FloorSkeleton() {
  return (
    <div>
      <div className="flex items-center gap-3 border-b-2 border-amber-500 bg-[#1e293b] -mx-4 px-4 py-3 rounded-t-xl mb-6">
        <span className="text-xs font-extrabold tracking-widest text-amber-400">FLOOR TODAY</span>
        <div className="animate-pulse ml-2 h-4 w-16 bg-slate-600 rounded" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {(['senate', 'house'] as const).map(c => (
          <div key={c} className="rounded-xl overflow-hidden">
            <div className={`px-4 py-2.5 ${c === 'senate' ? 'bg-blue-600' : 'bg-amber-500'}`}>
              <span className="text-xs font-extrabold tracking-widest text-white uppercase">{c}</span>
            </div>
            <div className={`border-x border-b rounded-b-lg p-3 space-y-2 ${c === 'senate' ? 'border-blue-100' : 'border-amber-100'}`}>
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse bg-slate-100 rounded-lg h-16" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────
export default function FloorCalendarSection({ year }: { year: number }) {
  const [calendar, setCalendar] = useState<FloorCalendar | null>(null)

  useEffect(() => {
    fetch('/api/floor-calendar')
      .then(r => r.json())
      .then(setCalendar)
      .catch(() => setCalendar({ senate: [], house: [], date: '', legislativeDay: null }))
  }, [])

  if (!calendar) return <FloorSkeleton />

  const hasFloor   = calendar.senate.length > 0 || calendar.house.length > 0
  const thirdCount = [...calendar.senate, ...calendar.house].filter(b => b.reading === 'third').length

  if (!hasFloor) return null

  return (
    <div>
      <div className="flex items-center gap-3 border-b-2 border-amber-500 bg-[#1e293b] -mx-4 px-4 py-3 rounded-t-xl mb-6">
        <span className="text-xs font-extrabold tracking-widest text-amber-400">FLOOR TODAY</span>
        {thirdCount > 0 && (
          <span className="text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5 font-bold">
            {thirdCount} voting
          </span>
        )}
        <Link href={`/bills?year=${year}`} className="ml-auto text-xs text-slate-400 hover:text-amber-400 transition-colors shrink-0">
          View all →
        </Link>
      </div>

      {calendar.date && (
        <p className="text-xs text-slate-400 mb-4">
          {calendar.date}
          {calendar.legislativeDay && (
            <span className="ml-2 text-slate-500">· Day {calendar.legislativeDay}</span>
          )}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <ChamberColumn chamber="senate" bills={calendar.senate} year={year} />
        <ChamberColumn chamber="house"  bills={calendar.house}  year={year} />
      </div>
    </div>
  )
}
