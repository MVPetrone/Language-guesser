// Screenshot the built site (served by scripts/serve-dist.mjs) at phone + desktop
// sizes, walking the real game flow, and report console/page errors.
//
//   node scripts/shoot.mjs <base-url> <out-dir>
//   e.g. node scripts/shoot.mjs http://127.0.0.1:4173/ /tmp/shots
import { chromium } from '@playwright/test'
import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const base = process.argv[2] ?? 'http://127.0.0.1:4173/'
const outDir = resolve(process.argv[3] ?? '/tmp/shots')
mkdirSync(outDir, { recursive: true })

const CANDIDATES = [
  process.env.PW_CHROME,
  '/usr/bin/google-chrome',
  `${process.env.HOME}/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`,
]
const executablePath = CANDIDATES.find((p) => existsSync(p))

const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] })

const CONFIGS = [
  { name: 'phone', viewport: { width: 390, height: 844 }, dsf: 2 },
  { name: 'desktop', viewport: { width: 1440, height: 900 }, dsf: 1 },
]

const report = []
for (const cfg of CONFIGS) {
  const ctx = await browser.newContext({
    viewport: cfg.viewport,
    deviceScaleFactor: cfg.dsf,
    hasTouch: cfg.name === 'phone',
    isMobile: cfg.name === 'phone',
  })
  const page = await ctx.newPage()
  const errors = []
  const failed = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${new URL(r.url()).pathname}`)
  })

  const shot = async (label, full = false) => {
    const path = resolve(outDir, `${cfg.name}-${label}.png`)
    await page.screenshot({ path, fullPage: full })
    console.log(`${path}`)
  }

  const wait = (ms) => page.waitForTimeout(ms)

  await page.goto(`${base}?seed=design`, { waitUntil: 'networkidle' })
  await wait(600)
  await shot('01-known-picker')

  // Skip the roster picker.
  const none = page.getByTestId('know-none')
  if (await none.count()) {
    await none.click()
    await wait(500)
  }
  await shot('02-start')

  await page.getByRole('button', { name: /start/i }).click()
  await wait(900)
  await shot('03-round')

  // Answer round 1 (wrong or right, whichever) and capture the reveal.
  // The clip playing: the waveform should be alive, not at rest.
  const play = page.getByTestId('play')
  if (await play.count()) {
    await play.click()
    await wait(600)
    await shot('03b-playing')
  }

  await page.getByTestId('option-0').click()
  await wait(900)
  await shot('04-reveal')

  // Keyboard hints / hover state are cheap to capture on desktop only.
  if (cfg.name === 'desktop') {
    await page.getByTestId('next').click()
    await wait(700)
    await shot('05-round2')
  }

  // Play out to the end screen using the keyboard path.
  for (let i = 0; i < 12; i++) {
    if (await page.getByTestId('end-screen').count()) break
    const next = page.getByTestId('next')
    if (await next.count()) {
      await next.click()
      await wait(350)
    }
    if (await page.getByTestId('end-screen').count()) break
    await page.keyboard.press('1')
    await wait(350)
  }
  if (await page.getByTestId('end-screen').count()) {
    await wait(600)
    await shot('06-end')
  } else {
    console.log(`!! ${cfg.name}: never reached the end screen`)
  }

  report.push({ viewport: cfg.name, errors, failed: [...new Set(failed)] })
  await ctx.close()
}

await browser.close()

let bad = false
for (const r of report) {
  console.log(`\n== ${r.viewport} ==`)
  console.log(`console/page errors: ${r.errors.length}`)
  for (const e of r.errors.slice(0, 12)) console.log('  ' + e)
  console.log(`failed requests: ${r.failed.length}`)
  for (const f of r.failed.slice(0, 12)) console.log('  ' + f)
  if (r.errors.length || r.failed.length) bad = true
}
process.exit(bad ? 1 : 0)
