import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useSupervisor } from '../SupervisorContext'
import Avatar from '../Avatar'

interface QueueRow {
  id: string
  batch_number: string
  batch_date: string
  testing_status: string
  sent_for_testing_at: string | null
  formulations: { code: string } | null
  supervisors: { name: string } | null
}

export default function TesterQueue() {
  const { supervisor, logout } = useSupervisor()
  const [rows, setRows] = useState<QueueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const firstName = supervisor?.name.split(' ')[0] ?? ''

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('batches')
        .select('id, batch_number, batch_date, testing_status, sent_for_testing_at, formulations(code), supervisors!batches_supervisor_id_fkey(name)')
        .in('testing_status', ['pending', 'in_progress'])
        .order('sent_for_testing_at', { ascending: true })
      if (cancelled) return
      if (error) setError(error.message)
      else setRows((data as unknown as QueueRow[]) ?? [])
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
          <p className="hint-text">Signed in</p>
          <p className="top-bar-title">{supervisor?.name}</p>
        </div>
        <div className="top-bar-actions">
          <button className="link-btn" onClick={() => navigate('/testing/history')}>
            History
          </button>
          <button className="link-btn" onClick={logout}>
            Switch
          </button>
        </div>
      </header>

      <div className="greeting">
        <h1 className="title">Hello, {firstName}! 🧪</h1>
        <p className="subtitle">Batches waiting for testing</p>
      </div>

      {loading && <p className="hint-text">Loading…</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && rows.length === 0 && !error && (
        <p className="hint-text">Nothing waiting right now — new batches will show up here.</p>
      )}

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
                {r.testing_status === 'in_progress' && ' · testing in progress'}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
