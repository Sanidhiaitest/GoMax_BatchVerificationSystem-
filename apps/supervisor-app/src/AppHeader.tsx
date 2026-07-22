import { useState } from 'react'
import Avatar from './Avatar'
import { GoMaxWordmark } from './GoMaxLogo'

// Light header used on the light-theme screens (formulation picker, etc.) —
// the compact badge/wordmark lockup on the left, a Logout button on the
// right. Tapping Logout goes straight to a confirm step (no menu in
// between) so the label does what it says. History lives in each page's
// own body instead of up here (see the "HISTORY · View all" section).
export default function AppHeader({
  name,
  onLogout,
}: {
  name: string
  onLogout: () => void
}) {
  const [confirmingLogout, setConfirmingLogout] = useState(false)

  function handleLogout() {
    onLogout()
    // A hard reload (not client-side navigation) so nothing — an in-flight
    // route transition, a blurred modal backdrop layer some mobile browsers
    // fail to un-composite on unmount — can survive into the next screen.
    // The device's stored session is already cleared above, so the fresh
    // boot lands straight on the picker screen.
    window.location.hash = '/'
    window.location.reload()
  }

  return (
    <>
      <header className="app-header">
        <GoMaxWordmark subtitle="Batch QC" />
        <button className="app-header-account" onClick={() => setConfirmingLogout(true)} aria-label="Log out">
          <span className="app-header-logout-label">Logout</span>
          <span className="app-header-avatar-box">
            <Avatar name={name} size={22} />
          </span>
        </button>
      </header>

      {confirmingLogout && (
        <div className="modal-backdrop" onClick={() => setConfirmingLogout(false)}>
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
