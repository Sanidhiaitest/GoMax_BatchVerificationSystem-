import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import type { BatchListRow, Formulation, SupervisorPublic } from '../types'

const SEVERITY_RANK: Record<string, number> = { critical: 0, warning: 1, info: 2 }

export default function BatchList() {
  const [batches, setBatches] = useState<BatchListRow[]>([])
  const [formulations, setFormulations] = useState<Formulation[]>([])
  const [supervisors, setSupervisors] = useState<SupervisorPublic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dateFilter, setDateFilter] = useState('')
  const [supervisorFilter, setSupervisorFilter] = useState('')
  const [formulationFilter, setFormulationFilter] = useState('')

  useEffect(() => {
    ;(async () => {
      const [{ data: f }, { data: s }] = await Promise.all([
        supabase.from('formulations').select('id, code, name, active').order('code'),
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
          'id, batch_number, batch_date, mason_name, status, started_at, submitted_at, formulations(code, name), supervisors(name), batch_flags(id, severity)',
        )
        .order('started_at', { ascending: false })
        .limit(200)

      if (dateFilter) query = query.eq('batch_date', dateFilter)
      if (supervisorFilter) query = query.eq('supervisor_id', supervisorFilter)
      if (formulationFilter) query = query.eq('formulation_id', formulationFilter)

      const { data, error } = await query
      if (cancelled) return
      if (error) setError(error.message)
      else setBatches((data as unknown as BatchListRow[]) ?? [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [dateFilter, supervisorFilter, formulationFilter])

  const flagged = useMemo(
    () =>
      batches
        .filter((b) => b.batch_flags.length > 0)
        .sort((a, b) => {
          const rankA = Math.min(...a.batch_flags.map((f) => SEVERITY_RANK[f.severity] ?? 3))
          const rankB = Math.min(...b.batch_flags.map((f) => SEVERITY_RANK[f.severity] ?? 3))
          return rankA - rankB
        }),
    [batches],
  )

  const inProgressCount = useMemo(() => batches.filter((b) => b.status === 'in_progress').length, [batches])
  const criticalCount = useMemo(
    () => batches.filter((b) => b.batch_flags.some((f) => f.severity === 'critical')).length,
    [batches],
  )

  return (
    <div className="page">
      <h1 className="page-title">Batches</h1>

      {!loading && batches.length > 0 && (
        <div className="stat-row">
          <div className="stat-card">
            <span className="stat-card-value">{batches.length}</span>
            <span className="stat-card-label">Total batches</span>
          </div>
          <div className="stat-card stat-card-accent">
            <span className="stat-card-value">{inProgressCount}</span>
            <span className="stat-card-label">In progress</span>
          </div>
          <div className="stat-card stat-card-warning">
            <span className="stat-card-value">{flagged.length}</span>
            <span className="stat-card-label">Flagged</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-value" style={criticalCount > 0 ? { color: 'var(--danger)' } : undefined}>
              {criticalCount}
            </span>
            <span className="stat-card-label">Critical</span>
          </div>
        </div>
      )}

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
          <span className="field-label">Supervisor</span>
          <select
            className="field-input"
            value={supervisorFilter}
            onChange={(e) => setSupervisorFilter(e.target.value)}
          >
            <option value="">All</option>
            {supervisors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
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
        {(dateFilter || supervisorFilter || formulationFilter) && (
          <button
            className="link-btn"
            onClick={() => {
              setDateFilter('')
              setSupervisorFilter('')
              setFormulationFilter('')
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="hint-text">Loading…</p>}

      {!loading && flagged.length > 0 && (
        <section>
          <h2 className="section-title">Needs attention</h2>
          <div className="list">
            {flagged.map((b) => (
              <BatchRow key={b.id} batch={b} />
            ))}
          </div>
        </section>
      )}

      {!loading && (
        <section>
          <h2 className="section-title">All batches</h2>
          {batches.length === 0 ? (
            <p className="hint-text">No batches match these filters.</p>
          ) : (
            <div className="list">
              {batches.map((b) => (
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
      <div className="batch-row-main">
        <span className="list-item-code">
          {batch.formulations?.code} · #{batch.batch_number}
        </span>
        <span className="list-item-sub">
          {batch.supervisors?.name} · {batch.batch_date}
          {batch.status === 'in_progress' && ' · in progress'}
        </span>
      </div>
      {worstSeverity && (
        <span className={`severity-badge severity-${worstSeverity}`}>
          {batch.batch_flags.length} flag{batch.batch_flags.length > 1 ? 's' : ''}
        </span>
      )}
    </Link>
  )
}
