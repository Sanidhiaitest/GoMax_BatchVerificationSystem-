import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { IconMixing, IconTesting, IconAlert, IconCheck } from '../Icons'
import type { BatchListRow } from '../types'

// A batch row with the extra timestamps the overview needs to describe
// "what's happening right now" on the floor.
interface OverviewBatch extends BatchListRow {
  started_at: string
  submitted_at: string | null
}

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  return `${days}d`
}

const today = () => new Date().toISOString().slice(0, 10)

export default function Overview() {
  const { adminName } = useAuth()
  const [batches, setBatches] = useState<OverviewBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('batches')
        .select(
          'id, batch_number, batch_date, mason_name, status, started_at, submitted_at, testing_status, formulations(code, name), supervisors!batches_supervisor_id_fkey(name), tester:supervisors!batches_tester_id_fkey(name), batch_flags(id, severity)',
        )
        .order('started_at', { ascending: false })
        .limit(200)
      if (cancelled) return
      if (error) setError(error.message)
      else setBatches((data as unknown as OverviewBatch[]) ?? [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const mixing = useMemo(() => batches.filter((b) => b.status === 'in_progress'), [batches])
  const awaiting = useMemo(
    () => batches.filter((b) => b.testing_status === 'pending' || b.testing_status === 'in_progress'),
    [batches],
  )
  const attention = useMemo(
    () => batches.filter((b) => b.batch_flags.length > 0 || b.testing_status === 'failed'),
    [batches],
  )
  const doneToday = useMemo(
    () => batches.filter((b) => b.status === 'submitted' && (b.submitted_at ?? '').slice(0, 10) === today()),
    [batches],
  )
  const recentDone = useMemo(
    () =>
      batches
        .filter((b) => b.status === 'submitted')
        .sort((a, b) => (b.submitted_at ?? '').localeCompare(a.submitted_at ?? ''))
        .slice(0, 5),
    [batches],
  )

  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="page">
      <div>
        <h1 className="page-title">
          {greeting}
          {adminName ? ` ${adminName}` : ''} 👋
        </h1>
        <div className="page-meta-row">
          <p className="hint-text">
            {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} · factory snapshot
          </p>
          <span className="live-badge">Live</span>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="hint-text">Loading the floor…</p>}

      {!loading && (
        <>
          <div className="pulse-band">
            <Link to="/batches?status=mixing" className="pulse-tile">
              <span className="pulse-icon pulse-icon-live">
                <IconMixing size={15} />
              </span>
              <span className="pulse-value">{mixing.length}</span>
              <span className="pulse-label">Mixing now</span>
            </Link>
            <Link to="/batches?status=awaiting" className="pulse-tile">
              <span className="pulse-icon">
                <IconTesting size={15} />
              </span>
              <span className="pulse-value">{awaiting.length}</span>
              <span className="pulse-label">Awaiting test</span>
            </Link>
            <Link to="/batches?status=attention" className="pulse-tile pulse-tile-alert">
              <span className="pulse-icon pulse-icon-alert">
                <IconAlert size={15} />
              </span>
              <span className="pulse-value">{attention.length}</span>
              <span className="pulse-label">Needs attention</span>
            </Link>
            <Link to="/batches?status=today" className="pulse-tile">
              <span className="pulse-icon pulse-icon-done">
                <IconCheck size={15} />
              </span>
              <span className="pulse-value">{doneToday.length}</span>
              <span className="pulse-label">Done today</span>
            </Link>
          </div>

          {mixing.length > 0 && (
            <section>
              <h2 className="section-title">Happening now</h2>
              <div className="activity-list">
                {mixing.map((b) => (
                  <ActivityRow key={b.id} batch={b} kind="mixing" />
                ))}
              </div>
            </section>
          )}

          {awaiting.length > 0 && (
            <section>
              <h2 className="section-title">In the lab</h2>
              <div className="activity-list">
                {awaiting.map((b) => (
                  <ActivityRow key={b.id} batch={b} kind="testing" />
                ))}
              </div>
            </section>
          )}

          {attention.length > 0 && (
            <section>
              <h2 className="section-title">Needs attention · {attention.length}</h2>
              <div className="activity-list">
                {attention.map((b) => (
                  <ActivityRow key={b.id} batch={b} kind="attention" />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="section-title">Recently completed</h2>
            {recentDone.length === 0 ? (
              <p className="hint-text">Nothing submitted yet.</p>
            ) : (
              <div className="activity-list">
                {recentDone.map((b) => (
                  <ActivityRow key={b.id} batch={b} kind="done" />
                ))}
              </div>
            )}
            <Link to="/batches" className="overview-see-all">
              See all batches →
            </Link>
          </section>
        </>
      )}
    </div>
  )
}

function ActivityRow({
  batch,
  kind,
}: {
  batch: OverviewBatch
  kind: 'mixing' | 'testing' | 'attention' | 'done'
}) {
  const product = batch.formulations?.code ?? '?'
  const flagCount = batch.batch_flags.length

  let icon = '●'
  let tag: { label: string; cls: string } | null = null

  if (kind === 'mixing') {
    icon = '🔵'
    tag = { label: `${timeAgo(batch.started_at)} elapsed`, cls: 'activity-tag-live' }
  } else if (kind === 'testing') {
    icon = '🧪'
    tag = {
      label: batch.testing_status === 'in_progress' ? 'Testing' : 'Awaiting test',
      cls: 'activity-tag-info',
    }
  } else if (kind === 'attention') {
    if (batch.testing_status === 'failed') {
      icon = '✗'
      tag = { label: 'Test failed', cls: 'activity-tag-fail' }
    } else {
      icon = '⚠️'
      tag = { label: `${flagCount} flag${flagCount > 1 ? 's' : ''}`, cls: 'activity-tag-warn' }
    }
  } else {
    icon = batch.testing_status === 'passed' ? '✓' : '✓'
    tag = { label: timeAgo(batch.submitted_at) + ' ago', cls: 'activity-tag-muted' }
  }

  const iconTone = tag?.cls.replace('activity-tag-', 'activity-icon-') ?? ''

  return (
    <Link to={`/batch/${batch.id}`} className="activity-row">
      <span className={`activity-icon ${iconTone}`}>{icon}</span>
      <span className="activity-main">
        <span className="activity-title">
          {product} · #{batch.batch_number}
        </span>
        <span className="activity-sub">
          by {batch.supervisors?.name}
          {batch.tester && ` · tested by ${batch.tester.name}`}
        </span>
      </span>
      {tag && <span className={`activity-tag ${tag.cls}`}>{tag.label}</span>}
    </Link>
  )
}
