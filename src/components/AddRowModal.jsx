import { useState, useEffect } from 'react'
import { Modal, FormField, Input, Button } from './UI'

export function AddRowModal({ open, onClose, products, onSave }) {
  const [product, setProduct] = useState('')
  const [market,  setMarket]  = useState('')

  useEffect(() => {
    if (open) { setProduct(''); setMarket('') }
  }, [open])

  function handleSave() {
    if (!product.trim() || !market.trim()) {
      alert('Please fill in both product and market.')
      return
    }
    onSave(product.trim(), market.trim())
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Row" width={360}>
      <FormField label="Product">
        <Input
          value={product}
          onChange={e => setProduct(e.target.value)}
          placeholder="e.g. Vehicle Loan"
          list="row-products"
          autoFocus
        />
        <datalist id="row-products">
          {products.map(p => <option key={p} value={p} />)}
        </datalist>
      </FormField>
      <FormField label="Market">
        <Input
          value={market}
          onChange={e => setMarket(e.target.value)}
          placeholder="e.g. Cross Market"
        />
      </FormField>
      <div style={{
        display: 'flex', justifyContent: 'flex-end', gap: 8,
        marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)',
      }}>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="sm" onClick={handleSave}>Add Row</Button>
      </div>
    </Modal>
  )
}
