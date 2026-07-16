import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
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
      .select('id, code, name, active')
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
      <h1 className="page-title">Formulations</h1>
      <p className="hint-text">
        Editing a formulation's materials here updates the supervisor checklist everywhere,
        immediately — in-progress and submitted batches keep the material list they were started
        with.
      </p>

      <form className="inline-form" onSubmit={createFormulation}>
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
          Add formulation
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="hint-text">Loading…</p>}

      <div className="list">
        {formulations.map((f) => (
          <div key={f.id} className="list-item formulation-card">
            <button
              className="batch-row-main formulation-header"
              onClick={() => setExpanded(expanded === f.id ? null : f.id)}
            >
              <span className="list-item-code">
                {f.code} {!f.active && <span className="hint-text">(inactive)</span>}
              </span>
              {f.name && <span className="list-item-sub">{f.name}</span>}
            </button>
            <button className="link-btn" onClick={() => toggleActive(f)}>
              {f.active ? 'Deactivate' : 'Activate'}
            </button>
            {expanded === f.id && <MaterialsEditor formulationId={f.id} />}
          </div>
        ))}
      </div>
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
          <span>{m.description}</span>
          <div className="material-editor-actions">
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
