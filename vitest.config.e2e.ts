import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    env: {
      // Validated at startup; the tests replace the connection with their own.
      MONGODB_URI: 'mongodb://unused-in-tests',
    },
  },
});
