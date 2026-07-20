import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

interface HistoryRow {
  id: string
  batch_number: string
  batch_date: string
  status: 'in_progress' | 'submitted'
  started_at: string
  submitted_at: string | null
  testing_status: string
  formulations: { code: string; name: string | null; base_name: string | null } | null
}

export default function History() {
  const [batches, setBatches] = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('batches')
        .select(
          'id, batch_number, batch_date, status, started_at, submitted_at, testing_status, formulations(code, name, base_name)',
        )
        .order('started_at', { ascending: false })
        .limit(100)
      if (cancelled) return
      if (error) setError(error.message)
      else setBatches((data as unknown as HistoryRow[]) ?? [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function statusPill(b: HistoryRow) {
    if (b.status === 'in_progress') return { label: 'In progress', cls: 'queue-card-status in-progress' }
    if (b.testing_status === 'passed') return { label: '✓ Passed', cls: 'result-pill result-pill-pass' }
    if (b.testing_status === 'failed') return { label: '✗ Failed', cls: 'result-pill result-pill-fail' }
    if (b.testing_status === 'pending' || b.testing_status === 'in_progress')
      return { label: 'Testing', cls: 'queue-card-status in-progress' }
    return { label: 'Submitted', cls: 'queue-card-status' }
  }

  return (
    <div className="screen">
      <button className="link-btn back-btn" onClick={() => navigate('/formulation')}>
        ← Back
      </button>

      <div className="greeting">
        <h1 className="title picker-title">Your batches</h1>
        <p className="subtitle picker-subtitle">Everything you've started or submitted</p>
      </div>

      {loading && <p className="hint-text">Loading…</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && batches.length === 0 && !error && (
        <p className="hint-text">No batches yet — start your first one from the product list.</p>
      )}

      <div className="list">
        {batches.map((b) => {
          const product = b.formulations?.base_name ?? b.formulations?.name ?? b.formulations?.code
          const pill = statusPill(b)
          return (
            <button key={b.id} className="queue-card" onClick={() => navigate(`/batch/${b.id}`)}>
              <span className="queue-card-main">
                <span className="queue-card-top">
                  <span className="queue-card-number">#{b.batch_number}</span>
                  <span className="queue-card-time">{b.batch_date}</span>
                </span>
                <span className="queue-card-name">{product}</span>
                <span className="queue-card-sub">{b.formulations?.code}</span>
              </span>
              <span className={pill.cls}>{pill.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
