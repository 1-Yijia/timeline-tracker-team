const SHEET_ID = '145vorVJHV8MrvwusdOfsZmqx5pqGZHRhGMEQqKs1RHQ'
const GID = '1455044719'
const GAS_URL = import.meta.env.VITE_GAS_URL
const GAS_TOKEN = import.meta.env.VITE_GAS_TOKEN

export const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`

const STAGE_MAP = {
  pipeline: 'pipeline',
  frf: 'frf',
  prd: 'prd',
}

function parseCSVLine(line) {
  const result = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQ = !inQ }
    else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = '' }
    else { cur += ch }
  }
  result.push(cur.trim())
  return result
}

function normalizeRange(s) {
  if (!s) return ''
  return s.replace(/\//g, '.')
}

export function parseSheetCSV(csvText) {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return { rows: [], features: [] }

  const features = []
  const seenRowKeys = []

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    const id = cols[0]
    if (!id || !id.trim()) continue

    const product          = cols[1]  || ''
    const market           = cols[2]  || ''
    const name             = cols[3]  || ''
    const frf              = cols[4]  || ''
    const prd              = cols[5]  || ''
    const jira             = cols[6]  || ''
    const rawStage         = cols[7]  || 'pipeline'
    const version          = cols[8]  || ''
    const devRange         = normalizeRange(cols[9]  || '')
    const qaRange          = normalizeRange(cols[10] || '')
    const uatRange         = normalizeRange(cols[11] || '')
    const liveRange        = normalizeRange(cols[12] || '')
    const liveTestingRange = normalizeRange(cols[13] || '')
    const greyscaleRange   = normalizeRange(cols[14] || '')

    const timeline = {}
    if (devRange)         timeline.dev             = devRange
    if (qaRange)          timeline.test            = qaRange
    if (uatRange)         timeline.uat             = uatRange
    if (liveRange)        timeline.live            = liveRange
    if (liveTestingRange) timeline['live-testing'] = liveTestingRange
    if (greyscaleRange)   timeline.greyscale       = greyscaleRange

    // If any timeline range is filled, stage is always 'scheduled' — the Stage column is ignored.
    // computeDisplayStage then advances from 'scheduled' based on today's date.
    const hasTimeline = devRange || qaRange || uatRange || liveRange
    const stage = hasTimeline ? 'scheduled' : (STAGE_MAP[rawStage.toLowerCase()] ?? 'pipeline')

    features.push({
      id: `fs${id.trim()}`,
      product,
      market,
      name,
      frf,
      prd,
      jira,
      stage,
      version,
      timeline,
      createdAt: Date.now(),
      archived: false,
    })

    const key = `${product}||${market}`
    if (!seenRowKeys.includes(key)) seenRowKeys.push(key)
  }

  const rows = seenRowKeys.map(k => {
    const [product, market] = k.split('||')
    return { product, market }
  })

  return { rows, features }
}

// ── Pending queue ────────────────────────────────────────────────
// Replaces the old flat DELETED_KEY + ARCHIVED_KEY lists.
// Shape: Array<{ id: string, action: 'archive'|'unarchive'|'delete'|'auto-archive', timestamp: number }>
const PENDING_KEY = 'timeline-tracker-pending'

function getPendingQueue() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]') } catch { return [] }
}

function setPendingQueue(queue) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(queue)) } catch {}
}

function clearPendingQueue() {
  try { localStorage.removeItem(PENDING_KEY) } catch {}
}

// Only sheet-sourced features (fs prefix) can be written back to the sheet
export function enqueuePendingAction(id, action) {
  if (!id?.startsWith('fs')) return
  const queue = getPendingQueue()
  if (queue.some(item => item.id === id)) return
  setPendingQueue([...queue, { id, action, timestamp: Date.now() }])
}

export function hasPendingAction(id) {
  return getPendingQueue().some(item => item.id === id)
}

export function getPendingCount() {
  return getPendingQueue().length
}

// ── GAS calls ────────────────────────────────────────────────────
async function gasCall(action, id) {
  const params = new URLSearchParams({ action, token: GAS_TOKEN })
  if (id) params.set('id', id)
  const res = await fetch(`${GAS_URL}?${params}`, { redirect: 'follow' })
  if (!res.ok) throw new Error(`GAS request failed: HTTP ${res.status}`)
  const data = await res.json()
  // "Not found" means the row is already gone from the sheet — treat as success
  if (data.error && !data.error.startsWith('Not found')) {
    throw new Error(`GAS error: ${data.error}`)
  }
  return data
}

async function processPendingQueue() {
  const queue = getPendingQueue()
  if (queue.length === 0) return

  for (const item of queue) {
    const gasAction =
      item.action === 'delete'                                          ? 'delete'
      : (item.action === 'archive' || item.action === 'auto-archive')  ? 'archive'
      : item.action === 'unarchive'                                    ? 'unarchive'
      : null
    if (!gasAction) continue
    await gasCall(gasAction, item.id)
  }

  clearPendingQueue()
}

async function fetchArchivedFromGAS() {
  const data = await gasCall('readArchived')
  return (data.rows || []).map(row => ({
    id:       `fs${String(row[0] || '').trim()}`,
    product:  String(row[1] || ''),
    market:   String(row[2] || ''),
    name:     String(row[3] || ''),
    frf:      String(row[4] || ''),
    prd:      String(row[5] || ''),
    jira:     String(row[6] || ''),
    stage:    'pipeline',
    version:  '',
    timeline: {},
    createdAt: Date.now(),
    archived: true,
  }))
}

// ── Main sync entry point ─────────────────────────────────────────
export async function initFromSheets() {
  // 1. Auto-assign IDs to any new rows the user left blank (best-effort)
  try { await gasCall('fillMissingIds') } catch {}

  // 2. Write any pending local actions to the sheet first
  await processPendingQueue()

  // 2. Read active features from Main tab (public CSV)
  const res = await fetch(SHEET_CSV_URL, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Sheet fetch failed: HTTP ${res.status}`)
  const text = await res.text()
  if (text.trimStart().startsWith('<')) {
    throw new Error('Sheet returned HTML — check sharing is set to "Anyone with the link can view".')
  }
  const { rows, features: activeFeatures } = parseSheetCSV(text)

  // 3. Read archived features from Archived tab (GAS)
  const archivedFeatures = await fetchArchivedFromGAS()

  return { rows, features: [...activeFeatures, ...archivedFeatures] }
}
