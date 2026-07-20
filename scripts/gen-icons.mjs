// Generates public/icons/icon-192.png and icon-512.png with no dependencies:
// raw RGBA scanlines -> zlib deflate -> hand-assembled PNG chunks.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

// "Mansion" palette. Icon is geometric/architectural, not an illustration.
const PALETTE = {
  indigo: [0x2b, 0x4c, 0x9b],
  plaster: [0xef, 0xe9, 0xda],
  gold: [0xc8, 0x91, 0x2f],
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

// Indigo field (the Mansion wall) with a plaster foundation rule and a gold
// cornerstone — architectural, flat, no illustration.
function pixel(u, v) {
  const foundation = v > 0.72 && v < 0.78 // plaster horizon rule
  const cornerstone = u > 0.16 && u < 0.34 && v > 0.5 && v < 0.68 // gold block
  if (cornerstone) return PALETTE.gold
  if (foundation) return PALETTE.plaster
  return PALETTE.indigo
}

mkdirSync('public/icons', { recursive: true })
for (const size of [192, 512]) {
  writeFileSync(`public/icons/icon-${size}.png`, png(size, pixel))
  console.log(`icon-${size}.png written`)
}
