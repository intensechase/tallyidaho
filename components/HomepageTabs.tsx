'use client'

import { useState } from 'react'
import Link from 'next/link'
import { legislatorSlug } from '@/lib/slugify'
import type { DailyBill, DailyIntroductions } from '@/lib/daily-introductions'

type Legislator = {
  name: string
  party: string
  role: string
  district: string
  chamber: string
}

type Sponsor = {
  sponsor_order: number
  sponsor_type: string
  legislators: Legislator | null
}

type RollCall = {
  yea_count: number
  nay_count: number
  passed: boolean
  vote_margin?: number
  is_party_line?: boolean
}

type Bill = {
  id: number
  bill_number: string
  title: string
  description?: string
  plain_summary?: string
  chamber: string
  is_controversial: boolean
  controversy_reason: string | null
  completed: boolean
  last_action: string | null
  state_url?: string
  subjects?: string[]
  bill_sponsors: Sponsor[]
  roll_calls: RollCall[]
}

// ── Expanded card for controversial bills ──────────────────────────────
function ControversialBillCard({ bill, year }: { bill: Bill; year: number }) {
  const sponsors = [...(bill.bill_sponsors || [])]
    .sort((a, b) => a.sponsor_order - b.sponsor_order)
    .filter(s => s.legislators && !s.legislators.name?.includes('Committee'))
    .slice(0, 5)

  const latestRc = bill.roll_calls?.[bill.roll_calls.length - 1]
  const yea = latestRc?.yea_count ?? 0
  const nay = latestRc?.nay_count ?? 0
  const total = yea + nay
  const yeaPct = total > 0 ? Math.round((yea / total) * 100) : 0
  const margin = latestRc?.vote_margin ?? Math.abs(yea - nay)

  const summary = bill.plain_summary || (bill.description !== bill.title ? bill.description : null)

  const accentClass =
    bill.controversy_reason === 'party_line' ? 'bill-card-party-line' : 'bill-card-close-vote'

  return (
    <div className={`card-enter bill-card bg-white border border-slate-200 rounded-xl overflow-hidden ${accentClass}`}>
      <div className="p-5">
        {/* Bill number + controversy badge */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/bills/${year}/${bill.bill_number.toLowerCase()}`}>
              <span className="text-sm font-black text-amber-700 bg-amber-50 border border-amber-300 px-3 py-1 rounded-full hover:bg-amber-100 transition-colors">
                {bill.bill_number}
              </span>
            </Link>
            <span className={`text-sm font-bold px-3 py-1 rounded-full border ${
              bill.controversy_reason === 'party_line'
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-orange-50 text-orange-700 border-orange-200'
            }`}>
              ⚡ {bill.controversy_reason === 'party_line' ? 'PARTY LINE' : 'CLOSE VOTE'}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {bill.completed && (
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                ✓ {bill.last_action?.toLowerCase().includes('law') ? 'Signed' : 'Done'}
              </span>
            )}
            <span className="text-xs text-slate-400 capitalize">{bill.chamber}</span>
          </div>
        </div>

        {/* Title */}
        <Link href={`/bills/${year}/${bill.bill_number.toLowerCase()}`}>
          <h3 className="font-playfair text-lg font-bold text-slate-900 leading-snug mb-3 hover:text-amber-700 transition-colors">
            {bill.title}
          </h3>
        </Link>

        {/* Summary / intent */}
        {summary ? (
          <p className="text-sm text-slate-600 leading-relaxed line-clamp-3 mb-4 border-l-2 border-slate-200 pl-3">
            {summary}
          </p>
        ) : (
          <p className="text-xs text-slate-400 italic mb-4">
            Statement of purpose not yet available.{' '}
            {bill.state_url && (
              <a href={bill.state_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">
                View on Idaho Legislature ↗
              </a>
            )}
          </p>
        )}

        {/* Subject tags */}
        {(bill.subjects?.length ?? 0) > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-4">
            {bill.subjects!.slice(0, 4).map(s => (
              <Link key={s} href={`/bills?subject=${encodeURIComponent(s)}&year=${year}`}>
                <span className="text-xs bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-700 px-2 py-0.5 rounded-full transition-colors cursor-pointer">
                  {s}
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* Vote bar */}
        {latestRc && (
          <div className="mb-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-sm font-bold text-emerald-600 w-14 text-right tabular-nums">{yea} Yea</span>
              <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="vote-bar-fill h-full bg-emerald-500 rounded-full"
                  style={{ '--bar-pct': `${yeaPct}%` } as React.CSSProperties}
                />
              </div>
              <span className="text-sm font-bold text-red-500 w-14 tabular-nums">{nay} Nay</span>
            </div>
            <p className="text-xs text-slate-400 text-center">
              {latestRc.is_party_line ? '⚡ Party-line vote · ' : ''}
              {latestRc.passed ? 'Passed' : 'Failed'}
              {margin > 0 ? ` by ${margin} vote${margin !== 1 ? 's' : ''}` : ''}
            </p>
          </div>
        )}
      </div>

      {/* Sponsors */}
      {sponsors.length > 0 && (
        <div className="border-t border-slate-100 px-5 py-3 bg-slate-50/70">
          <p className="text-xs font-bold tracking-widest text-slate-400 mb-2.5">SPONSORED BY</p>
          <div className="space-y-2">
            {sponsors.map((s, i) => {
              const leg = s.legislators!
              const slug = legislatorSlug(leg.name)
              return (
                <Link key={i} href={`/legislators/${slug}`} className="flex items-center gap-2.5 group">
                  <span className={`party-badge party-${leg.party?.toLowerCase()} shrink-0`}>{leg.party}</span>
                  <span className="text-sm font-semibold text-slate-800 group-hover:text-amber-700 transition-colors">
                    {leg.name}
                  </span>
                  <span className="text-xs text-slate-400">{leg.role} · {leg.district}</span>
                  {i === 0 && (
                    <span className="ml-auto text-xs text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">Primary</span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Footer links */}
      <div className="border-t border-slate-100 px-5 py-3 flex items-center gap-5">
        <Link
          href={`/bills/${year}/${bill.bill_number.toLowerCase()}`}
          className="text-sm font-bold text-amber-700 hover:text-amber-800 transition-colors"
        >
          Full details + all votes →
        </Link>
        {bill.state_url && (
          <a
            href={bill.state_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            Bill text ↗
          </a>
        )}
      </div>
    </div>
  )
}

// ── Compact card for "All Bills" tab ──────────────────────────────────
function CompactBillCard({ bill, year }: { bill: any; year: number }) {
  const sponsor = [...(bill.bill_sponsors || [])]
    .sort((a: any, b: any) => a.sponsor_order - b.sponsor_order)
    .find((s: any) => s.legislators)?.legislators

  const latestRc = bill.roll_calls?.[bill.roll_calls.length - 1]
  const yea = latestRc?.yea_count ?? 0
  const nay = latestRc?.nay_count ?? 0
  const total = yea + nay
  const yeaPct = total > 0 ? Math.round((yea / total) * 100) : 0

  const accentClass =
    bill.controversy_reason === 'party_line' ? 'bill-card-party-line' :
    bill.controversy_reason === 'close_vote'  ? 'bill-card-close-vote' :
    'bill-card-default'

  return (
    <Link href={`/bills/${year}/${bill.bill_number.toLowerCase()}`}>
      <div className={`card-enter bill-card bg-white border border-slate-200 rounded-xl p-4 cursor-pointer ${accentClass}`}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              {bill.bill_number}
            </span>
            {bill.is_controversial && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                bill.controversy_reason === 'party_line' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'
              }`}>
                {bill.controversy_reason === 'party_line' ? 'PARTY LINE' : 'CLOSE VOTE'}
              </span>
            )}
          </div>
          {sponsor?.district && (
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">{sponsor.district}</span>
          )}
        </div>

        <p className="text-sm font-semibold text-slate-800 leading-snug mb-3">{bill.title}</p>

        {latestRc && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-emerald-600 w-12 text-right tabular-nums">{yea} Yea</span>
            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="vote-bar-fill h-full bg-emerald-500 rounded-full"
                style={{ '--bar-pct': `${yeaPct}%` } as React.CSSProperties}
              />
            </div>
            <span className="text-xs font-bold text-red-500 w-10 tabular-nums">{nay} Nay</span>
          </div>
        )}

        {sponsor && <p className="text-xs text-slate-400">{sponsor.name}</p>}
      </div>
    </Link>
  )
}

// ── Daily introduction card ────────────────────────────────────────────
function DailyBillCard({ bill, year }: { bill: DailyBill; year: number }) {
  const isCommittee = /COMMITTEE$/i.test(bill.sponsor)
  const sponsorDisplay = bill.sponsor
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .replace(/\bAnd\b/g, 'and')

  const stateUrl = `https://legislature.idaho.gov/sessioninfo/${year}/legislation/${bill.billNumber}/`
  const href = bill.href || null
  const isExternal = !bill.href

  const inner = (
    <div className="bg-white border border-slate-200 rounded-xl p-3.5 hover:border-amber-300 hover:shadow-sm transition-all h-full flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
          {bill.rawNumber}
        </span>
        {bill.topic && (
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide truncate">
            {bill.topic}
          </span>
        )}
        {isExternal && (
          <span className="ml-auto text-[10px] text-slate-300 shrink-0">↗</span>
        )}
      </div>
      <p className="text-xs text-slate-700 leading-snug flex-1 line-clamp-3">
        {bill.description || '—'}
      </p>
      <p className="text-[10px] text-slate-400 mt-2 truncate">
        {isCommittee ? '📋' : '👤'} {sponsorDisplay}
      </p>
    </div>
  )

  if (href) {
    return <Link href={href} className="block h-full">{inner}</Link>
  }
  return (
    <a href={stateUrl} target="_blank" rel="noopener noreferrer" className="block h-full">
      {inner}
    </a>
  )
}

// ── Failed vote card ───────────────────────────────────────────────────
function FailedBillCard({ bill, year }: { bill: any; year: number }) {
  const yea = bill.roll_call?.yea_count ?? 0
  const nay = bill.roll_call?.nay_count ?? 0
  const total = yea + nay
  const nayPct = total > 0 ? Math.round((nay / total) * 100) : 0

  return (
    <Link href={`/bills/${year}/${bill.bill_number?.toLowerCase()}`} className="block">
      <div className="card-enter bg-white border border-slate-200 rounded-xl p-4 hover:border-red-200 hover:shadow-sm transition-all border-l-4 border-l-red-300">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="text-xs font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
                {bill.bill_number}
              </span>
              <span className="text-xs text-slate-400 capitalize">{bill.chamber}</span>
              {bill.roll_call?.is_party_line && (
                <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">PARTY LINE</span>
              )}
            </div>
            <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">{bill.title}</p>
          </div>
          {total > 0 && (
            <div className="shrink-0 text-right">
              <p className="text-xs font-bold text-emerald-600 tabular-nums">{yea} yea</p>
              <p className="text-xs font-bold text-red-500 tabular-nums">{nay} nay</p>
              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                <div className="h-full bg-red-400 rounded-full" style={{ width: `${nayPct}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

// ── Main tab component ────────────────────────────────────────────────
interface Props {
  controversialBills: Bill[]
  recentBills: any[]
  failedBills: any[]
  year: number
  dailyIntroductions: DailyIntroductions
}

export default function HomepageTabs({ controversialBills, recentBills, failedBills, year, dailyIntroductions }: Props) {
  const hasToday = dailyIntroductions.senate.length > 0 || dailyIntroductions.house.length > 0
  const [tab, setTab] = useState<'today' | 'controversial' | 'failed' | 'recent'>(hasToday ? 'today' : 'controversial')

  const todayCount = dailyIntroductions.senate.length + dailyIntroductions.house.length

  const viewAllHref =
    tab === 'today' ? `/bills?year=${year}` :
    tab === 'controversial' ? `/bills?controversial=true&year=${year}` :
    tab === 'failed' ? `/bills?year=${year}` :
    `/bills?year=${year}`

  return (
    <section className="max-w-7xl mx-auto px-4 py-8">
      {/* Tab bar */}
      <div className="flex items-center gap-1 sm:gap-6 border-b-2 border-amber-500 mb-6 bg-[#1e293b] -mx-4 px-4 rounded-t-xl overflow-x-auto">
        {hasToday && (
          <button
            onClick={() => setTab('today')}
            className={`text-xs font-extrabold tracking-widest py-3 transition-colors border-b-2 -mb-px whitespace-nowrap px-1 ${
              tab === 'today' ? 'text-amber-400 border-amber-400' : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            📋 TODAY'S BILLS
            {todayCount > 0 && (
              <span className="ml-1.5 text-[10px] bg-amber-500 text-white rounded-full px-1.5 py-0.5 font-bold">
                {todayCount}
              </span>
            )}
          </button>
        )}
        <button
          onClick={() => setTab('controversial')}
          className={`text-xs font-extrabold tracking-widest py-3 transition-colors border-b-2 -mb-px whitespace-nowrap px-1 ${
            tab === 'controversial' ? 'text-amber-400 border-amber-400' : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          ⚡ CONTROVERSIAL
        </button>
        {failedBills.length > 0 && (
          <button
            onClick={() => setTab('failed')}
            className={`text-xs font-extrabold tracking-widest py-3 transition-colors border-b-2 -mb-px whitespace-nowrap px-1 ${
              tab === 'failed' ? 'text-red-400 border-red-400' : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            ✕ FAILED
          </button>
        )}
        <button
          onClick={() => setTab('recent')}
          className={`text-xs font-semibold tracking-wide py-3 transition-colors border-b-2 -mb-px whitespace-nowrap px-1 ${
            tab === 'recent' ? 'text-amber-400 border-amber-400' : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          All Bills
        </button>
        <Link
          href={viewAllHref}
          className="ml-auto text-xs text-slate-400 hover:text-amber-400 transition-colors py-3 shrink-0"
        >
          View all →
        </Link>
      </div>

      {/* Today's Bills: senate + house side by side */}
      {tab === 'today' && (
        <div>
          {dailyIntroductions.date && (
            <p className="text-xs text-slate-400 mb-4">
              {dailyIntroductions.date}
              {dailyIntroductions.legislativeDay && (
                <span className="ml-2 text-slate-500">· Day {dailyIntroductions.legislativeDay}</span>
              )}
            </p>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Senate */}
            {dailyIntroductions.senate.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold tracking-widest text-blue-600 mb-3 uppercase">
                  Senate · {dailyIntroductions.senate.length} bill{dailyIntroductions.senate.length !== 1 ? 's' : ''}
                </h3>
                <div className="space-y-2">
                  {dailyIntroductions.senate.map(b => (
                    <DailyBillCard key={b.billNumber} bill={b} year={year} />
                  ))}
                </div>
              </div>
            )}
            {/* House */}
            {dailyIntroductions.house.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold tracking-widest text-amber-600 mb-3 uppercase">
                  House · {dailyIntroductions.house.length} bill{dailyIntroductions.house.length !== 1 ? 's' : ''}
                </h3>
                <div className="space-y-2">
                  {dailyIntroductions.house.map(b => (
                    <DailyBillCard key={b.billNumber} bill={b} year={year} />
                  ))}
                </div>
              </div>
            )}
          </div>
          {!hasToday && (
            <p className="text-center text-slate-400 py-8 text-sm">
              No new bill introductions found for today.
            </p>
          )}
        </div>
      )}

      {/* Controversial: single column expanded cards */}
      {tab === 'controversial' && (
        <div className="space-y-4">
          {controversialBills.map(bill => (
            <ControversialBillCard key={bill.id} bill={bill} year={year} />
          ))}
          {controversialBills.length === 0 && (
            <p className="text-center text-slate-400 py-8 text-sm">No controversial bills found.</p>
          )}
        </div>
      )}

      {/* Failed votes */}
      {tab === 'failed' && (
        <div className="space-y-2">
          {failedBills.map((bill: any) => (
            <FailedBillCard key={bill.id} bill={bill} year={year} />
          ))}
          {failedBills.length === 0 && (
            <p className="text-center text-slate-400 py-8 text-sm">No failed votes found.</p>
          )}
        </div>
      )}

      {/* All Bills: two-column compact cards */}
      {tab === 'recent' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {recentBills.map((bill: any) => (
            <CompactBillCard key={bill.id} bill={bill} year={year} />
          ))}
          {recentBills.length === 0 && (
            <p className="text-center text-slate-400 py-8 text-sm col-span-2">No bills found.</p>
          )}
        </div>
      )}
    </section>
  )
}
