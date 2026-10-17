import { useEffect, useRef } from 'react'

/**
 * Global keydown handler keyed by `event.key` (lower-cased). Ignores repeats
 * and modified keys. Enter/Space are skipped when a control is focused so a
 * focused button's own click isn't triggered twice.
 */
export function useHotkeys(bindings: Record<string, () => void>): void {
  const ref = useRef(bindings)
  useEffect(() => {
    ref.current = bindings
  })

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return
      const key = e.key.toLowerCase()
      const handler = ref.current[key]
      if (!handler) return
      const target = e.target instanceof Element ? e.target : null
      if ((key === 'enter' || key === ' ') && target?.closest('button, a, input, select, textarea')) {
        return
      }
      e.preventDefault()
      handler()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
