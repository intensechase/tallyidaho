// TallyIdaho — LegiScan Session Import Script
// Usage: npx tsx scripts/import-session.ts [session_id]
// Default session: 2246 (2026 Regular Session)
//
// Imports all sessions, legislators, bills, roll calls, and votes
// for a single LegiScan session into Supabase.

import 'dotenv/config'
import AdmZip from 'adm-zip'
import { createClient } from '@supabase/supabase-js'
import { getDatasetList, getDataset } from './lib/legiscan'
import { isCloseVote, isPartyLineVote, getControversyReason } from './lib/controversy'
import { legislatorSlug } from '../lib/slugify'

// ==================
// Setup
// ==================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TARGET_SESSION_ID = parseInt(process.argv[2] || '2246')

console.log(`\n🗳️  TallyIdaho Import — Session ${TARGET_SESSION_ID}`)
console.log('='.repeat(50))

// ==================
// Helpers
// ==================

function parseDistrict(districtStr: string): { number: number | null; seat: string | null } {
  if (!districtStr) return { number: null, seat: null }
  // HD-020A → number: 20, seat: 'A'
  // SD-006  → number: 6, seat: null
  const match = districtStr.match(/[HS]D-0*(\d+)([AB]?)/)
  if (!match) return { number: null, seat: null }
  return {
    number: parseInt(match[1]),
    seat: match[2] || null,
  }
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

// ==================
// Main Import
// ==================

async function main() {
  // 1. Get dataset list to find access key and hash for our target session
  console.log('\n📋 Fetching dataset list...')
  const datasets = await getDatasetList()
  const dataset = datasets.find((d: any) => d.session_id === TARGET_SESSION_ID)

  if (!dataset) {
    throw new Error(`Session ${TARGET_SESSION_ID} not found in dataset list`)
  }

  console.log(`✓ Found: ${dataset.session_name} (hash: ${dataset.dataset_hash})`)

  // Check if we already have this dataset loaded (hash comparison)
  const { data: existingSession } = await supabase
    .from('sessions')
    .select('dataset_hash')
    .eq('legiscan_session_id', TARGET_SESSION_ID)
    .single()

  if (existingSession?.dataset_hash === dataset.dataset_hash) {
    console.log('✓ Dataset unchanged — skipping download')
    return
  }

  // 2. Download dataset ZIP
  console.log('\n📦 Downloading dataset ZIP...')
  const base64Zip = await getDataset(TARGET_SESSION_ID, dataset.access_key)
  const zipBuffer = Buffer.from(base64Zip, 'base64')
  const zip = new AdmZip(zipBuffer)
  const entries = zip.getEntries()
  console.log(`✓ ZIP downloaded — ${entries.length} files`)

  // Categorize files
  const billFiles = entries.filter(e => e.entryName.includes('/bill/'))
  const voteFiles = entries.filter(e => e.entryName.includes('/vote/'))
  const peopleFiles = entries.filter(e => e.entryName.includes('/people/'))
  console.log(`   Bills: ${billFiles.length} | Votes: ${voteFiles.length} | People: ${peopleFiles.length}`)

  // 3. Upsert session
  console.log('\n📅 Importing session...')
  await supabase.from('sessions').upsert({
    legiscan_session_id: dataset.session_id,
    year_start: dataset.year_start,
    year_end: dataset.year_end,
    name: dataset.session_name,
    session_tag: dataset.session_tag,
    is_special: dataset.special === 1,
    is_current: dataset.sine_die === 0,
    sine_die: dataset.sine_die === 1,
    dataset_hash: dataset.dataset_hash,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'legiscan_session_id' })

  const { data: sessionRow } = await supabase
    .from('sessions')
    .select('id')
    .eq('legiscan_session_id', TARGET_SESSION_ID)
    .single()

  const sessionUUID = sessionRow!.id
  console.log(`✓ Session saved (${sessionUUID})`)

  // 4. Import legislators (people)
  console.log(`\n👤 Importing ${peopleFiles.length} legislators...`)
  let legislatorCount = 0
  const legislatorIdMap = new Map<number, string>() // legiscan_people_id → uuid

  for (const entry of peopleFiles) {
    const raw = entry.getData().toString('utf8')
    const data = JSON.parse(raw)
    const person = data.person || data

    const { number: districtNumber, seat: districtSeat } = parseDistrict(person.district || '')

    const { data: upserted } = await supabase.from('legislators').upsert({
      legiscan_people_id: person.people_id,
      name: person.name,
      slug: legislatorSlug(person.name),
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
      is_current: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'legiscan_people_id', ignoreDuplicates: false }).select('id')

    if (upserted?.[0]) {
      legislatorIdMap.set(person.people_id, upserted[0].id)

      // Track session participation
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
  console.log(`✓ ${legislatorCount} legislators imported`)

  // 5. Import bills
  console.log(`\n📜 Importing ${billFiles.length} bills...`)
  let billCount = 0
  const billIdMap = new Map<number, string>() // legiscan_bill_id → uuid

  for (const entry of billFiles) {
    const raw = entry.getData().toString('utf8')
    const data = JSON.parse(raw)
    const bill = data.bill || data

    const subjects = (bill.subjects || []).map((s: any) => s.subject_name)
    const chamberCode = bill.body === 'H' ? 'house' : 'senate'

    const { data: upserted } = await supabase.from('bills').upsert({
      legiscan_bill_id: bill.bill_id,
      session_id: sessionUUID,
      bill_number: bill.bill_number,
      bill_type: bill.bill_type || null,
      chamber: chamberCode,
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

      // Import sponsors
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
  console.log(`✓ ${billCount} bills imported`)

  // 6. Import roll calls and votes
  console.log(`\n🗳️  Importing ${voteFiles.length} roll calls...`)
  let rollCallCount = 0
  let voteCount = 0
  let controversialCount = 0

  for (const entry of voteFiles) {
    const raw = entry.getData().toString('utf8')
    const data = JSON.parse(raw)
    const rc = data.roll_call || data

    const billUUID = billIdMap.get(rc.bill_id)
    if (!billUUID) continue

    // Build individual vote records with party info for controversy calculation
    const votes = (rc.votes || []).map((v: any) => {
      const legislatorUUID = legislatorIdMap.get(v.people_id)
      const party = v.party || ''
      return {
        people_id: v.people_id,
        legislator_uuid: legislatorUUID,
        vote: mapVote(v.vote_id),
        party,
      }
    })

    const yeaCount = rc.yea || 0
    const nayCount = rc.nay || 0
    const absentCount = rc.absent || 0
    const nvCount = rc.nv || 0
    const totalCount = yeaCount + nayCount + absentCount + nvCount
    const voteMargin = totalCount > 0
      ? Math.abs(yeaCount - nayCount) / totalCount * 100
      : 0

    const isClose = isCloseVote(yeaCount, nayCount, totalCount)
    const isPartyLine = isPartyLineVote(votes)

    const chamberCode = rc.chamber === 'H' ? 'house' : 'senate'

    const { data: rcUpserted } = await supabase.from('roll_calls').upsert({
      legiscan_roll_call_id: rc.roll_call_id,
      bill_id: billUUID,
      session_id: sessionUUID,
      date: rc.date || null,
      description: rc.desc || null,
      chamber: chamberCode,
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

      // Update bill controversy flags if this roll call is controversial
      const reason = getControversyReason(isClose, isPartyLine)
      if (reason) {
        controversialCount++
        await supabase.from('bills').update({
          is_controversial: true,
          controversy_reason: reason,
        }).eq('id', billUUID)
      }

      // Insert individual legislator votes
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
  console.log(`✓ ${rollCallCount} roll calls imported`)
  console.log(`✓ ${voteCount} individual votes imported`)
  console.log(`✓ ${controversialCount} controversial roll calls flagged`)

  // 7. Summary
  console.log('\n' + '='.repeat(50))
  console.log('✅ Import complete!')
  console.log(`   Session:      ${dataset.session_name}`)
  console.log(`   Legislators:  ${legislatorCount}`)
  console.log(`   Bills:        ${billCount}`)
  console.log(`   Roll calls:   ${rollCallCount}`)
  console.log(`   Votes:        ${voteCount}`)
  console.log(`   Controversial:${controversialCount}`)
}

main().catch(err => {
  console.error('\n❌ Import failed:', err.message)
  process.exit(1)
})
