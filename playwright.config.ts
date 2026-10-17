import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

// Point at an already-installed Chromium when Playwright's pinned build isn't
// downloaded (e.g. an older cached build on an offline host).
const executablePath = process.env.PW_CHROMIUM_PATH || undefined

// Runs against the prebuilt dist/ (run `npm run build` first). One worker and
// one browser keep memory low on small hosts.
export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}/Language-guesser/`,
    trace: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: { executablePath } },
    },
  ],
  webServer: {
    command: `node scripts/serve-dist.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}/Language-guesser/`,
    reuseExistingServer: false,
    timeout: 15_000,
  },
})
