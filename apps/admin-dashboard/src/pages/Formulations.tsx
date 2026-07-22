import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import Avatar from '../Avatar'
import { variantSwatch } from '../variants'
import type { Formulation, FormulationMaterial } from '../types'

export default function Formulations() {
  const [formulations, setFormulations] = useState<Formulation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
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

  async function toggleActive(f: Formulation) {
    const { error } = await supabase.from('formulations').update({ active: !f.active }).eq('id', f.id)
    if (error) setError(error.message)
    else load()
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="hint-text">Edits here update supervisor checklists instantly.</p>
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

      <div className="list">
        {formulations.map((f) => (
          <div key={f.id} className="list-item formulation-card">
            <button
              className="formulation-header"
              onClick={() => setExpanded(expanded === f.id ? null : f.id)}
            >
              <Avatar name={f.code} />
              <div className="batch-row-main">
                <span className="list-item-code">
                  {f.code}{' '}
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
                  {!f.active && <span className="hint-text"> (inactive)</span>}
                </span>
                <span className="list-item-sub">
                  {[f.category, f.base_name, f.name].filter(Boolean).join(' · ') || 'Not categorized'}
                </span>
              </div>
            </button>
            <button className="link-btn" onClick={() => toggleActive(f)}>
              {f.active ? 'Deactivate' : 'Activate'}
            </button>
            {expanded === f.id && (
              <>
                <GroupingEditor formulation={f} onSaved={load} />
                <MaterialsEditor formulationId={f.id} />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
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
  )
}

function MaterialsEditor({ formulationId }: { formulationId: string }) {
  const [materials, setMaterials] = useState<FormulationMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [newDesc, setNewDesc] = useState('')
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
    })
    if (error) setError(error.message)
    else {
      setNewDesc('')
      load()
    }
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

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= materials.length) return
    const a = materials[index]
    const b = materials[target]
    await Promise.all([
      supabase.from('formulation_materials').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('formulation_materials').update({ sort_order: a.sort_order }).eq('id', b.id),
    ])
    load()
  }

  return (
    <div className="materials-editor">
      {loading && <p className="hint-text">Loading materials…</p>}
      {error && <p className="error-text">{error}</p>}
      {materials.map((m, i) => (
        <div key={m.id} className="material-editor-row">
          <div className="material-editor-row-left">
            <Avatar name={m.description} size={26} />
            <span>{m.description}</span>
          </div>
          <div className="material-editor-actions">
            <button
              className={`photo-toggle ${m.requires_photo ? 'photo-toggle-on' : ''}`}
              onClick={() => toggleRequiresPhoto(m)}
              title={m.requires_photo ? 'Photo required — click to turn off' : 'Click to require a photo for this material'}
            >
              📷 {m.requires_photo ? 'Required' : 'Optional'}
            </button>
            <button className="icon-btn-sm" onClick={() => move(i, -1)} disabled={i === 0}>
              ↑
            </button>
            <button className="icon-btn-sm" onClick={() => move(i, 1)} disabled={i === materials.length - 1}>
              ↓
            </button>
            <button className="icon-btn-sm icon-btn-cross" onClick={() => removeMaterial(m.id)}>
              ✕
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
        <button className="btn btn-ghost" type="submit" disabled={!newDesc.trim()}>
          Add
        </button>
      </form>
    </div>
  )
}
