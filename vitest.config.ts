import { defineConfig } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': rootDir,
    },
  },
  css: {
    // Provide inline PostCSS config to avoid reading external postcss.config.mjs
    postcss: {
      plugins: [],
    },
  },
})