/**
 * Seeded, stateless randomness for motion. Every "random" choice in src/motion
 * is a pure function of (index, seed), so the world layout and the voice
 * envelope are identical in every session and every rendered frame. Nothing
 * here calls Math.random().
 */

/** lowbias32 integer finaliser (C. Wellons): a strong 32-bit mix. */
function mix(x: number): number {
  x ^= x >>> 16
  x = Math.imul(x, 0x7feb352d)
  x ^= x >>> 15
  x = Math.imul(x, 0x846ca68b)
  x ^= x >>> 16
  return x >>> 0
}

const UINT = 4294967296

/** Hash of an integer and a seed, in [0, 1). */
export function hash(n: number, seed: number): number {
  return mix((n | 0) ^ mix(seed | 0)) / UINT
}

/** Hash of an integer lattice point and a seed, in [0, 1). */
export function hash2(x: number, y: number, seed: number): number {
  return mix(Math.imul(x | 0, 0x27d4eb2d) ^ mix((y | 0) ^ mix(seed | 0))) / UINT
}

const fade = (f: number) => f * f * (3 - 2 * f)

/** 1-D value noise in [0, 1): a seeded random walk, smooth (C1) in x. */
export function noise(x: number, seed: number): number {
  const i = Math.floor(x)
  const a = hash(i, seed)
  return a + (hash(i + 1, seed) - a) * fade(x - i)
}

/** 2-D value noise in [0, 1). */
export function noise2(x: number, y: number, seed: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const u = fade(x - xi)
  const v = fade(y - yi)
  const a = hash2(xi, yi, seed)
  const b = hash2(xi + 1, yi, seed)
  const c = hash2(xi, yi + 1, seed)
  const d = hash2(xi + 1, yi + 1, seed)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}
