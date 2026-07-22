import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useSupervisor } from '../SupervisorContext'
import AppHeader from '../AppHeader'
import ProductImage from '../ProductImage'
import type { Formulation } from '../types'

interface RecentBatch {
  id: string
  batch_number: string
  batch_date: string
  started_at: string
  mason_name: string
  formulations: { code: string; base_name: string | null; name: string | null } | null
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}


export default function FormulationSelect() {
  const { supervisor, logout } = useSupervisor()
  const [formulations, setFormulations] = useState<Formulation[]>([])
  const [recent, setRecent] = useState<RecentBatch[]>([])
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

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('batches')
        .select('id, batch_number, batch_date, started_at, mason_name, formulations(code, base_name, name)')
        .order('started_at', { ascending: false })
        .limit(6)
      if (cancelled) return
      setRecent((data as unknown as RecentBatch[]) ?? [])
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
      <AppHeader name={supervisor?.name ?? ''} onLogout={logout} />

      <div className="greeting">
        <h1 className="title picker-title">
          Hi {firstName}, what are you mixing? 👋
        </h1>
        <p className="subtitle picker-subtitle">Pick a product to start</p>
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

      {recent.length > 0 && (
        <>
          <div className="list-section-head">
            <span className="list-section-title">
              <span className="list-section-icon">🕐</span>History
            </span>
            <button className="list-section-cta" onClick={() => navigate('/history')}>
              View all
            </button>
          </div>
          <div className="recent-batches">
            {recent.map((b) => (
              <button key={b.id} className="recent-batch-card" onClick={() => navigate(`/batch/${b.id}`)}>
                <span className="recent-batch-top">
                  <span className="recent-batch-number">#{b.batch_number}</span>
                  <span className="recent-batch-time">{timeAgo(b.started_at)}</span>
                </span>
                <span className="recent-batch-name">{b.formulations?.base_name ?? b.formulations?.code}</span>
                <span className="recent-batch-sub">{b.mason_name}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {loading && <p className="hint-text">Loading formulations…</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && formulations.length === 0 && !error && (
        <p className="hint-text">No formulations found. Ask an admin to add one.</p>
      )}
      {!loading && formulations.length > 0 && filtered.length === 0 && (
        <p className="hint-text">Nothing in this category.</p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="list-section-head">
          <span className="list-section-title">
            <span className="list-section-icon">📦</span>Products
          </span>
        </div>
      )}

      <div className="list">
        {filtered.map((f) => (
          <ProductCard key={f.id} formulation={f} onPick={() => navigate(`/batch/new/${f.id}`)} />
        ))}
      </div>
    </div>
  )
}

function ProductCard({ formulation, onPick }: { formulation: Formulation; onPick: () => void }) {
  const isVariant = Boolean(formulation.base_name && formulation.variant)
  const headline = formulation.base_name ?? formulation.name ?? formulation.code
  const subLine = isVariant ? formulation.name ?? formulation.code : formulation.code
  const typeLabel = formulation.category ?? 'Formula'

  const variantKey = (formulation.variant ?? '').toLowerCase()

  return (
    <button className="product-card" onClick={onPick}>
      <span className="product-card-main">
        <span className="product-card-type">{typeLabel}</span>
        <span className="product-card-name">{headline}</span>
        {subLine && subLine !== headline && <span className="product-card-sub">{subLine}</span>}
        {isVariant && (
          <span className="product-card-badges">
            <span className={`product-badge product-badge-variant variant-${variantKey}`}>
              {formulation.variant}
            </span>
          </span>
        )}
      </span>
      <ProductImage formulation={formulation} className="product-card-swatch" />
    </button>
  )
}
