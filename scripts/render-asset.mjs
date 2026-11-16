#!/usr/bin/env node
/**
 * Render an .svg or .html file to a PNG with headless Chromium (Playwright).
 * There is no ImageMagick / rsvg on this host — this is the only PNG path.
 *
 *   node scripts/render-asset.mjs <input.svg|.html> <out.png> <w> <h> [flags]
 *
 * Flags:
 *   --transparent      omit the page background (PNG with alpha)
 *   --bg=#0a0d13       set the page background explicitly
 *   --scale=2          device scale factor (retina renders)
 *   --wait=500         extra settle time in ms before the shot
 *
 * An .svg is inlined as an <img> at exactly w×h so nothing reflows; an .html
 * document is screenshotted at w×h with the viewport set to match, so it should
 * lay out to those dimensions itself.
 */
import { chromium } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, extname } from 'node:path'

const [input, out, wArg, hArg, ...rest] = process.argv.slice(2)
if (!input || !out || !wArg || !hArg) {
  console.error('usage: render-asset.mjs <in.svg|.html> <out.png> <w> <h> [flags]')
  process.exit(2)
}
const w = Number(wArg)
const h = Number(hArg)
const flag = (name) => rest.some((f) => f === `--${name}`)
const opt = (name, dflt) => {
  const hit = rest.find((f) => f.startsWith(`--${name}=`))
  return hit ? hit.split('=')[1] : dflt
}
const transparent = flag('transparent')
const bg = opt('bg', '#0a0d13')
const scale = Number(opt('scale', '1'))
const wait = Number(opt('wait', '250'))

const path = resolve(input)
if (!existsSync(path)) {
  console.error(`missing input: ${path}`)
  process.exit(2)
}

const isSvg = extname(path).toLowerCase() === '.svg'
let html
if (isSvg) {
  const svg = readFileSync(path, 'utf8')
  html = `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;width:${w}px;height:${h}px;overflow:hidden;
      background:${transparent ? 'transparent' : bg};}
    img{display:block;width:${w}px;height:${h}px;}
  </style><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" alt="">`
} else {
  html = readFileSync(path, 'utf8')
}

// @playwright/test expects browser build 1248, but the cache here holds 1228 and
// `playwright install` is a 170 MB download on a memory-tight box. Resolve a
// local Chromium instead: env override, then system Chrome, then the cache.
const CANDIDATES = [
  process.env.PW_CHROME,
  '/usr/bin/google-chrome',
  `${process.env.HOME}/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`,
  `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell`,
].filter(Boolean)
const executablePath = CANDIDATES.find((p) => existsSync(p))

const browser = await chromium.launch({
  executablePath,
  args: ['--no-sandbox', '--font-render-hinting=none'],
})
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale })
await page.setContent(html, { waitUntil: 'load' })
await page.evaluate(() => document.fonts?.ready)
await page.waitForTimeout(wait)
await page.screenshot({ path: resolve(out), omitBackground: transparent })
await browser.close()

const size = (await import('node:fs')).statSync(resolve(out)).size
const dims = await (async () => {
  const buf = readFileSync(resolve(out))
  return `${buf.readUInt32BE(16)}×${buf.readUInt32BE(20)}`
})()
console.log(`${out}  ${dims}px  ${(size / 1024).toFixed(1)} KB`)
