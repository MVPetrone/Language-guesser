/**
 * prefers-reduced-motion as an external store for useSyncExternalStore. Kept
 * apart from the hook so it can be tested without a renderer. SSR-safe: with
 * no window (or no matchMedia) there is no preference to honour.
 */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function mediaQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia(REDUCED_MOTION_QUERY)
}

const noop = () => {}

export function subscribeReducedMotion(onChange: () => void): () => void {
  const mql = mediaQuery()
  if (!mql) return noop
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

export function getReducedMotion(): boolean {
  return mediaQuery()?.matches ?? false
}

export function getServerReducedMotion(): boolean {
  return false
}
