import { useCallback, useEffect, useRef, useState } from 'react'

export interface AudioControls {
  isPlaying: boolean
  /** Set when the clip failed to load or decode; the round should offer a skip. */
  error: string | null
  /** The browser refused to autoplay; the player has to tap play. Not an error. */
  needsTap: boolean
  replay: () => void
  setRate: (rate: number) => void
}

/**
 * Wraps a single HTMLAudioElement that is reused across rounds. Reusing one
 * element matters on Safari: once it has played after a user gesture, later
 * src swaps can play without another gesture.
 *
 * `src === null` stops playback (start / end screens). A new `src` is preloaded
 * and, when `autoPlay` is set, played as soon as it is assigned.
 */
export function useAudio(src: string | null, autoPlay = true): AudioControls {
  const elRef = useRef<HTMLAudioElement | null>(null)
  const srcRef = useRef<string | null>(null)
  const rateRef = useRef(1)
  const [isPlaying, setIsPlaying] = useState(false)
  // Error / tap prompts are tagged with the clip they belong to, so a new clip
  // starts clean without resetting state inside an effect.
  const [errorFor, setErrorFor] = useState<{ src: string; message: string } | null>(null)
  const [tapFor, setTapFor] = useState<string | null>(null)

  const fail = useCallback((message: string) => {
    const current = srcRef.current
    if (current !== null) setErrorFor({ src: current, message })
  }, [])

  const playEl = useCallback(
    (el: HTMLAudioElement) => {
      const current = srcRef.current
      el.currentTime = 0
      el.playbackRate = rateRef.current
      el.play().then(
        () => setTapFor(null),
        (err: unknown) => {
          const name = err instanceof DOMException ? err.name : ''
          if (name === 'NotAllowedError') setTapFor(current)
          // AbortError: a newer load() interrupted this play() — expected on fast skips.
          // NotSupportedError duplicates the element's own 'error' event.
          else if (name !== 'AbortError' && name !== 'NotSupportedError') {
            fail('This clip could not be played.')
          }
        },
      )
    },
    [fail],
  )

  // One element for the lifetime of the component.
  useEffect(() => {
    const el = new Audio()
    el.preload = 'auto'
    const onPlaying = () => setIsPlaying(true)
    const onStop = () => setIsPlaying(false)
    const onError = () => {
      // Clearing src (cleanup / src = null) also fires 'error'; ignore that.
      if (!el.getAttribute('src')) return
      setIsPlaying(false)
      fail('This clip could not be loaded.')
    }
    el.addEventListener('playing', onPlaying)
    el.addEventListener('pause', onStop)
    el.addEventListener('ended', onStop)
    el.addEventListener('error', onError)
    elRef.current = el
    return () => {
      el.pause()
      el.removeEventListener('playing', onPlaying)
      el.removeEventListener('pause', onStop)
      el.removeEventListener('ended', onStop)
      el.removeEventListener('error', onError)
      el.removeAttribute('src')
      el.load()
      elRef.current = null
    }
  }, [fail])

  useEffect(() => {
    const el = elRef.current
    srcRef.current = src
    if (!el) return
    // pause() / load() on a playing element fire 'pause', which clears isPlaying.
    el.pause()
    if (src === null) {
      el.removeAttribute('src')
      el.load()
      return
    }
    el.src = src
    el.defaultPlaybackRate = rateRef.current
    el.load()
    if (autoPlay) playEl(el)
  }, [src, autoPlay, playEl])

  const replay = useCallback(() => {
    const el = elRef.current
    if (el && el.getAttribute('src')) playEl(el)
  }, [playEl])

  const setRate = useCallback((rate: number) => {
    rateRef.current = rate
    const el = elRef.current
    if (!el) return
    // load() resets playbackRate to defaultPlaybackRate, so set both.
    el.defaultPlaybackRate = rate
    el.playbackRate = rate
  }, [])

  return {
    isPlaying: src !== null && isPlaying,
    error: src !== null && errorFor?.src === src ? errorFor.message : null,
    needsTap: src !== null && tapFor === src,
    replay,
    setRate,
  }
}
