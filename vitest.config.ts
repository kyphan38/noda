import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    include: ['scripts/test-dictation/__tests__/**/*.test.ts'],
    globals: false,
    fileParallelism: false,
    globalSetup: ['scripts/test-dictation/__tests__/global-setup.ts'],
  },
});
