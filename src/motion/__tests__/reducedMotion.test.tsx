import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getReducedMotion, subscribeReducedMotion } from '../reducedMotionQuery.ts'

// Components read the preference through this hook; tests flip it here.
const prefers = vi.hoisted(() => ({ reduced: false }))
vi.mock('../useReducedMotion.ts', () => ({ useReducedMotion: () => prefers.reduced }))

const { Reveal } = await import('../Reveal.tsx')
const { ScreenTransition } = await import('../ScreenTransition.tsx')
const { ScorePop } = await import('../ScorePop.tsx')
const { WaveformLive } = await import('../WaveformLive.tsx')
const { AmbientField } = await import('../AmbientField.tsx')
const { restLevel, voicedPose } = await import('../envelope.ts')

afterEach(() => {
  prefers.reduced = false
  vi.unstubAllGlobals()
})

describe('reduced-motion store', () => {
  it('is SSR-safe: no window means no preference and a no-op subscription', () => {
    expect(typeof window).toBe('undefined')
    expect(getReducedMotion()).toBe(false)
    subscribeReducedMotion(() => {})()
  })

  it('reads matchMedia and follows its change events', () => {
    const listeners = new Set<() => void>()
    const mql = {
      matches: true,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    }
    const matchMedia = vi.fn(() => mql)
    vi.stubGlobal('window', { matchMedia })
    expect(getReducedMotion()).toBe(true)
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
    const onChange = vi.fn()
    const off = subscribeReducedMotion(onChange)
    listeners.forEach((fn) => fn())
    expect(onChange).toHaveBeenCalledTimes(1)
    off()
    expect(listeners.size).toBe(0)
  })
})

const html = (el: ReactElement) => renderToStaticMarkup(el)

describe('each component degrades to still under reduced motion', () => {
  it('Reveal: animated wrapper normally, plain children when reduced', () => {
    const moving = html(
      <Reveal delay={80} y={16}>
        hi
      </Reveal>,
    )
    expect(moving).toContain('class=')
    expect(moving).toContain('--reveal-delay:80ms')
    expect(moving).toContain('--reveal-y:16px')
    prefers.reduced = true
    expect(html(<Reveal delay={80}>hi</Reveal>)).toBe('<div>hi</div>')
  })

  it('ScreenTransition: entry class normally, none when reduced', () => {
    const screen = () => html(<ScreenTransition screenKey="a">x</ScreenTransition>)
    expect(screen()).toMatch(/^<div class="[^"]+">x<\/div>$/)
    prefers.reduced = true
    expect(screen()).toBe('<div>x</div>')
  })

  it('ScorePop: no pop and no glow on first mount', () => {
    const out = html(<ScorePop value={450}>450</ScorePop>)
    expect(out).not.toContain('aria-hidden')
    expect(out).toContain('>450<')
  })

  it('WaveformLive: rest pose when idle; a still speech pose when playing and reduced', () => {
    const scale = (v: number) => `scaleY(${v.toFixed(4)})`
    const idle = html(<WaveformLive playing={false} bars={4} />)
    expect(idle).toContain('aria-hidden="true"')
    expect(idle).toContain(scale(restLevel(0, 4)))
    expect(idle).not.toContain('data-playing')
    prefers.reduced = true
    const still = html(<WaveformLive playing bars={4} height={64} />)
    for (let i = 0; i < 4; i++) expect(still).toContain(scale(voicedPose(i, 4)))
    expect(still).toContain('height:64px')
  })

  it('AmbientField: an inert, hidden canvas', () => {
    expect(html(<AmbientField />)).toMatch(/^<canvas class="[^"]*" aria-hidden="true"><\/canvas>$/)
  })
})
