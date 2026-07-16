import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'

export default function Layout() {
  const { adminName, signOut } = useAuth()

  return (
    <div className="app-shell">
      <nav className="bottom-nav">
        <NavLink to="/" end className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          Batches
        </NavLink>
        <NavLink
          to="/formulations"
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          Formulations
        </NavLink>
        <NavLink
          to="/supervisors"
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          Supervisors
        </NavLink>
      </nav>

      <div className="app-content-column">
        <header className="app-header">
          <span className="app-header-title">GoMax QC</span>
          <div className="app-header-user">
            <span className="hint-text">{adminName}</span>
            <button className="link-btn" onClick={signOut}>
              Sign out
            </button>
          </div>
        </header>

        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
