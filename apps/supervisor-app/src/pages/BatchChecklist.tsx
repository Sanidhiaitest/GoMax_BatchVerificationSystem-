import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import type { Batch, BatchMaterial } from '../types'

interface BatchWithFormulation extends Batch {
  formulations: { code: string; name: string | null } | null
}

function formatElapsed(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds)
  const mins = Math.floor(clamped / 60)
  const secs = Math.floor(clamped % 60)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export default function BatchChecklist() {
  const { batchId } = useParams<{ batchId: string }>()
  const [batch, setBatch] = useState<BatchWithFormulation | null>(null)
  const [materials, setMaterials] = useState<BatchMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [sendingForTesting, setSendingForTesting] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    if (!batchId) return
    const [{ data: b, error: bErr }, { data: m, error: mErr }] = await Promise.all([
      supabase.from('batches').select('*, formulations(code, name)').eq('id', batchId).single(),
      supabase.from('batch_materials').select('*').eq('batch_id', batchId).order('sort_order'),
    ])
    if (bErr) setError(bErr.message)
    else setBatch(b as BatchWithFormulation)
    if (mErr) setError(mErr.message)
    else setMaterials(m ?? [])
    setLoading(false)
  }, [batchId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!batch) return
    const start = new Date(batch.started_at).getTime()
    const end = batch.status === 'submitted' && batch.submitted_at ? new Date(batch.submitted_at).getTime() : null
    if (end !== null) {
      setElapsedSeconds((end - start) / 1000)
      return
    }
    const tick = () => setElapsedSeconds((Date.now() - start) / 1000)
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [batch])

  if (loading) {
    return (
      <div className="screen center">
        <p>Loading batch…</p>
      </div>
    )
  }

  if (!batch) {
    return (
      <div className="screen center">
        <p className="error-text">{error ?? 'Batch not found.'}</p>
      </div>
    )
  }

  const readOnly = batch.status === 'submitted'
  const addedCount = materials.filter((m) => m.status === 'added').length
  const pendingCount = materials.filter((m) => m.status === 'pending').length
  const progressPct = materials.length > 0 ? Math.round((addedCount / materials.length) * 100) : 0

  async function handleSubmit() {
    if (!batchId) return
    setSubmitting(true)
    setError(null)
    const { error } = await supabase.rpc('submit_batch', { p_batch_id: batchId })
    setSubmitting(false)
    setShowSubmitConfirm(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate(`/batch/${batchId}/submitted`)
  }

  async function handleSendForTesting() {
    if (!batchId) return
    setSendingForTesting(true)
    setError(null)
    const { error } = await supabase.rpc('send_batch_for_testing', { p_batch_id: batchId })
    setSendingForTesting(false)
    if (error) setError(error.message)
    else load()
  }

  return (
    <div className="checklist-screen">
      <div className="checklist-header">
        <div className="checklist-header-row">
          <div>
            <span className="checklist-product-pill">
              {batch.formulations?.code}
              {batch.formulations?.name ? ` · ${batch.formulations.name}` : ''}
            </span>
            <p className="checklist-batch-sub">Batch #{batch.batch_number}</p>
          </div>
          <div className="checklist-timer">
            <span className="checklist-timer-value">{formatElapsed(elapsedSeconds)}</span>
            <span className="checklist-timer-label">{readOnly ? 'total time' : 'elapsed'}</span>
          </div>
        </div>

        <p className="checklist-workers">👷 {batch.mason_name}</p>

        <div className="checklist-progress-row">
          <span className="checklist-progress-label">
            {addedCount}/{materials.length} ADDED
          </span>
          <span className="checklist-progress-pct">{progressPct}%</span>
        </div>
        <div className="checklist-progress-track">
          <div className="checklist-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="checklist-body">
        {materials.map((m) => (
          <MaterialCard key={m.id} material={m} onChanged={load} readOnly={readOnly} />
        ))}

        {error && <p className="error-text">{error}</p>}

        {readOnly && (
          <TestingStatusSection batch={batch} onSend={handleSendForTesting} sending={sendingForTesting} />
        )}
      </div>

      {!readOnly && (
        <div className="checklist-footer">
          {pendingCount > 0 && (
            <p className="hint-text">
              {pendingCount} item(s) remaining — all required
            </p>
          )}
          <button
            className="btn btn-primary"
            disabled={pendingCount > 0}
            onClick={() => setShowSubmitConfirm(true)}
          >
            {pendingCount > 0 ? 'Complete all items first' : 'Submit Batch'}
          </button>
        </div>
      )}

      {showSubmitConfirm && (
        <div className="modal-backdrop">
          <div className="modal">
            <p className="modal-title">Submit batch?</p>
            <p className="modal-body">Once submitted this record is locked and cannot be edited.</p>
            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setShowSubmitConfirm(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Yes, submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TestingStatusSection({
  batch,
  onSend,
  sending,
}: {
  batch: BatchWithFormulation
  onSend: () => void
  sending: boolean
}) {
  if (batch.testing_status === 'not_sent') {
    return (
      <button className="btn btn-primary" onClick={onSend} disabled={sending}>
        {sending ? 'Sending…' : '🧪 Send for Testing'}
      </button>
    )
  }

  if (batch.testing_status === 'pending' || batch.testing_status === 'in_progress') {
    return (
      <div className="result-banner result-info">
        <span className="result-banner-icon">🧪</span>
        <div>
          <span className="result-banner-title">
            {batch.testing_status === 'pending' ? 'Sent for testing' : 'Testing in progress'}
          </span>
          <span className="result-banner-sub">Waiting on the lab</span>
        </div>
      </div>
    )
  }

  const passed = batch.testing_status === 'passed'
  return (
    <div className="result-block">
      <div className={`result-banner ${passed ? 'result-pass' : 'result-fail'}`}>
        <span className="result-banner-icon">{passed ? '✓' : '✗'}</span>
        <div>
          <span className="result-banner-title">{passed ? 'Test Passed' : 'Test Failed'}</span>
          <span className="result-banner-sub">
            {batch.testing_completed_at ? new Date(batch.testing_completed_at).toLocaleString() : ''}
          </span>
        </div>
      </div>
      {batch.test_remarks && <p className="result-remarks">"{batch.test_remarks}"</p>}
    </div>
  )
}

function MaterialCard({
  material,
  onChanged,
  readOnly,
}: {
  material: BatchMaterial
  onChanged: () => void
  readOnly: boolean
}) {
  const [quantity, setQuantity] = useState(material.quantity?.toString() ?? '')
  const [busy, setBusy] = useState(false)
  const [rowError, setRowError] = useState<string | null>(null)

  const locked = readOnly || material.status !== 'pending'

  async function mark(status: 'added' | 'skipped') {
    setRowError(null)
    if (status === 'added' && quantity.trim().length === 0) {
      setRowError('Quantity is required to mark this as added.')
      return
    }
    setBusy(true)
    const { error } = await supabase.rpc('tick_material', {
      p_batch_material_id: material.id,
      p_status: status,
      p_quantity: status === 'added' ? Number(quantity) : null,
    })
    setBusy(false)
    if (error) {
      setRowError(error.message)
      return
    }
    onChanged()
  }

  if (locked) {
    return (
      <div className="material-card material-card-locked">
        <div className="material-card-result">
          <div className="material-card-head">
            <span className="material-icon">🧱</span>
            <div className="material-card-title-group">
              <span className="material-card-name">{material.description}</span>
              {material.ticked_at && (
                <span className="material-card-meta">{new Date(material.ticked_at).toLocaleTimeString()}</span>
              )}
            </div>
          </div>
          <span className={`status-pill status-${material.status}`}>
            {material.status === 'added' ? '✓ Added' : material.status === 'skipped' ? '✗ Skipped' : '— Not marked'}
            {material.suspicious && <span className="suspicious-badge"> ⚠ fast</span>}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="material-card">
      <div className="material-card-head">
        <span className="material-icon">🧱</span>
        <div className="material-card-title-group">
          <span className="material-card-name">{material.description}</span>
          <span className="material-card-meta">Required</span>
        </div>
      </div>

      <div className="material-card-section">
        <span className="material-card-label">Quantity (kg)</span>
        <input
          className={`material-qty-input-lg ${quantity.trim() ? 'filled' : ''}`}
          inputMode="decimal"
          placeholder="Enter kg used"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          disabled={busy}
        />
      </div>

      {rowError && <p className="error-text">{rowError}</p>}

      <div className="material-card-actions">
        <button className="material-skip-btn" onClick={() => mark('skipped')} disabled={busy}>
          Skip
        </button>
        <button className="material-mark-btn" onClick={() => mark('added')} disabled={busy}>
          {busy ? 'Saving…' : 'Mark as Added'}
        </button>
      </div>
    </div>
  )
}
