import { useEffect, useMemo, useRef, type CSSProperties, type JSX } from 'react'
import { barScale, rampAt, restLevel, voicedPose, type Ramp } from './envelope.ts'
import { linear, parseDuration, parseEasing, readToken } from './tokens.ts'
import { useReducedMotion } from './useReducedMotion.ts'
import styles from './WaveformLive.module.css'

export interface WaveformLiveProps {
  /** Whether the clip is audible right now (wire it to useAudio().isPlaying). */
  playing: boolean
  /** Number of bars. Default 24. */
  bars?: number
  /** Height in px. Default 48. */
  height?: number
}

type StyleVars = CSSProperties & Record<`--${string}`, string>

/**
 * The voice made visible. While `playing`, the bars speak; when it stops they
 * settle to a low resting pose and the loop ends. Driven by a synthetic
 * envelope, never by the audio element (MOTION.md, "The WebAudio trap").
 * Transforms only, one rAF for all bars. Decorative, so aria-hidden.
 */
export function WaveformLive({ playing, bars = 24, height = 48 }: WaveformLiveProps): JSX.Element {
  const reduced = useReducedMotion()
  const count = Math.max(1, Math.round(bars))
  const rootRef = useRef<HTMLDivElement>(null)
  /** The gain the bars last showed, so a toggle mid-ramp continues from there. */
  const gainRef = useRef(0)

  // The pose React renders. The loop below takes over while it runs, and it
  // always comes to rest on exactly these values, so the two never disagree.
  const pose = useMemo(
    () =>
      Array.from({ length: count }, (_, i) =>
        reduced && playing ? voicedPose(i, count) : restLevel(i, count),
      ),
    [count, reduced, playing],
  )

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (reduced) {
      // Still poses only: React already rendered the right one.
      gainRef.current = playing ? 1 : 0
      return
    }
    const target = playing ? 1 : 0
    if (gainRef.current === 0 && target === 0) return // resting already

    const els = Array.from(root.querySelectorAll<HTMLSpanElement>(':scope > span'))
    const n = els.length
    // Attack on --dur-1, release on --dur-3, both on the house curve.
    const attack = parseDuration(readToken(root, '--dur-1')) ?? 0
    const release = parseDuration(readToken(root, '--dur-3')) ?? 0
    const ease = parseEasing(readToken(root, '--ease-settle')) ?? linear
    const ramp: Ramp = {
      from: gainRef.current,
      to: target,
      start: performance.now(),
      duration: playing ? attack : release,
    }

    let raf = 0
    const frame = (now: number) => {
      const gain = rampAt(ramp, now, ease)
      gainRef.current = gain
      const t = now / 1000
      els.forEach((el, i) => {
        el.style.transform = `scaleY(${barScale(i, n, t, gain).toFixed(4)})`
      })
      if (target === 0 && gain <= 0) return // back at rest: the loop ends
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [playing, reduced, count])

  const barWidth = Math.max(2, Math.round(height / 16))
  const style: StyleVars = { height: `${height}px`, '--bar-w': `${barWidth}px` }

  return (
    <div
      ref={rootRef}
      className={styles.wave}
      style={style}
      data-playing={playing || undefined}
      aria-hidden="true"
    >
      {pose.map((scale, i) => (
        <span key={i} className={styles.bar} style={{ transform: `scaleY(${scale.toFixed(4)})` }} />
      ))}
    </div>
  )
}
