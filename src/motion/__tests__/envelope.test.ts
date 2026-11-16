import { describe, expect, it } from 'vitest'
import { barScale, rampAt, restLevel, speechEnergy, voicedLevel, voicedPose } from '../envelope.ts'
import { cubicBezier } from '../tokens.ts'

const RATE = 1000 // samples per second
const SECONDS = 30
const energy = Array.from({ length: RATE * SECONDS }, (_, i) => speechEnergy(i / RATE))

describe('speechEnergy: a synthetic voice', () => {
  it('is deterministic and bounded', () => {
    expect(speechEnergy(1.234)).toBe(speechEnergy(1.234))
    expect(Math.min(...energy)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...energy)).toBeLessThanOrEqual(1)
  })

  it('pulses at a syllabic rate (3-7 peaks per second)', () => {
    let peaks = 0
    for (let i = 1; i < energy.length - 1; i++) {
      const e = energy[i] ?? 0
      if (e > 0.15 && e >= (energy[i - 1] ?? 0) && e > (energy[i + 1] ?? 0)) peaks++
    }
    const rate = peaks / SECONDS
    expect(rate).toBeGreaterThan(3)
    expect(rate).toBeLessThan(7)
  })

  it('has occasional near-silences, like speech and unlike an equaliser', () => {
    const win = RATE / 10 // 100 ms windows
    let quiet = 0
    let windows = 0
    for (let i = 0; i + win <= energy.length; i += win) {
      windows++
      if (Math.max(...energy.slice(i, i + win)) < 0.08) quiet++
    }
    const share = quiet / windows
    expect(share).toBeGreaterThan(0.04)
    expect(share).toBeLessThan(0.35)
  })

  it('never jumps between frames', () => {
    let worst = 0
    for (let i = 1; i < energy.length; i++) worst = Math.max(worst, Math.abs((energy[i] ?? 0) - (energy[i - 1] ?? 0)))
    expect(worst).toBeLessThan(0.06) // per ms
  })
})

describe('bars', () => {
  const n = 24

  it('rest pose is low and still; voiced stays within [rest, 1]', () => {
    for (let i = 0; i < n; i++) {
      const rest = restLevel(i, n)
      expect(rest).toBeGreaterThan(0.05)
      expect(rest).toBeLessThan(0.2)
      for (let t = 0; t < 5; t += 0.037) {
        const v = voicedLevel(i, n, t)
        expect(v).toBeGreaterThanOrEqual(rest)
        expect(v).toBeLessThanOrEqual(1)
      }
    }
  })

  it('gain 0 shows exactly the rest pose (what React renders)', () => {
    for (let i = 0; i < n; i++) expect(barScale(i, n, 3.21, 0)).toBe(restLevel(i, n))
  })

  it('neighbouring bars move together, the way one voice would', () => {
    const a: number[] = []
    const b: number[] = []
    for (let t = 0; t < 10; t += 0.01) {
      a.push(voicedLevel(11, n, t))
      b.push(voicedLevel(12, n, t))
    }
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
    const ma = mean(a)
    const mb = mean(b)
    let cov = 0
    let va = 0
    let vb = 0
    a.forEach((x, k) => {
      const y = b[k] ?? 0
      cov += (x - ma) * (y - mb)
      va += (x - ma) ** 2
      vb += (y - mb) ** 2
    })
    expect(cov / Math.sqrt(va * vb)).toBeGreaterThan(0.6)
  })

  it('the reduced-motion pose is still, above rest and below full', () => {
    for (let i = 0; i < n; i++) {
      expect(voicedPose(i, n)).toBe(voicedPose(i, n))
      expect(voicedPose(i, n)).toBeGreaterThan(restLevel(i, n))
      expect(voicedPose(i, n)).toBeLessThan(1)
    }
  })
})

describe('rampAt: attack and release', () => {
  const settle = cubicBezier(0.22, 1, 0.36, 1)

  it('rises over the attack and lands exactly on the target', () => {
    const r = { from: 0, to: 1, start: 1000, duration: 120 }
    expect(rampAt(r, 1000, settle)).toBe(0)
    expect(rampAt(r, 1060, settle)).toBeGreaterThan(0.5)
    expect(rampAt(r, 1120, settle)).toBe(1)
    expect(rampAt(r, 5000, settle)).toBe(1)
  })

  it('a stop mid-attack decays from where the gain was', () => {
    expect(rampAt({ from: 0.4, to: 0, start: 0, duration: 380 }, 0, settle)).toBe(0.4)
  })

  it('zeroed durations (reduced-motion tokens) switch instantly', () => {
    expect(rampAt({ from: 0, to: 1, start: 0, duration: 0 }, 0, settle)).toBe(1)
  })
})
