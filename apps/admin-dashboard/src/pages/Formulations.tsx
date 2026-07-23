import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import ProductImage from '../ProductImage'
import { variantSwatch } from '../variants'
import type { Formulation } from '../types'

export default function Formulations() {
  const [formulations, setFormulations] = useState<Formulation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('formulations')
      .select('id, code, name, active, category, base_name, variant')
      .order('code')
    if (error) setError(error.message)
    else setFormulations(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function createFormulation(e: React.FormEvent) {
    e.preventDefault()
    if (!newCode.trim()) return
    setCreating(true)
    setError(null)
    const { error } = await supabase
      .from('formulations')
      .insert({ code: newCode.trim().toUpperCase(), name: newName.trim() || null })
    setCreating(false)
    if (error) {
      setError(error.message)
      return
    }
    setNewCode('')
    setNewName('')
    load()
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="hint-text">Tap a product to edit its materials, quantities and photo requirements.</p>
        </div>
      </div>

      <details className="add-panel">
        <summary className="add-panel-trigger">＋ Add product</summary>
        <form className="inline-form add-panel-body" onSubmit={createFormulation}>
          <input
            className="field-input"
            placeholder="Code (e.g. P20)"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
          />
          <input
            className="field-input"
            placeholder="Name (optional)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={creating || !newCode.trim()}>
            Add product
          </button>
        </form>
      </details>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="hint-text">Loading…</p>}

      <div className="product-tile-grid">
        {formulations.map((f) => (
          <Link key={f.id} to={`/formulations/${f.id}`} className={`product-tile ${!f.active ? 'product-tile-inactive' : ''}`}>
            <ProductImage formulation={f} className="product-tile-photo" />
            <span className="product-tile-code">
              {f.code}
              {f.variant && (
                <span
                  className="variant-chip"
                  style={(() => {
                    const s = variantSwatch(f.variant)
                    return s ? { background: s.bg, color: s.fg } : undefined
                  })()}
                >
                  {f.variant}
                </span>
              )}
            </span>
            <span className="product-tile-sub">
              {[f.category, f.base_name, f.name].filter(Boolean).join(' · ') || 'Not categorized'}
              {!f.active && ' · inactive'}
            </span>
            <span className="product-tile-manage">Manage →</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
