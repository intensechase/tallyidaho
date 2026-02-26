'use client'

import { useState } from 'react'
import Link from 'next/link'
import { legislatorSlug } from '@/lib/slugify'
import type { FloorBill, FloorCalendar } from '@/lib/floor-calendar'
import type { CommitteeAgenda, AgendaCalendar } from '@/lib/committee-agenda'

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

// ── Floor calendar bill card ───────────────────────────────────────────
function FloorBillCard({ bill, year }: { bill: FloorBill; year: number }) {
  const isThird = bill.reading === 'third'
  const hasResult = bill.votePassed !== null
  const stateUrl = `https://legislature.idaho.gov/sessioninfo/${year}/legislation/${bill.billNumber}/`

  // Border: green if passed, red if failed, else reading-based default
  const borderClass = hasResult
    ? bill.votePassed
      ? 'border-emerald-300 hover:border-emerald-400'
      : 'border-red-300 hover:border-red-400'
    : isThird
      ? 'border-red-200 hover:border-red-300'
      : 'border-slate-200 hover:border-amber-300'

  const inner = (
    <div className={`bg-white border rounded-xl p-3.5 hover:shadow-sm transition-all h-full flex flex-col ${borderClass}`}>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-xs font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
          {bill.rawNumber}
        </span>
        {bill.topic && (
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide truncate flex-1">
            {bill.topic}
          </span>
        )}
        {!bill.href && <span className="text-[10px] text-slate-300 shrink-0 ml-auto">↗</span>}
      </div>
      <p className="text-xs text-slate-700 leading-snug flex-1 line-clamp-3">
        {bill.description || '—'}
      </p>
      {bill.floorSponsor && (
        <p className="text-[10px] text-slate-400 mt-2 truncate">
          👤 {bill.floorSponsor}{bill.floorDistrict ? ` · Dist. ${bill.floorDistrict}` : ''}
        </p>
      )}
      {/* Vote result banner */}
      {hasResult && (
        <div className={`mt-2 pt-2 border-t flex items-center gap-2 ${
          bill.votePassed ? 'border-emerald-100' : 'border-red-100'
        }`}>
          <span className={`text-xs font-black ${bill.votePassed ? 'text-emerald-600' : 'text-red-500'}`}>
            {bill.votePassed ? '✓ PASSED' : '✗ FAILED'}
          </span>
          <span className="text-xs text-slate-400 tabular-nums">
            {bill.voteYea}–{bill.voteNay}
          </span>
        </div>
      )}
    </div>
  )

  if (bill.href) return <Link href={bill.href} className="block h-full">{inner}</Link>
  return <a href={stateUrl} target="_blank" rel="noopener noreferrer" className="block h-full">{inner}</a>
}

// ── Committee agenda card ─────────────────────────────────────────────
function CommitteeCard({ cmte }: { cmte: CommitteeAgenda }) {
  const chamberColor = cmte.chamber === 'senate'
    ? 'text-blue-600 bg-blue-50 border-blue-200'
    : cmte.chamber === 'joint'
      ? 'text-purple-600 bg-purple-50 border-purple-200'
      : 'text-amber-600 bg-amber-50 border-amber-200'

  const rsItems   = cmte.items.filter(i => i.type === 'rs')
  const billItems = cmte.items.filter(i => i.type === 'bill')

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className={`text-[9px] font-bold border px-1.5 py-0.5 rounded uppercase ${chamberColor}`}>
              {cmte.chamber}
            </span>
            <span className="text-xs text-slate-500">{cmte.time} · Room {cmte.room}</span>
          </div>
          <p className="text-sm font-bold text-slate-800 leading-snug">{cmte.name}</p>
        </div>
        {cmte.videoUrl && (
          <a
            href={cmte.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded hover:bg-red-100 transition-colors shrink-0 whitespace-nowrap"
          >
            ▶ Video
          </a>
        )}
      </div>

      {/* RS items */}
      {rsItems.length > 0 && (
        <div className="px-4 py-2">
          <p className="text-[9px] font-bold tracking-widest text-slate-400 uppercase mb-1.5">
            RS — Draft Bills ({rsItems.length})
          </p>
          <div className="space-y-1.5">
            {rsItems.map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                  {item.number}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-700 leading-snug">{item.topic}</p>
                  {item.presenter && (
                    <p className="text-[10px] text-slate-400 mt-0.5">{item.presenter}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bill items */}
      {billItems.length > 0 && (
        <div className={`px-4 py-2 ${rsItems.length > 0 ? 'border-t border-slate-100' : ''}`}>
          <p className="text-[9px] font-bold tracking-widest text-slate-400 uppercase mb-1.5">
            Bills in Hearing ({billItems.length})
          </p>
          <div className="space-y-1.5">
            {billItems.map((item, i) => {
              const inner = (
                <div key={i} className="flex items-start gap-2 group">
                  <span className="text-[10px] font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                    {item.number}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-700 group-hover:text-amber-700 transition-colors leading-snug line-clamp-2">
                      {item.topic}
                    </p>
                    {item.presenter && (
                      <p className="text-[10px] text-slate-400 mt-0.5">{item.presenter}</p>
                    )}
                  </div>
                </div>
              )
              return item.href
                ? <Link key={i} href={item.href}>{inner}</Link>
                : <div key={i}>{inner}</div>
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main tab component ────────────────────────────────────────────────
interface Props {
  controversialBills: Bill[]
  recentBills: any[]
  year: number
  floorCalendar: FloorCalendar
  committeeAgenda: AgendaCalendar
}

export default function HomepageTabs({ controversialBills, recentBills, year, floorCalendar, committeeAgenda }: Props) {
  const hasFloor = floorCalendar.senate.length > 0 || floorCalendar.house.length > 0
  const hasCommittees = committeeAgenda.committees.length > 0
  const [tab, setTab] = useState<'floor' | 'committee' | 'controversial' | 'recent'>(
    hasFloor ? 'floor' : hasCommittees ? 'committee' : 'controversial'
  )

  const thirdCount = [...floorCalendar.senate, ...floorCalendar.house].filter(b => b.reading === 'third').length
  const rsCount = committeeAgenda.committees.reduce((n, c) => n + c.items.filter(i => i.type === 'rs').length, 0)

  const viewAllHref =
    tab === 'floor' ? `/bills?year=${year}` :
    tab === 'controversial' ? `/bills?controversial=true&year=${year}` :
    `/bills?year=${year}`

  return (
    <section className="max-w-7xl mx-auto px-4 py-8">
      {/* Tab bar */}
      <div className="flex items-center gap-2 sm:gap-4 border-b-2 border-amber-500 mb-6 bg-[#1e293b] -mx-4 px-4 rounded-t-xl">
        {hasFloor && (
          <button
            onClick={() => setTab('floor')}
            className={`text-xs font-extrabold tracking-widest py-3 transition-colors border-b-2 -mb-px whitespace-nowrap px-1 ${
              tab === 'floor' ? 'text-amber-400 border-amber-400' : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            🏛️ FLOOR TODAY
            {thirdCount > 0 && (
              <span className="ml-1.5 text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5 font-bold">
                {thirdCount} voting
              </span>
            )}
          </button>
        )}
        {hasCommittees && (
          <button
            onClick={() => setTab('committee')}
            className={`text-xs font-extrabold tracking-widest py-3 transition-colors border-b-2 -mb-px whitespace-nowrap px-1 ${
              tab === 'committee' ? 'text-amber-400 border-amber-400' : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            📋 IN COMMITTEE
            {rsCount > 0 && (
              <span className="ml-1.5 text-[10px] bg-slate-500 text-white rounded-full px-1.5 py-0.5 font-bold">
                {rsCount} RS
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

      {/* Floor Today: third reading (voting) + second reading */}
      {tab === 'floor' && (
        <div>
          {floorCalendar.date && (
            <p className="text-xs text-slate-400 mb-4">
              {floorCalendar.date}
              {floorCalendar.legislativeDay && (
                <span className="ml-2 text-slate-500">· Day {floorCalendar.legislativeDay}</span>
              )}
            </p>
          )}

          {/* Voting Today — third reading */}
          {thirdCount > 0 && (
            <div className="mb-6">
              <h3 className="text-xl font-black text-red-500 mb-3 flex items-center gap-2">
                🗳️ Voting Today — Third Reading
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{thirdCount}</span>
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {floorCalendar.senate.filter(b => b.reading === 'third').length > 0 && (
                  <div>
                    <p className="text-xs font-bold tracking-widest text-blue-600 mb-2 uppercase">Senate</p>
                    <div className="space-y-2">
                      {floorCalendar.senate.filter(b => b.reading === 'third').map(b => (
                        <FloorBillCard key={b.billNumber} bill={b} year={year} />
                      ))}
                    </div>
                  </div>
                )}
                {floorCalendar.house.filter(b => b.reading === 'third').length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold tracking-widest text-amber-600 mb-2 uppercase">House</p>
                    <div className="space-y-2">
                      {floorCalendar.house.filter(b => b.reading === 'third').map(b => (
                        <FloorBillCard key={b.billNumber} bill={b} year={year} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Second Reading */}
          {[...floorCalendar.senate, ...floorCalendar.house].filter(b => b.reading === 'second').length > 0 && (
            <div>
              <h3 className="text-xl font-black text-slate-600 mb-3">Second Reading — Cleared Committee</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {floorCalendar.senate.filter(b => b.reading === 'second').length > 0 && (
                  <div>
                    <p className="text-xs font-bold tracking-widest text-blue-600 mb-2 uppercase">Senate</p>
                    <div className="space-y-2">
                      {floorCalendar.senate.filter(b => b.reading === 'second').map(b => (
                        <FloorBillCard key={b.billNumber} bill={b} year={year} />
                      ))}
                    </div>
                  </div>
                )}
                {floorCalendar.house.filter(b => b.reading === 'second').length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold tracking-widest text-amber-600 mb-2 uppercase">House</p>
                    <div className="space-y-2">
                      {floorCalendar.house.filter(b => b.reading === 'second').map(b => (
                        <FloorBillCard key={b.billNumber} bill={b} year={year} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!hasFloor && (
            <p className="text-center text-slate-400 py-8 text-sm">No floor calendar found for today.</p>
          )}
        </div>
      )}

      {/* In Committee: RS items + bills grouped by committee */}
      {tab === 'committee' && (
        <div>
          {committeeAgenda.date && (
            <p className="text-xs text-slate-400 mb-4">{committeeAgenda.date}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {committeeAgenda.committees.map(cmte => (
              <CommitteeCard key={`${cmte.code}-${cmte.time}`} cmte={cmte} />
            ))}
          </div>
          {!hasCommittees && (
            <p className="text-center text-slate-400 py-8 text-sm">No committee agendas found for today.</p>
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
