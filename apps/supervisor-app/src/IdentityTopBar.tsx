import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from './Avatar'

export default function IdentityTopBar({
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
  const [confirmingLogout, setConfirmingLogout] = useState(false)
  const navigate = useNavigate()

  function handleLogout() {
    setConfirmingLogout(false)
    onLogout()
    navigate('/', { replace: true })
  }

  return (
    <>
      <header className="top-bar">
        <div>
          <p className="hint-text">Signed in</p>
          <p className="top-bar-title">{name}</p>
        </div>
        <div className="top-bar-actions">
          <button className="link-btn" onClick={onHistory}>
            {historyLabel}
          </button>
          <button className="profile-circle" onClick={() => setConfirmingLogout(true)} aria-label="Account">
            <Avatar name={name} size={40} />
          </button>
        </div>
      </header>

      {confirmingLogout && (
        <div className="modal-backdrop">
          <div className="modal">
            <p className="modal-title">Log out?</p>
            <p className="modal-body">You'll need your PIN to sign in again.</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmingLogout(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleLogout}>
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
