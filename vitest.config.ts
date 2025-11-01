import { defineConfig } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        'coverage/',
        'dist/',
        '.next/',
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
        // Critical modules should have higher coverage
        'lib/llm/': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },
    },
    // Fail tests on console.error to catch unhandled errors
    onConsoleLog: (log, type) => {
      if (type === 'stderr' && log.includes('Error:')) {
        return false // This will fail the test
      }
      return true // Allow other console logs
    },
    // Set up test timeout
    testTimeout: 10000,
    // Enable strict mode for better error detection
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.json',
    },
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