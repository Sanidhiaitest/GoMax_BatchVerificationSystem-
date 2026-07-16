import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSupervisor } from '../SupervisorContext'

export default function Login() {
  const { supervisor, ready, initError, retryInit, login } = useSupervisor()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (ready && supervisor) navigate(supervisor.role === 'tester' ? '/testing' : '/formulation', { replace: true })
  }, [ready, supervisor, navigate])

  async function submitPin(nextPin: string) {
    setSubmitting(true)
    setError(null)
    try {
      const session = await login(nextPin)
      navigate(session.role === 'tester' ? '/testing' : '/formulation')
    } catch (err) {
      // Only the RPC's deliberate "no match" case gets the friendly
      // message — anything else (network issue, a database-side bug) is
      // shown as-is so it's diagnosable instead of masquerading as a typo.
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

  return (
    <div className="screen center">
      <h1 className="title">GoMax Batch QC</h1>
      <p className="subtitle">Enter your 4-digit PIN</p>

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
  )
}
