import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // MUST match the GitHub repo name exactly — GitHub Pages serves project
  // sites from https://<user>.github.io/<repo>/
  base: '/Language-guesser/',
  plugins: [react()],
})
