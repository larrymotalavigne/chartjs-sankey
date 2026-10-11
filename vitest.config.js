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
        // V8 counts branches differently across Node.js versions (~93% on
        // Node 22 vs ~79% on Node 24 for the same tests), so keep this lower.
        branches: 75,
        functions: 90,
        statements: 90
      }
    }
  }
});
