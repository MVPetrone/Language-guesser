// Worst-case layout check: expert mode (5 options, no slow switch) on a 360x640
// phone — the smallest target the design was budgeted for.
import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'

const base = process.argv[2] ?? 'http://127.0.0.1:4173/Language-guesser/'
const out = process.argv[3] ?? '/tmp/shots-expert'
const exec = ['/usr/bin/google-chrome', `${process.env.HOME}/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`].find((p) => existsSync(p))
const browser = await chromium.launch({ executablePath: exec, args: ['--no-sandbox'] })

const sizes = [
  { name: 'small-360x640', w: 360, h: 640 },
  { name: 'tall-390x844', w: 390, h: 844 },
]
for (const s of sizes) {
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  await page.goto(`${base}?seed=expert-check`, { waitUntil: 'networkidle' })
  await page.getByTestId('know-none').click()
  await page.waitForTimeout(400)
  await page.locator('input[value="expert"]').check({ force: true })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${out}/${s.name}-start.png` })
  await page.getByRole('button', { name: /start/i }).click()
  await page.waitForTimeout(900)
  const opts = await page.locator('[data-testid^="option-"]').count()
  const scrolls = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 2)
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)
  await page.screenshot({ path: `${out}/${s.name}-round.png` })
  console.log(`${s.name}: options=${opts} verticalScroll=${scrolls} horizontalScroll=${overflowX} errors=${errors.length}`)
  if (errors.length) console.log(errors.slice(0, 5))
  await ctx.close()
}
await browser.close()
