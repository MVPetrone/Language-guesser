/**
 * The wordmark: "LINGO GUESS" in Space Grotesk 700, tracking -0.03em,
 * converted to outlines. Pen positions (kerning + tracking) come from Chromium
 * laying out the real webfont, so the outlines match the live UI type exactly;
 * glyph shapes come from the variable font instanced at wght=700.
 */
import { readFileSync } from 'node:fs'
import { Font, toSegments, segmentBounds, segmentsToPath } from './font.mjs'
import { launchChromium } from './chromium.mjs'

export const TEXT = 'LINGO GUESS'
export const TRACKING = -0.03
const FONT_URL = new URL('../../public/fonts/SpaceGrotesk-700-latin.woff2', import.meta.url)

/** Compact SVG number: 1 decimal, no trailing zeros, no leading zero. */
export const fmt = (v) => {
  const s = (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, '')
  return s.replace(/^(-?)0\./, '$1.').replace(/^-0$/, '0')
}

async function penPositions(fontB64, text) {
  const browser = await launchChromium()
  try {
    const page = await browser.newPage()
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>
      @font-face{font-family:SG;font-weight:700;src:url(data:font/woff2;base64,${fontB64}) format('woff2')}
      body{margin:0}#t{font:700 1000px/1 SG;letter-spacing:${TRACKING}em;font-kerning:normal;white-space:pre}
    </style><span id="t">${text}</span>`)
    await page.evaluate(() => document.fonts.load('700 1000px SG'))
    await page.evaluate(() => document.fonts.ready)
    if (!(await page.evaluate(() => document.fonts.check('700 1000px SG')))) {
      throw new Error('Space Grotesk did not load in Chromium')
    }
    return await page.evaluate(() => {
      const el = document.getElementById('t')
      const node = el.firstChild
      const left = el.getBoundingClientRect().left
      const xs = []
      for (let i = 0; i < node.length; i++) {
        const r = document.createRange()
        r.setStart(node, i)
        r.setEnd(node, i + 1)
        xs.push(r.getBoundingClientRect().left - left)
      }
      return xs
    })
  } finally {
    await browser.close()
  }
}

/**
 * Lay out the wordmark. Returns per-glyph segments in font units (y-up, pen
 * offsets applied) plus metrics: ink bounds, cap height and baseline.
 */
export async function layoutWordmark(text = TEXT) {
  const buf = readFileSync(FONT_URL)
  const font = new Font(buf)
  const coords = font.normalize({ wght: 700 })
  const xs = await penPositions(buf.toString('base64'), text)
  const scale = 1000 / font.unitsPerEm
  const glyphs = [...text].map((ch, i) => {
    const inst = font.instance(font.glyphId(ch), coords)
    const pen = xs[i] / scale
    const segs = toSegments(inst).map(({ s, hops }) => ({
      s: { x: s.x + pen, y: s.y },
      hops: hops.map((h) => ({ c: h.c && { x: h.c.x + pen, y: h.c.y }, x: h.x + pen, y: h.y })),
    }))
    return { ch, pen, segs }
  })
  const ink = segmentBounds(glyphs.flatMap((g) => g.segs))
  const cap = segmentBounds(glyphs.find((g) => g.ch === 'E').segs).yMax
  return { glyphs, ink, cap, unitsPerEm: font.unitsPerEm }
}

/**
 * Path data for glyphs [from, to) scaled so 1 em = `em` output units, with the
 * line's ink-left at `x` and its baseline at `baseline`.
 */
export function wordmarkPath(layout, { em, x = 0, baseline, from = 0, to = layout.glyphs.length }) {
  const glyphs = layout.glyphs.slice(from, to).filter((g) => g.segs.length)
  const k = em / layout.unitsPerEm
  const left = segmentBounds(glyphs.flatMap((g) => g.segs)).xMin
  const map = (px, py) => ({ x: x + (px - left) * k, y: baseline - py * k })
  return glyphs.map((g) => segmentsToPath(g.segs, map, fmt)).join('')
}

/** Metrics of a glyph range at a given em size (output units). */
export function wordmarkBox(layout, { em, from = 0, to = layout.glyphs.length }) {
  const glyphs = layout.glyphs.slice(from, to).filter((g) => g.segs.length)
  const b = segmentBounds(glyphs.flatMap((g) => g.segs))
  const k = em / layout.unitsPerEm
  return {
    width: (b.xMax - b.xMin) * k,
    capHeight: layout.cap * k,
    overshootTop: (b.yMax - layout.cap) * k,
    overshootBottom: -b.yMin * k,
  }
}
