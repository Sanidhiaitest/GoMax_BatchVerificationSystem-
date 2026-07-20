// Close recreation of the GoMax mountain/triangle mark from the supplied
// reference images — swap for the real logo file (SVG/PNG) whenever it's
// available instead of this approximation.
export function GoMaxMark({ size = 40, color = '#173259' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 10 L86 82 L68 82 L50 46 L32 82 L14 82 Z" fill={color} />
      <path d="M50 34 L74 82 L60 82 L50 62 L40 82 L26 82 Z" fill={color} fillOpacity="0.55" />
    </svg>
  )
}

export function GoMaxWordmark({
  size = 22,
  markColor = '#173259',
  textColor = '#173259',
  subtitle,
}: {
  size?: number
  markColor?: string
  textColor?: string
  subtitle?: string
}) {
  return (
    <div className="gomax-wordmark">
      <GoMaxMark size={size * 1.8} color={markColor} />
      <div className="gomax-wordmark-text">
        <span className="gomax-wordmark-title" style={{ color: textColor, fontSize: size }}>
          GoMax
        </span>
        {subtitle && <span className="gomax-wordmark-subtitle">{subtitle}</span>}
      </div>
    </div>
  )
}
