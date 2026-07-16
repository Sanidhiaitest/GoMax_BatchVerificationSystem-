import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { SupervisorProvider, useSupervisor } from './SupervisorContext'
import Login from './pages/Login'
import FormulationSelect from './pages/FormulationSelect'
import BatchSetup from './pages/BatchSetup'
import BatchChecklist from './pages/BatchChecklist'
import Submitted from './pages/Submitted'
import History from './pages/History'
import TesterQueue from './pages/TesterQueue'
import TesterBatchDetail from './pages/TesterBatchDetail'
import TesterHistory from './pages/TesterHistory'

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
            path="/history"
            element={
              <RequireSupervisor>
                <History />
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
          <Route
            path="/testing"
            element={
              <RequireSupervisor>
                <TesterQueue />
              </RequireSupervisor>
            }
          />
          <Route
            path="/testing/history"
            element={
              <RequireSupervisor>
                <TesterHistory />
              </RequireSupervisor>
            }
          />
          <Route
            path="/testing/:batchId"
            element={
              <RequireSupervisor>
                <TesterBatchDetail />
              </RequireSupervisor>
            }
          />
        </Routes>
      </HashRouter>
    </SupervisorProvider>
  )
}
