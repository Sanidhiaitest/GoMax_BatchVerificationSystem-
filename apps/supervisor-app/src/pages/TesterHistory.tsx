import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Avatar from '../Avatar'

interface HistoryRow {
  id: string
  batch_number: string
  batch_date: string
  testing_status: string
  formulations: { code: string } | null
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
        .select('id, batch_number, batch_date, testing_status, formulations(code), supervisors!batches_supervisor_id_fkey(name)')
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

      <h2 className="section-title">Tests you've completed</h2>

      {loading && <p className="hint-text">Loading…</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && rows.length === 0 && !error && <p className="hint-text">No completed tests yet.</p>}

      <div className="list">
        {rows.map((r) => (
          <button key={r.id} className="list-item" onClick={() => navigate(`/testing/${r.id}`)}>
            <Avatar name={r.formulations?.code ?? '?'} />
            <span className="list-item-body">
              <span className="list-item-code">
                {r.formulations?.code} · #{r.batch_number}
              </span>
              <span className="list-item-sub">
                {r.supervisors?.name} · {r.batch_date}
              </span>
            </span>
            <span className={`status-pill status-${r.testing_status === 'passed' ? 'added' : 'skipped'}`}>
              {r.testing_status === 'passed' ? '✓ Passed' : '✗ Failed'}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
