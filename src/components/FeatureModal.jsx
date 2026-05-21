import { useState, useEffect } from 'react'
import { STAGES, STAGE_LABELS } from '../data/constants'
import { isTimelineRequired, validateRequiredTimeline, computeDisplayStage } from '../hooks/useTimeline'
import { Modal, ConfirmModal, FormField, Input, Select, Button } from './UI'

const EMPTY = {
  product: '', market: '', name: '',
  prd: '', jira: '',
  stage: 'pipeline',
  version: '', timeline: {},
  tl_dev_start: '', tl_dev_end: '',
  tl_qa_start: '', tl_qa_end: '',
  tl_uat_start: '', tl_uat_end: '',
  tl_live_start: '', tl_live_end: '',
}

export function FeatureModal({ open, onClose, initialData, products, markets, onSave, onDelete }) {
  const isEdit = Boolean(initialData?.id)
  const [form, setForm] = useState(EMPTY)
  const [confirm, setConfirm] = useState(null) // null | 'delete' | 'archive'
  const archived = Boolean(form.archived)

  useEffect(() => {
    if (open) {
      const src = initialData ? { ...EMPTY, ...initialData } : { ...EMPTY, ...(initialData || {}) }
      const t = src.timeline || {}
      const parseIso = (range, which) => {
        if (!range) return ''
        const [start, end] = range.split('-')
        const v = which === 'start' ? start : end
        if (!v) return ''
        // YYYY.MM.DD -> YYYY-MM-DD
        return v.replaceAll('.', '-')
      }

      setForm({
        ...src,
        tl_dev_start:  parseIso(t.dev, 'start'),
        tl_dev_end:    parseIso(t.dev, 'end'),
        tl_qa_start:   parseIso(t.qa, 'start'),
        tl_qa_end:     parseIso(t.qa, 'end'),
        tl_uat_start:  parseIso(t.uat, 'start'),
        tl_uat_end:    parseIso(t.uat, 'end'),
        tl_live_start: parseIso(t.live, 'start'),
        tl_live_end:   parseIso(t.live, 'end'),
      })
    }
  }, [open, initialData])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const timeline = buildTimelineFromForm(form)
  // The stage shown in the board is always the computed value — keep the dropdown in sync
  const effectiveStage = computeDisplayStage({ stage: form.stage, timeline }, today)
  const needsTimeline = isTimelineRequired(effectiveStage)
  const timelineValidation = needsTimeline ? validateRequiredTimeline(timeline) : { ok: true, errors: [] }

  function toPayload(extra = {}) {
    return {
      id: isEdit ? form.id : undefined,
      createdAt: form.createdAt,
      archived: Boolean(form.archived),
      product: form.product,
      market: form.market,
      name: form.name,
      prd: form.prd,
      jira: form.jira,
      stage: effectiveStage,
      version: form.version,
      timeline,
      ...extra,
    }
  }

  function handleSave() {
    if (!form.name.trim() || !form.product.trim() || !form.market.trim()) {
      alert('Product, market, and feature name are required.')
      return
    }
    if (needsTimeline && !timelineValidation.ok) {
      alert(`Timeline is required for Scheduled+.\\n\\n${timelineValidation.errors.join('\\n')}`)
      return
    }
    onSave(toPayload())
    onClose()
  }

  function executeDelete() {
    onDelete(form.id)
    onClose()
  }

  function executeArchiveToggle() {
    onSave(toPayload({ archived: !archived }))
    onClose()
  }

  const confirmConfig = {
    delete: {
      title: 'Delete feature?',
      message: `"${form.name}" will be permanently removed from the tracker. If it was loaded from Google Sheets, it won't reappear on the next sync.`,
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
      onConfirm: executeDelete,
    },
    archive: {
      title: archived ? 'Unarchive feature?' : 'Archive feature?',
      message: archived
        ? `"${form.name}" will be moved back to the main board.`
        : `"${form.name}" will be hidden from the main board and moved to the archive. You can restore it any time.`,
      confirmLabel: archived ? 'Unarchive' : 'Archive',
      confirmVariant: 'ghost',
      onConfirm: executeArchiveToggle,
    },
  }

  return (
    <>
    {confirm && (
      <ConfirmModal
        open
        onClose={() => setConfirm(null)}
        onConfirm={confirmConfig[confirm].onConfirm}
        title={confirmConfig[confirm].title}
        message={confirmConfig[confirm].message}
        confirmLabel={confirmConfig[confirm].confirmLabel}
        confirmVariant={confirmConfig[confirm].confirmVariant}
      />
    )}
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Feature' : 'Add Feature'}>
      {/* Product + Market */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FormField label="Product">
          <Select value={form.product} onChange={e => set('product', e.target.value)}>
            {!form.product && <option value="">Select…</option>}
            {form.product && !products.includes(form.product) && (
              <option value={form.product}>{form.product}</option>
            )}
            {products.map(p => <option key={p} value={p}>{p}</option>)}
          </Select>
        </FormField>
        <FormField label="Market">
          <Select value={form.market} onChange={e => set('market', e.target.value)}>
            {!form.market && <option value="">Select…</option>}
            {form.market && !markets.includes(form.market) && (
              <option value={form.market}>{form.market}</option>
            )}
            {markets.map(m => <option key={m} value={m}>{m}</option>)}
          </Select>
        </FormField>
      </div>

      {/* Feature name */}
      <FormField label="Feature Name">
        <Input
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="e.g. First Loan Phase 2"
          autoFocus
        />
      </FormField>

      {/* PRD + Jira links */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FormField label="PRD Link (optional)">
          <Input
            type="url"
            value={form.prd}
            onChange={e => set('prd', e.target.value)}
            placeholder="https://..."
          />
        </FormField>
        <FormField label="Jira Link (optional)">
          <Input
            type="url"
            value={form.jira}
            onChange={e => set('jira', e.target.value)}
            placeholder="https://..."
          />
        </FormField>
      </div>

      {/* Stage */}
      <FormField label="Stage">
        <Select value={effectiveStage} onChange={e => set('stage', e.target.value)}>
          {STAGES.map(s => (
            <option key={s} value={s}>{STAGE_LABELS[s]}</option>
          ))}
        </Select>
        {effectiveStage !== form.stage && (
          <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 4 }}>
            Timeline advances this to {STAGE_LABELS[effectiveStage]}
          </div>
        )}
      </FormField>

      {/* Timeline — shown when stage is Scheduled or later */}
      {needsTimeline && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
          <FormField label="Version">
            <Input
              value={form.version || ''}
              onChange={e => set('version', e.target.value)}
              placeholder="e.g. v202606.1.5"
            />
          </FormField>

          <FormField label="Timeline (required)">
            <div style={{
              display: 'grid',
              gridTemplateColumns: '56px 1fr 1fr',
              gap: 8,
              alignItems: 'center',
            }}>
              <div style={tlHeaderCell}>Stage</div>
              <div style={tlHeaderCell}>Start</div>
              <div style={tlHeaderCell}>End</div>

              <div style={tlStageCell}>Dev</div>
              <Input type="date" value={form.tl_dev_start} onChange={e => set('tl_dev_start', e.target.value)} />
              <Input type="date" value={form.tl_dev_end} onChange={e => set('tl_dev_end', e.target.value)} />

              <div style={tlStageCell}>QA</div>
              <Input type="date" value={form.tl_qa_start} onChange={e => set('tl_qa_start', e.target.value)} />
              <Input type="date" value={form.tl_qa_end} onChange={e => set('tl_qa_end', e.target.value)} />

              <div style={tlStageCell}>UAT</div>
              <Input type="date" value={form.tl_uat_start} onChange={e => set('tl_uat_start', e.target.value)} />
              <Input type="date" value={form.tl_uat_end} onChange={e => set('tl_uat_end', e.target.value)} />

              <div style={tlStageCell}>Live</div>
              <Input type="date" value={form.tl_live_start} onChange={e => set('tl_live_start', e.target.value)} />
              <Input type="date" value={form.tl_live_end} onChange={e => set('tl_live_end', e.target.value)} />
            </div>

            {!timelineValidation.ok && (
              <div style={{
                marginTop: 10,
                fontSize: 12,
                color: 'var(--red)',
                background: '#c23a3a10',
                border: '1px solid #c23a3a33',
                borderRadius: 8,
                padding: '8px 10px',
                lineHeight: 1.5,
              }}>
                {timelineValidation.errors.join(' · ')}
              </div>
            )}
          </FormField>
        </div>
      )}

      {/* Footer */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)',
      }}>
        <div>
          {isEdit && (
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" size="sm" onClick={() => setConfirm('archive')}>
                {archived ? 'Unarchive' : 'Archive'}
              </Button>
              <Button variant="danger" size="sm" onClick={() => setConfirm('delete')}>Delete</Button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleSave}>Save</Button>
        </div>
      </div>
    </Modal>
    </>
  )
}

function buildTimelineFromForm(form) {
  const toTracker = (iso) => {
    if (!iso) return ''
    // YYYY-MM-DD -> YYYY.MM.DD
    return iso.replaceAll('-', '.')
  }
  const mk = (s, e) => {
    if (!s || !e) return undefined
    return `${toTracker(s)}-${toTracker(e)}`
  }

  return {
    ...(mk(form.tl_dev_start, form.tl_dev_end) ? { dev: mk(form.tl_dev_start, form.tl_dev_end) } : {}),
    ...(mk(form.tl_qa_start, form.tl_qa_end) ? { qa: mk(form.tl_qa_start, form.tl_qa_end) } : {}),
    ...(mk(form.tl_uat_start, form.tl_uat_end) ? { uat: mk(form.tl_uat_start, form.tl_uat_end) } : {}),
    ...(mk(form.tl_live_start, form.tl_live_end) ? { live: mk(form.tl_live_start, form.tl_live_end) } : {}),
  }
}

const tlHeaderCell = {
  fontFamily: 'var(--mono)',
  fontSize: 10,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--text3)',
  paddingBottom: 4,
}

const tlStageCell = {
  fontFamily: 'var(--mono)',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text2)',
}
