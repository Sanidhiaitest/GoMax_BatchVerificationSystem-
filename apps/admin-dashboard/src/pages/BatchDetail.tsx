import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Avatar from '../Avatar'
import type { BatchFlag, BatchMaterial } from '../types'

interface BatchDetailData {
  id: string
  batch_number: string
  batch_date: string
  mason_name: string
  status: 'in_progress' | 'submitted'
  started_at: string
  submitted_at: string | null
  formulations: { code: string; name: string | null } | null
  supervisors: { name: string } | null
}

const SEVERITY_RANK: Record<string, number> = { critical: 0, warning: 1, info: 2 }

export default function BatchDetail() {
  const { batchId } = useParams<{ batchId: string }>()
  const [batch, setBatch] = useState<BatchDetailData | null>(null)
  const [materials, setMaterials] = useState<BatchMaterial[]>([])
  const [flags, setFlags] = useState<BatchFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!batchId) return
    let cancelled = false
    ;(async () => {
      const [{ data: b, error: bErr }, { data: m }, { data: fl }] = await Promise.all([
        supabase
          .from('batches')
          .select('*, formulations(code, name), supervisors(name)')
          .eq('id', batchId)
          .single(),
        supabase.from('batch_materials').select('*').eq('batch_id', batchId).order('sort_order'),
        supabase
          .from('batch_flags')
          .select('*')
          .eq('batch_id', batchId)
          .order('created_at', { ascending: false }),
      ])
      if (cancelled) return
      if (bErr) setError(bErr.message)
      else setBatch(b as BatchDetailData)
      setMaterials(m ?? [])
      setFlags(((fl ?? []) as BatchFlag[]).sort((a, b2) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b2.severity]))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [batchId])

  if (loading) return <p className="hint-text">Loading…</p>
  if (error || !batch) return <p className="error-text">{error ?? 'Batch not found'}</p>

  const duration =
    batch.submitted_at && batch.started_at
      ? Math.round(
          ((new Date(batch.submitted_at).getTime() - new Date(batch.started_at).getTime()) / 60000) * 10,
        ) / 10
      : null

  const addedCount = materials.filter((m) => m.status === 'added').length
  const skippedCount = materials.filter((m) => m.status === 'skipped').length
  const pendingCount = materials.filter((m) => m.status === 'pending').length

  return (
    <div className="page">
      <Link to="/" className="link-btn back-btn">
        ← Back to batches
      </Link>

      <div className="batch-header">
        <div className="batch-header-top">
          <div className="batch-row-left">
            <Avatar name={batch.formulations?.code ?? '?'} size={44} />
            <div>
              <h1 className="page-title">
                {batch.formulations?.code} · #{batch.batch_number}
              </h1>
              <p className="hint-text">
                {batch.supervisors?.name} · Mason: {batch.mason_name} · {batch.batch_date}
              </p>
            </div>
          </div>
          <span className={`status-pill status-${batch.status === 'submitted' ? 'added' : 'pending'}`}>
            {batch.status === 'submitted' ? '✓ Submitted' : '… In progress'}
          </span>
        </div>

        <div className="stat-row batch-stat-row">
          <div className="stat-card stat-card-accent">
            <span className="stat-card-value">{duration !== null ? `${duration}m` : '—'}</span>
            <span className="stat-card-label">Start → submit</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-value">{new Date(batch.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="stat-card-label">Started</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-value">
              {batch.submitted_at
                ? new Date(batch.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '—'}
            </span>
            <span className="stat-card-label">Submitted</span>
          </div>
          <div className="stat-card" style={pendingCount > 0 ? { borderColor: 'var(--warning)' } : undefined}>
            <span className="stat-card-value">
              {addedCount}/{materials.length}
            </span>
            <span className="stat-card-label">Materials added</span>
          </div>
        </div>
      </div>

      {flags.length > 0 && (
        <section>
          <h2 className="section-title">Flags</h2>
          <div className="list">
            {flags.map((f) => (
              <div key={f.id} className={`flag-card severity-${f.severity}`}>
                <div className="flag-card-head">
                  <span className={`severity-badge severity-${f.severity}`}>{f.severity}</span>
                  <span className="hint-text">{f.source === 'ai' ? 'AI review' : 'Rule check'}</span>
                </div>
                <p className="flag-message">{f.message}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title">
          Materials
          <span className="hint-text">
            ({addedCount} added · {skippedCount} skipped{pendingCount > 0 ? ` · ${pendingCount} not marked` : ''})
          </span>
        </h2>
        <div className="table-scroll">
          <table className="materials-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Qty</th>
                <th>Status</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr key={m.id} className={m.suspicious ? 'row-suspicious' : ''}>
                  <td className="materials-table-desc">
                    <Avatar name={m.description} size={26} />
                    {m.description}
                  </td>
                  <td>{m.quantity ?? '—'}</td>
                  <td>
                    <span className={`table-symbol table-symbol-${m.status}`}>
                      {m.status === 'added' ? '✓' : m.status === 'skipped' ? '✗' : '—'}
                    </span>
                    {m.suspicious && <span className="suspicious-badge"> ⚠</span>}
                  </td>
                  <td className="hint-text">
                    {m.ticked_at ? new Date(m.ticked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
