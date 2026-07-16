import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import Login from './pages/Login'
import Layout from './Layout'
import BatchList from './pages/BatchList'
import BatchDetail from './pages/BatchDetail'
import Formulations from './pages/Formulations'
import Supervisors from './pages/Supervisors'

function Gate({ children }: { children: React.ReactNode }) {
  const { session, ready, isAdmin } = useAuth()
  if (!ready || (session && isAdmin === null)) {
    return (
      <div className="screen center">
        <p>Loading…</p>
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  if (isAdmin === false) {
    return (
      <div className="screen center">
        <p className="error-text">
          This account is signed in but is not registered as a dashboard admin. Ask an existing
          admin to add you.
        </p>
      </div>
    )
  }
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <Gate>
                <Layout />
              </Gate>
            }
          >
            <Route index element={<BatchList />} />
            <Route path="batch/:batchId" element={<BatchDetail />} />
            <Route path="formulations" element={<Formulations />} />
            <Route path="supervisors" element={<Supervisors />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
