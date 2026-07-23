import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Avatar from '../Avatar'
import type { BatchListRow, Formulation, SupervisorPublic } from '../types'

const SEVERITY_RANK: Record<string, number> = { critical: 0, warning: 1, info: 2 }

const today = () => new Date().toISOString().slice(0, 10)
const yesterday = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10)

function dateGroupLabel(dateStr: string): string {
  if (dateStr === today()) return 'Today'
  if (dateStr === yesterday()) return 'Yesterday'
  return new Date(dateStr).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
}

// Quick status chips — the primary, click-first way to slice the list.
const STATUS_CHIPS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'mixing', label: '🔵 Mixing' },
  { key: 'awaiting', label: '🧪 Awaiting test' },
  { key: 'attention', label: '⚠️ Attention' },
  { key: 'today', label: '✓ Done today' },
]

function matchesStatus(b: BatchListRow & { submitted_at?: string | null }, status: string): boolean {
  switch (status) {
    case 'mixing':
      return b.status === 'in_progress'
    case 'awaiting':
      return b.testing_status === 'pending' || b.testing_status === 'in_progress'
    case 'attention':
      return b.batch_flags.length > 0 || b.testing_status === 'failed'
    case 'today':
      return b.status === 'submitted' && (b.submitted_at ?? '').slice(0, 10) === today()
    default:
      return true
  }
}

export default function BatchList() {
  const [batches, setBatches] = useState<BatchListRow[]>([])
  const [formulations, setFormulations] = useState<Formulation[]>([])
  const [supervisors, setSupervisors] = useState<SupervisorPublic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchParams, setSearchParams] = useSearchParams()
  const statusChip = searchParams.get('status') ?? 'all'

  const [dateFilter, setDateFilter] = useState('')
  const [supervisorFilter, setSupervisorFilter] = useState('')
  const [formulationFilter, setFormulationFilter] = useState('')
  const [testerFilter, setTesterFilter] = useState('')
  const [workerFilter, setWorkerFilter] = useState('')

  const mixers = useMemo(() => supervisors.filter((s) => s.role === 'supervisor'), [supervisors])
  const testers = useMemo(() => supervisors.filter((s) => s.role === 'tester'), [supervisors])

  function setStatusChip(key: string) {
    const next = new URLSearchParams(searchParams)
    if (key === 'all') next.delete('status')
    else next.set('status', key)
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    ;(async () => {
      const [{ data: f }, { data: s }] = await Promise.all([
        supabase.from('formulations').select('id, code, name, active, category, base_name, variant').order('code'),
        supabase.from('supervisors_public').select('*').order('name'),
      ])
      setFormulations(f ?? [])
      setSupervisors(s ?? [])
    })()
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      let query = supabase
        .from('batches')
        .select(
          'id, batch_number, batch_date, mason_name, status, started_at, submitted_at, testing_status, formulations(code, name), supervisors!batches_supervisor_id_fkey(name), tester:supervisors!batches_tester_id_fkey(name), batch_flags(id, severity)',
        )
        .order('started_at', { ascending: false })
        .limit(200)

      if (dateFilter) query = query.eq('batch_date', dateFilter)
      if (supervisorFilter) query = query.eq('supervisor_id', supervisorFilter)
      if (formulationFilter) query = query.eq('formulation_id', formulationFilter)
      if (testerFilter) query = query.eq('tester_id', testerFilter)

      const { data, error } = await query
      if (cancelled) return
      if (error) setError(error.message)
      else setBatches((data as unknown as BatchListRow[]) ?? [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [dateFilter, supervisorFilter, formulationFilter, testerFilter])

  // On-floor workers (batch.mason_name) are a free-text, comma-separated
  // field — distinct from the supervisor who logged the batch in — so they
  // need their own filter, built from whoever actually shows up in the data.
  const workerOptions = useMemo(() => {
    const names = new Set<string>()
    batches.forEach((b) =>
      b.mason_name
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean)
        .forEach((n) => names.add(n)),
    )
    return Array.from(names).sort()
  }, [batches])

  const visible = useMemo(
    () =>
      batches
        .filter((b) => matchesStatus(b, statusChip))
        .filter(
          (b) =>
            !workerFilter ||
            b.mason_name
              .split(',')
              .map((n) => n.trim().toLowerCase())
              .includes(workerFilter.toLowerCase()),
        ),
    [batches, statusChip, workerFilter],
  )

  // Batches already arrive newest-first, so grouping preserves that order —
  // each new date just opens a new bucket the first time it's seen.
  const groups = useMemo(() => {
    const buckets: { label: string; rows: BatchListRow[] }[] = []
    for (const b of visible) {
      const label = dateGroupLabel(b.batch_date)
      const bucket = buckets[buckets.length - 1]
      if (bucket && bucket.label === label) bucket.rows.push(b)
      else buckets.push({ label, rows: [b] })
    }
    return buckets
  }, [visible])

  return (
    <div className="page">
      <h1 className="page-title">Batches</h1>

      <div className="chip-row">
        {STATUS_CHIPS.map((c) => (
          <button
            key={c.key}
            className={`chip ${statusChip === c.key ? 'chip-active' : ''}`}
            onClick={() => setStatusChip(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {mixers.length > 0 && (
        <div className="quick-filter-group">
          <span className="quick-filter-label">By person</span>
          <div className="chip-row">
            <button className={`chip ${!supervisorFilter ? 'chip-active' : ''}`} onClick={() => setSupervisorFilter('')}>
              All
            </button>
            {mixers.map((s) => (
              <button
                key={s.id}
                className={`chip ${supervisorFilter === s.id ? 'chip-active' : ''}`}
                onClick={() => setSupervisorFilter(supervisorFilter === s.id ? '' : s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {formulations.length > 0 && (
        <div className="quick-filter-group">
          <span className="quick-filter-label">By product</span>
          <div className="chip-row">
            <button className={`chip ${!formulationFilter ? 'chip-active' : ''}`} onClick={() => setFormulationFilter('')}>
              All
            </button>
            {formulations.map((f) => (
              <button
                key={f.id}
                className={`chip ${formulationFilter === f.id ? 'chip-active' : ''}`}
                onClick={() => setFormulationFilter(formulationFilter === f.id ? '' : f.id)}
              >
                {f.code}
              </button>
            ))}
          </div>
        </div>
      )}

      <details className="filter-details">
        <summary className="filter-summary">More filters</summary>
        <div className="filter-bar">
          <label className="field">
            <span className="field-label">Date</span>
            <input
              className="field-input"
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Worker</span>
            <select className="field-input" value={workerFilter} onChange={(e) => setWorkerFilter(e.target.value)}>
              <option value="">All</option>
              {workerOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {testers.length > 0 && (
            <label className="field">
              <span className="field-label">Tester</span>
              <select className="field-input" value={testerFilter} onChange={(e) => setTesterFilter(e.target.value)}>
                <option value="">All</option>
                {testers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(dateFilter || supervisorFilter || formulationFilter || testerFilter || workerFilter) && (
            <button
              className="link-btn"
              onClick={() => {
                setDateFilter('')
                setSupervisorFilter('')
                setFormulationFilter('')
                setTesterFilter('')
                setWorkerFilter('')
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </details>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="hint-text">Loading…</p>}

      {!loading && (
        <section>
          <h2 className="section-title">
            {statusChip === 'all' ? 'All batches' : STATUS_CHIPS.find((c) => c.key === statusChip)?.label}
            <span className="hint-text">{visible.length}</span>
          </h2>
          {visible.length === 0 ? (
            <p className="hint-text">No batches here right now.</p>
          ) : (
            groups.map((g) => (
              <div key={g.label} className="date-group">
                <p className="date-group-label">{g.label}</p>
                <div className="list">
                  {g.rows.map((b) => (
                    <BatchRow key={b.id} batch={b} />
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      )}
    </div>
  )
}

function BatchRow({ batch }: { batch: BatchListRow }) {
  const worstSeverity = batch.batch_flags.length
    ? batch.batch_flags.reduce(
        (worst, f) => (SEVERITY_RANK[f.severity] < SEVERITY_RANK[worst] ? f.severity : worst),
        'info' as string,
      )
    : null

  const prep: { label: string; tone: string } =
    batch.status === 'in_progress' ? { label: 'Mixing', tone: 'live' } : { label: 'Done', tone: 'success' }

  const test: { label: string; tone: string } = (() => {
    switch (batch.testing_status) {
      case 'not_sent':
        return { label: 'Not sent', tone: 'muted' }
      case 'pending':
        return { label: 'Waiting', tone: 'warning' }
      case 'in_progress':
        return { label: 'In progress', tone: 'warning' }
      case 'passed':
        return { label: 'Passed', tone: 'success' }
      case 'failed':
        return { label: 'Failed', tone: 'critical' }
    }
  })()

  const mixMinutes =
    batch.submitted_at && batch.started_at
      ? Math.round((new Date(batch.submitted_at).getTime() - new Date(batch.started_at).getTime()) / 60000)
      : null

  return (
    <Link
      to={`/batch/${batch.id}`}
      className={`list-item batch-row batch-row-v2 ${worstSeverity ? `batch-row-flagged batch-row-flagged-${worstSeverity}` : ''}`}
    >
      <div className="batch-row-left">
        <Avatar name={batch.formulations?.code ?? '?'} />
        <div className="batch-row-main">
          <span className="list-item-code">
            {batch.formulations?.code} · #{batch.batch_number}
          </span>
          <span className="list-item-sub">
            by {batch.supervisors?.name}
            {mixMinutes !== null && ` · ${mixMinutes}m to mix`}
            {batch.tester && ` · tested by ${batch.tester.name}`}
          </span>
        </div>
      </div>

      <div className="batch-row-columns">
        <div className="batch-row-col">
          <span className="batch-row-col-label">Prep</span>
          <span className={`status-chip status-chip-${prep.tone}`}>{prep.label}</span>
        </div>
        <div className="batch-row-col">
          <span className="batch-row-col-label">Test</span>
          <span className={`status-chip status-chip-${test.tone}`}>{test.label}</span>
        </div>
      </div>
    </Link>
  )
}
