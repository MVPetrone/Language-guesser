/**
 * The dot field's world: a deterministic dot matrix whose density follows a
 * soft map of the continents. No coastline is ever drawn. Land is simply where
 * the matrix is dense, ocean where it is sparse. Pure and DOM-free, so the
 * layout is unit-tested and identical in every session.
 */
import { clamp01, hash2, noise2, smoothstep } from './random.ts'

const TAU = Math.PI * 2

/** Fixed seed ('lang'): the same world, every session. */
export const WORLD_SEED = 0x6c616e67

/** [longitude, latitude, sigma lon, sigma lat, weight], in degrees. */
type Blob = readonly [number, number, number, number, number]

// Continents as soft gaussian blobs, unioned. Coarse on purpose: at 11-16 px
// per dot only the silhouettes matter.
const LAND: readonly Blob[] = [
  // North America
  [-105, 57, 16, 7, 1], [-125, 58, 9, 7, 1], [-75, 54, 9, 6, 0.95], [-150, 64, 9, 4.5, 0.95],
  [-97, 42, 13, 6, 1], [-117, 40, 6, 7, 1], [-83, 36, 6, 6, 1], [-99, 30, 6, 4, 0.95],
  [-82, 28.5, 1.4, 2.2, 0.8], [-103, 23, 6, 5, 0.95], [-89, 15.5, 3.5, 3, 0.85],
  [-82, 9.5, 2.5, 1.8, 0.7], [-40, 74, 9, 6, 0.95], [-95, 72, 13, 3.5, 0.75],
  [-63, 47, 3, 2.2, 0.8], [-56, 49, 1.6, 1.4, 0.7], [-79, 21.8, 3.2, 0.9, 0.6],
  // South America
  [-62, -6, 11, 7, 1], [-45, -10, 5, 6, 1], [-50, -20, 6, 6, 1], [-72, 5, 5, 5, 1],
  [-64, 7, 4, 3, 0.95], [-75, -10, 3.5, 6, 0.95], [-63, -23, 6, 7, 1], [-66, -37, 4.5, 6, 0.95],
  [-70, -48, 3, 4.5, 0.85], [-56, -32, 2.5, 3, 0.85],
  // Europe
  [10, 50, 8, 4, 1], [2, 47, 4, 3.5, 1], [-4, 40, 4, 2.8, 1], [-2, 53.5, 1.8, 3.2, 0.9],
  [-8, 53.2, 1.3, 1.3, 0.8], [12, 62, 4.5, 5, 0.9], [26, 64, 4, 3.5, 0.9], [12.5, 43, 1.8, 2.5, 0.85],
  [16, 40, 1.6, 2, 0.8], [22, 42, 3.5, 2.5, 0.9], [23, 38, 1.8, 1.4, 0.75], [33, 39, 6, 2.2, 0.95],
  [35, 51, 10, 6, 1], [48, 58, 10, 6, 1], [-19, 65, 2.3, 1.3, 0.75], [20, 53, 5, 2.5, 0.95],
  // Africa
  [5, 26, 13, 6, 1], [24, 25, 8, 6, 1], [33, 15, 6, 6, 1], [-8, 15, 6, 5, 1], [6, 9, 7, 3.5, 1],
  [20, 3, 8, 6, 1], [36, 1, 5, 6, 1], [44, 7, 4, 3, 0.9], [22, -14, 7, 6, 1], [27, -26, 5, 5, 1],
  [35, -16, 3, 5, 0.9], [46.8, -19, 1.4, 3.5, 0.85], [-8, 30, 3, 3, 0.9],
  // Asia
  [60, 62, 12, 7, 1], [95, 63, 18, 8, 1], [130, 62, 12, 7, 1], [160, 65, 9, 4.5, 0.9],
  [158, 56, 2.5, 4, 0.8], [100, 74, 10, 2.5, 0.7], [68, 48, 12, 5, 1], [88, 43, 11, 5, 1],
  [105, 46, 9, 4, 1], [86, 32, 9, 4, 1], [108, 32, 9, 7, 1], [124, 45, 6, 5, 0.95],
  [127.5, 37, 1.3, 2, 0.8], [137, 36, 2.5, 3, 0.85], [142.5, 43.5, 1.5, 1.3, 0.75],
  [78, 21, 5.5, 6.5, 1], [80, 29, 6, 3, 1], [70, 30, 4, 4, 1], [65, 34, 4, 3, 1], [54, 32, 6, 4, 1],
  [45, 23, 6, 5, 1], [43, 33, 3.5, 3, 1], [100, 18, 4, 5, 0.95], [106, 14, 2.5, 4, 0.9],
  [101.5, 4.5, 1.3, 3, 0.8], [101, -0.5, 4.5, 2.5, 0.8], [114, 0.5, 3.5, 2.8, 0.85],
  [110, -7.3, 4.5, 1, 0.75], [121, -1.5, 1.5, 2.5, 0.65], [122.5, 12, 1.6, 3.5, 0.7],
  [140, -5, 6, 2.5, 0.9], [80.7, 7.7, 0.8, 1.2, 0.6], [121, 23.7, 0.8, 1.4, 0.6],
  // Oceania
  [134, -23, 11, 7, 1], [145, -32, 5, 5, 1], [118, -28, 5, 5, 0.95], [146.5, -42, 1.3, 1, 0.7],
  [175, -39, 1.5, 2, 0.75], [170, -44.5, 1.8, 2, 0.75],
]

// Inland and marginal seas, carved back out of the union.
const SEA: readonly Blob[] = [
  [-86, 59, 4.5, 3.8, 1], [-90, 25, 5.5, 3, 1], [-63, 71, 4, 4, 0.8], [-83, 46, 3, 1.5, 0.5],
  [4, 38.5, 5, 2.2, 1], [18, 35, 6, 2, 1], [28, 34, 4.5, 1.6, 0.9], [16, 43, 1.8, 1, 0.7],
  [34, 43.3, 3.5, 1.5, 0.9], [51, 41.5, 1.8, 3.2, 0.9], [19, 58, 2.2, 3.5, 0.85], [3, 56, 3.5, 2.5, 0.8],
  [21, 62, 1.5, 3, 0.6], [38, 20, 1, 5, 0.9], [48, 12.3, 3.5, 1, 0.7], [4, 2, 6, 3, 0.9],
  [88, 15, 3.5, 4, 0.9], [64, 16, 6, 5, 0.9], [51, 27, 2.5, 1.2, 0.8], [113, 13, 4, 5, 0.9],
  [149, 54, 4, 4, 0.9], [135, 41, 3, 3, 0.7], [124, 36, 2, 2.5, 0.7], [140, -14, 2.5, 2.5, 0.8],
]

function blob(lon: number, lat: number, b: Blob): number {
  const dLat = (lat - b[1]) / b[3]
  if (dLat > 4 || dLat < -4) return 0
  let dLon = lon - b[0]
  dLon -= 360 * Math.round(dLon / 360)
  const q = (dLon / b[2]) ** 2 + dLat * dLat
  return q > 16 ? 0 : b[4] * Math.exp(-0.5 * q)
}

/** How much a point is land: 0 (open ocean) to 1 (interior). Degrees in, deterministic out. */
export function landness(lon: number, lat: number, seed: number = WORLD_SEED): number {
  let water = 1
  for (const b of LAND) water *= 1 - blob(lon, lat, b)
  let d = 1 - water
  for (const b of SEA) d -= blob(lon, lat, b)
  // Two octaves of seeded noise make the edges ragged and organic.
  const n = 0.65 * noise2(lon / 7, lat / 7, seed) + 0.35 * noise2(lon / 3, lat / 3, seed + 1)
  return smoothstep(0.38, 0.62, d + 0.3 * (n - 0.5))
}

/** The map is centred here: Europe and Africa sit mid-screen on a phone. */
const LON0 = 12
const LAT0 = 14
/** Probability of a dot over open ocean and over land. */
const OCEAN_DENSITY = 0.07
const LAND_DENSITY = 0.94
/** Share of dots that glint now and then. */
const GLINT_SHARE = 0.045

export interface DotField {
  /** CSS-pixel box the field was built for. */
  width: number
  height: number
  /** Lattice pitch, origin of cell (0, 0) and grid size, in CSS px. */
  spacing: number
  ox: number
  oy: number
  cols: number
  rows: number
  /** Map projection: pixels per degree and the pixel the map centre sits on. */
  pxPerDeg: number
  cx: number
  cy: number
  /** Per cell (row * cols + col): 0 = no dot, otherwise its resting brightness (0, 1]. */
  level: Float32Array
  /** Per cell: 1 when the dot sits on land. */
  land: Uint8Array
  /** Cells that glint, each with a phase (0-1) and a period spread (0-1). */
  glints: Uint32Array
  glintPhase: Float32Array
  glintRate: Float32Array
}

/**
 * Map scale and anchor for a CSS box. Landscape shows up to 300 degrees of
 * longitude; phone-shaped portrait (height >= 1.4 x width) shows 120 and
 * depends on the width alone; in between it blends, continuously.
 */
export function fieldProjection(w: number, h: number): { pxPerDeg: number; cx: number; cy: number } {
  const aspect = h / w
  const span =
    aspect <= 1 ? Math.min(300, 190 / aspect) : aspect >= 1.4 ? 120 : 190 - ((aspect - 1) / 0.4) * 70
  return { pxPerDeg: w / span, cx: Math.round(w / 2), cy: Math.round(Math.min(h / 2, 0.7 * w)) }
}

/**
 * Lay the world out for a CSS box. On a phone in portrait the projection,
 * pitch and lattice depend on the width alone, so a URL bar collapsing only
 * reveals rows at the bottom; it never shifts or reshuffles the dots.
 */
export function buildDotField(width: number, height: number, seed: number = WORLD_SEED): DotField {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  const spacing = Math.min(16, Math.max(11, Math.round(Math.min(w, h) / 34)))
  const { pxPerDeg, cx, cy } = fieldProjection(w, h)
  // Lattice anchored on (cx, cy) so cell identities survive edge growth.
  const c0 = -Math.floor(cx / spacing)
  const r0 = -Math.floor(cy / spacing)
  const cols = Math.floor((w - 1 - cx) / spacing) - c0 + 1
  const rows = Math.floor((h - 1 - cy) / spacing) - r0 + 1
  const ox = cx + c0 * spacing
  const oy = cy + r0 * spacing

  const level = new Float32Array(cols * rows)
  const land = new Uint8Array(cols * rows)
  const glints: number[] = []
  const glintPhase: number[] = []
  const glintRate: number[] = []

  for (let row = 0; row < rows; row++) {
    const gy = r0 + row
    const lat = LAT0 - (oy + row * spacing - cy) / pxPerDeg
    for (let col = 0; col < cols; col++) {
      const gx = c0 + col
      const lon = LON0 + (ox + col * spacing - cx) / pxPerDeg
      const l = landness(lon, lat, seed)
      if (hash2(gx, gy, seed) >= OCEAN_DENSITY + (LAND_DENSITY - OCEAN_DENSITY) * l) continue
      const i = row * cols + col
      level[i] = 0.42 + 0.58 * l * (0.8 + 0.2 * hash2(gx, gy, seed ^ 0x9e37))
      land[i] = l >= 0.5 ? 1 : 0
      if (hash2(gx, gy, seed ^ 0x51ed) < GLINT_SHARE) {
        glints.push(i)
        glintPhase.push(hash2(gx, gy, seed ^ 0x2545))
        glintRate.push(hash2(gx, gy, seed ^ 0x7f4a))
      }
    }
  }

  return {
    width: w,
    height: h,
    spacing,
    ox,
    oy,
    cols,
    rows,
    pxPerDeg,
    cx,
    cy,
    level,
    land,
    glints: Uint32Array.from(glints),
    glintPhase: Float32Array.from(glintPhase),
    glintRate: Float32Array.from(glintRate),
  }
}

/** Where a longitude/latitude lands in a field's CSS box. */
export function project(field: DotField, lon: number, lat: number): { x: number; y: number } {
  return { x: field.cx + (lon - LON0) * field.pxPerDeg, y: field.cy - (lat - LAT0) * field.pxPerDeg }
}

/**
 * Every slow period in the field, as multiples of the ambient unit (--dur-5).
 * At 1200 ms the breath is 8.4 s and the drift 20-44 s: slow enough that you
 * only notice it when it stops.
 */
export const PERIODS = { breath: 7, driftX: 23, driftY: 17, sway: 37, glint: 5, glintSpread: 4 } as const

export interface AmbientPose {
  /** Focal point, as fractions of the box. */
  x: number
  y: number
  /** Glow swell, 0 to 1. */
  breath: number
}

/** The single frame shown under reduced motion (or with no ambient unit). */
export const STATIC_POSE: AmbientPose = { x: 0.5, y: 0.42, breath: 0.5 }

/** Focal point and breath at an ambient clock time (ms) for a given unit (ms). */
export function ambientPose(clockMs: number, unitMs: number): AmbientPose {
  if (!(unitMs > 0)) return STATIC_POSE
  const u = clockMs / unitMs
  return {
    x: 0.5 + 0.2 * Math.sin((TAU * u) / PERIODS.driftX) + 0.07 * Math.sin((TAU * u) / PERIODS.sway + 1.3),
    y: 0.42 + 0.12 * Math.sin((TAU * u) / PERIODS.driftY + 0.7),
    breath: 0.5 - 0.5 * Math.cos((TAU * u) / PERIODS.breath),
  }
}

/** A glint's brightness (0 to 1): dark most of the time, a soft swell every 6-11 s. */
export function glintLevel(clockMs: number, unitMs: number, phase: number, rate: number): number {
  if (!(unitMs > 0)) return 0
  const period = (PERIODS.glint + PERIODS.glintSpread * clamp01(rate)) * unitMs
  const wave = 0.5 + 0.5 * Math.sin(TAU * (clockMs / period + phase))
  return wave ** 8
}
