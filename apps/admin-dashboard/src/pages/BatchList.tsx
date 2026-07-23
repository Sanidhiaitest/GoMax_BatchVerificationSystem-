import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Avatar from '../Avatar'
import { BottomSheet, CenterPopup, CheckRow } from '../Sheet'
import { IconCalendar, IconUsers, IconProducts, IconChevronDown, IconMixing, IconTesting, IconAlert, IconCheck } from '../Icons'
import type { ReactNode } from 'react'
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
const STATUS_CHIPS: { key: string; label: string; icon: ReactNode }[] = [
  { key: 'all', label: 'All', icon: null },
  { key: 'mixing', label: 'Mixing', icon: <IconMixing size={13} /> },
  { key: 'awaiting', label: 'Awaiting test', icon: <IconTesting size={13} /> },
  { key: 'attention', label: 'Attention', icon: <IconAlert size={13} /> },
  { key: 'today', label: 'Done today', icon: <IconCheck size={13} /> },
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
  const [supervisorFilters, setSupervisorFilters] = useState<string[]>([])
  const [formulationFilters, setFormulationFilters] = useState<string[]>([])
  const [testerFilters, setTesterFilters] = useState<string[]>([])

  const [dateSheetOpen, setDateSheetOpen] = useState(false)
  const [personSheetOpen, setPersonSheetOpen] = useState(false)
  const [testerSheetOpen, setTesterSheetOpen] = useState(false)
  const [productSheetOpen, setProductSheetOpen] = useState(false)

  function toggleFormulation(id: string) {
    setFormulationFilters((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleSupervisor(id: string) {
    setSupervisorFilters((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleTester(id: string) {
    setTesterFilters((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

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
      if (supervisorFilters.length > 0) query = query.in('supervisor_id', supervisorFilters)
      if (formulationFilters.length > 0) query = query.in('formulation_id', formulationFilters)
      if (testerFilters.length > 0) query = query.in('tester_id', testerFilters)

      const { data, error } = await query
      if (cancelled) return
      if (error) setError(error.message)
      else setBatches((data as unknown as BatchListRow[]) ?? [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [dateFilter, supervisorFilters, formulationFilters, testerFilters])

  const visible = useMemo(() => batches.filter((b) => matchesStatus(b, statusChip)), [batches, statusChip])

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
            className={`chip chip-with-icon ${statusChip === c.key ? 'chip-active' : ''}`}
            onClick={() => setStatusChip(c.key)}
          >
            {c.icon}
            {c.label}
          </button>
        ))}
      </div>

      <details className="filter-details" open>
        <summary className="filter-summary">Filters</summary>
        <div className="filter-panel">
          <div className="filter-trigger-row">
            <button
              className={`filter-trigger ${dateFilter ? 'has-value' : ''}`}
              onClick={() => setDateSheetOpen(true)}
            >
              <IconCalendar size={15} />
              <span className="filter-trigger-label">
                {dateFilter ? new Date(dateFilter).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : 'Date'}
              </span>
              <IconChevronDown size={13} />
            </button>
            <button
              className={`filter-trigger ${supervisorFilters.length > 0 ? 'has-value' : ''}`}
              onClick={() => setPersonSheetOpen(true)}
            >
              <IconUsers size={15} />
              <span className="filter-trigger-label">
                {supervisorFilters.length > 0
                  ? mixers.filter((s) => supervisorFilters.includes(s.id)).map((s) => s.name).join(', ')
                  : 'Person'}
              </span>
              <IconChevronDown size={13} />
            </button>
            <button
              className={`filter-trigger ${testerFilters.length > 0 ? 'has-value' : ''}`}
              onClick={() => setTesterSheetOpen(true)}
            >
              <IconUsers size={15} />
              <span className="filter-trigger-label">
                {testerFilters.length > 0
                  ? testers.filter((t) => testerFilters.includes(t.id)).map((t) => t.name).join(', ')
                  : 'Tester'}
              </span>
              <IconChevronDown size={13} />
            </button>
            <button
              className={`filter-trigger ${formulationFilters.length > 0 ? 'has-value' : ''}`}
              onClick={() => setProductSheetOpen(true)}
            >
              <IconProducts size={15} />
              <span className="filter-trigger-label">
                {formulationFilters.length > 0
                  ? formulations.filter((f) => formulationFilters.includes(f.id)).map((f) => f.code).join(', ')
                  : 'Product'}
              </span>
              <IconChevronDown size={13} />
            </button>
          </div>

          {(dateFilter || supervisorFilters.length > 0 || formulationFilters.length > 0 || testerFilters.length > 0) && (
            <button
              className="link-btn"
              onClick={() => {
                setDateFilter('')
                setSupervisorFilters([])
                setFormulationFilters([])
                setTesterFilters([])
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </details>

      <CenterPopup open={dateSheetOpen} onClose={() => setDateSheetOpen(false)} title="Date">
        <input
          className="field-input"
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          autoFocus
        />
        {dateFilter && (
          <button className="link-btn" onClick={() => setDateFilter('')}>
            Clear date
          </button>
        )}
      </CenterPopup>

      <BottomSheet open={personSheetOpen} onClose={() => setPersonSheetOpen(false)} title="Person">
        {mixers.map((s) => (
          <CheckRow
            key={s.id}
            label={s.name}
            checked={supervisorFilters.includes(s.id)}
            onToggle={() => toggleSupervisor(s.id)}
            showAvatar
          />
        ))}
        {supervisorFilters.length > 0 && (
          <button className="link-btn" onClick={() => setSupervisorFilters([])}>
            Clear
          </button>
        )}
      </BottomSheet>

      <BottomSheet open={testerSheetOpen} onClose={() => setTesterSheetOpen(false)} title="Tester">
        {testers.map((t) => (
          <CheckRow
            key={t.id}
            label={t.name}
            checked={testerFilters.includes(t.id)}
            onToggle={() => toggleTester(t.id)}
            showAvatar
          />
        ))}
        {testerFilters.length > 0 && (
          <button className="link-btn" onClick={() => setTesterFilters([])}>
            Clear
          </button>
        )}
      </BottomSheet>

      <BottomSheet open={productSheetOpen} onClose={() => setProductSheetOpen(false)} title="Product">
        {formulations.map((f) => (
          <CheckRow
            key={f.id}
            label={f.code}
            checked={formulationFilters.includes(f.id)}
            onToggle={() => toggleFormulation(f.id)}
          />
        ))}
        {formulationFilters.length > 0 && (
          <button className="link-btn" onClick={() => setFormulationFilters([])}>
            Clear
          </button>
        )}
      </BottomSheet>

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

export function BatchRow({ batch }: { batch: BatchListRow }) {
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
        {mixMinutes !== null && (
          <div className="batch-row-col">
            <span className="batch-row-col-label">Time</span>
            <span className="status-chip status-chip-muted">{mixMinutes}m</span>
          </div>
        )}
      </div>
    </Link>
  )
}
