import { useState, useMemo } from 'react'
import { STAGES, STAGE_LABELS } from '../data/constants'
import { computeDisplayStage } from '../hooks/useTimeline'
import { hasPendingAction } from '../data/sheets'
import { BottomSheet, Button, Input, FolderIcon, SyncIcon, ConfirmModal } from './UI'
import { UserGuide } from './UserGuide'

// ── Stage badge colours (Pantone-inspired, consistent saturation) ──────────
const MOBILE_STAGE_COLORS = {
  pipeline:       { bg: '#E6E6E6', color: '#555555' },
  frf:            { bg: '#C8D8EA', color: '#2A527A' },
  prd:            { bg: '#F0DCC8', color: '#7A4A22' },
  scheduled:      { bg: '#C8E8DA', color: '#1E6044' },
  dev:            { bg: '#C8E0C8', color: '#2A6030' },
  qa:             { bg: '#D4E8C4', color: '#486828' },
  uat:            { bg: '#E8E0C4', color: '#685820' },
  live:           { bg: '#F0C8C8', color: '#782020' },
  'live-testing': { bg: '#D8C8EA', color: '#482878' },
  greyscale:      { bg: '#D4D8DC', color: '#404850' },
  'auto-archive': { bg: '#E6E6E6', color: '#555555' },
}

// Short labels for the circular badge (max ~6 chars)
const STAGE_SHORT = {
  pipeline:       'Pipeline',
  frf:            'FRF',
  prd:            'PRD',
  scheduled:      'Sched',
  dev:            'Dev',
  qa:             'QA',
  uat:            'UAT',
  live:           'Live',
  'live-testing': 'L-Test',
  greyscale:      'Grey',
  'auto-archive': 'Archive',
}

// ── Date formatting ────────────────────────────────────────────────────────
function formatMobileRange(rangeStr) {
  if (!rangeStr) return ''
  const parts = rangeStr.split('-')
  if (parts.length < 2) return ''
  const parseD = (s) => {
    const p = (s || '').split('.')
    if (p.length < 3) return null
    const d = new Date(+p[0], +p[1] - 1, +p[2])
    return isNaN(d.getTime()) ? null : d
  }
  const start = parseD(parts[0])
  const end = parseD(parts[1])
  if (!start || !end) return rangeStr
  const currentYear = new Date().getFullYear()
  const crossYear = start.getFullYear() !== currentYear || end.getFullYear() !== currentYear
  const fmt = (d) => d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short',
    ...(crossYear ? { year: 'numeric' } : {}),
  })
  return `${fmt(start)} – ${fmt(end)}`
}

// ── Shared styles ──────────────────────────────────────────────────────────
const mobileLinkStyle = {
  fontFamily: 'var(--mono)', fontSize: 11,
  color: 'var(--accent2)', textDecoration: 'none',
}

function viewToggleBtn(active) {
  return {
    background: 'transparent',
    border: 'none',
    padding: '5px 8px 9px',
    fontSize: 11,
    fontWeight: active ? 700 : 400,
    color: active ? 'var(--text)' : 'var(--text3)',
    cursor: 'pointer',
    fontFamily: 'var(--sans)',
    whiteSpace: 'nowrap',
    transition: 'color 0.15s',
  }
}

const menuItemStyle = {
  display: 'block', width: '100%', textAlign: 'left',
  background: 'none', border: 'none',
  padding: '12px 16px',
  fontSize: 13, color: 'var(--text)',
  fontFamily: 'var(--sans)', cursor: 'pointer',
}

// ── MobileBoard (top-level) ────────────────────────────────────────────────

export function MobileBoard({
  features, rows, today,
  deleteFeature, setArchived,
  loading, syncError, lastSyncedAt, syncFromSheets,
  hasPendingChanges, clearAll,
}) {
  const [view, setView] = useState('timeline') // 'timeline' | 'product-market' | 'archive'
  const [lastMainView, setLastMainView] = useState('timeline')
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showChangeSheet, setShowChangeSheet] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [selectedFeature, setSelectedFeature] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)

  const todayLabel = today.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })

  const activeFeatures = features.filter(f =>
    !f.archived && computeDisplayStage(f, today) !== 'auto-archive'
  )
  const archivedFeatures = features.filter(f =>
    f.archived || computeDisplayStage(f, today) === 'auto-archive'
  )

  function toggleArchive() {
    if (view === 'archive') {
      setView(lastMainView)
    } else {
      setLastMainView(view)
      setView('archive')
    }
  }

  function switchMainView(v) {
    setView(v)
    setLastMainView(v)
  }

  function handleCardTap(feature) {
    setSelectedFeature(feature)
    setConfirmAction(null)
  }

  function handleArchiveConfirm() {
    if (!selectedFeature) return
    setArchived(selectedFeature.id, !selectedFeature.archived)
    setSelectedFeature(null)
    setConfirmAction(null)
  }

  function handleDeleteConfirm() {
    if (!selectedFeature) return
    deleteFeature(selectedFeature.id)
    setSelectedFeature(null)
    setConfirmAction(null)
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <header style={{ flex: '0 0 auto' }}>

        {/* Row 1: dark menu bar — sync status + buttons right-aligned */}
        <div style={{
          background: 'var(--header, #e8e8e8)',
          borderBottom: '1px solid var(--border)',
          padding: '7px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6,
        }}>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 9,
            color: syncError ? 'var(--red)' : 'var(--text3)',
            whiteSpace: 'nowrap', marginRight: 4,
          }}>
            {syncError
              ? 'Sync failed'
              : lastSyncedAt
                ? `Synced ${new Date(lastSyncedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
                : 'Local data'}
          </span>
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <Button variant="ghost" size="sm" onClick={syncFromSheets} disabled={loading}>
              <SyncIcon size={11} />{loading ? 'Syncing…' : 'Sync'}
            </Button>
            {hasPendingChanges && !loading && (
              <span style={{
                position: 'absolute', top: 1, right: 1,
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--red)', pointerEvents: 'none',
              }} />
            )}
          </div>
          <Button variant={view === 'archive' ? 'primary' : 'ghost'} size="sm" onClick={toggleArchive}>
            <FolderIcon size={11} /> Archive
          </Button>
          {/* ··· overflow menu */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowMoreMenu(v => !v)}
              style={{
                background: 'transparent', border: '1px solid var(--border2)',
                borderRadius: 6, color: 'var(--text2)',
                fontSize: 14, fontWeight: 700,
                cursor: 'pointer', padding: '4px 8px', lineHeight: 1,
              }}
            >
              ···
            </button>
            {showMoreMenu && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                background: 'var(--surface)', border: '1px solid var(--border2)',
                borderRadius: 8, overflow: 'hidden', zIndex: 200,
                minWidth: 160, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              }}>
                <button style={menuItemStyle} onClick={() => { setShowGuide(true); setShowMoreMenu(false) }}>User Guide</button>
                <button style={{ ...menuItemStyle, borderTop: '1px solid var(--border)' }}
                  onClick={() => { setShowChangeSheet(true); setShowMoreMenu(false) }}>Change Sheet</button>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: TIMELINE + date, left-aligned */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px 6px' }}>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Timeline
          </span>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 10,
            color: 'var(--text2)', background: 'var(--surface2)',
            border: '1px solid var(--border)',
            padding: '3px 10px', borderRadius: 20,
          }}>
            {todayLabel}
          </span>
        </div>

        {/* Row 3: view toggle, left-aligned, smaller — hidden in archive */}
        {view !== 'archive' && (
          <div style={{ display: 'flex', gap: 0, padding: '0 6px' }}>
            <button onClick={() => switchMainView('timeline')} style={viewToggleBtn(view === 'timeline')}>
              Product Market View
            </button>
            <button onClick={() => switchMainView('product-market')} style={viewToggleBtn(view === 'product-market')}>
              Timeline View
            </button>
          </div>
        )}
      </header>

      {/* Close more menu backdrop */}
      {showMoreMenu && (
        <div
          onClick={() => setShowMoreMenu(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 150 }}
        />
      )}

      {/* Banners */}
      {syncError && (
        <div style={{ background: '#c23a3a18', borderBottom: '1px solid #c23a3a44', padding: '6px 14px', fontSize: 11, color: 'var(--red)', flex: '0 0 auto', display: 'flex', justifyContent: 'space-between' }}>
          <span>Sync failed</span>
          <button onClick={syncFromSheets} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 11, textDecoration: 'underline', padding: 0 }}>Retry</button>
        </div>
      )}
      {hasPendingChanges && !syncError && (
        <div style={{ background: '#f5a62318', borderBottom: '1px solid #f5a62344', padding: '5px 14px', fontSize: 10, color: 'var(--amber)', fontFamily: 'var(--mono)', flex: '0 0 auto' }}>
          Unsynced changes — sync before making further changes.
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: '1 1 auto', overflowY: 'auto' }}>
        {view === 'archive' ? (
          <MobileArchiveView
            features={archivedFeatures}
            onUnarchive={(id) => setArchived(id, false)}
          />
        ) : view === 'timeline' ? (
          <MobileTimelineView
            features={activeFeatures}
            rows={rows}
            today={today}
            onCardTap={handleCardTap}
          />
        ) : (
          <MobileProductMarketView
            features={activeFeatures}
            today={today}
            onCardTap={handleCardTap}
          />
        )}
      </div>

      {/* Feature detail bottom sheet */}
      <BottomSheet
        open={Boolean(selectedFeature)}
        onClose={() => { setSelectedFeature(null); setConfirmAction(null) }}
      >
        {selectedFeature && !confirmAction && (
          <MobileFeatureDetail
            feature={selectedFeature}
            today={today}
            onArchive={() => {
              if (hasPendingAction(selectedFeature.id)) {
                setConfirmAction('conflict')
              } else {
                setConfirmAction('archive')
              }
            }}
            onDelete={() => {
              if (hasPendingAction(selectedFeature.id)) {
                setConfirmAction('conflict')
              } else {
                setConfirmAction('delete')
              }
            }}
          />
        )}
        {selectedFeature && confirmAction === 'conflict' && (
          <MobileInlineMessage
            message="This feature has a pending action. Please sync before making further changes."
            onClose={() => setConfirmAction(null)}
          />
        )}
        {selectedFeature && confirmAction === 'archive' && (
          <MobileConfirmAction
            title={selectedFeature.archived ? 'Unarchive feature?' : 'Archive feature?'}
            message={selectedFeature.archived
              ? `"${selectedFeature.name}" will be moved back to the main board.`
              : `"${selectedFeature.name}" will be archived. You can restore it from the Archive view.`}
            confirmLabel={selectedFeature.archived ? 'Unarchive' : 'Archive'}
            confirmVariant="ghost"
            onConfirm={handleArchiveConfirm}
            onCancel={() => setConfirmAction(null)}
          />
        )}
        {selectedFeature && confirmAction === 'delete' && (
          <MobileConfirmAction
            title="Delete feature?"
            message={`"${selectedFeature.name}" will be permanently removed from the tracker.`}
            confirmLabel="Delete"
            confirmVariant="danger"
            onConfirm={handleDeleteConfirm}
            onCancel={() => setConfirmAction(null)}
          />
        )}
      </BottomSheet>

      <UserGuide open={showGuide} onClose={() => setShowGuide(false)} />

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

// ── Timeline View ──────────────────────────────────────────────────────────

function MobileTimelineView({ features, rows, today, onCardTap }) {
  const [collapsed, setCollapsed] = useState({})

  const grouped = useMemo(() => {
    const productOrder = []
    rows.forEach(r => { if (!productOrder.includes(r.product)) productOrder.push(r.product) })

    return productOrder.flatMap(product => {
      const marketOrder = rows.filter(r => r.product === product).map(r => r.market)
      const markets = marketOrder.flatMap(market => {
        const mFeatures = features.filter(f => f.product === product && f.market === market)
        return mFeatures.length > 0 ? [{ market, features: mFeatures }] : []
      })
      return markets.length > 0 ? [{ product, markets }] : []
    })
  }, [features, rows])

  function toggle(product) {
    setCollapsed(c => ({ ...c, [product]: !c[product] }))
  }

  if (grouped.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: 48 }}>
        No active features.
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 14px' }}>
      {grouped.map(({ product, markets }) => (
        <div key={product} style={{ marginBottom: 16 }}>
          {/* Product header */}
          <button
            onClick={() => toggle(product)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', background: 'none', border: 'none',
              padding: '6px 4px', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{product}</span>
            <span style={{
              display: 'inline-block',
              fontSize: 12, color: 'var(--border2)',
              fontWeight: 300, lineHeight: 1,
              transform: collapsed[product] ? 'none' : 'rotate(90deg)',
              transition: 'transform 0.15s',
            }}>›</span>
          </button>

          {!collapsed[product] && markets.map(({ market, features: mFeatures }) => (
            <div key={market} style={{ marginBottom: 6 }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: 'var(--text3)',
                paddingLeft: 4, marginBottom: 6, marginTop: 4,
                fontFamily: 'var(--mono)', letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}>
                {market}
              </div>
              {mFeatures.map(f => (
                <MobileFeatureCard
                  key={f.id}
                  feature={f}
                  today={today}
                  onTap={() => onCardTap(f)}
                />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Product Market View ────────────────────────────────────────────────────

function MobileProductMarketView({ features, today, onCardTap }) {
  const [filterProduct, setFilterProduct] = useState('')
  const [filterMarket, setFilterMarket] = useState('')
  const [collapsed, setCollapsed] = useState({})

  // Cascading: each dropdown only shows options that have features
  const availableProducts = useMemo(() => {
    const pool = filterMarket ? features.filter(f => f.market === filterMarket) : features
    return [...new Set(pool.map(f => f.product))].sort()
  }, [features, filterMarket])

  const availableMarkets = useMemo(() => {
    const pool = filterProduct ? features.filter(f => f.product === filterProduct) : features
    return [...new Set(pool.map(f => f.market))].sort()
  }, [features, filterProduct])

  function handleProductChange(p) {
    setFilterProduct(p)
    if (!p) setFilterMarket('')
  }

  function handleMarketChange(m) {
    setFilterMarket(m)
    if (!m) setFilterProduct('')
  }

  const filtered = features.filter(f => {
    if (filterProduct && f.product !== filterProduct) return false
    if (filterMarket && f.market !== filterMarket) return false
    return true
  })

  const stagesWithFeatures = useMemo(() =>
    STAGES.filter(s => filtered.some(f => computeDisplayStage(f, today) === s))
  , [filtered, today])

  return (
    <div style={{ padding: '12px 14px' }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <select
          value={filterProduct}
          onChange={e => handleProductChange(e.target.value)}
          style={mobileSelectStyle}
        >
          <option value="">All Products</option>
          {availableProducts.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          value={filterMarket}
          onChange={e => handleMarketChange(e.target.value)}
          style={mobileSelectStyle}
        >
          <option value="">All Markets</option>
          {availableMarkets.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {stagesWithFeatures.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: 40 }}>
          No features match the selected filters.
        </div>
      )}

      {stagesWithFeatures.map(stage => {
        const stageFeatures = filtered.filter(f => computeDisplayStage(f, today) === stage)
        const sc = MOBILE_STAGE_COLORS[stage] || MOBILE_STAGE_COLORS.pipeline
        const isCollapsed = collapsed[stage]
        return (
          <div key={stage} style={{ marginBottom: 16 }}>
            <button
              onClick={() => setCollapsed(c => ({ ...c, [stage]: !c[stage] }))}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                padding: '2px 0', marginBottom: isCollapsed ? 0 : 8,
              }}
            >
              <div style={{
                background: sc.bg, color: sc.color,
                padding: '3px 12px', borderRadius: 6,
                fontSize: 11, fontWeight: 700,
                fontFamily: 'var(--mono)', letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}>
                {STAGE_LABELS[stage] || stage}
              </div>
              <span style={{
                display: 'inline-block',
                fontSize: 12, color: 'var(--border2)',
                fontWeight: 300, lineHeight: 1,
                transform: isCollapsed ? 'none' : 'rotate(90deg)',
                transition: 'transform 0.15s',
              }}>›</span>
            </button>
            {!isCollapsed && stageFeatures.map(f => (
              <MobileFeatureCard
                key={f.id}
                feature={f}
                today={today}
                onTap={() => onCardTap(f)}
                showProductMarket
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}

const mobileSelectStyle = {
  flex: 1,
  background: 'var(--bg)',
  border: '1px solid var(--border2)',
  borderRadius: 6,
  color: 'var(--text2)',
  fontFamily: 'var(--sans)',
  fontSize: 11,
  padding: '5px 8px',
  outline: 'none',
  minWidth: 0,
}

// ── Feature Card (shared by both views) ───────────────────────────────────

function MobileFeatureCard({ feature, today, onTap, showProductMarket }) {
  const displayStage = computeDisplayStage(feature, today)
  const sc = MOBILE_STAGE_COLORS[displayStage] || MOBILE_STAGE_COLORS.pipeline
  const stageKey = displayStage === 'auto-archive' ? 'live' : displayStage
  const rangeStr = feature.timeline?.[stageKey]
  const rangeLabel = formatMobileRange(rangeStr)


  return (
    <div
      onClick={onTap}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '12px 12px 12px 14px',
        marginBottom: 8,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 3, lineHeight: 1.3 }}>
          {feature.name}
        </div>
        {(feature.frf || feature.prd || feature.jira) && (
          <div style={{ display: 'flex', gap: 8, marginBottom: rangeLabel ? 3 : 0 }}>
            {feature.frf && (
              <a href={feature.frf} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()} style={mobileLinkStyle}>FRF</a>
            )}
            {feature.prd && (
              <a href={feature.prd} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()} style={mobileLinkStyle}>PRD</a>
            )}
            {feature.jira && (
              <a href={feature.jira} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()} style={mobileLinkStyle}>Jira</a>
            )}
          </div>
        )}
        {rangeLabel && (
          <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
            {STAGE_LABELS[stageKey] || stageKey}: {rangeLabel}
          </div>
        )}
      </div>

      {/* Tag: product+market square in PM view, stage circle in timeline view */}
      {showProductMarket ? (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border2)',
          borderRadius: 8,
          width: 54, flexShrink: 0,
          padding: '6px 4px',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 9.5, fontWeight: 600,
          fontFamily: 'var(--sans)',
          color: 'var(--text2)',
          textAlign: 'center', lineHeight: 1.35,
        }}>
          <span>{feature.product}</span>
          <span>{feature.market}</span>
        </div>
      ) : (
        <div style={{
          background: sc.bg, color: sc.color,
          borderRadius: '50%',
          width: 46, height: 46, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 700,
          fontFamily: 'var(--mono)', letterSpacing: '0.04em',
          textAlign: 'center', lineHeight: 1.25,
          padding: 4,
        }}>
          {(STAGE_SHORT[displayStage] || displayStage).split(' ').map((w, i) => (
            <span key={i} style={{ display: 'block' }}>{w}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Archive View ───────────────────────────────────────────────────────────

function MobileArchiveView({ features, onUnarchive }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const filtered = features.filter(f => (f?.name || '').toLowerCase().includes(q))

  return (
    <div style={{ padding: '12px 14px' }}>
      <Input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search archived features…"
        style={{ marginBottom: 12, width: '100%', boxSizing: 'border-box' }}
      />
      {filtered.map(f => (
        <div key={f.id} style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '12px 14px',
          marginBottom: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                {f.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: f.archiveInfo ? 2 : 0 }}>
                {f.product} · {f.market}
              </div>
              {f.archiveInfo && (
                <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                  {f.archiveInfo}
                </div>
              )}
              {(f.prd || f.jira) && (
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  {f.prd && <a href={f.prd} target="_blank" rel="noopener noreferrer" style={mobileLinkStyle}>PRD ↗</a>}
                  {f.jira && <a href={f.jira} target="_blank" rel="noopener noreferrer" style={mobileLinkStyle}>Jira ↗</a>}
                </div>
              )}
            </div>
            <button
              onClick={() => onUnarchive(f.id)}
              style={{
                background: 'none', border: '1px solid var(--border2)',
                borderRadius: 6, cursor: 'pointer',
                fontSize: 10, color: 'var(--text2)',
                padding: '5px 10px', whiteSpace: 'nowrap',
                fontFamily: 'var(--mono)', flexShrink: 0,
              }}
            >
              Unarchive
            </button>
          </div>
        </div>
      ))}
      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: 40 }}>
          No archived features found.
        </div>
      )}
    </div>
  )
}

// ── Feature Detail (inside bottom sheet) ──────────────────────────────────

function MobileFeatureDetail({ feature, today, onArchive, onDelete }) {
  const hasTimeline = feature.timeline && Object.keys(feature.timeline).length > 0
  const archived = Boolean(feature.archived)

  const timelineFields = [
    { key: 'dev', label: 'Dev' },
    { key: 'qa', label: 'QA' },
    { key: 'uat', label: 'UAT' },
    { key: 'live', label: 'Live' },
    { key: 'live-testing', label: 'Live Testing' },
    { key: 'greyscale', label: 'Greyscale' },
  ]

  const rows = []
  if (feature.version) rows.push({ label: 'Version', value: feature.version, isLive: false })
  timelineFields.forEach(({ key, label }) => {
    const value = feature.timeline?.[key]
    if (!value) return
    rows.push({ label, value: formatMobileRange(value), isLive: key === 'live' })
  })

  return (
    <div>
      {/* Feature header */}
      <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, marginBottom: 3 }}>
          {feature.name}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 6 }}>
          {feature.product} · {feature.market}
        </div>
        {(feature.frf || feature.prd || feature.jira) && (
          <div style={{ display: 'flex', gap: 12 }}>
            {feature.frf && <a href={feature.frf} target="_blank" rel="noopener noreferrer" style={{ ...mobileLinkStyle, fontSize: 12 }}>FRF ↗</a>}
            {feature.prd && <a href={feature.prd} target="_blank" rel="noopener noreferrer" style={{ ...mobileLinkStyle, fontSize: 12 }}>PRD ↗</a>}
            {feature.jira && <a href={feature.jira} target="_blank" rel="noopener noreferrer" style={{ ...mobileLinkStyle, fontSize: 12 }}>Jira ↗</a>}
          </div>
        )}
      </div>

      {/* Timeline */}
      {hasTimeline ? (
        <div style={{ marginBottom: 16 }}>
          {rows.map(({ label, value, isLive }, i) => (
            <div
              key={label}
              style={{
                display: 'flex', alignItems: 'baseline',
                justifyContent: 'space-between', gap: 16,
                padding: isLive ? '8px 10px' : '10px 0',
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                ...(isLive ? {
                  background: '#f5a62315',
                  border: '1px solid #f5a62330',
                  borderRadius: 6, marginTop: 4,
                } : {}),
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: isLive ? 'var(--amber)' : 'var(--text)', flexShrink: 0 }}>
                {label}
              </div>
              <div style={{ fontSize: 12, color: isLive ? 'var(--amber)' : 'var(--text3)', fontFamily: 'var(--mono)', textAlign: 'right' }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.6 }}>
          Stage and timeline changes can only be made in the Google Sheet. Sync after updating.
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <Button variant="ghost" size="sm" onClick={onArchive} style={{ flex: 1, justifyContent: 'center' }}>
          {archived ? 'Unarchive' : 'Archive'}
        </Button>
        <Button variant="danger" size="sm" onClick={onDelete} style={{ flex: 1, justifyContent: 'center' }}>
          Delete
        </Button>
      </div>
    </div>
  )
}

// ── Confirm action (inside bottom sheet) ──────────────────────────────────

function MobileConfirmAction({ title, message, confirmLabel, confirmVariant = 'ghost', onConfirm, onCancel }) {
  return (
    <div style={{ paddingTop: 4 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 20 }}>{message}</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Button variant="ghost" size="sm" onClick={onCancel} style={{ flex: 1, justifyContent: 'center' }}>Cancel</Button>
        <Button variant={confirmVariant} size="sm" onClick={onConfirm} style={{ flex: 1, justifyContent: 'center' }}>{confirmLabel}</Button>
      </div>
    </div>
  )
}

function MobileInlineMessage({ message, onClose }) {
  return (
    <div style={{ paddingTop: 4 }}>
      <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 20 }}>{message}</div>
      <Button variant="ghost" size="sm" onClick={onClose} style={{ width: '100%', justifyContent: 'center' }}>OK</Button>
    </div>
  )
}
