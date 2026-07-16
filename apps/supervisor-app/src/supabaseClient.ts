import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  // Fails loudly at startup rather than producing confusing runtime errors
  // deep inside a form submit.
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill them in.',
  )
}

export const supabase = createClient(url, anonKey)

// Every device needs an (anonymous) Supabase Auth session before it can
// call any RPC — the session is what login_supervisor_pin() attaches a
// supervisor identity to. This is device-level, not human-level; the PIN
// is what identifies the human on top of it.
export async function ensureDeviceSession() {
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session

  const { data: signInData, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return signInData.session
}
