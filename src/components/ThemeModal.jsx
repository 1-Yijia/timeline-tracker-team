import { useMemo } from 'react'
import { Modal, Button, Select } from './UI'

export const PASTEL_PALETTE = [
  { id: 'blushing-bride', name: 'Blushing Bride', color: '#f2c7cc' },
  { id: 'ice-melt',       name: 'Ice Melt',      color: '#c6d7e6' },
  { id: 'bay',            name: 'Bay',           color: '#bfe2d5' },
  { id: 'purple-heather', name: 'Purple Heather',color: '#c8c9e6' },
  { id: 'pale-peach',     name: 'Pale Peach',    color: '#f2cdbf' },
  { id: 'pale-banana',    name: 'Pale Banana',   color: '#f3e2a4' },
]

function rowKey(product, market) {
  return `${product}||${market}`
}

export function ThemeModal({ open, onClose, rows, themeByRowKey, setThemeByRowKey }) {
  const uniquePairs = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const r of rows) {
      const k = rowKey(r.product, r.market)
      if (seen.has(k)) continue
      seen.add(k)
      out.push({ key: k, product: r.product, market: r.market })
    }
    return out
  }, [rows])

  return (
    <Modal open={open} onClose={onClose} title="Colour scheme" width={560}>
      <div style={{ color: 'var(--text2)', fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>
        Set a standard colour per <span style={{ fontFamily: 'var(--mono)' }}>Product × Market</span>.
        The same colour will be used for the left labels and the feature cards in that category.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 10, alignItems: 'center' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text3)' }}>
          Category
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text3)' }}>
          Colour
        </div>

        {uniquePairs.map(p => {
          const current = themeByRowKey[p.key] || PASTEL_PALETTE[0].id
          return (
            <div key={p.key} style={{ display: 'contents' }}>
              <div style={{ padding: '8px 0', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                {p.product} <span style={{ color: 'var(--text3)', fontWeight: 500 }}>×</span> {p.market}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: 6,
                  background: (PASTEL_PALETTE.find(x => x.id === current)?.color) || '#ddd',
                  border: '1px solid var(--border2)',
                  flex: '0 0 auto',
                }} />
                <Select
                  value={current}
                  onChange={(e) => setThemeByRowKey(prev => ({ ...prev, [p.key]: e.target.value }))}
                >
                  {PASTEL_PALETTE.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                  ))}
                </Select>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{
        display: 'flex', justifyContent: 'flex-end', gap: 8,
        marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)',
      }}>
        <Button variant="ghost" size="sm" onClick={onClose}>Done</Button>
      </div>
    </Modal>
  )
}

