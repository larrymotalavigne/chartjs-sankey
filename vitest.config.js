import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 90,
        branches: 85,
        functions: 90,
        statements: 90
      }
    }
  }
});
