import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Avatar from '../Avatar'

interface HistoryRow {
  id: string
  batch_number: string
  batch_date: string
  status: 'in_progress' | 'submitted'
  started_at: string
  submitted_at: string | null
  formulations: { code: string } | null
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
        .select('id, batch_number, batch_date, status, started_at, submitted_at, formulations(code)')
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

  return (
    <div className="screen">
      <button className="link-btn back-btn" onClick={() => navigate('/formulation')}>
        ← Back
      </button>

      <h2 className="section-title">Your batches</h2>

      {loading && <p className="hint-text">Loading…</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && batches.length === 0 && !error && (
        <p className="hint-text">No batches yet — start your first one from the formulation list.</p>
      )}

      <div className="list">
        {batches.map((b) => (
          <button
            key={b.id}
            className="list-item"
            onClick={() => navigate(`/batch/${b.id}`)}
          >
            <Avatar name={b.formulations?.code ?? '?'} />
            <span className="list-item-body">
              <span className="list-item-code">
                {b.formulations?.code} · #{b.batch_number}
              </span>
              <span className="list-item-sub">
                {b.batch_date}
                {b.status === 'in_progress' ? ' · in progress' : ' · submitted'}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
