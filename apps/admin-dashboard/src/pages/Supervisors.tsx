import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import type { SupervisorPublic } from '../types'

export default function Supervisors() {
  const [supervisors, setSupervisors] = useState<SupervisorPublic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [creating, setCreating] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('supervisors_public').select('*').order('name')
    if (error) setError(error.message)
    else setSupervisors(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function createSupervisor(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^[0-9]{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits.')
      return
    }
    setCreating(true)
    const { error } = await supabase.rpc('admin_create_supervisor', { p_name: name.trim(), p_pin: pin })
    setCreating(false)
    if (error) {
      setError(error.message)
      return
    }
    setName('')
    setPin('')
    load()
  }

  async function toggleActive(s: SupervisorPublic) {
    const { error } = await supabase.rpc('admin_set_supervisor_active', {
      p_supervisor_id: s.id,
      p_active: !s.active,
    })
    if (error) setError(error.message)
    else load()
  }

  async function resetPin(s: SupervisorPublic) {
    const newPin = window.prompt(`New 4-digit PIN for ${s.name}`)
    if (!newPin) return
    if (!/^[0-9]{4}$/.test(newPin)) {
      setError('PIN must be exactly 4 digits.')
      return
    }
    const { error } = await supabase.rpc('admin_set_supervisor_pin', {
      p_supervisor_id: s.id,
      p_pin: newPin,
    })
    if (error) setError(error.message)
  }

  return (
    <div className="page">
      <h1 className="page-title">Supervisors</h1>

      <form className="inline-form" onSubmit={createSupervisor}>
        <input
          className="field-input"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="field-input"
          placeholder="4-digit PIN"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
        />
        <button className="btn btn-primary" type="submit" disabled={creating || !name.trim()}>
          Add supervisor
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="hint-text">Loading…</p>}

      <div className="list">
        {supervisors.map((s) => (
          <div key={s.id} className="list-item batch-row">
            <span className="list-item-code">
              {s.name} {!s.active && <span className="hint-text">(inactive)</span>}
            </span>
            <div className="material-editor-actions">
              <button className="link-btn" onClick={() => resetPin(s)}>
                Reset PIN
              </button>
              <button className="link-btn" onClick={() => toggleActive(s)}>
                {s.active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
