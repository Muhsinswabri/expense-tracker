// Builds every app icon and iOS launch image from the official logo: brand/logo.png
//   npm run icons
// The logo is a rounded app tile drawn on a larger canvas (margin + drop shadow). We cut out
// just the tile — the artwork itself is never cropped, stretched or redrawn — and build:
//   apple-touch-icon  full-bleed square (iOS applies its own rounded mask)
//   icon-192/512      the rounded tile with transparent corners
//   maskable-512      the tile inside Android's safe zone on the tile colour
//   favicon, in-app logo, launch images
import { existsSync, mkdirSync } from 'node:fs'
import sharp from 'sharp'

const SRC = 'brand/logo.png'
if (!existsSync(SRC)) {
  console.error(`No logo found at ${SRC}.`)
  process.exit(1)
}
mkdirSync('public/icons', { recursive: true })
mkdirSync('public/splash', { recursive: true })
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 }

// 1. Find the tile: scan the middle row and column for its warm cream fill
//    (the surrounding canvas and shadow are neutral grey/white).
const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const { width: W, height: H } = info
const px = (x, y) => data.subarray((y * W + x) * 4, (y * W + x) * 4 + 4)
const isTile = ([r, g, b, a]) => a >= 250 && r > 240 && r - b >= 3
const midX = W >> 1
const midY = H >> 1
let [left, right, top, bottom] = [0, W - 1, 0, H - 1]
while (left < midX && !isTile(px(left, midY))) left++
while (right > midX && !isTile(px(right, midY))) right--
while (top < midY && !isTile(px(midX, top))) top++
while (bottom > midY && !isTile(px(midX, bottom))) bottom--
const INSET = 2 // skip the anti-aliased edge so no shadow fringe remains
left += INSET; top += INSET; right -= INSET; bottom -= INSET
const tw = right - left + 1
const th = bottom - top + 1
const [cr, cg, cb] = px(left + Math.round(tw * 0.25), midY) // tile colour, sampled inside the tile
const TILE_BG = { r: cr, g: cg, b: cb, alpha: 1 }

// Each corner's real radius: walk the diagonal inward until the tile starts
// (distance d along the diagonal of a circular corner = r·(1 − 1/√2)). +6px clears the soft shadow edge.
const cornerRadius = (x0, y0, dx, dy) => {
  let d = 0
  while (d < tw / 2 && !isTile(px(x0 + dx * d, y0 + dy * d))) d++
  return Math.round(d / (1 - Math.SQRT1_2)) + 6
}
const R = {
  tl: cornerRadius(left, top, 1, 1),
  tr: cornerRadius(right, top, -1, 1),
  br: cornerRadius(right, bottom, -1, -1),
  bl: cornerRadius(left, bottom, 1, -1),
}
console.log(`Tile ${tw}×${th} at (${left}, ${top}), corner radii ${Object.values(R).join('/')}px, colour rgb(${cr}, ${cg}, ${cb})`)

// 2. The tile with its own rounded corners, then centred on a square canvas.
const roundedRect = `M${R.tl} 0H${tw - R.tr}A${R.tr} ${R.tr} 0 0 1 ${tw} ${R.tr}V${th - R.br}A${R.br} ${R.br} 0 0 1 ${tw - R.br} ${th}H${R.bl}A${R.bl} ${R.bl} 0 0 1 0 ${th - R.bl}V${R.tl}A${R.tl} ${R.tl} 0 0 1 ${R.tl} 0Z`
const mask = Buffer.from(`<svg width="${tw}" height="${th}"><path d="${roundedRect}"/></svg>`)
const tile = await sharp(SRC).extract({ left, top, width: tw, height: th }).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
const side = Math.max(tw, th)
const onCanvas = (bg) =>
  sharp({ create: { width: side, height: side, channels: 4, background: bg } }).composite([{ input: tile, gravity: 'center' }]).png().toBuffer()
const rounded = await onCanvas(CLEAR) // transparent corners
const square = await onCanvas(TILE_BG) // full bleed

// 3. Render a base image at `size`, scaled to (1 - 2*pad) and centred on `bg`.
async function save(file, base, size, pad = 0, bg = CLEAR) {
  const inner = Math.round(size * (1 - 2 * pad))
  const img = await sharp(base).resize(inner, inner, { fit: 'contain', background: CLEAR }).png().toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: img, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(`public/${file}`)
}

await save('apple-touch-icon.png', square, 180)
await save('icons/icon-192.png', rounded, 192)
await save('icons/icon-512.png', rounded, 512)
await save('icons/maskable-512.png', square, 512, 0.12, TILE_BG)
await save('favicon.png', rounded, 64)
await save('logo.png', rounded, 256) // in-app header

// 4. iOS launch images: the tile centred on white. Same devices as index.html.
const devices = [
  [375, 667, 2], [375, 812, 3], [414, 896, 2], [414, 896, 3], [390, 844, 3],
  [428, 926, 3], [393, 852, 3], [430, 932, 3], [402, 874, 3], [440, 956, 3],
]
for (const [w, h, r] of devices) {
  const [SW, SH, s] = [w * r, h * r, 120 * r]
  const img = await sharp(rounded).resize(s, s).png().toBuffer()
  await sharp({ create: { width: SW, height: SH, channels: 4, background: '#FFFFFF' } })
    .composite([{ input: img, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(`public/splash/${SW}x${SH}-light.png`)
}
console.log('Icons and launch images built from brand/logo.png.')
