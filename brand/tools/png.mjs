/**
 * Tiny PNG decoder (8-bit RGB/RGBA, non-interlaced — what Chromium writes),
 * used to prove rendered assets are real: dimensions, opacity, ink coverage.
 */
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

export function readPng(path) {
  const buf = readFileSync(path)
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${path}: not a PNG`)
  let p = 8
  let ihdr = null
  const idat = []
  while (p < buf.length) {
    const len = buf.readUInt32BE(p)
    const type = buf.toString('latin1', p + 4, p + 8)
    const body = buf.subarray(p + 8, p + 8 + len)
    if (type === 'IHDR') {
      ihdr = {
        width: body.readUInt32BE(0),
        height: body.readUInt32BE(4),
        depth: body[8],
        colorType: body[9],
        interlace: body[12],
      }
    } else if (type === 'IDAT') idat.push(body)
    else if (type === 'IEND') break
    p += 12 + len
  }
  const { width, height, depth, colorType, interlace } = ihdr
  const channels = { 2: 3, 6: 4 }[colorType]
  if (depth !== 8 || !channels || interlace) throw new Error(`${path}: unsupported PNG layout`)
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const out = Buffer.alloc(width * height * 4)
  let prev = Buffer.alloc(stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)))
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0
      const b = prev[i]
      const c = i >= channels ? prev[i - channels] : 0
      let v = line[i]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const pa = Math.abs(b - c)
        const pb = Math.abs(a - c)
        const pc = Math.abs(a + b - 2 * c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      line[i] = v & 0xff
    }
    for (let x = 0; x < width; x++) {
      for (let k = 0; k < 4; k++) {
        out[(y * width + x) * 4 + k] = k < channels ? line[x * channels + k] : 255
      }
    }
    prev = line
  }
  return { width, height, data: out, hasAlpha: channels === 4 }
}

/** Summary statistics that distinguish real artwork from a blank render. */
export function pngStats(path) {
  const { width, height, data, hasAlpha } = readPng(path)
  const n = width * height
  let transparent = 0
  let opaque = 0
  const colours = new Map()
  const bg = data.readUInt32BE(0)
  let differsFromCorner = 0
  for (let i = 0; i < n; i++) {
    const a = data[i * 4 + 3]
    if (a === 0) transparent++
    if (a === 255) opaque++
    const px = data.readUInt32BE(i * 4)
    if (px !== bg) differsFromCorner++
    const key = px >>> 4
    colours.set(key, (colours.get(key) ?? 0) + 1)
  }
  return {
    width,
    height,
    hasAlpha,
    transparentPct: +((100 * transparent) / n).toFixed(2),
    opaquePct: +((100 * opaque) / n).toFixed(2),
    inkPct: +((100 * differsFromCorner) / n).toFixed(2),
    colourBuckets: colours.size,
  }
}

/** Sample one pixel as #rrggbbaa. */
export function pixel(png, x, y) {
  const i = (y * png.width + x) * 4
  return '#' + [0, 1, 2, 3].map((k) => png.data[i + k].toString(16).padStart(2, '0')).join('')
}
