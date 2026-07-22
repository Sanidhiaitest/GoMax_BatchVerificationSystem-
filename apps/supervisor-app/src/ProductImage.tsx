import { useMemo, useState } from 'react'
import { avatarColors, initials } from './avatar'
import { variantSwatch } from './variants'
import type { Formulation } from './types'

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-')
}

const EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp']

// Tries /products/{slug}.{ext} for every name this product goes by (code,
// base name, full name) across every common image extension, since photos
// get uploaded named after whatever the person uploading was looking at —
// the product's name on the box, not necessarily its internal code. Falls
// back to a coloured swatch with initials once every candidate 404s.
export default function ProductImage({
  formulation,
  className,
}: {
  formulation: Pick<Formulation, 'code' | 'variant'> & Partial<Pick<Formulation, 'name' | 'base_name'>>
  className?: string
}) {
  const candidates = useMemo(() => {
    const names = [formulation.code, formulation.base_name, formulation.name].filter(
      (v): v is string => Boolean(v && v.trim()),
    )
    const slugs = Array.from(new Set(names.map(slugify)))
    return slugs.flatMap((slug) => EXTENSIONS.map((ext) => `/products/${slug}.${ext}`))
  }, [formulation.code, formulation.base_name, formulation.name])

  const [attempt, setAttempt] = useState(0)

  if (attempt < candidates.length) {
    return (
      <span className={className}>
        <img
          className="product-image-photo"
          src={candidates[attempt]}
          alt={formulation.code}
          onError={() => setAttempt((a) => a + 1)}
        />
      </span>
    )
  }

  const swatch = variantSwatch(formulation.variant) ?? avatarColors(formulation.code)
  return (
    <span className={className} style={{ background: swatch.bg, color: swatch.fg }}>
      {initials(formulation.code)}
    </span>
  )
}
