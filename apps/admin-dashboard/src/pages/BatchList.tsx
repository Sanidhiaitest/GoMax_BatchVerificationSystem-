import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Avatar from '../Avatar'
import type { BatchListRow, Formulation, SupervisorPublic } from '../types'

const SEVERITY_RANK: Record<string, number> = { critical: 0, warning: 1, info: 2 }

const TESTING_LABEL: Record<string, string> = {
  pending: '🧪 Awaiting test',
  in_progress: '🧪 Testing',
  passed: '✓ Passed',
  failed: '✗ Failed',
}

const today = () => new Date().toISOString().slice(0, 10)

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
          'id, batch_number, batch_date, mason_name, status, started_at, submitted_at, testing_status, formulations(code, name), supervisors!batches_supervisor_id_fkey(name), batch_flags(id, severity)',
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
          <span className="field-label">Logged in by</span>
          <select
            className="field-input"
            value={supervisorFilter}
            onChange={(e) => setSupervisorFilter(e.target.value)}
          >
            <option value="">All</option>
            {mixers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
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
        <label className="field">
          <span className="field-label">Formulation</span>
          <select
            className="field-input"
            value={formulationFilter}
            onChange={(e) => setFormulationFilter(e.target.value)}
          >
            <option value="">All</option>
            {formulations.map((f) => (
              <option key={f.id} value={f.id}>
                {f.code}
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
            <div className="list">
              {visible.map((b) => (
                <BatchRow key={b.id} batch={b} />
              ))}
            </div>
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

  return (
    <Link to={`/batch/${batch.id}`} className="list-item batch-row">
      <div className="batch-row-left">
        <Avatar name={batch.formulations?.code ?? '?'} />
        <div className="batch-row-main">
          <span className="list-item-code">
            {batch.formulations?.code} · #{batch.batch_number}
          </span>
          <span className="list-item-sub">
            {batch.supervisors?.name} · {batch.mason_name} · {batch.batch_date}
            {batch.status === 'in_progress' && ' · in progress'}
          </span>
        </div>
      </div>
      <div className="batch-row-badges">
        {batch.testing_status !== 'not_sent' && (
          <span className={`severity-badge severity-${batch.testing_status === 'failed' ? 'critical' : batch.testing_status === 'passed' ? 'success' : 'warning'}`}>
            {TESTING_LABEL[batch.testing_status]}
          </span>
        )}
        {worstSeverity && (
          <span className={`severity-badge severity-${worstSeverity}`}>
            {batch.batch_flags.length} flag{batch.batch_flags.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </Link>
  )
}
