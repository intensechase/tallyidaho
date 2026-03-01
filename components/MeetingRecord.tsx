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
}

interface Props {
  meetings: MeetingRow[]
  year: number
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

function trimAgendaLines(text: string): string[] {
  const lines = text.split('\n')

  // Start after idahoptv.org link (fallback: after "SUBJECT DESCRIPTION PRESENTER")
  let startIdx = 0
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('idahoptv.org')) { startIdx = i + 1; break }
    if (/SUBJECT\s+DESCRIPTION\s+PRESENTER/i.test(lines[i])) { startIdx = i + 1; break }
  }

  // Stop before "If you have written testimony"
  let endIdx = lines.length
  for (let i = startIdx; i < lines.length; i++) {
    if (/if you have written testimony/i.test(lines[i])) { endIdx = i; break }
  }

  return lines
    .slice(startIdx, endIdx)
    .filter(l => !/^SUBJECT\s+DESCRIPTION\s+PRESENTER/i.test(l.trim()))
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

// Match a bill number at the start of a line (e.g. "H 1342", "HB 342", "SB 10")
// Excludes RS items (Research Services)
const BILL_LINE_RE = /^([A-Z]{1,2})\s+(\d{1,4})\b/

function AgendaContent({ text, year }: { text: string; year: number }) {
  const lines = trimAgendaLines(text)

  return (
    <div className="mt-2 bg-white border border-amber-200 rounded-xl p-4 max-h-[500px] overflow-y-auto">
      <div className="font-mono text-[11px] leading-relaxed">
        {lines.map((line, idx) => {
          const m = line.match(BILL_LINE_RE)
          if (m && m[1].toUpperCase() !== 'RS') {
            const normalized = normalizeBillNum(`${m[1]} ${m[2]}`)
            const rest = line.slice(m[0].length)
            return (
              <div key={idx} className="whitespace-pre">
                <Link
                  href={`/bills/${year}/${normalized.toLowerCase()}`}
                  className="text-amber-600 font-bold hover:underline"
                >
                  {m[0]}
                </Link>
                <span className="text-slate-700">{rest}</span>
              </div>
            )
          }
          return (
            <div key={idx} className="whitespace-pre text-slate-600">
              {line || '\u00a0'}
            </div>
          )
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

export default function MeetingRecord({ meetings, year }: Props) {
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

        const hasAgenda  = !isWillNotMeet && !!meeting.agenda_url
        const hasMinutes = !isWillNotMeet && !!meeting.minutes_url

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
                      <span className="text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                        Minutes Available
                      </span>
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

                {/* Expand toggles — below date row, same style as bill text */}
                {(hasAgenda || hasMinutes) && (
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#1e293b]">
                    {hasAgenda && (
                      <ExpandToggle
                        open={isAgendaOpen}
                        onToggle={() => toggleAgenda(meeting)}
                        label="agenda"
                      />
                    )}
                    {hasMinutes && (
                      <ExpandToggle
                        open={isMinutesOpen}
                        onToggle={() => toggleMinutes(meeting)}
                        label="minutes"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Expanded panels */}
              {(isAgendaOpen || isMinutesOpen) && (
                <div className="px-5 pb-5 space-y-4">
                  {isAgendaOpen && (
                    <div>
                      {agendaLoading ? (
                        <p className="text-xs text-slate-400 animate-pulse mt-2">Loading agenda…</p>
                      ) : agendaText ? (
                        <AgendaContent text={agendaText} year={year} />
                      ) : (
                        <p className="text-xs text-slate-400 mt-2">Agenda not available.</p>
                      )}
                    </div>
                  )}
                  {isMinutesOpen && (
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
