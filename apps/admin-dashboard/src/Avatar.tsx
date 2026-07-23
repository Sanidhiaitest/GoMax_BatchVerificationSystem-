import { useState } from 'react'
import { avatarColors, initials, avatarImageSrc } from './avatar'

// person=true renders the same illustrated worker avatars the supervisor
// app uses (public/avatars/, assigned deterministically per name),
// falling back to colored initials on 404. Kept opt-in — products and
// materials also use this component with their own name/description and
// a person illustration wouldn't make sense there.
export default function Avatar({
  name,
  size = 36,
  person = false,
}: {
  name: string
  size?: number
  person?: boolean
}) {
  const { bg, fg } = avatarColors(name)
  const [imageFailed, setImageFailed] = useState(false)

  if (person && !imageFailed) {
    return (
      <img
        className="avatar avatar-photo"
        src={avatarImageSrc(name)}
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
