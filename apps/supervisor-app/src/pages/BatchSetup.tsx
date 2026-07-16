import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function BatchSetup() {
  const { formulationId } = useParams<{ formulationId: string }>()
  const [batchNumber, setBatchNumber] = useState('')
  const [masonName, setMasonName] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const canStart = batchNumber.trim().length > 0 && masonName.trim().length > 0

  async function handleStart() {
    if (!formulationId) return
    setStarting(true)
    setError(null)
    const { data, error } = await supabase.rpc('start_batch', {
      p_formulation_id: formulationId,
      p_batch_number: batchNumber.trim(),
      p_mason_name: masonName.trim(),
    })
    setStarting(false)
    if (error) {
      setShowConfirm(false)
      setError(
        error.message.includes('duplicate_batch_number')
          ? `Batch number "${batchNumber.trim()}" was already used today. Enter a different number.`
          : error.message,
      )
      return
    }
    navigate(`/batch/${data}`, { replace: true })
  }

  return (
    <div className="screen">
      <button className="link-btn back-btn" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <h2 className="section-title">New batch</h2>

      <label className="field">
        <span className="field-label">Batch number</span>
        <input
          className="field-input"
          inputMode="numeric"
          placeholder="e.g. 104"
          value={batchNumber}
          onChange={(e) => setBatchNumber(e.target.value)}
        />
      </label>

      <label className="field">
        <span className="field-label">Mason's name</span>
        <input
          className="field-input"
          placeholder="e.g. Ramesh"
          value={masonName}
          onChange={(e) => setMasonName(e.target.value)}
        />
      </label>

      {error && <p className="error-text">{error}</p>}

      <button
        className="btn btn-primary"
        disabled={!canStart}
        onClick={() => setShowConfirm(true)}
      >
        Start Batch
      </button>

      {showConfirm && (
        <div className="modal-backdrop">
          <div className="modal">
            <p className="modal-title">Starting now?</p>
            <p className="modal-body">
              Batch {batchNumber} with mason {masonName}. This will log the start time on the
              server.
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowConfirm(false)} disabled={starting}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleStart} disabled={starting}>
                {starting ? 'Starting…' : 'Yes, start'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
