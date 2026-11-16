/**
 * Minimal WOFF2 → glyph-outline reader for the brand build. Zero dependencies:
 * Node's built-in brotli handles decompression; the rest is the WOFF2 glyf
 * transform, cmap, fvar/avar and gvar (with IUP), which is all the wordmark
 * needs to outline a weight of a variable TrueType font.
 */
import { brotliDecompressSync } from 'node:zlib'

const KNOWN_TAGS = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca',
  'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea',
  'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL',
  'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar',
  'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat',
  'Gloc', 'Feat', 'Sill',
]

class Reader {
  constructor(buf, pos = 0) {
    this.b = buf
    this.p = pos
  }
  u8() { return this.b.readUInt8(this.p++) }
  i8() { return this.b.readInt8(this.p++) }
  u16() { const v = this.b.readUInt16BE(this.p); this.p += 2; return v }
  i16() { const v = this.b.readInt16BE(this.p); this.p += 2; return v }
  u32() { const v = this.b.readUInt32BE(this.p); this.p += 4; return v }
  i32() { const v = this.b.readInt32BE(this.p); this.p += 4; return v }
  f2dot14() { return this.i16() / 16384 }
  fixed() { return this.i32() / 65536 }
  tag() { const s = this.b.toString('latin1', this.p, this.p + 4); this.p += 4; return s }
  base128() {
    let v = 0
    for (let i = 0; i < 5; i++) {
      const c = this.u8()
      v = v * 128 + (c & 0x7f)
      if (!(c & 0x80)) return v
    }
    throw new Error('woff2: bad UIntBase128')
  }
  u255() {
    const c = this.u8()
    if (c === 253) return this.u16()
    if (c === 255) return this.u8() + 253
    if (c === 254) return this.u8() + 506
    return c
  }
}

/** Unpack the WOFF2 container into raw (possibly transformed) table bytes. */
function unpackWoff2(buf) {
  const r = new Reader(buf)
  if (r.tag() !== 'wOF2') throw new Error('not a WOFF2 file')
  const flavor = r.u32()
  if (flavor === 0x74746366) throw new Error('woff2: font collections are not supported')
  r.u32()
  const numTables = r.u16()
  r.u16()
  r.u32()
  const compressedSize = r.u32()
  r.p += 24
  const dir = []
  for (let i = 0; i < numTables; i++) {
    const flags = r.u8()
    const tag = (flags & 0x3f) === 63 ? r.tag() : KNOWN_TAGS[flags & 0x3f]
    const version = flags >> 6
    const origLength = r.base128()
    const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0
    dir.push({ tag, transformed, length: transformed ? r.base128() : origLength })
  }
  const data = brotliDecompressSync(buf.subarray(r.p, r.p + compressedSize))
  const tables = {}
  let off = 0
  for (const t of dir) {
    tables[t.tag] = { data: data.subarray(off, off + t.length), transformed: t.transformed }
    off += t.length
  }
  return tables
}

/** Decode a transformed (version 0) glyf table straight into point lists. */
function decodeGlyf(data) {
  const r = new Reader(data)
  r.u16()
  r.u16()
  const numGlyphs = r.u16()
  r.u16()
  const sizes = Array.from({ length: 7 }, () => r.u32())
  let p = r.p
  const [nContourS, nPointsS, flagS, glyphS, compositeS, , instrS] = sizes.map((s) => {
    const st = new Reader(data, p)
    p += s
    return st
  })
  const glyphs = []
  for (let g = 0; g < numGlyphs; g++) {
    const nContours = nContourS.i16()
    if (nContours === 0) {
      glyphs.push({ points: [], ends: [] })
    } else if (nContours > 0) {
      const ends = []
      let total = 0
      for (let c = 0; c < nContours; c++) {
        total += nPointsS.u255()
        ends.push(total - 1)
      }
      const points = []
      let x = 0
      let y = 0
      for (let i = 0; i < total; i++) {
        const full = flagS.u8()
        const flag = full & 0x7f
        const sx = (v) => (flag & 1 ? v : -v)
        const sy = (v) => (flag & 2 ? v : -v)
        let dx
        let dy
        if (flag < 10) {
          dx = 0
          dy = sx(((flag & 14) << 7) + glyphS.u8())
        } else if (flag < 20) {
          dx = sx((((flag - 10) & 14) << 7) + glyphS.u8())
          dy = 0
        } else if (flag < 84) {
          const b0 = flag - 20
          const b1 = glyphS.u8()
          dx = sx(1 + (b0 & 0x30) + (b1 >> 4))
          dy = sy(1 + ((b0 & 0x0c) << 2) + (b1 & 0x0f))
        } else if (flag < 120) {
          const b0 = flag - 84
          dx = sx(1 + (Math.floor(b0 / 12) << 8) + glyphS.u8())
          dy = sy(1 + (((b0 % 12) >> 2) << 8) + glyphS.u8())
        } else if (flag < 124) {
          const b0 = glyphS.u8()
          const b1 = glyphS.u8()
          const b2 = glyphS.u8()
          dx = sx((b0 << 4) + (b1 >> 4))
          dy = sy(((b1 & 0x0f) << 8) + b2)
        } else {
          const b0 = glyphS.u8()
          const b1 = glyphS.u8()
          const b2 = glyphS.u8()
          const b3 = glyphS.u8()
          dx = sx((b0 << 8) + b1)
          dy = sy((b2 << 8) + b3)
        }
        x += dx
        y += dy
        points.push({ x, y, on: !(full & 0x80) })
      }
      instrS.p += glyphS.u255()
      glyphs.push({ points, ends })
    } else {
      let flags
      let haveInstr = false
      const components = []
      do {
        flags = compositeS.u16()
        const glyphIndex = compositeS.u16()
        const dx = flags & 1 ? compositeS.i16() : compositeS.i8()
        const dy = flags & 1 ? compositeS.i16() : compositeS.i8()
        if (flags & 0x08) compositeS.p += 2
        else if (flags & 0x40) compositeS.p += 4
        else if (flags & 0x80) compositeS.p += 8
        if (flags & 0x100) haveInstr = true
        components.push({ glyphIndex, dx, dy })
      } while (flags & 0x20)
      if (haveInstr) instrS.p += glyphS.u255()
      glyphs.push({ components })
    }
  }
  return glyphs
}

function decodeCmap(data) {
  const r = new Reader(data)
  r.u16()
  const n = r.u16()
  const subtables = []
  for (let i = 0; i < n; i++) subtables.push({ pid: r.u16(), eid: r.u16(), off: r.u32() })
  const pick =
    subtables.find((s) => s.pid === 3 && s.eid === 10) ??
    subtables.find((s) => s.pid === 3 && s.eid === 1) ??
    subtables.find((s) => s.pid === 0)
  if (!pick) throw new Error('cmap: no unicode subtable')
  const t = new Reader(data, pick.off)
  const format = t.u16()
  const map = new Map()
  if (format === 4) {
    t.p += 4
    const segX2 = t.u16()
    const seg = segX2 / 2
    t.p += 6
    const base = t.p
    const at = (arr, i) => data.readUInt16BE(base + arr * segX2 + (arr > 0 ? 2 : 0) + i * 2)
    for (let i = 0; i < seg; i++) {
      const end = at(0, i)
      const start = at(1, i)
      const delta = at(2, i)
      const rangeOff = at(3, i)
      for (let c = start; c <= end && c !== 0xffff; c++) {
        let gid
        if (rangeOff === 0) gid = (c + delta) & 0xffff
        else {
          const addr = base + 3 * segX2 + 2 + i * 2 + rangeOff + (c - start) * 2
          gid = data.readUInt16BE(addr)
          if (gid !== 0) gid = (gid + delta) & 0xffff
        }
        map.set(c, gid)
      }
    }
  } else if (format === 12) {
    t.p += 10
    const groups = t.u32()
    for (let i = 0; i < groups; i++) {
      const s = t.u32()
      const e = t.u32()
      const g = t.u32()
      for (let c = s; c <= e; c++) map.set(c, g + c - s)
    }
  } else {
    throw new Error(`cmap: unsupported format ${format}`)
  }
  return map
}

function decodeFvar(data) {
  const r = new Reader(data)
  r.p = 4
  const axesOffset = r.u16()
  r.u16()
  const axisCount = r.u16()
  const axisSize = r.u16()
  const axes = []
  for (let i = 0; i < axisCount; i++) {
    const a = new Reader(data, axesOffset + i * axisSize)
    axes.push({ tag: a.tag(), min: a.fixed(), def: a.fixed(), max: a.fixed() })
  }
  return axes
}

function decodeAvar(data) {
  const r = new Reader(data)
  r.p = 6
  const n = r.u16()
  const maps = []
  for (let i = 0; i < n; i++) {
    const count = r.u16()
    const pairs = []
    for (let j = 0; j < count; j++) pairs.push([r.f2dot14(), r.f2dot14()])
    maps.push(pairs)
  }
  return maps
}

function readPointNumbers(r) {
  let count = r.u8()
  if (count === 0) return null
  if (count & 0x80) count = ((count & 0x7f) << 8) | r.u8()
  const pts = []
  let last = 0
  while (pts.length < count) {
    const ctl = r.u8()
    const run = (ctl & 0x7f) + 1
    for (let i = 0; i < run; i++) {
      last += ctl & 0x80 ? r.u16() : r.u8()
      pts.push(last)
    }
  }
  return pts
}

function readDeltas(r, n) {
  const out = []
  while (out.length < n) {
    const ctl = r.u8()
    const run = (ctl & 0x3f) + 1
    const kind = ctl & 0xc0
    for (let i = 0; i < run; i++) {
      if (kind === 0x80) out.push(0)
      else if (kind === 0x40) out.push(r.i16())
      else if (kind === 0xc0) out.push(r.i32())
      else out.push(r.i8())
    }
  }
  return out
}

function tupleScalar(peak, start, end, coords) {
  let s = 1
  for (let i = 0; i < coords.length; i++) {
    const pk = peak[i]
    const v = coords[i]
    if (pk === 0 || v === pk) continue
    if (start) {
      const a = start[i]
      const b = end[i]
      if (a > pk || pk > b || (a < 0 && b > 0)) continue
      if (v <= a || v >= b) return 0
      s *= v < pk ? (v - a) / (pk - a) : (b - v) / (b - pk)
    } else {
      if (v === 0 || v < Math.min(0, pk) || v > Math.max(0, pk)) return 0
      s *= v / pk
    }
  }
  return s
}

function interpolate(p, a, b, da, db) {
  if (a === b) return da === db ? da : 0
  if (a > b) return interpolate(p, b, a, db, da)
  if (p <= a) return da
  if (p >= b) return db
  return da + ((p - a) * (db - da)) / (b - a)
}

/** Infer deltas for untouched points (OpenType gvar "IUP"), per contour. */
function iup(explicit, glyph) {
  const out = glyph.points.map(() => [0, 0])
  let start = 0
  for (const end of glyph.ends) {
    const touched = []
    for (let i = start; i <= end; i++) if (explicit.has(i)) touched.push(i)
    if (touched.length > 0) {
      for (let i = start; i <= end; i++) {
        if (explicit.has(i)) {
          out[i] = explicit.get(i)
          continue
        }
        if (touched.length === 1) {
          out[i] = explicit.get(touched[0])
          continue
        }
        let prev = touched[touched.length - 1]
        let next = touched[0]
        for (const t of touched) {
          if (t < i) prev = t
          if (t > i) {
            next = t
            break
          }
        }
        const P = glyph.points[i]
        const A = glyph.points[prev]
        const B = glyph.points[next]
        const dA = explicit.get(prev)
        const dB = explicit.get(next)
        out[i] = [interpolate(P.x, A.x, B.x, dA[0], dB[0]), interpolate(P.y, A.y, B.y, dA[1], dB[1])]
      }
    }
    start = end + 1
  }
  return out
}

export class Font {
  constructor(buf) {
    const t = unpackWoff2(buf)
    if (!t.glyf?.transformed) throw new Error('expected a transformed glyf table')
    this.unitsPerEm = t.head.data.readUInt16BE(18)
    this.glyphs = decodeGlyf(t.glyf.data)
    this.cmap = decodeCmap(t.cmap.data)
    this.axes = t.fvar ? decodeFvar(t.fvar.data) : []
    this.avar = t.avar ? decodeAvar(t.avar.data) : null
    this.gvar = t.gvar ? t.gvar.data : null
    this.tables = Object.keys(t)
  }

  /** User-space axis values ({ wght: 700 }) → normalized, avar-mapped coords. */
  normalize(user) {
    return this.axes.map((a, i) => {
      const v = Math.min(a.max, Math.max(a.min, user[a.tag] ?? a.def))
      let n = 0
      if (v < a.def) n = (v - a.def) / (a.def - a.min)
      else if (v > a.def) n = (v - a.def) / (a.max - a.def)
      const map = this.avar?.[i]
      if (map && map.length) {
        for (let j = 1; j < map.length; j++) {
          const [f0, t0] = map[j - 1]
          const [f1, t1] = map[j]
          if (n >= f0 && n <= f1) {
            n = f1 === f0 ? t0 : t0 + ((n - f0) * (t1 - t0)) / (f1 - f0)
            break
          }
        }
      }
      return n
    })
  }

  glyphId(char) {
    return this.cmap.get(char.codePointAt(0)) ?? 0
  }

  /** Points of a simple glyph with gvar deltas applied at `coords`. */
  instance(gid, coords) {
    const glyph = this.glyphs[gid]
    if (glyph.components) throw new Error(`glyph ${gid} is composite; not supported here`)
    const n = glyph.points.length
    const pts = glyph.points.map((pt) => ({ ...pt }))
    if (!this.gvar || n === 0) return { points: pts, ends: glyph.ends }
    const g = new Reader(this.gvar)
    g.p = 4
    const axisCount = g.u16()
    const sharedCount = g.u16()
    const sharedOffset = g.u32()
    g.u16()
    const flags = g.u16()
    const arrayOffset = g.u32()
    const offAt = (i) =>
      flags & 1 ? this.gvar.readUInt32BE(20 + i * 4) : this.gvar.readUInt16BE(20 + i * 2) * 2
    const start = arrayOffset + offAt(gid)
    if (offAt(gid + 1) === offAt(gid)) return { points: pts, ends: glyph.ends }
    const shared = []
    for (let i = 0; i < sharedCount; i++) {
      const s = new Reader(this.gvar, sharedOffset + i * axisCount * 2)
      shared.push(Array.from({ length: axisCount }, () => s.f2dot14()))
    }
    const h = new Reader(this.gvar, start)
    const tvc = h.u16()
    const dataOffset = h.u16()
    const headers = []
    for (let i = 0; i < (tvc & 0x0fff); i++) {
      const size = h.u16()
      const idx = h.u16()
      const tuple = () => Array.from({ length: axisCount }, () => h.f2dot14())
      const peak = idx & 0x8000 ? tuple() : shared[idx & 0x0fff]
      const inter = idx & 0x4000 ? [tuple(), tuple()] : [null, null]
      headers.push({ size, priv: (idx & 0x2000) !== 0, peak, start: inter[0], end: inter[1] })
    }
    const d = new Reader(this.gvar, start + dataOffset)
    const sharedPoints = tvc & 0x8000 ? readPointNumbers(d) : null
    const total = n + 4
    for (const t of headers) {
      const at = d.p
      const scalar = tupleScalar(t.peak, t.start, t.end, coords)
      if (scalar !== 0) {
        const points = t.priv ? readPointNumbers(d) : sharedPoints
        const count = points ? points.length : total
        const deltas = readDeltas(d, count * 2)
        if (!points) {
          for (let i = 0; i < n; i++) {
            pts[i].x += scalar * deltas[i]
            pts[i].y += scalar * deltas[count + i]
          }
        } else {
          const explicit = new Map()
          points.forEach((pi, k) => {
            if (pi < n) explicit.set(pi, [deltas[k], deltas[count + k]])
          })
          iup(explicit, glyph).forEach(([dx, dy], i) => {
            pts[i].x += scalar * dx
            pts[i].y += scalar * dy
          })
        }
      }
      d.p = at + t.size
    }
    return { points: pts, ends: glyph.ends }
  }
}

/**
 * TrueType quadratic contours → explicit segments: each contour is a start
 * point followed by `{ c, x, y }` hops, where `c` is the quadratic control
 * point (or null for a straight line). Implied on-curve midpoints are resolved.
 */
export function toSegments({ points, ends }) {
  const contours = []
  let start = 0
  for (const end of ends) {
    const c = points.slice(start, end + 1)
    start = end + 1
    if (c.length < 2) continue
    const first = c.findIndex((p) => p.on)
    const ring =
      first === -1
        ? [{ x: (c[0].x + c[1].x) / 2, y: (c[0].y + c[1].y) / 2, on: true }, ...c.slice(1), c[0]]
        : [...c.slice(first), ...c.slice(0, first)]
    const s = ring[0]
    const hops = []
    let ctrl = null
    for (let i = 1; i <= ring.length; i++) {
      const p = i === ring.length ? s : ring[i]
      if (p.on) {
        hops.push({ c: ctrl, x: p.x, y: p.y })
        ctrl = null
      } else {
        if (ctrl) hops.push({ c: ctrl, x: (ctrl.x + p.x) / 2, y: (ctrl.y + p.y) / 2 })
        ctrl = p
      }
    }
    contours.push({ s: { x: s.x, y: s.y }, hops })
  }
  return contours
}

/** Exact ink bounds, including quadratic extrema (not just control hulls). */
export function segmentBounds(contours) {
  const b = { xMin: Infinity, yMin: Infinity, xMax: -Infinity, yMax: -Infinity }
  const add = (x, y) => {
    b.xMin = Math.min(b.xMin, x)
    b.xMax = Math.max(b.xMax, x)
    b.yMin = Math.min(b.yMin, y)
    b.yMax = Math.max(b.yMax, y)
  }
  const extrema = (p0, p1, p2) => {
    const den = p0 - 2 * p1 + p2
    if (den === 0) return []
    const t = (p0 - p1) / den
    return t > 0 && t < 1 ? [t] : []
  }
  for (const { s, hops } of contours) {
    let prev = s
    add(s.x, s.y)
    for (const h of hops) {
      add(h.x, h.y)
      if (h.c) {
        for (const t of [...extrema(prev.x, h.c.x, h.x), ...extrema(prev.y, h.c.y, h.y)]) {
          const u = 1 - t
          add(u * u * prev.x + 2 * u * t * h.c.x + t * t * h.x, u * u * prev.y + 2 * u * t * h.c.y + t * t * h.y)
        }
      }
      prev = h
    }
  }
  return b
}

/** Segments → SVG path data. `map(x, y)` converts to output space; `fmt` rounds. */
export function segmentsToPath(contours, map, fmt) {
  const pt = (p) => {
    const m = map(p.x, p.y)
    return `${fmt(m.x)} ${fmt(m.y)}`
  }
  let d = ''
  for (const { s, hops } of contours) {
    d += `M${pt(s)}`
    hops.forEach((h, i) => {
      if (i === hops.length - 1 && !h.c) return
      d += h.c ? `Q${pt(h.c)} ${pt(h)}` : `L${pt(h)}`
    })
    d += 'Z'
  }
  return d
}
