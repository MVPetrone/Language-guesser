import { expect, test, type Page } from '@playwright/test'

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
