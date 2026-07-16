import { avatarColors, initials } from './avatar'

export default function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const { bg, fg } = avatarColors(name)
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
