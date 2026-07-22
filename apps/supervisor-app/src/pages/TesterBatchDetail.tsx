import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useSupervisor } from '../SupervisorContext'
import type { Batch, BatchMaterial } from '../types'

interface BatchWithRelations extends Batch {
  formulations: { code: string; name: string | null; base_name: string | null } | null
  supervisors: { name: string } | null
}

const clock = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'

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
        .select('*, formulations(code, name, base_name), supervisors!batches_supervisor_id_fkey(name)')
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

  const product = batch.formulations?.base_name ?? batch.formulations?.name ?? batch.formulations?.code
  const done = batch.testing_status === 'passed' || batch.testing_status === 'failed'

  return (
    <div className="tester-screen">
      <div className="tester-hero">
        <button className="link-btn back-btn" onClick={() => navigate('/testing')}>
          ← Back to queue
        </button>
        <div className="tester-hero-body">
          <span className="tester-hero-number">#{batch.batch_number}</span>
          <span className="tester-hero-name">{product}</span>
          <span className="tester-hero-sub">
            {batch.formulations?.code} · {batch.supervisors?.name} · {batch.batch_date}
          </span>
        </div>
      </div>

      <div className="tester-sheet">
        <div className="setup-sheet-handle" />

        <section className="setup-section">
          <h2 className="setup-section-title">Materials in this batch</h2>
          <div className="tester-material-list">
            {materials.map((m) => (
              <div key={m.id} className="tester-material-row">
                <span className="tester-material-name">{m.description}</span>
                <span className={`tester-material-qty ${m.status !== 'added' ? 'skipped' : ''}`}>
                  {m.status === 'added' ? `${m.quantity ?? '—'}` : m.status === 'skipped' ? 'Skipped' : '—'}
                </span>
              </div>
            ))}
          </div>
        </section>

        {error && <p className="error-text">{error}</p>}

        {batch.testing_status === 'pending' && (
          <button className="btn btn-primary" onClick={handleStart} disabled={busy}>
            {busy ? 'Starting…' : '🧪 Start Testing'}
          </button>
        )}

        {batch.testing_status === 'in_progress' && batch.testing_started_at && (
          <>
            <p className="hint-text">Started testing at {clock(batch.testing_started_at)}</p>
            <CompleteTestingForm batchId={batch.id} onDone={load} />
          </>
        )}

        {done && (
          <TestResult batch={batch} testerName={supervisor?.name ?? ''} />
        )}
      </div>
    </div>
  )
}

function TestResult({ batch, testerName }: { batch: BatchWithRelations; testerName: string }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!batch.test_photo_path) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.storage.from('testing-photos').createSignedUrl(batch.test_photo_path!, 600)
      if (!cancelled && data) setPhotoUrl(data.signedUrl)
    })()
    return () => {
      cancelled = true
    }
  }, [batch.test_photo_path])

  const passed = batch.testing_status === 'passed'

  return (
    <section className="setup-section">
      <div className={`result-banner ${passed ? 'result-pass' : 'result-fail'}`}>
        <span className="result-banner-icon">{passed ? '✓' : '✗'}</span>
        <div>
          <span className="result-banner-title">{passed ? 'Test Passed' : 'Test Failed'}</span>
          <span className="result-banner-sub">
            by {testerName}
            {batch.testing_completed_at && ` · ${new Date(batch.testing_completed_at).toLocaleString()}`}
          </span>
        </div>
      </div>

      {photoUrl && (
        <a href={photoUrl} target="_blank" rel="noreferrer" className="result-photo">
          <img src={photoUrl} alt="Test evidence" />
        </a>
      )}

      {batch.test_remarks && <p className="result-remarks">"{batch.test_remarks}"</p>}

      <div className="tester-timestamps">
        <span>Started {clock(batch.testing_started_at)}</span>
        <span>Finished {clock(batch.testing_completed_at)}</span>
      </div>
    </section>
  )
}

function CompleteTestingForm({ batchId, onDone }: { batchId: string; onDone: () => void }) {
  const [remarks, setRemarks] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [result, setResult] = useState<'passed' | 'failed' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  function pickPhoto(file: File | null) {
    setPhotoFile(file)
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return file ? URL.createObjectURL(file) : null
    })
  }

  async function submit() {
    if (!result) return
    setSubmitting(true)
    setError(null)
    try {
      let photoPath: string | null = null
      if (photoFile) {
        const ext = photoFile.name.split('.').pop() || 'jpg'
        const path = `${batchId}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('testing-photos').upload(path, photoFile)
        if (upErr) throw upErr
        photoPath = path
      }

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
        p_photo_path: photoPath,
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
      <section className="setup-section">
        <h2 className="setup-section-title">Test photo</h2>
        <p className="hint-text">Photo of the sample or result</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
        />
        {photoPreview ? (
          <div className="photo-preview">
            <img src={photoPreview} alt="Selected" />
            <div className="photo-preview-actions">
              <button type="button" className="material-skip-btn" onClick={() => fileRef.current?.click()}>
                Retake
              </button>
              <button type="button" className="link-btn" onClick={() => pickPhoto(null)}>
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="photo-dropzone" onClick={() => fileRef.current?.click()}>
            <span className="photo-dropzone-icon">📷</span>
            <span className="photo-dropzone-title">Take / Upload Photo</span>
            <span className="photo-dropzone-sub">Tap to open camera</span>
          </button>
        )}
      </section>

      <section className="setup-section">
        <h2 className="setup-section-title">Remarks</h2>
        <textarea
          className="field-input"
          rows={3}
          placeholder="What did you observe? (optional)"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
        <AudioRecorder onRecorded={setAudioBlob} />
      </section>

      <section className="setup-section">
        <h2 className="setup-section-title">Result</h2>
        <div className="result-tabs">
          <button
            type="button"
            className={`result-tab result-tab-pass ${result === 'passed' ? 'active' : ''}`}
            onClick={() => setResult('passed')}
            disabled={submitting}
          >
            ✓ Pass
          </button>
          <button
            type="button"
            className={`result-tab result-tab-fail ${result === 'failed' ? 'active' : ''}`}
            onClick={() => setResult('failed')}
            disabled={submitting}
          >
            ✗ Fail
          </button>
        </div>
      </section>

      {error && <p className="error-text">{error}</p>}

      <button className="btn btn-primary" onClick={submit} disabled={!result || submitting}>
        {submitting ? 'Submitting…' : 'Submit to Admin'}
      </button>
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
    <div className="remarks-audio-row">
      {recordError && <p className="error-text">{recordError}</p>}
      {!audioUrl && (
        <button
          type="button"
          className={`remarks-audio-btn ${recording ? 'recording' : ''}`}
          onClick={recording ? stop : start}
        >
          {recording ? '⏹' : '🎙'}
          <span>{recording ? 'Stop recording' : 'Add voice note'}</span>
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
