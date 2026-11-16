import type { JSX, ReactNode } from 'react'
import styles from './ScreenTransition.module.css'
import { useReducedMotion } from './useReducedMotion.ts'

export interface ScreenTransitionProps {
  /** Identity of the current screen; a new key mounts a new, entering screen. */
  screenKey: string
  children: ReactNode
}

/**
 * Cross-fade plus an 8 px settle for the incoming screen, as a CSS animation on
 * a keyed wrapper. The old screen unmounts at once (no exit to wait for) and
 * the new one takes input from frame 0. Reduced motion: no animation at all.
 */
export function ScreenTransition({ screenKey, children }: ScreenTransitionProps): JSX.Element {
  const reduced = useReducedMotion()
  return (
    <div key={screenKey} className={reduced ? undefined : styles.enter}>
      {children}
    </div>
  )
}
