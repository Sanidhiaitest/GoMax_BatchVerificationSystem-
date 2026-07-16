import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useSupervisor } from '../SupervisorContext'
import Avatar from '../Avatar'
import IdentityTopBar from '../IdentityTopBar'
import type { Formulation } from '../types'

interface DisplayGroup {
  key: string
  baseName: string | null
  items: Formulation[]
}

function buildGroups(list: Formulation[]): DisplayGroup[] {
  const groups: DisplayGroup[] = []
  const indexByBase = new Map<string, number>()
  for (const f of list) {
    if (f.base_name) {
      const idx = indexByBase.get(f.base_name)
      if (idx !== undefined) {
        groups[idx].items.push(f)
      } else {
        indexByBase.set(f.base_name, groups.length)
        groups.push({ key: f.base_name, baseName: f.base_name, items: [f] })
      }
    } else {
      groups.push({ key: f.id, baseName: null, items: [f] })
    }
  }
  return groups
}

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

  const groups = useMemo(() => buildGroups(filtered), [filtered])

  return (
    <div className="screen">
      <IdentityTopBar
        name={supervisor?.name ?? ''}
        historyLabel="History"
        onHistory={() => navigate('/history')}
        onLogout={logout}
      />

      <div className="greeting">
        <h1 className="title">Hello, {firstName}! 👋</h1>
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
        {groups.map((g) =>
          g.baseName ? (
            <VariantGroupRow key={g.key} baseName={g.baseName} items={g.items} onPick={(id) => navigate(`/batch/new/${id}`)} />
          ) : (
            <button key={g.key} className="list-item" onClick={() => navigate(`/batch/new/${g.items[0].id}`)}>
              <Avatar name={g.items[0].code} />
              <span className="list-item-body">
                <span className="list-item-code">{g.items[0].code}</span>
                {g.items[0].name && <span className="list-item-sub">{g.items[0].name}</span>}
              </span>
            </button>
          ),
        )}
      </div>
    </div>
  )
}

function VariantGroupRow({
  baseName,
  items,
  onPick,
}: {
  baseName: string
  items: Formulation[]
  onPick: (id: string) => void
}) {
  return (
    <div className="list-item variant-group-row">
      <Avatar name={baseName} />
      <div className="list-item-body">
        <span className="list-item-code variant-group-name">{baseName}</span>
        <div className="variant-pills">
          {items.map((item) => (
            <button
              key={item.id}
              className={`variant-pill variant-pill-${(item.variant ?? '').toLowerCase()}`}
              onClick={() => onPick(item.id)}
            >
              {item.variant ?? item.code}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
