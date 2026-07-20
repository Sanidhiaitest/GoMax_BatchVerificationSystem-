import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSupervisor } from '../SupervisorContext'
import { supabase } from '../supabaseClient'
import { GoMaxWordmark } from '../GoMaxLogo'
import Avatar from '../Avatar'
import type { SupervisorRoster } from '../types'

// Photo-booth picker: each card gets a slight alternating tilt and a
// cycling pastel backdrop so the roster reads like fanned-out polaroids
// instead of a flat table.
const CARD_ROTATIONS = [-5, 3, -2, 5, -3, 2]
const CARD_COLORS = ['#EEF2F8', '#F5F0EA', '#EEF5EE', '#F5EEF5', '#EEF2F8', '#F5F5EA']

export default function Login() {
  const { supervisor, ready, initError, retryInit, login } = useSupervisor()
  const [roster, setRoster] = useState<SupervisorRoster[]>([])
  const [rosterError, setRosterError] = useState<string | null>(null)
  const [selected, setSelected] = useState<SupervisorRoster | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (ready && supervisor) navigate(supervisor.role === 'tester' ? '/testing' : '/formulation', { replace: true })
  }, [ready, supervisor, navigate])

  useEffect(() => {
    if (!ready || supervisor) return
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('supervisors_public')
        .select('id, name, active, role')
        .eq('active', true)
        .order('name')
      if (cancelled) return
      if (error) setRosterError(error.message)
      else setRoster(data ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [ready, supervisor])

  async function submitPin(nextPin: string) {
    setSubmitting(true)
    setError(null)
    try {
      const session = await login(nextPin)
      navigate(session.role === 'tester' ? '/testing' : '/formulation')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message.includes('invalid pin') ? 'Incorrect PIN. Try again.' : `Could not log in: ${message}`)
      setPin('')
    } finally {
      setSubmitting(false)
    }
  }

  function press(digit: string) {
    if (submitting) return
    const next = (pin + digit).slice(0, 4)
    setPin(next)
    setError(null)
    if (next.length === 4) submitPin(next)
  }

  function backspace() {
    setPin((p) => p.slice(0, -1))
  }

  function backToPicker() {
    setSelected(null)
    setPin('')
    setError(null)
  }

  if (initError) {
    return (
      <div className="screen center">
        <p className="error-text">Could not connect: {initError}</p>
        <button className="btn btn-primary" onClick={retryInit}>
          Try again
        </button>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="screen center">
        <p>Loading…</p>
      </div>
    )
  }

  // Step 2: PIN entry for the person tapped in step 1.
  if (selected) {
    return (
      <div className="pin-screen">
        <div className="pin-screen-header">
          <button className="link-btn back-btn" onClick={backToPicker}>
            ← Back
          </button>
          <div className="pin-screen-identity">
            <span className="pin-screen-avatar-box">
              <Avatar name={selected.name} size={40} />
            </span>
            <div>
              <p className="hint-text">Hello,</p>
              <p className="pin-screen-name">{selected.name}</p>
            </div>
          </div>
        </div>

        <div className="pin-sheet">
          <div className="pin-sheet-handle" />
          <p className="hint-text">Enter your 4-digit PIN</p>

          <div className="pin-dots" aria-live="polite">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
            ))}
          </div>

          {error && <p className="error-text">{error}</p>}
          {submitting && <p className="hint-text">Checking…</p>}

          <div className="keypad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <button key={d} className="key" onClick={() => press(d)} disabled={submitting}>
                {d}
              </button>
            ))}
            <button className="key key-ghost" disabled />
            <button key="0" className="key" onClick={() => press('0')} disabled={submitting}>
              0
            </button>
            <button className="key key-ghost" onClick={backspace} disabled={submitting}>
              ⌫
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Step 1: "Kaun ho tum?" — tap your name/photo to pick who's signing in.
  // Nothing sensitive is decided here — the PIN entered afterward is still
  // what actually determines identity server-side (see login_supervisor_pin);
  // this step just makes the PIN screen feel personal instead of blind.
  return (
    <div className="picker-screen">
      <div className="picker-header">
        <GoMaxWordmark subtitle="Batch QC" />

        <div className="greeting">
          <h1 className="title picker-title">Kaun ho tum? 👷</h1>
          <p className="subtitle picker-subtitle">Tap your name to sign in</p>
        </div>
      </div>

      <div className="picker-sheet">
      {rosterError && <p className="error-text">{rosterError}</p>}

      <div className="person-grid">
        {roster.map((s, i) => (
          <button
            key={s.id}
            className="person-card"
            style={{
              transform: `rotate(${CARD_ROTATIONS[i % CARD_ROTATIONS.length]}deg)`,
              background: CARD_COLORS[i % CARD_COLORS.length],
            }}
            onClick={() => setSelected(s)}
          >
            <span className="person-card-photo">
              <Avatar name={s.name} size={56} />
            </span>
            <span className="person-card-nameplate">{s.name}</span>
          </button>
        ))}
      </div>
      </div>
    </div>
  )
}
