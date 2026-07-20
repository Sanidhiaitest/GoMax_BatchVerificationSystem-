import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

interface HistoryRow {
  id: string
  batch_number: string
  batch_date: string
  testing_status: string
  testing_completed_at: string | null
  formulations: { code: string; name: string | null; base_name: string | null } | null
  supervisors: { name: string } | null
}

export default function TesterHistory() {
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('batches')
        .select(
          'id, batch_number, batch_date, testing_status, testing_completed_at, formulations(code, name, base_name), supervisors!batches_supervisor_id_fkey(name)',
        )
        .in('testing_status', ['passed', 'failed'])
        .order('testing_completed_at', { ascending: false })
        .limit(100)
      if (cancelled) return
      if (error) setError(error.message)
      else setRows((data as unknown as HistoryRow[]) ?? [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="screen">
      <button className="link-btn back-btn" onClick={() => navigate('/testing')}>
        ← Back
      </button>

      <div className="greeting">
        <h1 className="title picker-title">Tests completed</h1>
        <p className="subtitle picker-subtitle">Everything you've passed or failed</p>
      </div>

      {loading && <p className="hint-text">Loading…</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && rows.length === 0 && !error && <p className="hint-text">No completed tests yet.</p>}

      <div className="list">
        {rows.map((r) => {
          const product = r.formulations?.base_name ?? r.formulations?.name ?? r.formulations?.code
          const passed = r.testing_status === 'passed'
          return (
            <button key={r.id} className="queue-card" onClick={() => navigate(`/testing/${r.id}`)}>
              <span className="queue-card-main">
                <span className="queue-card-top">
                  <span className="queue-card-number">#{r.batch_number}</span>
                  <span className="queue-card-time">
                    {r.testing_completed_at ? new Date(r.testing_completed_at).toLocaleDateString() : r.batch_date}
                  </span>
                </span>
                <span className="queue-card-name">{product}</span>
                <span className="queue-card-sub">
                  {r.formulations?.code} · {r.supervisors?.name}
                </span>
              </span>
              <span className={`result-pill ${passed ? 'result-pill-pass' : 'result-pill-fail'}`}>
                {passed ? '✓ Passed' : '✗ Failed'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
