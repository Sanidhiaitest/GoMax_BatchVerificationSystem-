// App icon badge + wordmark lockup, matched to the supplied Figma spec
// (38x38 rounded-square badge, "GoMax" / "Batch QC" stacked text). The
// badge icon is a placeholder shield-check glyph — swap for the real
// exported icon asset whenever available.
export function GoMaxWordmark({ subtitle }: { subtitle?: string }) {
  return (
    <div className="gomax-wordmark">
      <span className="gomax-badge">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M9 1.5L15.5 4v4.5c0 4-2.8 6.9-6.5 8.5-3.7-1.6-6.5-4.5-6.5-8.5V4L9 1.5Z"
            stroke="#FFFFFF"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M6 9l2 2 4-4.5" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <div className="gomax-wordmark-text">
        <span className="gomax-wordmark-title">GoMax</span>
        {subtitle && <span className="gomax-wordmark-subtitle">{subtitle}</span>}
      </div>
    </div>
  )
}
