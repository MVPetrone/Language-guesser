/**
 * Bridge from the frozen design tokens (src/styles/tokens.css) to code that
 * cannot use var(): canvas drawing and rAF loops. Values are read from the live
 * cascade, so the reduced-motion block in tokens.css (every --dur-* becomes
 * 0ms) reaches JS-driven motion as well as CSS.
 */

export type Easing = (x: number) => number

export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

/** A custom property resolved on `el` (inherited from :root); '' when unset. */
export function readToken(el: Element, name: `--${string}`): string {
  return getComputedStyle(el).getPropertyValue(name).trim()
}

/** A CSS <time> ('120ms', '0.62s') in milliseconds, or null if it is not one. */
export function parseDuration(value: string): number | null {
  const match = /^(-?(?:\d+\.?\d*|\.\d+))(ms|s)$/i.exec(value.trim())
  if (!match) return null
  const n = Number(match[1])
  return match[2]?.toLowerCase() === 's' ? n * 1000 : n
}

export const linear: Easing = (x) => x

/**
 * The CSS cubic-bezier() timing function. Solves x(t) = x by Newton steps with
 * a bisection fallback, the same approach browsers use, so a JS-driven ramp
 * and a CSS transition on the same token follow the same curve.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx

  const solve = (x: number) => {
    let t = x
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x
      if (Math.abs(err) < 1e-7) return t
      const slope = slopeX(t)
      if (Math.abs(slope) < 1e-7) break
      t -= err / slope
    }
    let lo = 0
    let hi = 1
    t = x
    for (let i = 0; i < 40; i++) {
      const v = sampleX(t)
      if (Math.abs(v - x) < 1e-7) break
      if (v < x) lo = t
      else hi = t
      t = (lo + hi) / 2
    }
    return t
  }

  return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : sampleY(solve(x)))
}

/** 'cubic-bezier(0.22, 1, 0.36, 1)' or 'linear' as an easing; null otherwise. */
export function parseEasing(value: string): Easing | null {
  const v = value.trim()
  if (v === 'linear') return linear
  const match = /^cubic-bezier\(([^)]*)\)$/i.exec(v)
  if (!match) return null
  const parts = (match[1] ?? '').split(',').map((p) => Number(p.trim()))
  if (parts.length !== 4 || !parts.every(Number.isFinite)) return null
  const [x1 = 0, y1 = 0, x2 = 1, y2 = 1] = parts
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) return null
  return cubicBezier(x1, y1, x2, y2)
}

/**
 * '#57e3c9', '#5ec', '#57e3c9cc', 'rgb(87, 227, 201)', 'rgba(87,227,201,0.2)'
 * or 'rgb(87 227 201 / 20%)' as channels (0-255, alpha 0-1); null otherwise.
 */
export function parseColor(value: string): Rgba | null {
  const v = value.trim().toLowerCase()
  const hex = /^#([0-9a-f]{3,8})$/.exec(v)?.[1]
  if (hex) {
    const full = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex
    if (full.length !== 6 && full.length !== 8) return null
    const ch = (i: number) => parseInt(full.slice(i, i + 2), 16)
    return { r: ch(0), g: ch(2), b: ch(4), a: full.length === 8 ? ch(6) / 255 : 1 }
  }
  const fn = /^rgba?\(([^)]*)\)$/.exec(v)?.[1]
  if (fn === undefined) return null
  const parts = fn.split(/[\s,/]+/).filter(Boolean)
  if (parts.length !== 3 && parts.length !== 4) return null
  const [r, g, b, a] = parts.map((p, i) =>
    p.endsWith('%') ? (Number(p.slice(0, -1)) / 100) * (i < 3 ? 255 : 1) : Number(p),
  )
  if (r === undefined || g === undefined || b === undefined) return null
  const alpha = a ?? 1
  if (![r, g, b, alpha].every(Number.isFinite)) return null
  return { r, g, b, a: alpha }
}

/** A canvas-ready rgba() string for a parsed token colour at `alpha`. */
export function rgbaString(c: Rgba, alpha: number = c.a): string {
  const a = Math.min(1, Math.max(0, alpha))
  return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${+a.toFixed(4)})`
}
