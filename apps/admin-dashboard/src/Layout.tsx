import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { GoMaxWordmark } from './GoMaxLogo'
import { IconDashboard, IconBatches, IconProducts, IconPeople } from './Icons'

export default function Layout() {
  const { signOut } = useAuth()

  return (
    <div className="app-shell">
      <nav className="bottom-nav">
        <NavLink to="/" end className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <span className="bottom-nav-icon">
            <IconDashboard />
          </span>
          Dashboard
        </NavLink>
        <NavLink
          to="/batches"
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="bottom-nav-icon">
            <IconBatches />
          </span>
          Batches
        </NavLink>
        <NavLink
          to="/formulations"
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="bottom-nav-icon">
            <IconProducts />
          </span>
          Products
        </NavLink>
        <NavLink
          to="/supervisors"
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="bottom-nav-icon">
            <IconPeople />
          </span>
          People
        </NavLink>
      </nav>

      <div className="app-content-column">
        <header className="app-header">
          <GoMaxWordmark subtitle="Batch QC" />
          <div className="app-header-user">
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
