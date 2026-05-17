import { fillMissingIds, readArchivedRows, archiveRow, unarchiveRow, deleteRow } from './sheetsApi'

const STAGE_MAP = {
  pipeline: 'pipeline',
  frf: 'frf',
  prd: 'prd',
}

export function getSheetCsvUrl(config) {
  return `https://docs.google.com/spreadsheets/d/${config.sheetId}/export?format=csv&gid=${config.gid}`
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

    const hasTimeline = devRange || qaRange || uatRange || liveRange
    const stage = hasTimeline ? 'scheduled' : (STAGE_MAP[rawStage.toLowerCase()] ?? 'pipeline')

    features.push({
      id: `fs${id.trim()}`,
      product, market, name, frf, prd, jira, stage, version, timeline,
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

// ── Pending queue ─────────────────────────────────────────────────
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

// ── Sync entry point ──────────────────────────────────────────────
async function processPendingQueue(config, token) {
  const queue = getPendingQueue()
  if (queue.length === 0) return

  for (const item of queue) {
    try {
      if (item.action === 'delete') {
        await deleteRow(config, item.id, token)
      } else if (item.action === 'archive' || item.action === 'auto-archive') {
        await archiveRow(config, item.id, token)
      } else if (item.action === 'unarchive') {
        await unarchiveRow(config, item.id, token)
      }
    } catch (e) {
      console.warn(`Failed to process ${item.action} for ${item.id}:`, e)
    }
  }

  clearPendingQueue()
}

export async function initFromSheets(config, getAccessToken) {
  // 1. Get write token (best-effort — reads still work without it)
  const token = await getAccessToken()

  // 2. Fill missing IDs and flush pending writes
  if (token) {
    try { await fillMissingIds(config, token) } catch {}
    await processPendingQueue(config, token)
  }

  // 3. Read active features from the public CSV
  const csvUrl = getSheetCsvUrl(config)
  const res = await fetch(csvUrl, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Sheet fetch failed: HTTP ${res.status}`)
  const text = await res.text()
  if (text.trimStart().startsWith('<')) {
    throw new Error('Sheet returned HTML — check sharing is set to "Anyone with the link can view".')
  }
  const { rows, features: activeFeatures } = parseSheetCSV(text)

  // 4. Read archived features
  let archivedFeatures = []
  if (token) {
    try { archivedFeatures = await readArchivedRows(config, token) } catch {}
  }

  return { rows, features: [...activeFeatures, ...archivedFeatures] }
}
