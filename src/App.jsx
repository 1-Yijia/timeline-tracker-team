import { useEffect, useMemo, useState } from 'react'
import { track, identifyUser } from './analytics.js'
import { STAGES, STAGE_LABELS } from './data/constants'
import { useTimeline, computeDisplayStage } from './hooks/useTimeline'
import { useSheetConfig } from './hooks/useSheetConfig'
import { OnboardingScreen, ReauthScreen } from './components/OnboardingScreen'
import { FeatureCard } from './components/FeatureCard'
import { Button, Input, FolderIcon, SyncIcon, BookIcon, SheetIcon, ConfirmModal } from './components/UI'
import { UserGuide } from './components/UserGuide'
import { MobileBoard } from './components/MobileBoard'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

const COL_PRODUCT = 70
const COL_MARKET = 74
const STAGE_COL_MIN = 74
const STAGE_COL_MAX = 140
const EXTRA_STAGES = ['live-testing', 'greyscale']
const BOARD_STAGES = STAGES.filter(s => !EXTRA_STAGES.includes(s))

function computeSpans(rowList) {
  const ps = {}, ms = {}
  rowList.forEach(row => {
    ps[row.product] = (ps[row.product] || 0) + 1
    const mk = `${row.product}||${row.market}`
    ms[mk] = (ms[mk] || 0) + 1
  })
  return { productSpans: ps, marketSpans: ms }
}

// ── Top-level gate ────────────────────────────────────────────────

export default function App() {
  const sheetConfig = useSheetConfig()
  const { authState, clientId, saveConfig, saveToken, clearAll, setAuthState } = sheetConfig

  if (authState === 'loading') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)',
      }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text3)' }}>
          Loading…
        </span>
      </div>
    )
  }

  if (authState === 'onboarding') {
    return (
      <OnboardingScreen
        clientId={clientId}
        saveConfig={saveConfig}
        saveToken={saveToken}
        setAuthState={setAuthState}
      />
    )
  }

  if (authState === 'reauth') {
    return (
      <ReauthScreen
        clientId={clientId}
        saveToken={saveToken}
        setAuthState={setAuthState}
      />
    )
  }

  return <Board sheetConfig={sheetConfig} />
}

// ── Board (only mounts when authState === 'ready') ────────────────

function Board({ sheetConfig }) {
  const { config, getAccessToken, clearAll } = sheetConfig
  const isMobile = useIsMobile()

  const {
    rows, features, today,
    deleteFeature, setArchived,
    loading, syncError, lastSyncedAt, syncFromSheets,
    hasPendingChanges,
  } = useTimeline({ config, getAccessToken })

  const [stageColWidth, setStageColWidth] = useState(STAGE_COL_MAX)
  const [activeTab, setActiveTab] = useState('active')
  const [archiveQuery, setArchiveQuery] = useState('')
  const [archiveSort, setArchiveSort] = useState('desc')
  const [showChangeSheet, setShowChangeSheet] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    identifyUser(getAccessToken)
    track('app_loaded')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function recompute() {
      const available = window.innerWidth - (COL_PRODUCT + COL_MARKET)
      const w = Math.floor(available / BOARD_STAGES.length)
      setStageColWidth(Math.max(STAGE_COL_MIN, Math.min(STAGE_COL_MAX, w)))
    }
    recompute()
    window.addEventListener('resize', recompute)
    return () => window.removeEventListener('resize', recompute)
  }, [])

  const todayLabel = today.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })

  const showArchived = activeTab === 'archived'

  const sortedRows = useMemo(() => {
    const productOrder = []
    rows.forEach(r => { if (!productOrder.includes(r.product)) productOrder.push(r.product) })
    return [...rows].sort((a, b) => {
      const pi = productOrder.indexOf(a.product) - productOrder.indexOf(b.product)
      if (pi !== 0) return pi
      return rows.indexOf(a) - rows.indexOf(b)
    })
  }, [rows])

  function featuresAtView(product, market, stage) {
    return features.filter(f =>
      f.product === product &&
      f.market === market &&
      !f.archived &&
      computeDisplayStage(f, today) === stage
    )
  }

  function rowHasFeatureIn(row, stages) {
    return stages.some(stage => featuresAtView(row.product, row.market, stage).length > 0)
  }

  const boardRows = useMemo(() =>
    sortedRows.filter(row => rowHasFeatureIn(row, BOARD_STAGES))
  , [sortedRows, features, today]) // eslint-disable-line react-hooks/exhaustive-deps

  const boardSpans = useMemo(() => computeSpans(boardRows), [boardRows])

  const postLiveRows = useMemo(() =>
    sortedRows.filter(row => rowHasFeatureIn(row, EXTRA_STAGES))
  , [sortedRows, features, today]) // eslint-disable-line react-hooks/exhaustive-deps

  const postLiveSpans = useMemo(() => computeSpans(postLiveRows), [postLiveRows])

  if (isMobile) {
    return (
      <MobileBoard
        features={features}
        rows={rows}
        today={today}
        deleteFeature={deleteFeature}
        setArchived={setArchived}
        loading={loading}
        syncError={syncError}
        lastSyncedAt={lastSyncedAt}
        syncFromSheets={syncFromSheets}
        hasPendingChanges={hasPendingChanges}
        clearAll={clearAll}
      />
    )
  }

  return (
    <div style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* ── HEADER ── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 28px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
        gap: 16,
        flex: '0 0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{
            fontSize: 14, fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            Timeline
          </span>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 11,
            color: 'var(--text2)',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            padding: '4px 10px', borderRadius: 20,
          }}>
            {todayLabel}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 10,
            color: syncError ? 'var(--red)' : 'var(--text3)',
            whiteSpace: 'nowrap',
          }}>
            {syncError
              ? 'Sync failed'
              : lastSyncedAt
                ? `Synced ${new Date(lastSyncedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
                : 'Local data'}
          </span>
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <Button variant="ghost" size="sm" onClick={() => { track('sync_triggered'); syncFromSheets() }} disabled={loading}>
              <SyncIcon size={12} />{loading ? 'Syncing…' : 'Sync'}
            </Button>
            {hasPendingChanges && !loading && (
              <span style={{
                position: 'absolute', top: 1, right: 1,
                width: 7, height: 7, borderRadius: '50%',
                background: 'var(--red)', pointerEvents: 'none',
              }} />
            )}
          </div>
          <Button
            variant={activeTab === 'archived' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => { const next = activeTab === 'archived' ? 'active' : 'archived'; if (next === 'archived') track('archive_tab_opened'); setActiveTab(next) }}
          >
            <FolderIcon size={12} /> Archive
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { track('user_guide_opened'); setShowGuide(true) }}>
            <BookIcon size={12} />User guide
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { track('change_sheet_initiated'); setShowChangeSheet(true) }}>
            <SheetIcon size={12} />Change sheet
          </Button>
        </div>
      </header>

      <UserGuide open={showGuide} onClose={() => setShowGuide(false)} />

      {syncError && (
        <div style={{
          background: '#c23a3a18',
          borderBottom: '1px solid #c23a3a44',
          padding: '8px 28px',
          fontSize: 12,
          color: 'var(--red)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flex: '0 0 auto',
        }}>
          <span>{syncError}</span>
          <button
            onClick={() => syncFromSheets()}
            style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--sans)', textDecoration: 'underline', padding: 0 }}
          >
            Retry
          </button>
        </div>
      )}

      {hasPendingChanges && !syncError && (
        <div style={{
          background: '#f5a62318',
          borderBottom: '1px solid #f5a62344',
          padding: '6px 28px',
          fontSize: 11,
          color: 'var(--amber)',
          fontFamily: 'var(--mono)',
          flex: '0 0 auto',
        }}>
          Unsynced changes — sync before performing other actions.
        </div>
      )}

      {showArchived ? (
        <ArchiveView
          features={features.filter(f => f.archived || computeDisplayStage(f, today) === 'auto-archive')}
          query={archiveQuery}
          setQuery={setArchiveQuery}
          sortDir={archiveSort}
          setSortDir={setArchiveSort}
          onUnarchive={(id) => setArchived(id, false)}
        />
      ) : (
        <div style={{ padding: '0 0 24px', overflowY: 'auto', overflowX: 'hidden', flex: '1 1 auto', background: 'var(--bg)' }}>
          <table style={{
            borderCollapse: 'separate', borderSpacing: 0,
            width: '100%',
            tableLayout: 'fixed',
          }}>
            <thead>
              <tr>
                <th style={thStyle({ width: COL_PRODUCT, left: 0 })}>Product</th>
                <th style={thStyle({ width: COL_MARKET, left: COL_PRODUCT })}>Market</th>
                {BOARD_STAGES.map(s => (
                  <th key={s} style={thStyle({ width: stageColWidth })}>
                    {STAGE_LABELS[s]}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {boardRows.map((row, ri) => {
                const prev = boardRows[ri - 1]
                const isFirstProduct = !prev || prev.product !== row.product
                const isFirstMarket  = !prev || prev.product !== row.product || prev.market !== row.market
                return (
                  <tr key={`${row.product}-${row.market}-${ri}`}>
                    {isFirstProduct && (
                      <td rowSpan={boardSpans.productSpans[row.product]} style={{ ...tdLabel, left: 0, zIndex: 40, background: 'var(--surface2)', borderRight: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', lineHeight: 1.15 }}>
                          {row.product}
                        </span>
                      </td>
                    )}
                    {isFirstMarket && (
                      <td rowSpan={boardSpans.marketSpans[`${row.product}||${row.market}`]} style={{ ...tdLabel, left: COL_PRODUCT, zIndex: 40, background: 'var(--surface2)', borderRight: '1px solid var(--border2)' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', lineHeight: 1.15 }}>
                          {row.market}
                        </span>
                      </td>
                    )}
                    {BOARD_STAGES.map(stage => {
                      const cellFeatures = featuresAtView(row.product, row.market, stage)
                      return (
                        <td key={stage} style={tdCell}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {cellFeatures.map(f => (
                              <FeatureCard
                                key={f.id}
                                feature={f}
                                displayStage={computeDisplayStage(f, today)}
                                onDelete={deleteFeature}
                                onArchive={setArchived}
                              />
                            ))}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>

          {postLiveRows.length > 0 && <div style={{ padding: '12px 0 0' }}>
            <div style={{
              padding: '0 0 8px',
              fontFamily: 'var(--mono)',
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text3)',
            }}>
              Post-live
            </div>
            <table style={{
              borderCollapse: 'separate', borderSpacing: 0,
              width: '100%',
              tableLayout: 'fixed',
            }}>
              <thead>
                <tr>
                  <th style={thStyle({ width: COL_PRODUCT, left: 0 })}>Product</th>
                  <th style={thStyle({ width: COL_MARKET, left: COL_PRODUCT })}>Market</th>
                  {EXTRA_STAGES.map(s => (
                    <th key={s} style={thStyle({ width: stageColWidth })}>
                      {STAGE_LABELS[s]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {postLiveRows.map((row, ri) => {
                  const prev = postLiveRows[ri - 1]
                  const isFirstProduct = !prev || prev.product !== row.product
                  const isFirstMarket  = !prev || prev.product !== row.product || prev.market !== row.market
                  return (
                    <tr key={`post-${row.product}-${row.market}-${ri}`}>
                      {isFirstProduct && (
                        <td rowSpan={postLiveSpans.productSpans[row.product]} style={{ ...tdLabel, left: 0, zIndex: 40, background: 'var(--surface2)', borderRight: '1px solid var(--border)' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', lineHeight: 1.15 }}>
                            {row.product}
                          </span>
                        </td>
                      )}
                      {isFirstMarket && (
                        <td rowSpan={postLiveSpans.marketSpans[`${row.product}||${row.market}`]} style={{ ...tdLabel, left: COL_PRODUCT, zIndex: 40, background: 'var(--surface2)', borderRight: '1px solid var(--border2)' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', lineHeight: 1.15 }}>
                            {row.market}
                          </span>
                        </td>
                      )}
                      {EXTRA_STAGES.map(stage => {
                        const cellFeatures = featuresAtView(row.product, row.market, stage)
                        return (
                          <td key={stage} style={tdCell}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {cellFeatures.map(f => (
                                <FeatureCard
                                  key={f.id}
                                  feature={f}
                                  displayStage={computeDisplayStage(f, today)}
                                  onDelete={deleteFeature}
                                  onArchive={setArchived}
                                />
                              ))}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>}
        </div>
      )}

      {/* Change sheet confirmation */}
      <ConfirmModal
        open={showChangeSheet}
        onClose={() => setShowChangeSheet(false)}
        onConfirm={clearAll}
        title="Change sheet"
        message="This will disconnect your current sheet and clear all local cached data. You will need to bind a new sheet to continue."
        confirmLabel="Disconnect & change"
        confirmVariant="danger"
      />
    </div>
  )
}

function ArchiveView({ features, query, setQuery, sortDir, setSortDir, onUnarchive }) {
  const q = (query || '').trim().toLowerCase()
  const filtered = features
    .filter(f => (f?.name || '').toLowerCase().includes(q))
    .sort((a, b) => {
      const av = a.archiveInfo || ''
      const bv = b.archiveInfo || ''
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })

  return (
    <div style={{ padding: '14px 28px 24px', overflowY: 'auto', overflowX: 'hidden', flex: '1 1 auto', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search archived features by name…"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')}
        >
          Date {sortDir === 'desc' ? '↓' : '↑'}
        </Button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 860 }}>
          <thead>
            <tr>
              <th style={archiveTh}>Feature</th>
              <th style={archiveTh}>Product</th>
              <th style={archiveTh}>Market</th>
              <th style={archiveTh}>PRD</th>
              <th style={archiveTh}>Jira</th>
              <th style={{ ...archiveTh, textAlign: 'right' }}>Archive Info</th>
              <th style={{ ...archiveTh, borderRight: 'none' }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(f => (
              <tr key={f.id}>
                <td style={archiveTdStrong}>{f.name}</td>
                <td style={archiveTd}>{f.product}</td>
                <td style={archiveTd}>{f.market}</td>
                <td style={archiveTd}>
                  {f.prd ? (
                    <a href={f.prd} target="_blank" rel="noopener noreferrer" style={archiveLink}>Open ↗</a>
                  ) : <span style={{ color: 'var(--text3)' }}>—</span>}
                </td>
                <td style={archiveTd}>
                  {f.jira ? (
                    <a href={f.jira} target="_blank" rel="noopener noreferrer" style={archiveLink}>Open ↗</a>
                  ) : <span style={{ color: 'var(--text3)' }}>—</span>}
                </td>
                <td style={{ ...archiveTd, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11 }}>
                  {f.archiveInfo || <span style={{ color: 'var(--text3)' }}>—</span>}
                </td>
                <td style={{ ...archiveTd, borderRight: 'none', textAlign: 'right' }}>
                  <button
                    onClick={() => onUnarchive(f.id)}
                    style={{
                      background: 'none', border: '1px solid var(--border2)',
                      borderRadius: 5, cursor: 'pointer',
                      fontFamily: 'var(--mono)', fontSize: 10,
                      color: 'var(--text2)', padding: '3px 8px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Unarchive
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...archiveTd, padding: '18px 12px', color: 'var(--text3)' }}>
                  No archived features found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}


const archiveTh = {
  fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 500,
  letterSpacing: '0.12em', textTransform: 'uppercase',
  color: 'var(--text3)', padding: '10px 12px',
  borderBottom: '1px solid var(--grid-v)', borderRight: '1px solid var(--grid-v)',
  textAlign: 'left', background: 'var(--header)',
  position: 'sticky', top: 0, zIndex: 2,
}
const archiveTd = {
  padding: '10px 12px',
  borderBottom: '1px solid var(--grid-h)', borderRight: '1px solid var(--grid-v)',
  color: 'var(--text2)', background: 'var(--surface)',
}
const archiveTdStrong = { ...archiveTd, color: 'var(--text)', fontWeight: 700 }
const archiveLink = { color: 'var(--accent2)', textDecoration: 'none', fontFamily: 'var(--mono)', fontSize: 11 }

function thStyle({ width, left }) {
  const isStickyCol = typeof left === 'number'
  return {
    fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 500,
    letterSpacing: '0.12em', textTransform: 'uppercase',
    color: 'var(--text3)', padding: '8px 10px',
    textAlign: 'left',
    borderBottom: '1px solid var(--grid-v)', borderRight: '1px solid var(--grid-v)',
    whiteSpace: 'nowrap', position: 'sticky', top: 0,
    background: 'var(--header)',
    zIndex: isStickyCol ? 90 : 80,
    width, minWidth: width,
    ...(isStickyCol ? { left } : {}),
  }
}

const tdLabel = {
  verticalAlign: 'top', padding: '8px 10px',
  borderBottom: '1px solid var(--grid-h)', borderRight: '1px solid var(--grid-v)',
  background: 'var(--surface)', position: 'sticky',
  whiteSpace: 'normal', wordBreak: 'break-word', hyphens: 'auto', minWidth: 0,
}

const tdCell = {
  verticalAlign: 'top', padding: '6px 6px',
  borderBottom: '1px solid var(--grid-h)', borderRight: '1px solid var(--grid-v)',
  background: 'var(--bg)', minWidth: 0,
}
