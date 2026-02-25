// TallyIdaho — Full Historical Import
// Imports all Idaho sessions from 2016 through 2025
// Run AFTER import-session.ts 2246 (2026 already imported)
// Usage: npx tsx scripts/import-all-sessions.ts

import 'dotenv/config'
import AdmZip from 'adm-zip'
import { createClient } from '@supabase/supabase-js'
import { getDatasetList, getDataset } from './lib/legiscan'
import { isCloseVote, isPartyLineVote, getControversyReason } from './lib/controversy'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// All sessions from 2016-2025 (2026 already imported)
const HISTORICAL_SESSION_IDS = [
  1198, // 2016 Regular Session
  1406, // 2017 Regular Session
  1525, // 2018 Regular Session
  1629, // 2019 Regular Session
  1725, // 2020 Regular Session
  1766, // 2020 Special Session
  1800, // 2021 Regular Session
  1954, // 2022 Regular Session
  1994, // 2022 Special Session
  2011, // 2023 Regular Session
  2119, // 2024 Regular Session
  2168, // 2025 Regular Session
]

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function parseDistrict(districtStr: string): { number: number | null; seat: string | null } {
  if (!districtStr) return { number: null, seat: null }
  const match = districtStr.match(/[HS]D-0*(\d+)([AB]?)/)
  if (!match) return { number: null, seat: null }
  return { number: parseInt(match[1]), seat: match[2] || null }
}

function parseChamber(role: string): string {
  return role === 'Sen' ? 'senate' : 'house'
}

function mapVote(voteCode: number): string {
  switch (voteCode) {
    case 1: return 'yea'
    case 2: return 'nay'
    case 3: return 'absent'
    case 4: return 'not_voting'
    default: return 'not_voting'
  }
}

async function importSession(sessionId: number, dataset: any) {
  console.log(`\n${'─'.repeat(50)}`)
  console.log(`📅 ${dataset.session_name} (ID: ${sessionId})`)

  // Check if already imported with same hash
  const { data: existing } = await supabase
    .from('sessions')
    .select('dataset_hash')
    .eq('legiscan_session_id', sessionId)
    .single()

  if (existing?.dataset_hash === dataset.dataset_hash) {
    console.log('   ↩ Already up to date — skipping')
    return
  }

  // Download ZIP
  process.stdout.write('   📦 Downloading...')
  const base64Zip = await getDataset(sessionId, dataset.access_key)
  const zip = new AdmZip(Buffer.from(base64Zip, 'base64'))
  const entries = zip.getEntries()
  const billFiles = entries.filter(e => e.entryName.includes('/bill/'))
  const voteFiles = entries.filter(e => e.entryName.includes('/vote/'))
  const peopleFiles = entries.filter(e => e.entryName.includes('/people/'))
  console.log(` ${entries.length} files (${billFiles.length} bills, ${voteFiles.length} votes, ${peopleFiles.length} people)`)

  // Upsert session
  await supabase.from('sessions').upsert({
    legiscan_session_id: dataset.session_id,
    year_start: dataset.year_start,
    year_end: dataset.year_end,
    name: dataset.session_name,
    session_tag: dataset.session_tag,
    is_special: dataset.special === 1,
    is_current: false,
    sine_die: true,
    dataset_hash: dataset.dataset_hash,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'legiscan_session_id' })

  const { data: sessionRow } = await supabase
    .from('sessions')
    .select('id')
    .eq('legiscan_session_id', sessionId)
    .single()

  const sessionUUID = sessionRow!.id
  const legislatorIdMap = new Map<number, string>()
  const billIdMap = new Map<number, string>()

  // Import legislators
  process.stdout.write(`   👤 Legislators...`)
  let legislatorCount = 0
  for (const entry of peopleFiles) {
    const person = JSON.parse(entry.getData().toString('utf8')).person || JSON.parse(entry.getData().toString('utf8'))
    const { number: districtNumber, seat: districtSeat } = parseDistrict(person.district || '')

    const { data: upserted } = await supabase.from('legislators').upsert({
      legiscan_people_id: person.people_id,
      name: person.name,
      first_name: person.first_name || null,
      last_name: person.last_name || null,
      nickname: person.nickname || null,
      party: person.party || null,
      role: person.role || null,
      chamber: parseChamber(person.role || ''),
      district: person.district || null,
      district_number: districtNumber,
      district_seat: districtSeat,
      email: person.bio?.social?.email || null,
      capitol_phone: person.bio?.social?.capitol_phone || null,
      website_url: person.bio?.links?.official?.website || null,
      twitter_handle: person.bio?.links?.official?.twitter || person.bio?.links?.personal?.twitter || null,
      facebook_url: person.bio?.links?.official?.facebook || person.bio?.links?.personal?.facebook || null,
      instagram_url: person.bio?.links?.official?.instagram || person.bio?.links?.personal?.instagram || null,
      ballotpedia_url: person.bio?.social?.ballotpedia || null,
      votesmart_id: person.votesmart_id || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'legiscan_people_id', ignoreDuplicates: false }).select('id')

    if (upserted?.[0]) {
      legislatorIdMap.set(person.people_id, upserted[0].id)
      await supabase.from('legislator_sessions').upsert({
        legislator_id: upserted[0].id,
        session_id: sessionUUID,
        district: person.district || null,
        party: person.party || null,
        role: person.role || null,
      }, { onConflict: 'legislator_id,session_id' })
      legislatorCount++
    }
  }
  console.log(` ${legislatorCount}`)

  // Import bills
  process.stdout.write(`   📜 Bills...`)
  let billCount = 0
  for (const entry of billFiles) {
    const bill = JSON.parse(entry.getData().toString('utf8')).bill || JSON.parse(entry.getData().toString('utf8'))
    const subjects = (bill.subjects || []).map((s: any) => s.subject_name)

    const { data: upserted } = await supabase.from('bills').upsert({
      legiscan_bill_id: bill.bill_id,
      session_id: sessionUUID,
      bill_number: bill.bill_number,
      bill_type: bill.bill_type || null,
      chamber: bill.body === 'H' ? 'house' : 'senate',
      title: bill.title,
      description: bill.description || null,
      status: String(bill.status || ''),
      status_date: bill.status_date || null,
      last_action: bill.history?.[bill.history.length - 1]?.action || null,
      last_action_date: bill.last_action_date || null,
      completed: bill.completed === 1,
      legiscan_url: bill.url || null,
      state_url: bill.state_link || null,
      subjects: subjects,
      change_hash: bill.change_hash || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'legiscan_bill_id', ignoreDuplicates: false }).select('id')

    if (upserted?.[0]) {
      billIdMap.set(bill.bill_id, upserted[0].id)

      if (bill.sponsors?.length) {
        for (const sponsor of bill.sponsors) {
          if (sponsor.committee_sponsor) continue
          const legislatorUUID = legislatorIdMap.get(sponsor.people_id)
          if (!legislatorUUID) continue
          await supabase.from('bill_sponsors').upsert({
            bill_id: upserted[0].id,
            legislator_id: legislatorUUID,
            sponsor_order: sponsor.sponsor_order,
            sponsor_type: sponsor.sponsor_order === 1 ? 'primary' : 'cosponsor',
            committee_sponsor: false,
          }, { onConflict: 'bill_id,legislator_id' })
        }
      }
      billCount++
    }
  }
  console.log(` ${billCount}`)

  // Import roll calls and votes
  process.stdout.write(`   🗳️  Roll calls...`)
  let rollCallCount = 0
  let voteCount = 0
  let controversialCount = 0

  for (const entry of voteFiles) {
    const rc = JSON.parse(entry.getData().toString('utf8')).roll_call || JSON.parse(entry.getData().toString('utf8'))
    const billUUID = billIdMap.get(rc.bill_id)
    if (!billUUID) continue

    const votes = (rc.votes || []).map((v: any) => ({
      people_id: v.people_id,
      legislator_uuid: legislatorIdMap.get(v.people_id),
      vote: mapVote(v.vote_id),
      party: v.party || '',
    }))

    const yeaCount = rc.yea || 0
    const nayCount = rc.nay || 0
    const absentCount = rc.absent || 0
    const nvCount = rc.nv || 0
    const totalCount = yeaCount + nayCount + absentCount + nvCount
    const voteMargin = totalCount > 0 ? Math.abs(yeaCount - nayCount) / totalCount * 100 : 0
    const isClose = isCloseVote(yeaCount, nayCount, totalCount)
    const isPartyLine = isPartyLineVote(votes)

    const { data: rcUpserted } = await supabase.from('roll_calls').upsert({
      legiscan_roll_call_id: rc.roll_call_id,
      bill_id: billUUID,
      session_id: sessionUUID,
      date: rc.date || null,
      description: rc.desc || null,
      chamber: rc.chamber === 'H' ? 'house' : 'senate',
      yea_count: yeaCount,
      nay_count: nayCount,
      absent_count: absentCount,
      nv_count: nvCount,
      total_count: totalCount,
      passed: rc.passed === 1,
      vote_margin: parseFloat(voteMargin.toFixed(2)),
      is_party_line: isPartyLine,
    }, { onConflict: 'legiscan_roll_call_id', ignoreDuplicates: false }).select('id')

    if (rcUpserted?.[0]) {
      rollCallCount++
      const reason = getControversyReason(isClose, isPartyLine)
      if (reason) {
        controversialCount++
        await supabase.from('bills').update({
          is_controversial: true,
          controversy_reason: reason,
        }).eq('id', billUUID)
      }

      const voteRows = votes
        .filter((v: any) => v.legislator_uuid)
        .map((v: any) => ({
          roll_call_id: rcUpserted[0].id,
          legislator_id: v.legislator_uuid,
          vote: v.vote,
        }))

      if (voteRows.length > 0) {
        await supabase.from('legislator_votes').upsert(voteRows, {
          onConflict: 'roll_call_id,legislator_id',
        })
        voteCount += voteRows.length
      }
    }
  }
  console.log(` ${rollCallCount} (${voteCount} votes, ${controversialCount} controversial)`)
}

async function main() {
  console.log('\n🗳️  TallyIdaho — Historical Import (2016–2025)')
  console.log('='.repeat(50))

  console.log('\n📋 Fetching dataset list...')
  const datasets = await getDatasetList()
  const datasetMap = new Map(datasets.map((d: any) => [d.session_id, d]))

  let totalBills = 0
  let totalVotes = 0
  let totalControversial = 0

  for (const sessionId of HISTORICAL_SESSION_IDS) {
    const dataset = datasetMap.get(sessionId)
    if (!dataset) {
      console.log(`⚠️  Session ${sessionId} not found in dataset list — skipping`)
      continue
    }
    await importSession(sessionId, dataset)
    await delay(1000) // 1s between sessions
  }

  console.log('\n' + '='.repeat(50))
  console.log('✅ Historical import complete!')
}

main().catch(err => {
  console.error('\n❌ Import failed:', err.message)
  process.exit(1)
})
