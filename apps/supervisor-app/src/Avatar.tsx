import { useState } from 'react'
import { avatarColors, initials, avatarSlug } from './avatar'

// Renders /avatars/{slug}.png (drop real photos there — see
// public/avatars/README.txt) when present, falling back to the
// colored-initials placeholder on 404 or while none exists yet.
export default function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const { bg, fg } = avatarColors(name)
  const [imageFailed, setImageFailed] = useState(false)

  if (!imageFailed) {
    return (
      <img
        className="avatar avatar-photo"
        src={`/avatars/${avatarSlug(name)}.png`}
        alt={name}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        onError={() => setImageFailed(true)}
      />
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
