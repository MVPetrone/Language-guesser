import { expect, test, type Page } from '@playwright/test'
import { LANGUAGES } from '../../src/data/languages.ts'
import { guess, initialState, nextRound } from '../../src/engine/game.ts'
import { seedFromString } from '../../src/engine/rng.ts'

/**
 * Collects uncaught page errors and console errors so each test can assert
 * there were none. `allow` filters console messages a test provokes on purpose.
 */
function trackErrors(page: Page, allow?: RegExp): string[] {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !(allow && allow.test(msg.text()))) errors.push(`console: ${msg.text()}`)
  })
  return errors
}

/** First visit: answer the known-languages picker with "none". */
async function skipKnown(page: Page) {
  await expect(page.getByTestId('know-languages')).toBeVisible()
  await page.getByTestId('know-none').click()
}

test('start, answer 3 rounds, reach the end screen with no page errors', async ({ page }) => {
  const errors = trackErrors(page)
  const clips: { url: string; status: number }[] = []
  page.on('response', (res) => {
    if (res.url().endsWith('.mp3')) clips.push({ url: res.url(), status: res.status() })
  })

  await page.goto('./?seed=smoke')
  await skipKnown(page)
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
    const res = await fetch('audio/fr-FR/0/l1-children-asleep-dog-awake.mp3')
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
  // The 404s this test serves are logged by the browser; anything else is a failure.
  const errors = trackErrors(page, /Failed to load resource.*404/)
  await page.route('**/*.mp3', (route) => route.fulfill({ status: 404, body: 'nope' }))
  await page.goto('./?seed=missing')
  await skipKnown(page)
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
  await skipKnown(page)
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
  // Asked once: the saved choice skips the picker on later visits.
  await expect(page.getByTestId('know-languages')).toHaveCount(0)
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
  // Nothing can be remembered, so the picker is shown; skipping still works.
  await skipKnown(page)
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

/** Answers rounds with option 1 until the end screen; returns each round's option names. */
async function playToEnd(page: Page): Promise<string[][]> {
  const end = page.getByTestId('end-screen')
  const rounds: string[][] = []
  for (let i = 0; i < 10 && !(await end.isVisible()); i++) {
    await expect(page.getByTestId('option-0')).toBeEnabled()
    rounds.push(await page.locator('.option-name').allTextContents())
    await page.keyboard.press('1')
    await expect(page.getByTestId('verdict')).toBeVisible()
    await page.getByTestId('next').click()
  }
  await expect(end).toBeVisible()
  return rounds
}

test('known languages: searchable picker, asked once, excluded from every option', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('./')
  await expect(page.getByTestId('know-languages')).toBeVisible()

  // Search narrows 40 checkboxes down, accent-insensitively.
  await page.getByTestId('know-search').fill('espanol')
  await expect(page.locator('.know-item')).toHaveCount(1)
  await page.getByTestId('know-es-ES').check()
  await page.getByTestId('know-search').fill('')
  await expect(page.locator('.know-item')).toHaveCount(40)
  for (const code of ['fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'nl-NL']) await page.getByTestId(`know-${code}`).check()
  await expect(page.getByTestId('know-count')).toHaveText(/6 selected · 34 left/)
  await page.getByTestId('know-save').click()

  await expect(page.getByTestId('excluded-count')).toContainText('6 languages you know are left out')
  await page.reload()
  await expect(page.getByTestId('know-languages')).toHaveCount(0)
  await expect(page.getByTestId('excluded-count')).toContainText('6 languages')

  const excluded = ['Spanish', 'French', 'German', 'Italian', 'Portuguese (Brazil)', 'Dutch']
  await page.getByRole('button', { name: /start/i }).click()
  const rounds = await playToEnd(page)
  expect(rounds.length).toBeGreaterThan(0)
  for (const names of rounds) {
    expect(names).toHaveLength(4)
    for (const name of names) expect(excluded).not.toContain(name)
  }
  expect(errors).toEqual([])
})

test('pool guard: Start is blocked below the minimum and unblocked again', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('./')
  await skipKnown(page)
  await expect(page.getByRole('button', { name: /start/i })).toBeEnabled()

  await page.getByTestId('edit-known').click()
  const keep = new Set(LANGUAGES.slice(0, 11).map((l) => l.code))
  for (const l of LANGUAGES) if (!keep.has(l.code)) await page.getByTestId(`know-${l.code}`).check()
  await expect(page.getByTestId('know-count')).toHaveText(/29 selected · 11 left to play — a game needs at least 12/)
  await page.getByTestId('know-save').click()

  await expect(page.getByRole('button', { name: /start/i })).toBeDisabled()
  await expect(page.getByTestId('pool-guard')).toContainText('at least 12 languages')
  await expect(page.getByTestId('pool-guard')).toContainText('only 11 are left')

  // Cancel leaves the choice alone; untick one and Start works again.
  await page.getByTestId('edit-known').click()
  await page.getByTestId('know-cancel').click()
  await expect(page.getByRole('button', { name: /start/i })).toBeDisabled()
  await page.getByTestId('edit-known').click()
  await page.getByTestId(`know-${LANGUAGES[39]?.code}`).uncheck()
  await page.getByTestId('know-save').click()
  await expect(page.getByTestId('pool-guard')).toHaveCount(0)
  await page.getByRole('button', { name: /start/i }).click()
  await expect(page.getByTestId('round-counter')).toHaveText('1/10')
  expect(errors).toEqual([])
})

test('a replay does not repeat any clip from the previous game', async ({ page }) => {
  const errors = trackErrors(page)
  const clips: string[] = []
  page.on('request', (req) => {
    if (req.url().endsWith('.mp3')) clips.push(new URL(req.url()).pathname)
  })
  await page.goto('./')
  await skipKnown(page)
  await page.getByRole('button', { name: /start/i }).click()
  await playToEnd(page)
  const first = new Set(clips)
  clips.length = 0

  await page.getByRole('button', { name: /play again/i }).click()
  await playToEnd(page)
  const second = new Set(clips)

  expect(first.size).toBeGreaterThanOrEqual(3)
  expect(second.size).toBeGreaterThanOrEqual(3)
  for (const url of second) expect(first.has(url)).toBe(false)
  for (const url of [...first, ...second]) expect(url).toMatch(/\/audio\/[a-zA-Z-]+\/[01]\/l2-[a-z0-9-]+\.mp3$/)
  const heard = await page.evaluate(() => JSON.parse(localStorage.getItem('gtl:heard') ?? '[]') as string[])
  expect(heard.length).toBe(first.size + second.size)
  expect(errors).toEqual([])
})
