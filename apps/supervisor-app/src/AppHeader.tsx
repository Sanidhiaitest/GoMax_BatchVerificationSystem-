import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from './Avatar'
import { GoMaxWordmark } from './GoMaxLogo'

// Light header used on the light-theme screens (formulation picker, etc.) —
// the compact badge/wordmark lockup on the left, a small avatar button on
// the right that opens an account sheet (history + logout), since there's
// no room here for a full identity bar like the dark top-bar screens use.
export default function AppHeader({
  name,
  historyLabel,
  onHistory,
  onLogout,
}: {
  name: string
  historyLabel: string
  onHistory: () => void
  onLogout: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmingLogout, setConfirmingLogout] = useState(false)
  const navigate = useNavigate()

  function closeAll() {
    setMenuOpen(false)
    setConfirmingLogout(false)
  }

  function handleLogout() {
    closeAll()
    onLogout()
    navigate('/', { replace: true })
  }

  return (
    <>
      <header className="app-header">
        <GoMaxWordmark subtitle="Batch QC" />
        <button className="app-header-avatar" onClick={() => setMenuOpen(true)} aria-label="Account">
          <Avatar name={name} size={22} />
        </button>
      </header>

      {menuOpen && !confirmingLogout && (
        <div className="modal-backdrop" onClick={closeAll}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p className="modal-title">{name}</p>
            <div className="account-sheet-actions">
              <button
                className="account-sheet-row"
                onClick={() => {
                  closeAll()
                  onHistory()
                }}
              >
                <span>🕐</span>
                {historyLabel}
              </button>
              <button className="account-sheet-row account-sheet-row-danger" onClick={() => setConfirmingLogout(true)}>
                <span>🚪</span>
                Log out
              </button>
            </div>
            <button className="link-btn" onClick={closeAll}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {menuOpen && confirmingLogout && (
        <div className="modal-backdrop" onClick={closeAll}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p className="modal-title">Log out?</p>
            <p className="modal-body">You'll need your PIN to sign in again.</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmingLogout(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleLogout}>
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
