import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useSupervisor } from '../SupervisorContext'
import Avatar from '../Avatar'
import type { Batch, BatchMaterial } from '../types'

interface BatchWithRelations extends Batch {
  formulations: { code: string; name: string | null } | null
  supervisors: { name: string } | null
}

export default function TesterBatchDetail() {
  const { batchId } = useParams<{ batchId: string }>()
  const { supervisor } = useSupervisor()
  const [batch, setBatch] = useState<BatchWithRelations | null>(null)
  const [materials, setMaterials] = useState<BatchMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    if (!batchId) return
    const [{ data: b, error: bErr }, { data: m }] = await Promise.all([
      supabase
        .from('batches')
        .select('*, formulations(code, name), supervisors!batches_supervisor_id_fkey(name)')
        .eq('id', batchId)
        .single(),
      supabase.from('batch_materials').select('*').eq('batch_id', batchId).order('sort_order'),
    ])
    if (bErr) setError(bErr.message)
    else setBatch(b as BatchWithRelations)
    setMaterials(m ?? [])
    setLoading(false)
  }, [batchId])

  useEffect(() => {
    load()
  }, [load])

  async function handleStart() {
    if (!batchId) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('start_testing', { p_batch_id: batchId })
    setBusy(false)
    if (error) setError(error.message)
    else load()
  }

  if (loading) {
    return (
      <div className="screen center">
        <p>Loading…</p>
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

  return (
    <div className="screen">
      <div className="top-bar top-bar-stacked">
        <button className="link-btn back-btn" onClick={() => navigate('/testing')}>
          ← Back to queue
        </button>
        <div className="batch-row-left">
          <Avatar name={batch.formulations?.code ?? '?'} />
          <div>
            <p className="top-bar-title">
              {batch.formulations?.code} · #{batch.batch_number}
            </p>
            <p className="hint-text">
              {batch.supervisors?.name} · {batch.batch_date}
            </p>
          </div>
        </div>
      </div>

      <div className="list">
        {materials.map((m) => (
          <div key={m.id} className="material-row material-row-locked">
            <div className="material-row-main">
              <span className="material-desc-group">
                <Avatar name={m.description} size={32} />
                <p className="material-desc">{m.description}</p>
              </span>
              <span className="hint-text">Qty: {m.quantity ?? '—'}</span>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}

      {batch.testing_status === 'pending' && (
        <button className="btn btn-primary" onClick={handleStart} disabled={busy}>
          {busy ? 'Starting…' : 'Start Testing'}
        </button>
      )}

      {batch.testing_status === 'in_progress' && batch.testing_started_at && (
        <CompleteTestingForm batchId={batch.id} onDone={load} />
      )}

      {(batch.testing_status === 'passed' || batch.testing_status === 'failed') && (
        <div className={`stat-banner ${batch.testing_status === 'failed' ? 'stat-banner-danger' : ''}`}>
          <span className="stat-banner-value">{batch.testing_status === 'passed' ? '✓ Passed' : '✗ Failed'}</span>
          <span className="stat-banner-label">
            tested by {supervisor?.name}
            {batch.testing_completed_at && ` · ${new Date(batch.testing_completed_at).toLocaleString()}`}
          </span>
        </div>
      )}
      {(batch.testing_status === 'passed' || batch.testing_status === 'failed') && batch.test_remarks && (
        <p className="hint-text">"{batch.test_remarks}"</p>
      )}
    </div>
  )
}

function CompleteTestingForm({ batchId, onDone }: { batchId: string; onDone: () => void }) {
  const [remarks, setRemarks] = useState('')
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function complete(result: 'passed' | 'failed') {
    setSubmitting(true)
    setError(null)
    try {
      let audioPath: string | null = null
      if (audioBlob) {
        const path = `${batchId}/${Date.now()}.webm`
        const { error: uploadError } = await supabase.storage.from('testing-audio').upload(path, audioBlob)
        if (uploadError) throw uploadError
        audioPath = path
      }
      const { error: rpcError } = await supabase.rpc('complete_testing', {
        p_batch_id: batchId,
        p_result: result,
        p_remarks: remarks.trim() || null,
        p_remarks_audio_path: audioPath,
      })
      if (rpcError) throw rpcError
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="testing-form">
      <label className="field">
        <span className="field-label">Remarks (optional)</span>
        <textarea
          className="field-input"
          rows={3}
          placeholder="What did you observe?"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
      </label>

      <AudioRecorder onRecorded={setAudioBlob} />

      {error && <p className="error-text">{error}</p>}

      <div className="modal-actions">
        <button className="btn btn-ghost" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => complete('failed')} disabled={submitting}>
          ✗ Fail
        </button>
        <button className="btn btn-primary" onClick={() => complete('passed')} disabled={submitting}>
          {submitting ? 'Saving…' : '✓ Pass'}
        </button>
      </div>
    </div>
  )
}

function AudioRecorder({ onRecorded }: { onRecorded: (blob: Blob | null) => void }) {
  const [recording, setRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [recordError, setRecordError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  async function start() {
    setRecordError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioUrl(URL.createObjectURL(blob))
        onRecorded(blob)
        stream.getTracks().forEach((t) => t.stop())
      }
      recorder.start()
      recorderRef.current = recorder
      setRecording(true)
    } catch {
      setRecordError('Could not access the microphone. Check your browser permissions.')
    }
  }

  function stop() {
    recorderRef.current?.stop()
    setRecording(false)
  }

  function clear() {
    setAudioUrl(null)
    onRecorded(null)
  }

  return (
    <div className="field">
      <span className="field-label">Voice note (optional)</span>
      {recordError && <p className="error-text">{recordError}</p>}
      {!audioUrl && (
        <button
          type="button"
          className={`btn ${recording ? 'btn-primary' : 'btn-ghost'}`}
          onClick={recording ? stop : start}
        >
          {recording ? '⏹ Stop recording' : '🎙 Record voice note'}
        </button>
      )}
      {audioUrl && (
        <div className="audio-preview">
          <audio controls src={audioUrl} />
          <button type="button" className="link-btn" onClick={clear}>
            Re-record
          </button>
        </div>
      )}
    </div>
  )
}
