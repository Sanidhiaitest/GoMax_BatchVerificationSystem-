import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import type { Formulation } from '../types'

interface ConfirmState {
  batchNumber: string
  masonName: string
}

export default function BatchConfirm() {
  const { formulationId } = useParams<{ formulationId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as ConfirmState | null

  const [formulation, setFormulation] = useState<Formulation | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!formulationId) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('formulations')
        .select('id, code, name, category, base_name, variant')
        .eq('id', formulationId)
        .single()
      if (!cancelled) setFormulation(data ?? null)
    })()
    return () => {
      cancelled = true
    }
  }, [formulationId])

  useEffect(() => {
    if (!state) navigate(`/batch/new/${formulationId}`, { replace: true })
  }, [state, formulationId, navigate])

  if (!state || !formulationId) return null

  const headline = formulation?.base_name ?? formulation?.name ?? formulation?.code ?? ''
  const subtitle = formulation?.base_name ? formulation.name ?? formulation.code : null
  const workers = state.masonName
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)

  async function handleStart() {
    setStarting(true)
    setError(null)
    const { data, error } = await supabase.rpc('start_batch', {
      p_formulation_id: formulationId,
      p_batch_number: state!.batchNumber,
      p_mason_name: state!.masonName,
    })
    setStarting(false)
    if (error) {
      setError(
        error.message.includes('duplicate_batch_number')
          ? `Batch number "${state!.batchNumber}" was already used today. Go back and pick another.`
          : error.message,
      )
      return
    }
    navigate(`/batch/${data}`, { replace: true })
  }

  return (
    <div className="confirm-screen">
      <button className="link-btn back-btn" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div className="confirm-icon">🔍</div>
      <span className="confirm-label">Ready to start</span>
      <span className="confirm-number">#{state.batchNumber}</span>
      <span className="confirm-pill">
        {headline}
        {subtitle ? ` · ${subtitle}` : ''}
      </span>

      <div className="confirm-card">
        <p className="confirm-card-label">Workers on this batch</p>
        <div className="confirm-workers">
          {workers.map((name) => (
            <span key={name} className="confirm-worker-chip">
              {name}
            </span>
          ))}
        </div>
      </div>

      <div className="confirm-banner">ℹ️ Timer starts the moment you press START BATCH</div>

      {error && <p className="error-text">{error}</p>}

      <div className="confirm-footer">
        <button className="btn btn-primary" onClick={handleStart} disabled={starting}>
          {starting ? 'Starting…' : 'START BATCH'}
        </button>
      </div>
    </div>
  )
}
