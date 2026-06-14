import { useState, useCallback, useEffect } from 'react'
import { STAGES, DEFAULT_ROWS, DEFAULT_FEATURES } from '../data/constants'
import { initFromSheets, enqueuePendingAction, hasPendingAction, getPendingCount } from '../data/sheets'

// config and getAccessToken are injected by App once the user has authenticated

const STORAGE_KEY = 'timeline-tracker-v3'
const SYNC_TS_KEY = 'timeline-tracker-synced-at'

function loadSyncedAt() {
  try { return Number(localStorage.getItem(SYNC_TS_KEY)) || null } catch { return null }
}
const REQUIRED_TIMELINE_STAGES = ['dev', 'qa', 'uat', 'live']

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return migrateState(JSON.parse(raw))
  } catch {}
  return migrateState({ rows: DEFAULT_ROWS, features: DEFAULT_FEATURES })
}

function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function migrateState(state) {
  const now = Date.now()
  const rows = Array.isArray(state?.rows) ? state.rows : DEFAULT_ROWS
  const features = Array.isArray(state?.features) ? state.features : DEFAULT_FEATURES

  return {
    rows,
    features: features.map(f => {
      const createdAt = typeof f.createdAt === 'number'
        ? f.createdAt
        : inferCreatedAtFromId(f.id) ?? now
      return { ...f, createdAt, archived: Boolean(f.archived) }
    }),
  }
}

function inferCreatedAtFromId(id) {
  if (!id) return null
  const m = String(id).match(/^f(\d{10,})$/) // f<epoch-ms>
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

function formatLiveDate(rangeStr) {
  if (!rangeStr) return ''
  const startStr = rangeStr.split('-')[0]
  const parts = (startStr || '').split('.')
  if (parts.length < 3) return ''
  const dt = new Date(+parts[0], +parts[1] - 1, +parts[2])
  if (isNaN(dt.getTime())) return ''
  return `Live: ${dt.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
}

// ── Date helpers ────────────────────────────────────────────────
export function parseTrackerDate(s) {
  // Expects "YYYY.MM.DD"
  if (!s) return null
  const [y, m, d] = s.split('.')
  const dt = new Date(+y, +m - 1, +d)
  dt.setHours(0, 0, 0, 0)
  return dt
}

function parseRange(rangeStr) {
  if (!rangeStr) return null
  const [start, end] = rangeStr.split('-')
  return { start: parseTrackerDate(start), end: parseTrackerDate(end) }
}

export function isTimelineRequired(stage) {
  return STAGES.indexOf(stage) >= STAGES.indexOf('scheduled')
}

export function validateRequiredTimeline(timeline) {
  const errors = []
  const t = timeline || {}

  for (const s of REQUIRED_TIMELINE_STAGES) {
    const r = parseRange(t[s])
    if (!r || !r.start || !r.end) {
      errors.push(`${s} is required`)
      continue
    }
    if (r.start > r.end) errors.push(`${s} start must be <= end`)
  }

  return { ok: errors.length === 0, errors }
}

export function hasTimelineError(feature) {
  if (!isTimelineRequired(feature?.stage)) return false
  return !validateRequiredTimeline(feature?.timeline).ok
}

/**
 * Given a feature and today's Date, return the effective display stage.
 * Timeline entries drive auto-progression for timed stages.
 * Manual stage is the floor — we only advance forward, never backward.
 */
export function computeDisplayStage(feature, today) {
  const { stage, timeline } = feature
  if (!timeline || Object.keys(timeline).length === 0) return stage

  const timedOrder = ['dev', 'qa', 'uat', 'live', 'live-testing', 'greyscale']
  let derived = stage
  let lastProvidedStage = null
  let lastProvidedRange = null

  for (const s of timedOrder) {
    if (!timeline[s]) continue
    const range = parseRange(timeline[s])
    if (!range || !range.start || !range.end) continue
    lastProvidedStage = s
    lastProvidedRange = range

    // If we're inside the window, that's the display stage
    if (today >= range.start && today <= range.end) derived = s

    // If we've passed the start, we should be at least here (unless another later window is active)
    if (today > range.start && STAGES.indexOf(derived) < STAGES.indexOf(s)) derived = s
  }

  if (lastProvidedStage && lastProvidedRange && today > lastProvidedRange.end) {
    // Past live with no post-live stages → auto-archive (display-only, written to sheet on Sync)
    if (lastProvidedStage === 'live') return 'auto-archive'
    const nextIdx = timedOrder.indexOf(lastProvidedStage) + 1
    const nextStage = timedOrder[nextIdx]
    if (nextStage) derived = nextStage
  }

  const derivedIdx = STAGES.indexOf(derived)
  const manualIdx  = STAGES.indexOf(stage)
  return derivedIdx >= manualIdx ? derived : stage
}

/**
 * Return the date-range string for the active stage, formatted for display.
 * e.g. "Dev: 2026.04.27 – 2026.05.29"
 */
export function getActiveRangeLabel(feature, displayStage) {
  const range = feature.timeline?.[displayStage]
  if (!range) return null
  const [start, end] = range.split('-')
  return `${displayStage.charAt(0).toUpperCase() + displayStage.slice(1)}: ${start} – ${end}`
}

// ── Parse timeline textarea ─────────────────────────────────────
export function parseTimelineText(text) {
  const result = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const match = trimmed.match(/^(\S+)\s+(\d{4}\.\d{2}\.\d{2}-\d{4}\.\d{2}\.\d{2})$/)
    if (match) result[match[1].toLowerCase()] = match[2]
  }
  return result
}

export function timelineToText(timeline) {
  return Object.entries(timeline || {})
    .map(([s, r]) => `${s} ${r}`)
    .join('\n')
}

// ── Hook ────────────────────────────────────────────────────────
export function useTimeline({ config, getAccessToken } = {}) {
  const [state, setState] = useState(loadFromStorage)
  const [loading, setLoading] = useState(false)
  const [syncError, setSyncError] = useState(null)
  const [lastSyncedAt, setLastSyncedAt] = useState(loadSyncedAt)

  const commit = useCallback((next) => {
    setState(next)
    save(next)
  }, [])

  const syncFromSheets = useCallback(async () => {
    if (!config) return
    setLoading(true)
    setSyncError(null)
    try {
      const d = await initFromSheets(config, getAccessToken)
      const next = migrateState(d)
      save(next)
      setState(next)
      const ts = Date.now()
      localStorage.setItem(SYNC_TS_KEY, String(ts))
      setLastSyncedAt(ts)
    } catch (err) {
      setSyncError(err.message || 'Sync failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    syncFromSheets()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-enqueue features whose live date passed with no post-live timelines
  useEffect(() => {
    state.features.forEach(f => {
      if (!f.archived && computeDisplayStage(f, today) === 'auto-archive') {
        enqueuePendingAction(f.id, 'auto-archive', formatLiveDate(f.timeline?.live))
      }
    })
  }, [state.features]) // eslint-disable-line react-hooks/exhaustive-deps

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Get all unique products / markets for autocomplete
  const products = [...new Set(state.rows.map(r => r.product))]
  const markets  = [...new Set(state.rows.map(r => r.market))]

  // Features visible in a given cell
  const featuresAt = useCallback((product, market, stage) => {
    return state.features.filter(f =>
      f.product === product &&
      f.market  === market  &&
      computeDisplayStage(f, today) === stage
    )
  }, [state.features, today])

  // Add or update feature
  const upsertFeature = useCallback((data) => {
    const { id, product, market } = data
    let next = { ...state }

    // Ensure row exists
    if (!next.rows.some(r => r.product === product && r.market === market)) {
      next.rows = [...next.rows, { product, market }]
    }

    if (id) {
      next.features = next.features.map(f => {
        if (f.id !== id) return f
        return { ...f, ...data, createdAt: typeof f.createdAt === 'number' ? f.createdAt : Date.now() }
      })
    } else {
      const createdAt = Date.now()
      next.features = [...next.features, { id: `f${createdAt}`, createdAt, archived: false, ...data }]
    }

    commit(next)
  }, [state, commit])

  const deleteFeature = useCallback((id) => {
    if (hasPendingAction(id)) return 'conflict'
    enqueuePendingAction(id, 'delete')
    commit({ ...state, features: state.features.filter(f => f.id !== id) })
  }, [state, commit])

  const setArchived = useCallback((id, archived) => {
    if (hasPendingAction(id)) return 'conflict'
    enqueuePendingAction(id, archived ? 'archive' : 'unarchive', archived ? 'Archived by user' : undefined)
    commit({
      ...state,
      features: state.features.map(f =>
        f.id === id ? { ...f, archived: Boolean(archived), archiveInfo: archived ? 'Archived by user' : undefined } : f
      ),
    })
  }, [state, commit])

  const moveFeature = useCallback((id, dir) => {
    const f = state.features.find(x => x.id === id)
    if (!f) return
    const cur = computeDisplayStage(f, today)
    const idx = STAGES.indexOf(cur)
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= STAGES.length) return
    const next = { ...f, stage: STAGES[newIdx] }
    commit({ ...state, features: state.features.map(x => x.id === id ? next : x) })
  }, [state, commit, today])

  const addRow = useCallback((product, market) => {
    if (state.rows.some(r => r.product === product && r.market === market)) return
    commit({ ...state, rows: [...state.rows, { product, market }] })
  }, [state, commit])

  const hasPendingChanges = getPendingCount() > 0 ||
    state.features.some(f => !f.archived && computeDisplayStage(f, today) === 'auto-archive')

  return {
    rows: state.rows,
    features: state.features,
    today,
    products,
    markets,
    featuresAt,
    upsertFeature,
    deleteFeature,
    setArchived,
    moveFeature,
    addRow,
    loading,
    syncError,
    lastSyncedAt,
    syncFromSheets,
    hasPendingChanges,
  }
}
