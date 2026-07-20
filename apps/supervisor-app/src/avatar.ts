// Deterministic color + initials per name — a lightweight stand-in for real
// product photography (which we don't have) so the formulation/material
// lists read as more than plain text rows.
const PALETTE = [
  ['#134e2f', '#34d399'],
  ['#3a2410', '#fb923c'],
  ['#3d1530', '#f472b6'],
  ['#132a4a', '#60a5fa'],
  ['#3a3312', '#facc15'],
  ['#0f2e2e', '#2dd4bf'],
  ['#2a1a45', '#a78bfa'],
] as const

function hash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

export function avatarColors(name: string): { bg: string; fg: string } {
  const [bg, fg] = PALETTE[hash(name) % PALETTE.length]
  return { bg, fg }
}

// How many illustrated worker avatars live in public/avatars/ (1.png..N.png).
const AVATAR_IMAGE_COUNT = 6

// Pick one of the illustrated avatars deterministically from the name, so a
// given person shows the same character on every screen. They're generic
// (not photos of specific people), so a stable hash-to-index is fine.
export function avatarImageSrc(name: string): string {
  return `/avatars/${(hash(name) % AVATAR_IMAGE_COUNT) + 1}.png`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
