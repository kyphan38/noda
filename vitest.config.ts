import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['scripts/test-dictation/__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    globals: false,
    fileParallelism: false,
    globalSetup: ['scripts/test-dictation/__tests__/global-setup.ts'],
  },
});
