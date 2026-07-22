import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { GoMaxBadge } from '../GoMaxLogo'

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
  const [sendingId, setSendingId] = useState<string | null>(null)
  const navigate = useNavigate()

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('batches')
      .select(
        'id, batch_number, batch_date, status, started_at, submitted_at, testing_status, formulations(code, name, base_name)',
      )
      .order('started_at', { ascending: false })
      .limit(100)
    if (error) setError(error.message)
    else setBatches((data as unknown as HistoryRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function sendForTesting(id: string) {
    setSendingId(id)
    setError(null)
    const { error } = await supabase.rpc('send_batch_for_testing', { p_batch_id: id })
    setSendingId(null)
    if (error) setError(error.message)
    else load()
  }

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
      <div className="screen-top-row">
        <button className="link-btn back-btn" onClick={() => navigate('/formulation')}>
          ← Back
        </button>
        <GoMaxBadge size={28} />
      </div>

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
          const needsTesting = b.status === 'submitted' && b.testing_status === 'not_sent'
          return (
            <div key={b.id} className="queue-card">
              <button className="queue-card-main queue-card-main-btn" onClick={() => navigate(`/batch/${b.id}`)}>
                <span className="queue-card-top">
                  <span className="queue-card-number">#{b.batch_number}</span>
                  <span className="queue-card-time">{b.batch_date}</span>
                </span>
                <span className="queue-card-name">{product}</span>
                <span className="queue-card-sub">{b.formulations?.code}</span>
              </button>
              {needsTesting ? (
                <button
                  className="queue-card-send-btn"
                  onClick={() => sendForTesting(b.id)}
                  disabled={sendingId === b.id}
                >
                  {sendingId === b.id ? '…' : '🧪 Send'}
                </button>
              ) : (
                <span className={pill.cls}>{pill.label}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
