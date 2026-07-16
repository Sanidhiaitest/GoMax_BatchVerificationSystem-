import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

const container = document.getElementById('root')!

function renderFatalError(message: string) {
  container.innerHTML = `
    <div style="min-height:100svh;display:flex;align-items:center;justify-content:center;padding:24px;background:#0b1220;color:#f1f5f9;font:16px system-ui,sans-serif;text-align:center;">
      <div style="max-width:480px;">
        <h1 style="font-size:20px;margin:0 0 12px;">Setup problem</h1>
        <p style="color:#94a3b8;white-space:pre-wrap;">${message}</p>
      </div>
    </div>
  `
}

// See supervisor-app/src/main.tsx for why this uses a dynamic import()
// instead of a static one: App.tsx transitively imports the Supabase
// client, which throws if the env vars are missing, and a static import
// at the top of this file would crash before any try/catch here could run.
async function bootstrap() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    renderFatalError(
      'VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY are not set for this deployment. Add them in Vercel → Project Settings → Environment Variables, then redeploy.',
    )
    return
  }

  try {
    const { default: App } = await import('./App.tsx')
    createRoot(container).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  } catch (err) {
    renderFatalError(`The app failed to start:\n${err instanceof Error ? err.message : String(err)}`)
  }
}

bootstrap()
