import { expect, test, type Page } from '@playwright/test'
import { dailyGuess, dailyNext, formatDateKey, initialDaily, londonDateKey } from '../../src/engine/daily.ts'

/** Uncaught page errors and console errors, so each test can assert there were none. */
function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
  })
  return errors
}

/** The engine is pure and keyed by the London date, so the test knows every answer. */
function todaysAnswers(): string[] {
  let s = initialDaily(londonDateKey())
  const names: string[] = []
  while (s.game.phase !== 'over') {
    names.push(s.game.round.language.name)
    s = dailyNext(dailyGuess(s, s.game.round.language.name))
  }
  return names
}

async function openDaily(page: Page) {
  await page.goto('./?daily=1')
  await expect(page.getByTestId('daily-intro')).toBeVisible()
  await page.getByTestId('daily-start').click()
  await expect(page.getByTestId('round-counter')).toHaveText('1/10')
}

test('the start screen shows the daily card with today’s date', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('./')
  await page.getByTestId('know-none').click()
  const card = page.getByTestId('daily-card')
  await expect(card).toBeVisible()
  await expect(card).toContainText(formatDateKey(londonDateKey()))
  await expect(card).toContainText('Type the language')
  await card.click()
  await expect(page.getByTestId('daily-intro')).toBeVisible()
  expect(errors).toEqual([])
})

test('?daily=1: type "span", pick Spanish from the list, guess, see the reveal', async ({ page }) => {
  const errors = trackErrors(page)
  await openDaily(page)

  const input = page.getByRole('combobox')
  await expect(input).toBeFocused()
  await expect(input).toHaveAttribute('aria-expanded', 'false')
  await input.fill('span')
  await expect(input).toHaveAttribute('aria-expanded', 'true')
  const list = page.getByRole('listbox')
  await expect(input).toHaveAttribute('aria-controls', (await list.getAttribute('id')) ?? '')
  const spanish = list.getByRole('option', { name: /Spanish/ })
  await expect(spanish).toBeVisible()
  await expect(spanish).toContainText('Español')

  await spanish.click()
  await expect(input).toHaveValue('Spanish')
  await expect(list).toBeHidden()
  await page.getByTestId('daily-guess').click()

  await expect(page.getByTestId('verdict')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Answer' })).toBeVisible()
  await expect(page.locator('.phrase__gloss')).not.toBeEmpty()
  expect(errors).toEqual([])
})

test('keyboard: arrows highlight, Enter picks, Escape closes, Enter submits raw text', async ({ page }) => {
  const errors = trackErrors(page)
  await openDaily(page)
  const input = page.getByRole('combobox')

  await input.fill('espanol')
  await input.press('ArrowDown')
  const active = await input.getAttribute('aria-activedescendant')
  expect(active).toBeTruthy()
  await expect(page.locator(`[id="${active}"]`)).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator(`[id="${active}"]`)).toContainText('Spanish')
  await input.press('Enter')
  await expect(input).toHaveValue('Spanish')

  await input.fill('fr')
  await expect(input).toHaveAttribute('aria-expanded', 'true')
  await input.press('Escape')
  await expect(input).toHaveAttribute('aria-expanded', 'false')

  await input.fill('not a language')
  await input.press('Enter')
  await expect(page.getByTestId('verdict')).toContainText('you typed “not a language”')
  await expect(page.getByTestId('verdict')).toContainText('−1 life')
  expect(errors).toEqual([])
})

test('a perfect day: scored, recorded, and shown as done on return', async ({ page, context }) => {
  const errors = trackErrors(page)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const answers = todaysAnswers()
  expect(answers).toHaveLength(10)

  await openDaily(page)
  for (const [i, name] of answers.entries()) {
    await expect(page.getByTestId('round-counter')).toHaveText(`${i + 1}/10`)
    await page.getByRole('combobox').fill(name.toUpperCase())
    await page.getByRole('combobox').press('Enter')
    await expect(page.getByTestId('verdict')).toContainText('Correct!')
    await page.getByTestId('next').click()
  }

  await expect(page.getByTestId('daily-end')).toBeVisible()
  await expect(page.getByTestId('daily-correct')).toContainText('10/10')
  await expect(page.getByTestId('daily-end-streak')).toContainText('1')
  await page.getByTestId('daily-share').click()
  await expect(page.getByTestId('daily-share-status')).toHaveText('Copied to clipboard!')
  const shared = await page.evaluate(() => navigator.clipboard.readText())
  expect(shared.split('\n')[0]).toBe(`Lingo Guess Daily ${formatDateKey(londonDateKey())} — 10/10 🔥 1-day streak`)

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lingo.daily.v1') ?? 'null'))
  expect(stored).toMatchObject({ lastDate: londonDateKey(), streak: 1, best: 1 })

  // Back on the menu the card reads as done; reopening shows the result, not a new game.
  await page.getByTestId('daily-back').click()
  await page.getByTestId('know-none').click()
  await expect(page.getByTestId('daily-card')).toContainText('come back tomorrow')
  await expect(page.getByTestId('daily-card')).toContainText('🔥 1-day streak')
  await page.goto('./?daily=1')
  await expect(page.getByTestId('daily-end')).toContainText('Done for today')
  await expect(page.getByTestId('daily-correct')).toContainText('10/10')
  expect(errors).toEqual([])
})
