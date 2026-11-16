/* Shared runtime for brand/motion/*.html: time-addressable 1080 x 1080 films.
   Contract with scripts/render-motion.mjs:
     window.__ready   resolves once fonts are in
     window.__seek(t) draws the exact frame at t seconds (pure function of t)
   Opened in a browser the film plays in real time and loops; ?t=2.5 freezes
   one frame; ?capture leaves the clock to the renderer; reduced motion shows
   the still end frame. Colours, easings and beat lengths come from
   src/styles/tokens.css, so the films keep the product's tempo and palette. */
;(function () {
  const css = getComputedStyle(document.documentElement)
  const token = (name) => css.getPropertyValue(name).trim()

  /** A --dur-* token in seconds (0 when missing or zeroed). */
  function sec(name) {
    const m = /^(-?[\d.]+)(ms|s)$/.exec(token(name))
    return m ? (m[2] === 's' ? Number(m[1]) : Number(m[1]) / 1000) : 0
  }

  /** CSS cubic-bezier(), same solver as src/motion/tokens.ts. */
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
    const sx = (t) => ((ax * t + bx) * t + cx) * t
    const sy = (t) => ((ay * t + by) * t + cy) * t
    const dx = (t) => (3 * ax * t + 2 * bx) * t + cx
    return (x) => {
      if (x <= 0) return 0
      if (x >= 1) return 1
      let t = x
      for (let i = 0; i < 8; i++) {
        const e = sx(t) - x
        if (Math.abs(e) < 1e-7) return sy(t)
        const d = dx(t)
        if (Math.abs(d) < 1e-7) break
        t -= e / d
      }
      let lo = 0, hi = 1
      t = x
      for (let i = 0; i < 40; i++) {
        if (sx(t) < x) lo = t
        else hi = t
        t = (lo + hi) / 2
      }
      return sy(t)
    }
  }

  function ease(name) {
    const m = /^cubic-bezier\(([^)]*)\)$/.exec(token(name))
    if (!m) return (x) => x
    const [a, b, c, d] = m[1].split(',').map(Number)
    return bezier(a, b, c, d)
  }

  /** A colour token as channels; rgba(colour, alpha) builds canvas strings. */
  function color(name) {
    const v = token(name)
    const hex = /^#([0-9a-f]{6})$/i.exec(v)
    if (hex) {
      const n = parseInt(hex[1], 16)
      return { r: n >> 16, g: (n >> 8) & 255, b: n & 255 }
    }
    const [r, g, b] = (/\(([^)]*)\)/.exec(v)?.[1] ?? '0,0,0').split(',').map(Number)
    return { r, g, b }
  }
  const rgba = (c, a = 1) => `rgba(${c.r}, ${c.g}, ${c.b}, ${Math.max(0, Math.min(1, a)).toFixed(4)})`
  const mixColor = (a, b, k) => ({ r: a.r + (b.r - a.r) * k, g: a.g + (b.g - a.g) * k, b: a.b + (b.b - a.b) * k })

  const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x))
  const lerp = (a, b, k) => a + (b - a) * k
  /** Progress through a beat that starts at `start` and lasts `dur` seconds. */
  const seg = (t, start, dur) => (dur > 0 ? clamp((t - start) / dur) : t >= start ? 1 : 0)

  /** Same integer hash as src/motion/random.ts: deterministic "randomness". */
  function mix(x) {
    x ^= x >>> 16
    x = Math.imul(x, 0x7feb352d)
    x ^= x >>> 15
    x = Math.imul(x, 0x846ca68b)
    x ^= x >>> 16
    return x >>> 0
  }
  const hash = (n, seed) => mix((n | 0) ^ mix(seed | 0)) / 4294967296

  function film({ duration, fonts, draw }) {
    const stage = document.querySelector('.stage')
    const canvas = stage.querySelector('canvas')
    canvas.width = 1080
    canvas.height = 1080
    const ctx = canvas.getContext('2d')
    const params = new URLSearchParams(location.search)

    window.__seek = (t) => {
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, 1080, 1080)
      draw(ctx, t)
      ctx.restore()
    }

    const fit = () => {
      const s = Math.min(innerWidth, innerHeight) / 1080
      stage.style.transform = `translate(${(innerWidth - 1080 * s) / 2}px, ${(innerHeight - 1080 * s) / 2}px) scale(${s})`
    }

    window.__ready = Promise.all(fonts.map((f) => document.fonts.load(f)))
      .then(() => document.fonts.ready)
      .then(() => {
        if (params.has('capture')) return
        fit()
        addEventListener('resize', fit)
        if (params.has('t')) return window.__seek(Number(params.get('t')))
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return window.__seek(duration)
        const t0 = performance.now()
        const tick = (now) => {
          window.__seek((((now - t0) / 1000) % duration))
          requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      })
  }

  /** The dot matrix: the brand's background texture, drawn as data. */
  function dotGrid(ctx, { pitch, radius, fill, alphaAt }) {
    ctx.fillStyle = fill
    for (let y = pitch / 2; y < 1080; y += pitch) {
      for (let x = pitch / 2; x < 1080; x += pitch) {
        const a = alphaAt(x, y)
        if (a <= 0.003) continue
        ctx.globalAlpha = a
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
  }

  window.MotionKit = { token, sec, ease, color, rgba, mixColor, clamp, lerp, seg, hash, film, dotGrid }
})()
