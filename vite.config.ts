import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: '/bib_to_abbr/',
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
  },
})
