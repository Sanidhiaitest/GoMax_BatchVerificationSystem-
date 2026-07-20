import { useState } from 'react'
import { avatarColors, initials, avatarImageSrc } from './avatar'

// Renders one of the illustrated worker avatars in public/avatars/
// (assigned deterministically per name), falling back to the
// colored-initials placeholder on 404 or while none exists yet.
// shape="fill" makes the illustration fill its parent as a rounded
// rectangle (the picker's photo-booth cards) instead of a circle.
export default function Avatar({
  name,
  size = 40,
  shape = 'circle',
}: {
  name: string
  size?: number
  shape?: 'circle' | 'fill'
}) {
  const { bg, fg } = avatarColors(name)
  const [imageFailed, setImageFailed] = useState(false)
  const fill = shape === 'fill'

  if (!imageFailed) {
    return (
      <img
        className={fill ? 'avatar-fill' : 'avatar avatar-photo'}
        src={avatarImageSrc(name)}
        alt={name}
        {...(fill ? {} : { width: size, height: size, style: { width: size, height: size } })}
        onError={() => setImageFailed(true)}
      />
    )
  }

  if (fill) {
    return (
      <span className="avatar-fill avatar-fill-fallback" style={{ background: bg, color: fg }}>
        {initials(name)}
      </span>
    )
  }

  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        background: bg,
        color: fg,
        fontSize: size * 0.38,
      }}
    >
      {initials(name)}
    </span>
  )
}
