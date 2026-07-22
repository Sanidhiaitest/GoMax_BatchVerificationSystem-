// Picks an icon by keyword match on the material's description, so "Grey
// Cement" and "Silica Sand" read differently at a glance instead of every
// row showing the same generic icon. Order matters — first match wins.
const RULES: [RegExp, string][] = [
  [/cement/i, '🧱'],
  [/silica|sand/i, '⏳'],
  [/water/i, '💧'],
  [/fib(er|re)/i, '🧵'],
  [/(polymer|resin|latex|epoxy|adhesive|bond)/i, '🧴'],
  [/(powder|additive|admixture|plasticizer|accelerator|retarder)/i, '🧂'],
  [/(lime|gypsum|filler|chalk)/i, '⚪'],
  [/(pigment|color|colour|dye)/i, '🎨'],
  [/(fly ?ash|slag)/i, '🌫️'],
  [/(aggregate|gravel|stone|quartz)/i, '🪨'],
  [/(fiber ?glass|mesh|net)/i, '🕸️'],
  [/oil/i, '🛢️'],
]

export function materialIcon(description: string): string {
  const match = RULES.find(([pattern]) => pattern.test(description))
  return match ? match[1] : '📦'
}
