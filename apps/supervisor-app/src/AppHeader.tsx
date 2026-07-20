import { useState } from 'react'
import Avatar from './Avatar'
import { GoMaxWordmark } from './GoMaxLogo'

// Light header used on the light-theme screens (formulation picker, etc.) —
// the compact badge/wordmark lockup on the left, a small avatar button on
// the right that opens history + logout, since there's no room here for a
// full identity bar like the dark top-bar screens use.
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

  return (
    <>
      <header className="app-header">
        <GoMaxWordmark subtitle="Batch QC" />
        <button className="app-header-avatar" onClick={() => setMenuOpen(true)} aria-label="Account">
          <Avatar name={name} size={22} />
        </button>
      </header>

      {menuOpen && (
        <div className="modal-backdrop" onClick={() => setMenuOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p className="modal-title">{name}</p>
            <div className="modal-actions modal-actions-column">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setMenuOpen(false)
                  onHistory()
                }}
              >
                {historyLabel}
              </button>
              <button className="btn btn-primary" onClick={onLogout}>
                Log out
              </button>
              <button className="link-btn" onClick={() => setMenuOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
