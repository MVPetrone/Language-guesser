import { afterEach, describe, expect, it } from 'vitest'
import { HEARD_CAP, appendHeard, loadBestScore, loadHeard, saveHeard } from '../../src/storage.ts'

/** Installs a fake `window.localStorage` for one test. */
function fakeStorage(store: Map<string, string> | 'throws') {
  const localStorage =
    store === 'throws'
      ? {
          getItem: () => {
            throw new DOMException('denied', 'SecurityError')
          },
          setItem: () => {
            throw new DOMException('denied', 'SecurityError')
          },
        }
      : { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
  Object.defineProperty(globalThis, 'window', { value: { localStorage }, configurable: true })
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window')
})

describe('heard memory storage', () => {
  it('round-trips and caps the list, keeping the newest', () => {
    fakeStorage(new Map())
    const keys = Array.from({ length: HEARD_CAP + 50 }, (_, i) => `en-US|0|s${i}`)
    saveHeard(keys)
    const loaded = loadHeard()
    expect(loaded).toHaveLength(HEARD_CAP)
    expect(loaded.at(-1)).toBe(`en-US|0|s${HEARD_CAP + 49}`)
    expect(loaded[0]).toBe('en-US|0|s50')
  })

  it('appendHeard moves a repeat to the newest end and caps', () => {
    expect(appendHeard(['a', 'b', 'c'], 'a')).toEqual(['b', 'c', 'a'])
    const full = Array.from({ length: HEARD_CAP }, (_, i) => String(i))
    const next = appendHeard(full, 'new')
    expect(next).toHaveLength(HEARD_CAP)
    expect(next[0]).toBe('1')
    expect(next.at(-1)).toBe('new')
  })

  it('ignores corrupt stored values', () => {
    fakeStorage(new Map([['gtl:heard', '{not json']]))
    expect(loadHeard()).toEqual([])
    fakeStorage(new Map([['gtl:heard', '{"a":1}']]))
    expect(loadHeard()).toEqual([])
    fakeStorage(new Map([['gtl:heard', '["ok-key", 3, null]']]))
    expect(loadHeard()).toEqual(['ok-key'])
  })

  it('degrades to an empty memory when storage is disabled or missing', () => {
    fakeStorage('throws')
    expect(loadHeard()).toEqual([])
    expect(() => saveHeard(['x'])).not.toThrow()
    expect(loadBestScore()).toBeNull()
    Reflect.deleteProperty(globalThis, 'window')
    expect(loadHeard()).toEqual([])
    expect(() => saveHeard(['x'])).not.toThrow()
  })
})
