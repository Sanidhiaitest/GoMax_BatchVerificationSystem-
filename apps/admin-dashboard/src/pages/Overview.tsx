import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { IconMixing, IconTesting, IconAlert, IconCheck, IconSparkle } from '../Icons'
import type { BatchListRow, FlagSeverity } from '../types'

// A batch row with the extra timestamps the overview needs to describe
// "what's happening right now" on the floor.
interface OverviewBatch extends BatchListRow {
  started_at: string
  submitted_at: string | null
  supervisor_id: string
  tester_id: string | null
  batch_flags: { id: string; severity: FlagSeverity; message: string }[]
}

interface PersonOption {
  id: string
  name: string
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

const SEVERITY_RANK: Record<string, number> = { critical: 0, warning: 1, info: 2 }

function worstSeverityOf(flags: { severity: string }[]): 'critical' | 'warning' | 'info' {
  if (flags.length === 0) return 'info'
  return flags.reduce((worst, f) => (SEVERITY_RANK[f.severity] < SEVERITY_RANK[worst] ? f.severity : worst), 'info' as string) as
    | 'critical'
    | 'warning'
    | 'info'
}

export default function Overview() {
  const { adminName } = useAuth()
  const [batches, setBatches] = useState<OverviewBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [insight, setInsight] = useState<string | null>(null)
  const [insightLoading, setInsightLoading] = useState(true)
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all')
  const [people, setPeople] = useState<PersonOption[]>([])
  const [personFilter, setPersonFilter] = useState<string>('all')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('batches')
        .select(
          'id, batch_number, batch_date, mason_name, status, started_at, submitted_at, testing_status, supervisor_id, tester_id, formulations(code, name), supervisors!batches_supervisor_id_fkey(name), tester:supervisors!batches_tester_id_fkey(name), batch_flags(id, severity, message)',
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

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('supervisors_public').select('id, name').eq('active', true).order('name')
      if (!cancelled) setPeople((data as PersonOption[]) ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setInsightLoading(true)
      const { data, error } = await supabase.functions.invoke('dashboard-insight')
      if (cancelled) return
      if (!error && data?.summary) setInsight(data.summary)
      setInsightLoading(false)
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
  const attentionSeverity = useMemo(
    () =>
      attention.map((b) => (b.testing_status === 'failed' ? 'critical' : worstSeverityOf(b.batch_flags))),
    [attention],
  )
  const attentionCounts = useMemo(
    () => ({
      critical: attentionSeverity.filter((s) => s === 'critical').length,
      warning: attentionSeverity.filter((s) => s === 'warning').length,
      info: attentionSeverity.filter((s) => s === 'info').length,
    }),
    [attentionSeverity],
  )
  const visibleAttention = useMemo(
    () =>
      severityFilter === 'all'
        ? attention
        : attention.filter((_batch, i) => attentionSeverity[i] === severityFilter),
    [attention, attentionSeverity, severityFilter],
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

  // Health + activity infographics can be scoped to one person (supervisor
  // or tester) so Ravinder ji can switch between e.g. Bobby and Nanshul and
  // see just their numbers, instead of only ever seeing the plant-wide mix.
  const scopedBatches = useMemo(
    () =>
      personFilter === 'all'
        ? batches
        : batches.filter((b) => b.supervisor_id === personFilter || b.tester_id === personFilter),
    [batches, personFilter],
  )
  const scopedDoneToday = useMemo(
    () => scopedBatches.filter((b) => b.status === 'submitted' && (b.submitted_at ?? '').slice(0, 10) === today()),
    [scopedBatches],
  )
  const scopedMixing = useMemo(() => scopedBatches.filter((b) => b.status === 'in_progress'), [scopedBatches])

  // Real, computed-from-data health metrics — no fabricated trend data.
  const tested = useMemo(
    () => scopedBatches.filter((b) => b.testing_status === 'passed' || b.testing_status === 'failed'),
    [scopedBatches],
  )
  const passRate = tested.length > 0 ? Math.round((tested.filter((b) => b.testing_status === 'passed').length / tested.length) * 100) : null
  const cleanRate =
    scopedBatches.length > 0
      ? Math.round(
          (scopedBatches.filter((b) => b.batch_flags.length === 0 && b.testing_status !== 'failed').length /
            scopedBatches.length) *
            100,
        )
      : null
  const completionRate =
    scopedDoneToday.length + scopedMixing.length > 0
      ? Math.round((scopedDoneToday.length / (scopedDoneToday.length + scopedMixing.length)) * 100)
      : null

  // Real activity-by-time-of-day chart — batches actually started today,
  // bucketed into 4-hour windows from their real started_at timestamp.
  const HOUR_BUCKETS = [
    { label: '12–4am', from: 0, to: 4 },
    { label: '4–8am', from: 4, to: 8 },
    { label: '8–12pm', from: 8, to: 12 },
    { label: '12–4pm', from: 12, to: 16 },
    { label: '4–8pm', from: 16, to: 20 },
    { label: '8–12am', from: 20, to: 24 },
  ]
  const todaysBatches = useMemo(() => scopedBatches.filter((b) => b.batch_date === today()), [scopedBatches])
  const hourCounts = useMemo(
    () =>
      HOUR_BUCKETS.map((bucket) => ({
        ...bucket,
        count: todaysBatches.filter((b) => {
          const h = new Date(b.started_at).getHours()
          return h >= bucket.from && h < bucket.to
        }).length,
      })),
    [todaysBatches],
  )
  const maxHourCount = Math.max(1, ...hourCounts.map((h) => h.count))

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

          <div className="ai-insight-card">
            <span className="ai-insight-icon">
              <IconSparkle size={16} />
            </span>
            <div className="ai-insight-body">
              <span className="ai-insight-label">AI Insights</span>
              <p className="ai-insight-text">
                {insightLoading ? 'Reading the floor…' : insight ?? 'No insight available right now.'}
              </p>
            </div>
          </div>

          {people.length > 0 && (
            <div className="chip-row">
              <button
                className={`chip ${personFilter === 'all' ? 'chip-active' : ''}`}
                onClick={() => setPersonFilter('all')}
              >
                Everyone
              </button>
              {people.map((p) => (
                <button
                  key={p.id}
                  className={`chip ${personFilter === p.id ? 'chip-active' : ''}`}
                  onClick={() => setPersonFilter(p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}

          <div className="health-chart-row">
            <div className="health-panel">
              <span className="health-panel-title">
                Production health
                {personFilter !== 'all' && (
                  <span className="hint-text"> · {people.find((p) => p.id === personFilter)?.name}</span>
                )}
              </span>
              <HealthBar label="Test pass rate" value={passRate} tone="success" />
              <HealthBar label="Clean batches" value={cleanRate} tone="live" />
              <HealthBar label="Today's completion" value={completionRate} tone="accent" />
            </div>

            <div className="chart-panel">
              <span className="health-panel-title">Activity today</span>
              <div className="hour-chart">
                {hourCounts.map((h) => (
                  <div key={h.label} className="hour-bar-col">
                    <div className="hour-bar-track">
                      <div
                        className="hour-bar-fill"
                        style={{ height: `${Math.max(3, (h.count / maxHourCount) * 70)}px` }}
                      />
                    </div>
                    <span className="hour-bar-label">{h.label}</span>
                  </div>
                ))}
              </div>
            </div>
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
              <div className="chip-row">
                <button
                  className={`chip ${severityFilter === 'all' ? 'chip-active' : ''}`}
                  onClick={() => setSeverityFilter('all')}
                >
                  All
                </button>
                {attentionCounts.critical > 0 && (
                  <button
                    className={`chip chip-critical ${severityFilter === 'critical' ? 'chip-active' : ''}`}
                    onClick={() => setSeverityFilter('critical')}
                  >
                    Critical · {attentionCounts.critical}
                  </button>
                )}
                {attentionCounts.warning > 0 && (
                  <button
                    className={`chip chip-warning ${severityFilter === 'warning' ? 'chip-active' : ''}`}
                    onClick={() => setSeverityFilter('warning')}
                  >
                    Warning · {attentionCounts.warning}
                  </button>
                )}
                {attentionCounts.info > 0 && (
                  <button
                    className={`chip chip-info ${severityFilter === 'info' ? 'chip-active' : ''}`}
                    onClick={() => setSeverityFilter('info')}
                  >
                    Info · {attentionCounts.info}
                  </button>
                )}
              </div>
              <div className="activity-list">
                {visibleAttention.map((b) => (
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

function HealthBar({
  label,
  value,
  tone,
}: {
  label: string
  value: number | null
  tone: 'success' | 'live' | 'accent'
}) {
  return (
    <div className="health-bar-row">
      <div className="health-bar-head">
        <span className="health-bar-label">{label}</span>
        <span className="health-bar-value">{value === null ? '—' : `${value}%`}</span>
      </div>
      <div className="health-bar-track">
        <div className={`health-bar-fill health-bar-fill-${tone}`} style={{ width: `${value ?? 0}%` }} />
      </div>
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
  const worstMessage = kind === 'attention' && !flagCount ? null : batch.batch_flags[0]?.message ?? null

  let icon = <IconCheck size={14} />
  let tag: { label: string; cls: string } | null = null

  if (kind === 'mixing') {
    icon = <IconMixing size={14} />
    tag = { label: `${timeAgo(batch.started_at)} elapsed`, cls: 'activity-tag-live' }
  } else if (kind === 'testing') {
    icon = <IconTesting size={14} />
    tag = {
      label: batch.testing_status === 'in_progress' ? 'Testing' : 'Awaiting test',
      cls: 'activity-tag-info',
    }
  } else if (kind === 'attention') {
    if (batch.testing_status === 'failed') {
      icon = <IconAlert size={14} />
      tag = { label: 'Test failed', cls: 'activity-tag-fail' }
    } else {
      icon = <IconAlert size={14} />
      tag = { label: `${flagCount} flag${flagCount > 1 ? 's' : ''}`, cls: 'activity-tag-warn' }
    }
  } else {
    icon = <IconCheck size={14} />
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
        {worstMessage && <span className="activity-message">{worstMessage}</span>}
      </span>
      {tag && <span className={`activity-tag ${tag.cls}`}>{tag.label}</span>}
    </Link>
  )
}
