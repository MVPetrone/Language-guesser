/**
 * AmbientField's engine, free of React: the scene (layout, dot sprites, the
 * static matrix layer), the per-frame draw, and a controller that owns the rAF
 * loop and every observer. The component only mounts and destroys it.
 *
 * Per frame the cost is one blit of the pre-rendered matrix, one radial
 * gradient, and a drawImage per dot inside the focal glow. No shadowBlur, no
 * per-frame layout work, nothing at all while hidden, off-screen or reduced.
 */
import { ambientPose, buildDotField, glintLevel, type DotField } from './dotField.ts'
import { parseColor, parseDuration, readToken, rgbaString, type Rgba } from './tokens.ts'

/** The field changes slowly: 30 fps is plenty and halves the work at 60 Hz. */
const MAX_FPS = 30
/** Draw once at least this much time has passed; the slack absorbs vsync jitter. */
const MIN_FRAME_GAP = (1000 / MAX_FPS) * 0.9
/** Never advance the clock by more than this in one frame (after a long jank). */
const MAX_STEP = 100
const MAX_DPR = 2

/** Dot radii, CSS px. */
const LAND_R = 1.15
const OCEAN_R = 0.8
/** Alphas at intensity 1; the default intensity of 0.5 halves them. */
const FULL = { land: 0.4, ocean: 0.22, lit: 1, wash: 0.1, glint: 0.6 } as const

export interface AmbientPalette {
  /** Resting dots: --fog-400. */
  dot: Rgba
  /** The focal glow, lit dots and glints: --caliber-500 (the machine listening). */
  lit: Rgba
}

export function readPalette(el: Element): AmbientPalette | null {
  const dot = parseColor(readToken(el, '--fog-400'))
  const lit = parseColor(readToken(el, '--caliber-500'))
  return dot && lit ? { dot, lit } : null
}

interface Sprite {
  canvas: HTMLCanvasElement
  half: number
}

export interface AmbientScene {
  field: DotField
  dpr: number
  palette: AmbientPalette
  /** Every dot at its resting alpha, drawn once per resize. */
  base: HTMLCanvasElement
  litLand: Sprite
  litOcean: Sprite
}

/** One dot, rendered once and stamped with drawImage. */
function sprite(radius: number, color: Rgba): Sprite {
  const half = Math.ceil(radius + 1)
  const canvas = document.createElement('canvas')
  canvas.width = half * 2
  canvas.height = half * 2
  const g = canvas.getContext('2d')
  if (g) {
    g.fillStyle = rgbaString(color, 1)
    g.beginPath()
    g.arc(half, half, radius, 0, Math.PI * 2)
    g.fill()
  }
  return { canvas, half }
}

/** Everything that only changes on resize: layout, sprites and the static matrix. */
export function createScene(
  cssWidth: number,
  cssHeight: number,
  dpr: number,
  palette: AmbientPalette,
): AmbientScene {
  const field = buildDotField(cssWidth, cssHeight)
  const base = document.createElement('canvas')
  base.width = Math.max(1, Math.round(field.width * dpr))
  base.height = Math.max(1, Math.round(field.height * dpr))
  const landDot = sprite(LAND_R * dpr, palette.dot)
  const oceanDot = sprite(OCEAN_R * dpr, palette.dot)
  const g = base.getContext('2d')
  if (g) {
    const { cols, rows, spacing, ox, oy, level, land } = field
    for (let row = 0; row < rows; row++) {
      const y = Math.round((oy + row * spacing) * dpr)
      for (let col = 0; col < cols; col++) {
        const i = row * cols + col
        const lv = level[i] ?? 0
        if (lv === 0) continue
        const onLand = land[i] === 1
        const s = onLand ? landDot : oceanDot
        g.globalAlpha = lv * (onLand ? FULL.land : FULL.ocean)
        g.drawImage(s.canvas, Math.round((ox + col * spacing) * dpr) - s.half, y - s.half)
      }
    }
  }
  return {
    field,
    dpr,
    palette,
    base,
    litLand: sprite(LAND_R * dpr, palette.lit),
    litOcean: sprite(OCEAN_R * dpr, palette.lit),
  }
}

/**
 * Paint one frame at an ambient clock time (ms). `unitMs` is the ambient unit
 * (--dur-5); 0 paints the single still pose used under reduced motion.
 */
export function drawAmbientFrame(
  ctx: CanvasRenderingContext2D,
  scene: AmbientScene,
  clockMs: number,
  unitMs: number,
  intensity: number,
): void {
  const { field, dpr, palette } = scene
  const strength = Math.min(1, Math.max(0, intensity))
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  if (strength === 0) return

  const pose = ambientPose(clockMs, unitMs)
  const swell = 0.55 + 0.45 * pose.breath

  // 1. The resting matrix, breathing a few percent with the glow.
  ctx.globalAlpha = strength * (0.92 + 0.08 * pose.breath)
  ctx.drawImage(scene.base, 0, 0)

  // 2. A faint wash of light around the drifting focal point.
  const fx = pose.x * field.width
  const fy = pose.y * field.height
  const r = Math.min(field.width, field.height) * (0.5 + 0.04 * pose.breath)
  const wash = ctx.createRadialGradient(fx * dpr, fy * dpr, 0, fx * dpr, fy * dpr, r * dpr)
  wash.addColorStop(0, rgbaString(palette.lit, FULL.wash * strength * swell))
  wash.addColorStop(1, rgbaString(palette.lit, 0))
  ctx.globalAlpha = 1
  ctx.fillStyle = wash
  ctx.fillRect((fx - r) * dpr, (fy - r) * dpr, 2 * r * dpr, 2 * r * dpr)

  // 3. Dots under the glow light up, falling off smoothly to its rim. Only the
  //    lattice cells inside the glow's bounding box are visited.
  const { cols, rows, spacing, ox, oy, level, land } = field
  const colA = Math.max(0, Math.floor((fx - r - ox) / spacing))
  const colB = Math.min(cols - 1, Math.ceil((fx + r - ox) / spacing))
  const rowA = Math.max(0, Math.floor((fy - r - oy) / spacing))
  const rowB = Math.min(rows - 1, Math.ceil((fy + r - oy) / spacing))
  const lit = FULL.lit * strength * swell
  const invR2 = 1 / (r * r)
  for (let row = rowA; row <= rowB; row++) {
    const y = oy + row * spacing
    const dy2 = (y - fy) * (y - fy)
    for (let col = colA; col <= colB; col++) {
      const i = row * cols + col
      const lv = level[i] ?? 0
      if (lv === 0) continue
      const x = ox + col * spacing
      const q = ((x - fx) * (x - fx) + dy2) * invR2
      if (q >= 1) continue
      const s = land[i] === 1 ? scene.litLand : scene.litOcean
      ctx.globalAlpha = Math.min(1, lit * lv * (1 - q) * (1 - q))
      ctx.drawImage(s.canvas, Math.round(x * dpr) - s.half, Math.round(y * dpr) - s.half)
    }
  }

  // 4. A few dots anywhere on the map glint, faintly, every 6-11 s.
  const { glints, glintPhase, glintRate } = field
  for (let k = 0; k < glints.length; k++) {
    const glow = glintLevel(clockMs, unitMs, glintPhase[k] ?? 0, glintRate[k] ?? 0)
    if (glow < 0.02) continue
    const i = glints[k] ?? 0
    const s = land[i] === 1 ? scene.litLand : scene.litOcean
    ctx.globalAlpha = Math.min(1, FULL.glint * strength * glow * (level[i] ?? 0))
    const x = ox + (i % cols) * spacing
    const y = oy + Math.floor(i / cols) * spacing
    ctx.drawImage(s.canvas, Math.round(x * dpr) - s.half, Math.round(y * dpr) - s.half)
  }
  ctx.globalAlpha = 1
}

export interface AmbientController {
  setIntensity(value: number): void
  destroy(): void
}

export interface AmbientOptions {
  intensity: number
  reduced: boolean
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0)
const inert: AmbientController = { setIntensity() {}, destroy() {} }

/**
 * Run the field on a canvas. Draws only while animated, the page is visible,
 * the canvas is on screen and intensity > 0; every resize repaints at once.
 * Under reduced motion it paints one still frame (again on resize) and never
 * starts a loop. destroy() cancels the frame, disconnects both observers and
 * removes the listener, so StrictMode's mount-unmount-mount leaks nothing.
 */
export function mountAmbientField(canvas: HTMLCanvasElement, options: AmbientOptions): AmbientController {
  const ctx = canvas.getContext('2d')
  const palette = readPalette(canvas)
  if (!ctx || !palette) return inert

  // --dur-5 is the ambient unit. tokens.css zeroes it under reduced motion,
  // which (like `reduced` itself) leaves the field on one still frame.
  const unit = options.reduced ? 0 : (parseDuration(readToken(canvas, '--dur-5')) ?? 0)
  const animated = unit > 0
  let intensity = clamp01(options.intensity)
  let scene: AmbientScene | null = null
  let clock = 0
  let raf = 0
  let last = -1
  let pageVisible = document.visibilityState !== 'hidden'
  let onScreen = true

  const draw = () => {
    if (scene) drawAmbientFrame(ctx, scene, clock, unit, intensity)
  }

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick)
    if (last < 0) {
      last = now
      return
    }
    const gap = now - last
    if (gap < MIN_FRAME_GAP) return
    last = now
    // Paused time is never counted, so a resumed field picks up where it was.
    clock += Math.min(gap, MAX_STEP) * (0.6 + 0.4 * intensity)
    draw()
  }

  const update = () => {
    const run = animated && pageVisible && onScreen && intensity > 0 && scene !== null
    if (run && raf === 0) {
      last = -1
      raf = requestAnimationFrame(tick)
    } else if (!run && raf !== 0) {
      cancelAnimationFrame(raf)
      raf = 0
    }
  }

  const resize = (cssWidth: number, cssHeight: number) => {
    if (cssWidth < 1 || cssHeight < 1) return
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1)
    const w = Math.round(cssWidth * dpr)
    const h = Math.round(cssHeight * dpr)
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
    scene = createScene(cssWidth, cssHeight, dpr, palette)
    draw() // a resize clears the backing store: repaint now, moving or not
    update()
  }

  let ro: ResizeObserver | null = null
  let onWindowResize: (() => void) | null = null
  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver((entries) => {
      const box = entries[entries.length - 1]?.contentRect
      if (box) resize(box.width, box.height)
    })
    ro.observe(canvas)
  } else {
    onWindowResize = () => {
      const box = canvas.getBoundingClientRect()
      resize(box.width, box.height)
    }
    window.addEventListener('resize', onWindowResize)
    onWindowResize()
  }

  const io =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => {
          const entry = entries[entries.length - 1]
          if (!entry) return
          onScreen = entry.isIntersecting
          update()
        })
      : null
  io?.observe(canvas)

  const onVisibility = () => {
    pageVisible = document.visibilityState !== 'hidden'
    update()
  }
  document.addEventListener('visibilitychange', onVisibility)

  return {
    setIntensity(value) {
      intensity = clamp01(value)
      if (raf === 0) draw() // a still field still shows the new strength
      update()
    },
    destroy() {
      cancelAnimationFrame(raf)
      raf = 0
      ro?.disconnect()
      io?.disconnect()
      if (onWindowResize) window.removeEventListener('resize', onWindowResize)
      document.removeEventListener('visibilitychange', onVisibility)
      scene = null
    },
  }
}
