// Controversy flag calculation
// A bill is flagged controversial if any of its roll calls meet the criteria

interface Vote {
  vote: string       // 'yea', 'nay', 'absent', 'not_voting'
  party: string      // 'R', 'D', 'I', etc.
}

// Close vote: margin between yea and nay is less than 10%
export function isCloseVote(yeaCount: number, nayCount: number, totalCount: number): boolean {
  if (totalCount === 0) return false
  const margin = Math.abs(yeaCount - nayCount) / totalCount * 100
  return margin < 10
}

// Party-line vote: 90%+ of each party (R and D) voted the same way
// Requires individual vote records with party info
export function isPartyLineVote(votes: Vote[]): boolean {
  const rVotes = votes.filter(v => v.party === 'R' && (v.vote === 'yea' || v.vote === 'nay'))
  const dVotes = votes.filter(v => v.party === 'D' && (v.vote === 'yea' || v.vote === 'nay'))

  // Need at least 3 from each party to make a meaningful determination
  if (rVotes.length < 3 || dVotes.length < 3) return false

  const rYeaPct = rVotes.filter(v => v.vote === 'yea').length / rVotes.length
  const dYeaPct = dVotes.filter(v => v.vote === 'yea').length / dVotes.length

  const rUnified = rYeaPct >= 0.9 || rYeaPct <= 0.1
  const dUnified = dYeaPct >= 0.9 || dYeaPct <= 0.1

  // Party-line: both parties unified but on opposite sides
  if (!rUnified || !dUnified) return false
  const rLeanYea = rYeaPct >= 0.9
  const dLeanYea = dYeaPct >= 0.9
  return rLeanYea !== dLeanYea // opposite sides
}

export function getControversyReason(
  isClose: boolean,
  isPartyLine: boolean
): 'close_vote' | 'party_line' | 'both' | null {
  if (isClose && isPartyLine) return 'both'
  if (isClose) return 'close_vote'
  if (isPartyLine) return 'party_line'
  return null
}
