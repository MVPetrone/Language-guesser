import { useState, type JSX, type ReactNode } from 'react'
import styles from './ScorePop.module.css'
import { useReducedMotion } from './useReducedMotion.ts'

export interface ScorePopProps {
  /** The score. Every change after the first render pops once. */
  value: number
  /** The rendered number, formatted however the caller likes. */
  children: ReactNode
}

/**
 * Springs the score when `value` changes: up to 1.12 on the house curve and
 * back, with a one-shot amber afterglow. Nothing moves on first mount, and
 * under reduced motion the number simply changes. tabular-nums keeps digits
 * the same width and the pop is a transform, so nothing around it reflows.
 */
export function ScorePop({ value, children }: ScorePopProps): JSX.Element {
  const reduced = useReducedMotion()
  // Count changes during render (React's "adjust state on prop change"
  // pattern), so the first paint after a change already carries the pop.
  const [seen, setSeen] = useState({ value, pops: 0 })
  const changed = !Object.is(seen.value, value)
  if (changed) setSeen({ value, pops: seen.pops + 1 })
  const pops = changed ? seen.pops + 1 : seen.pops
  const animate = pops > 0 && !reduced

  // Alternating between two identical keyframe names restarts the spring on
  // every change without remounting the children or forcing a reflow.
  const className = animate ? `${styles.root} ${pops % 2 ? styles.popOdd : styles.popEven}` : styles.root

  return (
    <span className={className}>
      {animate && <span key={pops} className={styles.glow} aria-hidden="true" />}
      <span className={styles.value}>{children}</span>
    </span>
  )
}
