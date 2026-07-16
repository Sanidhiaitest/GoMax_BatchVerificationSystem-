import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Avatar from '../Avatar'
import type { Batch, BatchMaterial } from '../types'

interface BatchWithFormulation extends Batch {
  formulations: { code: string; name: string | null } | null
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
  const pendingCount = materials.filter((m) => m.status === 'pending').length
  const durationMinutes =
    readOnly && batch.submitted_at
      ? Math.round(
          ((new Date(batch.submitted_at).getTime() - new Date(batch.started_at).getTime()) / 60000) * 10,
        ) / 10
      : null

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
    <div className="screen">
      <header className="top-bar">
        <div>
          <p className="hint-text">
            {batch.formulations?.code} · Batch {batch.batch_number}
          </p>
          <p className="top-bar-title">Mason: {batch.mason_name}</p>
        </div>
        {readOnly && <span className="status-pill status-added">✓ Submitted</span>}
      </header>

      {readOnly && durationMinutes !== null && (
        <div className="stat-banner">
          <span className="stat-banner-value">{durationMinutes} min</span>
          <span className="stat-banner-label">start to submit</span>
        </div>
      )}

      <div className="list">
        {materials.map((m) => (
          <MaterialRow key={m.id} material={m} onChanged={load} readOnly={readOnly} />
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}

      {readOnly && <TestingStatusSection batch={batch} onSend={handleSendForTesting} sending={sendingForTesting} />}

      {!readOnly && (
        <div className="submit-bar">
          {pendingCount > 0 && (
            <p className="hint-text">{pendingCount} material(s) not yet marked.</p>
          )}
          <button className="btn btn-primary" onClick={() => setShowSubmitConfirm(true)}>
            Submit Batch
          </button>
        </div>
      )}

      {showSubmitConfirm && (
        <div className="modal-backdrop">
          <div className="modal">
            <p className="modal-title">Submit batch?</p>
            <p className="modal-body">
              {pendingCount > 0
                ? `${pendingCount} material(s) are still unmarked. They will be flagged as missing. `
                : ''}
              Once submitted this record is locked and cannot be edited.
            </p>
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
      <button className="btn btn-ghost" onClick={onSend} disabled={sending}>
        {sending ? 'Sending…' : '🧪 Send for Testing'}
      </button>
    )
  }

  if (batch.testing_status === 'pending' || batch.testing_status === 'in_progress') {
    return (
      <div className="stat-banner">
        <span className="stat-banner-value">
          {batch.testing_status === 'pending' ? 'Sent for testing' : 'Testing in progress'}
        </span>
        <span className="stat-banner-label">waiting on the lab</span>
      </div>
    )
  }

  return (
    <div>
      <div className={`stat-banner ${batch.testing_status === 'failed' ? 'stat-banner-danger' : ''}`}>
        <span className="stat-banner-value">{batch.testing_status === 'passed' ? '✓ Test passed' : '✗ Test failed'}</span>
        <span className="stat-banner-label">
          {batch.testing_completed_at && new Date(batch.testing_completed_at).toLocaleString()}
        </span>
      </div>
      {batch.test_remarks && <p className="hint-text">"{batch.test_remarks}"</p>}
    </div>
  )
}

function MaterialRow({
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

  return (
    <div className={`material-row ${locked ? 'material-row-locked' : ''}`}>
      <div className="material-row-main">
        <span className="material-desc-group">
          <Avatar name={material.description} size={32} />
          <p className="material-desc">{material.description}</p>
        </span>
        <input
          className="field-input material-qty"
          inputMode="decimal"
          placeholder="Qty used"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          disabled={locked || busy}
        />
      </div>
      <div className="material-row-actions">
        {locked ? (
          <div className="material-row-status">
            <span className={`status-pill status-${material.status}`}>
              {material.status === 'added' ? '✓ Added' : material.status === 'skipped' ? '✗ Skipped' : '— Not marked'}
              {material.suspicious && <span className="suspicious-badge"> ⚠ fast</span>}
            </span>
            {material.ticked_at && (
              <span className="hint-text material-time">{new Date(material.ticked_at).toLocaleTimeString()}</span>
            )}
          </div>
        ) : (
          <>
            <button className="icon-btn icon-btn-cross" onClick={() => mark('skipped')} disabled={busy}>
              ✗
            </button>
            <button className="icon-btn icon-btn-check" onClick={() => mark('added')} disabled={busy}>
              ✓
            </button>
          </>
        )}
      </div>
      {rowError && <p className="error-text material-error">{rowError}</p>}
    </div>
  )
}
