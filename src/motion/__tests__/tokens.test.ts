/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cubicBezier, parseColor, parseDuration, parseEasing, rgbaString } from '../tokens.ts'

const tokensCss = readFileSync(new URL('../../styles/tokens.css', import.meta.url), 'utf8')

/** The raw values the frozen token file declares, by name (first :root block). */
function declared(prefix: string): Map<string, string> {
  const root = tokensCss.split('@media')[0] ?? ''
  const out = new Map<string, string>()
  for (const m of root.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    if (m[1]?.startsWith(prefix) && m[2]) out.set(m[1], m[2].trim())
  }
  return out
}

describe('the token bridge reads every token motion uses', () => {
  it('parses every --dur-* and the reduced-motion 0ms', () => {
    const durs = declared('--dur-')
    expect(durs.size).toBeGreaterThan(0)
    for (const v of durs.values()) expect(parseDuration(v)).toBeGreaterThan(0)
    expect(parseDuration(declared('--stagger').get('--stagger') ?? '')).toBe(40)
    expect(parseDuration('0ms')).toBe(0)
    expect(parseDuration('0.62s')).toBe(620)
    expect(parseDuration('fast')).toBeNull()
    expect(parseDuration('120')).toBeNull()
  })

  it('parses every --ease-* into a curve pinned at 0 and 1', () => {
    const eases = declared('--ease-')
    expect(eases.size).toBe(3)
    for (const v of eases.values()) {
      const ease = parseEasing(v)
      expect(ease).not.toBeNull()
      expect(ease?.(0)).toBe(0)
      expect(ease?.(1)).toBe(1)
    }
  })

  it('parses every colour token, hex and rgba alike', () => {
    for (const prefix of ['--ink-', '--fog-', '--signal-', '--caliber-']) {
      for (const v of declared(prefix).values()) expect(parseColor(v)).not.toBeNull()
    }
    const caliber = parseColor(declared('--caliber-').get('--caliber-500') ?? '')
    expect(caliber).toEqual({ r: 87, g: 227, b: 201, a: 1 })
    expect(parseColor(declared('--signal-').get('--signal-glow') ?? '')?.a).toBeCloseTo(0.22)
    expect(parseColor('rgb(87 227 201 / 50%)')?.a).toBe(0.5)
    expect(parseColor('papayawhip')).toBeNull()
    expect(rgbaString({ r: 87, g: 227, b: 201, a: 1 }, 0.5)).toBe('rgba(87, 227, 201, 0.5)')
  })
})

describe('cubicBezier', () => {
  it('matches the browser curve for CSS `ease`', () => {
    expect(cubicBezier(0.25, 0.1, 0.25, 1)(0.5)).toBeCloseTo(0.8024, 3)
  })

  it('makes --ease-settle front-loaded and monotonic', () => {
    const settle = parseEasing(declared('--ease-').get('--ease-settle') ?? '')
    expect(settle).not.toBeNull()
    if (!settle) return
    expect(settle(0.25)).toBeGreaterThan(0.7)
    let prev = 0
    for (let i = 1; i <= 200; i++) {
      const v = settle(i / 200)
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = v
    }
  })

  it('rejects curves CSS would reject', () => {
    expect(parseEasing('cubic-bezier(1.2, 0, 0, 1)')).toBeNull()
    expect(parseEasing('steps(4)')).toBeNull()
  })
})
