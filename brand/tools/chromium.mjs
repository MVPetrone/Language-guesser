/**
 * Headless Chromium for brand tooling — resolved exactly like
 * scripts/render-asset.mjs (env override, system Chrome, local cache) and
 * launched with the same flags, so measurements match the PNG renders.
 */
import { existsSync } from 'node:fs'
import { chromium } from '@playwright/test'

const CANDIDATES = [
  process.env.PW_CHROME,
  '/usr/bin/google-chrome',
  `${process.env.HOME}/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`,
  `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell`,
].filter(Boolean)

export function launchChromium() {
  return chromium.launch({
    executablePath: CANDIDATES.find((p) => existsSync(p)),
    args: ['--no-sandbox', '--font-render-hinting=none'],
  })
}
