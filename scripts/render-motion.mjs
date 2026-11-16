#!/usr/bin/env node
/**
 * Render a time-addressable HTML animation to MP4 + GIF, deterministically.
 *
 *   node scripts/render-motion.mjs <input.html> <out-base> [flags]
 *
 *   --width=1080 --height=1080   viewport and output size, px
 *   --fps=30 --duration=5        frames are t = i / fps for i in [0, fps * duration)
 *   --gif-fps=15                 GIF rate (12-15); width steps down until it fits
 *   --gif-max-mb=4               GIF size budget
 *   --loop                       assert the loop closes: frame(t = duration) must be
 *                                pixel-identical to frame(0); also reports the seam
 *   --stills=0,1.5,4             write <out-base>@<t>s.png stills only, no video
 *   --keep-frames  --verbose     keep the PNG frames / echo the page console
 *
 * Page contract: optional `window.__ready` (a Promise: fonts, assets), then
 * `window.__seek(t)` draws the exact frame at t seconds. Pages without __seek
 * are reloaded with `?t=<seconds>` per frame instead. The page is always loaded
 * with `?capture` so it can skip its own real-time loop.
 *
 * Pages are served from a virtual origin (http://render.local/<abs path>), a
 * request interceptor rather than a server, so relative URLs behave exactly as
 * on disk, module scripts work, and `.ts` imports from src/ are transpiled on
 * the fly (handy for previewing the in-app canvas engines). Every other
 * request is blocked: renders never touch the network.
 *
 * Frames go to a temp dir on disk (/var/tmp: /tmp is RAM-backed on small
 * boxes). Same input, same frames: a digest of every frame is printed so two
 * runs can be compared.
 */
import { chromium } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, extname, join, resolve, sep } from 'node:path'

const [input, outBase, ...rest] = process.argv.slice(2)
if (!input || !outBase) {
  console.error('usage: render-motion.mjs <input.html> <out-base> [--width= --height= --fps= --duration= --loop ...]')
  process.exit(2)
}
const flag = (name) => rest.includes(`--${name}`)
const opt = (name, dflt) => {
  const hit = rest.find((f) => f.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : dflt
}
const W = Number(opt('width', '1080'))
const H = Number(opt('height', '1080'))
const FPS = Number(opt('fps', '30'))
const DURATION = Number(opt('duration', '5'))
const GIF_FPS = Number(opt('gif-fps', '15'))
const GIF_MAX = Number(opt('gif-max-mb', '4')) * 1024 * 1024
const STILLS = opt('stills', '')
const verbose = flag('verbose')

const inputPath = resolve(input)
if (!existsSync(inputPath)) {
  console.error(`missing input: ${inputPath}`)
  process.exit(2)
}
const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), '..')
const out = resolve(outBase)
mkdirSync(dirname(out), { recursive: true })

// --- Browser: same resolution order as scripts/render-asset.mjs ------------
const CANDIDATES = [
  process.env.PW_CHROME,
  '/usr/bin/google-chrome',
  `${process.env.HOME}/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`,
  `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell`,
].filter(Boolean)
const executablePath = CANDIDATES.find((p) => existsSync(p))

// --- Virtual origin ---------------------------------------------------------
const ORIGIN = 'http://render.local'
const ROOTS = [repoRoot + sep, dirname(inputPath) + sep]
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
}
let ts = null
async function serve(route) {
  const url = new URL(route.request().url())
  if (url.origin !== ORIGIN) return route.abort('blockedbyclient')
  const file = decodeURIComponent(url.pathname)
  const ok = ROOTS.some((r) => file.startsWith(r)) && existsSync(file) && statSync(file).isFile()
  if (!ok) return route.fulfill({ status: 404, body: 'not found' })
  const ext = extname(file).toLowerCase()
  if (ext === '.ts' || ext === '.tsx') {
    ts ??= (await import('typescript')).default
    const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), {
      fileName: file,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
    })
    return route.fulfill({ status: 200, contentType: 'text/javascript', body: outputText })
  }
  return route.fulfill({ status: 200, contentType: MIME[ext] ?? 'application/octet-stream', body: readFileSync(file) })
}

// --- Capture ------------------------------------------------------------------
const TMP_ROOT = process.env.RENDER_MOTION_TMP ?? (existsSync('/var/tmp') ? '/var/tmp' : tmpdir())
const frameDir = mkdtempSync(join(TMP_ROOT, 'render-motion-'))
const sha = (buf) => createHash('sha256').update(buf).digest('hex')

const browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--font-render-hinting=none'] })
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  reducedMotion: 'no-preference',
  colorScheme: 'dark',
})
await context.route('**/*', serve)
const page = await context.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(e.message))
page.on('console', (m) => {
  if (verbose || m.type() === 'error' || m.type() === 'warning') console.log(`  [page ${m.type()}] ${m.text()}`)
})

const pageUrl = (extra = '') => `${ORIGIN}${inputPath}?capture${extra}`
async function load(extra) {
  await page.goto(pageUrl(extra), { waitUntil: 'load' })
  await page.evaluate(async () => {
    await window.__ready
    await document.fonts.ready
  })
}
await load()
const failedFonts = await page.evaluate(() =>
  [...document.fonts].filter((f) => f.status === 'error').map((f) => `${f.family} ${f.weight}`),
)
if (failedFonts.length) throw new Error(`fonts failed to load: ${failedFonts.join(', ')}`)
const fonts = await page.evaluate(() =>
  [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight}`),
)
const seekable = await page.evaluate(() => typeof window.__seek === 'function')

async function shoot(t) {
  const time = Math.round(t * 1e6) / 1e6
  if (seekable) {
    await page.evaluate((s) => window.__seek(s), time)
    // Two frames: the seek's paint has certainly been committed.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  } else {
    await load(`&t=${time}`)
  }
  return page.screenshot({ type: 'png' })
}

function done(code) {
  if (!flag('keep-frames')) rmSync(frameDir, { recursive: true, force: true })
  else console.log(`frames kept in ${frameDir}`)
  process.exit(code)
}

if (STILLS) {
  for (const t of STILLS.split(',').map(Number)) {
    const file = `${out}@${t}s.png`
    writeFileSync(file, await shoot(t))
    console.log(`still  ${file}`)
  }
  await browser.close()
  if (pageErrors.length) console.error(`page errors:\n  ${pageErrors.join('\n  ')}`)
  done(pageErrors.length ? 1 : 0)
}

const count = Math.round(FPS * DURATION)
const hashes = []
const started = Date.now()
for (let i = 0; i < count; i++) {
  const buf = await shoot(i / FPS)
  writeFileSync(join(frameDir, `f_${String(i).padStart(5, '0')}.png`), buf)
  hashes.push(sha(buf))
}
let loopReport = null
if (flag('loop')) {
  const closing = sha(await shoot(DURATION))
  loopReport = { closes: closing === hashes[0], closing, first: hashes[0] }
}
await browser.close()
const digest = sha(hashes.join('\n'))
console.log(`captured ${count} frames @ ${FPS} fps in ${((Date.now() - started) / 1000).toFixed(1)} s`)
console.log(`fonts: ${fonts.join(', ') || '(none)'}`)
console.log(`frames digest sha256: ${digest}`)
console.log(`distinct frames: ${new Set(hashes).size}/${count}`)
if (pageErrors.length) {
  console.error(`page errors:\n  ${pageErrors.join('\n  ')}`)
  done(1)
}

// --- Encode -------------------------------------------------------------------
function ff(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' })
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(' ')}`)
}
const frames = ['-framerate', String(FPS), '-i', join(frameDir, 'f_%05d.png')]

const mp4 = `${out}.mp4`
ff([
  ...frames,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart', '-map_metadata', '-1', '-r', String(FPS), mp4,
])

const gif = `${out}.gif`
const palette = join(frameDir, 'palette.png')
let gifWidth = 0
for (const width of [720, 600, 540, 480, 420, 360].filter((w) => w <= W)) {
  const chain = `fps=${GIF_FPS},scale=${width}:-2:flags=lanczos`
  ff([...frames, '-vf', `${chain},palettegen=max_colors=256:stats_mode=full`, palette])
  ff([
    ...frames, '-i', palette, '-lavfi',
    `${chain}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
    '-loop', '0', gif,
  ])
  gifWidth = width
  if (statSync(gif).size <= GIF_MAX) break
}

// --- Report -------------------------------------------------------------------
function probe(file) {
  const r = spawnSync('ffprobe', [
    '-v', 'error', '-show_entries', 'stream=codec_name,width,height,pix_fmt,r_frame_rate,nb_frames:format=duration,size',
    '-of', 'json', file,
  ])
  const j = JSON.parse(r.stdout.toString())
  const s = j.streams[0]
  return `${s.codec_name} ${s.width}x${s.height} ${s.pix_fmt ?? ''} ${s.r_frame_rate} fps, ` +
    `${s.nb_frames ?? '?'} frames, ${Number(j.format.duration).toFixed(3)} s, ${(Number(j.format.size) / 1024).toFixed(1)} KB`
}
console.log(`mp4  ${mp4}\n     ${probe(mp4)}`)
console.log(`gif  ${gif} (${gifWidth}px, ${GIF_FPS} fps)\n     ${probe(gif)}`)
if (statSync(gif).size > GIF_MAX) console.error(`gif is over budget even at ${gifWidth}px`)

if (loopReport) {
  console.log(loopReport.closes
    ? `loop closes: frame(t=${DURATION}s) is pixel-identical to frame(0) (sha256 ${loopReport.first.slice(0, 16)}...)`
    : `LOOP OPEN: frame(t=${DURATION}s) differs from frame(0)`)
  // Seam check on the encoded video: mean absolute difference (0-255, RGB) of
  // last -> first versus the typical step between consecutive frames.
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', mp4, '-vf', 'scale=270:270', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], {
    maxBuffer: 1 << 30,
  }).stdout
  const size = 270 * 270 * 3
  const n = raw.length / size
  const frame = (k) => raw.subarray(k * size, (k + 1) * size)
  const mad = (a, b) => {
    let s = 0
    for (let p = 0; p < size; p++) s += Math.abs(a[p] - b[p])
    return s / size
  }
  const steps = []
  for (let k = 1; k < n; k++) steps.push(mad(frame(k - 1), frame(k)))
  const sorted = [...steps].sort((a, b) => a - b)
  const seam = mad(frame(n - 1), frame(0))
  const median = sorted[Math.floor(sorted.length / 2)]
  console.log(`seam MAD last->first ${seam.toFixed(3)} vs consecutive frames: median ${median.toFixed(3)}, ` +
    `min ${sorted[0].toFixed(3)}, max ${sorted[sorted.length - 1].toFixed(3)} (ratio ${(seam / median).toFixed(2)})`)
  if (!loopReport.closes) done(1)
}
done(0)
