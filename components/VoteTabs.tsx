import Link from 'next/link'

interface Vote {
  vote: string
  roll_calls: {
    id: number
    date: string
    passed: boolean
    yea_count: number
    nay_count: number
    bills: {
      bill_number: string
      title: string
      session_id: string
      is_controversial: boolean
      controversy_reason: string | null
    } | null
  } | null
}

interface Props {
  allVotes: Vote[]
  keyVotes: Vote[]
  year: number
}

function VoteRow({ v, year }: { v: Vote; year: number }) {
  const rc = v.roll_calls
  const bill = rc?.bills
  if (!bill) return null
  const absent = v.vote !== 'yea' && v.vote !== 'nay'

  return (
    <Link href={`/bills/${year}/${bill.bill_number?.toLowerCase()}`} className="block">
      <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3 hover:border-amber-300 transition-all group">
        <span className={`text-xs font-bold px-2 py-1 rounded-lg shrink-0 min-w-[44px] text-center ${
          v.vote === 'yea'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : v.vote === 'nay'
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          {absent ? 'ABSENT' : v.vote?.toUpperCase()}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-amber-600">{bill.bill_number}</p>
          <p className="text-sm text-slate-700 truncate group-hover:text-amber-800 transition-colors">
            {bill.title}
          </p>
        </div>

        {bill.is_controversial && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
            bill.controversy_reason === 'party_line'
              ? 'bg-red-50 text-red-500'
              : 'bg-orange-50 text-orange-500'
          }`}>
            {bill.controversy_reason === 'party_line' ? 'PARTY LINE' : 'CLOSE'}
          </span>
        )}

        <span className={`text-xs font-semibold shrink-0 ${rc?.passed ? 'text-emerald-600' : 'text-red-400'}`}>
          {rc?.passed ? '✓' : '✗'}
        </span>
      </div>
    </Link>
  )
}

export default function VoteTabs({ allVotes, keyVotes, year }: Props) {
  return (
    <div className="space-y-6">

      {/* Key Votes — visible by default */}
      <div>
        <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mb-2">
          Key Votes{keyVotes.length > 0 ? ` (${keyVotes.length})` : ''}
        </p>
        {keyVotes.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No controversial votes recorded for this session.</p>
        ) : (
          <div className="space-y-2">
            {keyVotes.map((v, i) => <VoteRow key={i} v={v} year={year} />)}
          </div>
        )}
      </div>

      {/* All Votes — in <details> so full record is in DOM for SEO */}
      {allVotes.length > 0 && (
        <details className="group">
          <summary className="list-none marker:hidden [&::-webkit-details-marker]:hidden cursor-pointer text-xs text-amber-700 hover:underline inline-flex items-center gap-1">
            <span className="group-open:hidden">▶ Show full voting record ({allVotes.length})</span>
            <span className="hidden group-open:inline">▼ Hide full voting record</span>
          </summary>
          <div className="mt-3 space-y-2">
            {allVotes.map((v, i) => <VoteRow key={i} v={v} year={year} />)}
          </div>
        </details>
      )}

    </div>
  )
}
