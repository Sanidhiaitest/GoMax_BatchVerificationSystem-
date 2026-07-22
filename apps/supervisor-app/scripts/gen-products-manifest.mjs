// Runs before every build. Lists whatever image files actually exist in
// public/products/ into a JSON manifest the app fetches at runtime, so
// ProductImage can fuzzy-match a product to a photo regardless of exactly
// how the file got named when someone uploaded it (product name, code,
// with/without "GoMax", different casing, etc.) — no code change needed
// each time a new photo is dropped in.
import { readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, extname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const productsDir = join(__dirname, '..', 'public', 'products')
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])

const files = readdirSync(productsDir).filter((f) => IMAGE_EXTENSIONS.has(extname(f).toLowerCase()))

writeFileSync(join(productsDir, 'manifest.json'), JSON.stringify(files, null, 0))
console.log(`products manifest: ${files.length} image(s)`)
