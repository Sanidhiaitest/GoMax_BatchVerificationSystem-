import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useSupervisor } from '../SupervisorContext'
import type { Formulation } from '../types'

export default function FormulationSelect() {
  const { supervisor, logout } = useSupervisor()
  const [formulations, setFormulations] = useState<Formulation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('formulations')
        .select('id, code, name')
        .eq('active', true)
        .order('code')
      if (cancelled) return
      if (error) setError(error.message)
      else setFormulations(data ?? [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="screen">
      <header className="top-bar">
        <div>
          <p className="hint-text">Supervisor</p>
          <p className="top-bar-title">{supervisor?.name}</p>
        </div>
        <button className="link-btn" onClick={logout}>
          Switch
        </button>
      </header>

      <h2 className="section-title">Select formulation</h2>

      {loading && <p className="hint-text">Loading formulations…</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && formulations.length === 0 && !error && (
        <p className="hint-text">No formulations found. Ask an admin to add one.</p>
      )}

      <div className="list">
        {formulations.map((f) => (
          <button
            key={f.id}
            className="list-item"
            onClick={() => navigate(`/batch/new/${f.id}`)}
          >
            <span className="list-item-code">{f.code}</span>
            {f.name && <span className="list-item-sub">{f.name}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
