import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { GoMaxBadge } from '../GoMaxLogo'
import type { Batch } from '../types'

interface SubmittedBatch extends Batch {
  formulations: { code: string; name: string | null; base_name: string | null } | null
}

export default function Submitted() {
  const { batchId } = useParams<{ batchId: string }>()
  const [batch, setBatch] = useState<SubmittedBatch | null>(null)
  const [materialsDone, setMaterialsDone] = useState<{ added: number; total: number }>({ added: 0, total: 0 })
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!batchId) return
    let cancelled = false
    ;(async () => {
      const [{ data: b }, { data: m }] = await Promise.all([
        supabase
          .from('batches')
          .select('*, formulations(code, name, base_name)')
          .eq('id', batchId)
          .single(),
        supabase.from('batch_materials').select('status').eq('batch_id', batchId),
      ])
      if (cancelled) return
      if (b) setBatch(b as SubmittedBatch)
      if (m) setMaterialsDone({ added: m.filter((r) => r.status === 'added').length, total: m.length })
    })()
    return () => {
      cancelled = true
    }
  }, [batchId])

  async function handleSendForTesting() {
    if (!batchId) return
    setSending(true)
    setSendError(null)
    const { error } = await supabase.rpc('send_batch_for_testing', { p_batch_id: batchId })
    setSending(false)
    if (error) {
      setSendError(error.message)
      return
    }
    setBatch((prev) => (prev ? { ...prev, testing_status: 'pending' } : prev))
  }

  const timeTaken = batch?.submitted_at
    ? Math.round((new Date(batch.submitted_at).getTime() - new Date(batch.started_at).getTime()) / 1000)
    : null

  const timeLabel =
    timeTaken == null ? '—' : timeTaken < 60 ? `${timeTaken}s` : `${Math.round(timeTaken / 60)}m`

  const productName = batch?.formulations?.base_name ?? batch?.formulations?.name ?? batch?.formulations?.code ?? ''
  const sentForTesting = batch ? batch.testing_status !== 'not_sent' : false

  return (
    <div className="submitted-screen">
      <GoMaxBadge size={30} />
      <div className="submitted-icon">✓</div>
      <h1 className="submitted-title">Ho Gaya! 🎉</h1>
      <p className="submitted-subtitle">
        {sentForTesting ? 'Sent for QC testing ✓' : 'Batch complete — not yet sent for testing'}
      </p>

      <div className="submitted-card">
        <p className="submitted-card-label">Batch Summary</p>

        <div className="submitted-row">
          <span className="submitted-row-label">Product</span>
          <span className="submitted-row-value">{productName}</span>
        </div>
        <div className="submitted-row">
          <span className="submitted-row-label">Batch</span>
          <span className="submitted-row-value submitted-row-value-accent">#{batch?.batch_number ?? '—'}</span>
        </div>
        <div className="submitted-row">
          <span className="submitted-row-label">Workers</span>
          <span className="submitted-row-value">{batch?.mason_name ?? '—'}</span>
        </div>
        <div className="submitted-row">
          <span className="submitted-row-label">Materials</span>
          <span className="submitted-row-value submitted-row-value-success">
            {materialsDone.added}/{materialsDone.total} ✓
          </span>
        </div>

        <div className="submitted-divider" />

        <div className="submitted-row">
          <span className="submitted-row-label">⏱ Time Taken</span>
          <span className="submitted-row-value submitted-row-value-accent">{timeLabel}</span>
        </div>
      </div>

      {sendError && <p className="error-text">{sendError}</p>}

      <div className="submitted-actions">
        {!sentForTesting && (
          <button className="btn btn-primary" onClick={handleSendForTesting} disabled={sending}>
            {sending ? 'Sending…' : '🧪 Send for Testing'}
          </button>
        )}

        <button className="btn btn-ghost" onClick={() => navigate('/formulation')}>
          Start New Batch
        </button>
      </div>
    </div>
  )
}
