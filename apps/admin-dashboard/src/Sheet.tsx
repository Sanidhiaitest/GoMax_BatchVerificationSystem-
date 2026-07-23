import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Avatar from './Avatar'

// Bottom sheet — slides up from the bottom, portaled to document.body so
// it's never affected by any ancestor's transform/overflow.
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  if (!open) return null
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <span className="sheet-title">{title}</span>
          <button className="link-btn" onClick={onClose}>
            Done
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

// Small centered popup — for compact single-field pickers like a date,
// where a full sliding sheet would be overkill.
export function CenterPopup({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  if (!open) return null
  return createPortal(
    <div className="center-popup-backdrop" onClick={onClose}>
      <div className="center-popup-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <span className="sheet-title">{title}</span>
          <button className="link-btn" onClick={onClose}>
            Done
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export function CheckRow({
  label,
  checked,
  onToggle,
  showAvatar = false,
}: {
  label: string
  checked: boolean
  onToggle: () => void
  showAvatar?: boolean
}) {
  return (
    <button type="button" className={`check-row ${checked ? 'checked' : ''}`} onClick={onToggle}>
      <span className="check-row-box">{checked && '✓'}</span>
      {showAvatar && <Avatar name={label} size={28} person />}
      {label}
    </button>
  )
}
