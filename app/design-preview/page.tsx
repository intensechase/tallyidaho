import { Playfair_Display, Outfit } from 'next/font/google'

const playfair = Playfair_Display({ subsets: ['latin'], weight: ['700', '800', '900'] })
const outfit = Outfit({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700', '800'] })

const sampleBills = [
  {
    number: 'HB 489',
    title: 'Mask or disguise prohibited during criminal offense',
    tag: 'PARTY LINE',
    yea: 54, nay: 15,
    sponsor: 'Rep. Jordan Redman',
    district: 'District 3',
    subject: 'CRIMES & PUNISHMENT',
    passed: true,
  },
  {
    number: 'SB 1247',
    title: 'Idaho E-Verify Act — employment verification requirements',
    tag: 'CLOSE VOTE',
    yea: 18, nay: 17,
    sponsor: 'Sen. Daniel Foreman',
    district: 'District 6',
    subject: 'LABOR',
    passed: true,
  },
  {
    number: 'HB 312',
    title: 'Property tax relief for primary residences exceeding assessed value threshold',
    tag: 'CLOSE VOTE',
    yea: 36, nay: 33,
    sponsor: 'Rep. Ted Hill',
    district: 'District 14',
    subject: 'TAXATION',
    passed: true,
  },
]

function VoteBar({ yea, nay }: { yea: number; nay: number }) {
  const total = yea + nay
  const yeaPct = Math.round(yea / total * 100)
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-bold text-emerald-600 w-8 text-right ${outfit.className}`}>{yea}</span>
      <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${yeaPct}%` }} />
      </div>
      <span className={`text-xs font-bold text-red-500 w-8 ${outfit.className}`}>{nay}</span>
    </div>
  )
}

function RoundedCard({ bill }: { bill: typeof sampleBills[0] }) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 hover:border-amber-300 hover:shadow-sm transition-all cursor-pointer">
      <div className={`flex items-center gap-2 mb-2 ${outfit.className}`}>
        <span className="text-xs font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">{bill.number}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${bill.tag === 'PARTY LINE' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}>{bill.tag}</span>
        <span className="text-xs text-slate-400 ml-auto">{bill.subject}</span>
      </div>
      <p className={`text-slate-900 font-bold text-sm leading-snug mb-3 ${outfit.className}`}>{bill.title}</p>
      <VoteBar yea={bill.yea} nay={bill.nay} />
      <div className={`flex items-center justify-between mt-2 ${outfit.className}`}>
        <p className="text-xs text-slate-400">{bill.sponsor} · {bill.district}</p>
        <span className="text-xs font-semibold text-emerald-600">{bill.passed ? '✓ Passed' : '✗ Failed'}</span>
      </div>
    </div>
  )
}

export default function DesignPreview() {
  return (
    <div className={`min-h-screen bg-slate-100 py-10 px-4 ${outfit.className}`}>
      <div className="max-w-6xl mx-auto">
        <p className="text-center text-slate-500 text-sm mb-1">2C header · 2B cards — 4 variations</p>
        <p className="text-center text-slate-400 text-xs mb-10">Mixing the amber accent bar top with rounded hover cards bottom</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Variation 1 — Clean amber bar, cards with left subject pill */}
          <div className="rounded-xl overflow-hidden shadow-lg border border-slate-200">
            <div className="bg-[#0f172a] px-6 py-4">
              <div className="flex items-center justify-between">
                <span className={`text-2xl font-black text-white ${playfair.className}`}>TALLY IDAHO</span>
                <span className="text-xs text-amber-400 font-semibold tracking-widest">2026 SESSION</span>
              </div>
              <p className="text-slate-500 text-xs mt-1">Idaho legislature · Nonpartisan · Public record</p>
            </div>
            <div className="bg-amber-500 px-6 py-2 flex items-center gap-3">
              <span className="text-white text-xs font-extrabold tracking-widest">⚡ CONTROVERSIAL</span>
              <div className="h-3 w-px bg-amber-300" />
              <span className="text-amber-100 text-xs">Close margins or party-line votes</span>
              <span className="ml-auto text-amber-100 text-xs font-semibold">View all →</span>
            </div>
            <div className="bg-white p-5 space-y-3">
              {sampleBills.map(bill => <RoundedCard key={bill.number} bill={bill} />)}
            </div>
            <div className="bg-slate-50 px-6 py-2.5 text-center text-xs text-slate-400">
              <strong className="text-slate-600">V1</strong> — Amber bar with description + "View all" link
            </div>
          </div>

          {/* Variation 2 — Amber bar bolder, cards slightly larger spacing */}
          <div className="rounded-xl overflow-hidden shadow-lg border border-slate-200">
            <div className="bg-[#0f172a] px-6 py-4">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-2xl font-black text-white ${playfair.className}`}>TALLY IDAHO</span>
                <nav className="flex gap-5 text-xs text-slate-400">
                  <span>Legislators</span><span>Bills</span><span>Districts</span>
                </nav>
              </div>
              <p className="text-slate-500 text-xs">Idaho legislature · Nonpartisan · Public record</p>
            </div>
            <div className="bg-amber-500 px-6 py-2.5 flex items-center gap-3">
              <span className="text-white text-sm font-extrabold tracking-wide">⚡ CONTROVERSIAL LEGISLATION</span>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-amber-900 text-xs font-semibold bg-amber-400 px-2 py-0.5 rounded-full">2026 Session</span>
              </div>
            </div>
            <div className="bg-white p-5 space-y-3">
              {sampleBills.map(bill => (
                <div key={bill.number} className="rounded-xl bg-slate-50 border border-slate-100 p-4 hover:border-amber-300 hover:shadow-md transition-all cursor-pointer group">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-extrabold text-amber-600 bg-white border border-amber-300 px-2.5 py-0.5 rounded-full shadow-sm">{bill.number}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${bill.tag === 'PARTY LINE' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}>{bill.tag}</span>
                  </div>
                  <p className="text-slate-900 font-bold text-sm leading-snug mb-3 group-hover:text-amber-800 transition-colors">{bill.title}</p>
                  <VoteBar yea={bill.yea} nay={bill.nay} />
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-slate-400">{bill.sponsor} · {bill.district}</p>
                    <span className="text-xs font-semibold text-emerald-600">{bill.passed ? '✓ Passed' : '✗ Failed'}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-slate-50 px-6 py-2.5 text-center text-xs text-slate-400">
              <strong className="text-slate-600">V2</strong> — White border bill badge · Title color shift on hover · Session pill
            </div>
          </div>

          {/* Variation 3 — Subtle amber bar, cards with district badge */}
          <div className="rounded-xl overflow-hidden shadow-lg border border-slate-200">
            <div className="bg-[#0f172a] px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className={`text-2xl font-black text-white ${playfair.className}`}>TALLY IDAHO</span>
                  <p className="text-slate-500 text-xs mt-0.5">Idaho legislature · Nonpartisan · Public record</p>
                </div>
                <span className="text-xs text-amber-400 font-semibold tracking-widest">2026 SESSION</span>
              </div>
            </div>
            <div className="bg-[#1e293b] px-6 py-2 flex items-center gap-4 border-b-2 border-amber-500">
              <span className="text-amber-400 text-xs font-extrabold tracking-widest border-b-2 border-amber-400 pb-1.5 -mb-2">⚡ Controversial</span>
              <span className="text-slate-500 text-xs">All Bills</span>
              <span className="text-slate-500 text-xs">By Topic</span>
              <span className="text-slate-500 text-xs">By Session</span>
            </div>
            <div className="bg-white p-5 space-y-3">
              {sampleBills.map(bill => (
                <div key={bill.number} className="rounded-xl bg-slate-50 border border-slate-100 p-4 hover:border-amber-300 hover:shadow-sm transition-all cursor-pointer">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">{bill.number}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${bill.tag === 'PARTY LINE' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}>{bill.tag}</span>
                    </div>
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">{bill.district}</span>
                  </div>
                  <p className="text-slate-900 font-bold text-sm leading-snug mb-3">{bill.title}</p>
                  <VoteBar yea={bill.yea} nay={bill.nay} />
                  <p className="text-xs text-slate-400 mt-2">{bill.sponsor}</p>
                </div>
              ))}
            </div>
            <div className="bg-slate-50 px-6 py-2.5 text-center text-xs text-slate-400">
              <strong className="text-slate-600">V3</strong> — Dark tab bar with amber underline · District pill on card · Cleaner
            </div>
          </div>

          {/* Variation 4 — Full width amber bar, cards with colored left border by tag */}
          <div className="rounded-xl overflow-hidden shadow-lg border border-slate-200">
            <div className="bg-[#0f172a] px-6 py-4">
              <div className="flex items-center justify-between">
                <span className={`text-2xl font-black text-white ${playfair.className}`}>TALLY IDAHO</span>
                <span className="text-xs text-amber-400 font-semibold tracking-widest">2026 SESSION</span>
              </div>
              <p className="text-slate-500 text-xs mt-1">Idaho legislature · Nonpartisan · Public record</p>
            </div>
            <div className="bg-amber-500 px-6 py-2 flex items-center gap-3">
              <span className="text-white text-xs font-extrabold tracking-widest">⚡ CONTROVERSIAL</span>
              <div className="h-3 w-px bg-amber-300" />
              <span className="text-amber-100 text-xs">Close margins or party-line votes</span>
            </div>
            <div className="bg-white p-5 space-y-3">
              {sampleBills.map(bill => (
                <div key={bill.number} className={`rounded-xl border p-4 hover:shadow-sm transition-all cursor-pointer ${bill.tag === 'PARTY LINE' ? 'bg-red-50/30 border-red-100 hover:border-red-300' : 'bg-orange-50/30 border-orange-100 hover:border-amber-300'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-extrabold text-amber-600 bg-white border border-amber-200 px-2 py-0.5 rounded-full">{bill.number}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${bill.tag === 'PARTY LINE' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>{bill.tag}</span>
                    <span className="text-xs text-slate-400 ml-auto">{bill.subject}</span>
                  </div>
                  <p className="text-slate-900 font-bold text-sm leading-snug mb-3">{bill.title}</p>
                  <VoteBar yea={bill.yea} nay={bill.nay} />
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-slate-400">{bill.sponsor} · {bill.district}</p>
                    <span className="text-xs font-semibold text-emerald-600">{bill.passed ? '✓ Passed' : '✗ Failed'}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-slate-50 px-6 py-2.5 text-center text-xs text-slate-400">
              <strong className="text-slate-600">V4</strong> — Cards tinted by controversy type (red tint = party line, orange = close vote)
            </div>
          </div>

        </div>

        <p className="text-center text-slate-400 text-xs mt-10">
          All: 2C header (navy + amber bar) · 2B rounded hover cards · Playfair + Outfit
        </p>
      </div>
    </div>
  )
}
