import { useState, useRef } from 'react'
import { getActiveRangeLabel } from '../hooks/useTimeline'
import { hasPendingAction } from '../data/sheets'
import { ConfirmModal, InfoModal, FolderIcon } from './UI'

export function FeatureCard({ feature, displayStage, onDelete, onArchive }) {
  const [hovered, setHovered] = useState(false)
  const [confirm, setConfirm] = useState(null) // null | 'delete' | 'archive'
  const [showInfo, setShowInfo] = useState(false)
  const [showConflict, setShowConflict] = useState(false)
  const leaveTimer = useRef(null)
  const rangeLabel = getActiveRangeLabel(feature, displayStage)
  const archived = Boolean(feature.archived)

  const handleEnter = () => { clearTimeout(leaveTimer.current); setHovered(true) }
  const handleLeave = () => { leaveTimer.current = setTimeout(() => setHovered(false), 80) }

  const confirmConfig = {
    delete: {
      title: 'Delete feature?',
      message: `"${feature.name}" will be permanently removed. If it came from Google Sheets, it won't reappear on the next sync.`,
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
      onConfirm: () => onDelete(feature.id),
    },
    archive: {
      title: archived ? 'Unarchive feature?' : 'Archive feature?',
      message: archived
        ? `"${feature.name}" will be moved back to Pipeline. All timeline data will need to be re-entered in the sheet.`
        : `"${feature.name}" will be archived and all timeline data permanently removed. You can restore it to Pipeline from the Archive view, but timeline data cannot be recovered.`,
      confirmLabel: archived ? 'Unarchive' : 'Archive',
      confirmVariant: 'ghost',
      onConfirm: () => onArchive(feature.id, !archived),
    },
  }

  return (
    <>
      {confirm && (
        <ConfirmModal
          open
          onClose={() => setConfirm(null)}
          onConfirm={() => { confirmConfig[confirm].onConfirm(); setConfirm(null) }}
          title={confirmConfig[confirm].title}
          message={confirmConfig[confirm].message}
          confirmLabel={confirmConfig[confirm].confirmLabel}
          confirmVariant={confirmConfig[confirm].confirmVariant}
        />
      )}
      <InfoModal
        open={showInfo}
        onClose={() => setShowInfo(false)}
        message="Stage and timeline changes can only be made in the Google Sheet. Sync after updating."
      />
      <InfoModal
        open={showConflict}
        onClose={() => setShowConflict(false)}
        message="This feature has a pending action. Please sync before making further changes."
      />

      {/* Card — full column width; buttons float absolutely to the right on hover */}
      <div
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onClick={() => setShowInfo(true)}
        style={{ position: 'relative', cursor: 'pointer' }}
      >
        <div style={{
          background: 'var(--surface)',
          border: `1px solid ${hovered ? 'var(--border2)' : 'var(--border)'}`,
          borderRadius: 4,
          padding: '6px 8px',
          transition: 'border-color 0.15s',
        }}>
          <div style={{ fontSize: 11.5, fontWeight: 650, color: 'var(--text)', lineHeight: 1.25, marginBottom: 3 }}>
            {feature.name}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
            {feature.frf && (
              <a href={feature.frf} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()} style={linkStyle}>
                FRF
              </a>
            )}
            {feature.prd && (
              <a href={feature.prd} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()} style={linkStyle}>
                PRD
              </a>
            )}
            {feature.jira && (
              <a href={feature.jira} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()} style={linkStyle}>
                Jira
              </a>
            )}
          </div>

          {feature.version && (
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 10,
              color: 'var(--amber)',
              background: '#f5a62315',
              border: '1px solid #f5a62330',
              padding: '1px 6px', borderRadius: 3,
              marginTop: 3, display: 'inline-block',
            }}>
              {feature.version}
            </div>
          )}

          {rangeLabel && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text2)', marginTop: 3, lineHeight: 1.35 }}>
              {rangeLabel}
            </div>
          )}
        </div>

        {/* Buttons float to the right of the card; z-index lets them sit above adjacent cards */}
        {hovered && (
          <div
            onClick={e => e.stopPropagation()}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
            style={{
              position: 'absolute',
              left: 'calc(100% + 4px)',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              zIndex: 100,
            }}
          >
            <button
              onClick={() => hasPendingAction(feature.id) ? setShowConflict(true) : setConfirm('archive')}
              title={archived ? 'Unarchive' : 'Archive'}
              style={actionBtn(false)}
            >
              <FolderIcon size={12} />
            </button>
            <button
              onClick={() => hasPendingAction(feature.id) ? setShowConflict(true) : setConfirm('delete')}
              title="Delete"
              style={actionBtn(true)}
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </>
  )
}

function actionBtn(isDanger) {
  return {
    background: 'var(--surface)',
    border: `1px solid ${isDanger ? '#c23a3a55' : 'var(--border2)'}`,
    borderRadius: 4,
    color: isDanger ? 'var(--red)' : 'var(--text2)',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    padding: '4px 8px',
    lineHeight: 1,
    fontFamily: 'var(--mono)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    width: 28,
    height: 24,
  }
}

const linkStyle = {
  fontFamily: 'var(--mono)', fontSize: 10,
  color: 'var(--accent2)',
  textDecoration: 'none', display: 'inline-block',
}
