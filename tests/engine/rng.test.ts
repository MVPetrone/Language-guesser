import { describe, expect, it } from 'vitest'
import { mulberry32, randInt, seedFromString, shuffle } from '../../src/engine/rng.ts'

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const seqA = Array.from({ length: 20 }, () => a())
    const seqB = Array.from({ length: 20 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('differs across seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)())
  })

  it('stays within [0, 1)', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 10_000; i++) {
      const x = rng()
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })
})

describe('seedFromString', () => {
  it('is stable and returns an unsigned 32-bit integer', () => {
    const s = seedFromString('daily-2026-10-17')
    expect(s).toBe(seedFromString('daily-2026-10-17'))
    expect(Number.isInteger(s)).toBe(true)
    expect(s).toBeGreaterThanOrEqual(0)
    expect(s).toBeLessThan(2 ** 32)
  })

  it('distinguishes different strings', () => {
    expect(seedFromString('a')).not.toBe(seedFromString('b'))
  })
})

describe('randInt / shuffle', () => {
  it('randInt stays in range', () => {
    const rng = mulberry32(3)
    for (let i = 0; i < 1000; i++) {
      const n = randInt(rng, 4)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(4)
    }
  })

  it('shuffle is a permutation and does not mutate its input', () => {
    const input = [1, 2, 3, 4, 5, 6]
    const out = shuffle(mulberry32(9), input)
    expect(input).toEqual([1, 2, 3, 4, 5, 6])
    expect([...out].sort()).toEqual(input)
  })
})
