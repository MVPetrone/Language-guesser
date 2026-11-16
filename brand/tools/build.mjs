/**
 * Brand build: derives every generated asset from the hand-authored marks.
 *
 *   node brand/tools/build.mjs
 *
 * - brand/wordmark.svg            outlines from Space Grotesk 700 (wordmark.mjs)
 * - brand/lockup-*.svg            mark.svg + wordmark, composed with clearspace
 * - public/brand/*.svg            runtime copies used by the UI
 * - public/icons/*.png, public/og*.png, brand/preview.png
 *                                 rendered through scripts/render-asset.mjs
 *
 * render-asset.mjs loads HTML via setContent (base URL about:blank), so HTML
 * sources are first inlined: stylesheets, fonts and images become data URIs.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve, extname } from 'node:path'
import { tmpdir } from 'node:os'
import { layoutWordmark, wordmarkPath, wordmarkBox, fmt } from './wordmark.mjs'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)
const at = (p) => resolve(ROOT, p)
const TMP = resolve(tmpdir(), 'gtl-brand-build')
mkdirSync(TMP, { recursive: true })
mkdirSync(at('public/brand'), { recursive: true })
mkdirSync(at('public/icons'), { recursive: true })

const INK = '#06080c'
const FOG = '#edf1f7'
const head = (vb) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img">\n  <title>Guess the Language</title>\n`
/** The drawable body of a mark file (everything after <title>). */
const markBody = (file) => readFileSync(at(file), 'utf8').split('</title>')[1].replace('</svg>', '').trim()
const placed = (body, x, y, size) =>
  `  <g transform="translate(${fmt(x)} ${fmt(y)}) scale(${+(size / 128).toFixed(5)})">\n    ${body.replace(/\n\s*/g, '\n    ')}\n  </g>\n`

// ---- wordmark + lockups --------------------------------------------------
const L = await layoutWordmark()
{
  const b = wordmarkBox(L, { em: 100 })
  const h = b.capHeight + b.overshootTop + b.overshootBottom
  const d = wordmarkPath(L, { em: 100, baseline: b.overshootTop + b.capHeight })
  writeFileSync(
    at('brand/wordmark.svg'),
    `${head(`0 0 ${fmt(b.width)} ${fmt(h)}`).replace(' role', ` color="${FOG}" role`)}  <path fill="currentColor" d="${d}"/>\n</svg>\n`,
  )
}
const mark = markBody('brand/mark.svg')
{
  // Horizontal: aperture = 80 (1 unit); 0.5-unit clearspace (40) on every side.
  const unit = 80
  const pad = unit / 2
  const gap = 0.4 * unit
  const x0 = pad + unit + gap
  const em = ((720 - pad - x0) / wordmarkBox(L, { em: 1000 }).width) * 1000
  const cap = wordmarkBox(L, { em }).capHeight
  const d = wordmarkPath(L, { em, x: x0, baseline: 80 + cap / 2 })
  writeFileSync(
    at('brand/lockup-horizontal.svg'),
    `${head('0 0 720 160')}${placed(mark, pad, pad, unit)}  <path fill="${FOG}" d="${d}"/>\n</svg>\n`,
  )
}
{
  // Stacked: mark over a two-line wordmark, centred; clearspace = 0.5 aperture.
  const unit = 120
  const lines = [[0, 9], [10, 18]]
  const blockW = 480 - unit - 24
  const em = (blockW / Math.max(...lines.map(([from, to]) => wordmarkBox(L, { em: 1000, from, to }).width))) * 1000
  const cap = wordmarkBox(L, { em }).capHeight
  const lead = cap * 0.42
  const gap = 0.36 * unit
  const total = unit + gap + 2 * cap + lead
  const top = (400 - total) / 2
  let body = placed(mark, 240 - unit / 2, top, unit)
  lines.forEach(([from, to], i) => {
    const w = wordmarkBox(L, { em, from, to }).width
    const baseline = top + unit + gap + cap + i * (cap + lead)
    body += `  <path fill="${FOG}" d="${wordmarkPath(L, { em, x: 240 - w / 2, baseline, from, to })}"/>\n`
  })
  writeFileSync(at('brand/lockup-stacked.svg'), `${head('0 0 480 400')}${body}</svg>\n`)
}
copyFileSync(at('brand/mark.svg'), at('public/brand/mark.svg'))
copyFileSync(at('brand/lockup-horizontal.svg'), at('public/brand/lockup-horizontal.svg'))

// ---- rendering -----------------------------------------------------------
function render(input, out, w, h, ...flags) {
  const r = spawnSync('node', ['scripts/render-asset.mjs', input, at(out), String(w), String(h), ...flags], {
    cwd: ROOT,
    stdio: 'inherit',
  })
  if (r.status !== 0) throw new Error(`render failed: ${out}`)
}
const MIME = { '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' }
const dataUri = (file) => `data:${MIME[extname(file)]};base64,${readFileSync(file).toString('base64')}`
/** Resolve a reference like Vite would: "/x" → public/x, else relative to `base`. */
const locate = (ref, base) => (ref.startsWith('/') ? at(`public${ref}`) : resolve(base, ref))
const isLocal = (ref) => !/^(data:|https?:|#)/.test(ref)
function inlineCss(css, base) {
  return css.replace(/url\(([^)]+)\)/g, (m, ref) => {
    const r = ref.replace(/['"]/g, '')
    return isLocal(r) ? `url(${dataUri(locate(r, base))})` : m
  })
}
function inlineHtml(file) {
  const base = dirname(at(file))
  return readFileSync(at(file), 'utf8')
    .replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, ref) => {
      const css = locate(ref, base)
      return `<style>${inlineCss(readFileSync(css, 'utf8'), dirname(css))}</style>`
    })
    .replace(/<style>([\s\S]*?)<\/style>/g, (_, css) => `<style>${inlineCss(css, base)}</style>`)
    .replace(/src="([^"]+)"/g, (m, ref) => (isLocal(ref) ? `src="${dataUri(locate(ref, base))}"` : m))
}
function renderHtml(file, out, w, h) {
  const tmp = resolve(TMP, `${out.replace(/\W+/g, '_')}.html`)
  writeFileSync(tmp, inlineHtml(file))
  render(tmp, out, w, h, '--wait=600')
}
function renderIcon(name, size, svg, ...flags) {
  const tmp = resolve(TMP, `${name}.svg`)
  writeFileSync(tmp, svg)
  render(tmp, `public/icons/${name}.png`, size, size, ...flags)
}

// App icons. `art` = mark diameter as a fraction of the canvas.
const icon = (art, body, bg = INK) => {
  const s = 512
  const d = s * art
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}">${bg ? `<rect width="${s}" height="${s}" fill="${bg}"/>` : ''}${placed(body, (s - d) / 2, (s - d) / 2, d)}</svg>`
}
renderIcon('icon-192', 192, icon(0.76, mark), `--bg=${INK}`) // 12% padding each side
renderIcon('icon-512', 512, icon(0.76, mark), `--bg=${INK}`)
renderIcon('icon-maskable-512', 512, icon(0.64, mark), `--bg=${INK}`) // inside the 80% safe circle
renderIcon('icon-mono-512', 512, icon(0.76, markBody('brand/mark-mono.svg').replaceAll('currentColor', FOG), null), '--transparent')
renderIcon('apple-touch-icon', 180, icon(0.7, mark), `--bg=${INK}`)

renderHtml('brand/og.html', 'public/og.png', 1200, 630)
renderHtml('brand/og.html', 'public/og-square.png', 1200, 1200)
renderHtml('brand/preview.html', 'brand/preview.png', 1600, 1000)
