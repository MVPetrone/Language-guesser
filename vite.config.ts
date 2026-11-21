import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // The site is served from the domain root (lingoguess.com), so assets,
  // audio and /admin all resolve from '/'.
  base: '/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/engine/**/*.test.ts'],
  },
})
