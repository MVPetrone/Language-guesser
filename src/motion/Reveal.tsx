import type { CSSProperties, JSX, ReactNode } from 'react'
import styles from './Reveal.module.css'
import { useReducedMotion } from './useReducedMotion.ts'

export interface RevealProps {
  children: ReactNode
  /** Start delay in ms (for lists: index x the --stagger token). Default 0. */
  delay?: number
  /** Rise distance in px. Default 12. */
  y?: number
}

type StyleVars = CSSProperties & Record<`--${string}`, string>

/**
 * Enter animation: fades in and rises `y` px over --dur-3 on --ease-settle.
 * Transform and opacity only (never height); nothing lingers after it ends.
 * Under reduced motion the children render immediately, unwrapped by motion.
 */
export function Reveal({ children, delay = 0, y = 12 }: RevealProps): JSX.Element {
  const reduced = useReducedMotion()
  if (reduced) return <div>{children}</div>
  const style: StyleVars = { '--reveal-delay': `${delay}ms`, '--reveal-y': `${y}px` }
  return (
    <div className={styles.reveal} style={style}>
      {children}
    </div>
  )
}
