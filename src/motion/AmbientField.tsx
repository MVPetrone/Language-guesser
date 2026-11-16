import { useEffect, useRef, type JSX } from 'react'
import styles from './AmbientField.module.css'
import { mountAmbientField, type AmbientController } from './ambientRenderer.ts'
import { useReducedMotion } from './useReducedMotion.ts'

export interface AmbientFieldProps {
  /** 0-1, scales the field's opacity and drift speed. Default 0.5. */
  intensity?: number
}

/**
 * The dot-field world behind every screen: fixed, full-bleed, inert. It never
 * takes a click or a focus ring and is hidden from assistive tech. The engine
 * (ambientRenderer.ts) owns the loop, the observers and the perf guards.
 */
export function AmbientField({ intensity = 0.5 }: AmbientFieldProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const controllerRef = useRef<AmbientController | null>(null)
  const intensityRef = useRef(intensity)
  const reduced = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const controller = mountAmbientField(canvas, { intensity: intensityRef.current, reduced })
    controllerRef.current = controller
    return () => {
      controller.destroy()
      controllerRef.current = null
    }
  }, [reduced])

  // Intensity changes are applied live; they never rebuild the field.
  useEffect(() => {
    intensityRef.current = intensity
    controllerRef.current?.setIntensity(intensity)
  }, [intensity])

  return <canvas ref={canvasRef} className={styles.field} aria-hidden="true" />
}
