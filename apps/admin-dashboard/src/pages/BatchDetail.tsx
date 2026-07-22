import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Avatar from '../Avatar'
import type { BatchFlag, BatchMaterial, TestingStatus } from '../types'

interface BatchDetailData {
  id: string
  batch_number: string
  batch_date: string
  mason_name: string
  status: 'in_progress' | 'submitted'
  started_at: string
  submitted_at: string | null
  testing_status: TestingStatus
  sent_for_testing_at: string | null
  testing_started_at: string | null
  testing_completed_at: string | null
  test_remarks: string | null
  test_remarks_audio_path: string | null
  test_photo_path: string | null
  formulations: { code: string; name: string | null } | null
  supervisors: { name: string } | null
  tester: { name: string } | null
}

const SEVERITY_RANK: Record<string, number> = { critical: 0, warning: 1, info: 2 }

const clock = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'

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
          .select(
            '*, formulations(code, name), supervisors!batches_supervisor_id_fkey(name), tester:supervisors!batches_tester_id_fkey(name)',
          )
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
      else setBatch(b as unknown as BatchDetailData)
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
  const criticalFlags = flags.filter((f) => f.severity === 'critical').length
  const warningFlags = flags.filter((f) => f.severity === 'warning').length

  // The single most important line: what does the admin need to know?
  const verdict = (() => {
    if (batch.testing_status === 'failed')
      return { tone: 'critical', icon: '✗', text: 'Test failed', sub: 'Rejected by the lab' }
    if (criticalFlags > 0)
      return { tone: 'critical', icon: '⚠', text: `${criticalFlags} critical flag${criticalFlags > 1 ? 's' : ''}`, sub: 'Needs review' }
    if (batch.testing_status === 'passed')
      return { tone: 'success', icon: '✓', text: 'Passed QC', sub: 'Cleared by the lab' }
    if (warningFlags > 0)
      return { tone: 'warning', icon: '⚠', text: `${warningFlags} warning${warningFlags > 1 ? 's' : ''}`, sub: 'Worth a look' }
    if (batch.status === 'in_progress')
      return { tone: 'info', icon: '●', text: 'Mixing in progress', sub: 'Not yet submitted' }
    if (batch.testing_status === 'pending' || batch.testing_status === 'in_progress')
      return { tone: 'info', icon: '🧪', text: 'In the lab', sub: 'Awaiting test result' }
    return { tone: 'neutral', icon: '✓', text: 'Submitted', sub: 'Not sent for testing' }
  })()

  return (
    <div className="page">
      <Link to="/batches" className="link-btn back-btn">
        ← Back to batches
      </Link>

      {/* Identity */}
      <div className="detail-hero">
        <div className="detail-hero-row">
          <div>
            <span className="detail-hero-number">#{batch.batch_number}</span>
            <span className="detail-hero-name">{batch.formulations?.code}{batch.formulations?.name ? ` · ${batch.formulations.name}` : ''}</span>
          </div>
          <span className={`detail-hero-status detail-hero-status-${batch.status === 'submitted' ? 'done' : 'live'}`}>
            {batch.status === 'submitted' ? 'Submitted' : 'Mixing'}
          </span>
        </div>
        <span className="detail-hero-sub">
          {batch.supervisors?.name} · {batch.mason_name} · {batch.batch_date}
        </span>
      </div>

      {/* Verdict — the one thing to know */}
      <div className={`verdict verdict-${verdict.tone}`}>
        <span className="verdict-icon">{verdict.icon}</span>
        <div>
          <span className="verdict-text">{verdict.text}</span>
          <span className="verdict-sub">{verdict.sub}</span>
        </div>
      </div>

      {/* Lab result (with photo) — high in the hierarchy when present */}
      {batch.testing_status !== 'not_sent' && <LabTestingSection batch={batch} />}

      {/* Flags */}
      {flags.length > 0 && (
        <section>
          <h2 className="section-title">Flags · {flags.length}</h2>
          <div className="detail-stack">
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

      {/* Materials */}
      <section>
        <h2 className="section-title">
          Materials
          <span className="hint-text">
            {addedCount} added · {skippedCount} skipped{pendingCount > 0 ? ` · ${pendingCount} not marked` : ''}
          </span>
        </h2>
        <div className="table-scroll">
          <table className="materials-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Qty</th>
                <th>Status</th>
                <th>Photo</th>
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
                  <td>
                    {m.photo_path ? (
                      <MaterialPhotoLink path={m.photo_path} />
                    ) : m.requires_photo ? (
                      <span className="hint-text">—</span>
                    ) : (
                      <span className="hint-text">n/a</span>
                    )}
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

      {/* Timeline — secondary, compact */}
      <section>
        <h2 className="section-title">Timeline</h2>
        <div className="timeline">
          <TimelineItem label="Started" value={clock(batch.started_at)} />
          <TimelineItem label="Submitted" value={clock(batch.submitted_at)} />
          <TimelineItem label="Mix time" value={duration !== null ? `${duration}m` : '—'} accent />
          {batch.sent_for_testing_at && <TimelineItem label="Sent to lab" value={clock(batch.sent_for_testing_at)} />}
          {batch.testing_completed_at && (
            <TimelineItem label="Tested" value={clock(batch.testing_completed_at)} />
          )}
        </div>
      </section>
    </div>
  )
}

function TimelineItem({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="timeline-item">
      <span className="timeline-label">{label}</span>
      <span className={`timeline-value ${accent ? 'timeline-value-accent' : ''}`}>{value}</span>
    </div>
  )
}

function MaterialPhotoLink({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.storage.from('material-photos').createSignedUrl(path, 600)
      if (!cancelled && data) setUrl(data.signedUrl)
    })()
    return () => {
      cancelled = true
    }
  }, [path])

  if (!url) return <span className="hint-text">…</span>
  return (
    <a href={url} target="_blank" rel="noreferrer" className="material-photo-link">
      <img src={url} alt="Material evidence" />
    </a>
  )
}

function LabTestingSection({ batch }: { batch: BatchDetailData }) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!batch.test_remarks_audio_path) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.storage
        .from('testing-audio')
        .createSignedUrl(batch.test_remarks_audio_path!, 3600)
      if (!cancelled && data) setAudioUrl(data.signedUrl)
    })()
    return () => {
      cancelled = true
    }
  }, [batch.test_remarks_audio_path])

  useEffect(() => {
    if (!batch.test_photo_path) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.storage
        .from('testing-photos')
        .createSignedUrl(batch.test_photo_path!, 3600)
      if (!cancelled && data) setPhotoUrl(data.signedUrl)
    })()
    return () => {
      cancelled = true
    }
  }, [batch.test_photo_path])

  const resultLabel: Record<TestingStatus, string> = {
    not_sent: '',
    pending: '🧪 Awaiting testing',
    in_progress: '🧪 Testing in progress',
    passed: '✓ Passed',
    failed: '✗ Failed',
  }

  return (
    <section>
      <h2 className="section-title">Lab testing</h2>
      <div className="detail-card">
        <div className="detail-card-head">
          <span
            className={`status-pill status-${
              batch.testing_status === 'passed' ? 'added' : batch.testing_status === 'failed' ? 'skipped' : 'pending'
            }`}
          >
            {resultLabel[batch.testing_status]}
          </span>
          {batch.tester && <span className="hint-text">Tested by {batch.tester.name}</span>}
        </div>

        {photoUrl && (
          <a href={photoUrl} target="_blank" rel="noreferrer" className="test-photo-link">
            <img src={photoUrl} alt="Test evidence" className="test-photo" />
          </a>
        )}

        {batch.test_remarks && <p className="detail-quote">"{batch.test_remarks}"</p>}

        {audioUrl && (
          <div>
            <p className="field-label">Voice note</p>
            <audio controls src={audioUrl} style={{ width: '100%' }} />
          </div>
        )}

        {(batch.testing_started_at || batch.testing_completed_at) && (
          <div className="timeline timeline-compact">
            <TimelineItem label="Sent" value={clock(batch.sent_for_testing_at)} />
            <TimelineItem label="Started" value={clock(batch.testing_started_at)} />
            <TimelineItem label="Completed" value={clock(batch.testing_completed_at)} />
          </div>
        )}
      </div>
    </section>
  )
}
