import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { SupervisorProvider, useSupervisor } from './SupervisorContext'
import Login from './pages/Login'
import FormulationSelect from './pages/FormulationSelect'
import BatchSetup from './pages/BatchSetup'
import BatchChecklist from './pages/BatchChecklist'
import Submitted from './pages/Submitted'

function RequireSupervisor({ children }: { children: React.ReactNode }) {
  const { supervisor, ready } = useSupervisor()
  if (!ready) return <FullScreenLoader />
  if (!supervisor) return <Navigate to="/" replace />
  return <>{children}</>
}

function FullScreenLoader() {
  return (
    <div className="screen center">
      <p>Loading…</p>
    </div>
  )
}

export default function App() {
  return (
    <SupervisorProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route
            path="/formulation"
            element={
              <RequireSupervisor>
                <FormulationSelect />
              </RequireSupervisor>
            }
          />
          <Route
            path="/batch/new/:formulationId"
            element={
              <RequireSupervisor>
                <BatchSetup />
              </RequireSupervisor>
            }
          />
          <Route
            path="/batch/:batchId"
            element={
              <RequireSupervisor>
                <BatchChecklist />
              </RequireSupervisor>
            }
          />
          <Route
            path="/batch/:batchId/submitted"
            element={
              <RequireSupervisor>
                <Submitted />
              </RequireSupervisor>
            }
          />
        </Routes>
      </HashRouter>
    </SupervisorProvider>
  )
}
