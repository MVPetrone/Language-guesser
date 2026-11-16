import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountAmbientField } from '../ambientRenderer.ts'

/**
 * The controller's perf guards, with the browser APIs it touches stubbed:
 * rAF, both observers, visibilitychange and a recording 2-D context.
 */
const TOKENS: Record<string, string> = {
  '--fog-400': '#6b7688',
  '--caliber-500': '#57e3c9',
  '--dur-5': '1200ms',
}

let rafQueue: Map<number, (t: number) => void>
let rafSeq: number
let docListeners: Map<string, Set<() => void>>
let ro: { cb: (e: { contentRect: { width: number; height: number } }[]) => void; disconnected: boolean }[]
let io: { cb: (e: { isIntersecting: boolean }[]) => void; disconnected: boolean }[]
let draws: number
let visibility: 'visible' | 'hidden'

function fakeCanvas() {
  const ctx = {
    canvas: null as unknown,
    setTransform() {},
    clearRect() {
      draws++
    },
    drawImage() {},
    fillRect() {},
    beginPath() {},
    arc() {},
    fill() {},
    createRadialGradient: () => ({ addColorStop() {} }),
    globalAlpha: 1,
    fillStyle: '',
  }
  const canvas = { width: 300, height: 150, getContext: () => ctx, getBoundingClientRect: () => ({ width: 0, height: 0 }) }
  ctx.canvas = canvas
  return canvas
}

/** Run every queued frame once at time `t`. */
function flushFrames(t: number) {
  const due = [...rafQueue.values()]
  rafQueue.clear()
  due.forEach((cb) => cb(t))
}

beforeEach(() => {
  rafQueue = new Map()
  rafSeq = 0
  docListeners = new Map()
  ro = []
  io = []
  draws = 0
  visibility = 'visible'
  vi.stubGlobal('window', { devicePixelRatio: 3 })
  vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: (n: string) => TOKENS[n] ?? '' }))
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
    rafQueue.set(++rafSeq, cb)
    return rafSeq
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => rafQueue.delete(id))
  vi.stubGlobal('document', {
    get visibilityState() {
      return visibility
    },
    createElement: () => fakeCanvas(),
    addEventListener: (type: string, fn: () => void) => {
      if (!docListeners.has(type)) docListeners.set(type, new Set())
      docListeners.get(type)?.add(fn)
    },
    removeEventListener: (type: string, fn: () => void) => docListeners.get(type)?.delete(fn),
  })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      entry: (typeof ro)[number]
      constructor(cb: (typeof ro)[number]['cb']) {
        this.entry = { cb, disconnected: false }
        ro.push(this.entry)
      }
      observe() {}
      disconnect() {
        this.entry.disconnected = true
      }
    },
  )
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      entry: (typeof io)[number]
      constructor(cb: (typeof io)[number]['cb']) {
        this.entry = { cb, disconnected: false }
        io.push(this.entry)
      }
      observe() {}
      disconnect() {
        this.entry.disconnected = true
      }
    },
  )
})

afterEach(() => vi.unstubAllGlobals())

function mount(reduced: boolean, intensity = 0.5) {
  const canvas = fakeCanvas()
  const controller = mountAmbientField(canvas as unknown as HTMLCanvasElement, { reduced, intensity })
  ro[0]?.cb([{ contentRect: { width: 390, height: 844 } }])
  return { canvas, controller }
}

describe('AmbientField controller', () => {
  it('sizes the backing store to the CSS box with DPR capped at 2', () => {
    const { canvas } = mount(false)
    expect([canvas.width, canvas.height]).toEqual([780, 1688])
  })

  it('reduced motion: exactly one still frame, no loop, repaints on resize only', () => {
    mount(true)
    expect(draws).toBe(1)
    expect(rafQueue.size).toBe(0)
    ro[0]?.cb([{ contentRect: { width: 400, height: 844 } }])
    expect(draws).toBe(2)
    expect(rafQueue.size).toBe(0)
  })

  it('caps the loop at 30 fps', () => {
    mount(false)
    const start = draws
    for (let f = 0; f <= 60; f++) flushFrames(f * (1000 / 60)) // one second at 60 Hz
    expect(draws - start).toBeGreaterThanOrEqual(29)
    expect(draws - start).toBeLessThanOrEqual(30)
  })

  it('pauses while the page is hidden or the canvas is off screen, then resumes', () => {
    mount(false)
    expect(rafQueue.size).toBe(1)
    visibility = 'hidden'
    docListeners.get('visibilitychange')?.forEach((fn) => fn())
    expect(rafQueue.size).toBe(0)
    visibility = 'visible'
    docListeners.get('visibilitychange')?.forEach((fn) => fn())
    expect(rafQueue.size).toBe(1)
    io[0]?.cb([{ isIntersecting: false }])
    expect(rafQueue.size).toBe(0)
    io[0]?.cb([{ isIntersecting: true }])
    expect(rafQueue.size).toBe(1)
  })

  it('intensity 0 stops the loop and clears the field', () => {
    const { controller } = mount(false)
    controller.setIntensity(0)
    expect(rafQueue.size).toBe(0)
  })

  it('destroy (StrictMode unmount) cancels the frame, observers and listener', () => {
    const { controller } = mount(false)
    controller.destroy()
    expect(rafQueue.size).toBe(0)
    expect(ro[0]?.disconnected).toBe(true)
    expect(io[0]?.disconnected).toBe(true)
    expect(docListeners.get('visibilitychange')?.size).toBe(0)
  })
})
