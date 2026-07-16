import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { ensureDeviceSession, supabase } from './supabaseClient'
import type { SupervisorSession } from './types'

const STORAGE_KEY = 'gomax.supervisor'

interface SupervisorContextValue {
  supervisor: SupervisorSession | null
  ready: boolean
  initError: string | null
  retryInit: () => void
  login: (pin: string) => Promise<SupervisorSession>
  logout: () => void
}

const SupervisorContext = createContext<SupervisorContextValue | null>(null)

export function SupervisorProvider({ children }: { children: ReactNode }) {
  const [supervisor, setSupervisor] = useState<SupervisorSession | null>(null)
  const [ready, setReady] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setInitError(null)
    ;(async () => {
      try {
        await ensureDeviceSession()
        if (cancelled) return
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          try {
            const parsed = JSON.parse(stored)
            // Sessions saved before the tester role existed won't have it.
            setSupervisor({ role: 'supervisor', ...parsed })
          } catch {
            localStorage.removeItem(STORAGE_KEY)
          }
        }
        setReady(true)
      } catch (err) {
        if (cancelled) return
        setInitError(err instanceof Error ? err.message : 'Could not connect. Check your internet connection.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [attempt])

  function retryInit() {
    setAttempt((a) => a + 1)
  }

  async function login(pin: string) {
    await ensureDeviceSession()
    const { data, error } = await supabase.rpc('login_supervisor_pin', { p_pin: pin })
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    const session: SupervisorSession = { id: row.supervisor_id, name: row.supervisor_name, role: row.supervisor_role }
    setSupervisor(session)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    return session
  }

  function logout() {
    setSupervisor(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <SupervisorContext.Provider value={{ supervisor, ready, initError, retryInit, login, logout }}>
      {children}
    </SupervisorContext.Provider>
  )
}

export function useSupervisor() {
  const ctx = useContext(SupervisorContext)
  if (!ctx) throw new Error('useSupervisor must be used within SupervisorProvider')
  return ctx
}
