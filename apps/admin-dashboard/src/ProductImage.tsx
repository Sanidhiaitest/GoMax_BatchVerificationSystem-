import { useEffect, useState } from 'react'
import { avatarColors, initials } from './avatar'
import { variantSwatch } from './variants'
import type { Formulation } from './types'

// Same fuzzy-match logic as the supervisor app's ProductImage — kept in
// sync so a product shows the same photo in both apps regardless of how
// the uploaded filename is spelled/cased.
function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

let manifestPromise: Promise<string[]> | null = null
function loadManifest(): Promise<string[]> {
  if (!manifestPromise) {
    manifestPromise = fetch('/products/manifest.json')
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [])
  }
  return manifestPromise
}

function findBestMatch(files: string[], candidates: string[]): string | null {
  const stems = files.map((file) => ({ file, stem: normalize(file.replace(/\.[^.]+$/, '')) }))
  const normalizedCandidates = Array.from(new Set(candidates.map(normalize).filter((c) => c.length >= 3)))

  for (const candidate of normalizedCandidates) {
    let best: { file: string; diff: number } | null = null
    for (const { file, stem } of stems) {
      if (stem === candidate) return file
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
  const [matchedFile, setMatchedFile] = useState<string | null | undefined>(undefined)
  const [imageFailed, setImageFailed] = useState(false)

  const candidateKey = [formulation.code, formulation.base_name, formulation.name, formulation.variant]
    .filter(Boolean)
    .join('|')

  useEffect(() => {
    let cancelled = false
    const candidates = [
      formulation.code,
      formulation.base_name && formulation.variant ? `${formulation.base_name} ${formulation.variant}` : null,
      formulation.base_name,
      formulation.name,
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
