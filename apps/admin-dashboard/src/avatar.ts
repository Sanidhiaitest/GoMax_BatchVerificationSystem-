// Deterministic color + initials per name, used as a lightweight stand-in
// for real product photography (which we don't have) — gives each
// material/formulation a consistent visual anchor instead of a name in a
// plain text row.
const PALETTE = [
  ['#eef2ff', '#4f46e5'],
  ['#ecfdf5', '#059669'],
  ['#fff7ed', '#c2410c'],
  ['#fdf2f8', '#be185d'],
  ['#eff6ff', '#1d4ed8'],
  ['#fefce8', '#a16207'],
  ['#f0fdfa', '#0f766e'],
  ['#f5f3ff', '#6d28d9'],
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

// How many illustrated worker avatars live in public/avatars/ (1.png..N.png)
// — same set as the supervisor app, copied over so both apps show the same
// character for a given person.
const AVATAR_IMAGE_COUNT = 6

export function avatarImageSrc(name: string): string {
  return `/avatars/${(hash(name) % AVATAR_IMAGE_COUNT) + 1}.png`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
