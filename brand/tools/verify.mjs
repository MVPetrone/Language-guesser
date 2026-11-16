/**
 * Proves the brand outputs are real: SVG hygiene, every SVG rasterises to
 * non-blank pixels through scripts/render-asset.mjs, every PNG has the
 * expected size/opacity and visible artwork, index.html invariants hold.
 *
 *   node brand/tools/verify.mjs
 */
import { readFileSync, statSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { pngStats } from './png.mjs'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)
const at = (p) => resolve(ROOT, p)
const TMP = resolve(tmpdir(), 'gtl-brand-verify')
mkdirSync(TMP, { recursive: true })
const TOKENS = new Set(
  [...readFileSync(at('src/styles/tokens.css'), 'utf8').matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase()),
)
let failures = 0
const check = (ok, msg) => {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`)
}

const SVGS = [
  'brand/mark.svg', 'brand/mark-mono.svg', 'brand/mark-small.svg', 'brand/mark-light.svg',
  'brand/wordmark.svg', 'brand/lockup-horizontal.svg', 'brand/lockup-stacked.svg',
  'public/brand/mark.svg', 'public/brand/lockup-horizontal.svg', 'public/favicon.svg',
]
for (const f of SVGS) {
  const s = readFileSync(at(f), 'utf8')
  const root = s.match(/^<svg[^>]*>/)?.[0] ?? ''
  const colours = [...s.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((m) => m[0].toLowerCase())
  const bad = colours.filter((c) => !TOKENS.has(c))
  const open = (s.match(/<[a-z]/g) ?? []).length
  const closed = (s.match(/<\/[a-z]|\/>/g) ?? []).length
  check(
    root && /viewBox=/.test(root) && !/\s(width|height)=/.test(root) && s.includes('<title>') &&
      !/<(text|image|filter|foreignObject)\b/.test(s) && bad.length === 0 && open === closed && s.length < 12 * 1024,
    `${f}  ${s.length} B  colours:${[...new Set(colours)].join(',') || 'currentColor'}${bad.length ? ` NOT TOKENS ${bad}` : ''}`,
  )
  const m = root.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)
  const k = Math.min(4, 1600 / +m[1])
  const out = resolve(TMP, f.replace(/\W+/g, '_') + '.png')
  const r = spawnSync('node', ['scripts/render-asset.mjs', at(f), out, String(Math.round(+m[1] * k)), String(Math.round(+m[2] * k)), '--transparent'], { cwd: ROOT, encoding: 'utf8' })
  const st = r.status === 0 ? pngStats(out) : null
  check(st && st.inkPct > 2, `  renders: ${st ? `${st.width}×${st.height}, ${st.inkPct}% painted` : r.stderr}`)
}

const PNGS = [
  ['public/icons/icon-192.png', 192, 192, 'opaque'],
  ['public/icons/icon-512.png', 512, 512, 'opaque'],
  ['public/icons/icon-maskable-512.png', 512, 512, 'opaque'],
  ['public/icons/icon-mono-512.png', 512, 512, 'transparent'],
  ['public/icons/apple-touch-icon.png', 180, 180, 'opaque'],
  ['public/og.png', 1200, 630, 'opaque'],
  ['public/og-square.png', 1200, 1200, 'opaque'],
  ['brand/preview.png', 1600, 1000, 'opaque'],
]
for (const [f, w, h, mode] of PNGS) {
  const st = pngStats(at(f))
  const alphaOk = mode === 'opaque' ? st.opaquePct === 100 : st.transparentPct > 20 && st.transparentPct < 95
  check(
    st.width === w && st.height === h && alphaOk && st.inkPct > 3 && st.colourBuckets > 8,
    `${f}  ${statSync(at(f)).size} B  ${st.width}×${st.height}  opaque ${st.opaquePct}%  transparent ${st.transparentPct}%  art ${st.inkPct}%  colours ${st.colourBuckets}`,
  )
}

const html = readFileSync(at('index.html'), 'utf8')
check(html.includes('<div id="root"></div>') && html.includes('<script type="module" src="/src/main.tsx"></script>'), 'index.html keeps #root and the main.tsx module script')
const desc = html.match(/name="description" content="([^"]+)"/)?.[1] ?? ''
check(desc.length > 0 && desc.length < 155, `meta description ${desc.length} chars`)
check((html.match(/rel="preload"/g) ?? []).length === 3, 'exactly three font preloads')
for (const ref of [...html.matchAll(/(?:href|src)="\/([^"]+)"/g)].map((m) => m[1])) {
  const p = ref.startsWith('src/') ? at(ref) : at(`public/${ref}`)
  let ok = true
  try { statSync(p) } catch { ok = false }
  check(ok, `index.html → /${ref} exists`)
}
const mf = JSON.parse(readFileSync(at('public/site.webmanifest'), 'utf8'))
for (const i of mf.icons) {
  const st = pngStats(at(`public/${i.src}`))
  check(`${st.width}x${st.height}` === i.sizes, `manifest icon ${i.src} is ${i.sizes}`)
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed')
process.exitCode = failures ? 1 : 0
