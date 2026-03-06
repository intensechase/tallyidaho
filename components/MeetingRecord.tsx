'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Play } from 'lucide-react'

export interface MeetingRow {
  id: string
  date: string           // ISO "2026-01-22"
  time: string | null    // "8:00 AM"
  room: string | null
  status: string         // 'met' | 'will_not_meet' | 'scheduled'
  agenda_url: string | null
  minutes_url: string | null
  video_url: string | null
  agenda_text: string | null
  minutes_text: string | null
}

interface Props {
  meetings: MeetingRow[]
  year: number
  rsToBill?: Record<string, string>  // RS number → bill_number, e.g. "RS 22456" → "H0234"
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeBillNum(raw: string): string {
  const m = raw.trim().match(/^([A-Z]{1,4})\s*(\d+)$/)
  if (!m) return raw.replace(/\s+/g, '')
  const [, prefix, num] = m
  return prefix.length === 1
    ? prefix + num.padStart(4, '0')
    : prefix + num.padStart(3, '0')
}

interface AgendaItem {
  type: 'bill' | 'rs' | 'text'
  content: string
  description?: string
  normalized?: string
}

function parseAgendaItems(text: string): AgendaItem[] {
  const lines = text.split('\n')

  // ── Trim header ──────────────────────────────────────────────────────────
  let startIdx = 0
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('idahoptv.org')) { startIdx = i + 1; break }
    if (/SUBJECT\s+DESCRIPTION\s+PRESENTER/i.test(lines[i])) { startIdx = i + 1; break }
  }

  // ── Trim footer ──────────────────────────────────────────────────────────
  let endIdx = lines.length
  for (let i = startIdx; i < lines.length; i++) {
    if (/if you have written testimony/i.test(lines[i])) { endIdx = i; break }
  }

  // ── Regex patterns ───────────────────────────────────────────────────────
  // \s* instead of \s+ to catch "S1342" (no space from PDF extraction)
  const BILL_RE      = /^([A-Z]{1,4})\s*(\d{1,4})\b/
  const RS_RE        = /^RS\s+\d{4,6}/i
  const BOILERPLATE  = /public testimony|register to testify|if you have written|written testimony|disclaimer/i
  const PRESENTER    = /^(Chairman|Chairwoman|Representative|Senator|Rep\.|Sen\.)\s+\S/i
  const PHONE        = /^\(\d{3}\)\s*\d{3}-\d{4}/
  const COL_HEADER   = /^SUBJECT\s+DESCRIPTION\s+PRESENTER/i

  const filtered = lines
    .slice(startIdx, endIdx)
    .map(l => l.trim())
    .filter(l => l.length > 1 && !COL_HEADER.test(l))

  const result: AgendaItem[] = []

  for (const line of filtered) {
    if (BOILERPLATE.test(line)) continue
    if (PHONE.test(line)) continue
    if (PRESENTER.test(line)) continue  // presenter column — implied by committee context

    if (RS_RE.test(line)) {
      result.push({ type: 'rs', content: line })
    } else {
      const bm = line.match(BILL_RE)
      if (bm) {
        const descInline = line.replace(/^[A-Z]{1,4}\s*\d+\s*[-–—]?\s*/i, '').trim()
        result.push({
          type: 'bill',
          content: line,
          normalized: normalizeBillNum(`${bm[1]} ${bm[2]}`),
          description: descInline || undefined,
        })
      } else {
        // Check if this is a description continuation of the previous bill
        const prev = result[result.length - 1]
        if (prev?.type === 'bill') {
          prev.description = prev.description ? `${prev.description} ${line}` : line
        } else {
          result.push({ type: 'text', content: line })
        }
      }
    }
  }

  return result
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// ── Expand toggle (same style as bill text) ───────────────────────────────────

function ExpandToggle({
  open,
  onToggle,
  label,
}: {
  open: boolean
  onToggle: () => void
  label: string
}) {
  return (
    <button
      onClick={onToggle}
      className="text-xs text-amber-400 hover:underline inline-flex items-center gap-1"
    >
      {open ? `▼ Hide ${label}` : `▶ Show ${label}`}
    </button>
  )
}

// ── Agenda items renderer ─────────────────────────────────────────────────────

function AgendaContent({ text, year, rsToBill = {} }: { text: string; year: number; rsToBill?: Record<string, string> }) {
  return (
    <div className="mt-2 bg-white border border-amber-200 rounded-xl p-4 max-h-[500px] overflow-y-auto">
      <div className="space-y-2">
        {parseAgendaItems(text).map((item, idx) => {
          if (item.type === 'bill') {
            const slug = item.normalized!.toLowerCase()
            return (
              <div key={idx} className="flex items-start gap-2">
                <Link
                  href={`/bills/${year}/${slug}`}
                  className="shrink-0 text-xs font-extrabold text-amber-600 bg-amber-50 border border-amber-200 hover:bg-amber-100 px-2 py-0.5 rounded-full transition-colors"
                >
                  {item.normalized}
                </Link>
                {item.description && (
                  <span className="text-xs text-slate-600 pt-0.5 leading-snug">
                    {item.description}
                  </span>
                )}
              </div>
            )
          }

          if (item.type === 'rs') {
            const rsNum  = item.content.match(/^RS\s+\d+/i)?.[0]?.trim() ?? ''
            const rsDesc = item.content.replace(/^RS\s+\d+\s*[-–—]?\s*/i, '').trim()
            const linkedBill = rsToBill[rsNum]

            return (
              <div key={idx} className="flex items-start gap-2">
                {linkedBill ? (
                  <Link
                    href={`/bills/${year}/${linkedBill.toLowerCase()}`}
                    className="shrink-0 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 hover:bg-amber-100 px-2 py-0.5 rounded-full transition-colors"
                    title={`Became ${linkedBill}`}
                  >
                    {rsNum} → {linkedBill}
                  </Link>
                ) : (
                  <span className="shrink-0 text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                    {rsNum}
                  </span>
                )}
                {rsDesc && (
                  <span className="text-xs text-slate-500 pt-0.5 leading-snug">{rsDesc}</span>
                )}
              </div>
            )
          }

          return item.content.length > 3
            ? <p key={idx} className="text-xs text-slate-400 leading-relaxed">{item.content}</p>
            : null
        })}
      </div>
    </div>
  )
}

function MinutesContent({ text }: { text: string }) {
  return (
    <div className="mt-2 bg-white border border-amber-200 rounded-xl p-4 max-h-[500px] overflow-y-auto">
      <pre className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap font-mono">
        {text}
      </pre>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MeetingRecord({ meetings, year, rsToBill = {} }: Props) {
  const [agendaOpen, setAgendaOpen]     = useState<Record<string, boolean>>({})
  const [minutesOpen, setMinutesOpen]   = useState<Record<string, boolean>>({})
  const [loadingKey, setLoadingKey]     = useState<string | null>(null)
  const [textCache, setTextCache]       = useState<Record<string, string>>({})

  function cacheKey(id: string, type: 'agenda' | 'minutes') {
    return `${id}:${type}`
  }

  function getCached(id: string, type: 'agenda' | 'minutes'): string | null {
    return textCache[cacheKey(id, type)] ?? null
  }

  async function fetchText(id: string, type: 'agenda' | 'minutes') {
    const key = cacheKey(id, type)
    if (textCache[key]) return
    setLoadingKey(key)
    try {
      const res = await fetch(`/api/committee-meeting/${id}?type=${type}`)
      if (res.ok) {
        const data = await res.json()
        if (data.text) setTextCache(prev => ({ ...prev, [key]: data.text }))
      }
    } finally {
      setLoadingKey(null)
    }
  }

  async function toggleAgenda(meeting: MeetingRow) {
    const next = !agendaOpen[meeting.id]
    setAgendaOpen(prev => ({ ...prev, [meeting.id]: next }))
    if (next) {
      const cached = meeting.agenda_text ?? getCached(meeting.id, 'agenda')
      if (!cached && meeting.agenda_url) await fetchText(meeting.id, 'agenda')
    }
  }

  async function toggleMinutes(meeting: MeetingRow) {
    const next = !minutesOpen[meeting.id]
    setMinutesOpen(prev => ({ ...prev, [meeting.id]: next }))
    if (next) {
      const cached = getCached(meeting.id, 'minutes')
      if (!cached && meeting.minutes_url) await fetchText(meeting.id, 'minutes')
    }
  }

  function getAgendaText(meeting: MeetingRow): string | null {
    return meeting.agenda_text ?? getCached(meeting.id, 'agenda') ?? null
  }

  function getMinutesText(meeting: MeetingRow): string | null {
    return getCached(meeting.id, 'minutes') ?? null
  }

  return (
    <div className="relative pl-7 border-l-2 border-slate-200 space-y-4">
      {meetings.map((meeting) => {
        const isWillNotMeet = meeting.status === 'will_not_meet'
        const isScheduled   = meeting.status === 'scheduled'

        const dotColor = isWillNotMeet ? 'bg-slate-300'
          : isScheduled ? 'bg-amber-400'
          : 'bg-emerald-500'

        const isAgendaOpen   = !!agendaOpen[meeting.id]
        const isMinutesOpen  = !!minutesOpen[meeting.id]
        const agendaLoading  = loadingKey === cacheKey(meeting.id, 'agenda')
        const minutesLoading = loadingKey === cacheKey(meeting.id, 'minutes')
        const agendaText     = getAgendaText(meeting)
        const minutesText    = getMinutesText(meeting)

        const hasAgenda            = !isWillNotMeet && !!meeting.agenda_url
        const hasMinutes           = !isWillNotMeet && !!meeting.minutes_url
        const hasPreloadedAgenda   = hasAgenda && !!meeting.agenda_text
        const hasPreloadedMinutes  = hasMinutes && !!meeting.minutes_text

        return (
          <div key={meeting.id} className="relative">
            {/* Timeline dot */}
            <div className={`absolute -left-[37px] top-4 w-3.5 h-3.5 rounded-full border-2 border-white ${dotColor}`} />

            <div className={`rounded-xl overflow-hidden border ${
              isWillNotMeet
                ? 'bg-slate-50 border-slate-200 opacity-70'
                : 'bg-[#0f172a] border-[#1e293b]'
            }`}>
              {/* Card header */}
              <div className="px-5 py-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  {/* Left: date + time + room */}
                  <div>
                    <p className={`font-playfair text-lg font-bold leading-tight ${
                      isWillNotMeet ? 'text-slate-500' : 'text-white'
                    }`}>
                      {formatDate(meeting.date)}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap text-xs text-slate-400">
                      {meeting.time && <span>{meeting.time}</span>}
                      {meeting.time && meeting.room && <span>·</span>}
                      {meeting.room && <span>Room {meeting.room}</span>}
                    </div>
                  </div>

                  {/* Right: status badge + recording */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {isWillNotMeet ? (
                      <span className="text-xs font-bold bg-slate-200 text-slate-500 px-2.5 py-1 rounded-full">
                        Will Not Meet
                      </span>
                    ) : isScheduled ? (
                      <span className="text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-full">
                        Scheduled
                      </span>
                    ) : hasMinutes ? (
                      <a
                        href={meeting.minutes_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 px-2.5 py-1 rounded-full transition-colors"
                      >
                        Minutes Available
                      </a>
                    ) : (
                      <span className="text-xs font-bold bg-slate-700 text-slate-400 px-2.5 py-1 rounded-full">
                        Met
                      </span>
                    )}

                    {meeting.video_url && (
                      <a
                        href={meeting.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-full transition-colors"
                      >
                        <Play className="w-3 h-3" />
                        Download Video
                      </a>
                    )}
                  </div>
                </div>

                {/* Expand toggles — JS-only items (agenda/minutes needing fetch) */}
                {((!hasPreloadedAgenda && hasAgenda) || (!hasPreloadedMinutes && hasMinutes)) && (
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#1e293b]">
                    {!hasPreloadedAgenda && hasAgenda && (
                      <ExpandToggle
                        open={isAgendaOpen}
                        onToggle={() => toggleAgenda(meeting)}
                        label="agenda"
                      />
                    )}
                    {!hasPreloadedMinutes && hasMinutes && (
                      <ExpandToggle
                        open={isMinutesOpen}
                        onToggle={() => toggleMinutes(meeting)}
                        label="minutes"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Agenda via native <details> when pre-loaded — always in DOM for search indexing */}
              {hasPreloadedAgenda && (
                <details className="group border-t border-[#1e293b]">
                  <summary className="list-none marker:hidden [&::-webkit-details-marker]:hidden cursor-pointer px-5 py-3 text-xs text-amber-400 hover:underline inline-flex items-center gap-1">
                    <span className="group-open:hidden">▶ Show agenda</span>
                    <span className="hidden group-open:inline">▼ Hide agenda</span>
                  </summary>
                  <div className="px-5 pb-5">
                    <AgendaContent text={meeting.agenda_text!} year={year} rsToBill={rsToBill} />
                  </div>
                </details>
              )}

              {/* Minutes via native <details> when pre-loaded — always in DOM for search indexing */}
              {hasPreloadedMinutes && (
                <details className="group border-t border-[#1e293b]">
                  <summary className="list-none marker:hidden [&::-webkit-details-marker]:hidden cursor-pointer px-5 py-3 text-xs text-amber-400 hover:underline inline-flex items-center gap-1">
                    <span className="group-open:hidden">▶ Show minutes</span>
                    <span className="hidden group-open:inline">▼ Hide minutes</span>
                  </summary>
                  <div className="px-5 pb-5">
                    <MinutesContent text={meeting.minutes_text!} />
                  </div>
                </details>
              )}

              {/* JS-fetched panels (agenda/minutes without pre-loaded text) */}
              {((!hasPreloadedAgenda && isAgendaOpen) || (!hasPreloadedMinutes && isMinutesOpen)) && (
                <div className="px-5 pb-5 space-y-4">
                  {!hasPreloadedAgenda && isAgendaOpen && (
                    <div>
                      {agendaLoading ? (
                        <p className="text-xs text-slate-400 animate-pulse mt-2">Loading agenda…</p>
                      ) : agendaText ? (
                        <AgendaContent text={agendaText} year={year} rsToBill={rsToBill} />
                      ) : (
                        <p className="text-xs text-slate-400 mt-2">Agenda not available.</p>
                      )}
                    </div>
                  )}
                  {!hasPreloadedMinutes && isMinutesOpen && (
                    <div>
                      {minutesLoading ? (
                        <p className="text-xs text-slate-400 animate-pulse mt-2">Loading minutes…</p>
                      ) : minutesText ? (
                        <MinutesContent text={minutesText} />
                      ) : (
                        <p className="text-xs text-slate-400 mt-2">Minutes not available.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
