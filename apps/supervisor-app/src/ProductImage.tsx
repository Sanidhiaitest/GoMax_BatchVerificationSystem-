import { useEffect, useState } from 'react'
import { avatarColors, initials } from './avatar'
import { variantSwatch } from './variants'
import type { Formulation } from './types'

// Strip everything but letters/digits so "Pure Set IS 100.jpeg", "GOMAX
// Pureset IS100 - Grey" and "pure-set-is100" all normalize to something
// comparable, regardless of spacing/casing/punctuation differences between
// however a photo got named and the product's code/name/base_name/variant.
function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Lazily fetched once and shared by every ProductImage instance — the
// list of image files that actually exist in public/products/, generated
// at build time by scripts/gen-products-manifest.mjs (see that file).
let manifestPromise: Promise<string[]> | null = null
function loadManifest(): Promise<string[]> {
  if (!manifestPromise) {
    manifestPromise = fetch('/products/manifest.json')
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [])
  }
  return manifestPromise
}

// Tries candidates from most to least specific (full name before bare
// code) so a short code like "P10" can't accidentally grab the photo for
// an unrelated "P100" product just because "p10" is a substring of
// "p100" — a longer, more descriptive candidate is far less likely to
// collide with the wrong file, so it's tried first and, once anything at
// that specificity level matches, shorter/vaguer candidates are never
// consulted.
function findBestMatch(files: string[], candidates: string[]): string | null {
  const stems = files.map((file) => ({ file, stem: normalize(file.replace(/\.[^.]+$/, '')) }))
  const normalizedCandidates = Array.from(new Set(candidates.map(normalize).filter((c) => c.length >= 3))).sort(
    (a, b) => b.length - a.length,
  )

  for (const candidate of normalizedCandidates) {
    let best: { file: string; diff: number } | null = null
    for (const { file, stem } of stems) {
      if (stem === candidate) return file // exact match — can't do better
      if (stem.includes(candidate) || candidate.includes(stem)) {
        const diff = Math.abs(stem.length - candidate.length)
        if (!best || diff < best.diff) best = { file, diff }
      }
    }
    if (best) return best.file
  }
  return null
}

export default function ProductImage({
  formulation,
  className,
}: {
  formulation: Pick<Formulation, 'code' | 'variant'> & Partial<Pick<Formulation, 'name' | 'base_name'>>
  className?: string
}) {
  const [matchedFile, setMatchedFile] = useState<string | null | undefined>(undefined) // undefined = still loading
  const [imageFailed, setImageFailed] = useState(false)

  const candidateKey = [formulation.code, formulation.base_name, formulation.name, formulation.variant]
    .filter(Boolean)
    .join('|')

  useEffect(() => {
    let cancelled = false
    const candidates = [
      formulation.code,
      formulation.base_name,
      formulation.name,
      formulation.base_name && formulation.variant ? `${formulation.base_name} ${formulation.variant}` : null,
    ].filter((v): v is string => Boolean(v))

    loadManifest().then((files) => {
      if (cancelled) return
      setMatchedFile(findBestMatch(files, candidates))
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateKey])

  if (matchedFile === undefined) {
    // Still resolving the manifest — render nothing rather than flash the
    // fallback swatch and then swap to a photo a moment later.
    return <span className={className} />
  }

  if (matchedFile && !imageFailed) {
    return (
      <span className={className}>
        <img
          className="product-image-photo"
          src={`/products/${encodeURIComponent(matchedFile)}`}
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
