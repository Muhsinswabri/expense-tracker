// Builds every app icon and iOS launch image from the official logo.
//   1. Put the logo at brand/logo.png (or brand/logo.svg): a square app-icon artwork, ideally 1024 px.
//   2. npm run icons
// Outputs go to public/ and keep the paths index.html and vite.config.js already use.
import { existsSync, mkdirSync } from 'node:fs'
import sharp from 'sharp'

const src = ['brand/logo.png', 'brand/logo.svg'].find((f) => existsSync(f))
if (!src) {
  console.error('No logo found. Add brand/logo.png (or .svg), then run again.')
  process.exit(1)
}

mkdirSync('public/icons', { recursive: true })
mkdirSync('public/splash', { recursive: true })
const load = () => sharp(src, src.endsWith('.svg') ? { density: 1024 } : {})
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 }

// An opaque square logo is used edge to edge (the OS rounds the corners) and its own
// background colour fills any padding. A transparent logo gets white and some padding.
const { data } = await load().resize(64, 64, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const opaque = data[3] === 255 && data[(64 * 64 - 1) * 4 + 3] === 255
const BG = opaque ? { r: data[0], g: data[1], b: data[2], alpha: 1 } : { r: 255, g: 255, b: 255, alpha: 1 }
const PAD = opaque ? 0 : 0.1

async function render(size, pad, bg, radius = 0) {
  const inner = Math.round(size * (1 - 2 * pad))
  const logo = await load().resize(inner, inner, { fit: 'contain', background: CLEAR }).png().toBuffer()
  const layers = [{ input: logo, gravity: 'center' }]
  if (radius) {
    const r = Math.round(size * radius)
    const mask = `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}"/></svg>`
    layers.push({ input: Buffer.from(mask), blend: 'dest-in' })
  }
  return sharp({ create: { width: size, height: size, channels: 4, background: bg } }).composite(layers).png().toBuffer()
}
const save = async (file, size, pad, bg, radius) => sharp(await render(size, pad, bg, radius)).toFile(`public/${file}`)

await save('apple-touch-icon.png', 180, PAD, BG)
await save('icons/icon-192.png', 192, PAD, BG)
await save('icons/icon-512.png', 512, PAD, BG)
await save('icons/maskable-512.png', 512, PAD + 0.1, BG) // keeps the artwork inside the maskable safe zone
await save('favicon.png', 64, PAD, BG, 0.22)
await save('logo.png', 256, PAD, BG, 0.22) // used inside the app UI

// Launch images: same devices as the <link rel="apple-touch-startup-image"> tags in index.html.
const devices = [
  [375, 667, 2], [375, 812, 3], [414, 896, 2], [414, 896, 3], [390, 844, 3],
  [428, 926, 3], [393, 852, 3], [430, 932, 3], [402, 874, 3], [440, 956, 3],
]
for (const [w, h, r] of devices) {
  const [W, H] = [w * r, h * r]
  const logo = await render(112 * r, PAD, BG, 0.22)
  await sharp({ create: { width: W, height: H, channels: 4, background: '#FFFFFF' } })
    .composite([{ input: logo, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(`public/splash/${W}x${H}-light.png`)
}
console.log(`Icons and launch images built from ${src}.`)
