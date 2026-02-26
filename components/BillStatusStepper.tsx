// No 'use client' — pure render, works in server and client components

const STAGES = ['Introduced', 'In Committee', 'Floor Vote', 'Enacted']

export function getBillStage(
  status: string | number | null | undefined,
  completed: boolean
): number {
  if (completed) return 4
  const s = Number(status || 1)
  if (s >= 4) return 4
  if (s === 3) return 3
  if (s === 2) return 2
  return 1
}

/** Compact inline dot stepper for bill list cards */
export function BillStepperCompact({ stage }: { stage: number }) {
  return (
    <div className="flex items-center gap-0.5 mt-1.5">
      {[1, 2, 3, 4].map((s) => (
        <div key={s} className="flex items-center gap-0.5">
          {s > 1 && (
            <div className={`w-3 h-px ${s <= stage ? 'bg-amber-400' : 'bg-slate-200'}`} />
          )}
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            s < stage  ? 'bg-amber-500' :
            s === stage ? 'bg-amber-600' :
            'bg-slate-200'
          }`} />
        </div>
      ))}
      <span className="text-[11px] text-slate-400 ml-1.5 whitespace-nowrap">
        {STAGES[stage - 1]}
      </span>
    </div>
  )
}

/** Full horizontal stepper for bill detail pages */
export function BillStepperFull({ stage }: { stage: number }) {
  const progressPct = ((stage - 1) / 3) * 100

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-6 py-5">
      {/* Dots + connecting lines */}
      <div className="relative flex justify-between items-center">
        {/* Background track */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-slate-200" />
        {/* Amber progress fill */}
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-amber-400"
          style={{ width: `${progressPct}%` }}
        />
        {/* Step dots */}
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center border-2 flex-shrink-0 transition-all ${
              s < stage
                ? 'bg-amber-500 border-amber-500'
                : s === stage
                ? 'bg-amber-500 border-amber-500 shadow-[0_0_0_4px_rgba(217,119,6,0.15)]'
                : 'bg-white border-slate-300'
            }`}
          >
            {s < stage && (
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {s === stage && <div className="w-3 h-3 rounded-full bg-white" />}
          </div>
        ))}
      </div>

      {/* Labels row */}
      <div className="flex justify-between mt-2.5">
        {STAGES.map((label, i) => {
          const s = i + 1
          return (
            <span
              key={i}
              className={`text-xs font-medium leading-tight ${
                i === 0 ? 'text-left' : i === 3 ? 'text-right' : 'text-center'
              } ${s <= stage ? 'text-amber-700' : 'text-slate-400'}`}
              style={{ width: '25%' }}
            >
              {label}
            </span>
          )
        })}
      </div>
    </div>
  )
}
