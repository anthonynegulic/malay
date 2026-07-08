// Generates public/icons/icon-192.png and icon-512.png with no dependencies:
// raw RGBA scanlines -> zlib deflate -> hand-assembled PNG chunks.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

const PALETTE = {
  limewash: [0xf6, 0xf4, 0xec],
  mansion: [0x2e, 0x4f, 0xa3],
  shutter: [0x0f, 0x7b, 0x6f],
  brass: [0xc9, 0xa2, 0x27],
}

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, pixelFn) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixelFn(x / size, y / size)
      const o = y * (size * 4 + 1) + 1 + x * 4
      raw[o] = r
      raw[o + 1] = g
      raw[o + 2] = b
      raw[o + 3] = 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// The Bukit icon: limewash sky, brass sun, two hill ridges.
function pixel(u, v) {
  const sun = Math.hypot(u - 0.72, v - 0.26) < 0.11
  const backHill = v > 0.62 + 0.16 * Math.cos((u - 0.3) * Math.PI * 1.6)
  const frontHill = v > 0.78 + 0.1 * Math.cos((u - 0.75) * Math.PI * 2.2)
  if (frontHill) return PALETTE.shutter
  if (backHill) return PALETTE.mansion
  if (sun) return PALETTE.brass
  return PALETTE.limewash
}

mkdirSync('public/icons', { recursive: true })
for (const size of [192, 512]) {
  writeFileSync(`public/icons/icon-${size}.png`, png(size, pixel))
  console.log(`icon-${size}.png written`)
}
