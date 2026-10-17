import { expect, test, type Page } from '@playwright/test'
import { LANGUAGES } from '../../src/data/languages.ts'
import { guess, initialState, nextRound } from '../../src/engine/game.ts'
import { seedFromString } from '../../src/engine/rng.ts'

/** Collects uncaught page errors so each test can assert there were none. */
function trackErrors(page: Page): Error[] {
  const errors: Error[] = []
  page.on('pageerror', (err) => errors.push(err))
  return errors
}

test('start, answer 3 rounds, reach the end screen with no page errors', async ({ page }) => {
  const errors = trackErrors(page)
  const clips: { url: string; status: number }[] = []
  page.on('response', (res) => {
    if (res.url().endsWith('.mp3')) clips.push({ url: res.url(), status: res.status() })
  })

  await page.goto('./?seed=smoke')
  await page.getByRole('button', { name: /start/i }).click()

  for (let n = 1; n <= 3; n++) {
    await expect(page.getByTestId('round-counter')).toHaveText(`${n}/10`)
    await page.getByTestId('option-0').click()
    await expect(page.getByTestId('verdict')).toBeVisible()
    // The correct answer is always highlighted on the reveal.
    await expect(page.locator('.option.is-correct')).toHaveCount(1)
    await page.getByTestId('next').click()
  }

  // After 3 answers we are either on round 4 or (3 misses) on the end screen.
  const end = page.getByTestId('end-screen')
  if (!(await end.isVisible())) {
    await expect(page.getByTestId('round-counter')).toHaveText('4/10')
    // Keep answering (keyboard path) until the game ends.
    for (let i = 0; i < 7 && !(await end.isVisible()); i++) {
      await page.keyboard.press('1')
      await expect(page.getByTestId('verdict')).toBeVisible()
      await page.getByTestId('next').click()
    }
  }
  await expect(end).toBeVisible()
  await expect(page.getByTestId('final-score')).toHaveText(/^\d+$/)

  expect(clips.length).toBeGreaterThan(0)
  for (const clip of clips) expect([200, 206]).toContain(clip.status)
  await expect(page.getByTestId('audio-error')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('bundled mp3 decodes in this browser', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('./')
  const result = await page.evaluate(async () => {
    const res = await fetch('audio/fr-FR/hello.mp3')
    const buf = await res.arrayBuffer()
    // Read the size first: decodeAudioData detaches the buffer.
    const bytes = buf.byteLength
    const ctx = new OfflineAudioContext(1, 1, 24000)
    const audio = await ctx.decodeAudioData(buf)
    return { status: res.status, bytes, seconds: audio.duration }
  })
  expect(result.status).toBe(200)
  expect(result.bytes).toBeGreaterThan(1024)
  expect(result.seconds).toBeGreaterThan(0.5)
  expect(errors).toEqual([])
})

test('a missing clip is surfaced and the round can be skipped', async ({ page }) => {
  const errors = trackErrors(page)
  await page.route('**/*.mp3', (route) => route.fulfill({ status: 404, body: 'nope' }))
  await page.goto('./?seed=missing')
  await page.getByRole('button', { name: /start/i }).click()

  await expect(page.getByTestId('audio-error')).toBeVisible()
  await page.getByTestId('skip').click()
  await expect(page.getByTestId('verdict')).toHaveText(/skipped/i)
  await page.getByTestId('next').click()
  await expect(page.getByTestId('round-counter')).toHaveText('2/10')
  expect(errors).toEqual([])
})

/** The engine is pure, so the test can replay the seed to know every answer. */
function plannedRounds(seedParam: string, hits: boolean[]) {
  let s = initialState(seedFromString(seedParam), 'normal', LANGUAGES)
  const picks: number[] = []
  for (const hit of hits) {
    if (s.phase !== 'round') break
    const pick = hit ? s.round.correctIndex : (s.round.correctIndex + 1) % 4
    picks.push(pick)
    s = nextRound(guess(s, pick))
  }
  return { picks, final: s }
}

test('perfect game: exact score, best score persisted, share copied', async ({ page, context }) => {
  const errors = trackErrors(page)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const { picks, final } = plannedRounds('perfect', Array(10).fill(true))
  expect(final.phase).toBe('over')

  await page.goto('./?seed=perfect')
  await page.getByRole('button', { name: /start/i }).click()
  for (const [i, pick] of picks.entries()) {
    await expect(page.getByTestId('round-counter')).toHaveText(`${i + 1}/10`)
    await page.keyboard.press(String(pick + 1))
    await expect(page.getByTestId('verdict')).toHaveText(/correct/i)
    await page.keyboard.press('Enter')
  }

  await expect(page.getByTestId('end-screen')).toBeVisible()
  await expect(page.getByTestId('final-score')).toHaveText(String(final.score))
  await expect(page.getByTestId('best-streak')).toHaveText('10')
  await expect(page.getByTestId('new-best')).toBeVisible()
  await expect(page.getByTestId('recap').locator('li')).toHaveCount(10)

  await page.getByTestId('share').click()
  await expect(page.getByTestId('share-status')).toHaveText(/copied/i)
  const clip = await page.evaluate(() => navigator.clipboard.readText())
  expect(clip).toContain('🟩'.repeat(10))
  expect(clip).toContain(`${final.score} pts`)

  await page.reload()
  await expect(page.getByText(`Best score: ${final.score}`)).toBeVisible()
  expect(errors).toEqual([])
})

test('works with localStorage disabled and no clipboard API', async ({ page }) => {
  const errors = trackErrors(page)
  await page.addInitScript(() => {
    const boom = () => {
      throw new DOMException('denied', 'SecurityError')
    }
    Object.defineProperty(window, 'localStorage', { get: boom })
    Object.defineProperty(navigator, 'clipboard', { get: () => undefined })
    document.execCommand = () => false
  })
  const { picks } = plannedRounds('nostorage', [true, false, false, false])

  await page.goto('./?seed=nostorage')
  await page.getByRole('button', { name: /start/i }).click()
  for (const pick of picks) {
    await page.getByTestId(`option-${pick}`).click()
    await page.getByTestId('next').click()
  }
  await expect(page.getByTestId('end-screen')).toBeVisible()
  await expect(page.getByTestId('final-score')).toHaveText('100')

  await page.getByTestId('share').click()
  await expect(page.getByTestId('share-fallback')).toBeVisible()
  await expect(page.getByTestId('share-fallback')).toHaveValue(/🟩🟥🟥/)
  expect(errors).toEqual([])
})
