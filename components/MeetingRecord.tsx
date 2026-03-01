'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, Play, FileText } from 'lucide-react'

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

/** Normalize "H 1234" or "HB 12" → canonical bill_number for DB/URL */
function normalizeBillNum(raw: string): string {
  const m = raw.trim().match(/^([A-Z]{1,4})\s*(\d+)$/)
  if (!m) return raw.replace(/\s+/g, '')
  const [, prefix, num] = m
  // Single letter prefix (H/S) pads to 4 digits; multi-letter (HB/SB/HCR) pads to 3
  return prefix.length === 1
    ? prefix + num.padStart(4, '0')
    : prefix + num.padStart(3, '0')
}

/** Parse agenda PDF text into structured display items */
function parseAgendaItems(text: string): Array<{
  type: 'bill' | 'rs' | 'text'
  content: string
  normalized?: string
}> {
  const BILL_RE = /^([A-Z]{1,4})\s+(\d{1,4})\b/
  const RS_RE   = /^RS\s+\d{4,6}/i

  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 1)
    .map(line => {
      if (RS_RE.test(line)) {
        return { type: 'rs' as const, content: line }
      }
      const bm = line.match(BILL_RE)
      if (bm) {
        return {
          type: 'bill' as const,
          content: line,
          normalized: normalizeBillNum(`${bm[1]} ${bm[2]}`),
        }
      }
      return { type: 'text' as const, content: line }
    })
}

function formatDate(dateStr: string): string {
  // Parse as local date (avoid UTC offset shifting the day)
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MeetingRecord({ meetings, year }: Props) {
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [loadingId, setLoadingId]     = useState<string | null>(null)
  const [agendaCache, setAgendaCache] = useState<Record<string, string>>({})

  async function handleExpand(meeting: MeetingRow) {
    // Collapse if already open
    if (expandedId === meeting.id) {
      setExpandedId(null)
      return
    }

    setExpandedId(meeting.id)

    // Already have text — no fetch needed
    if (agendaCache[meeting.id] || meeting.agenda_text) return

    // No agenda URL to fetch
    if (!meeting.agenda_url) return

    setLoadingId(meeting.id)
    try {
      const res = await fetch(`/api/committee-meeting/${meeting.id}?type=agenda`)
      if (res.ok) {
        const data = await res.json()
        if (data.text) {
          setAgendaCache(prev => ({ ...prev, [meeting.id]: data.text }))
        }
      }
    } finally {
      setLoadingId(null)
    }
  }

  function getAgendaText(meeting: MeetingRow): string | null {
    return agendaCache[meeting.id] ?? meeting.agenda_text ?? null
  }

  return (
    <div className="relative pl-7 border-l-2 border-slate-200 space-y-4">
      {meetings.map((meeting) => {
        const isExpanded    = expandedId === meeting.id
        const isLoading     = loadingId === meeting.id
        const agendaText    = getAgendaText(meeting)
        const isWillNotMeet = meeting.status === 'will_not_meet'
        const isScheduled   = meeting.status === 'scheduled'
        const canExpand     = !isWillNotMeet && !!meeting.agenda_url

        const dotColor = isWillNotMeet
          ? 'bg-slate-300'
          : isScheduled
          ? 'bg-amber-400'
          : 'bg-emerald-500'

        return (
          <div key={meeting.id} className="relative">
            {/* Timeline dot */}
            <div
              className={`absolute -left-[37px] top-4 w-3.5 h-3.5 rounded-full border-2 border-white ${dotColor}`}
            />

            <div
              className={`rounded-xl overflow-hidden border ${
                isWillNotMeet
                  ? 'bg-slate-50 border-slate-200 opacity-70'
                  : 'bg-[#0f172a] border-[#1e293b]'
              }`}
            >
              {/* Card header */}
              <div className="px-5 py-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  {/* Left: date + time + room */}
                  <div>
                    <p
                      className={`font-playfair text-lg font-bold leading-tight ${
                        isWillNotMeet ? 'text-slate-500' : 'text-white'
                      }`}
                    >
                      {formatDate(meeting.date)}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap text-xs text-slate-400">
                      {meeting.time && <span>{meeting.time}</span>}
                      {meeting.time && meeting.room && <span>·</span>}
                      {meeting.room && <span>Room {meeting.room}</span>}
                    </div>
                  </div>

                  {/* Right: badges + buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Status badge */}
                    {isWillNotMeet ? (
                      <span className="text-xs font-bold bg-slate-200 text-slate-500 px-2.5 py-1 rounded-full">
                        Will Not Meet
                      </span>
                    ) : isScheduled ? (
                      <span className="text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-full">
                        Scheduled
                      </span>
                    ) : meeting.minutes_url ? (
                      <span className="text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                        Minutes Available
                      </span>
                    ) : (
                      <span className="text-xs font-bold bg-slate-700 text-slate-400 px-2.5 py-1 rounded-full">
                        Met
                      </span>
                    )}

                    {/* Recording button */}
                    {meeting.video_url && (
                      <a
                        href={meeting.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-full transition-colors"
                      >
                        <Play className="w-3 h-3" />
                        Recording
                      </a>
                    )}

                    {/* Minutes PDF link */}
                    {meeting.minutes_url && (
                      <a
                        href={meeting.minutes_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-slate-200 px-3 py-1 rounded-full transition-colors"
                      >
                        <FileText className="w-3 h-3" />
                        Minutes
                      </a>
                    )}

                    {/* Agenda expand button */}
                    {canExpand && (
                      <button
                        onClick={() => handleExpand(meeting)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                        aria-label={isExpanded ? 'Collapse agenda' : 'View agenda'}
                      >
                        Agenda
                        {isExpanded
                          ? <ChevronUp className="w-3.5 h-3.5" />
                          : <ChevronDown className="w-3.5 h-3.5" />
                        }
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded agenda panel */}
              {isExpanded && !isWillNotMeet && (
                <div className="border-t border-[#1e293b] px-5 py-4">
                  {isLoading ? (
                    <p className="text-xs text-slate-400 animate-pulse">Loading agenda…</p>
                  ) : agendaText ? (
                    <div className="space-y-2">
                      {parseAgendaItems(agendaText).map((item, idx) => {
                        if (item.type === 'bill') {
                          const slug = item.normalized!.toLowerCase()
                          const label = item.normalized!
                          const description = item.content
                            .replace(/^[A-Z]{1,4}\s*\d+\s*[-–—]?\s*/i, '')
                            .trim()
                          return (
                            <div key={idx} className="flex items-start gap-2">
                              <Link
                                href={`/bills/${year}/${slug}`}
                                className="shrink-0 text-xs font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 px-2 py-0.5 rounded-full transition-colors"
                              >
                                {label}
                              </Link>
                              {description && (
                                <span className="text-xs text-slate-300 pt-0.5 leading-snug">
                                  {description}
                                </span>
                              )}
                            </div>
                          )
                        }

                        if (item.type === 'rs') {
                          const rsNum  = item.content.match(/^RS\s+\d+/i)?.[0] ?? ''
                          const rsDesc = item.content
                            .replace(/^RS\s+\d+\s*[-–—]?\s*/i, '')
                            .trim()
                          return (
                            <div key={idx} className="flex items-start gap-2">
                              <span className="shrink-0 text-xs font-bold text-slate-400 bg-slate-700 px-2 py-0.5 rounded-full">
                                {rsNum}
                              </span>
                              {rsDesc && (
                                <span className="text-xs text-slate-400 pt-0.5 leading-snug">
                                  {rsDesc}
                                </span>
                              )}
                            </div>
                          )
                        }

                        // Plain text — skip very short/noisy lines
                        if (item.content.length > 3) {
                          return (
                            <p key={idx} className="text-xs text-slate-500 leading-relaxed">
                              {item.content}
                            </p>
                          )
                        }

                        return null
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">Agenda not available.</p>
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
