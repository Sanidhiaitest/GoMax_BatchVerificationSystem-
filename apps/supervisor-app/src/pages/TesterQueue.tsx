import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useSupervisor } from '../SupervisorContext'
import AppHeader from '../AppHeader'

interface QueueRow {
  id: string
  batch_number: string
  batch_date: string
  testing_status: string
  sent_for_testing_at: string | null
  formulations: { code: string; name: string | null; base_name: string | null } | null
  supervisors: { name: string } | null
}

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'Yesterday' : `${days}d ago`
}

export default function TesterQueue() {
  const { supervisor, logout } = useSupervisor()
  const [rows, setRows] = useState<QueueRow[]>([])
  const [completedCount, setCompletedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [supervisorFilter, setSupervisorFilter] = useState<string | null>(null)
  const navigate = useNavigate()

  const firstName = supervisor?.name.split(' ')[0] ?? ''

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [{ data, error }, { count }] = await Promise.all([
        supabase
          .from('batches')
          .select(
            'id, batch_number, batch_date, testing_status, sent_for_testing_at, formulations(code, name, base_name), supervisors!batches_supervisor_id_fkey(name)',
          )
          .in('testing_status', ['pending', 'in_progress'])
          .order('sent_for_testing_at', { ascending: true }),
        supabase
          .from('batches')
          .select('id', { count: 'exact', head: true })
          .in('testing_status', ['passed', 'failed']),
      ])
      if (cancelled) return
      if (error) setError(error.message)
      else setRows((data as unknown as QueueRow[]) ?? [])
      setCompletedCount(count ?? 0)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const pendingCount = rows.filter((r) => r.testing_status === 'pending').length
  const inProgressCount = rows.filter((r) => r.testing_status === 'in_progress').length

  const supervisorNames = Array.from(new Set(rows.map((r) => r.supervisors?.name).filter((n): n is string => Boolean(n))))
  const visibleRows = supervisorFilter ? rows.filter((r) => r.supervisors?.name === supervisorFilter) : rows

  return (
    <div className="screen">
      <AppHeader name={supervisor?.name ?? ''} onLogout={logout} />

      <div className="greeting">
        <h1 className="title picker-title">
          Hi {firstName}, ready to test? 🧪
        </h1>
        <p className="subtitle picker-subtitle">Batches waiting for QC</p>
      </div>

      <div className="tester-stats">
        <div className="tester-stat">
          <span className="tester-stat-value">{pendingCount}</span>
          <span className="tester-stat-label">Waiting</span>
        </div>
        <div className="tester-stat">
          <span className="tester-stat-value">{inProgressCount}</span>
          <span className="tester-stat-label">In progress</span>
        </div>
        <div className="tester-stat">
          <span className="tester-stat-value">{completedCount}</span>
          <span className="tester-stat-label">Completed</span>
        </div>
      </div>

      <div className="list-section-head">
        <span className="list-section-title">
          <span className="list-section-icon">🧪</span>Queue
        </span>
        <button className="list-section-cta" onClick={() => navigate('/testing/history')}>
          View history
        </button>
      </div>

      {supervisorNames.length > 1 && (
        <div className="category-tabs">
          <button
            className={`category-tab ${supervisorFilter === null ? 'active' : ''}`}
            onClick={() => setSupervisorFilter(null)}
          >
            All
          </button>
          {supervisorNames.map((name) => (
            <button
              key={name}
              className={`category-tab ${supervisorFilter === name ? 'active' : ''}`}
              onClick={() => setSupervisorFilter(name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="hint-text">Loading…</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && rows.length === 0 && !error && (
        <div className="empty-state">
          <div className="empty-state-icon">✓</div>
          <p className="empty-state-title">All clear!</p>
          <p className="hint-text">Nothing waiting right now — new batches will show up here.</p>
        </div>
      )}
      {!loading && rows.length > 0 && visibleRows.length === 0 && (
        <p className="hint-text">No batches from {supervisorFilter} right now.</p>
      )}

      <div className="list">
        {visibleRows.map((r) => {
          const product = r.formulations?.base_name ?? r.formulations?.name ?? r.formulations?.code
          const inProgress = r.testing_status === 'in_progress'
          return (
            <button key={r.id} className="queue-card" onClick={() => navigate(`/testing/${r.id}`)}>
              <span className="queue-card-main">
                <span className="queue-card-top">
                  <span className="queue-card-number">#{r.batch_number}</span>
                  <span className="queue-card-time">{timeAgo(r.sent_for_testing_at)}</span>
                </span>
                <span className="queue-card-name">{product}</span>
                <span className="queue-card-sub">
                  {r.formulations?.code} · {r.supervisors?.name}
                </span>
              </span>
              <span className={`queue-card-status ${inProgress ? 'in-progress' : ''}`}>
                {inProgress ? 'In progress' : 'New'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
