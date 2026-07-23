import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Avatar from '../Avatar'
import ProductImage from '../ProductImage'
import { BatchRow } from './BatchList'
import { IconCamera, IconTrash, IconPower } from '../Icons'
import type { Formulation, FormulationMaterial, BatchListRow } from '../types'

export default function FormulationDetail() {
  const { formulationId } = useParams<{ formulationId: string }>()
  const [formulation, setFormulation] = useState<Formulation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!formulationId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('formulations')
      .select('id, code, name, active, category, base_name, variant')
      .eq('id', formulationId)
      .single()
    if (error) setError(error.message)
    else setFormulation(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formulationId])

  async function toggleActive() {
    if (!formulation) return
    const { error } = await supabase.from('formulations').update({ active: !formulation.active }).eq('id', formulation.id)
    if (error) setError(error.message)
    else load()
  }

  if (loading) return <div className="page"><p className="hint-text">Loading…</p></div>
  if (error || !formulation) return <div className="page"><p className="error-text">{error ?? 'Product not found'}</p></div>

  return (
    <div className="page">
      <Link to="/formulations" className="link-btn back-btn">
        ← Back to products
      </Link>

      <div className="product-detail-hero">
        <ProductImage formulation={formulation} className="product-detail-photo" />
        <div className="product-detail-hero-body">
          <span className="page-title" style={{ fontSize: 22 }}>
            {formulation.code}
          </span>
          <span className="hint-text">
            {[formulation.category, formulation.base_name, formulation.name].filter(Boolean).join(' · ') || 'Not categorized'}
          </span>
        </div>
        <button className={`chip ${!formulation.active ? 'chip-active' : ''}`} onClick={toggleActive}>
          <IconPower size={13} />
          {formulation.active ? 'Deactivate' : 'Activate'}
        </button>
      </div>

      <GroupingEditor formulation={formulation} onSaved={load} />
      <MaterialsEditor formulationId={formulation.id} />
      <ProductionLog formulationId={formulation.id} />
    </div>
  )
}

// Every batch made of this product, with who supervised it, whether it
// passed testing, and any flags — one screen instead of hunting through
// the full batch list. Each row drills into the existing batch detail
// page for the full materials-added/skipped checklist and lab report.
function ProductionLog({ formulationId }: { formulationId: string }) {
  const [batches, setBatches] = useState<BatchListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('batches')
        .select(
          'id, batch_number, batch_date, mason_name, status, started_at, submitted_at, testing_status, formulations(code, name), supervisors!batches_supervisor_id_fkey(name), tester:supervisors!batches_tester_id_fkey(name), batch_flags(id, severity, message)',
        )
        .eq('formulation_id', formulationId)
        .order('started_at', { ascending: false })
        .limit(25)
      if (cancelled) return
      if (error) setError(error.message)
      else setBatches((data as unknown as BatchListRow[]) ?? [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [formulationId])

  const passed = batches.filter((b) => b.testing_status === 'passed').length
  const flagged = batches.filter((b) => b.batch_flags.length > 0 || b.testing_status === 'failed').length

  return (
    <section>
      <h2 className="section-title">
        Production log
        {batches.length > 0 && (
          <span className="hint-text">
            {batches.length} batch{batches.length === 1 ? '' : 'es'} · {passed} passed
            {flagged > 0 ? ` · ${flagged} flagged` : ''}
          </span>
        )}
      </h2>
      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p className="hint-text">Loading…</p>
      ) : batches.length === 0 ? (
        <p className="hint-text">No batches produced with this formulation yet.</p>
      ) : (
        <div className="list">
          {batches.map((b) => (
            <BatchRow key={b.id} batch={b} />
          ))}
        </div>
      )}
    </section>
  )
}

function GroupingEditor({ formulation, onSaved }: { formulation: Formulation; onSaved: () => void }) {
  const [category, setCategory] = useState(formulation.category ?? '')
  const [baseName, setBaseName] = useState(formulation.base_name ?? '')
  const [variant, setVariant] = useState(formulation.variant ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    const { error } = await supabase
      .from('formulations')
      .update({
        category: category.trim() || null,
        base_name: baseName.trim() || null,
        variant: variant.trim() || null,
      })
      .eq('id', formulation.id)
    setSaving(false)
    if (error) setError(error.message)
    else onSaved()
  }

  return (
    <section>
      <h2 className="section-title">Grouping</h2>
      <div className="grouping-editor">
        <p className="hint-text">
          Category groups formulations into tabs on the supervisor app (e.g. "Adhesives", "Grout"). Base
          name + variant merge Grey/White pairs into one row with two small pills — leave both blank for a
          standalone formulation.
        </p>
        <div className="inline-form">
          <label className="field">
            <span className="field-label">Category</span>
            <input className="field-input" placeholder="e.g. Adhesives" value={category} onChange={(e) => setCategory(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Base name</span>
            <input className="field-input" placeholder="e.g. P100" value={baseName} onChange={(e) => setBaseName(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Variant</span>
            <input className="field-input" placeholder="e.g. Grey" value={variant} onChange={(e) => setVariant(e.target.value)} />
          </label>
          <button className="btn btn-ghost" type="button" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {error && <p className="error-text">{error}</p>}
      </div>
    </section>
  )
}

function MaterialsEditor({ formulationId }: { formulationId: string }) {
  const [materials, setMaterials] = useState<FormulationMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [newDesc, setNewDesc] = useState('')
  const [newQty, setNewQty] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('formulation_materials')
      .select('*')
      .eq('formulation_id', formulationId)
      .eq('active', true)
      .order('sort_order')
    if (error) setError(error.message)
    else setMaterials(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formulationId])

  async function addMaterial(e: React.FormEvent) {
    e.preventDefault()
    if (!newDesc.trim()) return
    const { error } = await supabase.from('formulation_materials').insert({
      formulation_id: formulationId,
      description: newDesc.trim(),
      sort_order: materials.length,
      standard_quantity: newQty.trim() ? Number(newQty) : null,
    })
    if (error) setError(error.message)
    else {
      setNewDesc('')
      setNewQty('')
      load()
    }
  }

  async function saveQuantity(m: FormulationMaterial, value: string) {
    const standard_quantity = value.trim() ? Number(value) : null
    const { error } = await supabase
      .from('formulation_materials')
      .update({ standard_quantity })
      .eq('id', m.id)
    if (error) setError(error.message)
    else setMaterials((prev) => prev.map((row) => (row.id === m.id ? { ...row, standard_quantity } : row)))
  }

  async function removeMaterial(id: string) {
    const { error } = await supabase.from('formulation_materials').update({ active: false }).eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  async function toggleRequiresPhoto(m: FormulationMaterial) {
    const { error } = await supabase
      .from('formulation_materials')
      .update({ requires_photo: !m.requires_photo })
      .eq('id', m.id)
    if (error) setError(error.message)
    else load()
  }

  return (
    <section>
      <h2 className="section-title">Materials</h2>
      <div className="materials-editor">
        {loading && <p className="hint-text">Loading materials…</p>}
        {error && <p className="error-text">{error}</p>}
        {materials.map((m) => (
          <div key={m.id} className="material-editor-row">
            <div className="material-editor-row-left">
              <Avatar name={m.description} size={26} />
              <span>{m.description}</span>
            </div>
            <div className="material-editor-actions">
              <QuantityInput material={m} onSave={(value) => saveQuantity(m, value)} />
              <button
                className={`photo-toggle ${m.requires_photo ? 'photo-toggle-on' : ''}`}
                onClick={() => toggleRequiresPhoto(m)}
                title={m.requires_photo ? 'Photo required — click to turn off' : 'Click to require a photo for this material'}
              >
                <IconCamera size={12} />
                {m.requires_photo ? 'Required' : 'Optional'}
              </button>
              <button className="icon-btn-sm icon-btn-cross" onClick={() => removeMaterial(m.id)} title="Remove material">
                <IconTrash size={13} />
              </button>
            </div>
          </div>
        ))}
        <form className="inline-form" onSubmit={addMaterial}>
          <input
            className="field-input"
            placeholder="New material description"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          <input
            className="field-input material-editor-qty-input"
            placeholder="Std. qty (kg)"
            inputMode="decimal"
            value={newQty}
            onChange={(e) => setNewQty(e.target.value)}
          />
          <button className="btn btn-ghost" type="submit" disabled={!newDesc.trim()}>
            Add
          </button>
        </form>
      </div>
    </section>
  )
}

// Standard quantity, editable inline — local draft state so a save only
// fires on blur/Enter instead of on every keystroke.
function QuantityInput({ material, onSave }: { material: FormulationMaterial; onSave: (value: string) => void }) {
  const [value, setValue] = useState(material.standard_quantity?.toString() ?? '')

  useEffect(() => {
    setValue(material.standard_quantity?.toString() ?? '')
  }, [material.standard_quantity])

  function commit() {
    if (value.trim() !== (material.standard_quantity?.toString() ?? '')) onSave(value)
  }

  return (
    <input
      className="field-input material-editor-qty-input"
      placeholder="Std. qty"
      inputMode="decimal"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
    />
  )
}
