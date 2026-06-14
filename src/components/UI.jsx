import { useEffect, useRef } from 'react'

export function FolderIcon({ size = 13 }) {
  return (
    <svg width={size} height={size * 0.85} viewBox="0 0 14 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <path d="M1 2.5C1 1.67 1.67 1 2.5 1H5L6.5 2.5H11.5C12.33 2.5 13 3.17 13 4V9.5C13 10.33 12.33 11 11.5 11H2.5C1.67 11 1 10.33 1 9.5V2.5Z" />
    </svg>
  )
}

export function SyncIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.5V7H8.5" />
      <path d="M12 7A5 5 0 1 0 9.5 11.5" />
    </svg>
  )
}

export function BookIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="1.5" width="10" height="11" rx="1.5" />
      <line x1="4.5" y1="5" x2="9.5" y2="5" />
      <line x1="4.5" y1="7.5" x2="9.5" y2="7.5" />
      <line x1="4.5" y1="10" x2="7.5" y2="10" />
    </svg>
  )
}

export function SheetIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" />
      <line x1="1.5" y1="5" x2="12.5" y2="5" />
      <line x1="5" y1="5" x2="5" y2="12.5" />
    </svg>
  )
}

// ── Button ──────────────────────────────────────────────────────
const btnBase = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  fontFamily: 'var(--sans)', fontWeight: 600, letterSpacing: '0.05em',
  border: 'none', borderRadius: 6, cursor: 'pointer',
  transition: 'all 0.15s', whiteSpace: 'nowrap',
}
const btnSizes = {
  sm: { fontSize: 11, padding: '5px 10px' },
  md: { fontSize: 12, padding: '8px 16px' },
}
const btnVariants = {
  primary: { background: 'var(--accent)', color: '#fff' },
  ghost:   { background: 'transparent', color: 'var(--text2)', border: '1px solid var(--border2)' },
  danger:  { background: 'transparent', color: 'var(--red)',   border: '1px solid #ff6b6b44' },
}

export function Button({ variant = 'ghost', size = 'md', onClick, children, style, ...rest }) {
  return (
    <button
      onClick={onClick}
      style={{ ...btnBase, ...btnSizes[size], ...btnVariants[variant], ...style }}
      {...rest}
    >
      {children}
    </button>
  )
}

// ── Modal ───────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width = 500 }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(4px)',
        zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        ref={ref}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border2)',
          borderRadius: 12,
          width, maxWidth: '95vw',
          maxHeight: '90vh', overflowY: 'auto',
          padding: 28,
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 20, right: 20,
            background: 'none', border: 'none',
            color: 'var(--text3)', fontSize: 20, cursor: 'pointer', lineHeight: 1,
          }}
        >✕</button>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--text)' }}>
          {title}
        </div>
        {children}
      </div>
    </div>
  )
}

// ── InfoModal ───────────────────────────────────────────────────
export function InfoModal({ open, onClose, message, children, width = 340 }) {
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border2)',
        borderRadius: 12,
        width, maxWidth: '95vw',
        padding: '24px 28px',
      }}>
        {children ? (
          children
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20, lineHeight: 1.6 }}>
            {message}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" onClick={onClose}>Got it</Button>
        </div>
      </div>
    </div>
  )
}

// ── ConfirmModal ────────────────────────────────────────────────
export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', confirmVariant = 'danger' }) {
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border2)',
        borderRadius: 12,
        width: 380, maxWidth: '95vw',
        padding: '24px 28px',
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: 'var(--text)' }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24, lineHeight: 1.6 }}>
          {message}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant={confirmVariant} size="sm" onClick={() => { onConfirm(); onClose() }}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── BottomSheet ─────────────────────────────────────────────────
export function BottomSheet({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'flex-end',
      }}
    >
      <div style={{
        background: 'var(--surface)',
        borderRadius: '16px 16px 0 0',
        width: '100%',
        maxHeight: '88vh',
        overflowY: 'auto',
        paddingBottom: 32,
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px' }}>
          <div style={{ width: 36, height: 4, background: 'var(--border2)', borderRadius: 2 }} />
        </div>
        <div style={{ padding: '0 20px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── FormField ───────────────────────────────────────────────────
export function FormField({ label, children, style }) {
  return (
    <div style={{ marginBottom: 16, ...style }}>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 600,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'var(--text3)', marginBottom: 6,
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%',
  background: 'var(--bg)',
  border: '1px solid var(--border2)',
  borderRadius: 6,
  color: 'var(--text)',
  fontFamily: 'var(--sans)',
  fontSize: 13,
  padding: '9px 12px',
  outline: 'none',
}

export function Input({ list, ...rest }) {
  return <input style={inputStyle} list={list} {...rest} />
}

export function Select({ children, ...rest }) {
  return (
    <select style={{ ...inputStyle, cursor: 'pointer' }} {...rest}>
      {children}
    </select>
  )
}

export function Textarea({ ...rest }) {
  return (
    <textarea
      style={{ ...inputStyle, fontFamily: 'var(--mono)', fontSize: 12, resize: 'vertical', minHeight: 80 }}
      {...rest}
    />
  )
}
