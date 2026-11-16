/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  PERIODS,
  STATIC_POSE,
  WORLD_SEED,
  ambientPose,
  buildDotField,
  glintLevel,
  landness,
  project,
  type DotField,
} from '../dotField.ts'
import { parseDuration } from '../tokens.ts'

const tokensCss = readFileSync(new URL('../../styles/tokens.css', import.meta.url), 'utf8')
const unit = parseDuration(/--dur-5:\s*([^;]+);/.exec(tokensCss)?.[1] ?? '') ?? 0

/** Share of lattice cells holding a dot inside a lon/lat box. */
function density(f: DotField, lon0: number, lon1: number, lat0: number, lat1: number): number {
  const a = project(f, lon0, lat1)
  const b = project(f, lon1, lat0)
  let cells = 0
  let dots = 0
  for (let row = 0; row < f.rows; row++) {
    const y = f.oy + row * f.spacing
    if (y < a.y || y > b.y) continue
    for (let col = 0; col < f.cols; col++) {
      const x = f.ox + col * f.spacing
      if (x < a.x || x > b.x) continue
      cells++
      if ((f.level[row * f.cols + col] ?? 0) > 0) dots++
    }
  }
  return dots / cells
}

describe('buildDotField', () => {
  it('is deterministic: same box, same world, every session', () => {
    const a = buildDotField(390, 844)
    const b = buildDotField(390, 844)
    expect(a.level).toEqual(b.level)
    expect(a.glints).toEqual(b.glints)
  })

  it('the layout comes from the fixed seed', () => {
    const a = buildDotField(390, 844, WORLD_SEED)
    const b = buildDotField(390, 844, WORLD_SEED + 1)
    expect(a.level).not.toEqual(b.level)
  })

  it('reads as land and ocean: continents are dense, oceans sparse', () => {
    const f = buildDotField(1440, 900)
    const africa = density(f, 10, 30, -10, 10)
    const atlantic = density(f, -35, -15, -40, -20)
    const pacific = density(f, -135, -120, -30, -10)
    expect(africa).toBeGreaterThan(0.8)
    expect(atlantic).toBeLessThan(0.15)
    expect(pacific).toBeLessThan(0.15)
    expect(landness(20, 0)).toBeGreaterThan(0.9)
    expect(landness(-30, -30)).toBeLessThan(0.1)
  })

  it('a phone URL bar collapsing only adds rows; no dot moves or changes', () => {
    const short = buildDotField(390, 714)
    const tall = buildDotField(390, 844)
    expect([short.pxPerDeg, short.cx, short.cy, short.ox, short.oy, short.cols]).toEqual([
      tall.pxPerDeg,
      tall.cx,
      tall.cy,
      tall.ox,
      tall.oy,
      tall.cols,
    ])
    expect(tall.rows).toBeGreaterThan(short.rows)
    expect(tall.level.slice(0, short.level.length)).toEqual(short.level)
  })
})

describe('ambientPose', () => {
  it('reads its unit from --dur-5 and breathes with a period of at least 8 s', () => {
    expect(unit).toBe(1200)
    const period = PERIODS.breath * unit
    expect(period).toBeGreaterThanOrEqual(8000)
    for (const t of [0, 1234, 5678]) {
      expect(ambientPose(t + period, unit).breath).toBeCloseTo(ambientPose(t, unit).breath, 6)
    }
    expect(Math.abs(ambientPose(period / 2, unit).breath - ambientPose(0, unit).breath)).toBeGreaterThan(0.9)
  })

  it('keeps the focal point inside the box and moves it slowly', () => {
    let worst = 0
    for (let t = 0; t < 120_000; t += 100) {
      const p = ambientPose(t, unit)
      const q = ambientPose(t + 100, unit)
      expect(p.x).toBeGreaterThan(0.2)
      expect(p.x).toBeLessThan(0.8)
      expect(p.y).toBeGreaterThan(0.25)
      expect(p.y).toBeLessThan(0.6)
      worst = Math.max(worst, Math.hypot(q.x - p.x, q.y - p.y))
    }
    expect(worst).toBeLessThan(0.01) // under 1% of the box per 100 ms
  })

  it('reduced motion (no unit) is one still pose with no glints', () => {
    expect(ambientPose(98765, 0)).toBe(STATIC_POSE)
    expect(glintLevel(98765, 0, 0.3, 0.5)).toBe(0)
  })
})
