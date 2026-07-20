// Grey / White variant colours — kept identical to the supervisor app's
// variants.ts so a variant looks the same in both apps. Grey and White are
// genuinely different formulations (different material lists), not a colour
// toggle, so each has its own consistent swatch.
const VARIANT_SWATCHES: Record<string, { bg: string; fg: string }> = {
  grey: { bg: '#d4d4cf', fg: '#0a1628' },
  white: { bg: '#f4f1ea', fg: '#0a1628' },
}

export function variantSwatch(variant: string | null): { bg: string; fg: string } | null {
  if (!variant) return null
  return VARIANT_SWATCHES[variant.trim().toLowerCase()] ?? null
}
