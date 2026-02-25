// LegiScan API client
// Handles all communication with the LegiScan API

const API_KEY = process.env.LEGISCAN_API_KEY!
const BASE_URL = 'https://api.legiscan.com/'

// Small delay between API calls to be respectful of free tier
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function apiCall(params: Record<string, string>): Promise<any> {
  const url = new URL(BASE_URL)
  url.searchParams.set('key', API_KEY)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }

  const res = await fetch(url.toString())
  const json = await res.json()

  if (json.status !== 'OK') {
    throw new Error(`LegiScan API error: ${JSON.stringify(json)}`)
  }

  await delay(500) // 500ms between calls — respectful of free tier
  return json
}

// Get list of all available datasets for Idaho with access keys and hashes
export async function getDatasetList() {
  const json = await apiCall({ op: 'getDatasetList', state: 'ID' })
  return Object.values(json.datasetlist) as any[]
}

// Download a session dataset ZIP (base64 encoded)
// Returns the raw base64 string
export async function getDataset(sessionId: number, accessKey: string): Promise<string> {
  const json = await apiCall({
    op: 'getDataset',
    id: String(sessionId),
    access_key: accessKey,
  })
  // The ZIP is nested under json.dataset.zip
  return json.dataset.zip
}

// Get master list for a session (lightweight, for daily sync change detection)
export async function getMasterListRaw(sessionId: number) {
  const json = await apiCall({ op: 'getMasterListRaw', id: String(sessionId) })
  return json.masterlist
}

// Get full bill detail
export async function getBill(billId: number) {
  const json = await apiCall({ op: 'getBill', id: String(billId) })
  return json.bill
}

// Get roll call detail
export async function getRollCall(rollCallId: number) {
  const json = await apiCall({ op: 'getRollCall', id: String(rollCallId) })
  return json.roll_call
}
