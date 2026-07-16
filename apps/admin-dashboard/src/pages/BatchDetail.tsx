import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
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

  return (
    <div className="page">
      <Link to="/" className="link-btn back-btn">
        ← Back to batches
      </Link>

      <div className="batch-header">
        <h1 className="page-title">
          {batch.formulations?.code} · Batch #{batch.batch_number}
        </h1>
        <dl className="kv-grid">
          <dt>Supervisor</dt>
          <dd>{batch.supervisors?.name}</dd>
          <dt>Mason</dt>
          <dd>{batch.mason_name}</dd>
          <dt>Date</dt>
          <dd>{batch.batch_date}</dd>
          <dt>Started</dt>
          <dd>{new Date(batch.started_at).toLocaleString()}</dd>
          <dt>Submitted</dt>
          <dd>{batch.submitted_at ? new Date(batch.submitted_at).toLocaleString() : '— in progress —'}</dd>
          {duration !== null && (
            <>
              <dt>Duration</dt>
              <dd>{duration} min</dd>
            </>
          )}
        </dl>
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
        <h2 className="section-title">Materials</h2>
        <div className="list">
          {materials.map((m) => (
            <div key={m.id} className="material-detail-row">
              <div className="batch-row-main">
                <span className="list-item-code">{m.description}</span>
                <span className="list-item-sub">
                  Qty: {m.quantity ?? '—'}
                  {m.ticked_at && ` · ${new Date(m.ticked_at).toLocaleTimeString()}`}
                </span>
              </div>
              <span className={`status-pill status-${m.status}`}>
                {m.status === 'added' ? '✓ Added' : m.status === 'skipped' ? '✗ Skipped' : 'Pending'}
                {m.suspicious && <span className="suspicious-badge"> ⚠</span>}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
