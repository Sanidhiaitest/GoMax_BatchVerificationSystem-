import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import Avatar from '../Avatar'
import type { SupervisorPublic, SupervisorRole } from '../types'

export default function Supervisors() {
  const [supervisors, setSupervisors] = useState<SupervisorPublic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [role, setRole] = useState<SupervisorRole>('supervisor')
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

  const mixers = useMemo(() => supervisors.filter((s) => s.role === 'supervisor'), [supervisors])
  const testers = useMemo(() => supervisors.filter((s) => s.role === 'tester'), [supervisors])

  async function createSupervisor(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^[0-9]{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits.')
      return
    }
    setCreating(true)
    const { error } = await supabase.rpc('admin_create_supervisor', {
      p_name: name.trim(),
      p_pin: pin,
      p_role: role,
    })
    setCreating(false)
    if (error) {
      setError(
        error.message.includes('duplicate_supervisor_name')
          ? `An active supervisor named "${name.trim()}" already exists.`
          : error.message,
      )
      return
    }
    setName('')
    setPin('')
    setRole('supervisor')
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
      <h1 className="page-title">People</h1>
      <p className="hint-text">Mixing supervisors and lab testers who sign in with a 4-digit PIN.</p>

      <details className="add-panel">
        <summary className="add-panel-trigger">＋ Add person</summary>
        <form className="inline-form add-panel-body" onSubmit={createSupervisor}>
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
          <select className="field-input" value={role} onChange={(e) => setRole(e.target.value as SupervisorRole)}>
            <option value="supervisor">Mixing supervisor</option>
            <option value="tester">Lab tester</option>
          </select>
          <button className="btn btn-primary" type="submit" disabled={creating || !name.trim()}>
            Add person
          </button>
        </form>
      </details>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="hint-text">Loading…</p>}

      {!loading && (
        <>
          <PersonGroup title="Mixing supervisors" people={mixers} onResetPin={resetPin} onToggleActive={toggleActive} />
          <PersonGroup title="Lab testers" people={testers} onResetPin={resetPin} onToggleActive={toggleActive} />
        </>
      )}
    </div>
  )
}

function PersonGroup({
  title,
  people,
  onResetPin,
  onToggleActive,
}: {
  title: string
  people: SupervisorPublic[]
  onResetPin: (s: SupervisorPublic) => void
  onToggleActive: (s: SupervisorPublic) => void
}) {
  return (
    <section>
      <h2 className="section-title">{title}</h2>
      {people.length === 0 ? (
        <p className="hint-text">None yet.</p>
      ) : (
        <div className="list">
          {people.map((s) => (
            <div key={s.id} className="list-item batch-row">
              <div className="batch-row-left">
                <Avatar name={s.name} />
                <span className="list-item-code">
                  {s.name} {!s.active && <span className="hint-text">(inactive)</span>}
                </span>
              </div>
              <div className="material-editor-actions">
                <button className="link-btn" onClick={() => onResetPin(s)}>
                  Reset PIN
                </button>
                <button className="link-btn" onClick={() => onToggleActive(s)}>
                  {s.active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
