import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useSupervisor } from '../SupervisorContext'
import Avatar from '../Avatar'
import IdentityTopBar from '../IdentityTopBar'
import type { Formulation } from '../types'

export default function FormulationSelect() {
  const { supervisor, logout } = useSupervisor()
  const [formulations, setFormulations] = useState<Formulation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState('All')
  const navigate = useNavigate()

  const firstName = supervisor?.name.split(' ')[0] ?? ''

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('formulations')
        .select('id, code, name, category, base_name, variant')
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

  const categories = useMemo(() => {
    const set = new Set<string>()
    formulations.forEach((f) => f.category && set.add(f.category))
    return ['All', ...Array.from(set).sort()]
  }, [formulations])

  const filtered = useMemo(
    () => (category === 'All' ? formulations : formulations.filter((f) => f.category === category)),
    [formulations, category],
  )

  return (
    <div className="screen">
      <IdentityTopBar
        name={supervisor?.name ?? ''}
        historyLabel="History"
        onHistory={() => navigate('/history')}
        onLogout={logout}
      />

      <div className="greeting">
        <h1 className="title">
          <span className="title-highlight">Hello,</span> {firstName}! 👋
        </h1>
        <p className="subtitle">Ready to start a batch?</p>
      </div>

      {categories.length > 2 && (
        <div className="category-tabs">
          {categories.map((c) => (
            <button
              key={c}
              className={`category-tab ${category === c ? 'active' : ''}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="hint-text">Loading formulations…</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && formulations.length === 0 && !error && (
        <p className="hint-text">No formulations found. Ask an admin to add one.</p>
      )}
      {!loading && formulations.length > 0 && filtered.length === 0 && (
        <p className="hint-text">Nothing in this category.</p>
      )}

      <div className="list">
        {filtered.map((f) =>
          f.base_name && f.variant ? (
            <VariantCard key={f.id} formulation={f} onPick={() => navigate(`/batch/new/${f.id}`)} />
          ) : (
            <button key={f.id} className="list-item" onClick={() => navigate(`/batch/new/${f.id}`)}>
              <Avatar name={f.code} />
              <span className="list-item-body">
                <span className="list-item-code">{f.code}</span>
                {f.name && <span className="list-item-sub">{f.name}</span>}
              </span>
            </button>
          ),
        )}
      </div>
    </div>
  )
}

function VariantCard({ formulation, onPick }: { formulation: Formulation; onPick: () => void }) {
  const variantKey = (formulation.variant ?? '').toLowerCase()
  return (
    <button
      className={`list-item variant-card variant-card-${variantKey}`}
      onClick={onPick}
    >
      <span className="variant-card-body">
        <span className="variant-card-base">{formulation.base_name}</span>
        <span className="variant-card-variant">{formulation.variant}</span>
      </span>
    </button>
  )
}
