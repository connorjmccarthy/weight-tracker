import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// `base` is set from BASE_PATH so the same build works on a custom domain
// (default '/') and on GitHub Pages (BASE_PATH=/weight-tracker/).
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH ?? '/',
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
