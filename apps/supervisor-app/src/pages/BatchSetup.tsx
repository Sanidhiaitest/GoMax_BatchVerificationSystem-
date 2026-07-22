import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { GoMaxBadge } from '../GoMaxLogo'
import type { Formulation } from '../types'

export default function BatchSetup() {
  const { formulationId } = useParams<{ formulationId: string }>()
  const [formulation, setFormulation] = useState<Formulation | null>(null)
  const [suggestedNames, setSuggestedNames] = useState<string[]>([])
  const [batchNumber, setBatchNumber] = useState('')
  const [selectedNames, setSelectedNames] = useState<string[]>([])
  const [customName, setCustomName] = useState('')
  const navigate = useNavigate()

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
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('batches')
        .select('mason_name')
        .order('started_at', { ascending: false })
        .limit(50)
      if (cancelled || !data) return
      const names = new Set<string>()
      data.forEach((row: { mason_name: string }) =>
        row.mason_name
          .split(',')
          .map((n) => n.trim())
          .filter(Boolean)
          .forEach((n) => names.add(n)),
      )
      setSuggestedNames(Array.from(names).slice(0, 10))
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const masonName = useMemo(() => {
    const names = [...selectedNames]
    if (customName.trim()) names.push(customName.trim())
    return names.join(', ')
  }, [selectedNames, customName])

  const canStart = batchNumber.trim().length > 0 && masonName.trim().length > 0

  function toggleName(name: string) {
    setSelectedNames((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]))
  }

  const headline = formulation?.base_name ?? formulation?.name ?? formulation?.code ?? ''

  return (
    <div className="setup-screen">
      <div className="setup-hero">
        <div className="screen-top-row">
          <button className="link-btn back-btn" onClick={() => navigate(-1)}>
            ← Change Product
          </button>
          <GoMaxBadge size={28} />
        </div>
        <div className="setup-hero-card">
          {formulation?.category && <span className="setup-hero-label">{formulation.category}</span>}
          <span className="setup-hero-name">{headline}</span>
        </div>
      </div>

      <div className="setup-sheet">
        <div className="setup-sheet-handle" />

        <section className="setup-section">
          <h2 className="setup-section-title">Batch Number</h2>
          <input
            className="setup-number-input"
            inputMode="numeric"
            placeholder="e.g. 104"
            value={batchNumber}
            onChange={(e) => setBatchNumber(e.target.value)}
          />
        </section>

        <section className="setup-section">
          <h2 className="setup-section-title">Who is working?</h2>
          <p className="hint-text">Tap all names on this batch</p>
          <div className="worker-chips">
            {suggestedNames.map((name) => (
              <button
                key={name}
                type="button"
                className={`worker-chip ${selectedNames.includes(name) ? 'active' : ''}`}
                onClick={() => toggleName(name)}
              >
                {name}
              </button>
            ))}
          </div>
          <input
            className="field-input"
            placeholder="Add another name…"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
          />
        </section>
      </div>

      <div className="setup-footer">
        <button
          className="btn btn-primary"
          disabled={!canStart}
          onClick={() =>
            navigate(`/batch/new/${formulationId}/confirm`, {
              state: { batchNumber: batchNumber.trim(), masonName: masonName.trim() },
            })
          }
        >
          Continue →
        </button>
      </div>
    </div>
  )
}
