// Single source of truth for how Grey and White formulation variants are
// coloured. They're genuinely different formulations (different material
// lists), not a colour toggle, so each gets its own distinct, consistent
// swatch everywhere it appears. Text is always brand navy so it reads the
// same on both.
const VARIANT_SWATCHES: Record<string, { bg: string; fg: string }> = {
  grey: { bg: '#d4d4cf', fg: '#0a1628' },
  white: { bg: '#f4f1ea', fg: '#0a1628' },
}

export function variantSwatch(variant: string | null): { bg: string; fg: string } | null {
  if (!variant) return null
  return VARIANT_SWATCHES[variant.trim().toLowerCase()] ?? null
}
