import { useSyncExternalStore } from 'react'
import { getReducedMotion, getServerReducedMotion, subscribeReducedMotion } from './reducedMotionQuery.ts'

/**
 * true while the user asks for reduced motion. Read synchronously, so the very
 * first render is already right (no animated flash before an effect runs);
 * follows the OS setting live; false when rendered without a window.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotion, getServerReducedMotion)
}
