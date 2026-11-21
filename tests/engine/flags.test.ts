/// <reference types="vite/client" />
import { readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FLAG_ISO, flagSrc } from '../../src/data/flags.ts'
import { LANGUAGES } from '../../src/data/languages.ts'

const flagFile = (iso: string) => new URL(`../../public/flags/${iso}.svg`, import.meta.url)

describe('flag images', () => {
  it('maps every language to an ISO code', () => {
    for (const l of LANGUAGES) expect(FLAG_ISO[l.code], l.code).toMatch(/^[a-z]{2}(-[a-z]+)?$/)
    expect(Object.keys(FLAG_ISO).sort()).toEqual(LANGUAGES.map((l) => l.code).sort())
  })

  it('has a non-empty SVG on disk for every ISO code', () => {
    for (const iso of new Set(Object.values(FLAG_ISO))) {
      const file = flagFile(iso)
      expect(statSync(file).size, iso).toBeGreaterThan(0)
      expect(readFileSync(file).subarray(0, 200).toString('utf8'), iso).toContain('<svg')
    }
  })

  it('gives distinct ISO codes distinct file names', () => {
    // Several languages share a country (hi/ta/... -> "in"); that is one file.
    // What must not happen is two codes colliding on a case-insensitive disk.
    const isos = [...new Set(Object.values(FLAG_ISO))]
    expect(new Set(isos.map((iso) => iso.toLowerCase())).size).toBe(isos.length)
    expect(FLAG_ISO['cy-GB']).toBe('gb-wls')
  })

  it('resolves under the base path', () => {
    expect(flagSrc('ja-JP')).toBe(`${import.meta.env.BASE_URL}flags/jp.svg`)
  })
})
