import { useState } from 'react'
import { avatarColors, initials } from './avatar'
import { variantSwatch } from './variants'
import type { Formulation } from './types'

// Shows /products/{code}.png (drop real product photos there — see
// public/products/README.txt) when present, falling back to a coloured
// swatch with the code initials on 404 / while none exists. Grey/White
// variants use their shared swatch colour so the fallback stays consistent.
export default function ProductImage({
  formulation,
  className,
}: {
  formulation: Pick<Formulation, 'code' | 'variant'>
  className?: string
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const slug = formulation.code.trim().toLowerCase().replace(/\s+/g, '-')

  if (!imageFailed) {
    return (
      <span className={className}>
        <img
          className="product-image-photo"
          src={`/products/${slug}.png`}
          alt={formulation.code}
          onError={() => setImageFailed(true)}
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
